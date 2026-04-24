-- =========================================================
-- Loaded Lies — profiles table
-- Run this in Supabase dashboard → SQL Editor → New query.
-- =========================================================

-- 1. The table.
-- Each profile row is 1:1 with an auth.users row.
-- Deleting the auth user cascades to the profile.
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  username    text        unique not null
              check (char_length(username) between 3 and 20),
  hp          int         not null default 3,
  wins        int         not null default 0,
  losses      int         not null default 0,
  created_at  timestamptz not null default now()
);

-- 2. Turn on Row Level Security. Without this, policies below do nothing.
alter table public.profiles enable row level security;

-- 3. Policies.
-- Anyone (even not-logged-in) can read profiles — needed to show names in a lobby.
drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all"
  on public.profiles for select
  using (true);

-- You can only insert a profile for yourself.
drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- You can only update your own profile.
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy = nobody can delete profiles via the API.
-- (Deletion still happens automatically when the auth user is deleted.)

-- 4. Auto-create a profile whenever a new auth user signs up.
-- This trigger reads the username we passed in options.data during signUp.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text, 1, 6))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
