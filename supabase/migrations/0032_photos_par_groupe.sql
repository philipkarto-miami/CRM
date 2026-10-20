-- ============================================================================
-- Photos par groupe de modeles x couleur (fiche design).
-- Jusqu'ici une paire recto/verso etait partagee par toute une couleur. Elle
-- devient propre a un groupe (Speedy 25-30, Speedy 35-40, Keepall, Neverfull,
-- Birkin) dans chaque couleur. Pour ne perdre aucune photo, on commence par
-- recopier, dans chaque design + couleur, la photo existante sur les codes qui
-- n'en ont pas ; tu remplaces ensuite groupe par groupe dans la fiche.
-- Aucun changement de structure. Rejouable sans risque : ne touche que les
-- codes SANS photo.
-- ============================================================================

with source as (
  select distinct on (design, coalesce(color_code, ''))
    design,
    coalesce(color_code, '') as color_key,
    photo_path
  from sku_catalog
  where design is not null and photo_path is not null
  order by design, coalesce(color_code, ''), updated_at desc nulls last, sku
)
update sku_catalog s
set photo_path = src.photo_path
from source src
where s.design = src.design
  and coalesce(s.color_code, '') = src.color_key
  and s.photo_path is null;

with source as (
  select distinct on (design, coalesce(color_code, ''))
    design,
    coalesce(color_code, '') as color_key,
    photo_path_back
  from sku_catalog
  where design is not null and photo_path_back is not null
  order by design, coalesce(color_code, ''), updated_at desc nulls last, sku
)
update sku_catalog s
set photo_path_back = src.photo_path_back
from source src
where s.design = src.design
  and coalesce(s.color_code, '') = src.color_key
  and s.photo_path_back is null;
