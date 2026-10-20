-- ============================================================================
-- Recette SKU : seules les etapes de la phase FABRICATION se choisissent par
-- SKU. Toutes les autres phases (reception, desassemblage, controle qualite,
-- emballage, expedition, comptabilite) sont fixes : appliquees d'office a tous
-- les sacs. Seule exception : "Ajout des bandes", fixe mais reservee aux
-- Speedy 35+ et Keepall (bands_allowed, cf. 0026).
--
-- A lancer APRES 0026. Rejouable sans risque. Les recettes SKU ne sont pas
-- modifiees : leurs anciennes cles (RECEPTION, DISASSEMBLING, EMBROIDERY_SIDE,
-- BANDS) sont simplement ignorees.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from production_stages
    where phase = 'disassembly' and name = 'Ajout du numero de serie'
  ) then
    raise exception 'Lance d''abord la migration 0026 (etapes de desassemblage).';
  end if;
end;
$$;

-- Rang d'une phase dans le parcours d'un sac ("stock propre" = entre le
-- desassemblage et la fabrication ; l'ordre de l'enum ne le reflete pas car
-- cette valeur y a ete ajoutee apres coup).
create or replace function stage_phase_rank(p stage_phase)
returns int language sql immutable as $$
  select case p::text
    when 'reception' then 0
    when 'disassembly' then 1
    when 'stock_propre' then 2
    when 'manufacturing' then 3
    when 'quality_control' then 4
    when 'wrapping' then 5
    when 'shipping' then 6
    when 'accounting' then 7
    else 99
  end;
$$;

-- ----------------------------------------------------------------------------
-- 1. Nouveaux sacs : toutes les etapes fixes sont creees avec la checklist
-- (un sac recu en pieces detachees n'a que reception + desassemblage, le reste
-- vient a l'attribution d'un SKU). Bandes seulement pour Speedy 35+ / Keepall.
-- ----------------------------------------------------------------------------
create or replace function seed_bag_stage_progress()
returns trigger language plpgsql as $$
declare
  v_bands_ok boolean;
begin
  select bands_allowed(m.name, m.base_size) into v_bands_ok
  from bag_models m where m.id = new.model_id;

  if v_bands_ok is null then
    v_bands_ok := bands_allowed(new.model_label, new.size);
  end if;

  insert into bag_stage_progress (bag_id, stage_id, status)
  select new.id, s.id, 'a_faire'
  from production_stages s
  where s.is_active = true
    and (s.phase <> 'manufacturing' or s.catalog_column is null)
    and (new.sale_type = 'assemble' or s.phase in ('reception', 'disassembly'))
    and (s.catalog_column is distinct from 'BANDS' or coalesce(v_bands_ok, false));

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Sacs existants
-- ----------------------------------------------------------------------------

-- 2a. Les etapes fixes n'ont plus de position issue d'une recette : ordre par
-- defaut (production_stages.order_index).
update bag_stage_progress bsp
set sequence_override = null, subcontract_note = null
from production_stages s
where s.id = bsp.stage_id
  and (s.phase <> 'manufacturing' or s.catalog_column is null)
  and (bsp.sequence_override is not null or bsp.subcontract_note is not null);

-- 2b. Sacs encore en reception / desassemblage : on complete les etapes fixes
-- manquantes de ces deux phases (ex : "Broderie cote", "Ajout des bandes")
-- Les sacs plus avances ne recoivent rien : leurs phases passees sont closes.
insert into bag_stage_progress (bag_id, stage_id, status)
select b.id, s.id, 'a_faire'::stage_status
from bags b
cross join production_stages s
left join bag_models m on m.id = b.model_id
where b.current_phase in ('reception', 'disassembly')
  and s.is_active = true
  and s.phase in ('reception', 'disassembly')
  and (
    s.catalog_column is distinct from 'BANDS'
    or bands_allowed(coalesce(m.name, b.model_label), coalesce(m.base_size, b.size))
  )
on conflict (bag_id, stage_id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Utilitaire de rattrapage (voir 0016 / 0026) aligne sur la meme regle.
-- ----------------------------------------------------------------------------
create or replace function assign_sku_to_bag_by_serial(p_serial text, p_sku text)
returns text language plpgsql as $$
declare
  v_bag_id uuid;
  v_phase stage_phase;
  v_bands_ok boolean;
  v_catalog record;
  v_steps jsonb;
  v_stage record;
  v_existing bag_stage_progress%rowtype;
  v_found boolean;
  v_raw text;
  v_numeric numeric;
  v_sequence_override numeric;
  v_subcontract_note text;
begin
  select b.id, b.current_phase, bands_allowed(coalesce(m.name, b.model_label), coalesce(m.base_size, b.size))
    into v_bag_id, v_phase, v_bands_ok
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
    v_found := found;

    -- Etape fixe : appliquee a tous les sacs (bandes : Speedy 35+ / Keepall).
    if v_stage.phase <> 'manufacturing' or v_stage.catalog_column is null then
      if v_stage.catalog_column = 'BANDS' and not coalesce(v_bands_ok, false) then
        if v_found then
          delete from bag_stage_progress where id = v_existing.id;
        end if;
      elsif not v_found then
        if stage_phase_rank(v_stage.phase) >= stage_phase_rank(v_phase) then
          insert into bag_stage_progress (bag_id, stage_id, status)
            values (v_bag_id, v_stage.id, 'a_faire');
        end if;
      elsif v_existing.sequence_override is not null or v_existing.subcontract_note is not null then
        update bag_stage_progress
          set sequence_override = null, subcontract_note = null
          where id = v_existing.id;
      end if;
      continue;
    end if;

    -- Etape de fabrication pilotee par la recette du SKU.
    v_raw := v_steps ->> v_stage.catalog_column;

    if v_raw is null or v_raw = '' or v_raw = '0' then
      if v_found then
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

    if v_found then
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
