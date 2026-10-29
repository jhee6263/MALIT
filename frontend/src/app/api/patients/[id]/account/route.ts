import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkPatientAccountAction,
  DEFAULT_TEST_PASSWORD,
  PATIENT_PASSWORD_MIN_LENGTH,
} from "@/lib/auth/account-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 정지 기간. Supabase는 영구 정지를 지원하지 않아 사실상 끝없는 값을 쓴다. 다시 사용하면 해제한다.
const SUSPEND_DURATION = "876000h";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_password"), password: z.string().min(PATIENT_PASSWORD_MIN_LENGTH).max(72) }),
  z.object({ action: z.literal("reset_password") }),
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("unlink") }),
]);

// 담당 환자의 계정을 관리하는 API. 비밀번호 변경, 정지·재개, 연결 해제를 한 곳에서 처리하고 모두 감사 기록을 남긴다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "환자 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (me?.role !== "therapist" || me.status !== "active") {
    return NextResponse.json({ error: "활성 재활사 계정이 필요합니다." }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const tooShort = parsed.error.issues.some((issue) => issue.path[0] === "password");
    return NextResponse.json(
      { error: tooShort ? `비밀번호는 ${PATIENT_PASSWORD_MIN_LENGTH}자 이상 입력해주세요.` : "요청이 올바르지 않습니다." },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const admin = createAdminClient();
  // 담당 환자인지는 서버 키로 직접 확인한다. 화면에서 받은 값은 믿지 않는다.
  const { data: link } = await admin
    .from("therapist_patient_links")
    .select("patient_id")
    .eq("therapist_id", user.id)
    .eq("patient_id", id)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "담당 환자의 계정만 관리할 수 있습니다." }, { status: 403 });

  const { data: patient } = await admin.from("profiles").select("role,status,login_id").eq("id", id).single();
  if (!patient || patient.role !== "patient") {
    return NextResponse.json({ error: "환자 계정을 찾을 수 없습니다." }, { status: 404 });
  }
  const refusal = checkPatientAccountAction(body.action, { status: patient.status, loginId: patient.login_id });
  if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });

  const log = (action: string) => admin.from("audit_logs").insert({
    actor_id: user.id,
    action,
    target_type: "profile",
    target_id: id,
    detail: { login_id: patient.login_id },
  });

  if (body.action === "set_password" || body.action === "reset_password") {
    const password = body.action === "set_password" ? body.password : DEFAULT_TEST_PASSWORD;
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: "비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    await log(body.action === "set_password" ? "patient_password_set" : "patient_password_reset");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "suspend") {
    // 인증 단계에서 새 로그인과 세션 갱신을 막고, 계정 상태로 모든 요청을 막는다. 상태를 바꾸지 못하면 정지를 되돌린다.
    const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: SUSPEND_DURATION });
    if (banError) return NextResponse.json({ error: "계정을 정지하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    const { error } = await admin.from("profiles").update({ status: "suspended", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
      return NextResponse.json({ error: "계정을 정지하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }
    await log("patient_suspended");
    return NextResponse.json({ ok: true, status: "suspended" });
  }

  if (body.action === "resume") {
    const { error } = await admin.from("profiles").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: "계정을 다시 사용하게 하지 못했습니다." }, { status: 500 });
    const { error: unbanError } = await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (unbanError) {
      await admin.from("profiles").update({ status: "suspended", updated_at: new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ error: "계정을 다시 사용하게 하지 못했습니다." }, { status: 500 });
    }
    await log("patient_resumed");
    return NextResponse.json({ ok: true, status: "active" });
  }

  // 연결 해제: 환자 계정과 훈련 기록은 그대로 두고 담당 관계만 끊는다. 다시 연결하는 것은 관리자가 한다.
  const { error } = await admin.from("therapist_patient_links").delete().eq("therapist_id", user.id).eq("patient_id", id);
  if (error) return NextResponse.json({ error: "연결을 해제하지 못했습니다." }, { status: 500 });
  await log("patient_unlinked");
  return NextResponse.json({ ok: true });
}
