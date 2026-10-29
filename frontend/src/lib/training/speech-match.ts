// 음성인식 결과와 목표 표현의 비교.
// 인식 결과는 사람이 확인할 때 참고하는 보조 정보이며, 이 함수의 결과로 성공·실패를 확정하지 않는다.
// 앱 내 참고용 값이며 임상 평가 지표가 아니다.

export type MatchLevel = "match" | "partial" | "mismatch" | "unclear";

export type SpeechMatch = {
  level: MatchLevel;
  /** 0~1. 자모 단위 유사도 중 가장 높은 값 */
  similarity: number;
  /** 가장 가까웠던 목표 표현 (원문) */
  closest: string | null;
};

/** 훈련 기록(response_data.speech)에 남기는 음성인식 정보. 판정 주체는 항상 사람이다. */
export type SpeechRecord = {
  engine: "web-speech";
  transcript: string;
  confidence: number | null;
  match: MatchLevel;
  similarity: number;
  closest: string | null;
  firstSpeechMs: number | null;
  /** "앱이 잘 못 들었어요"를 누른 경우 */
  disputed?: boolean;
  /** 인식이 어려워 사람이 직접 확인한 경우 */
  unclear?: boolean;
  /** 브라우저가 알려준 오류 코드 (마이크 거부 등) */
  error?: string | null;
};

export type SpeechAgreement = {
  /** 음성인식을 켜고 시도한 기록 수 */
  attempts: number;
  /** 글자가 얻어져 사람 판정과 견줄 수 있는 기록 수 (인식 어려움·"앱이 잘 못 들었어요" 제외) */
  comparable: number;
  /** 인식이 "일치"인데 사람은 실패로, 또는 인식이 "불일치"인데 사람은 성공으로 본 기록 수 */
  disagreed: number;
  /** "앱이 잘 못 들었어요"를 누른 기록 수 */
  disputed: number;
  /** 인식이 어려워 사람이 직접 확인한 기록 수 */
  unclear: number;
};

/** 기록의 음성인식 정보와 사람 판정이 얼마나 어긋났는지 센다. 부분 일치는 어느 쪽으로도 세지 않는다. */
export function summarizeSpeechAgreement(
  records: Array<{ success: boolean; speech?: Partial<SpeechRecord> | null }>,
): SpeechAgreement {
  const result: SpeechAgreement = { attempts: 0, comparable: 0, disagreed: 0, disputed: 0, unclear: 0 };
  for (const { success, speech } of records) {
    if (!speech) continue;
    result.attempts += 1;
    if (speech.disputed) {
      result.disputed += 1;
      continue;
    }
    if (speech.unclear || !speech.transcript || speech.match === "unclear") {
      result.unclear += 1;
      continue;
    }
    result.comparable += 1;
    if ((speech.match === "match" && !success) || (speech.match === "mismatch" && success)) result.disagreed += 1;
  }
  return result;
}

// 판단 기준. 실제 환자 발화로 검증하기 전의 잠정 값이다.
export const SPEECH_MATCH_RULES = {
  matchSimilarity: 0.85,
  partialSimilarity: 0.55,
  // 이 값 미만의 인식 신뢰도는 "확인 어려움"으로 본다. 0은 브라우저가 값을 주지 않은 것으로 보고 무시한다.
  minConfidence: 0.3,
  // 목표가 이 길이 이상일 때만 "목표가 말 안에 들어 있으면 일치"로 본다. 한 글자 낱말이 다른 말에 섞여 일치로 잡히는 것을 막는다.
  minContainLength: 2,
} as const;

/** 띄어쓰기·문장부호·대소문자 차이를 없앤다. 한글 자모(받침 포함)와 글자·숫자만 남긴다. */
export function normalizeSpeechText(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** 띄어쓰기 기준 어절. 인식기의 띄어쓰기는 믿지 않으므로 비교할 때는 띄어쓰기를 뺀 글자에서 찾는다. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).map(normalizeSpeechText).filter((word) => word.length > 0);
}

// 한글 음절을 초성·중성·종성으로 풀어 비교하면 받침 하나 차이를 "조금 다름"으로 계산할 수 있다.
function toJamo(text: string): string {
  return text.normalize("NFD");
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

export function jamoSimilarity(heard: string, target: string): number {
  const a = toJamo(normalizeSpeechText(heard));
  const b = toJamo(normalizeSpeechText(target));
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 0;
  return 1 - editDistance(a, b) / longest;
}

/**
 * 들린 말을 목표 표현(들)과 비교한다.
 * - 아무것도 들리지 않았거나 인식 신뢰도가 너무 낮으면 "unclear"
 * - 목표가 말 안에 그대로 들어 있거나 유사도가 높으면 "match"
 * - 일부만 맞으면 "partial", 많이 다르면 "mismatch"
 */
export function compareSpeech(heard: string, targets: string[], confidence?: number | null): SpeechMatch {
  const normalizedHeard = normalizeSpeechText(heard);
  const usableTargets = targets.filter((target) => normalizeSpeechText(target).length > 0);
  if (normalizedHeard.length === 0 || usableTargets.length === 0) {
    return { level: "unclear", similarity: 0, closest: null };
  }

  let best = { similarity: 0, closest: usableTargets[0], contained: false };
  for (const target of usableTargets) {
    const normalizedTarget = normalizeSpeechText(target);
    const contained = normalizedTarget.length >= SPEECH_MATCH_RULES.minContainLength && normalizedHeard.includes(normalizedTarget);
    const similarity = contained ? 1 : jamoSimilarity(heard, target);
    if (similarity > best.similarity) best = { similarity, closest: target, contained };
  }

  const lowConfidence = typeof confidence === "number"
    && confidence > 0
    && confidence < SPEECH_MATCH_RULES.minConfidence;
  if (lowConfidence) return { level: "unclear", similarity: best.similarity, closest: best.closest };

  // 긴 문장에서는 낱말 하나만 바꿔 말해도 전체 유사도가 높게 나온다("버스를" → "책을").
  // 가장 가까운 목표의 어절이 하나라도 들리지 않았으면 "일치"로 보지 않고 "일부 일치"에 머문다.
  const missingWord = !best.contained && wordsOf(best.closest).some((word) => !normalizedHeard.includes(word));
  const level: MatchLevel = best.similarity >= SPEECH_MATCH_RULES.matchSimilarity && !missingWord
    ? "match"
    : best.similarity >= SPEECH_MATCH_RULES.partialSimilarity
      ? "partial"
      : "mismatch";
  return { level, similarity: Math.round(best.similarity * 1000) / 1000, closest: best.closest };
}
