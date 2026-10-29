-- 음성인식 사용 동의.
-- 음성인식은 브라우저가 말소리를 제공사 서버로 보내 글자로 바꾸므로, 환자(또는 보호자)가 동의한 경우에만 켠다.
-- 재활사가 환자 등록·훈련 설정 화면에서 동의를 확인해 기록하고, 꺼져 있으면 지금의 수동 확인 화면이 그대로 나온다.
-- 동의한 시각과 기록한 재활사를 함께 남기며, 다시 실행해도 안전하다.

alter table public.learner_settings
  add column if not exists voice_consent boolean not null default false,
  add column if not exists voice_consent_at timestamptz,
  add column if not exists voice_consent_by uuid references public.profiles(id);
