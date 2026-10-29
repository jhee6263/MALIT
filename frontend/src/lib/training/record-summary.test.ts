import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPatientSummary, groupTrials, type AttemptRow } from "./record-summary.ts";

let seq = 0;
function attempt(over: Partial<AttemptRow>): AttemptRow {
  seq += 1;
  return {
    id: `a${seq}`, session_id: "s1", content_id: "c1", step: "keyword:subject", target: "여자",
    hint_level: 0, success: true, judgment_source: "self", response_data: null,
    created_at: new Date(Date.UTC(2026, 9, 1, 0, seq)).toISOString(), ...over,
  };
}
const sessions = new Map([["s1", { startedAt: "2026-10-01T00:00:00Z", completedAt: "2026-10-01T01:00:00Z" }]]);

test("정답을 보여준 뒤 따라 말해 성공하면 독립 수행이 아니라 도움 후 수행이다", () => {
  const trials = groupTrials([attempt({ hint_level: 4 })], sessions, "2026-10-02");
  assert.equal(trials[0].outcome, "supported");
  assert.equal(trials[0].cueLevel, 4);
});

test("정답 제시 비율과 평균 도움 단계에 반영된다", () => {
  const records = [
    attempt({ content_id: "c1", hint_level: 4 }),
    attempt({ content_id: "c2", hint_level: 3 }),
    attempt({ content_id: "c3", hint_level: 0 }),
    attempt({ content_id: "c4", hint_level: 0 }),
  ];
  const summary = buildPatientSummary(records, sessions, new Map(), "2026-10-02");
  assert.equal(summary.keywordCue.total, 4);
  assert.equal(summary.keywordCue.answerShownRate, 25);
  assert.equal(summary.keywordCue.maxCueRate, 50);
  assert.equal(summary.keywordCue.average, 1.8);
});
