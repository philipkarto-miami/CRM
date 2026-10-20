-- ============================================================================
-- "Ajout des bandes" (Speedy 35/40, Keepall) et "Broderie cote" (tous sauf
-- Neverfull) doivent exister sur TOUS les sacs concernes, y compris ceux qui ont
-- deja depasse la phase de desassemblage (ex : un Speedy 35 deja a l'emballage
-- n'avait pas ses bandes). On ajoute l'etape manquante, "a faire", sur chaque
-- sac pas encore expedie. Le modele pris en compte est celui du SKU, puis du sac.
--
-- A lancer APRES 0031. Rejouable sans risque (on conflict do nothing). Le sac ne
-- change pas de phase : l'etape ajoutee apparait dans sa phase d'origine.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'stage_applies') then
    raise exception 'Lance d''abord la migration 0031 (etapes selon le modele).';
  end if;
end;
$$;

insert into bag_stage_progress (bag_id, stage_id, status)
select b.id, s.id, 'a_faire'::stage_status
from bags b
left join sku_catalog c on c.sku = b.sku
left join bag_models m on m.id = coalesce(c.bag_model_id, b.model_id)
cross join production_stages s
where s.is_active = true
  and s.catalog_column in ('BANDS', 'EMBROIDERY_SIDE')
  and stage_phase_rank(b.current_phase) < 6
  and stage_applies(s.catalog_column, coalesce(m.name, b.model_label), coalesce(m.base_size, b.size))
on conflict (bag_id, stage_id) do nothing;
