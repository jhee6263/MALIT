"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// 세션을 실제로 종료한 뒤 로그인 화면으로 보낸다. 링크만 걸어두면 로그인 상태가 그대로 남는다.
export function LogoutButton({ className = "", label }: { className?: string; label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await createClient()?.auth.signOut();
    } finally {
      window.sessionStorage.clear();
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={logout} disabled={pending} aria-label="로그아웃" className={className}>
      <LogOut size={label ? 18 : 20} />
      {label}
    </button>
  );
}
