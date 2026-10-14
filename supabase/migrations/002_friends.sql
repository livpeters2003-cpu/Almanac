-- Almanac: friends and sharing (phase 3)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run. It is safe to run again.
-- Friends can see each other's name and birthday, and the calendars marked "Friends" (read only).

-- Profile additions: an invite code for links, and a birthday as month and day (no year needed).
alter table public.profiles add column if not exists invite_code text;
alter table public.profiles add column if not exists birthday_month smallint check (birthday_month between 1 and 12);
alter table public.profiles add column if not exists birthday_day smallint check (birthday_day between 1 and 31);
update public.profiles set invite_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 10) where invite_code is null;
alter table public.profiles alter column invite_code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
alter table public.profiles alter column invite_code set not null;
create unique index if not exists profiles_invite_code_idx on public.profiles (invite_code);

-- Friend requests. A row is a request from one person to another; accepted rows are friendships.
create table if not exists public.friend_requests (
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists friend_requests_to_idx on public.friend_requests (to_id);
alter table public.friend_requests enable row level security;
grant select, delete on public.friend_requests to authenticated;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted' and ((from_id = a and to_id = b) or (from_id = b and to_id = a))
  );
$$;
revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

drop policy if exists "see my requests" on public.friend_requests;
create policy "see my requests" on public.friend_requests for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists "remove my requests" on public.friend_requests;
create policy "remove my requests" on public.friend_requests for delete to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
-- New requests and accepting go through the functions below.

-- Profiles: your own and your friends'. People with a pending request only see a name (request_people below).
drop policy if exists "own profile" on public.profiles;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "read friends profiles" on public.profiles;
create policy "read friends profiles" on public.profiles for select to authenticated using (public.are_friends(id, auth.uid()));

-- Names for pending requests, to and from you.
create or replace function public.request_people()
returns table (id uuid, display_name text) language sql stable security definer set search_path = public as $$
  select p.id, p.display_name from public.profiles p
  join public.friend_requests r on r.status = 'pending'
    and ((r.from_id = auth.uid() and r.to_id = p.id) or (r.to_id = auth.uid() and r.from_id = p.id));
$$;
revoke all on function public.request_people() from public;
grant execute on function public.request_people() to authenticated;

-- Friends can read calendars marked "friends" and the events on them. Writing stays owner-only.
drop policy if exists "friends read shared calendars" on public.calendars;
create policy "friends read shared calendars" on public.calendars for select to authenticated
  using (sharing = 'friends' and public.are_friends(user_id, auth.uid()));
drop policy if exists "friends read shared events" on public.events;
create policy "friends read shared events" on public.events for select to authenticated using (
  public.are_friends(user_id, auth.uid()) and exists (
    select 1 from public.calendars c where c.user_id = events.user_id and c.id = events.cal_id and c.sharing = 'friends'
  )
);

-- Send a request with someone's invite code. If they already asked you, you become friends.
create or replace function public.friend_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); them public.profiles;
begin
  if me is null then raise exception 'sign in first'; end if;
  select * into them from public.profiles where invite_code = trim(p_code);
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if them.id = me then return jsonb_build_object('status', 'self'); end if;
  if public.are_friends(me, them.id) then return jsonb_build_object('status', 'friends', 'name', them.display_name); end if;
  if exists (select 1 from public.friend_requests where from_id = them.id and to_id = me) then
    update public.friend_requests set status = 'accepted' where from_id = them.id and to_id = me;
    return jsonb_build_object('status', 'friends', 'name', them.display_name);
  end if;
  insert into public.friend_requests (from_id, to_id) values (me, them.id) on conflict do nothing;
  return jsonb_build_object('status', 'sent', 'name', them.display_name);
end;
$$;

-- Send a request by email. The answer is the same whether or not the email has an account.
create or replace function public.friend_by_email(p_email text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid(); them uuid;
begin
  if me is null then raise exception 'sign in first'; end if;
  select id into them from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if them is null or them = me then return jsonb_build_object('status', 'sent'); end if;
  if exists (select 1 from public.friend_requests where from_id = them and to_id = me) then
    update public.friend_requests set status = 'accepted' where from_id = them and to_id = me;
  else
    insert into public.friend_requests (from_id, to_id) values (me, them) on conflict do nothing;
  end if;
  return jsonb_build_object('status', 'sent');
end;
$$;

create or replace function public.accept_friend(p_from uuid)
returns void language sql security definer set search_path = public as $$
  update public.friend_requests set status = 'accepted' where from_id = p_from and to_id = auth.uid();
$$;

revoke all on function public.friend_by_code(text) from public;
revoke all on function public.friend_by_email(text) from public;
revoke all on function public.accept_friend(uuid) from public;
grant execute on function public.friend_by_code(text) to authenticated;
grant execute on function public.friend_by_email(text) to authenticated;
grant execute on function public.accept_friend(uuid) to authenticated;

-- Live updates for requests and profiles.
do $$
begin
  begin alter publication supabase_realtime add table public.friend_requests; exception when others then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when others then null; end;
end $$;
