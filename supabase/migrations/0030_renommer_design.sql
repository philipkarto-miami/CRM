-- ============================================================================
-- Renommer l'acronyme d'un design = renommer tous ses codes PK.
--   PKSBLK30, PKSBLK35... (design SBLK)  ->  PKXYZ30, PKXYZ35... (design XYZ)
-- Les sacs (bags.sku) et les commandes (orders.desired_sku) qui utilisent ces
-- codes sont mis a jour dans la meme transaction. Les photos ne bougent pas.
-- Rejouable sans risque. A lancer apres 0029.
-- ============================================================================

-- 1. orders.desired_sku suit automatiquement un changement de code.
do $$
declare
  v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  where c.conrelid = 'orders'::regclass
    and c.confrelid = 'sku_catalog'::regclass
    and c.contype = 'f';

  if v_name is not null then
    execute format('alter table orders drop constraint %I', v_name);
  end if;

  alter table orders
    add constraint orders_desired_sku_fkey
    foreign key (desired_sku) references sku_catalog (sku)
    on delete set null on update cascade;
end;
$$;

-- 2. Renommage d'un design. Refuse si l'un des nouveaux codes existe deja.
create or replace function rename_sku_design(p_old text, p_new text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_new text;
  v_codes int;
  v_bags int;
  v_orders int;
  v_clash text;
begin
  if auth_role() is null or auth_role() not in ('admin', 'atelier') then
    raise exception 'Reserve aux administrateurs et a l''atelier.';
  end if;

  v_new := upper(regexp_replace(coalesce(p_new, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_new = '' then
    raise exception 'L''acronyme est vide.';
  end if;
  if v_new = p_old then
    return 'Aucun changement';
  end if;

  select count(*) into v_codes
  from sku_catalog
  where design = p_old and starts_with(sku, 'PK' || p_old);
  if v_codes = 0 then
    raise exception 'Design introuvable.';
  end if;

  select 'PK' || v_new || substr(c.sku, 3 + length(p_old)) into v_clash
  from sku_catalog c
  where c.design = p_old
    and starts_with(c.sku, 'PK' || p_old)
    and exists (
      select 1 from sku_catalog x
      where x.sku = 'PK' || v_new || substr(c.sku, 3 + length(p_old))
    )
  limit 1;
  if v_clash is not null then
    raise exception 'Le code % existe deja : choisis un autre acronyme.', v_clash;
  end if;

  select count(*) into v_bags
  from bags b
  where b.sku in (
    select sku from sku_catalog where design = p_old and starts_with(sku, 'PK' || p_old)
  );

  select count(*) into v_orders
  from orders o
  where o.desired_sku in (
    select sku from sku_catalog where design = p_old and starts_with(sku, 'PK' || p_old)
  );

  update bags
  set sku = 'PK' || v_new || substr(sku, 3 + length(p_old))
  where sku in (
    select sku from sku_catalog where design = p_old and starts_with(sku, 'PK' || p_old)
  );

  update sku_catalog
  set sku = 'PK' || v_new || substr(sku, 3 + length(p_old)),
      design = v_new
  where design = p_old and starts_with(sku, 'PK' || p_old);

  return format('%s codes renommes (%s sacs et %s commandes mis a jour)', v_codes, v_bags, v_orders);
end;
$$;

grant execute on function rename_sku_design(text, text) to authenticated;
