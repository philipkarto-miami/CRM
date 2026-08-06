-- ============================================================================
-- Philip Karto CRM - progression automatique des phases du sac
-- ============================================================================
--
-- Jusqu'ici "Phase actuelle" etait modifiee a la main sur la fiche du sac.
-- Desormais le sac avance seul dans le pipeline des qu'une phase est
-- entierement cochee :
--   reception -> disassembly -> (manufacturing si un SKU est deja attribue,
--   sinon stock_propre, en attente) -> manufacturing (des qu'un SKU arrive)
--   -> quality_control -> wrapping -> shipping -> accounting.
-- ----------------------------------------------------------------------------

alter type stage_phase add value if not exists 'stock_propre';

-- Un sac recu part directement en desassemblage (la reception elle-meme est
-- l'acte de creer la fiche), pas dans une phase d'attente separee.
alter table bags alter column current_phase set default 'disassembly';

create or replace function advance_bag_phase(p_bag_id uuid)
returns void language plpgsql as $$
declare
  v_current stage_phase;
  v_sku text;
  v_total int;
  v_done int;
  v_next text;
begin
  select current_phase, sku into v_current, v_sku from bags where id = p_bag_id;
  if v_current is null then
    return;
  end if;

  -- Stock "propre" = en attente d'un SKU. Des qu'il en recoit un (a
  -- n'importe quel moment), on repart directement en fabrication.
  if v_current = 'stock_propre' then
    if v_sku is not null then
      update bags set current_phase = 'manufacturing' where id = p_bag_id;
    end if;
    return;
  end if;

  select count(*), count(*) filter (where bsp.status = 'termine')
    into v_total, v_done
  from bag_stage_progress bsp
  join production_stages ps on ps.id = bsp.stage_id
  where bsp.bag_id = p_bag_id and ps.phase = v_current;

  -- Rien a cocher dans cette phase pour ce sac, ou toutes les etapes ne sont
  -- pas encore terminees : on ne change rien.
  if v_total = 0 or v_done < v_total then
    return;
  end if;

  v_next := case v_current
    when 'reception' then 'disassembly'
    when 'disassembly' then case when v_sku is not null then 'manufacturing' else 'stock_propre' end
    when 'manufacturing' then 'quality_control'
    when 'quality_control' then 'wrapping'
    when 'wrapping' then 'shipping'
    when 'shipping' then 'accounting'
    else null
  end;

  if v_next is not null then
    update bags set current_phase = v_next::stage_phase where id = p_bag_id;
  end if;
end;
$$;

grant execute on function advance_bag_phase(uuid) to authenticated;

create or replace function trigger_advance_bag_phase()
returns trigger language plpgsql as $$
begin
  perform advance_bag_phase(coalesce(new.bag_id, old.bag_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists bag_stage_progress_advance_phase on bag_stage_progress;
create trigger bag_stage_progress_advance_phase
  after insert or update or delete on bag_stage_progress
  for each row execute procedure trigger_advance_bag_phase();
