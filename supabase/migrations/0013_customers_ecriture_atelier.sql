-- L'atelier doit pouvoir enregistrer un nouveau client (ex: en recevant un
-- sac pour un client pas encore dans le carnet), pas seulement admin et
-- commercial.

drop policy if exists "customers: ecriture admin/commercial" on customers;

create policy "customers: ecriture admin/commercial/atelier" on customers for all
  using (auth_role() in ('admin', 'commercial', 'atelier'))
  with check (auth_role() in ('admin', 'commercial', 'atelier'));
