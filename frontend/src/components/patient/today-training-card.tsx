"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarX2, LoaderCircle, Play, RefreshCw, Star } from "lucide-react";
import { EmptyState } from "@/components/portal/empty-state";

type DailyPlanResponse = {
  planId: string | null;
  itemCount: number;
  reason?: string | null;
  message?: string;
  error?: string;
  sessionStatus?: "completed" | "in_progress" | "not_started";
};

export function TodayTrainingCard() {
  const [requestKey, setRequestKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DailyPlanResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/training/daily-plan", { method: "POST", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "오늘의 훈련을 준비하지 못했습니다.");
        setResult(body);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestKey]);

  // 페이지 안내 문구도 훈련 상태에 맞춘다. 완료한 날에는 또 훈련할 수 있는 것처럼 보이지 않게 한다.
  const completed = result?.sessionStatus === "completed";
  const subtitle = loading ? "" : completed ? "오늘 연습을 모두 마쳤어요. 정말 잘하셨어요!" : "오늘 준비된 훈련을 확인해보세요.";
  return (
    <>
      <p className="mb-8 mt-3 min-h-7 text-lg text-[#6a736f]">{subtitle}</p>
      <TodayTrainingBody loading={loading} error={error} result={result} onRetry={() => { setLoading(true); setError(""); setResult(null); setRequestKey((value) => value + 1); }} />
    </>
  );
}

function TodayTrainingBody({ loading, error, result, onRetry }: { loading: boolean; error: string; result: DailyPlanResponse | null; onRetry: () => void }) {
  if (loading) {
    return <div className="card card-beige flex min-h-52 items-center justify-center gap-3 text-[var(--muted)]"><LoaderCircle className="animate-spin" /> 오늘의 훈련을 준비하고 있어요.</div>;
  }

  if (error) {
    return <div className="card card-beige"><EmptyState icon={CalendarX2} title="훈련을 불러오지 못했어요" description={error} action={<button className="btn btn-secondary" onClick={onRetry}><RefreshCw size={18} /> 다시 시도</button>} /></div>;
  }

  if (!result?.planId || result.itemCount === 0) {
    return <div className="card card-beige"><EmptyState icon={CalendarX2} title="오늘 준비된 훈련이 없습니다" description={result?.message ?? "훈련 콘텐츠를 준비하고 있습니다."} /></div>;
  }

  if (result.sessionStatus === "completed") {
    return (
      <>
        <div className="card card-beige p-7 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#e5f4ed] text-[var(--mint-700)]"><Star size={32} fill="currentColor" /></span>
          <strong className="mt-4 block text-2xl">오늘 훈련 완료!</strong>
          <p className="mt-3 break-keep text-lg text-[var(--muted)]">문장 {result.itemCount}개를 끝까지 연습했어요. 내일 다시 만나요 😊</p>
        </div>
        <Link className="btn btn-primary mt-8 w-full" href="/patient/result"><Star size={19} /> 오늘 결과 보기</Link>
      </>
    );
  }

  const inProgress = result.sessionStatus === "in_progress";
  return (
    <>
      <div className="card card-beige p-7">
        <p className="text-sm font-bold text-[#6d7672]">오늘의 훈련</p>
        <strong className="mt-3 block text-2xl">문장 {result.itemCount}개</strong>
        {inProgress
          ? <p className="mt-3 break-keep text-[var(--muted)]">하던 연습이 남아 있어요. 이어서 해볼까요?</p>
          : result.reason && <p className="mt-3 break-keep text-[var(--muted)]">{result.reason}</p>}
      </div>
      <Link className="btn btn-primary mt-8 w-full" href="/patient/training"><Play size={19} fill="currentColor" /> {inProgress ? "이어서 하기" : "오늘의 훈련 시작"}</Link>
    </>
  );
}
