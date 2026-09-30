-- MALIT MVP initial topics and 18 draft training contents
-- Images are intentionally left empty. Review images before publishing content.

insert into public.topics(name, is_active, sort_order)
values
  ('식사와 음료', true, 10),
  ('집안생활', true, 20),
  ('개인관리와 건강', true, 30),
  ('외출과 이동', true, 40),
  ('쇼핑과 생활업무', true, 50),
  ('가족과 여가', true, 60)
on conflict(name) do update
set is_active = excluded.is_active,
    sort_order = excluded.sort_order;

with seed(
  title, level, topic_name, image_alt, target_sentence,
  subject_word, subject_particle, subject_hint, subject_sound,
  location_word, location_particle,
  object_word, object_particle, object_hint, object_sound,
  verb_base, verb_answer, verb_surface, verb_hint, verb_sound
) as (
  values
    ('L1-식사-001', 1, '식사와 음료', '성인 여자가 컵을 들고 물을 마시는 장면', '여자가 마셔요.', '여자', '가', '성인 여성이에요.', '여', null, null, null, null, null, null, '마시', '어요', '마셔요', '컵에 든 음료를 입으로 먹는 행동이에요.', '마'),
    ('L2-식사-001', 2, '식사와 음료', '성인 남자가 사과 한 개를 먹는 장면', '남자가 사과를 먹어요.', '남자', '가', '성인 남성이에요.', '남', null, null, '사과', '를', '둥글고 빨간 과일이에요.', '사', '먹', '어요', '먹어요', '음식을 입에 넣는 행동이에요.', '먹'),
    ('L3-식사-001', 3, '식사와 음료', '성인 여자가 부엌에서 샌드위치를 만드는 장면', '여자가 부엌에서 샌드위치를 만들어요.', '여자', '가', '성인 여성이에요.', '여', '부엌', '에서', '샌드위치', '를', '빵 사이에 재료를 넣은 음식이에요.', '샌', '만들', '어요', '만들어요', '재료를 이용해 새로운 것을 완성하는 행동이에요.', '만'),

    ('L1-집안-001', 1, '집안생활', '성인 남자가 청소 도구로 바닥을 청소하는 장면', '남자가 청소해요.', '남자', '가', '성인 남성이에요.', '남', null, null, null, null, null, null, '청소하', '해요', '청소해요', '더러운 곳을 깨끗하게 하는 행동이에요.', '청'),
    ('L2-집안-001', 2, '집안생활', '성인 여자가 천으로 창문을 닦는 장면', '여자가 창문을 닦아요.', '여자', '가', '성인 여성이에요.', '여', null, null, '창문', '을', '밖을 볼 수 있는 유리로 된 부분이에요.', '창', '닦', '아요', '닦아요', '천으로 문질러 깨끗하게 하는 행동이에요.', '닦'),
    ('L3-집안-001', 3, '집안생활', '성인 남자가 거실에서 책을 책장에 정리하는 장면', '남자가 거실에서 책을 정리해요.', '남자', '가', '성인 남성이에요.', '남', '거실', '에서', '책', '을', '글과 그림을 읽는 물건이에요.', '책', '정리하', '해요', '정리해요', '물건을 제자리에 가지런히 두는 행동이에요.', '정'),

    ('L1-건강-001', 1, '개인관리와 건강', '성인 여자가 세면대에서 손을 씻는 장면', '여자가 씻어요.', '여자', '가', '성인 여성이에요.', '여', null, null, null, null, null, null, '씻', '어요', '씻어요', '물로 몸이나 물건을 깨끗하게 하는 행동이에요.', '씻'),
    ('L2-건강-001', 2, '개인관리와 건강', '성인 남자가 물과 함께 알약을 먹는 장면', '남자가 약을 먹어요.', '남자', '가', '성인 남성이에요.', '남', null, null, '약', '을', '몸이 아플 때 치료를 위해 먹어요.', '약', '먹', '어요', '먹어요', '입으로 삼키는 행동이에요.', '먹'),
    ('L3-건강-001', 3, '개인관리와 건강', '성인 의사가 병원 진료실에서 성인 환자를 진찰하는 장면', '의사가 병원에서 환자를 진찰해요.', '의사', '가', '아픈 사람을 치료하는 사람이에요.', '의', '병원', '에서', '환자', '를', '몸이 아파 진료를 받는 사람이에요.', '환', '진찰하', '해요', '진찰해요', '몸의 상태를 살펴보는 행동이에요.', '진'),

    ('L1-이동-001', 1, '외출과 이동', '성인 남자가 보행로를 걷는 장면', '남자가 걸어요.', '남자', '가', '성인 남성이에요.', '남', null, null, null, null, null, null, '걷', '어요', '걸어요', '두 발로 앞으로 이동하는 행동이에요.', '걷'),
    ('L2-이동-001', 2, '외출과 이동', '성인 여자가 버스에 올라타는 장면', '여자가 버스를 타요.', '여자', '가', '성인 여성이에요.', '여', null, null, '버스', '를', '여러 사람이 함께 타는 큰 자동차예요.', '버', '타', '요', '타요', '이동수단에 올라가는 행동이에요.', '타'),
    ('L3-이동-001', 3, '외출과 이동', '성인 남자가 버스 정류장에서 버스를 기다리는 장면', '남자가 정류장에서 버스를 기다려요.', '남자', '가', '성인 남성이에요.', '남', '정류장', '에서', '버스', '를', '여러 사람이 함께 타는 큰 자동차예요.', '버', '기다리', '어요', '기다려요', '무언가 올 때까지 머무는 행동이에요.', '기'),

    ('L1-쇼핑-001', 1, '쇼핑과 생활업무', '성인 여자가 계산대에서 카드로 계산하는 장면', '여자가 계산해요.', '여자', '가', '성인 여성이에요.', '여', null, null, null, null, null, null, '계산하', '해요', '계산해요', '물건값을 지불하는 행동이에요.', '계'),
    ('L2-쇼핑-001', 2, '쇼핑과 생활업무', '성인 남자가 진열대에서 과일을 고르는 장면', '남자가 과일을 골라요.', '남자', '가', '성인 남성이에요.', '남', null, null, '과일', '을', '사과나 바나나처럼 나무와 풀에서 열리는 먹거리예요.', '과', '고르', '아요', '골라요', '여러 개 중 하나를 선택하는 행동이에요.', '고'),
    ('L3-쇼핑-001', 3, '쇼핑과 생활업무', '성인 여자가 시장에서 채소를 사는 장면', '여자가 시장에서 채소를 사요.', '여자', '가', '성인 여성이에요.', '여', '시장', '에서', '채소', '를', '배추나 당근처럼 밭에서 기르는 먹거리예요.', '채', '사', '요', '사요', '돈을 내고 물건을 얻는 행동이에요.', '사'),

    ('L1-여가-001', 1, '가족과 여가', '성인 남자가 책을 펼쳐 읽는 장면', '남자가 읽어요.', '남자', '가', '성인 남성이에요.', '남', null, null, null, null, null, null, '읽', '어요', '읽어요', '글자를 보고 내용을 이해하는 행동이에요.', '읽'),
    ('L2-여가-001', 2, '가족과 여가', '성인 여자가 소파에 앉아 텔레비전을 보는 장면', '여자가 텔레비전을 봐요.', '여자', '가', '성인 여성이에요.', '여', null, null, '텔레비전', '을', '화면으로 방송을 보는 전자제품이에요.', '텔', '보', '아요', '봐요', '눈으로 화면을 살펴보는 행동이에요.', '보'),
    ('L3-여가-001', 3, '가족과 여가', '성인 남자가 공원에서 성인 친구를 만나 인사하는 장면', '남자가 공원에서 친구를 만나요.', '남자', '가', '성인 남성이에요.', '남', '공원', '에서', '친구', '를', '가깝게 지내는 사람이에요.', '친', '만나', '요', '만나요', '사람과 서로 마주 보는 행동이에요.', '만')
), prepared as (
  select
    seed.*,
    jsonb_build_array(
      jsonb_build_object('role', 'subject', 'word', subject_word, 'particle', subject_particle)
    )
    || case when location_word is null then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object('role', 'location', 'word', location_word, 'particle', location_particle)
    ) end
    || case when object_word is null then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object('role', 'object', 'word', object_word, 'particle', object_particle)
    ) end
    || jsonb_build_array(
      jsonb_build_object('role', 'verb', 'base', verb_base, 'ending', verb_answer, 'surface', verb_surface)
    ) as sentence_structure,
    jsonb_build_array(
      jsonb_build_object('role', 'subject', 'question', '누가 있나요?', 'answer', subject_word, 'hints', jsonb_build_array('사람이에요.', subject_hint, '첫소리는 ''' || subject_sound || '''예요.'))
    )
    || case when object_word is null then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object('role', 'object', 'question', case when object_word in ('환자', '친구') then '누구를?' else '무엇을?' end, 'answer', object_word, 'hints', jsonb_build_array('문장에서 행동의 대상이에요.', object_hint, '첫소리는 ''' || object_sound || '''예요.'))
    ) end
    || jsonb_build_array(
      jsonb_build_object('role', 'verb', 'question', '무엇을 하나요?', 'answer', verb_surface, 'hints', jsonb_build_array('행동을 나타내는 말이에요.', verb_hint, '첫소리는 ''' || verb_sound || '''예요.'))
    ) as keywords,
    jsonb_build_array(
      jsonb_build_object('slot', 'subject_particle', 'base', subject_word, 'answer', subject_particle, 'completed', subject_word || subject_particle, 'choices', jsonb_build_array('은', '는', '이', '가'))
    )
    || case when location_word is null then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object('slot', 'location_particle', 'base', location_word, 'answer', location_particle, 'completed', location_word || location_particle, 'choices', jsonb_build_array('에', '에서'))
    ) end
    || case when object_word is null then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object('slot', 'object_particle', 'base', object_word, 'answer', object_particle, 'completed', object_word || object_particle, 'choices', jsonb_build_array('을', '를'))
    ) end
    || jsonb_build_array(
      jsonb_build_object('slot', 'verb_ending', 'base', verb_base, 'answer', verb_answer, 'completed', verb_surface, 'choices', jsonb_build_array('아요', '어요', '해요'))
    ) as grammar_targets
  from seed
)
insert into public.training_contents(
  title, level, topic_id, image_path, image_alt, target_sentence,
  sentence_structure, keywords, grammar_targets, accepted_expressions, status
)
select
  prepared.title,
  prepared.level,
  topics.id,
  null,
  prepared.image_alt,
  prepared.target_sentence,
  prepared.sentence_structure,
  prepared.keywords,
  prepared.grammar_targets,
  jsonb_build_array(prepared.target_sentence, trim(trailing '.' from prepared.target_sentence)),
  'draft'::public.content_status
from prepared
join public.topics on topics.name = prepared.topic_name
where not exists (
  select 1 from public.training_contents existing where existing.title = prepared.title
);
