import assert from "node:assert/strict";
import { test } from "node:test";
import { compareSpeech, jamoSimilarity, normalizeSpeechText, summarizeSpeechAgreement } from "./speech-match.ts";

test("띄어쓰기와 문장부호는 무시한다", () => {
  assert.equal(normalizeSpeechText("남자가  사과를, 먹어요."), "남자가사과를먹어요");
  assert.equal(compareSpeech("남자가 사과를 먹어요", ["남자가 사과를 먹어요."]).level, "match");
});

test("받침 하나 차이는 일치에 가깝게 계산한다", () => {
  assert.ok(jamoSimilarity("먹어요", "먹어욘") > 0.8);
  assert.ok(jamoSimilarity("먹어요", "마셔요") < 0.7);
});

test("목표가 말 안에 들어 있으면 일치로 본다", () => {
  assert.equal(compareSpeech("음 사과요", ["사과"]).level, "match");
});

test("한 글자 낱말은 다른 말에 섞여 있다고 일치로 보지 않는다", () => {
  assert.notEqual(compareSpeech("물건을 샀어요", ["물"]).level, "match");
  assert.equal(compareSpeech("물", ["물"]).level, "match");
});

test("비슷한 다른 낱말로 바꿔 말하면 일치로 보지 않는다", () => {
  const result = compareSpeech("남자가 사과를 먹어요", ["남자가 사과를 마셔요"]);
  assert.notEqual(result.level, "match");
});

test("긴 문장에서 낱말 하나만 바꿔 말해도 일치로 보지 않는다", () => {
  const target = "남자가 정류장에서 버스를 기다려요.";
  // 낱말 하나가 달라도 전체 자모 유사도는 0.85를 넘는다. 어절이 빠진 것까지 봐야 걸러진다.
  assert.ok(jamoSimilarity("남자가 정류장에서 책을 기다려요", target) >= 0.85);
  assert.equal(compareSpeech("남자가 정류장에서 책을 기다려요", [target]).level, "partial");
  assert.equal(compareSpeech("남자가 정류장에서 버스를 기다려요", [target]).level, "match");
});

test("허용 표현 중 가장 가까운 것과 비교한다", () => {
  const result = compareSpeech("아저씨가 사과를 먹어요", ["남자가 사과를 먹어요", "아저씨가 사과를 먹어요"]);
  assert.equal(result.level, "match");
  assert.equal(result.closest, "아저씨가 사과를 먹어요");
});

test("전혀 다른 말은 불일치", () => {
  assert.equal(compareSpeech("병원", ["사과"]).level, "mismatch");
});

test("들린 말이 없으면 인식 불가", () => {
  assert.equal(compareSpeech("", ["사과"]).level, "unclear");
  assert.equal(compareSpeech(" .. ", ["사과"]).level, "unclear");
  assert.equal(compareSpeech("사과", []).level, "unclear");
});

test("인식과 사람 판정이 어긋난 비율을 센다", () => {
  const result = summarizeSpeechAgreement([
    { success: true },
    { success: true, speech: { transcript: "사과", match: "match" } },
    { success: false, speech: { transcript: "사과", match: "match" } },
    { success: true, speech: { transcript: "수박", match: "mismatch" } },
    { success: true, speech: { transcript: "사가", match: "partial" } },
    { success: true, speech: { transcript: "사과", match: "match", disputed: true } },
    { success: true, speech: { transcript: "", match: "unclear", unclear: true } },
  ]);
  assert.deepEqual(result, { attempts: 6, comparable: 4, disagreed: 2, disputed: 1, unclear: 1 });
});

test("신뢰도가 너무 낮으면 인식 불가, 0은 값 없음으로 본다", () => {
  assert.equal(compareSpeech("사과", ["사과"], 0.1).level, "unclear");
  assert.equal(compareSpeech("사과", ["사과"], 0).level, "match");
  assert.equal(compareSpeech("사과", ["사과"], null).level, "match");
  assert.equal(compareSpeech("사과", ["사과"], 0.9).level, "match");
});
