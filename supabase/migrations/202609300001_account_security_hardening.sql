-- 계정 보안 보강
-- 1) 역할은 클라이언트가 바꿀 수 없는 app_metadata에서만 읽는다.
--    공개 가입(anon key의 signUp)으로 user_metadata에 role을 넣어도 관리자·환자가 되지 않는다.
--    서버(service role)가 역할을 지정하지 않은 계정은 pending으로 만들어 로그인할 수 없게 한다.
-- 2) 정지·반려된 재활사는 연결된 환자 데이터에 접근할 수 없다.
-- 3) learner_settings 쓰기는 서버 API(service role)와 관리자만 한다.
-- 최초 관리자는 기존처럼 Supabase에서 계정을 만든 뒤 profiles의 role/status를 직접 수정한다.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  assigned_role text := new.raw_app_meta_data->>'role';
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
    case when assigned_role in ('therapist', 'patient') then assigned_role::public.user_role else 'patient'::public.user_role end,
    case when assigned_role = 'patient' then 'active'::public.account_status else 'pending'::public.account_status end,
    coalesce(new.raw_user_meta_data->>'name', '사용자'),
    case when assigned_role = 'patient' then nullif(lower(new.raw_user_meta_data->>'login_id'), '') end,
    nullif(new.raw_user_meta_data->>'birth_year', '')::smallint,
    new.raw_user_meta_data->>'organization',
    new.raw_user_meta_data->>'credential'
  );
  return new;
end;
$$;

create or replace function public.is_linked_patient(target uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.therapist_patient_links link
    join public.profiles therapist on therapist.id = link.therapist_id
    where link.therapist_id = auth.uid()
      and link.patient_id = target
      and therapist.role = 'therapist'
      and therapist.status = 'active'
  );
$$;

drop policy if exists "therapist manages linked settings" on public.learner_settings;
drop policy if exists "admin manages settings" on public.learner_settings;
create policy "admin manages settings" on public.learner_settings
  for all using (public.is_admin()) with check (public.is_admin());
