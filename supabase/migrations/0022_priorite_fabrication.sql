-- Priorite de fabrication : par defaut, l'ordre des sacs dans chaque colonne
-- du kanban de production suit la date d'expedition prevue (la plus proche
-- ou la plus depassee en premier). Cocher "commande prioritaire" permet de
-- faire passer un sac devant les autres independamment de sa date.
-- is_priority est saisi sur la commande puis recopie sur le sac rattache
-- (meme mecanisme que expected_shipping_date -> bags.delivery_date).

alter table orders
  add column if not exists is_priority boolean not null default false;

alter table bags
  add column if not exists is_priority boolean not null default false;
