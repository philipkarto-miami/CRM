-- ============================================================================
-- Philip Karto CRM - catalogue SKU et etapes de fabrication pilotees par SKU
-- ============================================================================
--
-- Contexte metier (analyse du fichier "TEMPLATE ORDER.xlsx" fourni par Philip
-- Karto) :
--
-- Le fichier maitre de l'atelier ("V2 SKU.xlsx") associe a chaque SKU (le
-- code de transformation choisi pour un sac : edition, decor...) une valeur
-- pour chacune des etapes de fabrication possibles :
--   - un nombre  = l'etape est necessaire pour ce SKU, et ce nombre indique
--                  sa position dans l'ordre de fabrication de CE SKU precis
--                  (l'ordre peut varier d'un SKU a l'autre, ce n'est pas un
--                  ordre fixe)
--   - vide       = l'etape est a ignorer completement pour ce SKU
--   - texte      = cas particulier de la sous-traitance : par ex "3 & 6"
--                  signifie que cette operation sous-traitee couvre/remplace
--                  les etapes 3 et 6
--
-- Toutes les etapes ne dependent pas du SKU : reception generale, controle
-- qualite, emballage, expedition, comptabilite... s'appliquent a tous les
-- sacs quel que soit le SKU. Seules 13 des 26 etapes de production_stages
-- sont pilotees par le SKU (colonnes AS a BE du fichier maitre) ; on les
-- relie ici via `catalog_column`.
--
-- ----------------------------------------------------------------------------
-- sku_catalog : catalogue des SKU (importe depuis le fichier maitre existant,
-- puis maintenu par l'atelier au fil des nouvelles editions)
-- ----------------------------------------------------------------------------
create table sku_catalog (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  edition text,
  -- steps: { "RECEPTION": 1, "EMBROIDERY": null (absent = non applicable),
  --          "SUBCONTRACT_1": "3 & 6", ... }
  steps jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sku_catalog_set_updated_at
  before update on sku_catalog
  for each row execute procedure set_updated_at();

alter table sku_catalog enable row level security;

create policy "sku_catalog: lecture" on sku_catalog for select using (auth.uid() is not null);
create policy "sku_catalog: ecriture admin+atelier" on sku_catalog for all
  using (auth_role() in ('admin', 'atelier'))
  with check (auth_role() in ('admin', 'atelier'));

-- ----------------------------------------------------------------------------
-- production_stages.catalog_column : relie une etape a sa colonne du
-- catalogue SKU (null = etape toujours applicable, independante du SKU)
-- ----------------------------------------------------------------------------
alter table production_stages add column catalog_column text;

update production_stages set catalog_column = 'RECEPTION'
  where phase = 'reception' and name = 'Reception du sac';

update production_stages set catalog_column = 'DISASSEMBLING'
  where phase = 'disassembly' and name = 'Desassemblage - nettoyage - repassage - pose fermeture eclair';
update production_stages set catalog_column = 'EMBROIDERY_SIDE'
  where phase = 'disassembly' and name = 'Broderie cote (embroidery side)';
update production_stages set catalog_column = 'BANDS'
  where phase = 'disassembly' and name = 'Pose des bandes';

update production_stages set catalog_column = 'EMBROIDERY'
  where phase = 'manufacturing' and name = 'Broderie';
update production_stages set catalog_column = 'HANDLES'
  where phase = 'manufacturing' and name = 'Pose des anses';
update production_stages set catalog_column = 'LINING'
  where phase = 'manufacturing' and name = 'Doublure';
update production_stages set catalog_column = 'CLOSING'
  where phase = 'manufacturing' and name = 'Fermeture';
update production_stages set catalog_column = 'PAINTING'
  where phase = 'manufacturing' and name = 'Peinture';
update production_stages set catalog_column = 'SHOULDER_STRAP'
  where phase = 'manufacturing' and name = 'Bandouliere';
update production_stages set catalog_column = 'PATCH'
  where phase = 'manufacturing' and name = 'Patch';
update production_stages set catalog_column = 'SUBCONTRACT_1'
  where phase = 'manufacturing' and name = 'Sous-traitance (1)';
update production_stages set catalog_column = 'SUBCONTRACT_2'
  where phase = 'manufacturing' and name = 'Sous-traitance (2)';

-- 'Demarrage fabrication' (manufacturing #1) et toutes les etapes de
-- controle qualite / emballage / expedition / comptabilite restent a
-- catalog_column = null : elles s'appliquent toujours, quel que soit le SKU.

-- ----------------------------------------------------------------------------
-- bags.sku_edition : information de contexte lue depuis le catalogue au
-- moment de l'attribution (pratique pour l'affichage, sans jointure)
-- ----------------------------------------------------------------------------
alter table bags add column sku_edition text;

-- ----------------------------------------------------------------------------
-- bag_stage_progress.sequence_override : position de l'etape specifique au
-- SKU de ce sac (remplace production_stages.order_index pour le tri quand
-- elle est renseignee). subcontract_note : precision textuelle quand la
-- valeur du catalogue n'est pas un nombre (ex "Sous-traite : 3 & 6").
-- ----------------------------------------------------------------------------
alter table bag_stage_progress add column sequence_override int;
alter table bag_stage_progress add column subcontract_note text;
