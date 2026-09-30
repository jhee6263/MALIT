import { NextResponse } from "next/server";
import { z } from "zod";
import { PATIENT_EMAIL_DOMAIN } from "@/lib/auth/account-rules";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(1).max(50),
  organization: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  credential: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력한 내용을 다시 확인해주세요." },
      { status: 400 },
    );
  }

  const { name, organization, email, password, credential } = parsed.data;
  // 환자 로그인용 내부 이메일 도메인은 재활사 가입에 쓸 수 없다(환자 아이디 선점 방지).
  if (email.endsWith(`@${PATIENT_EMAIL_DOMAIN}`)) {
    return NextResponse.json({ error: "사용할 수 없는 이메일입니다." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        organization,
        credential,
        role: "therapist",
      },
      // 역할은 클라이언트가 바꿀 수 없는 app_metadata 기준으로 DB 트리거가 판단한다.
      app_metadata: { role: "therapist" },
    });

    if (error || !data.user) {
      const duplicate = error?.message.toLowerCase().includes("already");
      return NextResponse.json(
        {
          error: duplicate
            ? "이미 가입된 이메일입니다."
            : "가입 신청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ id: data.user.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "회원가입 서버 설정을 확인해주세요." },
      { status: 503 },
    );
  }
}
