"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown, CircleAlert, Folder, HelpCircle, Info, Lightbulb, MessageSquareText, Minus, TrendingUp } from "lucide-react";
import {
  getStepLabel,
  type AttemptRow,
  type DateSummary,
  type PatientSummary,
  type StepKind,
  type StepStat,
  type TrendDirection,
} from "@/lib/training/record-summary";

export type TrainingRecord = AttemptRow & { afterRetry: boolean };

export type RecordGroup = {
  patientId: string;
  patientName: string;
  recentDateLabel: string;
  summary: PatientSummary;
  dates: Array<{
    dateKey: string;
    dateLabel: string;
    summary: DateSummary;
    records: TrainingRecord[];
  }>;
};

const sourceLabels: Record<string, string> = {
  self: "본인 확인",
  companion: "보호자 확인",
  therapist: "재활사 확인",
  stt: "음성 인식",
  demo: "예시 기록",
};

const kindLabels: Record<StepKind, string> = {
  keyword: "핵심어 떠올리기",
  grammar: "문법 요소 고르기",
  sentence: "전체 문장 다시 말하기",
  other: "기타",
};

const kindDescriptions: Record<StepKind, string> = {
  keyword: "도움 단계 1 범주 · 2 의미 · 3 첫소리",
  grammar: "독립 = 첫 선택에서 정답",
  sentence: "독립 = 문장 도움 없이 한 번에 성공",
  other: "",
};

function getTimeLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getHelpLabel(record: TrainingRecord) {
  if (record.response_data?.usedSentenceHelp) return "문장 도움 사용";
  if (record.hint_level > 0) return `도움 ${record.hint_level}단계 사용`;
  return "도움 없음";
}

function getResult(record: TrainingRecord) {
  if (!record.success) return { label: "다시 연습함", tone: "retry" as const };
  const errorCount = Number(record.response_data?.errorCount ?? 0);
  if (errorCount > 0) return { label: `오답 ${errorCount}회 후 성공`, tone: "assisted" as const };
  if (record.hint_level > 0 || record.response_data?.usedSentenceHelp) return { label: "도움 후 성공", tone: "assisted" as const };
  if (record.afterRetry) return { label: "다시 해서 성공", tone: "assisted" as const };
  return { label: "도움 없이 성공", tone: "success" as const };
}

export function RecordsAccordion({ groups, initialOpenPatientId = null }: { groups: RecordGroup[]; initialOpenPatientId?: string | null }) {
  const [openPatients, setOpenPatients] = useState<Record<string, boolean>>(initialOpenPatientId ? { [initialOpenPatientId]: true } : {});
  const [openDates, setOpenDates] = useState<Record<string, string | null>>({});

  function togglePatient(patientId: string) {
    setOpenPatients((current) => ({ ...current, [patientId]: !current[patientId] }));
  }

  function toggleDate(patientId: string, dateKey: string) {
    setOpenDates((current) => ({ ...current, [patientId]: current[patientId] === dateKey ? null : dateKey }));
  }

  return (
    <div className="mt-8 space-y-4">
      {groups.map((group) => {
        const patientOpen = Boolean(openPatients[group.patientId]);
        const { summary } = group;
        const patientPanelId = `patient-records-${group.patientId}`;
        return (
          <section key={group.patientId} id={`patient-${group.patientId}`} className="card scroll-mt-6 overflow-hidden">
            <button
              className={`flex w-full items-center gap-4 px-5 py-5 text-left transition hover:bg-[#f7faf8] sm:px-6 ${patientOpen ? "border-b border-[var(--line)] bg-[#f7faf8]" : "bg-white"}`}
              aria-expanded={patientOpen}
              aria-controls={patientPanelId}
              onClick={() => togglePatient(group.patientId)}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--mint-100)] text-[var(--mint-700)]"><Folder size={25} /></span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xl">{group.patientName}</strong>
                <span className="mt-1 block break-keep text-sm text-[var(--muted)]">
                  최근 훈련 {group.recentDateLabel} · 훈련 {group.dates.length}일 · 전체 문장 독립 완성 {summary.sentence.total ? `${summary.sentence.rate}%` : "기록 없음"}
                </span>
              </span>
              <ChevronDown className={`shrink-0 text-[#64716d] transition-transform ${patientOpen ? "rotate-180" : ""}`} size={24} />
            </button>

            <div id={patientPanelId} className={`grid transition-[grid-template-rows] duration-200 ${patientOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="space-y-4 bg-[#fbfcfb] p-4 sm:p-6">
                  <PatientOverview summary={summary} />

                  <h3 className="flex items-center gap-2 pt-2 text-base font-bold"><CalendarDays size={18} className="text-[var(--mint-700)]" />날짜별 상세 기록</h3>
                  {group.dates.map((date) => {
                    const dateOpen = openDates[group.patientId] === date.dateKey;
                    const datePanelId = `date-records-${group.patientId}-${date.dateKey}`;
                    return (
                      <section key={date.dateKey} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
                        <button
                          className={`flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-[#f8faf9] sm:px-5 ${dateOpen ? "border-b border-[var(--line)] bg-[#f8faf9]" : ""}`}
                          aria-expanded={dateOpen}
                          aria-controls={datePanelId}
                          onClick={() => toggleDate(group.patientId, date.dateKey)}
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef2ef] text-[var(--mint-700)]"><CalendarDays size={20} /></span>
                          <span className="min-w-0 flex-1">
                            <strong className="block text-base sm:text-lg">{date.dateLabel}</strong>
                            <span className="mt-1 block break-keep text-sm text-[var(--muted)]">
                              완성 문장 {date.summary.sentenceCount}개 · 독립 수행 {date.summary.independentCount}건 · 도움 후 수행 {date.summary.supportedCount}건 · 다시 연습 {date.summary.retryCount}회
                            </span>
                          </span>
                          <span className="hidden rounded-full bg-[#eef2ef] px-3 py-1 text-sm font-bold text-[#61706b] sm:inline">기록 {date.records.length}건</span>
                          <ChevronDown className={`shrink-0 text-[#64716d] transition-transform ${dateOpen ? "rotate-180" : ""}`} size={21} />
                        </button>

                        <div id={datePanelId} className={`grid transition-[grid-template-rows] duration-200 ${dateOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                          <div className="overflow-hidden">
                            <div className="table-wrap">
                              <table>
                                <thead><tr><th>시간</th><th>훈련 단계</th><th>연습한 말</th><th>도움 사용</th><th>수행 결과</th><th>확인 방식</th></tr></thead>
                                <tbody>
                                  {date.records.map((record) => {
                                    const resultInfo = getResult(record);
                                    const usedHelp = record.hint_level > 0 || record.response_data?.usedSentenceHelp;
                                    return (
                                      <tr key={record.id}>
                                        <td className="whitespace-nowrap text-[var(--muted)]">{getTimeLabel(record.created_at)}</td>
                                        <td className="whitespace-nowrap font-bold">{getStepLabel(record.step)}</td>
                                        <td className="min-w-36 font-semibold">{record.target}</td>
                                        <td><span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${usedHelp ? "font-bold text-[#9a641d]" : "text-[var(--muted)]"}`}><HelpCircle size={16} />{getHelpLabel(record)}</span></td>
                                        <td><ResultBadge label={resultInfo.label} tone={resultInfo.tone} /></td>
                                        <td className="whitespace-nowrap">{sourceLabels[record.judgment_source] ?? record.judgment_source}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PatientOverview({ summary }: { summary: PatientSummary }) {
  const change = summary.recentChange;
  const headlineStyles = {
    focus: { box: "border-[#ead9bd] bg-[#fffaf0]", icon: "bg-[#fff0d6] text-[#98611a]", title: "조금 더 살펴볼 부분", Icon: HelpCircle },
    strength: { box: "border-[#cfe5da] bg-[#f2faf6]", icon: "bg-[#dff1e9] text-[var(--mint-700)]", title: "안정적으로 수행하고 있어요", Icon: CheckCircle2 },
    neutral: { box: "border-[var(--line)] bg-white", icon: "bg-[#eef2ef] text-[#61706b]", title: "기록 요약", Icon: Info },
  }[summary.headlineTone];
  const stepsByKind = (["keyword", "grammar", "sentence", "other"] as const)
    .map((kind) => ({ kind, steps: summary.steps.filter((step) => step.kind === kind) }))
    .filter((section) => section.steps.length > 0);

  return (
    <>
      <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${headlineStyles.box}`}>
        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${headlineStyles.icon}`}><headlineStyles.Icon size={18} /></span>
        <div>
          <p className="font-bold">{headlineStyles.title}</p>
          <p className="mt-1 break-keep leading-7">{summary.headline}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="전체 문장 독립 완성"
          value={summary.sentence.total ? `${summary.sentence.rate}%` : "기록 없음"}
          description={summary.sentence.total ? `${summary.sentence.total}문장 중 ${summary.sentence.independent}문장을 도움 없이 한 번에` : "전체 문장 단계 기록이 없습니다"}
        />
        <SummaryCard
          label="핵심어 평균 도움 단계"
          value={summary.keywordCue.average === null ? "기록 없음" : `${summary.keywordCue.average.toFixed(1)} / 3`}
          description={summary.keywordCue.total ? `첫소리 단서까지 필요 ${summary.keywordCue.maxCueRate}% · 0은 도움 없음` : "핵심어 단계 기록이 없습니다"}
        />
        <SummaryCard
          label="최근 변화"
          value={change.status === "ready" ? `${change.previousRate}% → ${change.recentRate}%` : "기록이 더 필요합니다"}
          valueIcon={change.status === "ready" ? <TrendBadge direction={change.direction} /> : null}
          description={change.status === "ready"
            ? `${change.message}${change.recentCue !== null && change.previousCue !== null ? ` 핵심어 도움 단계 ${change.previousCue.toFixed(1)} → ${change.recentCue.toFixed(1)}` : ""}`
            : change.message}
        />
      </div>

      {summary.steps.length > 0 && (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold"><TrendingUp size={18} className="text-[var(--mint-700)]" />단계별 도움 의존도</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">재시도를 포함해 한 번의 훈련 기회로 계산합니다.</p>
            </div>
            <Legend />
          </div>
          <div className="mt-4 space-y-5">
            {stepsByKind.map((section) => (
              <div key={section.kind}>
                <p className="text-sm font-bold text-[#4f5d59]">{kindLabels[section.kind]} <span className="font-normal text-[var(--muted)]">· {kindDescriptions[section.kind]}</span></p>
                <div className="mt-2 space-y-2.5">
                  {section.steps.map((step) => <StepRow key={step.step} step={step} focus={step.step === summary.focusStep} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {summary.insights.length > 0 && (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-base font-bold"><Lightbulb size={18} className="text-[var(--mint-700)]" />관찰 메모</h3>
          <ul className="mt-3 space-y-2">
            {summary.insights.map((insight) => (
              <li key={insight.text} className="flex items-start gap-2 break-keep text-sm leading-6">
                <span className={`mt-2 size-2 shrink-0 rounded-full ${insight.tone === "focus" ? "bg-[#d99a3d]" : "bg-[var(--mint-500)]"}`} />
                {insight.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(summary.byLevel.length > 0 || summary.sources.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {summary.byLevel.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
              <h3 className="text-base font-bold">레벨·주제별 전체 문장 독립 완성</h3>
              <div className="mt-3 divide-y divide-[var(--line)]">
                {[{ title: "레벨별", items: summary.byLevel }, { title: "주제별", items: summary.byTopic }]
                  .filter((part) => part.items.length > 0)
                  .map((part) => (
                    <div key={part.title} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-xs font-bold text-[var(--muted)]">{part.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {part.items.map((item) => (
                          <span key={item.label} className="rounded-full bg-[#f1f5f3] px-3 py-1.5 text-sm">
                            <strong>{item.label}</strong> <span className="text-[var(--muted)]">{item.independent}/{item.total}문장</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
          {summary.sources.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
              <h3 className="flex items-center gap-2 text-base font-bold"><MessageSquareText size={18} className="text-[var(--mint-700)]" />발화 확인 방식</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.sources.map((item) => (
                  <span key={item.source} className="rounded-full bg-[#f1f5f3] px-3 py-1.5 text-sm">
                    <strong>{sourceLabels[item.source] ?? item.source}</strong> <span className="text-[var(--muted)]">{item.count}건</span>
                  </span>
                ))}
              </div>
              {isMostlySelfChecked(summary) && (
                <p className="mt-3 break-keep text-sm leading-6 text-[#8a5a18]">본인 확인 기록이 절반 이상입니다. 재활사·보호자 확인 기록과 함께 해석해주세요.</p>
              )}
            </section>
          )}
        </div>
      )}

      <p className="break-keep text-xs leading-5 text-[var(--muted)]">
        앱 내 훈련 기록을 기준으로 한 요약입니다. 임상 평가나 일상 의사소통 능력을 뜻하지 않습니다.
        {summary.inProgressTrials > 0 && ` 오늘 진행 중인 훈련 기회 ${summary.inProgressTrials}건은 요약에서 제외했습니다.`}
      </p>
    </>
  );
}

function isMostlySelfChecked(summary: PatientSummary) {
  const total = summary.sources.reduce((sum, item) => sum + item.count, 0);
  const self = summary.sources.find((item) => item.source === "self")?.count ?? 0;
  return total > 0 && self / total > 0.5;
}

function StepRow({ step, focus }: { step: StepStat; focus: boolean }) {
  const width = (count: number) => `${(count / step.total) * 100}%`;
  return (
    <div className={`grid items-center gap-x-4 gap-y-1.5 rounded-xl px-3 py-2 sm:grid-cols-[13rem_1fr_16rem] ${focus ? "bg-[#fffaf0] ring-1 ring-[#ead9bd]" : ""}`}>
      <span className="flex items-center gap-2 whitespace-nowrap text-sm font-bold">
        {step.label.split(" · ").at(-1)}
        {focus && <span className="whitespace-nowrap rounded-full bg-[#fff0d6] px-2 py-0.5 text-xs text-[#98611a]">가장 도움 필요</span>}
      </span>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-[#eef2ef]" role="img" aria-label={`독립 ${step.independent}건, 도움 후 ${step.supported}건, 미완료 ${step.incomplete}건`}>
        <span className="bg-[var(--mint-500)]" style={{ width: width(step.independent) }} />
        <span className="bg-[#e3b262]" style={{ width: width(step.supported) }} />
        <span className="bg-[#c3cbc8]" style={{ width: width(step.incomplete) }} />
      </div>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)] sm:justify-end">
        <span><strong className="text-[var(--ink)]">독립 {step.independentRate}%</strong> · {step.total}회</span>
        {step.averageCue !== null && <span>도움 단계 {step.averageCue.toFixed(1)}</span>}
        {step.trend && <TrendBadge direction={step.trend} compact />}
      </span>
    </div>
  );
}

function Legend() {
  const items = [
    { label: "독립", color: "bg-[var(--mint-500)]" },
    { label: "도움·재시도 후", color: "bg-[#e3b262]" },
    { label: "미완료", color: "bg-[#c3cbc8]" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
      {items.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${item.color}`} />{item.label}</span>)}
    </div>
  );
}

function TrendBadge({ direction, compact = false }: { direction: TrendDirection; compact?: boolean }) {
  const config = {
    up: { label: compact ? "최근 독립↑" : "독립 수행 증가", style: "bg-[#e5f4ed] text-[#216b55]", Icon: ArrowUpRight },
    down: { label: compact ? "최근 도움↑" : "도움 증가", style: "bg-[#fff1d9] text-[#8a5a18]", Icon: ArrowDownRight },
    flat: { label: "비슷함", style: "bg-[#eef2ef] text-[#61706b]", Icon: Minus },
  }[direction];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${config.style}`}><config.Icon size={13} />{config.label}</span>;
}

function SummaryCard({ label, value, valueIcon, description }: { label: string; value: string; valueIcon?: React.ReactNode; description?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-2 flex flex-wrap items-center gap-2 break-keep text-xl font-bold">{value}{valueIcon}</p>
      {description && <p className="mt-1.5 break-keep text-xs leading-5 text-[var(--muted)]">{description}</p>}
    </div>
  );
}

function ResultBadge({ label, tone }: { label: string; tone: "success" | "assisted" | "retry" }) {
  const styles = {
    success: "bg-[#e5f4ed] text-[#216b55]",
    assisted: "bg-[#fff1d9] text-[#8a5a18]",
    retry: "bg-[#fde8e8] text-[#a44343]",
  };
  const Icon = tone === "success" ? CheckCircle2 : tone === "assisted" ? HelpCircle : CircleAlert;
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold ${styles[tone]}`}><Icon size={16} />{label}</span>;
}
