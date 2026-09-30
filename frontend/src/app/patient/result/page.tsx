import Image from "next/image";
import Link from "next/link";
import { Check, HandHelping, Home, Play, Sparkles, Star } from "lucide-react";
import { Footer } from "@/components/footer";
import { PatientHeader } from "@/components/patient-header";
import { createClient } from "@/lib/supabase/server";
import { buildPatientDayResult, getKstDateKey, groupTrials, type AttemptRow, type PatientDayResult } from "@/lib/training/record-summary";

type SentenceCard = { contentId: string; text: string; imageUrl: string | null; imageAlt: string; independent: boolean };
type TodayResult =
  | { state: "done"; result: PatientDayResult; sentences: SentenceCard[] }
  | { state: "in_progress" }
  | { state: "none" };

async function loadTodayResult(): Promise<TodayResult> {
  const supabase = await createClient();
  if (!supabase) return { state: "none" };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { state: "none" };

  const todayKey = getKstDateKey(new Date());
  const { data: sessionRows } = await supabase
    .from("training_sessions")
    .select("id,started_at,completed_at")
    .eq("patient_id", user.id)
    .order("started_at", { ascending: false })
    .limit(10);
  const todaySessions = (sessionRows ?? []).filter((session) => getKstDateKey(session.started_at) === todayKey);
  const completed = todaySessions
    .filter((session) => session.completed_at)
    .sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!))[0];
  if (!completed) return { state: todaySessions.length ? "in_progress" : "none" };

  const { data: attemptRows } = await supabase
    .from("training_attempts")
    .select("id,session_id,content_id,step,target,hint_level,success,judgment_source,response_data,created_at")
    .eq("session_id", completed.id)
    .order("created_at", { ascending: true });
  const sessions = new Map([[completed.id, { startedAt: completed.started_at, completedAt: completed.completed_at }]]);
  const trials = groupTrials((attemptRows ?? []) as AttemptRow[], sessions, todayKey);
  const result = buildPatientDayResult(trials);

  const contentIds = result.sentences.map((sentence) => sentence.contentId);
  const { data: contents } = contentIds.length
    ? await supabase.from("training_contents").select("id,target_sentence,image_path,image_alt").in("id", contentIds)
    : { data: [] };
  const contentMap = new Map((contents ?? []).map((content) => [content.id, content]));

  return {
    state: "done",
    result,
    sentences: result.sentences.flatMap((sentence) => {
      const content = contentMap.get(sentence.contentId);
      if (!content) return [];
      return [{
        contentId: sentence.contentId,
        text: content.target_sentence,
        imageUrl: content.image_path ? supabase.storage.from("content-images").getPublicUrl(content.image_path).data.publicUrl : null,
        imageAlt: content.image_alt,
        independent: sentence.independent,
      }];
    }),
  };
}

export default async function ResultPage() {
  const today = await loadTodayResult();

  return (
    <div className="page-shell bg-[#f8f6f1]">
      <PatientHeader />
      <main className="container flex flex-1 items-center justify-center py-10">
        {today.state === "done" ? <DoneResult result={today.result} sentences={today.sentences} /> : <NotDone inProgress={today.state === "in_progress"} />}
      </main>
      <Footer />
    </div>
  );
}

function DoneResult({ result, sentences }: { result: PatientDayResult; sentences: SentenceCard[] }) {
  return (
    <section className="card card-beige w-full max-w-[760px] p-7 sm:p-10">
      <div className="text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#e5f4ed] text-[var(--mint-700)]"><Star size={40} fill="currentColor" /></div>
        <h1 className="mt-6 text-4xl font-bold">정말 잘했어요!</h1>
        <p className="mt-4 break-keep text-xl leading-9 text-[#5e6d68]">오늘 문장 {sentences.length}개를 끝까지 연습했어요.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#cfe5da] bg-[#f2faf6] p-5 text-center">
          <p className="flex items-center justify-center gap-2 text-lg font-bold text-[var(--mint-700)]"><Sparkles size={22} />혼자 해냈어요</p>
          <p className="mt-2 text-4xl font-bold">{result.independentCount}번</p>
        </div>
        <div className="rounded-2xl border border-[#ead9bd] bg-[#fffaf0] p-5 text-center">
          <p className="flex items-center justify-center gap-2 text-lg font-bold text-[#8a5a18]"><HandHelping size={22} />도움 받고 해냈어요</p>
          <p className="mt-2 text-4xl font-bold">{result.supportedCount}번</p>
        </div>
      </div>

      <p className="mt-6 break-keep rounded-2xl bg-white px-5 py-4 text-center text-xl font-bold leading-8">{result.message}<br />내일도 함께 연습해요.</p>

      {sentences.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold">오늘 연습한 문장</h2>
          <ul className="mt-4 space-y-3">
            {sentences.map((sentence) => (
              <li key={sentence.contentId} className="flex items-center gap-4 rounded-2xl border border-[#e8ddcc] bg-white p-3">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-[#f2ebdc]">
                  {sentence.imageUrl && <Image src={sentence.imageUrl} alt={sentence.imageAlt} fill className="object-cover" sizes="80px" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-keep text-xl font-bold leading-8">{sentence.text}</p>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${sentence.independent ? "bg-[#e5f4ed] text-[#216b55]" : "bg-[#fff1d9] text-[#8a5a18]"}`}>
                    {sentence.independent ? <><Check size={15} />혼자 말했어요</> : <><HandHelping size={15} />도움 받고 말했어요</>}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/patient/today" className="btn btn-primary"><Home size={19} /> 처음 화면으로</Link>
      </div>
    </section>
  );
}

function NotDone({ inProgress }: { inProgress: boolean }) {
  return (
    <section className="card card-beige w-full max-w-[620px] p-8 text-center sm:p-12">
      <h1 className="break-keep text-3xl font-bold">{inProgress ? "아직 연습이 남아 있어요" : "오늘 마친 연습이 없어요"}</h1>
      <p className="mt-4 break-keep text-xl leading-9 text-[#5e6d68]">{inProgress ? "하던 연습을 이어서 해볼까요?" : "오늘의 훈련을 시작해볼까요?"}</p>
      <Link href={inProgress ? "/patient/training" : "/patient/today"} className="btn btn-primary mt-8">
        {inProgress ? <><Play size={19} fill="currentColor" /> 이어서 하기</> : <><Home size={19} /> 오늘의 훈련으로</>}
      </Link>
    </section>
  );
}
