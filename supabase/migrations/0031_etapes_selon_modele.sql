-- ============================================================================
-- Etapes fixes qui dependent du modele du sac :
--   - "Ajout des bandes"  (BANDS)            : Speedy 35 et plus, Keepall
--   - "Broderie cote"     (EMBROIDERY_SIDE)  : tous les sacs SAUF les Neverfull
-- Toutes les autres etapes fixes s'appliquent a tous les sacs.
--
-- A lancer APRES 0026 et 0028. Rejouable sans risque. Une etape deja commencee
-- ou terminee n'est jamais supprimee : seules les lignes "a faire" sont
-- retirees des sacs concernes.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'stage_phase_rank')
     or not exists (select 1 from pg_proc where proname = 'bands_allowed') then
    raise exception 'Lance d''abord les migrations 0026 et 0028.';
  end if;
end;
$$;

-- 1. Regle unique : cette etape fixe s'applique-t-elle a ce modele ?
create or replace function stage_applies(p_column text, p_name text, p_size text)
returns boolean language sql immutable as $$
  select case p_column
    when 'BANDS' then bands_allowed(p_name, p_size)
    when 'EMBROIDERY_SIDE' then lower(coalesce(p_name, '')) not like '%neverfull%'
    else true
  end;
$$;

-- 2. Nouveaux sacs : la checklist ne contient que les etapes qui s'appliquent.
create or replace function seed_bag_stage_progress()
returns trigger language plpgsql as $$
declare
  v_name text;
  v_size text;
begin
  select m.name, m.base_size into v_name, v_size
  from bag_models m where m.id = new.model_id;

  if v_name is null then
    v_name := new.model_label;
    v_size := new.size;
  end if;

  insert into bag_stage_progress (bag_id, stage_id, status)
  select new.id, s.id, 'a_faire'
  from production_stages s
  where s.is_active = true
    and (s.phase <> 'manufacturing' or s.catalog_column is null)
    and (new.sale_type = 'assemble' or s.phase in ('reception', 'disassembly'))
    and stage_applies(s.catalog_column, v_name, v_size);

  return new;
end;
$$;

-- 3. Sacs existants : on retire les etapes "a faire" qui ne s'appliquent pas
-- (ex : Broderie cote d'un Neverfull). Rien de commence ou termine n'est touche.
delete from bag_stage_progress bsp
using production_stages s, bags b
where s.id = bsp.stage_id
  and b.id = bsp.bag_id
  and bsp.status = 'a_faire'
  and s.catalog_column in ('BANDS', 'EMBROIDERY_SIDE')
  and not stage_applies(
    s.catalog_column,
    coalesce((select m.name from bag_models m where m.id = b.model_id), b.model_label),
    coalesce((select m.base_size from bag_models m where m.id = b.model_id), b.size)
  );

-- 4. Utilitaire de rattrapage (voir 0016 / 0028) aligne sur la meme regle. Le
-- modele pris en compte est celui du SKU, puis celui du sac, puis son libelle.
create or replace function assign_sku_to_bag_by_serial(p_serial text, p_sku text)
returns text language plpgsql as $$
declare
  v_bag_id uuid;
  v_phase stage_phase;
  v_name text;
  v_size text;
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
  select b.id, b.current_phase, coalesce(m.name, b.model_label), coalesce(m.base_size, b.size)
    into v_bag_id, v_phase, v_name, v_size
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

  if v_catalog.bag_model_id is not null then
    select m.name, m.base_size into v_name, v_size
    from bag_models m where m.id = v_catalog.bag_model_id;
  end if;

  update bags
    set sku = v_catalog.sku, sku_edition = v_catalog.edition, sale_type = 'assemble'
    where id = v_bag_id;

  v_steps := coalesce(v_catalog.steps, '{}'::jsonb);

  for v_stage in select * from production_stages where is_active = true loop
    select * into v_existing from bag_stage_progress
      where bag_id = v_bag_id and stage_id = v_stage.id;
    v_found := found;

    -- Etape fixe : appliquee a tous les sacs, sauf bandes / broderie cote selon le modele.
    if v_stage.phase <> 'manufacturing' or v_stage.catalog_column is null then
      if not stage_applies(v_stage.catalog_column, v_name, v_size) then
        if v_found and v_existing.status = 'a_faire' then
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
