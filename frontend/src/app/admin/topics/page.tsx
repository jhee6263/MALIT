"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Tags } from "lucide-react";

type Topic = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/topics?all=true")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setTopics(await response.json());
      })
      .catch(() => setMessage("훈련 주제를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  async function addTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    const response = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "주제를 추가하지 못했습니다.");
      return;
    }
    setTopics((current) => [...current, body]);
    form.reset();
    setMessage("새 훈련 주제를 추가했어요.");
  }

  async function updateTopic(topic: Topic, changes: { name?: string; isActive?: boolean }) {
    setMessage("");
    const response = await fetch(`/api/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "주제를 수정하지 못했습니다.");
      return;
    }
    setTopics((current) => current.map((item) => item.id === topic.id ? body : item));
    setMessage("훈련 주제를 수정했어요.");
  }

  function renameTopic(topic: Topic) {
    const name = window.prompt("새 주제 이름을 입력하세요.", topic.name)?.trim();
    if (name && name !== topic.name) updateTopic(topic, { name });
  }

  return (
    <>
      <p className="eyebrow">Training topics</p>
      <h1 className="mt-2 text-3xl font-bold">훈련 주제 관리</h1>
      <p className="mt-2 text-[var(--muted)]">재활사가 환자별 훈련 설정에서 선택할 주제를 관리합니다.</p>

      <form onSubmit={addTopic} className="card mt-7 flex max-w-2xl flex-col gap-3 p-5 sm:flex-row">
        <input className="field flex-1" name="name" maxLength={40} placeholder="새 주제 이름" required />
        <button className="btn btn-primary"><Plus size={19} /> 주제 추가</button>
      </form>

      {message && <p className="mt-4 rounded-xl bg-[var(--mint-50)] p-4 font-bold text-[var(--mint-700)]" role="status">{message}</p>}

      <section className="card mt-7 overflow-hidden">
        <div className="table-wrap">
          <table>
            <thead><tr><th>순서</th><th>주제 이름</th><th>상태</th><th>관리</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="py-12 text-center text-[var(--muted)]">불러오는 중…</td></tr> : topics.length === 0 ? <tr><td colSpan={4} className="py-12 text-center text-[var(--muted)]"><Tags className="mx-auto mb-3" />등록된 주제가 없습니다.</td></tr> : topics.map((topic, index) => (
                <tr key={topic.id}>
                  <td>{index + 1}</td>
                  <td className="font-bold">{topic.name}</td>
                  <td><span className={`pill ${topic.is_active ? "pill-green" : "pill-orange"}`}>{topic.is_active ? "사용 중" : "사용 중지"}</span></td>
                  <td><div className="flex flex-wrap gap-2"><button className="btn btn-secondary min-h-10 px-3" onClick={() => renameTopic(topic)}>이름 변경</button><button className="btn btn-secondary min-h-10 px-3" onClick={() => updateTopic(topic, { isActive: !topic.is_active })}>{topic.is_active ? "사용 중지" : "다시 사용"}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-5 text-sm leading-6 text-[var(--muted)]">사용 중지한 주제는 기존 콘텐츠와 기록에서 삭제되지 않으며, 새 환자 설정의 선택 목록에서만 숨겨집니다.</p>
    </>
  );
}
