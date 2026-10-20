-- ============================================================================
-- Neverfull PM : la taille manquait dans la liste des modeles (seuls MM et GM
-- existaient). Ordre : Neverfull PM, MM, GM, puis Birkin. Rejouable sans risque.
-- ============================================================================
do $$
begin
  if not exists (select 1 from bag_models where name = 'Neverfull' and base_size = 'PM') then
    -- Libere la place 8 pour PM en decalant Neverfull MM/GM et les Birkin.
    update bag_models set sort_order = sort_order + 1 where sort_order >= 8 and sort_order < 999;

    insert into bag_models (brand_id, name, base_size, sort_order)
    select b.id, 'Neverfull', 'PM', 8
    from brands b
    where b.name = 'Louis Vuitton';
  end if;
end;
$$;
