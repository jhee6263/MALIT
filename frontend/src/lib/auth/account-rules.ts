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
