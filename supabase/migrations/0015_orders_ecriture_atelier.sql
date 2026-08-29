-- Meme besoin que pour les clients (migration 0013) : l'atelier doit pouvoir
-- creer/modifier des commandes, pas seulement admin/commercial/comptabilite.
drop policy if exists "orders: ecriture admin/commercial/comptabilite" on orders;
create policy "orders: ecriture admin/commercial/comptabilite/atelier" on orders for all
  using (auth_role() in ('admin', 'commercial', 'comptabilite', 'atelier'))
  with check (auth_role() in ('admin', 'commercial', 'comptabilite', 'atelier'));
