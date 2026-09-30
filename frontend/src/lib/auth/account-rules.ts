export const DEFAULT_TEST_PASSWORD = "00000000";
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
