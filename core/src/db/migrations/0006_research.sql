-- 0006_research.sql — research & review queue, lanes, coverage, op-event log. Identities TEXT.
-- `coverage.kind` becomes TEXT (the entity_kind enum was dropped in favour of entity.layer).
-- RLS enabled, no policy (internal): the store reads the serving tier only.

create table research_job (id text primary key, scope jsonb not null, lanes text[] not null,
  requested_by text references app_user(id), runner text not null, status text not null default 'queued',
  budget_usd numeric, spent_usd numeric default 0, created_at timestamptz not null default now(),
  finished_at timestamptz);

create table changeset (id text primary key, author_id text references app_user(id), client text not null,
  job_id text references research_job(id), purpose text,
  status text not null default 'open' check (status in ('open','submitted','accepted','partial','rejected')),
  reviewed_by text references app_user(id), created_at timestamptz not null default now(),
  reviewed_at timestamptz);

create table change (id text primary key, changeset_id text not null references changeset(id) on delete cascade,
  op text not null check (op in ('create','update','retire','merge')),
  target_kind text not null check (target_kind in ('entity','offer','relation','media','area','document_rule','pack_template')),
  target_id text, temp_ref text, base_version int, patch jsonb not null,
  decision text check (decision in ('accepted','rejected','edited')), reviewer_note text);

create table research_gap (id text primary key, job_id text references research_job(id),
  entity_id text references entity(id), temp_ref text, field text not null, reason text not null,
  tried jsonb, created_at timestamptz not null default now(), closed_by_change text, closed_at timestamptz);

create table lane (id text primary key, version int not null, contract jsonb not null, updated_on date not null);

create table trip_type (id text primary key, label text not null, lanes jsonb not null,
  default_filters jsonb not null default '{}', defaults jsonb not null default '{}',
  deal_breakers jsonb not null default '[]');

create table coverage (area_id text references area(id), kind text not null, n int not null,
  with_media numeric, fresh numeric, score text check (score in ('thin','usable','good')),
  computed_at timestamptz not null default now(), primary key (area_id, kind));

create table backlog (id text primary key, area_id text references area(id), entity_id text references entity(id),
  lane text, reason text not null, priority numeric not null, status text not null default 'open',
  requested_by text references app_user(id));

create table op_event (id bigserial primary key, at timestamptz not null default now(),
  actor_id text references app_user(id), client text not null, op text not null,
  trip_id text, entity_id text, client_op_id text, batch_id text,
  input jsonb, inverse jsonb, result_version int,
  unique (actor_id, client_op_id));
create index on op_event (trip_id, id);

alter table research_job enable row level security;
alter table changeset    enable row level security;
alter table change       enable row level security;
alter table research_gap enable row level security;
alter table lane         enable row level security;
alter table trip_type    enable row level security;
alter table coverage     enable row level security;
alter table backlog      enable row level security;
alter table op_event     enable row level security;
