-- ============================================================================
-- Philip Karto CRM - catalogue produits enrichi, choix a la reception,
-- colonne "sac a commander" dans les ventes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Catalogue produits : le sku_catalog devient un vrai catalogue (description
-- + photo), pas seulement une table technique d'etapes de fabrication.
-- ----------------------------------------------------------------------------
alter table sku_catalog add column description text;
alter table sku_catalog add column photo_path text;

insert into storage.buckets (id, name, public)
values ('sku-photos', 'sku-photos', false)
on conflict (id) do nothing;

create policy "sku-photos: lecture authentifies" on storage.objects for select
  using (bucket_id = 'sku-photos' and auth.uid() is not null);

create policy "sku-photos: upload admin+atelier" on storage.objects for insert
  with check (bucket_id = 'sku-photos' and auth_role() in ('admin', 'atelier'));

create policy "sku-photos: suppression admin+atelier" on storage.objects for delete
  using (bucket_id = 'sku-photos' and auth_role() in ('admin', 'atelier'));

-- ----------------------------------------------------------------------------
-- 2. Reception : la checklist de fabrication depend maintenant du choix fait
-- a la reception du sac (bags.sale_type, deja existant) :
--   - 'assemble'    = ce sac deviendra un produit fini (un SKU lui sera
--                     attribue ensuite) : on seed les etapes toujours
--                     applicables (reception + etapes sans colonne catalogue :
--                     controle qualite, emballage, expedition, comptabilite,
--                     demarrage fabrication). Les etapes pilotees par le SKU
--                     seront ajoutees par assignSku() quand le SKU sera choisi.
--   - 'disassemble' = ce sac reste en pieces detachees, en attente (juste son
--                     modele est connu) : seed minimal (reception +
--                     desassemblage uniquement), pas de suivi qualite/
--                     emballage/expedition tant qu'aucun SKU n'est attribue.
-- ----------------------------------------------------------------------------
create or replace function seed_bag_stage_progress()
returns trigger language plpgsql as $$
begin
  if new.sale_type = 'assemble' then
    insert into bag_stage_progress (bag_id, stage_id, status)
    select new.id, id, 'a_faire'
    from production_stages
    where is_active = true
      and (catalog_column is null or catalog_column = 'RECEPTION');
  else
    insert into bag_stage_progress (bag_id, stage_id, status)
    select new.id, id, 'a_faire'
    from production_stages
    where is_active = true
      and catalog_column in ('RECEPTION', 'DISASSEMBLING');
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Ventes : une commande peut ne pas encore avoir de sac (bag_id deja
-- nullable) - on ajoute le modele souhaite pour pouvoir suggerer un
-- rattachement automatique quand un sac correspondant arrive en stock, et un
-- statut dedie "sac a commander".
-- ----------------------------------------------------------------------------
alter table orders add column desired_model_id uuid references bag_models (id) on delete set null;

alter type order_status add value if not exists 'sac_a_commander';
