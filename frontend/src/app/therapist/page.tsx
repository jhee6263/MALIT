import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, UserRoundPlus, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/portal/empty-state";
import { StatCard } from "@/components/portal/stat-card";
import { createClient } from "@/lib/supabase/server";
import { loadTrainingRecords } from "@/lib/training/records-data";
import { buildPatientSummary, getKstDateKey, SUMMARY_RULES } from "@/lib/training/record-summary";

type TodayStatus = "completed" | "in_progress" | "not_started";

const todayLabels: Record<TodayStatus, { label: string; style: string }> = {
  completed: { label: "완료", style: "bg-[#e5f4ed] text-[#216b55]" },
  in_progress: { label: "진행 중", style: "bg-[#fff1d9] text-[#8a5a18]" },
  not_started: { label: "시작 전", style: "bg-[#eef2ef] text-[#61706b]" },
};

function daysBetween(fromKey: string, toKey: string) {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86_400_000);
}

function getDateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(new Date(value));
}

export default async function TherapistDashboard() {
  const supabase = await createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const profileResult = user && supabase ? await supabase.from("profiles").select("name").eq("id", user.id).single() : { data: null };
  const linksResult = user && supabase ? await supabase.from("therapist_patient_links").select("patient_id").eq("therapist_id", user.id) : { data: [] };
  const patientIds = (linksResult.data ?? []).map((link) => link.patient_id);
  const [patientsResult, trainingData] = patientIds.length && supabase
    ? await Promise.all([
        supabase.from("profiles").select("id,name,status,created_at").in("id", patientIds),
        loadTrainingRecords(supabase),
      ])
    : [{ data: [] }, null];

  const todayKey = getKstDateKey(new Date());
  const patientSessions = new Map<string, Array<{ startedAt: string; completedAt: string | null }>>();
  for (const session of trainingData?.sessions.values() ?? []) {
    if (!patientSessions.has(session.patientId)) patientSessions.set(session.patientId, []);
    patientSessions.get(session.patientId)!.push(session);
  }

  const rows = (patientsResult.data ?? []).map((patient) => {
    const sessions = (patientSessions.get(patient.id) ?? []).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    const todaySessions = sessions.filter((session) => getKstDateKey(session.startedAt) === todayKey);
    const todayStatus: TodayStatus = todaySessions.some((session) => session.completedAt)
      ? "completed"
      : todaySessions.length ? "in_progress" : "not_started";
    const lastStartedAt = sessions[0]?.startedAt ?? null;
    const idleDays = daysBetween(getKstDateKey(lastStartedAt ?? patient.created_at), todayKey);
    const inactive = patient.status === "active" && idleDays >= SUMMARY_RULES.recentDays;

    const records = trainingData?.recordsByPatient.get(patient.id) ?? [];
    const summary = records.length && trainingData
      ? buildPatientSummary(records, trainingData.sessions, trainingData.contents, todayKey)
      : null;
    const reasons = summary?.reviewReasons ?? [];

    return { patient, todayStatus, lastStartedAt, idleDays, inactive, summary, reasons };
  }).sort((a, b) => b.reasons.length - a.reasons.length || Number(b.inactive) - Number(a.inactive) || a.patient.name.localeCompare(b.patient.name, "ko"));

  const trainedToday = rows.filter((row) => row.todayStatus !== "not_started").length;
  const completedToday = rows.filter((row) => row.todayStatus === "completed").length;
  const inactiveCount = rows.filter((row) => row.inactive).length;
  const reviewCount = rows.filter((row) => row.reasons.length > 0).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Therapist dashboard</p>
          <h1 className="mt-2 text-3xl font-bold">{profileResult.data?.name ? `${profileResult.data.name} 재활사님` : "재활사 대시보드"}</h1>
          <p className="mt-2 text-[var(--muted)]">담당 환자의 오늘 훈련과 살펴볼 점을 확인합니다.</p>
        </div>
        <Link href="/therapist/patients/new" className="btn btn-primary">새 환자 등록</Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="담당 환자" value={`${rows.length}명`} detail="연결된 환자 기준" icon={UsersRound} />
        <StatCard label="오늘 완료" value={`${completedToday}명`} detail={`오늘 훈련을 시작한 환자 ${trainedToday}명`} icon={CheckCircle2} />
        <StatCard label={`${SUMMARY_RULES.recentDays}일 이상 미훈련`} value={`${inactiveCount}명`} detail="마지막 훈련일(없으면 등록일) 기준" icon={Clock3} tone="orange" />
        <StatCard label="살펴볼 환자" value={`${reviewCount}명`} detail="도움 증가 또는 중단된 훈련 기준" icon={AlertCircle} tone="orange" />
      </section>

      <section className="card mt-7 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] p-6">
          <h2 className="text-xl font-bold">담당 환자</h2>
          <Link href="/therapist/patients" className="font-bold text-[var(--mint-700)]">전체 보기</Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={UsersRound} title="등록된 환자가 없습니다" description="환자를 등록하면 이곳에서 훈련 현황을 확인할 수 있습니다." action={<Link className="btn btn-primary" href="/therapist/patients/new"><UserRoundPlus size={18} /> 환자 등록</Link>} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>환자</th><th>최근 훈련</th><th>오늘</th><th>살펴볼 점</th><th>기록</th></tr></thead>
              <tbody>
                {rows.map(({ patient, todayStatus, lastStartedAt, idleDays, inactive, summary, reasons }) => (
                  <tr key={patient.id}>
                    <td className="font-bold">{patient.name}{patient.status !== "active" && <span className="ml-2 text-sm font-normal text-[var(--muted)]">({patient.status})</span>}</td>
                    <td className={inactive ? "font-bold text-[var(--warning)]" : ""}>
                      {lastStartedAt ? `${getDateLabel(lastStartedAt)}${idleDays > 0 ? ` · ${idleDays}일 전` : ""}` : "훈련 기록 없음"}
                    </td>
                    <td><span className={`rounded-full px-3 py-1 text-sm font-bold ${todayLabels[todayStatus].style}`}>{todayLabels[todayStatus].label}</span></td>
                    <td className="min-w-72 whitespace-normal break-keep text-sm leading-6">
                      {reasons.length > 0
                        ? <span className="font-bold text-[#8a5a18]">{reasons.join(" · ")}</span>
                        : <span className="text-[var(--muted)]">{summary ? summary.headline : "아직 기록이 없습니다."}</span>}
                    </td>
                    <td>
                      {summary && (
                        <Link className="inline-flex items-center gap-1 font-bold text-[var(--mint-700)]" href={`/therapist/records?patient=${patient.id}#patient-${patient.id}`}>
                          기록 보기 <ChevronRight size={16} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
