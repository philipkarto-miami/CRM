-- Autorise le role "atelier" (en plus de "admin") a creer/modifier des
-- etapes de fabrication (production_stages), car c'est l'atelier qui cree
-- de nouvelles etapes depuis l'editeur de catalogue.

drop policy if exists "production_stages: ecriture admin" on production_stages;

create policy "production_stages: ecriture admin/atelier" on production_stages for all
  using (auth_role() in ('admin', 'atelier')) with check (auth_role() in ('admin', 'atelier'));
