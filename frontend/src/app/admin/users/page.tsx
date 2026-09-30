import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/portal/empty-state";
import { createClient } from "@/lib/supabase/server";

const roleLabel = { admin: "관리자", therapist: "재활사", patient: "환자" } as const;
const statusLabel = { pending: "승인 대기", active: "활성", rejected: "반려", suspended: "이용 중지" } as const;

export default async function UsersPage() {
  const supabase = await createClient();
  const result = supabase ? await supabase.from("profiles").select("id,name,login_id,role,status,organization,created_at").order("created_at", { ascending: false }) : { data: [] };
  const users = result.data ?? [];
  return <><p className="eyebrow">User management</p><h1 className="mt-2 text-3xl font-bold">사용자 관리</h1><p className="mt-2 text-[var(--muted)]">Supabase의 profiles 테이블에 저장된 사용자입니다.</p><section className="card mt-8 overflow-hidden">{users.length === 0 ? <EmptyState icon={UsersRound} title="등록된 사용자가 없습니다" description="새 사용자가 등록되면 이곳에 표시됩니다."/> : <div className="table-wrap"><table><thead><tr><th>이름</th><th>로그인 아이디</th><th>역할</th><th>상태</th><th>소속</th><th>가입일</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td className="font-bold">{user.name}</td><td>{user.login_id || "-"}</td><td>{roleLabel[user.role as keyof typeof roleLabel]}</td><td><span className={`pill ${user.status === "active" ? "pill-green" : "pill-orange"}`}>{statusLabel[user.status as keyof typeof statusLabel]}</span></td><td>{user.organization || "-"}</td><td>{new Date(user.created_at).toLocaleDateString("ko-KR")}</td></tr>)}</tbody></table></div>}</section></>;
}
