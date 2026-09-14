import type { Metadata, Viewport } from "next";
import { Oswald } from "next/font/google";
import "./globals.css";

/**
 * 숫자 전용 서체.
 *
 * 전광판과 유니폼 등번호는 좁고 각진 글자를 쓴다. 본문은 그대로 두고
 * **숫자만** 갈아 끼우면 기록 화면이 단번에 야구장처럼 읽힌다.
 * 한글 글리프가 없으므로 반드시 본문 서체를 뒤에 깔아둔다.
 */
const scoreboard = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-scoreboard",
  display: "swap",
});

export const metadata: Metadata = {
  title: "야구는 9회말 2아웃부터 — 야구선수 커리어 시뮬레이션",
  description: "고교 3학년부터 드래프트, 프로 시즌, FA, 은퇴까지. 9회말 2아웃에서도 커리어는 뒤집힙니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0e2a4d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={scoreboard.variable}>
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
