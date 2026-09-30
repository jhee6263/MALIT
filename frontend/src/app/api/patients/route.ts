import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_TEST_PASSWORD,
  normalizePatientLoginId,
  toPatientInternalEmail,
} from "@/lib/auth/account-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(50),
  loginId: z
    .string()
    .transform(normalizePatientLoginId)
    .pipe(z.string().regex(/^[a-z0-9][a-z0-9._-]{2,29}$/)),
  birthYear: z.preprocess(
    (value) => (value === "" || value === undefined ? null : Number(value)),
    z.number().int().min(1900).max(2100).nullable(),
  ),
  level: z.coerce.number().int().min(1).max(3),
  dailyCount: z.coerce.number().int().min(1).max(20),
  topics: z.array(z.string().trim().min(1)).min(1),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "therapist" || profile.status !== "active") {
    return NextResponse.json(
      { error: "활성 재활사만 환자를 등록할 수 있습니다." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력값을 확인해주세요.", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const admin = createAdminClient();
  const uniqueTopics = [...new Set(body.topics)];
  const { data: activeTopics, error: topicError } = await admin
    .from("topics")
    .select("name")
    .eq("is_active", true)
    .in("name", uniqueTopics);
  if (topicError || (activeTopics?.length ?? 0) !== uniqueTopics.length) {
    return NextResponse.json({ error: "현재 사용할 수 있는 훈련 주제만 선택해주세요." }, { status: 400 });
  }

  const { data: duplicate } = await admin
    .from("profiles")
    .select("id")
    .eq("login_id", body.loginId)
    .maybeSingle();
  if (duplicate) {
    return NextResponse.json(
      { error: "이미 사용 중인 로그인 아이디입니다." },
      { status: 409 },
    );
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: toPatientInternalEmail(body.loginId),
    password: DEFAULT_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: body.name,
      login_id: body.loginId,
      birth_year: body.birthYear,
      role: "patient",
    },
    // 역할은 클라이언트가 바꿀 수 없는 app_metadata 기준으로 DB 트리거가 판단한다.
    app_metadata: { role: "patient" },
  });
  if (createError || !created.user) {
    const duplicateAccount = createError?.message.toLowerCase().includes("already");
    return NextResponse.json(
      { error: duplicateAccount ? "이미 사용 중인 로그인 아이디입니다." : "환자 계정을 생성하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: duplicateAccount ? 409 : 500 },
    );
  }

  const patientId = created.user.id;
  const { error: linkError } = await admin.from("therapist_patient_links").insert({
    therapist_id: user.id,
    patient_id: patientId,
  });
  const { error: settingsError } = linkError
    ? { error: null }
    : await admin.from("learner_settings").insert({
        patient_id: patientId,
        training_level: body.level,
        daily_count: body.dailyCount,
        topics: uniqueTopics,
        updated_by: user.id,
      });

  if (linkError || settingsError) {
    await admin.auth.admin.deleteUser(patientId);
    return NextResponse.json(
      { error: "환자 계정과 훈련 설정을 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "patient_created",
    target_type: "profile",
    target_id: patientId,
    detail: { login_id: body.loginId },
  });

  return NextResponse.json(
    { id: patientId, loginId: body.loginId },
    { status: 201 },
  );
}
