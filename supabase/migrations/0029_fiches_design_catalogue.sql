-- ============================================================================
-- Catalogue : une fiche par design.
--
-- On ajoute deux colonnes a sku_catalog :
--   design      = le code sans "PK" ni taille (PKSBLK30 -> SBLK). C'est la cle
--                 de regroupement : PKSBLK30 a PKSBLK55 = une seule fiche.
--   color_code  = lettre(s) couleur quand elle est connue (codes crees depuis
--                 l'ecran "Nouveau design"). Pour les anciens codes elle reste
--                 vide : leur couleur fait partie du design (SBLK).
--
-- On rattache aussi les anciens codes a leur modele de sac quand c'est sans
-- ambiguite, pour que la fiche sache quels modeles existent deja. Les codes
-- ambigus restent sans modele (ils apparaissent a part dans la fiche).
-- Rien n'est renomme ni supprime. Rejouable sans risque. A lancer apres 0027.
-- ============================================================================

alter table sku_catalog add column if not exists design text;
alter table sku_catalog add column if not exists color_code text;

-- 1. Design des codes existants : code sans "PK" ni suffixe de taille
-- (25, 30, 35... ou PM, MM, GM).
update sku_catalog
set design = regexp_replace(
  case when sku like 'PK%' then substr(sku, 3) else sku end,
  '(\d+|PM|MM|GM)$',
  ''
)
where design is null;

-- Un code qui ne serait QUE une taille garde son code entier comme design.
update sku_catalog
set design = case when sku like 'PK%' then substr(sku, 3) else sku end
where design is null or design = '';

create index if not exists sku_catalog_design_idx on sku_catalog (design);

-- 2. Modele de sac des anciens codes (seulement quand bag_model_id est vide) :
--   45 / 50 / 55            -> Keepall de cette taille
--   PM / MM / GM            -> Neverfull de cette taille
--   25 / 30 / 35 / 40       -> Speedy de cette taille, sauf design en "H" sans
--                              taille Keepall (ancien marqueur Hermes) :
--                              Birkin 25 / 30 / 35 (la 40 n'existe pas -> vide)
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
