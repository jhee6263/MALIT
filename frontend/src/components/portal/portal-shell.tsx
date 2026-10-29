"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, ChevronRight, ClipboardList, LayoutDashboard, Settings, ShieldCheck, Tags, UserRoundPlus, UsersRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { Footer } from "@/components/footer";
import { LogoutButton } from "@/components/logout-button";

const therapistNav = [{ href: "/therapist", label: "대시보드", icon: LayoutDashboard }, { href: "/therapist/patients", label: "환자 관리", icon: UsersRound }, { href: "/therapist/records", label: "훈련 기록", icon: ClipboardList }, { href: "/therapist/settings", label: "내 계정", icon: Settings }];
const adminNav = [{ href: "/admin", label: "대시보드", icon: LayoutDashboard }, { href: "/admin/therapists", label: "재활사 승인", icon: ShieldCheck }, { href: "/admin/topics", label: "훈련 주제", icon: Tags }, { href: "/admin/contents", label: "훈련 콘텐츠", icon: BookOpenCheck }, { href: "/admin/users", label: "사용자 관리", icon: UsersRound }];

export function PortalShell({ role, children }: { role: "therapist" | "admin"; children: React.ReactNode }) {
  const path = usePathname();
  const nav = role === "admin" ? adminNav : therapistNav;
  const isActive = (href: string) => path === href || (href !== `/${role}` && path.startsWith(href));

  return (
    <div className="page-shell bg-[#f4f7f5]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="flex min-h-[72px] items-center justify-between px-5 lg:px-7">
          <Brand compact />
          <div className="flex items-center gap-4">
            <span className="pill pill-green">{role === "admin" ? "관리자" : "언어재활사"}</span>
            <LogoutButton className="text-[#61706b]" />
          </div>
        </div>
        {/* 데스크톱 사이드바가 없는 폭에서는 가로 메뉴로 같은 이동 경로를 제공한다. */}
        <nav aria-label="주요 메뉴" className="flex gap-2 overflow-x-auto border-t border-[var(--line)] px-5 py-2 lg:hidden">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold ${isActive(item.href) ? "bg-[var(--mint-100)] text-[var(--mint-700)]" : "text-[#5f6d68]"}`}>
                <Icon size={18} />{item.label}
              </Link>
            );
          })}
          {role === "therapist" && <Link href="/therapist/patients/new" className="btn btn-primary min-h-10 shrink-0 px-3 text-sm"><UserRoundPlus size={17} /> 환자 등록</Link>}
        </nav>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-[var(--line)] bg-white p-4 lg:block">
          <nav className="space-y-2">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 font-bold ${active ? "bg-[var(--mint-100)] text-[var(--mint-700)]" : "text-[#5f6d68] hover:bg-[#f4f7f5]"}`}>
                  <Icon size={20} />{item.label}{active && <ChevronRight className="ml-auto" size={17} />}
                </Link>
              );
            })}
          </nav>
          {role === "therapist" && <Link href="/therapist/patients/new" className="btn btn-primary mt-7 w-full px-3"><UserRoundPlus size={19} /> 환자 등록</Link>}
        </aside>
        <div className="min-w-0 flex-1">
          <main className="mx-auto w-full max-w-[1240px] p-5 sm:p-8">{children}</main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
