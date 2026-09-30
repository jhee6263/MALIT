import { ApprovalList } from "./approval-list";
import { createClient } from "@/lib/supabase/server";

export default async function TherapistApprovalPage() {
  const supabase = await createClient();
  const result = supabase ? await supabase.from("profiles").select("id,name,organization,credential,created_at").eq("role", "therapist").eq("status", "pending").order("created_at") : { data: [] };
  return <><p className="eyebrow">Account approval</p><h1 className="mt-2 text-3xl font-bold">재활사 가입 승인</h1><p className="mt-2 text-[var(--muted)]">실제 가입 신청만 표시되며 모든 승인 결정은 감사 기록에 남습니다.</p><ApprovalList initialItems={result.data ?? []}/></>;
}
