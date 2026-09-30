import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const includeInactive = new URL(request.url).searchParams.get("all") === "true";
  let query = supabase.from("topics").select("id,name,is_active,sort_order").order("sort_order");
  if (includeInactive) {
    const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
    if (profile?.role !== "admin" || profile.status !== "active") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
  } else {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "주제를 처리하지 못했습니다." }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.status !== "active") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "주제 이름을 확인해주세요." }, { status: 400 });

  const admin = createAdminClient();
  const { data: last } = await admin.from("topics").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await admin.from("topics").insert({
    name: parsed.data.name,
    is_active: true,
    sort_order: (last?.sort_order ?? 0) + 10,
  }).select("id,name,is_active,sort_order").single();
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "이미 등록된 주제입니다." : "주제를 저장하지 못했습니다." }, { status: 400 });
  }
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "topic_created", target_type: "topic", target_id: data.id });
  return NextResponse.json(data, { status: 201 });
}
