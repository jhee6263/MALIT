import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const profileResult = user && supabase
    ? await supabase.from("profiles").select("name,organization,credential").eq("id", user.id).single()
    : { data: null };
  const profile = profileResult.data;

  return (
    <>
      <p className="eyebrow">My account</p>
      <h1 className="mt-2 text-3xl font-bold">내 계정</h1>
      <p className="mt-2 text-[var(--muted)]">계정 정보를 확인하고 비밀번호를 변경합니다. 환자별 훈련 설정은 환자 관리에서 변경합니다.</p>

      <section className="card mt-8 max-w-3xl p-7">
        <h2 className="text-xl font-bold">계정 정보</h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm font-bold text-[var(--muted)]">이름</dt><dd className="mt-1 font-bold">{profile?.name ?? "-"}</dd></div>
          <div><dt className="text-sm font-bold text-[var(--muted)]">이메일</dt><dd className="mt-1 break-all font-bold">{user?.email ?? "-"}</dd></div>
          <div><dt className="text-sm font-bold text-[var(--muted)]">소속 기관</dt><dd className="mt-1 font-bold">{profile?.organization || "-"}</dd></div>
          <div><dt className="text-sm font-bold text-[var(--muted)]">자격 정보</dt><dd className="mt-1 font-bold">{profile?.credential || "-"}</dd></div>
        </dl>
      </section>

      <section className="card mt-6 max-w-3xl p-7">
        <h2 className="text-xl font-bold">비밀번호 변경</h2>
        <PasswordForm />
      </section>
    </>
  );
}
