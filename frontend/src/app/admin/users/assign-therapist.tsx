"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AssignTherapist({ patientId, therapists }: { patientId: string; therapists: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [therapistId, setTherapistId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function assign() {
    if (!therapistId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/patients/${patientId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapistId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "배정하지 못했습니다.");
        return;
      }
      router.refresh();
    } catch {
      setError("배정하지 못했습니다. 네트워크를 확인해주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (therapists.length === 0) return <span className="text-sm text-[var(--muted)]">배정할 활성 재활사가 없습니다</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="field min-h-10 w-40 py-0 text-sm" aria-label="담당 재활사" value={therapistId} onChange={(event) => setTherapistId(event.target.value)}>
        <option value="">재활사 선택</option>
        {therapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.name}</option>)}
      </select>
      <button type="button" className="btn btn-secondary min-h-10 px-3" disabled={!therapistId || busy} onClick={assign}>{busy ? "배정 중…" : "배정"}</button>
      {error && <span role="alert" className="w-full text-sm font-bold text-[var(--danger)]">{error}</span>}
    </div>
  );
}
