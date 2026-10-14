-- Almanac: initial schema (phase 1)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Every table has row level security, so each person can only read and write their own rows.

-- Profiles: one per account, created automatically on sign-up.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  birthday date,
  created_at timestamptz not null default now()
);

-- Planner settings: weight unit, exercise library, custom formats and app preferences.
create table if not exists public.planner_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  unit text not null default 'lb',
  exercises jsonb not null default '[]'::jsonb,
  formats jsonb not null default '[]'::jsonb,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Calendars (subcalendars). `sharing` is used by friends in phase 3.
create table if not exists public.calendars (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  body jsonb not null,
  sharing text not null default 'private' check (sharing in ('private', 'friends')),
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Events. The full event lives in `body`; a few fields are copied out for lookups.
create table if not exists public.events (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  cal_id text not null,
  date date not null,
  body jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists events_user_date_idx on public.events (user_id, date);
create index if not exists events_cal_idx on public.events (user_id, cal_id);

-- Saved templates ("My templates" in the Library).
create table if not exists public.templates (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  body jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Daily news brief, one row per day, readable by every signed-in person.
create table if not exists public.news_briefs (
  date date primary key,
  items jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

-- Row level security
alter table public.profiles enable row level security;
alter table public.planner_settings enable row level security;
alter table public.calendars enable row level security;
alter table public.events enable row level security;
alter table public.templates enable row level security;
alter table public.news_briefs enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own settings" on public.planner_settings;
create policy "own settings" on public.planner_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own calendars" on public.calendars;
create policy "own calendars" on public.calendars for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own events" on public.events;
create policy "own events" on public.events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own templates" on public.templates;
create policy "own templates" on public.templates for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read news" on public.news_briefs;
create policy "read news" on public.news_briefs for select to authenticated using (true);

-- Create a profile and settings row for every new account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(coalesce(new.email, ''), '@', 1))
    on conflict (id) do nothing;
  insert into public.planner_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- News writer: the daily brief is published through this function with a private token,
-- so the scheduled writer never needs the project's secret service key.
create schema if not exists private;
create table if not exists private.news_token (token text primary key);
insert into private.news_token (token)
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') where not exists (select 1 from private.news_token);

create or replace function public.publish_news(p_token text, p_date date, p_items jsonb)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from private.news_token where token = p_token) then
    raise exception 'not allowed';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array';
  end if;
  insert into public.news_briefs (date, items, generated_at) values (p_date, p_items, now())
    on conflict (date) do update set items = excluded.items, generated_at = now();
end;
$$;
revoke all on function public.publish_news(text, date, jsonb) from public;
grant execute on function public.publish_news(text, date, jsonb) to anon, authenticated;

-- Live updates between your phone and computer.
do $$
begin
  begin alter publication supabase_realtime add table public.calendars; exception when others then null; end;
  begin alter publication supabase_realtime add table public.events; exception when others then null; end;
  begin alter publication supabase_realtime add table public.templates; exception when others then null; end;
  begin alter publication supabase_realtime add table public.planner_settings; exception when others then null; end;
end $$;
