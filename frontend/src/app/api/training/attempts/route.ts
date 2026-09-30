import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  contentId: z.string().uuid(),
  step: z.string().min(1).max(80),
  target: z.string().min(1).max(300),
  hintLevel: z.number().int().min(0).max(10),
  success: z.boolean(),
  source: z.enum(["self", "companion", "therapist", "demo"]),
  responseMs: z.number().int().min(0).max(3_600_000).optional(),
  responseData: z.record(z.string(), z.unknown()).default({}),
  hints: z.array(z.object({ type: z.string().min(1).max(80), level: z.number().int().min(1).max(10) })).max(10).default([]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "patient" || profile.status !== "active") {
    return NextResponse.json({ error: "활성 환자 계정이 필요합니다." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "훈련 기록이 올바르지 않습니다." }, { status: 400 });
  const body = parsed.data;
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("training_sessions")
    .select("id,plan_id,completed_at")
    .eq("id", body.sessionId)
    .eq("patient_id", user.id)
    .maybeSingle();
  if (!session || session.completed_at) {
    return NextResponse.json({ error: "진행 중인 본인의 훈련에만 기록할 수 있습니다." }, { status: 403 });
  }

  const { data: planItem } = await admin
    .from("daily_plan_items")
    .select("id")
    .eq("plan_id", session.plan_id)
    .eq("content_id", body.contentId)
    .maybeSingle();
  if (!planItem) return NextResponse.json({ error: "오늘 배정된 콘텐츠만 기록할 수 있습니다." }, { status: 403 });

  const { data: duplicate } = await admin
    .from("training_attempts")
    .select("id")
    .eq("client_event_id", body.eventId)
    .maybeSingle();
  if (duplicate) return NextResponse.json({ id: duplicate.id, duplicate: true });

  const { data: attempt, error: attemptError } = await admin
    .from("training_attempts")
    .insert({
      client_event_id: body.eventId,
      session_id: body.sessionId,
      content_id: body.contentId,
      step: body.step,
      target: body.target,
      hint_level: body.hintLevel,
      success: body.success,
      judgment_source: body.source,
      response_ms: body.responseMs,
      response_data: body.responseData,
    })
    .select("id")
    .single();
  if (attemptError?.code === "23505") {
    // 같은 이벤트가 동시에 두 번 들어온 경우. 먼저 저장된 기록을 돌려준다.
    const { data: concurrent } = await admin
      .from("training_attempts")
      .select("id")
      .eq("client_event_id", body.eventId)
      .maybeSingle();
    if (concurrent) return NextResponse.json({ id: concurrent.id, duplicate: true });
  }
  if (attemptError || !attempt) {
    const migrationMissing = attemptError?.message.includes("client_event_id") || attemptError?.message.includes("response_data");
    return NextResponse.json({
      error: migrationMissing
        ? "훈련 기록용 데이터베이스 업데이트가 필요합니다. 최신 migration을 실행해주세요."
        : "훈련 수행 기록을 저장하지 못했습니다.",
    }, { status: 500 });
  }

  const { error: hintError } = body.hints.length
    ? await admin.from("hint_events").insert(body.hints.map((hint) => ({
        attempt_id: attempt.id,
        hint_type: hint.type,
        hint_level: hint.level,
      })))
    : { error: null };
  const { error: evaluationError } = await admin.from("evaluations").insert({
    attempt_id: attempt.id,
    evaluator_id: body.source === "self" ? user.id : null,
    source: body.source,
    is_success: body.success,
    note: JSON.stringify(body.responseData),
  });

  if (hintError || evaluationError) {
    await admin.from("training_attempts").delete().eq("id", attempt.id);
    return NextResponse.json({ error: "도움 또는 확인 기록을 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ id: attempt.id, duplicate: false }, { status: 201 });
}
