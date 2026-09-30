import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum(["draft", "review", "published", "archived"]).optional(),
  imagePath: z.string().min(1).nullable().optional(),
  imageAlt: z.string().min(1).optional(),
}).refine((value) => Object.keys(value).length > 0);

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
  const admin = createAdminClient();
  const { data: current, error: readError } = await admin.from("training_contents").select("image_path").eq("id", id).single();
  if (readError) return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다." }, { status: 404 });

  const effectiveImagePath = parsed.data.imagePath === undefined ? current.image_path : parsed.data.imagePath;
  if (parsed.data.status === "published" && !effectiveImagePath) {
    return NextResponse.json({ error: "훈련 이미지를 등록한 뒤 게시할 수 있습니다." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    updates.reviewed_by = user.id;
    updates.published_at = parsed.data.status === "published" ? new Date().toISOString() : null;
  }
  if (parsed.data.imagePath !== undefined) updates.image_path = parsed.data.imagePath;
  if (parsed.data.imageAlt !== undefined) updates.image_alt = parsed.data.imageAlt;

  const { error } = await admin.from("training_contents").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "콘텐츠를 처리하지 못했습니다." }, { status: 500 });
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: parsed.data.status ? `content_${parsed.data.status}` : "content_updated",
    target_type: "training_content",
    target_id: id,
  });
  return NextResponse.json({ ok: true });
}
