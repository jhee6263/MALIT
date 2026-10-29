"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    setError("");
    setDone(false);
    if (password.length < 8) { setError("비밀번호는 8자 이상으로 입력해주세요."); return; }
    if (password !== confirm) { setError("비밀번호 확인이 일치하지 않습니다."); return; }
    const supabase = createClient();
    if (!supabase) { setError("서버 설정을 확인해주세요."); return; }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError("비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요."); return; }
      form.reset();
      setDone(true);
    } catch {
      setError("비밀번호를 변경하지 못했습니다. 네트워크를 확인해주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2">
      <label>
        <span className="mb-2 block font-bold">새 비밀번호</span>
        <input className="field" name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
      </label>
      <label>
        <span className="mb-2 block font-bold">새 비밀번호 확인</span>
        <input className="field" name="confirm" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
      </label>
      {error && <p role="alert" className="rounded-xl bg-[#fff3f3] p-3 text-sm font-bold text-[var(--danger)] sm:col-span-2">{error}</p>}
      {done && <p role="status" className="flex items-center gap-2 rounded-xl bg-[var(--mint-50)] p-3 text-sm font-bold text-[var(--mint-700)] sm:col-span-2"><CheckCircle2 size={18} /> 비밀번호를 변경했습니다.</p>}
      <div className="sm:col-span-2"><button className="btn btn-primary" disabled={saving}>{saving ? "변경 중…" : "비밀번호 변경"}</button></div>
    </form>
  );
}
