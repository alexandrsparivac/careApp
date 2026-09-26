-- =====================================================================
-- CareBridge — schema bazei de date (Supabase / PostgreSQL)
-- Rulați în: Supabase Dashboard → SQL Editor (sau `supabase db push`)
-- Ordinea: 001_schema.sql → 002_policies.sql → 003_triggers.sql → 004_cron.sql (opțional)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipuri enumerate
-- ---------------------------------------------------------------------
create type public.user_role         as enum ('admin', 'caregiver', 'family');
create type public.activity_category as enum ('medication', 'hygiene', 'nutrition', 'mobility', 'medical', 'social', 'other');
create type public.activity_status   as enum ('planned', 'done', 'missed', 'cancelled');
create type public.event_type        as enum ('appointment', 'visit', 'incident', 'fall', 'hospitalization', 'medication_change', 'other');
create type public.importance_level  as enum ('low', 'normal', 'high', 'critical');
create type public.mood_level        as enum ('very_good', 'good', 'neutral', 'bad', 'very_bad');

-- ---------------------------------------------------------------------
-- Utilizatori (extinde auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text,
  phone       text,
  role        public.user_role not null default 'family',
  language    text not null default 'ro' check (language in ('ro', 'en', 'ru')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Persoane vârstnice asistate
-- ---------------------------------------------------------------------
create table public.elders (
  id                       uuid primary key default gen_random_uuid(),
  full_name                text not null check (char_length(full_name) between 2 and 120),
  birth_date               date,
  gender                   text check (gender in ('female', 'male', 'other')),
  address                  text,
  medical_conditions       text,
  allergies                text,
  medications              text,
  mobility_notes           text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  created_by               uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at               timestamptz not null default now()
);

-- Echipa de îngrijire: legătura utilizator ↔ persoană asistată
create table public.elder_members (
  elder_id      uuid not null references public.elders (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  relationship  text,
  created_at    timestamptz not null default now(),
  primary key (elder_id, user_id)
);
create index elder_members_user_idx on public.elder_members (user_id);

-- ---------------------------------------------------------------------
-- Activități de îngrijire planificate / realizate
-- ---------------------------------------------------------------------
create table public.care_activities (
  id                uuid primary key default gen_random_uuid(),
  elder_id          uuid not null references public.elders (id) on delete cascade,
  series_id         uuid,                         -- grupează aparițiile unei activități recurente
  title             text not null check (char_length(title) between 1 and 200),
  description       text,
  category          public.activity_category not null default 'other',
  scheduled_at      timestamptz not null,
  duration_minutes  int check (duration_minutes between 1 and 1440),
  assigned_to       uuid references public.profiles (id) on delete set null,
  status            public.activity_status not null default 'planned',
  completed_at      timestamptz,
  completed_by      uuid references public.profiles (id) on delete set null,
  completion_notes  text,
  reminder_sent     boolean not null default false,
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now()
);
create index care_activities_elder_time_idx    on public.care_activities (elder_id, scheduled_at);
create index care_activities_assignee_time_idx on public.care_activities (assigned_to, scheduled_at);
create index care_activities_due_idx           on public.care_activities (scheduled_at) where status = 'planned';

-- ---------------------------------------------------------------------
-- Observații privind starea persoanei (jurnal de sănătate)
-- ---------------------------------------------------------------------
create table public.observations (
  id                 uuid primary key default gen_random_uuid(),
  elder_id           uuid not null references public.elders (id) on delete cascade,
  author_id          uuid references public.profiles (id) on delete set null default auth.uid(),
  observed_at        timestamptz not null default now(),
  mood               public.mood_level,
  pain_level         smallint check (pain_level between 0 and 10),
  systolic           smallint check (systolic between 40 and 300),
  diastolic          smallint check (diastolic between 20 and 200),
  heart_rate         smallint check (heart_rate between 20 and 250),
  temperature        numeric(4, 1) check (temperature between 30 and 45),
  glucose            numeric(5, 1) check (glucose between 10 and 800),
  oxygen_saturation  smallint check (oxygen_saturation between 50 and 100),
  appetite           text check (appetite in ('good', 'reduced', 'none')),
  sleep_quality      text check (sleep_quality in ('good', 'fair', 'poor')),
  notes              text,
  is_alert           boolean not null default false,
  created_at         timestamptz not null default now()
);
create index observations_elder_time_idx on public.observations (elder_id, observed_at desc);

-- ---------------------------------------------------------------------
-- Evenimente (programări, vizite, incidente, spitalizări ...)
-- ---------------------------------------------------------------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  elder_id     uuid not null references public.elders (id) on delete cascade,
  type         public.event_type not null default 'other',
  title        text not null check (char_length(title) between 1 and 200),
  description  text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  location     text,
  importance   public.importance_level not null default 'normal',
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_elder_time_idx on public.events (elder_id, starts_at);

-- ---------------------------------------------------------------------
-- Comunicare: câte un fir de discuție pentru fiecare persoană asistată
-- ---------------------------------------------------------------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  elder_id    uuid not null references public.elders (id) on delete cascade,
  sender_id   uuid references public.profiles (id) on delete set null default auth.uid(),
  content     text not null check (char_length(content) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index messages_elder_time_idx on public.messages (elder_id, created_at desc);

create table public.message_reads (
  elder_id      uuid not null references public.elders (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (elder_id, user_id)
);

-- ---------------------------------------------------------------------
-- Notificări (textul este localizat în client pe baza `type` + `payload`)
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  elder_id    uuid references public.elders (id) on delete cascade,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where not is_read;
