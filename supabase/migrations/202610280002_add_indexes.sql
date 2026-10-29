-- 훈련 기록·세션 조회에 쓰는 인덱스.
-- 재활사 기록 화면과 환자 결과 화면은 세션·환자·날짜 기준으로 조회하는데, 기본 키 외에는 인덱스가 없었다.

create index if not exists training_sessions_patient_started_idx
  on public.training_sessions(patient_id, started_at desc);
create index if not exists training_sessions_plan_idx
  on public.training_sessions(plan_id);
create index if not exists training_attempts_session_created_idx
  on public.training_attempts(session_id, created_at);
create index if not exists training_attempts_created_idx
  on public.training_attempts(created_at desc);
create index if not exists hint_events_attempt_idx
  on public.hint_events(attempt_id);
create index if not exists evaluations_attempt_idx
  on public.evaluations(attempt_id);
create index if not exists daily_plan_items_plan_idx
  on public.daily_plan_items(plan_id, item_order);
create index if not exists therapist_patient_links_patient_idx
  on public.therapist_patient_links(patient_id);
create index if not exists training_contents_status_level_idx
  on public.training_contents(status, level);
