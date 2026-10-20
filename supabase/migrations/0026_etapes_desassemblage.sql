-- ============================================================================
-- Phase "A desassembler" : etapes separees, bandes (Speedy 35+ / Keepall) et
-- ajout du numero de serie.
--
-- Ordre final dans la phase :
--   1 Desassemblage
--   2 Nettoyage
--   3 Repassage
--   4 Pose fermeture eclair
--   5 Ajout des bandes            (seulement Speedy 35 et + et Keepall)
--   6 Ajout du numero de serie    (tous les sacs)
--   7 Broderie cote
--
-- Les 4 premieres etapes partagent la colonne de catalogue DISASSEMBLING : une
-- recette SKU qui prevoyait l'ancienne etape combinee les applique donc toutes
-- les quatre, sans reecrire les 923 recettes. Script rejouable sans risque.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Etapes de la phase
-- ----------------------------------------------------------------------------

-- L'ancienne etape combinee devient "Desassemblage" (meme id : l'avancement
-- des sacs existants est conserve).
update production_stages
  set name = 'Desassemblage', order_index = 1
  where phase = 'disassembly'
    and name = 'Desassemblage - nettoyage - repassage - pose fermeture eclair';

insert into production_stages (phase, name, order_index, catalog_column, is_active)
select 'disassembly'::stage_phase, v.name, v.idx, 'DISASSEMBLING', true
from (values
  ('Nettoyage', 2),
  ('Repassage', 3),
  ('Pose fermeture eclair', 4)
) as v(name, idx)
where not exists (
  select 1 from production_stages ps
  where ps.phase = 'disassembly' and ps.name = v.name
);

-- "Pose des bandes" existait deja (pilotee par le catalogue SKU) : on la
-- renomme plutot que d'en creer une seconde.
update production_stages
  set name = 'Ajout des bandes', order_index = 5
  where phase = 'disassembly' and catalog_column = 'BANDS';

-- Toujours applicable (pas de colonne catalogue) : tous les sacs l'ont.
insert into production_stages (phase, name, order_index, catalog_column, is_active)
select 'disassembly'::stage_phase, 'Ajout du numero de serie', 6, null, true
where not exists (
  select 1 from production_stages ps
  where ps.phase = 'disassembly' and ps.name = 'Ajout du numero de serie'
);

update production_stages
  set order_index = 7
  where phase = 'disassembly' and catalog_column = 'EMBROIDERY_SIDE';

-- ----------------------------------------------------------------------------
-- 2. Regle "bandes" : Speedy 35 et plus, et Keepall (quelle que soit la
-- taille). Aucun autre modele.
-- ----------------------------------------------------------------------------
create or replace function bands_allowed(p_name text, p_size text)
returns boolean language sql immutable as $$
  select case
    when lower(coalesce(p_name, '')) like '%keepall%' then true
    when lower(coalesce(p_name, '')) like '%speedy%' then
      coalesce(
        (regexp_match(coalesce(p_size, '') || ' ' || coalesce(p_name, ''), '\d+'))[1]::int,
        0
      ) >= 35
    else false
  end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Nouveaux sacs : l'etape "numero de serie" est creee avec la checklist,
-- y compris pour un sac recu en pieces detachees (pas encore de SKU).
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
      and (
        catalog_column in ('RECEPTION', 'DISASSEMBLING')
        or (phase = 'disassembly' and catalog_column is null)
      );
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Sacs deja existants
-- ----------------------------------------------------------------------------

-- 4a. Les 3 nouvelles etapes heritent de l'avancement de l'ancienne etape
-- combinee : terminee => terminees ; en cours / bloquee => seule
-- "Desassemblage" garde ce statut, les autres repartent a faire.
insert into bag_stage_progress (
  bag_id, stage_id, status, assigned_to, completed_at, sequence_override, subcontract_note
)
select
  src.bag_id,
  ns.id,
  case when src.status = 'termine' then 'termine'::stage_status else 'a_faire'::stage_status end,
  src.assigned_to,
  case when src.status = 'termine' then src.completed_at else null end,
  src.sequence_override,
  src.subcontract_note
from bag_stage_progress src
join production_stages os
  on os.id = src.stage_id and os.phase = 'disassembly' and os.name = 'Desassemblage'
join production_stages ns
  on ns.phase = 'disassembly' and ns.name in ('Nettoyage', 'Repassage', 'Pose fermeture eclair')
on conflict (bag_id, stage_id) do nothing;

-- 4b. "Ajout du numero de serie" pour tous les sacs : a faire si le sac est
-- encore en reception / desassemblage, deja considere fait s'il est plus loin.
insert into bag_stage_progress (bag_id, stage_id, status)
select
  b.id,
  s.id,
  case
    when b.current_phase in ('reception', 'disassembly') then 'a_faire'::stage_status
    else 'termine'::stage_status
  end
from bags b
cross join production_stages s
where s.phase = 'disassembly' and s.name = 'Ajout du numero de serie'
on conflict (bag_id, stage_id) do nothing;

-- 4c. Les bandes ne s'appliquent qu'aux Speedy 35+ et Keepall : on retire
-- l'etape (non commencee) des autres sacs.
delete from bag_stage_progress bsp
using production_stages ps, bags b
left join bag_models m on m.id = b.model_id
where ps.id = bsp.stage_id
  and ps.catalog_column = 'BANDS'
  and b.id = bsp.bag_id
  and bsp.status = 'a_faire'
  and not bands_allowed(coalesce(m.name, b.model_label), coalesce(m.base_size, b.size));

-- ----------------------------------------------------------------------------
-- 5. Ordre des recettes SKU : les bandes passent AVANT la broderie cote
-- (jusqu'ici l'inverse). On echange les deux positions quand elles sont
-- toutes deux numeriques ; les autres etapes ne bougent pas.
-- ----------------------------------------------------------------------------
update sku_catalog
set steps = jsonb_set(
  jsonb_set(steps, '{BANDS}', steps -> 'EMBROIDERY_SIDE'),
  '{EMBROIDERY_SIDE}', steps -> 'BANDS'
)
where jsonb_typeof(steps -> 'BANDS') = 'number'
  and jsonb_typeof(steps -> 'EMBROIDERY_SIDE') = 'number'
  and (steps ->> 'EMBROIDERY_SIDE')::numeric < (steps ->> 'BANDS')::numeric;

-- Meme echange sur les sacs deja attribues a un SKU.
with pair as (
  select
    b.id as bands_row,
    e.id as emb_row,
    b.sequence_override as bands_seq,
    e.sequence_override as emb_seq
  from bag_stage_progress b
  join production_stages sb on sb.id = b.stage_id and sb.catalog_column = 'BANDS'
  join bag_stage_progress e on e.bag_id = b.bag_id
  join production_stages se on se.id = e.stage_id and se.catalog_column = 'EMBROIDERY_SIDE'
  where b.sequence_override is not null
    and e.sequence_override is not null
    and e.sequence_override < b.sequence_override
)
update bag_stage_progress t
set sequence_override = case when t.id = p.bands_row then p.emb_seq else p.bands_seq end
from pair p
where t.id in (p.bands_row, p.emb_row);

-- ----------------------------------------------------------------------------
-- 6. Utilitaire de rattrapage (voir 0016) : applique aussi la regle bandes.
-- ----------------------------------------------------------------------------
create or replace function assign_sku_to_bag_by_serial(p_serial text, p_sku text)
returns text language plpgsql as $$
declare
  v_bag_id uuid;
  v_bands_ok boolean;
  v_catalog record;
  v_steps jsonb;
  v_stage record;
  v_existing bag_stage_progress%rowtype;
  v_raw text;
  v_numeric numeric;
  v_sequence_override numeric;
  v_subcontract_note text;
begin
  select b.id, bands_allowed(coalesce(m.name, b.model_label), coalesce(m.base_size, b.size))
    into v_bag_id, v_bands_ok
  from bags b
  left join bag_models m on m.id = b.model_id
  where b.serial_number = p_serial;

  if v_bag_id is null then
    return format('Aucun sac trouve avec le numero de serie "%s"', p_serial);
  end if;

  select * into v_catalog from sku_catalog where sku ilike p_sku limit 1;
  if v_catalog is null then
    return format('SKU "%s" introuvable dans le catalogue', p_sku);
  end if;

  update bags
    set sku = v_catalog.sku, sku_edition = v_catalog.edition, sale_type = 'assemble'
    where id = v_bag_id;

  v_steps := coalesce(v_catalog.steps, '{}'::jsonb);

  for v_stage in select * from production_stages where is_active = true loop
    select * into v_existing from bag_stage_progress
      where bag_id = v_bag_id and stage_id = v_stage.id;

    if v_stage.catalog_column is null then
      if not found then
        insert into bag_stage_progress (bag_id, stage_id, status) values (v_bag_id, v_stage.id, 'a_faire');
      end if;
      continue;
    end if;

    v_raw := v_steps ->> v_stage.catalog_column;

    -- Bandes : seulement Speedy 35+ / Keepall, meme si la recette SKU les prevoit.
    if v_stage.catalog_column = 'BANDS' and not coalesce(v_bands_ok, false) then
      v_raw := null;
    end if;

    if v_raw is null or v_raw = '' or v_raw = '0' then
      if found then
        delete from bag_stage_progress where id = v_existing.id;
      end if;
      continue;
    end if;

    begin
      v_numeric := v_raw::numeric;
      v_sequence_override := v_numeric;
      v_subcontract_note := null;
    exception when others then
      v_sequence_override := null;
      v_subcontract_note := v_raw;
    end;

    if found then
      update bag_stage_progress
        set sequence_override = v_sequence_override, subcontract_note = v_subcontract_note
        where id = v_existing.id;
    else
      insert into bag_stage_progress (bag_id, stage_id, status, sequence_override, subcontract_note)
        values (v_bag_id, v_stage.id, 'a_faire', v_sequence_override, v_subcontract_note);
    end if;
  end loop;

  perform advance_bag_phase(v_bag_id);

  return format('SKU %s attribue au sac %s', v_catalog.sku, p_serial);
end;
$$;
