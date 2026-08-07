-- Le nouveau tableau de bord (file "A traiter en priorite") affiche depuis
-- combien de jours une etape est bloquee : il faut memoriser la date a
-- laquelle le statut est passe a "bloque".

alter table bag_stage_progress add column blocked_at timestamptz;
