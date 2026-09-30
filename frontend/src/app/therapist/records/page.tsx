import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/portal/empty-state";
import { RecordsAccordion, type RecordGroup } from "@/components/portal/records-accordion";
import { createClient } from "@/lib/supabase/server";
import { loadTrainingRecords, type SessionWithPatient } from "@/lib/training/records-data";
import {
  buildDateSummary,
  buildPatientSummary,
  getKstDateKey,
  getSuccessAfterRetryIds,
  groupTrials,
  type AttemptRow,
  type ContentMeta,
} from "@/lib/training/record-summary";

function getDateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function buildGroups(
  recordsByPatient: Map<string, AttemptRow[]>,
  sessions: Map<string, SessionWithPatient>,
  contents: Map<string, ContentMeta>,
  patientNames: Map<string, string>,
) {
  const todayKey = getKstDateKey(new Date());

  return Array.from(recordsByPatient.entries()).map<RecordGroup>(([patientId, patientRecords]) => {
    const trials = groupTrials(patientRecords, sessions, todayKey);
    const retriedSuccessIds = new Set(getSuccessAfterRetryIds(trials));

    const dates = new Map<string, AttemptRow[]>();
    for (const record of patientRecords) {
      const dateKey = getKstDateKey(record.created_at);
      if (!dates.has(dateKey)) dates.set(dateKey, []);
      dates.get(dateKey)!.push(record);
    }

    return {
      patientId,
      patientName: patientNames.get(patientId) ?? "이름을 확인할 수 없는 환자",
      recentDateLabel: getDateLabel(patientRecords[0].created_at),
      summary: buildPatientSummary(patientRecords, sessions, contents, todayKey),
      dates: Array.from(dates.entries()).map(([dateKey, dateRecords]) => ({
        dateKey,
        dateLabel: getDateLabel(dateRecords[0].created_at),
        summary: buildDateSummary(trials.filter((trial) => getKstDateKey(trial.firstAt) === dateKey)),
        records: dateRecords.map((record) => ({ ...record, afterRetry: retriedSuccessIds.has(record.id) })),
      })),
    };
  });
}

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { patient } = await searchParams;
  const supabase = await createClient();
  let groups: RecordGroup[] = [];

  if (supabase) {
    const { recordsByPatient, sessions, contents } = await loadTrainingRecords(supabase);
    const patientIds = Array.from(recordsByPatient.keys()).filter((id) => id !== "unknown");
    const patientsResult = patientIds.length
      ? await supabase.from("profiles").select("id,name").in("id", patientIds)
      : { data: [] };
    const patientNames = new Map((patientsResult.data ?? []).map((row) => [row.id, row.name]));
    groups = buildGroups(recordsByPatient, sessions, contents, patientNames);
  }

  return (
    <>
      <p className="eyebrow">Training records</p>
      <h1 className="mt-2 text-3xl font-bold">훈련 기록</h1>
      <p className="mt-2 text-[var(--muted)]">환자별로 어느 단계에서 얼마나 도움이 필요했는지 확인합니다.</p>

      {groups.length === 0 ? (
        <section className="card mt-8 overflow-hidden">
          <EmptyState icon={ClipboardList} title="저장된 훈련 기록이 없습니다" description="환자가 훈련을 시작하면 수행 결과와 도움 사용 여부가 이곳에 기록됩니다." />
        </section>
      ) : (
        <RecordsAccordion groups={groups} initialOpenPatientId={typeof patient === "string" ? patient : null} />
      )}
    </>
  );
}
