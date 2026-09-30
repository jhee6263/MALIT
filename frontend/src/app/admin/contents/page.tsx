"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FilePlus2, Image as ImageIcon, Send, Upload } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ContentStatus, TrainingContent } from "@/lib/types";

const statusLabel: Record<ContentStatus, string> = {
  draft: "초안",
  review: "검토 중",
  published: "게시됨",
  archived: "보관됨",
};

export default function ContentsPage() {
  const [items, setItems] = useState<TrainingContent[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const sortedItems = useMemo(() => {
    const topicOrder = new Map(topics.map((topic, index) => [topic, index]));

    return [...items].sort((a, b) => {
      const aTopicOrder = topicOrder.get(a.topic);
      const bTopicOrder = topicOrder.get(b.topic);

      if (aTopicOrder !== undefined || bTopicOrder !== undefined) {
        const topicDifference = (aTopicOrder ?? topics.length) - (bTopicOrder ?? topics.length);
        if (topicDifference !== 0) return topicDifference;
      } else {
        const topicDifference = a.topic.localeCompare(b.topic, "ko");
        if (topicDifference !== 0) return topicDifference;
      }

      const levelDifference = a.level - b.level;
      if (levelDifference !== 0) return levelDifference;

      return a.title.localeCompare(b.title, "ko");
    });
  }, [items, topics]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    Promise.all([fetch("/api/contents"), fetch("/api/topics")])
      .then(async ([contentsResponse, topicsResponse]) => {
        const rows = contentsResponse.ok ? await contentsResponse.json() : [];
        const topicRows = topicsResponse.ok ? await topicsResponse.json() : [];
        setItems(rows.map((row: { id: string; title: string; level: 1 | 2 | 3; image_path: string | null; target_sentence: string; status: ContentStatus; topics: { name: string } | null }) => ({
          id: row.id,
          title: row.title,
          level: row.level,
          topic: row.topics?.name ?? "미지정",
          targetSentence: row.target_sentence,
          imagePath: row.image_path,
          keywords: [],
          grammar: [],
          status: row.status,
        })));
        setTopics(topicRows.map((row: { name: string }) => row.name));
      })
      .catch(() => setMessage("콘텐츠 목록을 불러오지 못했습니다."));
  }, []);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title"));
    const targetSentence = String(form.get("targetSentence"));
    const level = Number(form.get("level")) as 1 | 2 | 3;
    const topic = String(form.get("topic"));
    const image = form.get("image") as File;
    let imagePath: string | null = null;

    if (isSupabaseConfigured) {
      const supabase = createClient()!;
      if (image?.size) {
        imagePath = `${crypto.randomUUID()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("content-images").upload(imagePath, image);
        if (error) {
          setMessage("이미지를 업로드하지 못했습니다.");
          return;
        }
      }
      const response = await fetch("/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, level, topic, imagePath, imageAlt: `${title} 상황 그림`, targetSentence, status: "draft" }),
      });
      if (!response.ok) {
        const body = await response.json();
        setMessage(body.error ?? "초안을 저장하지 못했습니다.");
        return;
      }
      const created = await response.json();
      setItems((current) => [{ id: created.id, title, level, topic, targetSentence, imagePath, keywords: [], grammar: [], status: "draft" }, ...current]);
    }
    setMessage("콘텐츠 초안을 저장했어요.");
    setOpen(false);
  }

  async function uploadImage(content: TrainingContent, file?: File) {
    if (!file?.size || !isSupabaseConfigured) return;
    setMessage("");
    const supabase = createClient()!;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const imagePath = `${content.id}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("content-images").upload(imagePath, file);
    if (error) {
      setMessage("이미지를 업로드하지 못했습니다.");
      return;
    }
    const response = await fetch(`/api/contents/${content.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePath, imageAlt: `${content.targetSentence} 상황 그림` }),
    });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "이미지를 콘텐츠에 연결하지 못했습니다.");
      return;
    }
    setItems((current) => current.map((item) => item.id === content.id ? { ...item, imagePath } : item));
    setMessage("훈련 이미지를 등록했어요.");
  }

  async function publish(content: TrainingContent) {
    if (!content.imagePath) {
      setMessage("훈련 이미지를 등록한 뒤 게시할 수 있습니다.");
      return;
    }
    const response = await fetch(`/api/contents/${content.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "게시 상태를 저장하지 못했습니다.");
      return;
    }
    setItems((current) => current.map((item) => item.id === content.id ? { ...item, status: "published" } : item));
    setMessage("검토한 콘텐츠를 게시했어요.");
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Training contents</p><h1 className="mt-2 text-3xl font-bold">훈련 콘텐츠 관리</h1><p className="mt-2 text-[var(--muted)]">문장과 이미지를 검토한 콘텐츠만 게시합니다.</p></div>
        <button disabled={topics.length === 0} className="btn btn-primary" onClick={() => setOpen((value) => !value)}><FilePlus2 size={19} /> 새 콘텐츠</button>
      </div>
      {topics.length === 0 && <p className="mt-5 rounded-xl bg-[#fff7ec] p-4 text-sm font-bold text-[#8a5a2d]">훈련 주제를 먼저 등록한 뒤 콘텐츠를 추가할 수 있습니다.</p>}
      {message && <p role="status" className="mt-5 rounded-xl bg-[var(--mint-50)] p-4 font-bold text-[var(--mint-700)]">{message}</p>}

      {open && <section className="card mt-6 p-6"><h2 className="text-xl font-bold">새 콘텐츠 초안</h2><form onSubmit={createDraft} className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block font-bold">훈련 단계</span><select className="field" name="level"><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></label><label><span className="mb-2 block font-bold">주제</span><select className="field" name="topic">{topics.map((topic) => <option key={topic}>{topic}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-2 block font-bold">콘텐츠 이름</span><input className="field" name="title" required /></label><label className="sm:col-span-2"><span className="mb-2 block font-bold">목표 문장</span><input className="field" name="targetSentence" required /></label><label className="sm:col-span-2"><span className="mb-2 block font-bold">훈련 이미지 <span className="font-normal text-[var(--muted)]">(나중에 등록 가능)</span></span><span className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cbd7d2] p-4 text-[#65736e]"><ImageIcon /><input type="file" name="image" accept="image/png,image/jpeg,image/webp" /><small>인물의 연령과 행동이 명확한 이미지를 사용하세요.</small></span></label><div className="sm:col-span-2 flex justify-end"><button className="btn btn-secondary">초안 저장</button></div></form></section>}

      <section className="card mt-7 overflow-hidden">
        <div className="table-wrap"><table><thead><tr><th>콘텐츠</th><th>목표 문장</th><th>단계</th><th>주제</th><th>이미지</th><th>상태</th><th>관리</th></tr></thead><tbody>{sortedItems.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-[var(--muted)]">등록된 콘텐츠가 없습니다.</td></tr> : sortedItems.map((content) => <tr key={content.id}><td className="font-bold">{content.title}</td><td>{content.targetSentence}</td><td>Level {content.level}</td><td>{content.topic}</td><td><span className={`pill ${content.imagePath ? "pill-green" : "pill-orange"}`}>{content.imagePath ? "등록됨" : "미등록"}</span></td><td><span className={`pill ${content.status === "published" ? "pill-green" : "pill-orange"}`}>{statusLabel[content.status]}</span></td><td><div className="flex flex-wrap gap-2"><label className="btn btn-secondary min-h-10 cursor-pointer px-3"><Upload size={17} /> 이미지<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadImage(content, event.target.files?.[0])} /></label>{content.status !== "published" && <button onClick={() => publish(content)} disabled={!content.imagePath} title={!content.imagePath ? "이미지를 먼저 등록하세요" : undefined} className="btn btn-primary min-h-10 px-3"><Send size={17} /> 게시</button>}</div></td></tr>)}</tbody></table></div>
      </section>
      <div className="mt-5 rounded-2xl border border-[#eadccf] bg-[#fff9f3] p-5 text-sm leading-6 text-[#74553b]"><strong>콘텐츠 검토 기준</strong> · 인물의 연령과 행동이 명확한지, 그림에 불필요한 단서가 없는지, 목표 문장·허용 표현·어휘/문법 단서가 서로 일치하는지 확인합니다.</div>
    </>
  );
}
