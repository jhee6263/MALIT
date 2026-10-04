import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "말이음 | MALIUM",
  description: "성인 실어증 환자를 위한 단계적 문장 산출 훈련",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
