import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  turbopack: {
    // 상위 MALIT 폴더의 lockfile과 무관하게 이 앱 폴더만 감시합니다.
    root: process.cwd(),
  },
};

export default nextConfig;
