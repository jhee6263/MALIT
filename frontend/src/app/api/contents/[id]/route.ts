import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  acceptedExpressionsSchema,
  buildGrammarTarget,
  grammarTargetsSchema,
  keywordsSchema,
  toGrammarInput,
} from "@/lib/training/content-schema";

const schema = z.object({
  status: z.enum(["draft", "review", "published", "archived"]).optional(),
  imagePath: z.string().min(1).nullable().optional(),
  imageAlt: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(100).optional(),
  targetSentence: z.string().trim().min(1).max(120).optional(),
  acceptedExpressions: acceptedExpressionsSchema.optional(),
  keywords: keywordsSchema.optional(),
  grammarTargets: grammarTargetsSchema.optional(),
}).refine((value) => Object.keys(value).length > 0);

async function authorizeAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 }) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.status !== "active") {
    return { error: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeAdmin();
  if ("error" in authorization) return authorization.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다." }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("training_contents")
    .select("id,title,level,status,image_path,image_alt,target_sentence,accepted_expressions,keywords,grammar_targets,topics(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "콘텐츠를 불러오지 못했습니다." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다." }, { status: 404 });

  const topic = Array.isArray(data.topics) ? data.topics[0] : data.topics;
  return NextResponse.json({
    id: data.id,
    title: data.title,
    level: data.level,
    status: data.status,
    topic: topic?.name ?? "미지정",
    imagePath: data.image_path,
    imageUrl: data.image_path ? admin.storage.from("content-images").getPublicUrl(data.image_path).data.publicUrl : null,
    imageAlt: data.image_alt ?? "",
    targetSentence: data.target_sentence,
    acceptedExpressions: data.accepted_expressions ?? [],
    keywords: data.keywords ?? [],
    grammarTargets: (data.grammar_targets ?? []).map(toGrammarInput),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeAdmin();
  if ("error" in authorization) return authorization.error;
  const { user } = authorization;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "수정할 내용을 확인해주세요." }, { status: 400 });
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { data: current, error: readError } = await admin.from("training_contents").select("status,image_path,keywords,grammar_targets").eq("id", id).single();
  if (readError) return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다." }, { status: 404 });

  // 수정 후 상태가 "게시됨"이면 환자 훈련 화면이 그대로 쓰므로 단계가 모두 갖춰져야 한다.
  // 게시 전환뿐 아니라 이미 게시된 콘텐츠를 고치는 경우에도 같은 기준을 적용한다.
  const finalStatus = parsed.data.status ?? current.status;
  if (finalStatus === "published") {
    const effectiveImagePath = parsed.data.imagePath === undefined ? current.image_path : parsed.data.imagePath;
    if (!effectiveImagePath) return NextResponse.json({ error: "훈련 이미지를 등록한 뒤 게시할 수 있습니다." }, { status: 400 });
    const keywordCount = parsed.data.keywords ? parsed.data.keywords.length : Array.isArray(current.keywords) ? current.keywords.length : 0;
    const grammarCount = parsed.data.grammarTargets ? parsed.data.grammarTargets.length : Array.isArray(current.grammar_targets) ? current.grammar_targets.length : 0;
    // 핵심어나 문법 목표가 비어 있으면 환자 훈련 화면이 단계 없이 진행되므로 게시하지 않는다.
    if (keywordCount === 0 || grammarCount === 0) {
      return NextResponse.json({ error: "핵심어와 문법 목표가 입력된 콘텐츠만 게시할 수 있습니다." }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    updates.reviewed_by = user.id;
    updates.published_at = parsed.data.status === "published" ? new Date().toISOString() : null;
  }
  if (parsed.data.imagePath !== undefined) updates.image_path = parsed.data.imagePath;
  if (parsed.data.imageAlt !== undefined) updates.image_alt = parsed.data.imageAlt;
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.targetSentence !== undefined) updates.target_sentence = parsed.data.targetSentence;
  if (parsed.data.acceptedExpressions !== undefined) updates.accepted_expressions = parsed.data.acceptedExpressions;
  if (parsed.data.keywords !== undefined) updates.keywords = parsed.data.keywords;
  if (parsed.data.grammarTargets !== undefined) updates.grammar_targets = parsed.data.grammarTargets.map(buildGrammarTarget);

  const { error } = await admin.from("training_contents").update(updates).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.code === "23505" ? "이미 같은 이름의 콘텐츠가 있습니다." : "콘텐츠를 처리하지 못했습니다." }, { status: error.code === "23505" ? 409 : 500 });
  }
  const editedFields = Object.keys(parsed.data).filter((key) => key !== "status");
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: parsed.data.status ? `content_${parsed.data.status}` : "content_updated",
    target_type: "training_content",
    target_id: id,
    ...(editedFields.length ? { detail: { fields: editedFields } } : {}),
  });
  return NextResponse.json({ ok: true });
}
