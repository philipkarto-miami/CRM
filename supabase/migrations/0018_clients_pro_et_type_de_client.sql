-- Le carnet "customers" ne sert plus qu'aux clients professionnels (revendeurs,
-- boutiques...) : chacun a des conditions de paiement propres qui pilotent la
-- regle d'expedition. Les clients particuliers ne sont plus geres dans une
-- table a part : leur nom/reference est saisi librement au moment de la
-- commande (colonnes individual_customer_name / customer_type sur orders).

alter table customers
  add column if not exists payment_terms text not null default 'total'
    check (payment_terms in ('total', 'partiel', 'consignement')),
  add column if not exists payment_terms_percent integer;

alter table orders
  add column if not exists customer_type text not null default 'professionnel'
    check (customer_type in ('particulier', 'professionnel')),
  add column if not exists individual_customer_name text;
