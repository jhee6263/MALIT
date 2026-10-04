import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoPatientEmail } from "@/lib/auth/account-rules";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({ planId: z.string().uuid() });
const updateSchema = z.object({
  sessionId: z.string().uuid(),
  sentenceCount: z.number().int().min(0).max(20),
  completed: z.boolean().default(false),
});

async function getActivePatient() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 }) };
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "patient" || profile.status !== "active") {
    return { error: NextResponse.json({ error: "활성 환자 계정이 필요합니다." }, { status: 403 }) };
  }
  return { supabase, user };
}

export async function POST(request: Request) {
  const authorization = await getActivePatient();
  if ("error" in authorization) return authorization.error;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "훈련 계획 정보가 올바르지 않습니다." }, { status: 400 });

  const { supabase, user } = authorization;
  const { data: plan } = await supabase
    .from("daily_plans")
    .select("id")
    .eq("id", parsed.data.planId)
    .eq("patient_id", user.id)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "본인의 오늘 훈련만 시작할 수 있습니다." }, { status: 403 });

  const { data: existing, error: existingError } = await supabase
    .from("training_sessions")
    .select("id,sentence_count,started_at")
    .eq("patient_id", user.id)
    .eq("plan_id", plan.id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "진행 중인 훈련을 확인하지 못했습니다." }, { status: 500 });
  if (existing) return NextResponse.json({ ...existing, resumed: true });

  // 오늘 계획을 이미 마쳤으면 같은 문장으로 새 세션을 만들지 않는다. 확인용 환자는 다시 체험할 수 있다.
  const { data: completed } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("patient_id", user.id)
    .eq("plan_id", plan.id)
    .not("completed_at", "is", null)
    .limit(1)
    .maybeSingle();
  if (completed && !isDemoPatientEmail(user.email)) return NextResponse.json({ error: "오늘 연습을 이미 마쳤어요. 내일 새 문장으로 만나요." }, { status: 409 });

  const { data, error } = await supabase
    .from("training_sessions")
    .insert({ patient_id: user.id, plan_id: plan.id })
    .select("id,sentence_count,started_at")
    .single();
  if (error) return NextResponse.json({ error: "훈련 세션을 시작하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ...data, resumed: false }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await getActivePatient();
  if ("error" in authorization) return authorization.error;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "훈련 진행 정보가 올바르지 않습니다." }, { status: 400 });

  const { supabase, user } = authorization;
  const { data: session } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", parsed.data.sessionId)
    .eq("patient_id", user.id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "본인의 훈련 세션만 변경할 수 있습니다." }, { status: 403 });

  const updates: { sentence_count: number; completed_at?: string } = {
    sentence_count: parsed.data.sentenceCount,
  };
  if (parsed.data.completed) updates.completed_at = new Date().toISOString();
  const { error } = await supabase.from("training_sessions").update(updates).eq("id", session.id);
  if (error) return NextResponse.json({ error: "훈련 진행 위치를 저장하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
