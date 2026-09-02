-- Golf Round Tracker — database schema
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- GOLFERS  (the player roster — not necessarily the same as login accounts)
-- ─────────────────────────────────────────────────────────────
create table if not exists golfers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handicap numeric(4,1) not null check (handicap >= 0 and handicap <= 72),
  created_at timestamptz not null default now()
);

-- Case/whitespace-insensitive duplicate protection
create unique index if not exists golfers_name_unique
  on golfers (lower(trim(name)));

-- ─────────────────────────────────────────────────────────────
-- COURSES
-- ─────────────────────────────────────────────────────────────
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists courses_name_unique
  on courses (lower(trim(name)));

create table if not exists course_holes (
  course_id uuid not null references courses(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  par int not null check (par between 3 and 6),
  handicap_index int not null check (handicap_index between 1 and 18),
  primary key (course_id, hole_number),
  unique (course_id, handicap_index)
);

-- ─────────────────────────────────────────────────────────────
-- ROUNDS
-- ─────────────────────────────────────────────────────────────
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  format text not null check (format in ('4-2-0', 'matchplay')),
  course_id uuid not null references courses(id),
  hole_start int not null check (hole_start in (1, 10)),
  hole_end int not null check (hole_end in (9, 18)),
  handicap_allowance int not null check (handicap_allowance between 0 and 100),
  matchplay_cap int check (matchplay_cap between 1 and 18),
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Only one ACTIVE round at a time, across the whole shared workspace
create unique index if not exists only_one_active_round
  on rounds ((1))
  where status = 'active';

-- Golfers assigned to a round, with their handicap snapshotted at round start
create table if not exists round_players (
  round_id uuid not null references rounds(id) on delete cascade,
  golfer_id uuid not null references golfers(id),
  handicap_snapshot numeric(4,1) not null,
  player_order int not null,
  primary key (round_id, golfer_id)
);

-- Hole-by-hole gross scores
create table if not exists scores (
  round_id uuid not null references rounds(id) on delete cascade,
  golfer_id uuid not null references golfers(id),
  hole_number int not null check (hole_number between 1 and 18),
  gross_score int not null check (gross_score between 1 and 20),
  updated_at timestamptz not null default now(),
  primary key (round_id, golfer_id, hole_number)
);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- This app is a shared "workspace" for a friend group: anyone who can log in
-- can see and edit everything (golfers, courses, rounds, scores). There is no
-- per-user ownership of the golf data itself — only account access is gated.
-- ─────────────────────────────────────────────────────────────
alter table golfers enable row level security;
alter table courses enable row level security;
alter table course_holes enable row level security;
alter table rounds enable row level security;
alter table round_players enable row level security;
alter table scores enable row level security;

create policy "authenticated read/write golfers" on golfers
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write courses" on courses
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write course_holes" on course_holes
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write rounds" on rounds
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write round_players" on round_players
  for all to authenticated using (true) with check (true);

create policy "authenticated read/write scores" on scores
  for all to authenticated using (true) with check (true);
