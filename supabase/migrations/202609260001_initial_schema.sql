-- MALIT D1 initial schema
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','therapist','patient');
create type public.account_status as enum ('pending','active','rejected','suspended');
create type public.content_status as enum ('draft','review','published','archived');
create type public.judgment_source as enum ('self','companion','therapist','stt','demo');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'patient',
  status public.account_status not null default 'pending',
  name text not null,
  login_id text unique check (login_id is null or login_id ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2100),
  organization text,
  credential text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.therapist_patient_links (
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (therapist_id,patient_id)
);

create table public.learner_settings (
  patient_id uuid primary key references public.profiles(id) on delete cascade,
  training_level smallint not null default 1 check (training_level between 1 and 3),
  daily_count smallint not null default 6 check (daily_count between 1 and 20),
  topics text[] not null default '{}',
  excluded_topics text[] not null default '{}',
  wait_seconds smallint not null default 8,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.training_contents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level smallint not null check (level between 1 and 3),
  topic_id uuid references public.topics(id),
  image_path text,
  image_alt text not null,
  target_sentence text not null,
  sentence_structure jsonb not null default '[]',
  keywords jsonb not null default '[]',
  grammar_targets jsonb not null default '[]',
  accepted_expressions jsonb not null default '[]',
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  plan_date date not null,
  source text not null default 'd1_rules' check (source in ('therapist','d1_rules','d2_recommendation')),
  reason text,
  created_at timestamptz not null default now(),
  unique(patient_id,plan_date)
);
create table public.daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.daily_plans(id) on delete cascade,
  content_id uuid not null references public.training_contents(id),
  item_order smallint not null,
  item_type text not null default 'new' check (item_type in ('review','focus','new')),
  unique(plan_id,item_order)
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.daily_plans(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  sentence_count smallint not null default 0
);
create table public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  content_id uuid not null references public.training_contents(id),
  step text not null,
  target text not null,
  hint_level smallint not null default 0,
  success boolean not null,
  judgment_source public.judgment_source not null,
  response_ms integer,
  transcript text,
  stt_confidence numeric(4,3),
  created_at timestamptz not null default now()
);
create table public.hint_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.training_attempts(id) on delete cascade,
  hint_type text not null,
  hint_level smallint not null,
  created_at timestamptz not null default now()
);
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.training_attempts(id) on delete cascade,
  evaluator_id uuid references public.profiles(id),
  source public.judgment_source not null,
  is_success boolean not null,
  note text,
  created_at timestamptz not null default now()
);
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  recommendation_type text not null,
  current_value jsonb,
  recommended_value jsonb not null,
  reason text not null,
  evidence jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','applied','modified','rejected')),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active');
$$;
create or replace function public.is_active_therapist() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='therapist' and status='active');
$$;
create or replace function public.is_linked_patient(target uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.therapist_patient_links where therapist_id=auth.uid() and patient_id=target);
$$;

alter table public.profiles enable row level security;
alter table public.therapist_patient_links enable row level security;
alter table public.learner_settings enable row level security;
alter table public.topics enable row level security;
alter table public.training_contents enable row level security;
alter table public.daily_plans enable row level security;
alter table public.daily_plan_items enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_attempts enable row level security;
alter table public.hint_events enable row level security;
alter table public.evaluations enable row level security;
alter table public.recommendations enable row level security;
alter table public.audit_logs enable row level security;

create policy "own profile or care team" on public.profiles for select using (id=auth.uid() or public.is_admin() or public.is_linked_patient(id));
create policy "admin updates profiles" on public.profiles for update using (public.is_admin());
create policy "therapists see own links" on public.therapist_patient_links for select using (therapist_id=auth.uid() or patient_id=auth.uid() or public.is_admin());
create policy "care team reads settings" on public.learner_settings for select using (patient_id=auth.uid() or public.is_linked_patient(patient_id) or public.is_admin());
create policy "therapist manages linked settings" on public.learner_settings for all using (public.is_linked_patient(patient_id) or public.is_admin()) with check (public.is_linked_patient(patient_id) or public.is_admin());
create policy "active users read topics" on public.topics for select using (auth.uid() is not null);
create policy "admin manages topics" on public.topics for all using (public.is_admin()) with check (public.is_admin());
create policy "published contents readable" on public.training_contents for select using (status='published' or public.is_active_therapist() or public.is_admin());
create policy "admin manages contents" on public.training_contents for all using (public.is_admin()) with check (public.is_admin());
create policy "care team reads plans" on public.daily_plans for select using (patient_id=auth.uid() or public.is_linked_patient(patient_id) or public.is_admin());
create policy "care team reads sessions" on public.training_sessions for select using (patient_id=auth.uid() or public.is_linked_patient(patient_id) or public.is_admin());
create policy "patient creates own sessions" on public.training_sessions for insert with check (patient_id=auth.uid());
create policy "patient updates own sessions" on public.training_sessions for update using (patient_id=auth.uid());
create policy "care team reads attempts" on public.training_attempts for select using (exists(select 1 from public.training_sessions s where s.id=session_id and (s.patient_id=auth.uid() or public.is_linked_patient(s.patient_id) or public.is_admin())));
create policy "patient creates own attempts" on public.training_attempts for insert with check (exists(select 1 from public.training_sessions s where s.id=session_id and s.patient_id=auth.uid()));
create policy "care team reads hint events" on public.hint_events for select using (exists(select 1 from public.training_attempts a join public.training_sessions s on s.id=a.session_id where a.id=attempt_id and (s.patient_id=auth.uid() or public.is_linked_patient(s.patient_id) or public.is_admin())));
create policy "patient creates own hint events" on public.hint_events for insert with check (exists(select 1 from public.training_attempts a join public.training_sessions s on s.id=a.session_id where a.id=attempt_id and s.patient_id=auth.uid()));
create policy "care team reads evaluations" on public.evaluations for select using (exists(select 1 from public.training_attempts a join public.training_sessions s on s.id=a.session_id where a.id=attempt_id and (s.patient_id=auth.uid() or public.is_linked_patient(s.patient_id) or public.is_admin())));
create policy "care team reads recommendations" on public.recommendations for select using (patient_id=auth.uid() or public.is_linked_patient(patient_id) or public.is_admin());
create policy "admin reads audit" on public.audit_logs for select using (public.is_admin());

-- 가입 메타데이터로 재활사 pending 프로필 생성. 환자는 서버 API에서 생성합니다.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,role,status,name,login_id,birth_year,organization,credential)
  values(new.id,coalesce((new.raw_user_meta_data->>'role')::public.user_role,'patient'),
    case when new.raw_user_meta_data->>'role'='therapist' then 'pending'::public.account_status else 'active'::public.account_status end,
    coalesce(new.raw_user_meta_data->>'name','사용자'),nullif(lower(new.raw_user_meta_data->>'login_id'),''),
    nullif(new.raw_user_meta_data->>'birth_year','')::smallint,new.raw_user_meta_data->>'organization',new.raw_user_meta_data->>'credential');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into storage.buckets(id,name,public) values ('content-images','content-images',true),('audio-recordings','audio-recordings',false) on conflict do nothing;
create policy "public content images" on storage.objects for select using (bucket_id='content-images');
create policy "admin uploads content images" on storage.objects for insert with check (bucket_id='content-images' and public.is_admin());
create policy "own private audio" on storage.objects for select using (bucket_id='audio-recordings' and auth.uid()::text=(storage.foldername(name))[1]);
