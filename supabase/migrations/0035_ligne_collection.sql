-- ============================================================================
-- Gamme 2027 (line sheet) : execution, edition commerciale, plafond de
-- production, Neverfull corriges, Birkin 40.
-- Rejouable sans risque : ne remplit que les valeurs encore vides.
--
--  1. sku_catalog.execution / commercial_edition / max_units
--       execution          : comment le sac est decore (peint, peint + brode,
--                            patch, artwork, collector Hermes, capsule)
--       commercial_edition : nom vu par l'acheteur (PK02 Signature...), a cote
--                            de l'edition d'atelier (PK.02) qui ne change pas
--       max_units          : plafond de production d'un code (capsules : 10)
--  2. Anciens codes Neverfull (PKNSQGM, PKNPGM...) : la fin "GM" etait lue comme
--     la taille alors que la taille est M (MM) et que le G est la couleur. On
--     corrige design / couleur / modele de ces codes.
--  3. Modele Birkin 40 (existait dans les codes, pas dans la liste des modeles).
--  4. Remplissage execution / edition commerciale / plafond depuis le line sheet.
-- ============================================================================

-- 1. Colonnes -----------------------------------------------------------------
alter table sku_catalog add column if not exists execution text;
alter table sku_catalog add column if not exists commercial_edition text;
alter table sku_catalog add column if not exists max_units integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sku_catalog_execution_check') then
    alter table sku_catalog add constraint sku_catalog_execution_check
      check (execution is null or execution in (
        'hand_painted', 'hand_painted_embroidered', 'patch_mixed_media',
        'artwork', 'collector_hermes', 'limited_edition'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sku_catalog_max_units_check') then
    alter table sku_catalog add constraint sku_catalog_max_units_check
      check (max_units is null or max_units > 0);
  end if;
end;
$$;

-- 2. Anciens codes Neverfull ---------------------------------------------------
-- PKN + design (SQ, STAR, P) + couleur (B G O P Y) + taille en une lettre
-- (P = PM, M = MM, G = GM) ; PKNSTR et PKNBLANK n'ont pas de couleur.
-- Design = N + lettres (NSQ, NSTAR, NP, NSTR, NBLANK). Le modele Neverfull est
-- toujours recale sur la taille lue dans le code (le rattachement automatique de
-- 0029 etait faux pour les codes finissant par GM / MM / PM).
with legacy as (
  select
    id,
    regexp_match(sku, '^PKN(?:(SQ|STAR|P)([BGOPY])|(STR|BLANK))([PMG])$') as m
  from sku_catalog
),
parsed as (
  select
    id,
    'N' || coalesce(m[1], m[3]) as new_design,
    m[2] as new_color,
    case m[4] when 'P' then 'PM' when 'M' then 'MM' else 'GM' end as new_size
  from legacy
  where m is not null
)
update sku_catalog s
set
  design = p.new_design,
  color_code = p.new_color,
  bag_model_id = coalesce(
    (select bm.id from bag_models bm where bm.name = 'Neverfull' and bm.base_size = p.new_size limit 1),
    s.bag_model_id
  )
from parsed p
where s.id = p.id;

-- 3. Birkin 40 ----------------------------------------------------------------
do $$
declare
  v_order int;
begin
  if not exists (select 1 from bag_models where name = 'Birkin' and base_size = '40') then
    select coalesce(max(sort_order), 0) + 1 into v_order
    from bag_models where name = 'Birkin' and sort_order < 999;

    update bag_models set sort_order = sort_order + 1 where sort_order >= v_order and sort_order < 999;

    insert into bag_models (brand_id, name, base_size, sort_order)
    select b.id, 'Birkin', '40', v_order
    from brands b
    where b.name = 'Hermes';
  end if;
end;
$$;

-- Les codes Birkin en 40 (PKH...40) prennent ce modele quand les autres tailles
-- du meme design sont deja des Birkin.
update sku_catalog s
set bag_model_id = m.id
from bag_models m
where m.name = 'Birkin' and m.base_size = '40'
  and s.bag_model_id is null
  and s.sku ~ '^PKH.*40$'
  and exists (
    select 1
    from sku_catalog o
    join bag_models bm on bm.id = o.bag_model_id
    where o.design = s.design and bm.name = 'Birkin'
  );

-- 4. Line sheet 2027 : code, execution, edition commerciale, plafond ------------
with ls (sku, execution, commercial_edition, max_units) as (
  values
  ('PKBLKD25', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKBLKD30', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKBLKD35', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKBLKD40', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKBLKD45', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKBLKD50', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKBLKD55', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKBUTTERBLK25', 'limited_edition', 'Capsule NFE', 10),
  ('PKBUTTERBLK30', 'limited_edition', 'Capsule NFE', 10),
  ('PKBUTTERBLK35', 'limited_edition', 'Capsule NFE', 10),
  ('PKBUTTERBLK40', 'limited_edition', 'Capsule NFE', 10),
  ('PKBUTTERBLK45', 'limited_edition', 'Capsule NFE', 10),
  ('PKBUTTERBLK50', 'limited_edition', 'Capsule NFE', 10),
  ('PKBUTTERBLK55', 'limited_edition', 'Capsule NFE', 10),
  ('PKDIAMSBE30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBE35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBE40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBE45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBE50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBE55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBLK30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBLK35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBLK40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBLK45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBLK50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSBLK55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSGR30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSGR35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSGR40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSGR45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSGR50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSGR55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSOR30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSOR35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSOR40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSOR45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSOR50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSOR55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSPK30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSPK35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSPK40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSPK45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSPK50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKDIAMSPK55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKEIN30', 'artwork', 'PK03 Artwork', null),
  ('PKEIN35', 'artwork', 'PK03 Artwork', null),
  ('PKEIN40', 'artwork', 'PK03 Artwork', null),
  ('PKEIN45', 'artwork', 'PK03 Artwork', null),
  ('PKEIN50', 'artwork', 'PK03 Artwork', null),
  ('PKEIN55', 'artwork', 'PK03 Artwork', null),
  ('PKHLOV30', 'collector_hermes', 'PK04 Collector', null),
  ('PKHLOV35', 'collector_hermes', 'PK04 Collector', null),
  ('PKHLOV40', 'collector_hermes', 'PK04 Collector', null),
  ('PKHPOP30', 'collector_hermes', 'PK04 Collector', null),
  ('PKHPOP35', 'collector_hermes', 'PK04 Collector', null),
  ('PKHPOP40', 'collector_hermes', 'PK04 Collector', null),
  ('PKHRKRL30', 'collector_hermes', 'PK04 Collector', null),
  ('PKHRKRL35', 'collector_hermes', 'PK04 Collector', null),
  ('PKHRKRL40', 'collector_hermes', 'PK04 Collector', null),
  ('PKHSTARW30', 'collector_hermes', 'PK04 Collector', null),
  ('PKHSTARW35', 'collector_hermes', 'PK04 Collector', null),
  ('PKHSTARW40', 'collector_hermes', 'PK04 Collector', null),
  ('PKHWNGBEST30', 'collector_hermes', 'PK04 Collector', null),
  ('PKHWNGBEST35', 'collector_hermes', 'PK04 Collector', null),
  ('PKHWNGBEST40', 'collector_hermes', 'PK04 Collector', null),
  ('PKKD25', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKKD30', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKKD35', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKKD40', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKKD45', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKKD50', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKKD55', 'hand_painted_embroidered', 'PK01 Essentials', null),
  ('PKLOVB25', 'artwork', 'PK03 Artwork', null),
  ('PKLOVB30', 'artwork', 'PK03 Artwork', null),
  ('PKLOVB35', 'artwork', 'PK03 Artwork', null),
  ('PKLOVB40', 'artwork', 'PK03 Artwork', null),
  ('PKLOVB45', 'artwork', 'PK03 Artwork', null),
  ('PKLOVB50', 'artwork', 'PK03 Artwork', null),
  ('PKLOVB55', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEBENFGM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEBENFMM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEBENFPM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEORNFGM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEORNFMM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEORNFPM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEPKNFGM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEPKNFMM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEPKNFPM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEYNFGM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEYNFMM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVEYNFPM', 'artwork', 'PK03 Artwork', null),
  ('PKLOVO25', 'artwork', 'PK03 Artwork', null),
  ('PKLOVO30', 'artwork', 'PK03 Artwork', null),
  ('PKLOVO35', 'artwork', 'PK03 Artwork', null),
  ('PKLOVO40', 'artwork', 'PK03 Artwork', null),
  ('PKLOVO45', 'artwork', 'PK03 Artwork', null),
  ('PKLOVO50', 'artwork', 'PK03 Artwork', null),
  ('PKLOVO55', 'artwork', 'PK03 Artwork', null),
  ('PKLOVP25', 'artwork', 'PK03 Artwork', null),
  ('PKLOVP30', 'artwork', 'PK03 Artwork', null),
  ('PKLOVP35', 'artwork', 'PK03 Artwork', null),
  ('PKLOVP40', 'artwork', 'PK03 Artwork', null),
  ('PKLOVP45', 'artwork', 'PK03 Artwork', null),
  ('PKLOVP50', 'artwork', 'PK03 Artwork', null),
  ('PKLOVP55', 'artwork', 'PK03 Artwork', null),
  ('PKLOVY25', 'artwork', 'PK03 Artwork', null),
  ('PKLOVY30', 'artwork', 'PK03 Artwork', null),
  ('PKLOVY35', 'artwork', 'PK03 Artwork', null),
  ('PKLOVY40', 'artwork', 'PK03 Artwork', null),
  ('PKLOVY45', 'artwork', 'PK03 Artwork', null),
  ('PKLOVY50', 'artwork', 'PK03 Artwork', null),
  ('PKLOVY55', 'artwork', 'PK03 Artwork', null),
  ('PKNFRAINGM', 'hand_painted', 'PK01 Essentials', null),
  ('PKNFRAINMM', 'hand_painted', 'PK01 Essentials', null),
  ('PKNFRAINPM', 'hand_painted', 'PK01 Essentials', null),
  ('PKNFRAINWGM', 'hand_painted', 'PK01 Essentials', null),
  ('PKNFRAINWMM', 'hand_painted', 'PK01 Essentials', null),
  ('PKNFRAINWPM', 'hand_painted', 'PK01 Essentials', null),
  ('PKNPBG', 'hand_painted', 'PK02 Signature', null),
  ('PKNPBM', 'hand_painted', 'PK02 Signature', null),
  ('PKNPBP', 'hand_painted', 'PK02 Signature', null),
  ('PKNPGG', 'hand_painted', 'PK02 Signature', null),
  ('PKNPGM', 'hand_painted', 'PK02 Signature', null),
  ('PKNPGP', 'hand_painted', 'PK02 Signature', null),
  ('PKNPOG', 'hand_painted', 'PK02 Signature', null),
  ('PKNPOM', 'hand_painted', 'PK02 Signature', null),
  ('PKNPOP', 'hand_painted', 'PK02 Signature', null),
  ('PKNPPG', 'hand_painted', 'PK02 Signature', null),
  ('PKNPPM', 'hand_painted', 'PK02 Signature', null),
  ('PKNPPP', 'hand_painted', 'PK02 Signature', null),
  ('PKNPYG', 'hand_painted', 'PK02 Signature', null),
  ('PKNPYM', 'hand_painted', 'PK02 Signature', null),
  ('PKNPYP', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQBG', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQBM', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQBP', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQGG', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQGM', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQGP', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQOG', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQOM', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQOP', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQYG', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQYM', 'hand_painted', 'PK02 Signature', null),
  ('PKNSQYP', 'hand_painted', 'PK02 Signature', null),
  ('PKPEB25', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEB30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEB35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEB40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEB45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEB50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEB55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEG25', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEG30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEG35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEG40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEG45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEG50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEG55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEO25', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEO30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEO35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEO40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEO45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEO50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEO55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEP25', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEP30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEP35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEP40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEP45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEP50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEP55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEY25', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEY30', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEY35', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEY40', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEY45', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEY50', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPEY55', 'hand_painted_embroidered', 'PK02 Signature', null),
  ('PKPOP30', 'artwork', 'PK03 Artwork', null),
  ('PKPOP35', 'artwork', 'PK03 Artwork', null),
  ('PKPOP40', 'artwork', 'PK03 Artwork', null),
  ('PKPOP45', 'artwork', 'PK03 Artwork', null),
  ('PKPOP50', 'artwork', 'PK03 Artwork', null),
  ('PKPOP55', 'artwork', 'PK03 Artwork', null),
  ('PKRAIN25', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAIN30', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAIN35', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAIN40', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAIN45', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAIN50', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAIN55', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAINW25', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAINW30', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAINW35', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAINW40', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAINW45', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAINW50', 'hand_painted', 'PK01 Essentials', null),
  ('PKRAINW55', 'hand_painted', 'PK01 Essentials', null),
  ('PKROSEBLK25', 'limited_edition', 'Capsule NFE', 10),
  ('PKROSEBLK30', 'limited_edition', 'Capsule NFE', 10),
  ('PKROSEBLK35', 'limited_edition', 'Capsule NFE', 10),
  ('PKROSEBLK40', 'limited_edition', 'Capsule NFE', 10),
  ('PKROSEBLK45', 'limited_edition', 'Capsule NFE', 10),
  ('PKROSEBLK50', 'limited_edition', 'Capsule NFE', 10),
  ('PKROSEBLK55', 'limited_edition', 'Capsule NFE', 10),
  ('PKSBLK25', 'hand_painted', 'PK01 Essentials', null),
  ('PKSBLK30', 'hand_painted', 'PK01 Essentials', null),
  ('PKSBLK35', 'hand_painted', 'PK01 Essentials', null),
  ('PKSBLK40', 'hand_painted', 'PK01 Essentials', null),
  ('PKSBLK45', 'hand_painted', 'PK01 Essentials', null),
  ('PKSBLK50', 'hand_painted', 'PK01 Essentials', null),
  ('PKSBLK55', 'hand_painted', 'PK01 Essentials', null),
  ('PKSNAKEBLK25', 'limited_edition', 'Capsule NFE', 10),
  ('PKSNAKEBLK30', 'limited_edition', 'Capsule NFE', 10),
  ('PKSNAKEBLK35', 'limited_edition', 'Capsule NFE', 10),
  ('PKSNAKEBLK40', 'limited_edition', 'Capsule NFE', 10),
  ('PKSNAKEBLK45', 'limited_edition', 'Capsule NFE', 10),
  ('PKSNAKEBLK50', 'limited_edition', 'Capsule NFE', 10),
  ('PKSNAKEBLK55', 'limited_edition', 'Capsule NFE', 10),
  ('PKSQC30', 'hand_painted', 'PK02 Signature', null),
  ('PKSQC35', 'hand_painted', 'PK02 Signature', null),
  ('PKSQC40', 'hand_painted', 'PK02 Signature', null),
  ('PKSQC45', 'hand_painted', 'PK02 Signature', null),
  ('PKSQC50', 'hand_painted', 'PK02 Signature', null),
  ('PKSQC55', 'hand_painted', 'PK02 Signature', null),
  ('PKSQG30', 'hand_painted', 'PK02 Signature', null),
  ('PKSQG35', 'hand_painted', 'PK02 Signature', null),
  ('PKSQG40', 'hand_painted', 'PK02 Signature', null),
  ('PKSQG45', 'hand_painted', 'PK02 Signature', null),
  ('PKSQG50', 'hand_painted', 'PK02 Signature', null),
  ('PKSQG55', 'hand_painted', 'PK02 Signature', null),
  ('PKSQO30', 'hand_painted', 'PK02 Signature', null),
  ('PKSQO35', 'hand_painted', 'PK02 Signature', null),
  ('PKSQO40', 'hand_painted', 'PK02 Signature', null),
  ('PKSQO45', 'hand_painted', 'PK02 Signature', null),
  ('PKSQO50', 'hand_painted', 'PK02 Signature', null),
  ('PKSQO55', 'hand_painted', 'PK02 Signature', null),
  ('PKSQP30', 'hand_painted', 'PK02 Signature', null),
  ('PKSQP35', 'hand_painted', 'PK02 Signature', null),
  ('PKSQP40', 'hand_painted', 'PK02 Signature', null),
  ('PKSQP45', 'hand_painted', 'PK02 Signature', null),
  ('PKSQP50', 'hand_painted', 'PK02 Signature', null),
  ('PKSQP55', 'hand_painted', 'PK02 Signature', null),
  ('PKSQPG', 'hand_painted', 'PK02 Signature', null),
  ('PKSQPGRAY30', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPGRAY35', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPGRAY40', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPGRAY45', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPGRAY50', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPGRAY55', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPM', 'hand_painted', 'PK02 Signature', null),
  ('PKSQPO30', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPO35', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPO40', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPO45', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPO50', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPO55', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPOLV30', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPOLV35', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPOLV40', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPOLV45', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPOLV50', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPOLV55', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPP', 'hand_painted', 'PK02 Signature', null),
  ('PKSQPY30', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPY35', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPY40', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPY45', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPY50', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQPY55', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKSQY30', 'hand_painted', 'PK02 Signature', null),
  ('PKSQY35', 'hand_painted', 'PK02 Signature', null),
  ('PKSQY40', 'hand_painted', 'PK02 Signature', null),
  ('PKSQY45', 'hand_painted', 'PK02 Signature', null),
  ('PKSQY50', 'hand_painted', 'PK02 Signature', null),
  ('PKSQY55', 'hand_painted', 'PK02 Signature', null),
  ('PKTRIBUTE30', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKTRIBUTE35', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKTRIBUTE40', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKTRIBUTE45', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKTRIBUTE50', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKTRIBUTE55', 'patch_mixed_media', 'PK02 Signature', null),
  ('PKWORLDLOVEBE30', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBE35', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBE40', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBE45', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBE50', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBE55', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBLK30', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBLK35', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBLK40', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBLK45', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBLK50', 'artwork', 'PK03 Artwork', null),
  ('PKWORLDLOVEBLK55', 'artwork', 'PK03 Artwork', null)
)
update sku_catalog s
set
  execution = coalesce(s.execution, ls.execution),
  commercial_edition = coalesce(s.commercial_edition, ls.commercial_edition),
  max_units = coalesce(s.max_units, ls.max_units)
from ls
where s.sku = ls.sku;

notify pgrst, 'reload schema';
