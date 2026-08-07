-- advance_bag_phase ne faisait avancer le sac que d'une seule phase par
-- appel. Si plusieurs phases etaient deja completes (rattrapage historique,
-- ou plusieurs cases cochees d'un coup), il fallait rappeler la fonction
-- plusieurs fois pour que le sac arrive a la bonne etape. On boucle
-- desormais en interne jusqu'a ce qu'il n'y ait plus rien a avancer.

create or replace function advance_bag_phase(p_bag_id uuid)
returns void language plpgsql as $$
declare
  v_current stage_phase;
  v_sku text;
  v_total int;
  v_done int;
  v_next text;
begin
  loop
    select current_phase, sku into v_current, v_sku from bags where id = p_bag_id;
    if v_current is null then
      return;
    end if;

    if v_current = 'stock_propre' then
      if v_sku is not null then
        update bags set current_phase = 'manufacturing' where id = p_bag_id;
        continue;
      end if;
      return;
    end if;

    select count(*), count(*) filter (where bsp.status = 'termine')
      into v_total, v_done
    from bag_stage_progress bsp
    join production_stages ps on ps.id = bsp.stage_id
    where bsp.bag_id = p_bag_id and ps.phase = v_current;

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

    if v_next is null then
      return;
    end if;

    update bags set current_phase = v_next::stage_phase where id = p_bag_id;
  end loop;
end;
$$;
