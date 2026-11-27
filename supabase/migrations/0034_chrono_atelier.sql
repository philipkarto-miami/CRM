-- Mode atelier (tablette) : chrono par etape de fabrication d'un sac.
--
-- - production_stages.target_minutes : objectif de temps de l'etape (facultatif,
--   reglable dans Parametres > Etapes de fabrication).
-- - stage_runs : un chrono par (sac, etape). Les temps sont derives d'horodatages
--   serveur (demarrage, pauses cumulees), jamais d'un compteur tenu par la
--   tablette : un reload ou une mise en veille ne fait rien perdre.
-- - stage_time_events : journal des actions (demarrer, pause, reprise, fin,
--   reouverture) avec la raison de pause.
-- - Trigger : si une etape est cochee "terminee" depuis la fiche du sac (CRM) alors
--   que son chrono tourne, le chrono est cloture automatiquement.
--
-- A lancer dans l'editeur SQL de Supabase (peut etre relance sans risque).

do $$
begin
  if to_regclass('public.bag_stage_progress') is null or to_regclass('public.production_stages') is null then
    raise exception 'Tables bag_stage_progress / production_stages introuvables : lance d''abord les migrations precedentes.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Objectif de temps par etape
-- ---------------------------------------------------------------------------
alter table production_stages
  add column if not exists target_minutes int check (target_minutes is null or target_minutes > 0);

-- ---------------------------------------------------------------------------
-- Chronos
-- ---------------------------------------------------------------------------
create table if not exists stage_runs (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references bags (id) on delete cascade,
  stage_id uuid not null references production_stages (id) on delete cascade,
  status text not null check (status in ('running', 'paused', 'done')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  paused_at timestamptz,
  pause_reason text,
  pause_count int not null default 0,
  paused_seconds int not null default 0,
  -- Fige a la fin de l'etape (temps actif = hors pauses).
  active_seconds int,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bag_id, stage_id)
);

create index if not exists stage_runs_bag_idx on stage_runs (bag_id);
create index if not exists stage_runs_open_idx on stage_runs (status) where status <> 'done';

create table if not exists stage_time_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references stage_runs (id) on delete cascade,
  bag_id uuid not null references bags (id) on delete cascade,
  stage_id uuid not null references production_stages (id) on delete cascade,
  type text not null check (type in ('start', 'pause', 'resume', 'finish', 'reopen')),
  pause_reason text,
  actor uuid references profiles (id) on delete set null,
  at timestamptz not null default now()
);

create index if not exists stage_time_events_run_idx on stage_time_events (run_id, at);
create index if not exists stage_time_events_stage_idx on stage_time_events (bag_id, stage_id, at desc);

drop trigger if exists stage_runs_set_updated_at on stage_runs;
create trigger stage_runs_set_updated_at
  before update on stage_runs
  for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : lecture pour tous les authentifies, ecriture admin + atelier
-- ---------------------------------------------------------------------------
alter table stage_runs enable row level security;
alter table stage_time_events enable row level security;

drop policy if exists "stage_runs: lecture" on stage_runs;
create policy "stage_runs: lecture" on stage_runs
  for select using (auth.uid() is not null);

drop policy if exists "stage_runs: ecriture admin/atelier" on stage_runs;
create policy "stage_runs: ecriture admin/atelier" on stage_runs
  for all
  using (auth_role() in ('admin', 'atelier'))
  with check (auth_role() in ('admin', 'atelier'));

drop policy if exists "stage_time_events: lecture" on stage_time_events;
create policy "stage_time_events: lecture" on stage_time_events
  for select using (auth.uid() is not null);

drop policy if exists "stage_time_events: ecriture admin/atelier" on stage_time_events;
create policy "stage_time_events: ecriture admin/atelier" on stage_time_events
  for all
  using (auth_role() in ('admin', 'atelier'))
  with check (auth_role() in ('admin', 'atelier'));

-- ---------------------------------------------------------------------------
-- Etape cochee "terminee" depuis le CRM : on cloture le chrono qui tourne.
-- (Depuis la tablette, le chrono est deja cloture quand ce trigger se declenche :
-- il ne fait alors rien.)
-- ---------------------------------------------------------------------------
create or replace function close_stage_run_on_done()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r stage_runs%rowtype;
  v_now timestamptz := now();
  v_open int;
  v_paused int;
begin
  if new.status <> 'termine' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'termine' then
    return new;
  end if;

  select * into r
  from stage_runs
  where bag_id = new.bag_id and stage_id = new.stage_id and status in ('running', 'paused')
  for update;

  if not found then
    return new;
  end if;

  v_open := case
    when r.paused_at is not null then greatest(0, floor(extract(epoch from (v_now - r.paused_at)))::int)
    else 0
  end;
  v_paused := r.paused_seconds + v_open;

  update stage_runs
  set status = 'done',
      finished_at = v_now,
      paused_at = null,
      pause_reason = null,
      paused_seconds = v_paused,
      active_seconds = greatest(0, floor(extract(epoch from (v_now - r.started_at)))::int - v_paused)
  where id = r.id;

  insert into stage_time_events (run_id, bag_id, stage_id, type, actor, at)
  values (r.id, r.bag_id, r.stage_id, 'finish', auth.uid(), v_now);

  return new;
end;
$$;

drop trigger if exists bag_stage_progress_close_run on bag_stage_progress;
create trigger bag_stage_progress_close_run
  after insert or update of status on bag_stage_progress
  for each row execute procedure close_stage_run_on_done();

notify pgrst, 'reload schema';
