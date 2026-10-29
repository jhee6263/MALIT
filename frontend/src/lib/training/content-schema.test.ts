import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildGrammarTarget,
  findContentWarnings,
  firstSoundHint,
  grammarInputSchema,
  keywordsSchema,
  toGrammarInput,
} from "./content-schema.ts";

test("첫소리 단서는 받침이 있으면 이에요, 없으면 예요", () => {
  assert.equal(firstSoundHint("남자"), "첫소리는 '남'이에요.");
  assert.equal(firstSoundHint("여자"), "첫소리는 '여'예요.");
  assert.equal(firstSoundHint("씻어요"), "첫소리는 '씻'이에요.");
  assert.equal(firstSoundHint(" "), "");
});

test("핵심어는 단서 3개가 있어야 하고 같은 종류를 두 번 둘 수 없다", () => {
  const keyword = { role: "subject", question: "누가 있나요?", answer: "여자", hints: ["a", "b", "c"] };
  assert.equal(keywordsSchema.safeParse([keyword]).success, true);
  assert.equal(keywordsSchema.safeParse([{ ...keyword, hints: ["a", "b"] }]).success, false);
  assert.equal(keywordsSchema.safeParse([keyword, keyword]).success, false);
  assert.equal(keywordsSchema.safeParse([{ ...keyword, answer: " " }]).success, false);
});

test("문법 보기에는 정답이 들어 있어야 하고 중복이 없어야 한다", () => {
  const grammar = { slot: "object_particle", base: "사과", answer: "를", completed: "사과를", choices: ["을", "를"] };
  assert.equal(grammarInputSchema.safeParse(grammar).success, true);
  assert.equal(grammarInputSchema.safeParse({ ...grammar, choices: ["을", "이"] }).success, false);
  assert.equal(grammarInputSchema.safeParse({ ...grammar, choices: ["를", "를"] }).success, false);
  assert.equal(grammarInputSchema.safeParse({ ...grammar, choices: ["를"] }).success, false);
});

test("문법 목표 저장 형태: 정답은 완성형, 나머지는 어간+보기가 미리보기", () => {
  const built = buildGrammarTarget({ slot: "object_particle", base: "사과", answer: "를", completed: "사과를", choices: ["을", "를"] });
  assert.deepEqual(built.choices, [{ value: "을", preview: "사과을" }, { value: "를", preview: "사과를" }]);
  assert.equal("dictionaryForm" in built, false);

  const verb = buildGrammarTarget({ slot: "verb_ending", base: "씻", answer: "어요", completed: "씻어요", choices: ["아요", "어요"] });
  assert.equal(verb.dictionaryForm, "씻다");
});

test("저장된 문법 목표를 입력 형태로 되돌려도 같은 저장 형태가 나온다", () => {
  const stored = buildGrammarTarget({ slot: "location_particle", base: "병원", answer: "에서", completed: "병원에서", choices: ["에", "에서"] });
  const input = toGrammarInput(stored);
  assert.deepEqual(buildGrammarTarget(input), stored);
  // 예전 형식(stem, 문자열 보기)도 읽는다
  assert.deepEqual(toGrammarInput({ slot: "verb_ending", stem: "먹", answer: "어요", completed: "먹어요", choices: ["아요", "어요"] }).choices, ["아요", "어요"]);
});

test("목표 문장과 어긋나는 핵심어·완성형·허용 표현을 알려준다", () => {
  const ok = findContentWarnings({
    targetSentence: "여자가 부엌에서 샌드위치를 만들어요.",
    acceptedExpressions: ["여자가 부엌에서 샌드위치를 만들어요"],
    keywords: [{ role: "subject", answer: "여자" }, { role: "verb", answer: "만들어요" }],
    grammarTargets: [{ slot: "location_particle", completed: "부엌에서" }],
  });
  assert.deepEqual(ok, []);

  const bad = findContentWarnings({
    targetSentence: "여자가 부엌에서 샌드위치를 만들어요.",
    acceptedExpressions: ["남자가 공원에서 달려요"],
    keywords: [{ role: "object", answer: "책" }],
    grammarTargets: [{ slot: "object_particle", completed: "책을" }],
  });
  assert.equal(bad.length, 3);
});
