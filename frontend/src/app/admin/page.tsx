import Link from "next/link";
import { BookOpenCheck, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { StatCard } from "@/components/portal/stat-card";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const [pending, therapists, patients, published, review] = supabase ? await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "therapist").eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "therapist").eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "patient").eq("status", "active"),
    supabase.from("training_contents").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("training_contents").select("id", { count: "exact", head: true }).eq("status", "review"),
  ]) : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }];

  return <><p className="eyebrow">Admin dashboard</p><h1 className="mt-2 text-3xl font-bold">말이음 서비스 관리</h1><p className="mt-2 text-[var(--muted)]">Supabase에 저장된 실제 계정과 콘텐츠만 표시합니다.</p><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="승인 대기" value={`${pending.count ?? 0}명`} detail="재활사 가입 신청" icon={ShieldCheck} tone="orange"/><StatCard label="활성 재활사" value={`${therapists.count ?? 0}명`} detail="승인 완료 계정" icon={UserCheck}/><StatCard label="전체 환자" value={`${patients.count ?? 0}명`} detail="활성 환자 기준" icon={UsersRound}/><StatCard label="게시 콘텐츠" value={`${published.count ?? 0}개`} detail={`검토 대기 ${review.count ?? 0}개`} icon={BookOpenCheck}/></section><div className="mt-7 grid gap-5 lg:grid-cols-2"><Link href="/admin/therapists" className="card p-7 hover:border-[#9bcbb6]"><ShieldCheck className="text-[var(--mint-700)]" size={28}/><h2 className="mt-5 text-xl font-bold">재활사 가입 승인</h2><p className="mt-2 leading-7 text-[var(--muted)]">가입 신청자의 소속과 자격 정보를 확인합니다.</p></Link><Link href="/admin/contents" className="card p-7 hover:border-[#9bcbb6]"><BookOpenCheck className="text-[var(--mint-700)]" size={28}/><h2 className="mt-5 text-xl font-bold">훈련 콘텐츠 관리</h2><p className="mt-2 leading-7 text-[var(--muted)]">검토를 마친 콘텐츠만 환자 훈련에 게시합니다.</p></Link></div></>;
}
