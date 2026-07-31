-- ============================================================================
-- Philip Karto CRM - numero de serie automatique + simplification du formulaire
-- de creation de sac
-- ============================================================================

-- Le SKU n'est plus saisi a la creation (il reste modifiable plus tard sur la
-- fiche du sac), donc on retire la contrainte NOT NULL. L'unicite est conservee
-- (Postgres autorise plusieurs valeurs NULL avec une contrainte unique).
alter table bags alter column sku drop not null;

-- ----------------------------------------------------------------------------
-- Compteur mensuel pour le numero de serie : PK + AA (annee) + MM (mois) +
-- NNN (increment sur 3 chiffres, repart a 001 chaque nouveau mois).
-- Exemple : PK2607001, PK2607002, ... puis PK2608001 le mois suivant.
-- ----------------------------------------------------------------------------
create table serial_counters (
  year_month text primary key, -- format 'AAMM', ex: '2607'
  last_value int not null default 0
);

alter table serial_counters enable row level security;
create policy "serial_counters: lecture" on serial_counters for select using (auth.uid() is not null);

create function generate_bag_serial_number()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  ym text := to_char(now(), 'YYMM');
  next_val int;
begin
  insert into serial_counters (year_month, last_value)
  values (ym, 1)
  on conflict (year_month) do update set last_value = serial_counters.last_value + 1
  returning last_value into next_val;

  return 'PK' || ym || lpad(next_val::text, 3, '0');
end;
$$;

create function set_bag_serial_number()
returns trigger
language plpgsql
as $$
begin
  if new.serial_number is null or new.serial_number = '' then
    new.serial_number := generate_bag_serial_number();
  end if;
  return new;
end;
$$;

create trigger bags_set_serial_number
  before insert on bags
  for each row execute procedure set_bag_serial_number();
