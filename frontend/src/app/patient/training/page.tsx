"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, HelpCircle, LoaderCircle, Mic, RotateCcw, Stethoscope, UserRound, UsersRound } from "lucide-react";
import { Footer } from "@/components/footer";
import { PatientHeader } from "@/components/patient-header";

type Keyword = { role: string; question: string; answer: string; hints: string[] };
type GrammarChoice = { value: string; preview: string };
type GrammarTarget = { slot: string; base?: string; stem?: string; dictionaryForm?: string; answer: string; completed?: string; choices: GrammarChoice[]; explanation?: string };
type SentencePart = { role: string; word?: string; base?: string; surface?: string };
type TrainingItem = {
  id: string;
  itemOrder: number;
  itemType: "new" | "review" | "focus";
  content: {
    id: string;
    title: string;
    level: number;
    topic: string;
    imageUrl: string | null;
    imageAlt: string;
    targetSentence: string;
    sentenceStructure: SentencePart[];
    keywords: Keyword[];
    grammarTargets: GrammarTarget[];
  };
};
type TrainingStep =
  | { kind: "observe" }
  | { kind: "keyword"; index: number }
  | { kind: "sentence" }
  | { kind: "grammar"; index: number }
  | { kind: "review" };
type VerificationSource = "self" | "companion" | "therapist";
type HintRecord = { type: string; level: number };

const roleLabels: Record<string, string> = {
  subject: "주어",
  object: "목적어",
  verb: "동작",
  location: "장소",
};

export default function TrainingPage() {
  const router = useRouter();
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState("");
  const [grammarChoices, setGrammarChoices] = useState<string[]>([]);
  const [verificationSource, setVerificationSource] = useState<VerificationSource | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishPending, setFinishPending] = useState(false);
  // 마지막 문장을 마친 뒤 결과 화면으로 넘어가는 동안 추가 입력을 받지 않는다(완료된 세션에 저장 시도 방지).
  const [leaving, setLeaving] = useState(false);
  // 응답을 받지 못해 다시 누른 경우 같은 eventId를 보내 서버에서 중복 저장을 막는다.
  const pendingEvent = useRef<{ key: string; id: string } | null>(null);
  const requestInFlight = useRef(false);
  // 단계가 바뀐 직후의 연타가 같은 자리의 다음 단계 버튼을 누르지 않도록 잠깐 입력을 막는다.
  const [stepSettling, setStepSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/training/today", { signal: controller.signal })
      .then(async (planResponse) => {
        const planBody = await planResponse.json();
        if (!planResponse.ok) throw new Error(planBody.error ?? "오늘의 훈련을 불러오지 못했습니다.");
        const sessionResponse = await fetch("/api/training/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: planBody.plan.id }),
          signal: controller.signal,
        });
        const sessionBody = await sessionResponse.json();
        if (!sessionResponse.ok) throw new Error(sessionBody.error ?? "훈련을 시작하지 못했습니다.");
        setItems(planBody.items);
        setSessionId(sessionBody.id);
        setCurrentItemIndex(Math.min(sessionBody.sentence_count ?? 0, Math.max(planBody.items.length - 1, 0)));
        const savedSource = window.sessionStorage.getItem(`malium-verification-${sessionBody.id}`);
        if (savedSource === "self" || savedSource === "companion" || savedSource === "therapist") {
          setVerificationSource(savedSource);
        }
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const currentItem = items[currentItemIndex];
  const steps = useMemo<TrainingStep[]>(() => {
    if (!currentItem) return [];
    return [
      { kind: "observe" },
      ...currentItem.content.keywords.map((_, index) => ({ kind: "keyword" as const, index })),
      { kind: "sentence" },
      ...currentItem.content.grammarTargets.map((_, index) => ({ kind: "grammar" as const, index })),
      { kind: "review" },
    ];
  }, [currentItem]);
  const currentStep = steps[stepIndex];

  function settleStep() {
    setStepSettling(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setStepSettling(false), 400);
  }

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  function moveToNextStep() {
    settleStep();
    setHintCount(0);
    setSelectedChoice("");
    setGrammarChoices([]);
    setAwaitingConfirmation(false);
    setActionError("");
    setStepIndex((value) => Math.min(value + 1, steps.length - 1));
  }

  function chooseVerificationSource(source: VerificationSource) {
    setVerificationSource(source);
    window.sessionStorage.setItem(`malium-verification-${sessionId}`, source);
  }

  async function saveAttempt({
    step,
    target,
    hintLevel,
    success,
    responseData,
    hints = [],
  }: {
    step: string;
    target: string;
    hintLevel: number;
    success: boolean;
    responseData: Record<string, unknown>;
    hints?: HintRecord[];
  }) {
    if (!verificationSource || !sessionId || !currentItem || requestInFlight.current) return false;
    requestInFlight.current = true;
    setSavingAttempt(true);
    setActionError("");
    const payload = {
      sessionId,
      contentId: currentItem.content.id,
      step,
      target,
      hintLevel,
      success,
      source: verificationSource,
      responseData,
      hints,
    };
    const key = JSON.stringify(payload);
    if (pendingEvent.current?.key !== key) pendingEvent.current = { key, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/training/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: pendingEvent.current.id, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) {
        setActionError(body.error ?? "훈련 기록을 저장하지 못했습니다.");
        return false;
      }
      pendingEvent.current = null;
      return true;
    } catch {
      setActionError("훈련 기록을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      return false;
    } finally {
      requestInFlight.current = false;
      setSavingAttempt(false);
    }
  }

  function keywordHintRecords(count: number): HintRecord[] {
    const types = ["category", "semantic", "phonological", "target"];
    return Array.from({ length: count }, (_, index) => ({ type: types[index] ?? "additional", level: index + 1 }));
  }

  async function confirmKeyword(keyword: Keyword, success: boolean) {
    const saved = await saveAttempt({
      step: `keyword:${keyword.role}`,
      target: keyword.answer,
      hintLevel: hintCount,
      success,
      responseData: { question: keyword.question, confirmation: success ? "success" : "retry" },
      hints: keywordHintRecords(hintCount),
    });
    if (!saved) return;
    setAwaitingConfirmation(false);
    if (success) moveToNextStep();
  }

  function selectGrammarChoice(choice: string) {
    setSelectedChoice(choice);
    setGrammarChoices((current) => [...current, choice]);
    setActionError("");
  }

  async function confirmGrammar(grammar: GrammarTarget) {
    const saved = await saveAttempt({
      step: `grammar:${grammar.slot}`,
      target: grammar.completed ?? grammar.answer,
      hintLevel: 0,
      success: true,
      responseData: {
        firstChoice: grammarChoices[0] ?? selectedChoice,
        finalChoice: selectedChoice,
        answer: grammar.answer,
        errorCount: grammarChoices.filter((choice) => choice !== grammar.answer).length,
        choices: grammarChoices,
      },
    });
    if (saved) moveToNextStep();
  }

  async function confirmFullSentence(success: boolean) {
    if (!currentItem) return;
    const saved = await saveAttempt({
      step: "sentence:full",
      target: currentItem.content.targetSentence,
      hintLevel: hintCount,
      success,
      responseData: { usedSentenceHelp: hintCount > 0, confirmation: success ? "success" : "retry" },
      hints: hintCount > 0 ? [{ type: "sentence_model", level: 1 }] : [],
    });
    if (!saved) return;
    setAwaitingConfirmation(false);
    if (success) await finishSentence();
  }

  async function finishSentence() {
    if (!sessionId || saving) return;
    setSaving(true);
    setActionError("");
    const completedCount = currentItemIndex + 1;
    const isLast = completedCount >= items.length;
    try {
      const response = await fetch("/api/training/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sentenceCount: completedCount, completed: isLast }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
    } catch (reason) {
      // 문장 기록은 이미 저장됐으므로 진행 위치 저장만 다시 시도하게 한다.
      setFinishPending(true);
      setActionError(reason instanceof Error && reason.message ? reason.message : "진행 상황을 저장하지 못했어요. 다시 시도해주세요.");
      return;
    } finally {
      setSaving(false);
    }
    setFinishPending(false);
    if (isLast) {
      setLeaving(true);
      router.push("/patient/result");
      return;
    }
    settleStep();
    setCurrentItemIndex((value) => value + 1);
    setStepIndex(0);
    setHintCount(0);
    setSelectedChoice("");
    setGrammarChoices([]);
    setAwaitingConfirmation(false);
    setActionError("");
  }

  if (leaving) {
    return <div className="page-shell bg-[#f8f6f1]"><PatientHeader /><main className="flex flex-1 items-center justify-center"><LoaderCircle className="animate-spin text-[var(--mint-700)]" size={38} /><span className="ml-3 text-lg font-bold">오늘 결과를 준비하고 있어요.</span></main><Footer /></div>;
  }

  if (loading) {
    return <div className="page-shell bg-[#f8f6f1]"><PatientHeader training /><main className="flex flex-1 items-center justify-center"><LoaderCircle className="animate-spin text-[var(--mint-700)]" size={38} /><span className="ml-3 text-lg font-bold">훈련을 불러오고 있어요.</span></main><Footer /></div>;
  }

  if (error || !currentItem || !currentStep) {
    return <div className="page-shell bg-[#f8f6f1]"><PatientHeader /><main className="container flex flex-1 items-center justify-center py-10"><section className="card card-beige max-w-xl p-10 text-center"><h1 className="text-2xl font-bold">훈련을 시작하지 못했어요</h1><p className="mt-4 break-keep text-[var(--muted)]">{error || "오늘 배정된 문장을 찾지 못했습니다."}</p><Link className="btn btn-secondary mt-7" href="/patient/today">오늘의 훈련으로 돌아가기</Link></section></main><Footer /></div>;
  }

  if (!verificationSource) {
    return (
      <div className="page-shell bg-[#f8f6f1]">
        <PatientHeader training />
        <main className="container flex flex-1 items-center justify-center py-8">
          <section className="card card-beige w-full max-w-3xl p-7 text-center sm:p-10">
            <StepLabel>훈련 확인 방법</StepLabel>
            <h1 className="mt-5 break-keep text-3xl font-bold">오늘 누가 발화를 확인하나요?</h1>
            <p className="mt-3 break-keep text-lg leading-8 text-[var(--muted)]">말한 내용을 들은 사람이 버튼을 눌러 확인해요.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <VerificationButton icon={<UserRound size={32} />} title="혼자 연습해요" description="내가 직접 확인해요" onClick={() => chooseVerificationSource("self")} />
              <VerificationButton icon={<UsersRound size={32} />} title="보호자와 함께해요" description="옆의 보호자가 확인해요" onClick={() => chooseVerificationSource("companion")} />
              <VerificationButton icon={<Stethoscope size={32} />} title="재활사와 함께해요" description="재활사가 확인해요" onClick={() => chooseVerificationSource("therapist")} />
            </div>
            <p className="mt-6 break-keep text-sm text-[var(--muted)]">보호자는 별도 계정 없이 옆에서 확인 버튼만 눌러주면 됩니다.</p>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  const { content } = currentItem;
  return (
    <div className="page-shell bg-[#f8f6f1]">
      <PatientHeader training step={`문장 ${currentItemIndex + 1} / ${items.length}`} currentStep={currentItemIndex + 1} totalSteps={items.length} />
      <main className="grid flex-1 lg:grid-cols-2">
        <section className="relative flex min-h-[360px] items-center justify-center bg-[#f2ebdc] p-6 sm:p-8 lg:min-h-0">
          {content.imageUrl ? (
            <div className="relative aspect-[4/3] w-full max-w-[700px] overflow-hidden rounded-3xl bg-white shadow-sm">
              <Image src={content.imageUrl} alt={content.imageAlt} fill priority className="object-contain" sizes="(max-width: 1024px) 100vw, 50vw" />
            </div>
          ) : (
            <div className="rounded-2xl bg-white/70 p-8 text-center text-[var(--muted)]">훈련 이미지를 불러오지 못했습니다.</div>
          )}
        </section>

        <section className="flex min-h-[500px] items-center bg-[#fffdf8] px-7 py-8 sm:px-12 lg:min-h-0 lg:px-14 lg:py-6">
          <div className="mx-auto w-full max-w-xl">
            {actionError && <div role="alert" className="mb-5 rounded-xl border border-[#df8f8f] bg-[#fff5f5] px-4 py-3 text-center font-bold text-[var(--danger)]">{actionError}</div>}
            {currentStep.kind === "observe" && (
              <>
                <StepLabel>상황 살펴보기</StepLabel>
                <h1 className="mt-7 break-keep text-3xl font-bold leading-tight">그림을 천천히 살펴보세요.</h1>
                <p className="mt-5 break-keep text-xl leading-9 text-[var(--muted)]">그림 속에 무슨 일이 일어나고 있는지 자세히 살펴보세요.</p>
                <Notice>누가, 무엇을, 어떻게 하는지 생각하며 보세요.</Notice>
                <button className="btn btn-primary mt-9 w-full" disabled={stepSettling} onClick={moveToNextStep}>준비됐어요</button>
              </>
            )}

            {currentStep.kind === "keyword" && (() => {
              const keyword = content.keywords[currentStep.index];
              const visibleHints = keyword.hints.slice(0, hintCount);
              return (
                <>
                  <StepLabel>핵심어 인출 · {roleLabels[keyword.role] ?? "핵심어"}</StepLabel>
                  <h1 className="mt-7 break-keep text-3xl font-bold">{keyword.question}</h1>
                  <p className="mt-4 break-keep text-lg leading-8 text-[var(--muted)]">그림을 보고 천천히 말해보세요.</p>
                  {visibleHints.length > 0 && <div className="mt-6 space-y-2 rounded-2xl bg-[#f2eee5] p-5">{visibleHints.map((hint) => <p key={hint} className="break-keep font-bold text-[#5f6764]">{hint}</p>)}</div>}
                  {!awaitingConfirmation ? (
                    <>
                      <button className="mx-auto mt-8 flex size-28 items-center justify-center rounded-full bg-[#2c9a83] text-white shadow-sm" aria-label="말했어요" disabled={savingAttempt || stepSettling} onClick={() => setAwaitingConfirmation(true)}><Mic size={43} /></button>
                      <p className="mt-3 text-center font-bold">말했어요</p>
                      <div className="mt-7 flex justify-center"><button className="btn btn-secondary min-h-12" disabled={hintCount >= keyword.hints.length || savingAttempt || stepSettling} onClick={() => setHintCount((value) => Math.min(value + 1, keyword.hints.length))}><HelpCircle size={18} /> 도움이 필요해요</button></div>
                    </>
                  ) : (
                    <ManualConfirmation source={verificationSource} saving={savingAttempt} onSuccess={() => confirmKeyword(keyword, true)} onRetry={() => confirmKeyword(keyword, false)} />
                  )}
                </>
              );
            })()}

            {currentStep.kind === "sentence" && (
              <>
                <StepLabel>문장 만들기</StepLabel>
                <h1 className="mt-7 break-keep text-3xl font-bold">단어를 연결해 말해볼게요.</h1>
                <div className="mt-7 flex flex-wrap justify-center gap-3 rounded-2xl bg-[#f2eee5] p-6">
                  {content.keywords.map((keyword) => <span key={`${keyword.role}-${keyword.answer}`} className="rounded-xl bg-white px-5 py-3 text-xl font-bold shadow-sm">{keyword.answer}</span>)}
                </div>
                <button className="btn btn-primary mt-9 w-full" disabled={stepSettling} onClick={moveToNextStep}>시작하기</button>
              </>
            )}

            {currentStep.kind === "grammar" && (() => {
              const grammar = content.grammarTargets[currentStep.index];
              const correct = selectedChoice === grammar.answer;
              const selected = grammar.choices.find((choice) => choice.value === selectedChoice);
              const displayBase = grammar.dictionaryForm ?? grammar.base ?? grammar.stem;
              return (
                <>
                  <StepLabel>문법 완성</StepLabel>
                  <h1 className="mt-5 break-keep text-3xl font-bold">빈칸에 들어갈 말을 골라보세요.</h1>
                  <div className={`mt-5 rounded-3xl border-2 p-5 transition sm:p-6 ${!selectedChoice ? "border-[#ded8cd] bg-[#fffaf2]" : correct ? "border-[#83c6a9] bg-[#f1fbf6]" : "border-[#df8f8f] bg-[#fff5f5]"}`}>
                    <div className="text-center">
                      <div className="flex flex-wrap items-center justify-center gap-3 text-2xl font-bold sm:text-3xl">
                        <span>{displayBase}</span><span className="text-[var(--muted)]">+</span><span className="inline-flex min-w-20 justify-center border-b-4 border-[#80908a] px-3 text-[var(--mint-700)]">{selectedChoice || "?"}</span>
                      </div>
                      {selected && <><div className="my-2 text-2xl text-[var(--muted)]">↓</div><p className="text-3xl font-bold">{selected.preview}</p></>}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {grammar.choices.map((choice) => <button key={choice.value} className={`btn grammar-choice flex-col ${selectedChoice === choice.value ? correct ? "btn-primary" : "btn-danger" : "btn-secondary"}`} disabled={savingAttempt || stepSettling} onClick={() => selectGrammarChoice(choice.value)}><span className="text-xl leading-none">{choice.value}</span><span className="text-sm font-semibold leading-tight opacity-85">{choice.preview}</span></button>)}
                    </div>
                    {selectedChoice && <div className={`mt-4 text-center font-bold ${correct ? "text-[var(--mint-700)]" : "text-[var(--danger)]"}`}><p>{correct ? <><Check className="mr-1 inline" size={19} />잘 골랐어요!</> : "한 번 더 생각해볼까요?"}</p>{correct && <GrammarExplanation grammar={grammar} />}</div>}
                  </div>
                  <button className="btn btn-primary mt-5 w-full" disabled={!correct || savingAttempt} onClick={() => confirmGrammar(grammar)}>{savingAttempt ? "저장 중…" : "다음"}</button>
                </>
              );
            })()}

            {currentStep.kind === "review" && (
              <>
                <StepLabel>전체 문장 말하기</StepLabel>
                <h1 className="mt-7 break-keep text-3xl font-bold">전체 문장을 다시 말해볼게요.</h1>
                <p className="mt-4 break-keep text-lg leading-8 text-[var(--muted)]">그림만 보고 처음부터 끝까지 천천히 말해보세요.</p>
                {hintCount > 0 && <div className="mt-7 rounded-2xl bg-[#f2eee5] p-6 text-center text-2xl font-bold">{content.targetSentence}</div>}
                {finishPending ? (
                  <button className="btn btn-primary mt-9 w-full" disabled={saving} onClick={finishSentence}>{saving ? "저장 중…" : "다시 시도하기"}</button>
                ) : !awaitingConfirmation ? (
                  <>
                    <button className="btn btn-primary mt-9 w-full" disabled={saving || savingAttempt || stepSettling} onClick={() => setAwaitingConfirmation(true)}>문장을 말했어요</button>
                    <div className="mt-4 flex justify-center"><button className="btn btn-secondary min-h-12" disabled={hintCount > 0 || savingAttempt} onClick={() => setHintCount(1)}><RotateCcw size={18} /> 문장 도움 보기</button></div>
                  </>
                ) : (
                  <ManualConfirmation source={verificationSource} saving={savingAttempt || saving} onSuccess={() => confirmFullSentence(true)} onRetry={() => confirmFullSentence(false)} />
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 text-sm font-bold text-[#5c6864]"><span className="h-7 w-1 rounded-full bg-[#2c9a83]" />{children}</div>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mt-7 flex items-center gap-3 rounded-2xl bg-[#f2eee5] p-5 font-bold text-[#59645f]"><HelpCircle className="shrink-0 text-[#2c9a83]" size={20} /> <span className="break-keep">{children}</span></div>;
}

function VerificationButton({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button className="rounded-2xl border-2 border-[#c9d9d2] bg-white px-4 py-6 transition hover:border-[#66ad92] hover:bg-[#f2faf6] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2c9a83]" onClick={onClick}>
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#e2f2eb] text-[var(--mint-700)]">{icon}</span>
      <strong className="mt-4 block break-keep text-lg">{title}</strong>
      <span className="mt-1 block break-keep text-sm text-[var(--muted)]">{description}</span>
    </button>
  );
}

function ManualConfirmation({ source, saving, onSuccess, onRetry }: { source: VerificationSource; saving: boolean; onSuccess: () => void; onRetry: () => void }) {
  const sourceLabels: Record<VerificationSource, string> = {
    self: "본인이 확인해요",
    companion: "보호자가 확인해요",
    therapist: "재활사가 확인해요",
  };
  return (
    <div className="mt-7 rounded-2xl border border-[#c9d9d2] bg-[#f4faf7] p-5 text-center">
      <p className="text-sm font-bold text-[var(--mint-700)]">{sourceLabels[source]}</p>
      <p className="mt-2 break-keep text-xl font-bold">목표한 말을 잘 말했나요?</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="btn btn-secondary min-h-14" disabled={saving} onClick={onRetry}><RotateCcw size={19} /> 다시 해볼게요</button>
        <button className="btn btn-primary min-h-14" disabled={saving} onClick={onSuccess}><Check size={20} /> {saving ? "저장 중…" : "잘 말했어요"}</button>
      </div>
    </div>
  );
}

function GrammarExplanation({ grammar }: { grammar: GrammarTarget }) {
  const base = grammar.dictionaryForm ?? grammar.base ?? grammar.stem ?? "";
  const completed = grammar.completed ?? "";
  const emphasis = "mx-1 inline-block text-lg font-extrabold text-[var(--mint-700)] sm:text-xl";
  return (
    <p className="mx-auto mt-3 max-w-lg break-keep rounded-xl bg-white/75 px-4 py-3 text-base font-semibold leading-8 text-[#4f625a] sm:text-lg">
      <strong className={emphasis}>{base}</strong>와 <strong className={emphasis}>{grammar.answer}</strong>{grammar.slot === "verb_ending" ? "가 만나" : "를 연결하면"} <strong className={emphasis}>{completed}</strong>{grammar.slot === "verb_ending" ? "로 바뀌어요." : "가 돼요."}
    </p>
  );
}
