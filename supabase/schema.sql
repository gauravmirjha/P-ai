-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  category text not null,
  note text,
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists content_ideas (
  id uuid primary key default gen_random_uuid(),
  hook text not null,
  angle text,
  platform text,
  script text,
  title text,
  cta text,
  format text,
  pillar text,
  status text,
  outcome text,
  created_at timestamptz not null default now()
);

-- If you created content_ideas before the content team was added:
alter table content_ideas add column if not exists script text;
alter table content_ideas add column if not exists title text;
alter table content_ideas add column if not exists cta text;
alter table content_ideas add column if not exists format text;
alter table content_ideas add column if not exists pillar text;

-- The performance loop: which ideas you actually made, and whether they worked.
-- This is what lets the director learn what suits you specifically, rather
-- than only what is trending generally.
alter table content_ideas add column if not exists status text;   -- made | skipped
alter table content_ideas add column if not exists outcome text;  -- good | flop

create table if not exists board_sessions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  responses jsonb not null,
  decision text,
  created_at timestamptz not null default now()
);

-- If you created board_sessions before the meeting rework, add the column:
alter table board_sessions add column if not exists decision text;

-- These tables are only ever touched via the service-role key from API
-- routes, never directly from the browser, so plain RLS-off tables are
-- fine here. If you ever call Supabase from the client with the anon key,
-- enable RLS and add policies before doing so.
