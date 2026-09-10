-- Adresse structuree (generique, valable pour n'importe quel pays) sur la
-- fiche client pro, a la place d'un unique champ texte libre : ligne(s)
-- d'adresse, ville, region/etat/province (texte libre, pas de liste figee
-- par pays), code postal, pays. L'ancienne colonne "address" (texte libre)
-- est conservee telle quelle pour ne pas perdre l'existant, mais n'est plus
-- alimentee par le formulaire.

alter table customers
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists postal_code text,
  add column if not exists country text;
