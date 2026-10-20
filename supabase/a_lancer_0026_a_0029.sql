-- ===== 0026 - etapes de desassemblage, bandes, numero de serie =====
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

update production_stages
  set name = 'Ajout des bandes', order_index = 5
  where phase = 'disassembly' and catalog_column = 'BANDS';

insert into production_stages (phase, name, order_index, catalog_column, is_active)
select 'disassembly'::stage_phase, 'Ajout du numero de serie', 6, null, true
where not exists (
  select 1 from production_stages ps
  where ps.phase = 'disassembly' and ps.name = 'Ajout du numero de serie'
);

update production_stages
  set order_index = 7
  where phase = 'disassembly' and catalog_column = 'EMBROIDERY_SIDE';

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

delete from bag_stage_progress bsp
using production_stages ps, bags b
left join bag_models m on m.id = b.model_id
where ps.id = bsp.stage_id
  and ps.catalog_column = 'BANDS'
  and b.id = bsp.bag_id
  and bsp.status = 'a_faire'
  and not bands_allowed(coalesce(m.name, b.model_label), coalesce(m.base_size, b.size));

update sku_catalog
set steps = jsonb_set(
  jsonb_set(steps, '{BANDS}', steps -> 'EMBROIDERY_SIDE'),
  '{EMBROIDERY_SIDE}', steps -> 'BANDS'
)
where jsonb_typeof(steps -> 'BANDS') = 'number'
  and jsonb_typeof(steps -> 'EMBROIDERY_SIDE') = 'number'
  and (steps ->> 'EMBROIDERY_SIDE')::numeric < (steps ->> 'BANDS')::numeric;

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

-- ===== 0027 - Neverfull PM =====
do $$
begin
  if not exists (select 1 from bag_models where name = 'Neverfull' and base_size = 'PM') then
    update bag_models set sort_order = sort_order + 1 where sort_order >= 8 and sort_order < 999;

    insert into bag_models (brand_id, name, base_size, sort_order)
    select b.id, 'Neverfull', 'PM', 8
    from brands b
    where b.name = 'Louis Vuitton';
  end if;
end;
$$;

-- ===== 0028 - phases fixes hors fabrication =====
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

update bag_stage_progress bsp
set sequence_override = null, subcontract_note = null
from production_stages s
where s.id = bsp.stage_id
  and (s.phase <> 'manufacturing' or s.catalog_column is null)
  and (bsp.sequence_override is not null or bsp.subcontract_note is not null);

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

-- ===== 0029 - fiches par design =====
alter table sku_catalog add column if not exists design text;
alter table sku_catalog add column if not exists color_code text;

update sku_catalog
set design = regexp_replace(
  case when sku like 'PK%' then substr(sku, 3) else sku end,
  '(\d+|PM|MM|GM)$',
  ''
)
where design is null;

update sku_catalog
set design = case when sku like 'PK%' then substr(sku, 3) else sku end
where design is null or design = '';

create index if not exists sku_catalog_design_idx on sku_catalog (design);

with parsed as (
  select s.id, s.design, substring(s.sku from '(\d+|PM|MM|GM)$') as size_part
  from sku_catalog s
  where s.bag_model_id is null
),
fam as (
  select
    p.id,
    p.size_part,
    case
      when p.size_part in ('45', '50', '55') then 'Keepall'
      when p.size_part in ('PM', 'MM', 'GM') then 'Neverfull'
      when p.size_part in ('25', '30', '35', '40') then
        case
          when p.design ~ '^H'
            and not exists (
              select 1 from sku_catalog o
              where o.design = p.design
                and substring(o.sku from '(\d+|PM|MM|GM)$') in ('45', '50', '55')
            )
          then case when p.size_part in ('25', '30', '35') then 'Birkin' else null end
          else 'Speedy'
        end
      else null
    end as model_name
  from parsed p
)
update sku_catalog s
set bag_model_id = m.id
from fam f
join bag_models m on m.name = f.model_name and m.base_size = f.size_part
where s.id = f.id
  and f.model_name is not null
  and s.bag_model_id is null;
