-- 핵심어의 "첫소리" 도움 단서 문구를 바로잡는다.
-- 기존 문구는 받침이 있는 글자 뒤에도 "예요"를 붙여 "첫소리는 '남'예요."처럼 어색했다. 받침이 있으면 "이에요"가 맞다.
-- 받침이 없는 글자("첫소리는 '여'예요.")와 다른 형식의 단서는 건드리지 않으므로 다시 실행해도 안전하다.

update public.training_contents as content
set keywords = (
      select jsonb_agg(
        case
          when k.keyword ? 'hints' then jsonb_set(k.keyword, '{hints}', (
            select coalesce(jsonb_agg(
              case
                when (h.hint #>> '{}') ~ '^첫소리는 ''.''예요\.$'
                 and ascii(substr(h.hint #>> '{}', 7, 1)) between 44032 and 55203
                 and (ascii(substr(h.hint #>> '{}', 7, 1)) - 44032) % 28 <> 0
                then to_jsonb(regexp_replace(h.hint #>> '{}', '예요\.$', '이에요.'))
                else h.hint
              end
              order by h.hint_order
            ), '[]'::jsonb)
            from jsonb_array_elements(k.keyword->'hints') with ordinality as h(hint, hint_order)
          ))
          else k.keyword
        end
        order by k.keyword_order
      )
      from jsonb_array_elements(content.keywords) with ordinality as k(keyword, keyword_order)
    ),
    updated_at = now()
where exists (
  select 1
  from jsonb_array_elements(content.keywords) as k(keyword),
       jsonb_array_elements_text(k.keyword->'hints') as h(hint)
  where h.hint ~ '^첫소리는 ''.''예요\.$'
    and ascii(substr(h.hint, 7, 1)) between 44032 and 55203
    and (ascii(substr(h.hint, 7, 1)) - 44032) % 28 <> 0
);
