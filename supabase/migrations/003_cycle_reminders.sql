-- Almanac: cycle tracking and reminders (phase 4)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. It is safe to run again.

-- Cycle tracking lives in its own tables, readable and writable only by you.
-- No friend policy is ever added here, so sharing settings can't expose it.
create table if not exists public.cycle_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.cycle_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.cycle_profile enable row level security;
alter table public.cycle_logs enable row level security;
grant select, insert, update, delete on public.cycle_profile, public.cycle_logs to authenticated;
drop policy if exists "only me" on public.cycle_profile;
create policy "only me" on public.cycle_profile for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "only me" on public.cycle_logs;
create policy "only me" on public.cycle_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Phone and computer notifications: one row per device that allowed them.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
drop policy if exists "own devices" on public.push_subscriptions;
create policy "own devices" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Upcoming reminders. The app works out the next few weeks of reminders (repeats included)
-- in your own time zone and keeps this list up to date; the sender only reads it.
create table if not exists public.reminders (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  fire_at timestamptz not null,
  title text not null,
  body text not null default '',
  url text not null default '/',
  sent_at timestamptz,
  primary key (user_id, id)
);
create index if not exists reminders_due_idx on public.reminders (fire_at) where sent_at is null;
alter table public.reminders enable row level security;
grant select, insert, update, delete on public.reminders to authenticated;
drop policy if exists "own reminders" on public.reminders;
create policy "own reminders" on public.reminders for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Every 5 minutes, ask the website to send any reminders that are due.
-- Before running: replace YOUR-SITE.vercel.app below with your Almanac address.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('almanac-reminders') where exists (select 1 from cron.job where jobname = 'almanac-reminders');
select cron.schedule('almanac-reminders', '*/5 * * * *', $$ select net.http_post(url := 'https://YOUR-SITE.vercel.app/api/reminders', body := '{}'::jsonb) $$);
