import { NextResponse } from "next/server";
import type { ContentStatus, TrainingContent, TrainingLevel } from "@/lib/types";
import { isDemoPatientEmail } from "@/lib/auth/account-rules";
import { buildD1DailyPlan } from "@/lib/training/daily-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ContentRow = {
  id: string;
  title: string;
  level: number;
  topic_id: string;
  target_sentence: string;
  image_path: string | null;
  keywords: TrainingContent["keywords"];
  grammar_targets: TrainingContent["grammar"];
  status: ContentStatus;
};

function getKoreanToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

async function readPlanItems(admin: ReturnType<typeof createAdminClient>, planId: string) {
  const { data, error } = await admin
    .from("daily_plan_items")
    .select("id,content_id,item_order,item_type")
    .eq("plan_id", planId)
    .order("item_order");
  if (error) throw error;
  return data ?? [];
}

// 같은 날 계획으로 훈련을 다시 시작하지 않도록 오늘 세션 상태를 함께 알려준다.
// 확인용 환자는 완료 후 새 세션을 열 수 있으므로 진행 중인 세션을 먼저 본다.
async function readSessionStatus(admin: ReturnType<typeof createAdminClient>, patientId: string, planId: string) {
  const { data } = await admin
    .from("training_sessions")
    .select("completed_at")
    .eq("patient_id", patientId)
    .eq("plan_id", planId);
  if (data?.some((session) => !session.completed_at)) return "in_progress" as const;
  return data?.length ? "completed" as const : "not_started" as const;
}

export async function POST() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "patient" || profile.status !== "active") {
    return NextResponse.json({ error: "활성 환자 계정이 필요합니다." }, { status: 403 });
  }

  const admin = createAdminClient();
  const today = getKoreanToday();
  const canReplay = isDemoPatientEmail(user.email);
  const { data: existingPlan, error: existingPlanError } = await admin
    .from("daily_plans")
    .select("id,reason")
    .eq("patient_id", user.id)
    .eq("plan_date", today)
    .maybeSingle();
  if (existingPlanError) return NextResponse.json({ error: "오늘의 훈련을 확인하지 못했습니다." }, { status: 500 });

  if (existingPlan) {
    const existingItems = await readPlanItems(admin, existingPlan.id);
    if (existingItems.length > 0) {
      return NextResponse.json({
        planId: existingPlan.id,
        itemCount: existingItems.length,
        reason: existingPlan.reason,
        items: existingItems,
        reused: true,
        sessionStatus: await readSessionStatus(admin, user.id, existingPlan.id),
        canReplay,
      });
    }
  }

  const { data: settings, error: settingsError } = await admin
    .from("learner_settings")
    .select("training_level,daily_count,topics,excluded_topics")
    .eq("patient_id", user.id)
    .maybeSingle();
  if (settingsError) return NextResponse.json({ error: "훈련 설정을 확인하지 못했습니다." }, { status: 500 });
  if (!settings) {
    return NextResponse.json({
      planId: null,
      itemCount: 0,
      message: "담당 재활사가 초기 훈련 설정을 완료하면 훈련이 준비됩니다.",
    });
  }

  const selectedTopicNames = (settings.topics ?? []).filter(
    (topic: string) => !(settings.excluded_topics ?? []).includes(topic),
  );
  if (selectedTopicNames.length === 0) {
    return NextResponse.json({
      planId: null,
      itemCount: 0,
      message: "선택된 훈련 주제가 없습니다. 담당 재활사에게 확인해주세요.",
    });
  }

  const { data: topicRows, error: topicError } = await admin
    .from("topics")
    .select("id,name")
    .eq("is_active", true)
    .in("name", selectedTopicNames);
  if (topicError) return NextResponse.json({ error: "훈련 주제를 확인하지 못했습니다." }, { status: 500 });

  const topicNameById = new Map((topicRows ?? []).map((topic) => [topic.id, topic.name]));
  const topicIds = [...topicNameById.keys()];
  if (topicIds.length === 0) {
    return NextResponse.json({ planId: null, itemCount: 0, message: "사용할 수 있는 훈련 주제가 없습니다." });
  }

  const { data: contentRows, error: contentError } = await admin
    .from("training_contents")
    .select("id,title,level,topic_id,target_sentence,image_path,keywords,grammar_targets,status")
    .eq("status", "published")
    .eq("level", settings.training_level)
    .in("topic_id", topicIds)
    .not("image_path", "is", null)
    .order("created_at", { ascending: true });
  if (contentError) return NextResponse.json({ error: "훈련 콘텐츠를 확인하지 못했습니다." }, { status: 500 });

  const contents = (contentRows as ContentRow[] | null ?? []).map((row): TrainingContent => ({
    id: row.id,
    title: row.title,
    level: row.level as TrainingLevel,
    topic: topicNameById.get(row.topic_id) ?? "미지정",
    targetSentence: row.target_sentence,
    imagePath: row.image_path,
    keywords: row.keywords ?? [],
    grammar: row.grammar_targets ?? [],
    status: row.status,
  }));

  const { data: previousPlans, error: previousPlanError } = await admin
    .from("daily_plans")
    .select("id,plan_date")
    .eq("patient_id", user.id)
    .lt("plan_date", today)
    .order("plan_date", { ascending: false })
    .limit(60);
  if (previousPlanError) return NextResponse.json({ error: "이전 훈련 기록을 확인하지 못했습니다." }, { status: 500 });

  const previousPlanIds = (previousPlans ?? []).map((plan) => plan.id);
  const previousItems = previousPlanIds.length > 0
    ? await admin.from("daily_plan_items").select("plan_id,content_id,item_order").in("plan_id", previousPlanIds)
    : { data: [], error: null };
  if (previousItems.error) return NextResponse.json({ error: "이전 훈련 내용을 확인하지 못했습니다." }, { status: 500 });

  const planRank = new Map(previousPlanIds.map((id, index) => [id, index]));
  const recentContentIds = (previousItems.data ?? [])
    .sort((a, b) => (planRank.get(a.plan_id) ?? 0) - (planRank.get(b.plan_id) ?? 0) || a.item_order - b.item_order)
    .map((item) => item.content_id);
  const plannedItems = buildD1DailyPlan(contents, {
    level: settings.training_level as TrainingLevel,
    topics: selectedTopicNames,
    excludedTopics: settings.excluded_topics ?? [],
    dailyCount: settings.daily_count,
    recentContentIds,
  });

  if (plannedItems.length === 0) {
    return NextResponse.json({
      planId: null,
      itemCount: 0,
      message: "현재 설정에 맞는 게시된 훈련 콘텐츠가 없습니다.",
    });
  }

  const reason = "설정된 단계와 주제에 맞춰 오늘의 훈련을 준비했어요.";
  let planId = existingPlan?.id;
  if (!planId) {
    const { data: createdPlan, error: createPlanError } = await admin
      .from("daily_plans")
      .insert({ patient_id: user.id, plan_date: today, source: "d1_rules", reason })
      .select("id")
      .single();

    if (createPlanError?.code === "23505") {
      const { data: concurrentPlan } = await admin
        .from("daily_plans")
        .select("id")
        .eq("patient_id", user.id)
        .eq("plan_date", today)
        .single();
      planId = concurrentPlan?.id;
    } else if (createPlanError || !createdPlan) {
      return NextResponse.json({ error: "오늘의 훈련을 생성하지 못했습니다." }, { status: 500 });
    } else {
      planId = createdPlan.id;
    }
  }

  if (!planId) return NextResponse.json({ error: "오늘의 훈련을 생성하지 못했습니다." }, { status: 500 });

  const existingItemsAfterCreate = await readPlanItems(admin, planId);
  if (existingItemsAfterCreate.length > 0) {
    return NextResponse.json({ planId, itemCount: existingItemsAfterCreate.length, reason, items: existingItemsAfterCreate, reused: true, sessionStatus: await readSessionStatus(admin, user.id, planId), canReplay });
  }

  const { data: insertedItems, error: itemError } = await admin
    .from("daily_plan_items")
    .insert(plannedItems.map((item) => ({
      plan_id: planId,
      content_id: item.content.id,
      item_order: item.order,
      item_type: item.itemType,
    })))
    .select("id,content_id,item_order,item_type");

  if (itemError) {
    const concurrentItems = await readPlanItems(admin, planId);
    if (concurrentItems.length > 0) {
      return NextResponse.json({ planId, itemCount: concurrentItems.length, reason, items: concurrentItems, reused: true, sessionStatus: await readSessionStatus(admin, user.id, planId), canReplay });
    }
    return NextResponse.json({ error: "훈련 문장을 배정하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    planId,
    itemCount: insertedItems?.length ?? 0,
    reason,
    items: insertedItems ?? [],
    reused: false,
    sessionStatus: "not_started",
    canReplay,
  }, { status: 201 });
}
