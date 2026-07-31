-- ============================================================================
-- Ordre d'affichage personnalise pour le menu deroulant des modeles :
-- Speedy (tailles croissantes) puis Keepall puis Neverfull (MM puis GM) puis
-- Birkin (tailles croissantes), au lieu de l'ordre alphabetique par defaut.
-- ============================================================================

alter table bag_models add column if not exists sort_order int not null default 999;

update bag_models set sort_order = 1 where name = 'Speedy' and base_size = '25';
update bag_models set sort_order = 2 where name = 'Speedy' and base_size = '30';
update bag_models set sort_order = 3 where name = 'Speedy' and base_size = '35';
update bag_models set sort_order = 4 where name = 'Speedy' and base_size = '40';
update bag_models set sort_order = 5 where name = 'Keepall' and base_size = '45';
update bag_models set sort_order = 6 where name = 'Keepall' and base_size = '50';
update bag_models set sort_order = 7 where name = 'Keepall' and base_size = '55';
update bag_models set sort_order = 8 where name = 'Neverfull' and base_size = 'MM';
update bag_models set sort_order = 9 where name = 'Neverfull' and base_size = 'GM';
update bag_models set sort_order = 10 where name = 'Birkin' and base_size = '25';
update bag_models set sort_order = 11 where name = 'Birkin' and base_size = '30';
update bag_models set sort_order = 12 where name = 'Birkin' and base_size = '35';


