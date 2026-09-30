import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getKoreanToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function normalizeGrammarTargets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((rawTarget) => {
    const target = rawTarget as Record<string, unknown>;
    const slot = String(target.slot ?? "");
    const base = String(target.base ?? "");
    const answer = String(target.answer ?? "");
    const completed = String(target.completed ?? "");
    const rawChoices = Array.isArray(target.choices) ? target.choices : [];
    let choiceValues = rawChoices.map((choice) =>
      typeof choice === "string" ? choice : String((choice as Record<string, unknown>).value ?? ""),
    ).filter(Boolean);
    if (slot === "verb_ending" && answer === "요" && !choiceValues.includes("요")) {
      choiceValues = ["아요", "어요", "요"];
    }
    const existingChoices = new Map(rawChoices.filter((choice) => typeof choice === "object" && choice !== null).map((choice) => {
      const item = choice as Record<string, unknown>;
      return [String(item.value ?? ""), String(item.preview ?? "")];
    }));
    const dictionaryForm = slot === "verb_ending"
      ? String(target.dictionaryForm ?? `${base}다`)
      : undefined;
    return {
      ...target,
      dictionaryForm,
      choices: choiceValues.map((choice) => ({
        value: choice,
        preview: existingChoices.get(choice) || (choice === answer ? completed : `${base}${choice}`),
      })),
      explanation: String(target.explanation ?? (slot === "verb_ending"
        ? `${dictionaryForm}와 ${answer}가 만나 ${completed}로 바뀌어요.`
        : `${base}와 ${answer}를 연결하면 ${completed}가 돼요.`)),
    };
  });
}

export async function GET() {
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
  const { data: plan, error: planError } = await admin
    .from("daily_plans")
    .select("id,reason")
    .eq("patient_id", user.id)
    .eq("plan_date", getKoreanToday())
    .maybeSingle();
  if (planError) return NextResponse.json({ error: "오늘의 훈련을 불러오지 못했습니다." }, { status: 500 });
  if (!plan) return NextResponse.json({ error: "오늘 생성된 훈련이 없습니다." }, { status: 404 });

  const { data: planItems, error: itemError } = await admin
    .from("daily_plan_items")
    .select("id,content_id,item_order,item_type")
    .eq("plan_id", plan.id)
    .order("item_order");
  if (itemError) return NextResponse.json({ error: "배정된 문장을 불러오지 못했습니다." }, { status: 500 });
  if (!planItems?.length) return NextResponse.json({ error: "오늘 배정된 문장이 없습니다." }, { status: 404 });

  const contentIds = planItems.map((item) => item.content_id);
  const { data: contents, error: contentError } = await admin
    .from("training_contents")
    .select("id,title,level,topic_id,image_path,image_alt,target_sentence,sentence_structure,keywords,grammar_targets")
    .in("id", contentIds);
  if (contentError) return NextResponse.json({ error: "훈련 콘텐츠를 불러오지 못했습니다." }, { status: 500 });

  const topicIds = [...new Set((contents ?? []).map((content) => content.topic_id).filter(Boolean))];
  const topicResult = topicIds.length
    ? await admin.from("topics").select("id,name").in("id", topicIds)
    : { data: [], error: null };
  if (topicResult.error) return NextResponse.json({ error: "훈련 주제를 불러오지 못했습니다." }, { status: 500 });

  const topics = new Map((topicResult.data ?? []).map((topic) => [topic.id, topic.name]));
  const contentMap = new Map((contents ?? []).map((content) => [content.id, content]));
  const items = planItems.flatMap((item) => {
    const content = contentMap.get(item.content_id);
    if (!content) return [];
    const imageUrl = content.image_path
      ? admin.storage.from("content-images").getPublicUrl(content.image_path).data.publicUrl
      : null;
    return [{
      id: item.id,
      itemOrder: item.item_order,
      itemType: item.item_type,
      content: {
        id: content.id,
        title: content.title,
        level: content.level,
        topic: topics.get(content.topic_id) ?? "미지정",
        imageUrl,
        imageAlt: content.image_alt,
        targetSentence: content.target_sentence,
        sentenceStructure: content.sentence_structure ?? [],
        keywords: content.keywords ?? [],
        grammarTargets: normalizeGrammarTargets(content.grammar_targets),
      },
    }];
  });

  return NextResponse.json({ plan: { id: plan.id, reason: plan.reason }, items });
}
