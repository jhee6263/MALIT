"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { Footer } from "@/components/footer";
import { toPatientInternalEmail } from "@/lib/auth/account-rules";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);
    const account = String(data.get("account") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!account || !password) {
      setError("이메일 또는 로그인 아이디와 비밀번호를 입력해주세요.");
      setLoading(false);
      return;
    }
    if (isSupabaseConfigured) {
      const supabase = createClient()!;
      const email = account.includes("@") ? account : toPatientInternalEmail(account);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError("이메일 또는 로그인 아이디와 비밀번호를 확인해주세요.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("name, role, status")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setError("계정 역할 정보를 확인할 수 없습니다. 관리자에게 문의해주세요.");
        setLoading(false);
        return;
      }

      if (profile.status !== "active") {
        await supabase.auth.signOut();
        const statusMessage = {
          pending: "가입 승인 대기 중입니다. 관리자의 확인 후 로그인할 수 있어요.",
          rejected: "가입 신청이 승인되지 않았습니다. 관리자에게 문의해주세요.",
          suspended: "현재 이용이 중지된 계정입니다. 관리자에게 문의해주세요.",
        }[profile.status as "pending" | "rejected" | "suspended"];
        setError(statusMessage ?? "현재 로그인할 수 없는 계정입니다.");
        setLoading(false);
        return;
      }

      sessionStorage.setItem("malium-user-name", profile.name);
      router.replace(profile.role === "admin" ? "/admin" : profile.role === "therapist" ? "/therapist" : "/patient/today");
      router.refresh();
      return;
    }

    sessionStorage.setItem("malium-demo-user", account);
    router.push(account === "재활사" ? "/therapist" : account === "관리자" ? "/admin" : "/patient/today");
  }

  return (
    <div className="page-shell bg-[#f8f6f1]">
      <main className="container flex flex-1 items-center justify-center py-10">
        <section className="w-full max-w-[470px] px-5 py-8 sm:px-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <Brand />
            <h1 className="mt-9 text-2xl font-bold">안녕하세요.</h1>
            <p className="mt-2 text-lg text-[#69736f]">오늘도 천천히 시작해 볼까요?</p>
          </div>
          <form onSubmit={login} className="space-y-5">
            <label className="block">
              <span className="mb-2 block font-bold">이메일 또는 로그인 아이디</span>
              <span className="relative block">
                <UserRound className="pointer-events-none absolute left-4 top-4 z-10 text-[#7d8a85]" size={21} />
                <input className="field field-icon-left" name="account" placeholder="관리자·재활사는 이메일을 입력하세요" autoComplete="username" />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block font-bold">비밀번호</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute left-4 top-4 z-10 text-[#7d8a85]" size={21} />
                <input className="field field-icon-both" name="password" type={showPassword ? "text" : "password"} placeholder="비밀번호를 입력하세요" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="비밀번호 보기" className="absolute right-4 top-4 z-10 text-[#7d8a85]">
                  {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </span>
            </label>
            {error && <p role="alert" className="rounded-xl bg-[#fff3f3] p-3 text-sm font-bold text-[var(--danger)]">{error}</p>}
            <button className="btn btn-primary w-full" disabled={loading}>{loading ? "확인 중…" : "로그인"}</button>
          </form>
          <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold text-[var(--mint-700)]">
            <Link href="/?role=therapist">재활사 로그인</Link>
            <span>·</span>
            <Link href="/signup/therapist">재활사 회원가입</Link>
            <span>·</span>
            <Link href="/?role=admin">관리자</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
