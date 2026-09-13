import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이번 생은 야구다 — 야구선수 커리어 시뮬레이션",
  description: "고교 3학년부터 드래프트, 프로 시즌, FA, 은퇴까지. 나만의 야구 인생을 시작하세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0e2a4d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-dvh w-full">{children}</div>
      </body>
    </html>
  );
}
