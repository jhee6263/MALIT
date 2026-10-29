export const DEFAULT_TEST_PASSWORD = "00000000";
// 서비스 이름이 말이음(MALIUM)으로 바뀌었지만 기존 환자 계정이 이 도메인으로 만들어져 있어 그대로 둔다.
export const PATIENT_EMAIL_DOMAIN = "patient.malit.example";

export function normalizePatientLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function isValidPatientLoginId(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,29}$/.test(normalizePatientLoginId(value));
}

export function toPatientInternalEmail(loginId: string) {
  return `${normalizePatientLoginId(loginId)}@${PATIENT_EMAIL_DOMAIN}`;
}

// 로그인 화면에 공개하는 확인용 계정. 확인용 환자는 같은 날에도 훈련을 여러 번 할 수 있다.
export const DEMO_THERAPIST_EMAIL = "therapist01@malium.com";
export const DEMO_PATIENT_LOGIN_ID = "patient01";

export function isDemoPatientEmail(email?: string | null) {
  return email === toPatientInternalEmail(DEMO_PATIENT_LOGIN_ID);
}

export function isDemoPatientLoginId(loginId?: string | null) {
  return normalizePatientLoginId(loginId ?? "") === DEMO_PATIENT_LOGIN_ID;
}

// 재활사가 담당 환자에게 쓸 수 있는 계정 관리 동작.
export type PatientAccountAction = "set_password" | "reset_password" | "suspend" | "resume" | "unlink";
export const PATIENT_PASSWORD_MIN_LENGTH = 8;

/**
 * 계정 상태와 대상에 따라 동작을 허용하는지 판단한다. 허용하지 않으면 안내할 이유를 돌려준다.
 * 로그인 화면에 공개된 확인용 환자는 자소서 등에서 쓰이므로 어떤 동작도 막는다.
 */
export function checkPatientAccountAction(
  action: PatientAccountAction,
  patient: { status: string; loginId?: string | null },
): string | null {
  if (isDemoPatientLoginId(patient.loginId)) return "로그인 화면에 공개된 확인용 계정은 변경할 수 없습니다.";
  if (action === "suspend" && patient.status !== "active") return "이용 중인 계정만 정지할 수 있습니다.";
  if (action === "resume" && patient.status !== "suspended") return "정지된 계정만 다시 사용할 수 있습니다.";
  if (action !== "resume" && action !== "unlink" && patient.status === "suspended") return "정지된 계정입니다. 먼저 다시 사용 상태로 바꿔주세요.";
  return null;
}
