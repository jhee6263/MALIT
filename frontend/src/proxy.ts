import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 포털 경로별로 허용하는 역할. API는 각 Route Handler가 따로 권한을 확인한다.
const protectedRoutes = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/therapist", role: "therapist" },
  { prefix: "/patient", role: "patient" },
] as const;

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const route = protectedRoutes.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!route) return response;

  // 로그인하지 않았거나, 역할이 다르거나, 승인 대기·정지 상태면 로그인 화면으로 보낸다.
  const profile = user
    ? (await supabase.from("profiles").select("role,status").eq("id", user.id).single()).data
    : null;
  if (profile?.role !== route.role || profile.status !== "active") {
    const redirect = NextResponse.redirect(new URL("/", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
