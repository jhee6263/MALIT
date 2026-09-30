-- 초기 스키마를 이미 실행한 프로젝트에서만 수동 실행합니다.
-- 코드에 포함됐던 예시 훈련 콘텐츠와 예시 주제만 정확히 제거합니다.
delete from public.training_contents
where id = '11111111-1111-4111-8111-111111111111';

delete from public.topics
where name in ('식사와 음식', '집안일', '가족과 대화', '외출과 이동', '건강관리')
  and not exists (
    select 1 from public.training_contents
    where training_contents.topic_id = topics.id
  );
