import type { createClient } from "@/lib/supabase/server";
import type { AttemptRow, ContentMeta, SessionMeta } from "@/lib/training/record-summary";

type ServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;
export type SessionWithPatient = SessionMeta & { patientId: string };

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

// Supabase는 한 번에 최대 1,000행을 돌려주므로 나눠서 가져온다.
async function fetchPaged<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** 재활사 화면용 훈련 기록. 조회 범위는 RLS가 담당 환자로 제한한다. */
export async function loadTrainingRecords(supabase: ServerClient) {
  const [records, sessionRows, contentsResult, topicsResult] = await Promise.all([
    fetchPaged<AttemptRow>((from, to) => supabase
      .from("training_attempts")
      .select("id,session_id,content_id,step,target,hint_level,success,judgment_source,response_data,created_at")
      .order("created_at", { ascending: false })
      .range(from, to)),
    fetchPaged<{ id: string; patient_id: string; started_at: string; completed_at: string | null }>((from, to) => supabase
      .from("training_sessions")
      .select("id,patient_id,started_at,completed_at")
      .order("started_at", { ascending: false })
      .range(from, to)),
    supabase.from("training_contents").select("id,level,topic_id"),
    supabase.from("topics").select("id,name"),
  ]);

  const sessions = new Map<string, SessionWithPatient>(sessionRows.map((session) => [session.id, {
    patientId: session.patient_id,
    startedAt: session.started_at,
    completedAt: session.completed_at,
  }]));
  const topicNames = new Map((topicsResult.data ?? []).map((topic) => [topic.id, topic.name as string]));
  const contents = new Map<string, ContentMeta>((contentsResult.data ?? []).map((content) => [content.id, {
    level: content.level,
    topicName: content.topic_id ? topicNames.get(content.topic_id) ?? null : null,
  }]));

  const recordsByPatient = new Map<string, AttemptRow[]>();
  for (const record of records) {
    const patientId = sessions.get(record.session_id)?.patientId ?? "unknown";
    if (!recordsByPatient.has(patientId)) recordsByPatient.set(patientId, []);
    recordsByPatient.get(patientId)!.push(record);
  }

  return { recordsByPatient, sessions, contents };
}
