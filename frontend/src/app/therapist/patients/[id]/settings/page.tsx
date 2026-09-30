"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Save } from "lucide-react";

type SettingsForm = { level: string; dailyCount: string; topics: string[] };

export default function PatientSettingsPage() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;
  const [patientName, setPatientName] = useState("");
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [form, setForm] = useState<SettingsForm>({ level: "1", dailyCount: "6", topics: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [removedTopics, setRemovedTopics] = useState<string[]>([]);
  const dailyCountOptions = Array.from(new Set([6, 8, 10, Number(form.dailyCount)])).sort((a, b) => a - b);

  useEffect(() => {
    Promise.all([fetch(`/api/patients/${patientId}/settings`), fetch("/api/topics")])
      .then(async ([settingsResponse, topicsResponse]) => {
        const settingsBody = await settingsResponse.json();
        if (!settingsResponse.ok) throw new Error(settingsBody.error ?? "훈련 설정을 불러오지 못했습니다.");
        const topicRows = topicsResponse.ok ? await topicsResponse.json() : [];
        const activeTopics: string[] = topicRows.map((topic: { name: string }) => topic.name);
        const storedTopics: string[] = settingsBody.settings.topics ?? [];
        // 사용이 중지된 주제가 남아 있으면 화면에서 해제할 수 없어 저장이 막히므로 미리 제외한다.
        setRemovedTopics(topicsResponse.ok ? storedTopics.filter((topic) => !activeTopics.includes(topic)) : []);
        setPatientName(settingsBody.patient.name);
        setForm({
          level: String(settingsBody.settings.training_level),
          dailyCount: String(settingsBody.settings.daily_count),
          topics: topicsResponse.ok ? storedTopics.filter((topic) => activeTopics.includes(topic)) : storedTopics,
        });
        setAvailableTopics(activeTopics);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (form.topics.length === 0) {
      setError("훈련 주제를 하나 이상 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/patients/${patientId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "훈련 설정을 저장하지 못했습니다.");
        return;
      }
      setRemovedTopics([]);
      setSaved(true);
    } catch {
      setError("훈련 설정을 저장하지 못했습니다. 네트워크를 확인해주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="card p-8 text-center text-[var(--muted)]">훈련 설정을 불러오는 중입니다.</section>;
  }

  return (
    <>
      <Link href="/therapist/patients" className="inline-flex items-center gap-2 font-bold text-[var(--mint-700)]">
        <ArrowLeft size={18} /> 환자 목록
      </Link>
      <div className="mt-6">
        <p className="eyebrow">Patient training settings</p>
        <h1 className="mt-2 text-3xl font-bold">{patientName || "환자"}님의 훈련 설정</h1>
        <p className="mt-2 text-[var(--muted)]">필요할 때만 단계, 주제와 하루 훈련량을 변경하세요.</p>
      </div>

      <section className="card mt-7 max-w-3xl p-7 sm:p-9">
        {error && <p role="alert" className="mb-5 rounded-xl bg-[#fff3f3] p-4 font-bold text-[var(--danger)]">{error}</p>}
        {saved && <p role="status" className="mb-5 flex items-center gap-2 rounded-xl bg-[var(--mint-50)] p-4 font-bold text-[var(--mint-700)]"><CheckCircle2 size={20} /> 훈련 설정을 저장했습니다.</p>}

        <form onSubmit={saveSettings} className="grid gap-6 sm:grid-cols-2">
          <label>
            <span className="mb-2 block font-bold">훈련 단계</span>
            <select className="field" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
              <option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block font-bold">하루 훈련량</span>
            <select className="field" value={form.dailyCount} onChange={(event) => setForm({ ...form, dailyCount: event.target.value })}>
              {dailyCountOptions.map((count) => <option key={count} value={String(count)}>{count}문장</option>)}
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-3 font-bold">훈련 주제</legend>
            {removedTopics.length > 0 && <p className="mb-3 break-keep rounded-xl bg-[#fff7ec] p-3 text-sm font-bold text-[#8a5a2d]">사용이 중지된 주제({removedTopics.join(", ")})는 선택에서 제외했습니다. 저장하면 반영됩니다.</p>}
            <div className="flex flex-wrap gap-3">
              {availableTopics.map((topic) => (
                <label key={topic} className={`pill cursor-pointer border ${form.topics.includes(topic) ? "border-[var(--mint-500)] bg-[var(--mint-50)] text-[var(--mint-700)]" : "border-[var(--line)] bg-white"}`}>
                  <input type="checkbox" checked={form.topics.includes(topic)} onChange={(event) => setForm({ ...form, topics: event.target.checked ? [...form.topics, topic] : form.topics.filter((value) => value !== topic) })} />
                  {topic}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="sm:col-span-2 rounded-xl bg-[#fff9f3] p-4 text-sm leading-6 text-[#74553b]">변경한 설정은 다음에 새로 생성되는 훈련부터 적용됩니다. 이미 시작했거나 생성된 오늘의 훈련은 그대로 유지됩니다.</p>
          <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
            <Link href="/therapist/patients" className="btn btn-secondary">취소</Link>
            <button disabled={saving} className="btn btn-primary"><Save size={18} /> {saving ? "저장 중…" : "설정 저장"}</button>
          </div>
        </form>
      </section>
    </>
  );
}
