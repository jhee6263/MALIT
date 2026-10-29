"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, Plus, Save, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import type { ContentStatus } from "@/lib/types";
import {
  acceptedExpressionsSchema,
  buildGrammarTarget,
  defaultGrammarChoices,
  findContentWarnings,
  firstSoundHint,
  grammarSlotLabels,
  grammarSlots,
  grammarTargetsSchema,
  hintLabels,
  keywordRoleLabels,
  keywordRoles,
  keywordsSchema,
  type GrammarSlot,
  type KeywordInput,
  type KeywordRole,
} from "@/lib/training/content-schema";

type GrammarDraft = { slot: GrammarSlot; base: string; answer: string; completed: string; choicesText: string };
type Loaded = {
  id: string;
  title: string;
  level: number;
  status: ContentStatus;
  topic: string;
  imageUrl: string | null;
  imageAlt: string;
  targetSentence: string;
  acceptedExpressions: string[];
  keywords: KeywordInput[];
  grammarTargets: Array<Omit<GrammarDraft, "choicesText"> & { choices: string[] }>;
};

const statusLabel: Record<ContentStatus, string> = { draft: "초안", review: "검토 중", published: "게시됨", archived: "보관됨" };
const sectionLabels: Record<string, string> = { keywords: "핵심어", grammarTargets: "문법 목표", acceptedExpressions: "허용 표현" };
const fieldLabels: Record<string, string> = {
  role: "종류", question: "질문", answer: "정답", hints: "도움 단서", slot: "조사·어미 종류", base: "어간·낱말", completed: "완성형", choices: "보기",
};

const splitChoices = (text: string) => text.split(/[,，]/).map((value) => value.trim()).filter(Boolean);

function describeIssue(issue: { path: PropertyKey[]; message: string }) {
  const [section, index, field] = issue.path;
  if (typeof section === "string" && typeof index === "number") {
    const where = `${sectionLabels[section] ?? section} ${index + 1}번${typeof field === "string" ? ` · ${fieldLabels[field] ?? field}` : ""}`;
    return `${where}을(를) 확인해주세요.`;
  }
  return issue.message || "입력값을 확인해주세요.";
}

export default function ContentEditPage() {
  const params = useParams<{ id: string }>();
  const contentId = params.id;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [targetSentence, setTargetSentence] = useState("");
  const [acceptedText, setAcceptedText] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [keywords, setKeywords] = useState<KeywordInput[]>([]);
  const [grammar, setGrammar] = useState<GrammarDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/contents/${contentId}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "콘텐츠를 불러오지 못했습니다.");
        const content = body as Loaded;
        setLoaded(content);
        setTitle(content.title);
        setTargetSentence(content.targetSentence);
        setAcceptedText(content.acceptedExpressions.join("\n"));
        setImageAlt(content.imageAlt);
        setKeywords(content.keywords);
        setGrammar(content.grammarTargets.map(({ choices, ...rest }) => ({ ...rest, choicesText: choices.join(", ") })));
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [contentId]);

  const acceptedExpressions = useMemo(() => acceptedText.split("\n").map((line) => line.trim()).filter(Boolean), [acceptedText]);
  const warnings = useMemo(() => findContentWarnings({
    targetSentence,
    acceptedExpressions,
    keywords: keywords.filter((keyword) => keyword.answer.trim()),
    grammarTargets: grammar.filter((item) => item.completed.trim()).map((item) => ({ slot: item.slot, completed: item.completed })),
  }), [targetSentence, acceptedExpressions, keywords, grammar]);

  const usedRoles = new Set(keywords.map((keyword) => keyword.role));
  const nextRole = keywordRoles.find((role) => !usedRoles.has(role));

  function changeKeyword(index: number, patch: Partial<KeywordInput>) {
    setSaved(false);
    setKeywords((current) => current.map((keyword, position) => position === index ? { ...keyword, ...patch } : keyword));
  }
  function changeHint(index: number, hintIndex: number, value: string) {
    const hints = [...keywords[index].hints];
    hints[hintIndex] = value;
    changeKeyword(index, { hints });
  }
  function changeGrammar(index: number, patch: Partial<GrammarDraft>) {
    setSaved(false);
    setGrammar((current) => current.map((item, position) => position === index ? { ...item, ...patch } : item));
  }
  function changeSlot(index: number, slot: GrammarSlot) {
    const previousDefault = defaultGrammarChoices[grammar[index].slot].join(", ");
    const keepChoices = grammar[index].choicesText.trim() !== "" && grammar[index].choicesText !== previousDefault;
    changeGrammar(index, { slot, choicesText: keepChoices ? grammar[index].choicesText : defaultGrammarChoices[slot].join(", ") });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaved(false);

    const grammarTargets = grammar.map((item) => ({ slot: item.slot, base: item.base, answer: item.answer, completed: item.completed, choices: splitChoices(item.choicesText) }));
    for (const [name, schema, value] of [
      ["keywords", keywordsSchema, keywords],
      ["grammarTargets", grammarTargetsSchema, grammarTargets],
      ["acceptedExpressions", acceptedExpressionsSchema, acceptedExpressions],
    ] as const) {
      const result = schema.safeParse(value);
      if (!result.success) {
        const issue = result.error.issues[0];
        setError(describeIssue({ path: [name, ...issue.path], message: issue.message }));
        return;
      }
    }
    if (!title.trim() || !targetSentence.trim() || !imageAlt.trim()) {
      setError("콘텐츠 이름, 목표 문장, 이미지 설명은 비워둘 수 없습니다.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/contents/${contentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, targetSentence, imageAlt, acceptedExpressions, keywords, grammarTargets }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "콘텐츠를 저장하지 못했습니다.");
        return;
      }
      setSaved(true);
    } catch {
      setError("콘텐츠를 저장하지 못했습니다. 네트워크를 확인해주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="card p-8 text-center text-[var(--muted)]">콘텐츠를 불러오는 중입니다.</section>;
  if (!loaded) {
    return (
      <>
        <Link href="/admin/contents" className="inline-flex items-center gap-2 font-bold text-[var(--mint-700)]"><ArrowLeft size={18} /> 콘텐츠 목록</Link>
        <p role="alert" className="mt-6 rounded-xl bg-[#fff3f3] p-4 font-bold text-[var(--danger)]">{error || "콘텐츠를 찾을 수 없습니다."}</p>
      </>
    );
  }

  return (
    <>
      <Link href="/admin/contents" className="inline-flex items-center gap-2 font-bold text-[var(--mint-700)]"><ArrowLeft size={18} /> 콘텐츠 목록</Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Content editor</p>
          <h1 className="mt-2 text-3xl font-bold">{loaded.title}</h1>
          <p className="mt-2 text-[var(--muted)]">Level {loaded.level} · {loaded.topic}</p>
        </div>
        <span className={`pill ${loaded.status === "published" ? "pill-green" : "pill-orange"}`}>{statusLabel[loaded.status]}</span>
      </div>
      {loaded.status === "published" && (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-[#fff7ec] p-4 text-sm font-bold leading-6 text-[#8a5a2d]"><TriangleAlert className="mt-0.5 shrink-0" size={18} /> 게시된 콘텐츠입니다. 저장하면 환자의 훈련 화면에 바로 반영됩니다. 이미 만들어진 오늘의 훈련에도 같은 문장이 새 내용으로 나타납니다.</p>
      )}

      <form onSubmit={save} className="mt-6 grid gap-6">
        {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#fff3f3] p-4 font-bold text-[var(--danger)]"><CircleAlert className="mt-0.5 shrink-0" size={19} /> {error}</p>}
        {saved && <p role="status" className="flex items-center gap-2 rounded-xl bg-[var(--mint-50)] p-4 font-bold text-[var(--mint-700)]"><CheckCircle2 size={20} /> 콘텐츠를 저장했습니다.</p>}

        <section className="card grid gap-5 p-6 sm:grid-cols-[1fr_240px] sm:p-7">
          <div className="grid gap-4">
            <h2 className="text-xl font-bold">기본 정보</h2>
            <label><span className="mb-2 block font-bold">콘텐츠 이름</span><input className="field" value={title} maxLength={100} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} /></label>
            <label><span className="mb-2 block font-bold">목표 문장</span><input className="field" value={targetSentence} maxLength={120} onChange={(event) => { setTargetSentence(event.target.value); setSaved(false); }} /></label>
            <label>
              <span className="mb-2 block font-bold">허용 표현 <span className="font-normal text-[var(--muted)]">(한 줄에 하나. 목표 문장과 함께 정답으로 보는 말)</span></span>
              <textarea className="field min-h-24" value={acceptedText} onChange={(event) => { setAcceptedText(event.target.value); setSaved(false); }} />
            </label>
            <label><span className="mb-2 block font-bold">이미지 설명</span><input className="field" value={imageAlt} maxLength={200} onChange={(event) => { setImageAlt(event.target.value); setSaved(false); }} /></label>
          </div>
          <div>
            <span className="mb-2 block font-bold">훈련 이미지</span>
            {loaded.imageUrl ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--line)] bg-white"><Image src={loaded.imageUrl} alt={imageAlt} fill className="object-contain" sizes="240px" /></div>
            ) : (
              <p className="rounded-2xl bg-[#f4f1e9] p-6 text-center text-sm text-[var(--muted)]">등록된 이미지가 없습니다. 콘텐츠 목록에서 이미지를 올려주세요.</p>
            )}
          </div>
        </section>

        <section className="card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">핵심어</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">그림을 보고 떠올릴 낱말입니다. 문장 순서대로 두세요. 도움 단서는 범주 → 의미 → 첫소리 순서로 한 단계씩 보여줍니다.</p>
            </div>
            <button type="button" className="btn btn-secondary min-h-11" disabled={!nextRole} onClick={() => nextRole && (setSaved(false), setKeywords([...keywords, { role: nextRole, question: "", answer: "", hints: ["", "", ""] }]))}><Plus size={18} /> 핵심어 추가</button>
          </div>
          <div className="mt-5 grid gap-4">
            {keywords.length === 0 && <p className="rounded-xl bg-[#fff7ec] p-4 text-sm font-bold text-[#8a5a2d]">핵심어가 없습니다. 게시하려면 하나 이상 필요합니다.</p>}
            {keywords.map((keyword, index) => (
              <div key={index} className="rounded-2xl border border-[var(--line)] bg-[#fbfcfb] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <strong>핵심어 {index + 1}</strong>
                  <button type="button" className="btn btn-danger min-h-10 px-3" onClick={() => { setSaved(false); setKeywords(keywords.filter((_, position) => position !== index)); }}><Trash2 size={16} /> 삭제</button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label><span className="mb-1.5 block text-sm font-bold">종류</span>
                    <select className="field" value={keyword.role} onChange={(event) => changeKeyword(index, { role: event.target.value as KeywordRole })}>
                      {keywordRoles.map((role) => <option key={role} value={role} disabled={role !== keyword.role && usedRoles.has(role)}>{keywordRoleLabels[role]}</option>)}
                    </select>
                  </label>
                  <label><span className="mb-1.5 block text-sm font-bold">질문</span><input className="field" value={keyword.question} maxLength={60} onChange={(event) => changeKeyword(index, { question: event.target.value })} /></label>
                  <label><span className="mb-1.5 block text-sm font-bold">정답 낱말</span><input className="field" value={keyword.answer} maxLength={30} onChange={(event) => changeKeyword(index, { answer: event.target.value })} /></label>
                </div>
                <div className="mt-3 grid gap-3">
                  {hintLabels.map((label, hintIndex) => (
                    <label key={label}>
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-bold">
                        {hintIndex + 1}단계 · {label}
                        {hintIndex === 2 && <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mint-700)]" disabled={!keyword.answer.trim()} onClick={() => changeHint(index, 2, firstSoundHint(keyword.answer))}><Wand2 size={14} /> 정답으로 자동 입력</button>}
                      </span>
                      <input className="field" value={keyword.hints[hintIndex] ?? ""} maxLength={80} onChange={(event) => changeHint(index, hintIndex, event.target.value)} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">문법 목표</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">문장 만들기 뒤에 이어지는 문법 고르기 단계입니다. 낱말 뒤에 붙는 조사나 동사 어미를 보기 중에서 고릅니다.</p>
            </div>
            <button type="button" className="btn btn-secondary min-h-11" disabled={grammar.length >= 8} onClick={() => { setSaved(false); setGrammar([...grammar, { slot: "subject_particle", base: "", answer: "", completed: "", choicesText: defaultGrammarChoices.subject_particle.join(", ") }]); }}><Plus size={18} /> 문법 목표 추가</button>
          </div>
          <div className="mt-5 grid gap-4">
            {grammar.length === 0 && <p className="rounded-xl bg-[#fff7ec] p-4 text-sm font-bold text-[#8a5a2d]">문법 목표가 없습니다. 게시하려면 하나 이상 필요합니다.</p>}
            {grammar.map((item, index) => {
              const choices = splitChoices(item.choicesText);
              return (
                <div key={index} className="rounded-2xl border border-[var(--line)] bg-[#fbfcfb] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <strong>문법 목표 {index + 1}</strong>
                    <button type="button" className="btn btn-danger min-h-10 px-3" onClick={() => { setSaved(false); setGrammar(grammar.filter((_, position) => position !== index)); }}><Trash2 size={16} /> 삭제</button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label><span className="mb-1.5 block text-sm font-bold">종류</span>
                      <select className="field" value={item.slot} onChange={(event) => changeSlot(index, event.target.value as GrammarSlot)}>
                        {grammarSlots.map((slot) => <option key={slot} value={slot}>{grammarSlotLabels[slot]}</option>)}
                      </select>
                    </label>
                    <label><span className="mb-1.5 block text-sm font-bold">{item.slot === "verb_ending" ? "동사 어간 (예: 먹, 씻)" : "낱말 (예: 사과)"}</span><input className="field" value={item.base} maxLength={30} onChange={(event) => changeGrammar(index, { base: event.target.value })} /></label>
                    <label><span className="mb-1.5 block text-sm font-bold">정답 {item.slot === "verb_ending" ? "어미" : "조사"}</span><input className="field" value={item.answer} maxLength={20} onChange={(event) => changeGrammar(index, { answer: event.target.value })} /></label>
                    <label>
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-bold">
                        완성형 (예: 사과를)
                        <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mint-700)]" disabled={!item.base.trim() || !item.answer.trim()} onClick={() => changeGrammar(index, { completed: `${item.base.trim()}${item.answer.trim()}` })}><Wand2 size={14} /> 낱말+정답으로 입력</button>
                      </span>
                      <input className="field" value={item.completed} maxLength={40} onChange={(event) => changeGrammar(index, { completed: event.target.value })} />
                    </label>
                    <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold">보기 <span className="font-normal text-[var(--muted)]">(쉼표로 구분, 정답 포함 2~5개)</span></span><input className="field" value={item.choicesText} onChange={(event) => changeGrammar(index, { choicesText: event.target.value })} /></label>
                  </div>
                  {item.base.trim() && item.answer.trim() && item.completed.trim() && choices.length > 0 && choices.includes(item.answer.trim()) && (
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                      환자에게 보이는 보기:
                      {buildGrammarTarget({ slot: item.slot, base: item.base.trim(), answer: item.answer.trim(), completed: item.completed.trim(), choices }).choices.map((choice) => (
                        <span key={choice.value} className={`rounded-full px-3 py-1 font-bold ${choice.value === item.answer.trim() ? "bg-[var(--mint-100)] text-[var(--mint-700)]" : "bg-[#f1f5f3] text-[#4f5d59]"}`}>{choice.value} → {choice.preview}</span>
                      ))}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {warnings.length > 0 && (
          <section className="rounded-2xl border border-[#eadccf] bg-[#fff9f3] p-5 text-sm leading-6 text-[#74553b]">
            <strong className="flex items-center gap-2"><TriangleAlert size={17} /> 확인이 필요한 부분 (저장은 할 수 있습니다)</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </section>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Link href="/admin/contents" className="btn btn-secondary">목록으로</Link>
          <button disabled={saving} className="btn btn-primary"><Save size={18} /> {saving ? "저장 중…" : "저장"}</button>
        </div>
      </form>
    </>
  );
}
