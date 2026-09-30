import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const patientIdSchema = z.string().uuid();
const settingsSchema = z.object({
  level: z.coerce.number().int().min(1).max(3),
  dailyCount: z.coerce.number().int().min(1).max(20),
  topics: z.array(z.string().trim().min(1)).min(1),
});

async function authorizeTherapist(patientId: string) {
  const supabase = await createClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 }) };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "therapist" || profile.status !== "active") {
    return { error: NextResponse.json({ error: "활성 재활사 계정이 필요합니다." }, { status: 403 }) };
  }

  const { data: link } = await supabase
    .from("therapist_patient_links")
    .select("patient_id")
    .eq("therapist_id", user.id)
    .eq("patient_id", patientId)
    .maybeSingle();
  if (!link) {
    return { error: NextResponse.json({ error: "담당 환자의 설정만 변경할 수 있습니다." }, { status: 403 }) };
  }

  return { supabase, user };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!patientIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "환자 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const authorization = await authorizeTherapist(id);
  if ("error" in authorization) return authorization.error;

  const { supabase } = authorization;
  const [patientResult, settingsResult] = await Promise.all([
    supabase.from("profiles").select("id,name,login_id").eq("id", id).single(),
    supabase
      .from("learner_settings")
      .select("training_level,daily_count,topics")
      .eq("patient_id", id)
      .single(),
  ]);

  if (patientResult.error || settingsResult.error) {
    return NextResponse.json({ error: "환자의 훈련 설정을 불러오지 못했습니다." }, { status: 404 });
  }

  return NextResponse.json({ patient: patientResult.data, settings: settingsResult.data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!patientIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "환자 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const authorization = await authorizeTherapist(id);
  if ("error" in authorization) return authorization.error;

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "훈련 설정을 확인해주세요." }, { status: 400 });
  }

  const { level, dailyCount, topics } = parsed.data;
  const uniqueTopics = [...new Set(topics)];
  const admin = createAdminClient();
  const { data: activeTopics, error: topicError } = await admin
    .from("topics")
    .select("name")
    .eq("is_active", true)
    .in("name", uniqueTopics);

  if (topicError || (activeTopics?.length ?? 0) !== uniqueTopics.length) {
    return NextResponse.json({ error: "현재 사용할 수 있는 훈련 주제만 선택해주세요." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("learner_settings")
    .update({
      training_level: level,
      daily_count: dailyCount,
      topics: uniqueTopics,
      updated_by: authorization.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("patient_id", id)
    .select("training_level,daily_count,topics")
    .single();

  if (error) {
    return NextResponse.json({ error: "훈련 설정을 저장하지 못했습니다." }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    actor_id: authorization.user.id,
    action: "learner_settings_updated",
    target_type: "profile",
    target_id: id,
    detail: { training_level: level, daily_count: dailyCount, topics: uniqueTopics },
  });

  return NextResponse.json(data);
}
