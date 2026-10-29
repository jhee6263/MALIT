import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ therapistId: z.string().uuid() });

// 담당 재활사가 없는 환자에게 담당 재활사를 배정한다. 재활사가 연결을 해제한 환자를 다시 연결할 때 쓴다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "환자 정보가 올바르지 않습니다." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (me?.role !== "admin" || me.status !== "active") return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "담당 재활사를 선택해주세요." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: patient }, { data: therapist }, { data: existing }] = await Promise.all([
    admin.from("profiles").select("id,role,login_id").eq("id", id).single(),
    admin.from("profiles").select("id,role,status").eq("id", parsed.data.therapistId).single(),
    admin.from("therapist_patient_links").select("therapist_id").eq("patient_id", id).limit(1),
  ]);
  if (patient?.role !== "patient") return NextResponse.json({ error: "환자 계정을 찾을 수 없습니다." }, { status: 404 });
  if (therapist?.role !== "therapist" || therapist.status !== "active") return NextResponse.json({ error: "활성 재활사만 배정할 수 있습니다." }, { status: 400 });
  if (existing?.length) return NextResponse.json({ error: "이미 담당 재활사가 있는 환자입니다." }, { status: 409 });

  const { error } = await admin.from("therapist_patient_links").insert({ therapist_id: parsed.data.therapistId, patient_id: id });
  if (error) return NextResponse.json({ error: "담당 재활사를 배정하지 못했습니다." }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "patient_linked",
    target_type: "profile",
    target_id: id,
    detail: { therapist_id: parsed.data.therapistId, login_id: patient.login_id },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
