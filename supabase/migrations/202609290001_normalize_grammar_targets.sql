-- Normalize the 18 MVP grammar targets for patient-friendly answer choices.
-- Existing content ids, images, and publication statuses are preserved.

with normalized as (
  select
    content.id,
    jsonb_agg(
      case
        when target.value->>'slot' = 'verb_ending' then
          (target.value - 'choices') || jsonb_build_object(
            'dictionaryForm', (target.value->>'base') || '다',
            'choices', (
              select jsonb_agg(
                jsonb_build_object(
                  'value', choice.value,
                  'preview', case
                    when choice.value = target.value->>'answer' then target.value->>'completed'
                    else (target.value->>'base') || choice.value
                  end
                )
                order by choice.position
              )
              from (
                select
                  case
                    when jsonb_typeof(raw_choice.value) = 'string' then raw_choice.value #>> '{}'
                    else raw_choice.value->>'value'
                  end as value,
                  raw_choice.position
                from jsonb_array_elements(
                  case
                    when target.value->>'answer' = '요' then '["아요", "어요", "요"]'::jsonb
                    else target.value->'choices'
                  end
                ) with ordinality as raw_choice(value, position)
              ) as choice
            ),
            'explanation', ((target.value->>'base') || '다') || '와 ' ||
              (target.value->>'answer') || '가 만나 ' ||
              (target.value->>'completed') || '로 바뀌어요.'
          )
        else
          (target.value - 'choices') || jsonb_build_object(
            'choices', (
              select jsonb_agg(
                jsonb_build_object(
                  'value', choice.value,
                  'preview', (target.value->>'base') || choice.value
                )
                order by choice.position
              )
              from (
                select
                  case
                    when jsonb_typeof(raw_choice.value) = 'string' then raw_choice.value #>> '{}'
                    else raw_choice.value->>'value'
                  end as value,
                  raw_choice.position
                from jsonb_array_elements(target.value->'choices')
                  with ordinality as raw_choice(value, position)
              ) as choice
            ),
            'explanation', (target.value->>'base') || '와 ' ||
              (target.value->>'answer') || '를 연결하면 ' ||
              (target.value->>'completed') || '가 돼요.'
          )
      end
      order by target.position
    ) as grammar_targets
  from public.training_contents as content
  cross join lateral jsonb_array_elements(content.grammar_targets)
    with ordinality as target(value, position)
  where content.title in (
    'L1-식사-001', 'L2-식사-001', 'L3-식사-001',
    'L1-집안-001', 'L2-집안-001', 'L3-집안-001',
    'L1-건강-001', 'L2-건강-001', 'L3-건강-001',
    'L1-이동-001', 'L2-이동-001', 'L3-이동-001',
    'L1-쇼핑-001', 'L2-쇼핑-001', 'L3-쇼핑-001',
    'L1-여가-001', 'L2-여가-001', 'L3-여가-001'
  )
  group by content.id
)
update public.training_contents as content
set grammar_targets = normalized.grammar_targets,
    updated_at = now()
from normalized
where content.id = normalized.id;
