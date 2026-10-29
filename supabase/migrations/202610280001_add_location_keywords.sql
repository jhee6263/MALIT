-- Level 3 콘텐츠에 "장소" 핵심어를 추가한다.
-- 기존 L3 콘텐츠는 문법 단계에서는 장소 조사(에서)를 묻지만 핵심어·문장 만들기 단계에는 장소어가 없어
-- 환자가 장소를 떠올리지 않은 채 장소 조사를 고르게 되었다. 핵심어 순서는 문장 순서(주어 → 장소 → 목적어 → 동작)를 따른다.
-- 이미 장소 핵심어가 있는 콘텐츠는 건드리지 않으므로 다시 실행해도 안전하다.

with location_keywords(title, word, category_hint, meaning_hint, sound) as (
  values
    ('L3-식사-001', '부엌', '집 안의 장소예요.', '음식을 만드는 곳이에요.', '부'),
    ('L3-집안-001', '거실', '집 안의 장소예요.', '가족이 모여 쉬는 넓은 공간이에요.', '거'),
    ('L3-건강-001', '병원', '건물 안의 장소예요.', '의사가 아픈 사람을 진료하는 곳이에요.', '병'),
    ('L3-이동-001', '정류장', '밖에 있는 장소예요.', '버스를 기다리는 곳이에요.', '정'),
    ('L3-쇼핑-001', '시장', '물건을 사고파는 장소예요.', '채소와 과일 등을 파는 곳이에요.', '시'),
    ('L3-여가-001', '공원', '밖에 있는 장소예요.', '나무와 잔디가 있어 산책하는 곳이에요.', '공')
)
update public.training_contents as content
set keywords = jsonb_build_array(content.keywords->0)
      || jsonb_build_array(jsonb_build_object(
        'role', 'location',
        'question', '어디에서 하나요?',
        'answer', location_keywords.word,
        'hints', jsonb_build_array(
          location_keywords.category_hint,
          location_keywords.meaning_hint,
          '첫소리는 ''' || location_keywords.sound || '''예요.'
        )
      ))
      || (content.keywords - 0),
    updated_at = now()
from location_keywords
where content.title = location_keywords.title
  and jsonb_array_length(content.keywords) > 0
  and content.keywords->0->>'role' = 'subject'
  and not exists (
    select 1 from jsonb_array_elements(content.keywords) as keyword where keyword->>'role' = 'location'
  );
