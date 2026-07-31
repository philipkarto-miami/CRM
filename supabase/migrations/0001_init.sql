-- ============================================================================
-- Philip Karto CRM - schema initial
-- Atelier de reconstruction / personnalisation de sacs vintage (LV, Hermes)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type user_role as enum ('admin', 'atelier', 'commercial', 'comptabilite');

create type sale_type as enum ('assemble', 'disassemble');

create type stage_phase as enum (
  'reception',
  'disassembly',
  'manufacturing',
  'quality_control',
  'wrapping',
  'shipping',
  'accounting'
);

create type stage_status as enum ('a_faire', 'en_cours', 'termine', 'bloque');

create type payment_status as enum ('en_attente', 'partiel', 'paye');

create type order_status as enum ('recu', 'en_traitement', 'expedie', 'livre', 'annule');

-- ----------------------------------------------------------------------------
-- profiles : un profil par utilisateur Supabase Auth, porte le role applicatif
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role user_role not null default 'atelier',
  created_at timestamptz not null default now()
);

-- Cree automatiquement un profil a la creation d'un utilisateur Supabase Auth.
-- Le role peut etre passe dans les metadata de l'invitation ("role": "admin"...),
-- sinon "atelier" par defaut. Un admin peut ensuite changer le role via /settings/users.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'atelier')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Fonction utilitaire : role de l'utilisateur courant (pour les policies RLS)
create function auth_role()
returns user_role
language sql stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select auth_role() = 'admin';
$$;

-- ----------------------------------------------------------------------------
-- brands / bag_models
-- ----------------------------------------------------------------------------
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table bag_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands (id) on delete set null,
  name text not null,
  base_size text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- suppliers / customers
-- ----------------------------------------------------------------------------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- production_stages : liste maitresse (configurable) des etapes de fabrication
-- ----------------------------------------------------------------------------
create table production_stages (
  id uuid primary key default gen_random_uuid(),
  phase stage_phase not null,
  name text not null,
  order_index int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- bags : le sac / la piece de stock (coeur du CRM)
-- ----------------------------------------------------------------------------
create table bags (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  serial_number text unique not null,
  model_id uuid references bag_models (id) on delete set null,
  model_label text not null,
  brand_id uuid references brands (id) on delete set null,
  size text,
  size_verified boolean not null default false,
  canvas_verified boolean not null default false,
  canvas_notes text,
  supplier_id uuid references suppliers (id) on delete set null,
  auth_number_supplier text,
  purchase_price numeric(10, 2),
  purchase_date date,
  factory_date date,
  photos_link text,
  sale_type sale_type not null default 'disassemble',
  current_phase stage_phase not null default 'reception',
  invoice_number text,
  delivery_date date,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bags_current_phase_idx on bags (current_phase);
create index bags_model_id_idx on bags (model_id);

create function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bags_set_updated_at
  before update on bags
  for each row execute procedure set_updated_at();

-- ----------------------------------------------------------------------------
-- bag_stage_progress : avancement d'un sac sur chaque etape
-- ----------------------------------------------------------------------------
create table bag_stage_progress (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references bags (id) on delete cascade,
  stage_id uuid not null references production_stages (id) on delete cascade,
  status stage_status not null default 'a_faire',
  assigned_to uuid references profiles (id) on delete set null,
  completed_at timestamptz,
  notes text,
  unique (bag_id, stage_id)
);

-- Quand un nouveau sac est cree, on initialise sa checklist avec toutes les
-- etapes actives de production_stages.
create function seed_bag_stage_progress()
returns trigger language plpgsql as $$
begin
  insert into bag_stage_progress (bag_id, stage_id, status)
  select new.id, id, 'a_faire' from production_stages where is_active = true;
  return new;
end;
$$;

create trigger bags_seed_stage_progress
  after insert on bags
  for each row execute procedure seed_bag_stage_progress();

-- ----------------------------------------------------------------------------
-- orders : commandes / ventes clients
-- ----------------------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_name text not null,
  bag_id uuid references bags (id) on delete set null,
  customer_id uuid references customers (id) on delete set null,
  sale_type sale_type not null default 'assemble',
  sale_price numeric(10, 2),
  order_date date not null default current_date,
  status order_status not null default 'recu',
  payment_status payment_status not null default 'en_attente',
  invoice_number text,
  shipping_carrier text,
  tracking_number text,
  shipped_at date,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger orders_set_updated_at
  before update on orders
  for each row execute procedure set_updated_at();

-- ----------------------------------------------------------------------------
-- activity_log : journal d'activite (audit simple)
-- ----------------------------------------------------------------------------
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid references bags (id) on delete cascade,
  user_id uuid references profiles (id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- RLS : Row Level Security
-- Regle generale : tout utilisateur authentifie (avec profil) peut lire.
-- Les ecritures sont restreintes par role.
-- ============================================================================
alter table profiles enable row level security;
alter table brands enable row level security;
alter table bag_models enable row level security;
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table production_stages enable row level security;
alter table bags enable row level security;
alter table bag_stage_progress enable row level security;
alter table orders enable row level security;
alter table activity_log enable row level security;

-- profiles
create policy "profiles: lecture pour tous les authentifies" on profiles
  for select using (auth.uid() is not null);
create policy "profiles: un admin peut tout modifier" on profiles
  for update using (is_admin());
create policy "profiles: un utilisateur peut modifier son propre nom" on profiles
  for update using (auth.uid() = id);

-- brands / bag_models / suppliers / customers / production_stages : lecture large,
-- ecriture admin + atelier (referentiels) sauf customers/suppliers ouverts au commercial aussi
create policy "brands: lecture" on brands for select using (auth.uid() is not null);
create policy "brands: ecriture admin" on brands for all
  using (is_admin()) with check (is_admin());

create policy "bag_models: lecture" on bag_models for select using (auth.uid() is not null);
create policy "bag_models: ecriture admin/atelier" on bag_models for all
  using (auth_role() in ('admin', 'atelier')) with check (auth_role() in ('admin', 'atelier'));

create policy "suppliers: lecture" on suppliers for select using (auth.uid() is not null);
create policy "suppliers: ecriture admin/atelier" on suppliers for all
  using (auth_role() in ('admin', 'atelier')) with check (auth_role() in ('admin', 'atelier'));

create policy "customers: lecture" on customers for select using (auth.uid() is not null);
create policy "customers: ecriture admin/commercial" on customers for all
  using (auth_role() in ('admin', 'commercial')) with check (auth_role() in ('admin', 'commercial'));

create policy "production_stages: lecture" on production_stages for select using (auth.uid() is not null);
create policy "production_stages: ecriture admin" on production_stages for all
  using (is_admin()) with check (is_admin());

-- bags : lecture pour tous, ecriture admin + atelier (fabrication/stock).
-- le commercial peut aussi modifier (sale_type, invoice_number...) au moment de la vente.
create policy "bags: lecture" on bags for select using (auth.uid() is not null);
create policy "bags: creation admin/atelier" on bags for insert
  with check (auth_role() in ('admin', 'atelier'));
create policy "bags: modification admin/atelier/commercial" on bags for update
  using (auth_role() in ('admin', 'atelier', 'commercial'));
create policy "bags: suppression admin" on bags for delete using (is_admin());

-- bag_stage_progress : lecture pour tous, ecriture admin + atelier (ce sont eux qui
-- cochent les etapes de fabrication)
create policy "bag_stage_progress: lecture" on bag_stage_progress for select using (auth.uid() is not null);
create policy "bag_stage_progress: ecriture admin/atelier" on bag_stage_progress for all
  using (auth_role() in ('admin', 'atelier')) with check (auth_role() in ('admin', 'atelier'));

-- orders : lecture pour tous. Creation/modif : admin, commercial (vente/expedition),
-- comptabilite (statut de paiement / facture).
create policy "orders: lecture" on orders for select using (auth.uid() is not null);
create policy "orders: ecriture admin/commercial/comptabilite" on orders for all
  using (auth_role() in ('admin', 'commercial', 'comptabilite'))
  with check (auth_role() in ('admin', 'commercial', 'comptabilite'));

-- activity_log : lecture pour tous, ecriture pour tous les authentifies (log applicatif)
create policy "activity_log: lecture" on activity_log for select using (auth.uid() is not null);
create policy "activity_log: creation" on activity_log for insert with check (auth.uid() is not null);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Marques
insert into brands (name) values ('Louis Vuitton'), ('Hermes');

-- Modeles de sacs (bases sur les collections du site philipkarto.com)
insert into bag_models (brand_id, name, base_size)
select b.id, m.name, m.size
from brands b
join (values
  ('Louis Vuitton', 'Speedy', '25'),
  ('Louis Vuitton', 'Speedy', '30'),
  ('Louis Vuitton', 'Speedy', '35'),
  ('Louis Vuitton', 'Speedy', '40'),
  ('Louis Vuitton', 'Keepall', '45'),
  ('Louis Vuitton', 'Keepall', '50'),
  ('Louis Vuitton', 'Keepall', '55'),
  ('Louis Vuitton', 'Neverfull', 'MM'),
  ('Louis Vuitton', 'Neverfull', 'GM'),
  ('Hermes', 'Birkin', '25'),
  ('Hermes', 'Birkin', '30'),
  ('Hermes', 'Birkin', '35')
) as m(brand, name, size) on m.brand = b.name;

-- Etapes de production : reprise exacte du pipeline du fichier CSV fournisseur
insert into production_stages (phase, name, order_index) values
  -- Reception
  ('reception', 'Reception du sac', 1),

  -- Desassemblage
  ('disassembly', 'Desassemblage - nettoyage - repassage - pose fermeture eclair', 1),
  ('disassembly', 'Broderie cote (embroidery side)', 2),
  ('disassembly', 'Pose des bandes', 3),

  -- Fabrication
  ('manufacturing', 'Demarrage fabrication', 1),
  ('manufacturing', 'Broderie', 2),
  ('manufacturing', 'Pose des anses', 3),
  ('manufacturing', 'Doublure', 4),
  ('manufacturing', 'Fermeture', 5),
  ('manufacturing', 'Peinture', 6),
  ('manufacturing', 'Bandouliere', 7),
  ('manufacturing', 'Patch', 8),
  ('manufacturing', 'Sous-traitance (1)', 9),
  ('manufacturing', 'Sous-traitance (2)', 10),

  -- Controle qualite
  ('quality_control', 'Fermeture eclair', 1),
  ('quality_control', 'Carte d''authentification', 2),
  ('quality_control', 'Bandouliere', 3),
  ('quality_control', 'Doublure', 4),
  ('quality_control', 'Peinture', 5),

  -- Emballage
  ('wrapping', 'Demarrage emballage', 1),
  ('wrapping', 'Emballage', 2),

  -- Expedition
  ('shipping', 'Commande d''expedition', 1),
  ('shipping', 'Expedie', 2),

  -- Comptabilite
  ('accounting', 'Facture', 1),
  ('accounting', 'Numero de facture', 2),
  ('accounting', 'Paiement', 3);
