"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Brand } from "@/components/brand";
import { Footer } from "@/components/footer";
import { DEFAULT_TEST_PASSWORD } from "@/lib/auth/account-rules";

export default function TherapistSignup() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      organization: String(form.get("organization") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      credential: String(form.get("credential") ?? ""),
    };

    if (payload.password.length < 8) {
      setError("비밀번호는 8자 이상으로 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/therapist-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "가입 신청을 처리하지 못했습니다.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="container flex min-h-[76px] items-center">
          <Brand compact />
        </div>
      </header>
      <main className="container flex flex-1 justify-center py-10">
        {done ? (
          <section className="card my-auto max-w-[570px] p-10 text-center">
            <CheckCircle2 className="mx-auto mb-5 text-[var(--mint-700)]" size={56} />
            <h1 className="text-2xl font-bold">가입 신청이 완료됐어요</h1>
            <p className="mt-3 leading-7 text-[var(--muted)]">
              이메일 인증은 필요하지 않습니다.
              <br />
              관리자가 승인하면 바로 로그인할 수 있어요.
            </p>
            <Link className="btn btn-primary mt-7" href="/">
              로그인 화면으로
            </Link>
          </section>
        ) : (
          <section className="card w-full max-w-[650px] p-7 sm:p-10">
            <p className="eyebrow">Therapist account</p>
            <h1 className="mt-2 text-3xl font-bold">재활사 회원가입</h1>
            <p className="mt-2 text-[var(--muted)]">
              이메일 인증 없이 관리자 승인 후 사용할 수 있습니다.
            </p>
            <form onSubmit={submit} className="mt-8 grid gap-5 sm:grid-cols-2">
              <label>
                <span className="mb-2 block font-bold">이름</span>
                <input className="field" name="name" required />
              </label>
              <label>
                <span className="mb-2 block font-bold">소속 기관</span>
                <input className="field" name="organization" required />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block font-bold">이메일</span>
                <input className="field" name="email" type="email" required />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block font-bold">비밀번호</span>
                <input
                  className="field"
                  name="password"
                  type="password"
                  minLength={8}
                  defaultValue={DEFAULT_TEST_PASSWORD}
                  required
                />
                <span className="mt-2 block text-sm text-[var(--muted)]">
                  현재 테스트 기본값은 {DEFAULT_TEST_PASSWORD}입니다.
                </span>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block font-bold">자격 정보</span>
                <textarea
                  className="field min-h-24"
                  name="credential"
                  placeholder="자격 종류와 자격번호를 입력해주세요."
                  required
                />
              </label>
              {error && (
                <p className="sm:col-span-2 text-sm font-bold text-[var(--danger)]" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-3 sm:col-span-2">
                <Link href="/" className="btn btn-secondary flex-1">
                  취소
                </Link>
                <button className="btn btn-primary flex-1" disabled={loading}>
                  {loading ? "신청 중…" : "가입 신청"}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
