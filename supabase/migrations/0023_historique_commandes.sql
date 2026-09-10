-- Historique de commande, sur le meme modele que le journal deja utilise
-- pour les sacs (activity_log.bag_id) : on ajoute juste order_id, nullable,
-- pour tracer les evenements cote commande (creation, rattachement de sac,
-- annulation, changement de statut de paiement) sur sa future page de detail.

alter table activity_log
  add column if not exists order_id uuid references orders(id) on delete cascade;
