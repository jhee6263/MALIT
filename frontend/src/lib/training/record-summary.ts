// 재활사용 훈련 기록 요약 계산.
// 개별 로그가 아니라 "훈련 기회(trial)" 단위로 묶어 계산한다.
// 한 기회 = 같은 세션·콘텐츠·단계에서 성공이 나올 때까지의 연속 로그.
// 앱 내 훈련 기록 기반 요약이며 임상 평가 지표가 아니다.

export type AttemptResponseData = {
  errorCount?: number;
  firstChoice?: string;
  finalChoice?: string;
  usedSentenceHelp?: boolean;
  confirmation?: "success" | "retry";
};

export type AttemptRow = {
  id: string;
  session_id: string;
  content_id: string;
  step: string;
  target: string;
  hint_level: number;
  success: boolean;
  judgment_source: string;
  response_data: AttemptResponseData | null;
  created_at: string;
};

export type SessionMeta = { startedAt: string; completedAt: string | null };
export type ContentMeta = { level: number; topicName: string | null };

export type StepKind = "keyword" | "grammar" | "sentence" | "other";
export type TrialOutcome = "independent" | "supported" | "incomplete" | "in_progress";
export type TrendDirection = "up" | "down" | "flat";

export type Trial = {
  sessionId: string;
  contentId: string;
  step: string;
  kind: StepKind;
  outcome: TrialOutcome;
  /** 기회 안에서 사용한 가장 높은 도움 단계. 핵심어: 1 범주 · 2 의미 · 3 첫소리, 문장: 1 문장 도움 */
  cueLevel: number;
  retryCount: number;
  grammarErrors: number;
  source: string;
  firstAt: number;
  attemptIds: string[];
};

// 판단 기준. 실제 환자 검증 전의 잠정 값이다.
export const SUMMARY_RULES = {
  windowSessions: 3, // 최근 N회 vs 이전 N회
  minSessionsPerWindow: 2,
  minTrialsForTrend: 5,
  minTrialsForStep: 3,
  minTrialsForHeadline: 10,
  overallTrendPoints: 10, // 전체 독립 수행 비율 변화 기준(%p)
  stepTrendPoints: 20, // 단계별 변화 기준(%p). 표본이 작아 더 보수적으로 본다.
  cueTrendLevels: 0.3,
  maxKeywordCue: 3,
  recentDays: 7, // 중단된 훈련·미훈련 판단 기간
} as const;

const roleLabels: Record<string, string> = {
  subject: "주어",
  object: "목적어",
  location: "장소",
  verb: "동작",
};

const grammarLabels: Record<string, string> = {
  subject_particle: "주격 조사",
  object_particle: "목적격 조사",
  location_particle: "장소 조사",
  verb_ending: "동사 활용",
};

const STEP_ORDER = [
  "keyword:subject",
  "keyword:object",
  "keyword:location",
  "keyword:verb",
  "grammar:subject_particle",
  "grammar:object_particle",
  "grammar:location_particle",
  "grammar:verb_ending",
  "sentence:full",
];

const NOUN_ROLES = new Set(["keyword:subject", "keyword:object", "keyword:location"]);

export function getStepLabel(step: string) {
  const [kind, detail] = step.split(":");
  if (kind === "keyword") return `핵심어 · ${roleLabels[detail] ?? detail}`;
  if (kind === "grammar") return `문법 · ${grammarLabels[detail] ?? detail}`;
  if (step === "sentence:full") return "전체 문장";
  return step;
}

export function getShortStepLabel(step: string) {
  const [kind, detail] = step.split(":");
  if (kind === "keyword") return roleLabels[detail] ?? detail;
  if (kind === "grammar") return grammarLabels[detail] ?? detail;
  if (step === "sentence:full") return "전체 문장";
  return step;
}

function getStepKind(step: string): StepKind {
  const kind = step.split(":")[0];
  return kind === "keyword" || kind === "grammar" || kind === "sentence" ? kind : "other";
}

export function getKstDateKey(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function toTrial(bucket: AttemptRow[], pendingOutcome: TrialOutcome): Trial {
  const last = bucket[bucket.length - 1];
  const retryCount = bucket.filter((record) => !record.success).length;
  const cueLevel = Math.max(0, ...bucket.map((record) => record.hint_level));
  const grammarErrors = last.success ? Number(last.response_data?.errorCount ?? 0) : 0;
  const usedSentenceHelp = bucket.some((record) => record.response_data?.usedSentenceHelp);
  const independent = retryCount === 0 && cueLevel === 0 && grammarErrors === 0 && !usedSentenceHelp;
  return {
    sessionId: last.session_id,
    contentId: last.content_id,
    step: last.step,
    kind: getStepKind(last.step),
    outcome: last.success ? (independent ? "independent" : "supported") : pendingOutcome,
    cueLevel,
    retryCount,
    grammarErrors,
    source: last.judgment_source,
    firstAt: Date.parse(bucket[0].created_at),
    attemptIds: bucket.map((record) => record.id),
  };
}

/**
 * 로그를 훈련 기회 단위로 묶는다.
 * 실패 후 재시도해 성공하면 기회 하나로 계산하고,
 * 성공 없이 끝난 기회는 오늘 진행 중인 세션이면 in_progress, 아니면 incomplete로 본다.
 */
export function groupTrials(records: AttemptRow[], sessions: Map<string, SessionMeta>, todayKey: string) {
  const sorted = [...records].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const open = new Map<string, AttemptRow[]>();
  const trials: Trial[] = [];

  for (const record of sorted) {
    const key = `${record.session_id}|${record.content_id}|${record.step}`;
    const bucket = open.get(key) ?? [];
    bucket.push(record);
    if (record.success) {
      trials.push(toTrial(bucket, "supported"));
      open.delete(key);
    } else {
      open.set(key, bucket);
    }
  }

  for (const bucket of open.values()) {
    const session = sessions.get(bucket[0].session_id);
    const sessionDate = getKstDateKey(session?.startedAt ?? bucket[0].created_at);
    const inProgress = !session?.completedAt && sessionDate === todayKey;
    trials.push(toTrial(bucket, inProgress ? "in_progress" : "incomplete"));
  }

  return trials.sort((a, b) => a.firstAt - b.firstAt);
}

/** 이전 실패 후 성공한 로그 id. 상세 로그에서 "다시 해서 성공"을 표시할 때 쓴다. */
export function getSuccessAfterRetryIds(trials: Trial[]) {
  const ids: string[] = [];
  for (const trial of trials) {
    if (trial.retryCount > 0 && (trial.outcome === "supported" || trial.outcome === "independent")) {
      ids.push(trial.attemptIds[trial.attemptIds.length - 1]);
    }
  }
  return ids;
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function independentRate(trials: Trial[]) {
  return percent(trials.filter((trial) => trial.outcome === "independent").length, trials.length);
}

function averageKeywordCue(trials: Trial[]) {
  return average(trials.filter((trial) => trial.kind === "keyword" && trial.outcome !== "incomplete").map((trial) => trial.cueLevel));
}

function round1(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

export type StepStat = {
  step: string;
  label: string;
  kind: StepKind;
  total: number;
  independent: number;
  supported: number;
  incomplete: number;
  independentRate: number;
  /** 핵심어 단계만: 평균 도움 단계 */
  averageCue: number | null;
  trend: TrendDirection | null;
};

export type RecentChange =
  | { status: "insufficient"; message: string }
  | {
      status: "ready";
      direction: TrendDirection;
      recentSessions: number;
      previousSessions: number;
      recentRate: number;
      previousRate: number;
      recentCue: number | null;
      previousCue: number | null;
      cueDirection: TrendDirection | null;
      message: string;
    };

export type Insight = { tone: "focus" | "strength"; text: string };

export type PatientSummary = {
  evaluableTrials: number;
  inProgressTrials: number;
  headline: string;
  headlineTone: "focus" | "strength" | "neutral";
  focusStep: string | null;
  sentence: { total: number; independent: number; rate: number };
  keywordCue: { average: number | null; maxCueRate: number; total: number };
  recentChange: RecentChange;
  steps: StepStat[];
  insights: Insight[];
  byLevel: Array<{ label: string; total: number; independent: number }>;
  byTopic: Array<{ label: string; total: number; independent: number }>;
  sources: Array<{ source: string; count: number }>;
  /** 재활사가 살펴볼 이유. 비어 있으면 특이사항 없음. */
  reviewReasons: string[];
};

function splitWindows(trials: Trial[]) {
  const sessionTimes = new Map<string, number>();
  for (const trial of trials) {
    const current = sessionTimes.get(trial.sessionId);
    if (current === undefined || trial.firstAt < current) sessionTimes.set(trial.sessionId, trial.firstAt);
  }
  const ordered = Array.from(sessionTimes.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const size = SUMMARY_RULES.windowSessions;
  return {
    recent: new Set(ordered.slice(0, size)),
    previous: new Set(ordered.slice(size, size * 2)),
  };
}

function windowsReady(windows: ReturnType<typeof splitWindows>) {
  return windows.recent.size >= SUMMARY_RULES.minSessionsPerWindow && windows.previous.size >= SUMMARY_RULES.minSessionsPerWindow;
}

function compareRate(recent: number, previous: number, threshold: number): TrendDirection {
  if (recent - previous >= threshold) return "up";
  if (previous - recent >= threshold) return "down";
  return "flat";
}

function buildRecentChange(trials: Trial[], windows: ReturnType<typeof splitWindows>): RecentChange {
  if (!windowsReady(windows)) {
    return { status: "insufficient", message: `비교하려면 훈련이 ${SUMMARY_RULES.minSessionsPerWindow * 2}회 이상 필요합니다.` };
  }
  const recent = trials.filter((trial) => windows.recent.has(trial.sessionId));
  const previous = trials.filter((trial) => windows.previous.has(trial.sessionId));
  if (recent.length < SUMMARY_RULES.minTrialsForTrend || previous.length < SUMMARY_RULES.minTrialsForTrend) {
    return { status: "insufficient", message: "비교할 기록이 더 필요합니다." };
  }

  const recentRate = independentRate(recent);
  const previousRate = independentRate(previous);
  const direction = compareRate(recentRate, previousRate, SUMMARY_RULES.overallTrendPoints);

  const recentKeywords = recent.filter((trial) => trial.kind === "keyword");
  const previousKeywords = previous.filter((trial) => trial.kind === "keyword");
  const cueComparable = recentKeywords.length >= SUMMARY_RULES.minTrialsForTrend && previousKeywords.length >= SUMMARY_RULES.minTrialsForTrend;
  const recentCue = cueComparable ? round1(averageKeywordCue(recentKeywords)) : null;
  const previousCue = cueComparable ? round1(averageKeywordCue(previousKeywords)) : null;
  let cueDirection: TrendDirection | null = null;
  if (recentCue !== null && previousCue !== null) {
    // 단서 단계는 낮아질수록 좋아진 것이므로 "up"을 개선으로 맞춘다.
    cueDirection = compareRate(previousCue, recentCue, SUMMARY_RULES.cueTrendLevels);
  }

  const range = `최근 ${windows.recent.size}회와 이전 ${windows.previous.size}회 비교`;
  const message = direction === "up"
    ? `${range}: 도움 없이 수행한 비율이 늘었습니다.`
    : direction === "down"
      ? `${range}: 도움이 조금 더 필요했습니다.`
      : `${range}: 도움 없이 수행한 비율이 비슷합니다.`;

  return {
    status: "ready",
    direction,
    recentSessions: windows.recent.size,
    previousSessions: windows.previous.size,
    recentRate,
    previousRate,
    recentCue,
    previousCue,
    cueDirection,
    message,
  };
}

function buildStepStats(trials: Trial[], windows: ReturnType<typeof splitWindows>) {
  const bySteps = new Map<string, Trial[]>();
  for (const trial of trials) {
    if (!bySteps.has(trial.step)) bySteps.set(trial.step, []);
    bySteps.get(trial.step)!.push(trial);
  }
  const steps = [
    ...STEP_ORDER.filter((step) => bySteps.has(step)),
    ...Array.from(bySteps.keys()).filter((step) => !STEP_ORDER.includes(step)).sort(),
  ];
  const trendReady = windowsReady(windows);

  return steps.map<StepStat>((step) => {
    const stepTrials = bySteps.get(step)!;
    const independent = stepTrials.filter((trial) => trial.outcome === "independent").length;
    const incomplete = stepTrials.filter((trial) => trial.outcome === "incomplete").length;
    const kind = getStepKind(step);

    let trend: TrendDirection | null = null;
    if (trendReady) {
      const resolved = stepTrials.filter((trial) => trial.outcome !== "incomplete");
      const recent = resolved.filter((trial) => windows.recent.has(trial.sessionId));
      const previous = resolved.filter((trial) => windows.previous.has(trial.sessionId));
      if (recent.length >= SUMMARY_RULES.minTrialsForTrend && previous.length >= SUMMARY_RULES.minTrialsForTrend) {
        trend = compareRate(independentRate(recent), independentRate(previous), SUMMARY_RULES.stepTrendPoints);
      }
    }

    return {
      step,
      label: getStepLabel(step),
      kind,
      total: stepTrials.length,
      independent,
      supported: stepTrials.length - independent - incomplete,
      incomplete,
      independentRate: percent(independent, stepTrials.length),
      averageCue: kind === "keyword" ? round1(averageKeywordCue(stepTrials)) : null,
      trend,
    };
  });
}

function findFocusStep(steps: StepStat[]) {
  return steps
    .filter((step) => step.total >= SUMMARY_RULES.minTrialsForStep && step.independent < step.total)
    .sort((a, b) => a.independentRate - b.independentRate || (b.averageCue ?? 0) - (a.averageCue ?? 0) || b.total - a.total)[0] ?? null;
}

function buildInsights(trials: Trial[], steps: StepStat[]) {
  const insights: Insight[] = [];

  // 어휘 인출과 문장 결합의 차이: 같은 문장에서 핵심어는 모두 혼자 떠올렸지만 전체 문장에는 도움이 필요했는지.
  const items = new Map<string, Trial[]>();
  for (const trial of trials) {
    const key = `${trial.sessionId}|${trial.contentId}`;
    if (!items.has(key)) items.set(key, []);
    items.get(key)!.push(trial);
  }
  let keywordIndependentItems = 0;
  let gapItems = 0;
  let keywordSupportedItems = 0;
  let sentenceStrongItems = 0;
  for (const itemTrials of items.values()) {
    const sentence = itemTrials.filter((trial) => trial.step === "sentence:full").at(-1);
    const keywords = itemTrials.filter((trial) => trial.kind === "keyword");
    if (!sentence || sentence.outcome === "incomplete" || keywords.length === 0) continue;
    const keywordsIndependent = keywords.every((trial) => trial.outcome === "independent");
    if (keywordsIndependent) {
      keywordIndependentItems += 1;
      if (sentence.outcome !== "independent") gapItems += 1;
    } else {
      keywordSupportedItems += 1;
      if (sentence.outcome === "independent") sentenceStrongItems += 1;
    }
  }
  if (keywordIndependentItems >= SUMMARY_RULES.minTrialsForStep && gapItems / keywordIndependentItems >= 0.5) {
    insights.push({
      tone: "focus",
      text: `핵심어를 모두 혼자 떠올린 문장 ${keywordIndependentItems}개 중 ${gapItems}개에서 전체 문장을 이어 말할 때 도움이 필요했습니다. 단어를 문장으로 연결하는 연습을 더 살펴보세요.`,
    });
  } else if (keywordIndependentItems >= SUMMARY_RULES.minTrialsForStep && gapItems === 0) {
    insights.push({ tone: "strength", text: "핵심어를 혼자 떠올린 문장은 전체 문장까지 도움 없이 이어 말했습니다." });
  }
  if (keywordSupportedItems >= SUMMARY_RULES.minTrialsForStep && sentenceStrongItems / keywordSupportedItems >= 0.5) {
    insights.push({ tone: "strength", text: "핵심어에 도움을 받은 문장도 절반 이상은 전체 문장을 도움 없이 다시 말했습니다." });
  }

  // 명사(주어·목적어·장소)와 동작어의 단서 필요 정도 비교.
  const nounTrials = trials.filter((trial) => NOUN_ROLES.has(trial.step) && trial.outcome !== "incomplete");
  const verbTrials = trials.filter((trial) => trial.step === "keyword:verb" && trial.outcome !== "incomplete");
  if (nounTrials.length >= SUMMARY_RULES.minTrialsForTrend && verbTrials.length >= SUMMARY_RULES.minTrialsForTrend) {
    const nounCue = averageKeywordCue(nounTrials) ?? 0;
    const verbCue = averageKeywordCue(verbTrials) ?? 0;
    const detail = `평균 도움 단계 명사 ${nounCue.toFixed(1)} · 동작어 ${verbCue.toFixed(1)}`;
    if (verbCue - nounCue >= 0.5) insights.push({ tone: "focus", text: `명사보다 동작어를 떠올릴 때 단서가 더 필요합니다 (${detail}).` });
    else if (nounCue - verbCue >= 0.5) insights.push({ tone: "focus", text: `동작어보다 명사를 떠올릴 때 단서가 더 필요합니다 (${detail}).` });
  }

  // 문법 요소 중 상대적으로 어려운 요소.
  const grammarSteps = steps.filter((step) => step.kind === "grammar" && step.total >= SUMMARY_RULES.minTrialsForStep);
  if (grammarSteps.length >= 2) {
    const hardest = [...grammarSteps].sort((a, b) => a.independentRate - b.independentRate)[0];
    const others = grammarSteps.filter((step) => step !== hardest);
    const othersTotal = others.reduce((sum, step) => sum + step.total, 0);
    const othersRate = percent(others.reduce((sum, step) => sum + step.independent, 0), othersTotal);
    if (othersRate - hardest.independentRate >= 20) {
      insights.push({
        tone: "focus",
        text: `다른 문법 요소보다 ${getShortStepLabel(hardest.step)}에서 도움이 더 필요합니다 (첫 선택 정답 ${hardest.independentRate}%, 다른 요소 ${othersRate}%).`,
      });
    }
  }

  return insights;
}

function groupRate(trials: Trial[], getLabel: (trial: Trial) => string | null) {
  const groups = new Map<string, { total: number; independent: number }>();
  for (const trial of trials) {
    const label = getLabel(trial);
    if (!label) continue;
    const current = groups.get(label) ?? { total: 0, independent: 0 };
    current.total += 1;
    if (trial.outcome === "independent") current.independent += 1;
    groups.set(label, current);
  }
  return Array.from(groups.entries()).map(([label, value]) => ({ label, ...value }));
}

export function buildPatientSummary(
  records: AttemptRow[],
  sessions: Map<string, SessionMeta>,
  contents: Map<string, ContentMeta>,
  todayKey: string,
): PatientSummary {
  const allTrials = groupTrials(records, sessions, todayKey);
  const trials = allTrials.filter((trial) => trial.outcome !== "in_progress");
  // 최근 변화는 끝까지 수행한 기회만으로 비교한다. 중도 종료는 능력 외 이유일 수 있어 추세에 섞지 않는다.
  const resolvedTrials = trials.filter((trial) => trial.outcome !== "incomplete");
  const windows = splitWindows(resolvedTrials);
  const steps = buildStepStats(trials, windows);
  const focus = findFocusStep(steps);

  const sentenceTrials = trials.filter((trial) => trial.step === "sentence:full");
  const sentenceIndependent = sentenceTrials.filter((trial) => trial.outcome === "independent").length;
  const keywordTrials = trials.filter((trial) => trial.kind === "keyword" && trial.outcome !== "incomplete");

  let headline: string;
  let headlineTone: PatientSummary["headlineTone"] = "neutral";
  if (trials.length === 0) {
    headline = "아직 요약할 수 있는 훈련 기록이 없습니다.";
  } else if (trials.length < SUMMARY_RULES.minTrialsForHeadline) {
    headline = `훈련 기회 ${trials.length}건이 기록됐습니다. 기록이 더 쌓이면 경향을 요약합니다.`;
  } else if (!focus) {
    headline = "기록된 단계 대부분을 도움 없이 수행하고 있습니다.";
    headlineTone = "strength";
  } else {
    headline = `${focus.label} 단계에서 도움이 가장 많이 필요합니다.`;
    headlineTone = "focus";
  }

  const recentChange = buildRecentChange(resolvedTrials, windows);
  const reviewReasons: string[] = [];
  if (recentChange.status === "ready" && recentChange.direction === "down") reviewReasons.push("최근 훈련에서 도움이 더 필요했습니다");
  for (const step of steps.filter((item) => item.trend === "down")) reviewReasons.push(`${step.label}에서 도움 증가`);
  const weekStart = Date.parse(`${todayKey}T00:00:00+09:00`) - (SUMMARY_RULES.recentDays - 1) * 86_400_000;
  const recentIncomplete = trials.filter((trial) => trial.outcome === "incomplete" && trial.firstAt >= weekStart).length;
  if (recentIncomplete > 0) reviewReasons.push(`최근 ${SUMMARY_RULES.recentDays}일 중단된 훈련 기회 ${recentIncomplete}건`);

  const sourceCounts = new Map<string, number>();
  for (const trial of trials) sourceCounts.set(trial.source, (sourceCounts.get(trial.source) ?? 0) + 1);

  return {
    evaluableTrials: trials.length,
    inProgressTrials: allTrials.length - trials.length,
    headline,
    headlineTone,
    focusStep: focus?.step ?? null,
    sentence: { total: sentenceTrials.length, independent: sentenceIndependent, rate: percent(sentenceIndependent, sentenceTrials.length) },
    keywordCue: {
      average: round1(averageKeywordCue(keywordTrials)),
      maxCueRate: percent(keywordTrials.filter((trial) => trial.cueLevel >= SUMMARY_RULES.maxKeywordCue).length, keywordTrials.length),
      total: keywordTrials.length,
    },
    recentChange,
    steps,
    insights: trials.length >= SUMMARY_RULES.minTrialsForHeadline ? buildInsights(trials, steps) : [],
    byLevel: groupRate(sentenceTrials, (trial) => {
      const level = contents.get(trial.contentId)?.level;
      return level ? `Level ${level}` : null;
    }).sort((a, b) => a.label.localeCompare(b.label)),
    byTopic: groupRate(sentenceTrials, (trial) => contents.get(trial.contentId)?.topicName ?? null).sort((a, b) => b.total - a.total),
    sources: Array.from(sourceCounts.entries()).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    reviewReasons,
  };
}

// 환자 결과 화면용. 임상 용어나 비율 없이 "혼자 해낸 것 / 도움 받고 해낸 것"만 센다.
export type PatientDayResult = {
  independentCount: number;
  supportedCount: number;
  sentences: Array<{ contentId: string; independent: boolean }>;
  message: string;
};

export function buildPatientDayResult(trials: Trial[]): PatientDayResult {
  const resolved = trials.filter((trial) => trial.outcome === "independent" || trial.outcome === "supported");
  const independentCount = resolved.filter((trial) => trial.outcome === "independent").length;
  const supportedCount = resolved.length - independentCount;

  const sentenceByContent = new Map<string, boolean>();
  for (const trial of resolved) {
    if (trial.step === "sentence:full") sentenceByContent.set(trial.contentId, trial.outcome === "independent");
  }

  const ratio = resolved.length ? independentCount / resolved.length : 0;
  const message = ratio >= 0.7
    ? "오늘은 혼자서 해낸 부분이 많았어요."
    : ratio >= 0.4
      ? "혼자 해낸 것도, 도움을 받아 해낸 것도 모두 좋은 연습이에요."
      : "어려운 부분도 도움을 받으며 끝까지 해냈어요.";

  return {
    independentCount,
    supportedCount,
    sentences: Array.from(sentenceByContent.entries()).map(([contentId, independent]) => ({ contentId, independent })),
    message,
  };
}

export type DateSummary ={ sentenceCount: number; independentCount: number; supportedCount: number; retryCount: number };

export function buildDateSummary(trials: Trial[]): DateSummary {
  return {
    sentenceCount: trials.filter((trial) => trial.step === "sentence:full" && (trial.outcome === "independent" || trial.outcome === "supported")).length,
    independentCount: trials.filter((trial) => trial.outcome === "independent").length,
    supportedCount: trials.filter((trial) => trial.outcome === "supported").length,
    retryCount: trials.reduce((sum, trial) => sum + trial.retryCount, 0),
  };
}
