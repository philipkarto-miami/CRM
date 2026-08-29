-- Fonction utilitaire pour rattraper manuellement, en SQL, les sacs restes
-- bloques "sans SKU" a cause du bug corrige dans orders/actions.ts (une
-- commande qui choisissait directement un sac en stock ne lui attribuait
-- jamais le SKU). Reproduit exactement la logique de assignSku() cote
-- application (steps de fabrication + relance automatique de phase), pour
-- ne pas avoir a deviner/recopier le contenu du catalogue a la main.
--
-- Usage (dans le SQL Editor Supabase), un appel par sac a corriger :
--   select assign_sku_to_bag_by_serial('PK2608002', 'LE_SKU_VOULU');
--   select assign_sku_to_bag_by_serial('PK2608003', 'LE_SKU_VOULU');

create or replace function assign_sku_to_bag_by_serial(p_serial text, p_sku text)
returns text language plpgsql as $$
declare
  v_bag_id uuid;
  v_catalog record;
  v_steps jsonb;
  v_stage record;
  v_existing bag_stage_progress%rowtype;
  v_raw text;
  v_numeric numeric;
  v_sequence_override numeric;
  v_subcontract_note text;
begin
  select id into v_bag_id from bags where serial_number = p_serial;
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
