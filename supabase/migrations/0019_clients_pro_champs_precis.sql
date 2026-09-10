-- Fiche client pro plus precise : nom du contact chez l'entreprise, et un
-- identifiant fiscal generique (tax_id / EIN aux USA) plutot qu'un SIRET/TVA
-- francais qui ne correspond pas au contexte de l'atelier (base aux USA).

alter table customers
  add column if not exists contact_name text,
  add column if not exists tax_id text;
