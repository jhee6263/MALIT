import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPatientAccountAction, isDemoPatientLoginId } from "./account-rules.ts";

test("확인용 환자는 모든 동작이 막힌다", () => {
  assert.ok(isDemoPatientLoginId(" Patient01 "));
  for (const action of ["set_password", "reset_password", "suspend", "resume", "unlink"] as const) {
    assert.ok(checkPatientAccountAction(action, { status: "active", loginId: "patient01" }), action);
  }
  assert.equal(isDemoPatientLoginId("patient02"), false);
});

test("정지는 활성 계정만, 재개는 정지 계정만", () => {
  assert.equal(checkPatientAccountAction("suspend", { status: "active", loginId: "kim" }), null);
  assert.ok(checkPatientAccountAction("suspend", { status: "suspended", loginId: "kim" }));
  assert.equal(checkPatientAccountAction("resume", { status: "suspended", loginId: "kim" }), null);
  assert.ok(checkPatientAccountAction("resume", { status: "active", loginId: "kim" }));
});

test("정지된 계정은 비밀번호를 바꾸지 못하지만 연결 해제는 할 수 있다", () => {
  assert.ok(checkPatientAccountAction("set_password", { status: "suspended", loginId: "kim" }));
  assert.equal(checkPatientAccountAction("unlink", { status: "suspended", loginId: "kim" }), null);
  assert.equal(checkPatientAccountAction("set_password", { status: "active", loginId: "kim" }), null);
});
