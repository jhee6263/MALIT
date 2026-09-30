"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { DEFAULT_TEST_PASSWORD } from "@/lib/auth/account-rules";

export default function NewPatientPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [data, setData] = useState({ name: "", loginId: "", birthYear: "", level: "1", dailyCount: "6", topics: [] as string[] });

  useEffect(() => { fetch("/api/topics").then(async response => response.ok ? response.json() : []).then(rows => setAvailableTopics(rows.map((row: { name: string }) => row.name))).catch(() => setAvailableTopics([])); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (data.topics.length === 0) { setError("훈련 주제를 하나 이상 선택해주세요."); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error ?? "환자 등록에 실패했습니다."); return; }
      setStep(3);
    } catch {
      setError("환자 등록에 실패했습니다. 네트워크를 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return <><p className="eyebrow">Patient setup</p><h1 className="mt-2 text-3xl font-bold">새 환자 등록</h1><p className="mt-2 text-[var(--muted)]">환자의 계정과 첫 훈련 설정을 등록합니다.</p><div className="mt-6 flex max-w-2xl gap-2">{["1. 계정 정보", "2. 초기 훈련 설정", "3. 등록 완료"].map((label, index) => <div key={label} className={`flex-1 rounded-full px-3 py-2 text-center text-sm font-bold ${step >= index + 1 ? "bg-[var(--mint-700)] text-white" : "bg-[#e4e9e7] text-[#78837f]"}`}>{label}</div>)}</div><section className="card mt-6 max-w-3xl p-7 sm:p-9">{step === 1 && <form onSubmit={event => { event.preventDefault(); setStep(2); }} className="grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><h2 className="text-xl font-bold">환자 계정 정보</h2><p className="mt-1 text-sm text-[var(--muted)]">환자는 이메일 대신 로그인 아이디를 사용합니다.</p></div><label><span className="mb-2 block font-bold">표시 이름</span><input className="field" required maxLength={50} placeholder="예: 김환자01" value={data.name} onChange={event => setData({ ...data, name: event.target.value })}/></label><label><span className="mb-2 block font-bold">로그인 아이디</span><input className="field" required minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,29}" placeholder="예: patient01" value={data.loginId} onChange={event => setData({ ...data, loginId: event.target.value.toLowerCase() })}/><span className="mt-2 block text-sm text-[var(--muted)]">영문 소문자, 숫자, 마침표, 밑줄, 하이픈을 사용할 수 있어요.</span></label><label><span className="mb-2 block font-bold">출생연도 <span className="font-normal text-[var(--muted)]">(선택)</span></span><input className="field" type="number" min={1900} max={2100} placeholder="예: 1965" value={data.birthYear} onChange={event => setData({ ...data, birthYear: event.target.value })}/></label><div><span className="mb-2 block font-bold">초기 비밀번호</span><div className="field bg-[#f4f1e9] font-bold" aria-label={`초기 비밀번호 ${DEFAULT_TEST_PASSWORD}`}>{DEFAULT_TEST_PASSWORD}</div><span className="mt-2 block text-sm text-[var(--muted)]">환자 계정에 자동으로 적용됩니다.</span></div><button className="btn btn-primary sm:col-span-2">다음: 훈련 설정</button></form>}{step === 2 && <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2"><label><span className="mb-2 block font-bold">시작 단계</span><select className="field" value={data.level} onChange={event => setData({ ...data, level: event.target.value })}><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></label><label><span className="mb-2 block font-bold">하루 훈련량</span><select className="field" value={data.dailyCount} onChange={event => setData({ ...data, dailyCount: event.target.value })}><option value="6">6문장</option><option value="8">8문장</option><option value="10">10문장</option></select></label><fieldset className="sm:col-span-2"><legend className="mb-3 font-bold">훈련 주제</legend>{availableTopics.length === 0 ? <p className="rounded-xl bg-[#fff7ec] p-4 text-sm font-bold text-[#8a5a2d]">아직 정의된 훈련 주제가 없습니다. 관리자와 주제 목록을 먼저 확정해주세요.</p> : <div className="flex flex-wrap gap-3">{availableTopics.map(topic => <label key={topic} className="pill border border-[var(--line)] bg-white"><input type="checkbox" checked={data.topics.includes(topic)} onChange={event => setData({ ...data, topics: event.target.checked ? [...data.topics, topic] : data.topics.filter(value => value !== topic) })}/>{topic}</label>)}</div>}</fieldset>{error && <p className="sm:col-span-2 rounded-xl bg-[#fff3f3] p-3 text-sm font-bold text-[var(--danger)]">{error}</p>}<div className="flex gap-3 sm:col-span-2"><button type="button" className="btn btn-secondary flex-1" onClick={() => setStep(1)}>이전</button><button disabled={availableTopics.length === 0 || submitting} className="btn btn-primary flex-1">{submitting ? "등록 중…" : "환자 등록"}</button></div></form>}{step === 3 && <div className="py-8 text-center"><CheckCircle2 size={58} className="mx-auto text-[var(--mint-700)]"/><h2 className="mt-5 text-2xl font-bold">환자 등록을 완료했어요</h2><p className="mt-3 text-[var(--muted)]">로그인 아이디는 <strong>{data.loginId}</strong>, 초기 비밀번호는 <strong>{DEFAULT_TEST_PASSWORD}</strong>입니다.</p><button className="btn btn-primary mt-7" onClick={() => router.push("/therapist/patients")}>환자 목록으로</button></div>}</section></>;
}
