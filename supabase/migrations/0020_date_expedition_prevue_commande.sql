-- La date d'expedition prevue est desormais saisie sur la commande (au lieu
-- d'une "date de livraison" saisie a la main sur la fiche du sac) : elle est
-- ensuite recopiee automatiquement dans bags.delivery_date des qu'un sac est
-- rattache, pour continuer a piloter les calculs de retard existants
-- (tableau de bord, page Fabrication, liste des sacs) sans les modifier.

alter table orders
  add column if not exists expected_shipping_date date;
