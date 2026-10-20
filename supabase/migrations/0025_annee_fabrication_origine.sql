-- Fabrication d'origine chez LV / Hermes : seule l'annee est connue/utile, et
-- le champ devient facultatif. On ajoute factory_year et on y reprend l'annee
-- des dates deja saisies ; l'ancienne colonne factory_date est conservee telle
-- quelle (non destructif) mais n'est plus alimentee par l'application.

alter table bags
  add column if not exists factory_year integer
    check (factory_year is null or factory_year between 1800 and 2100);

update bags
  set factory_year = extract(year from factory_date)::integer
  where factory_year is null and factory_date is not null;

-- La date n'est plus saisie : si la colonne etait declaree NOT NULL, on leve la
-- contrainte pour que la creation d'un sac sans cette information reste possible.
alter table bags
  alter column factory_date drop not null;
