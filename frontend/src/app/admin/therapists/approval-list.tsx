"use client";

import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { EmptyState } from "@/components/portal/empty-state";

type Therapist = { id: string; name: string; organization: string | null; credential: string | null; created_at: string };

export function ApprovalList({ initialItems }: { initialItems: Therapist[] }) {
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function decide(id: string, status: "active" | "rejected") {
    if (pendingId) return;
    setPendingId(id);
    try {
      const response = await fetch(`/api/admin/therapists/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) { setMessage("상태를 저장하지 못했습니다."); return; }
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage(status === "active" ? "재활사 계정을 승인했습니다." : "가입 신청을 반려했습니다.");
    } catch {
      setMessage("상태를 저장하지 못했습니다. 네트워크를 확인해주세요.");
    } finally {
      setPendingId(null);
    }
  }

  return <section className="card mt-8 overflow-hidden"><div className="border-b border-[var(--line)] p-6"><h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="text-[var(--mint-700)]"/> 승인 대기 {items.length}명</h2>{message && <p className="mt-3 text-sm font-bold text-[var(--mint-700)]">{message}</p>}</div>{items.length === 0 ? <EmptyState icon={ShieldCheck} title="승인 대기 중인 재활사가 없습니다" description="웹에서 재활사 회원가입이 완료되면 이곳에 표시됩니다."/> : <div className="divide-y divide-[var(--line)]">{items.map((item) => <article key={item.id} className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-bold">{item.name}</h3><span className="pill pill-orange">승인 대기</span></div><p className="mt-2 text-[#53615d]">{item.organization || "소속 미입력"}</p><p className="mt-1 text-sm text-[var(--muted)]">자격 정보: {item.credential || "미입력"} · 신청일 {new Date(item.created_at).toLocaleDateString("ko-KR")}</p></div><div className="flex gap-2"><button className="btn btn-danger" disabled={pendingId !== null} onClick={() => decide(item.id, "rejected")}><X size={18}/> 반려</button><button className="btn btn-primary" disabled={pendingId !== null} onClick={() => decide(item.id, "active")}><Check size={18}/> 승인</button></div></article>)}</div>}</section>;
}
