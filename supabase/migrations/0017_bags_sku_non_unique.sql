-- Un SKU designe un modele/recette de fabrication (catalogue), pas un
-- identifiant unique de piece : plusieurs sacs peuvent legitimement porter
-- le meme SKU (l'atelier produit plusieurs exemplaires du meme modele PK).
-- La fiche catalogue affiche deja "utilise par N sacs en cours", ce qui
-- suppose cette pluralite -- la contrainte unique posee au tout debut du
-- projet etait donc trop stricte. Le numero de serie (serial_number) reste
-- le seul identifiant unique par sac.
alter table bags drop constraint if exists bags_sku_key;
