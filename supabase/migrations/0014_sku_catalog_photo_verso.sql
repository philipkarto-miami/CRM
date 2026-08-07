-- Une fiche catalogue doit pouvoir presenter au moins deux photos (recto et
-- verso du sac). On garde photo_path comme "recto" et on ajoute une colonne
-- dediee pour le "verso", sans casser les fiches existantes (une seule
-- photo deja presente reste affichee comme recto).
alter table sku_catalog add column if not exists photo_path_back text;
