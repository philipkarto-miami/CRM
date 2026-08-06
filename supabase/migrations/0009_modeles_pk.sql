-- ============================================================================
-- Philip Karto CRM - "modele PK" = un SKU precis, rattache a son modele
-- fournisseur exact (un SKU ne correspond toujours qu'a un seul modele/
-- taille cote fournisseur, ex PKPOP35 -> Louis Vuitton Speedy 35).
-- ============================================================================

alter table sku_catalog add column bag_model_id uuid references bag_models (id) on delete set null;

-- Quand une commande n'a pas encore de sac (statut "sac_a_commander"), on
-- memorise en plus du modele fournisseur souhaite (desired_model_id) le SKU
-- precis vise, pour pouvoir proposer plus tard exactement le bon sac.
alter table orders add column desired_sku text references sku_catalog (sku) on delete set null;
