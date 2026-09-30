-- MALIT account and basic profile rules
-- Run this once in the Supabase SQL Editor for an existing project.

alter table public.profiles
  add column if not exists login_id text,
  add column if not exists birth_year smallint;

alter table public.profiles
  add constraint profiles_login_id_format
    check (login_id is null or login_id ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  add constraint profiles_birth_year_range
    check (birth_year is null or birth_year between 1900 and 2100);

create unique index if not exists profiles_login_id_unique
  on public.profiles (lower(login_id))
  where login_id is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(
    id,
    role,
    status,
    name,
    login_id,
    birth_year,
    organization,
    credential
  )
  values(
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'patient'),
    case
      when new.raw_user_meta_data->>'role'='therapist'
        then 'pending'::public.account_status
      else 'active'::public.account_status
    end,
    coalesce(new.raw_user_meta_data->>'name', '사용자'),
    nullif(lower(new.raw_user_meta_data->>'login_id'), ''),
    nullif(new.raw_user_meta_data->>'birth_year', '')::smallint,
    new.raw_user_meta_data->>'organization',
    new.raw_user_meta_data->>'credential'
  );
  return new;
end;
$$;
