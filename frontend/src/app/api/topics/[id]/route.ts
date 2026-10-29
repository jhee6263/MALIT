import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.isActive !== undefined);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.status !== "active") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "수정할 내용을 확인해주세요." }, { status: 400 });

  const { id } = await params;
  const updates: { name?: string; is_active?: boolean } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive;
  const admin = createAdminClient();
  const { data: before } = await admin.from("topics").select("name").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "주제를 찾을 수 없습니다." }, { status: 404 });

  const { data, error } = await admin.from("topics").update(updates).eq("id", id).select("id,name,is_active,sort_order").single();
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "이미 등록된 주제 이름입니다." : "주제를 저장하지 못했습니다." }, { status: 400 });
  }

  // 환자 설정은 주제를 이름으로 저장하므로, 이름이 바뀌면 설정의 이름도 함께 바꿔야 훈련 계획에서 주제를 찾는다.
  if (updates.name !== undefined && updates.name !== before.name) {
    const renameIn = (names: string[]) => names.map((name) => (name === before.name ? updates.name! : name));
    for (const column of ["topics", "excluded_topics"] as const) {
      const { data: rows } = await admin.from("learner_settings").select("patient_id,topics,excluded_topics").contains(column, [before.name]);
      for (const row of rows ?? []) {
        await admin.from("learner_settings").update({ [column]: renameIn(row[column] ?? []) }).eq("patient_id", row.patient_id);
      }
    }
  }
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "topic_updated", target_type: "topic", target_id: id, detail: updates });
  return NextResponse.json(data);
}
