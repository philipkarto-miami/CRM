-- La "date de livraison" saisie a la creation d'un sac en stock est en realite
-- la date de RECEPTION du sac a l'atelier (fait passe ou present), pas une
-- echeance. bags.delivery_date est desormais reservee a la date d'expedition
-- prevue recopiee depuis la commande (elle pilote les alertes de retard) ;
-- la date de reception a donc sa propre colonne, pour qu'un sac recu hier
-- ne soit pas affiche "en retard".
--
-- Les sacs existants gardent leur delivery_date telle quelle (copie
-- non destructive vers received_date).

alter table bags
  add column if not exists received_date date;

update bags
  set received_date = delivery_date
  where received_date is null and delivery_date is not null;
