import type { NextConfig } from "next";

/*
 * 앱으로 감싸려면 **서버 없이 도는 번들**이어야 한다 (Capacitor 웹뷰).
 * 서버 상태도 API 라우트도 없으므로 정적 내보내기로 충분하다.
 * `trailingSlash`는 웹뷰가 `file://`에서 디렉터리를 찾을 때 필요하다.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
