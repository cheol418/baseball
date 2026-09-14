"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ABILITY_LABEL, ABILITY_MAX } from "@/lib/player";

/**
 * 페이지 공통 폭.
 *
 * PC에서도 **모바일과 같은 한 열**로 본다. 화면이 넓다고 정보를 옆으로
 * 늘어놓으면 기기마다 다른 게임이 되고, 연출(오버레이·중계·카드)도 두 벌로
 * 만들어야 한다. 한 폭으로 고정하면 손에 쥔 화면 그대로가 PC에도 뜬다.
 */
export const APP_W = "max-w-[460px]";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full ${APP_W} ${className}`}>{children}</div>;
}

/** 읽기 좋은 단일 열 (표·목록 화면용) — 이제 Container와 같은 폭이다 */
export function Column({ children }: { children: ReactNode }) {
  return <div className={`mx-auto w-full ${APP_W}`}>{children}</div>;
}

export function AppBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-[var(--danger)] bg-[var(--brand)] text-[var(--brand-ink)]">
      <Container className="flex items-center gap-3 px-4 py-3">
        {back ? (
          <Link href={back} aria-label="뒤로" className="-ml-1 rounded-lg px-2 py-1 text-lg leading-none opacity-80 hover:opacity-100">
            ←
          </Link>
        ) : (
          <span className="rounded-sm bg-[var(--danger)] px-2 py-1 text-[10px] font-black tracking-widest">2 OUT</span>
        )}
        <h1 className="flex-1 truncate text-[15px] font-extrabold">{title}</h1>
        {right}
      </Container>
    </header>
  );
}

export function Section({ eyebrow, title, children, action }: {
  eyebrow?: string; title?: string; children: ReactNode; action?: ReactNode;
}) {
  return (
    <section className="px-4 py-4">
      {(eyebrow || title) && (
        <div className="mb-2 flex items-end justify-between gap-2">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2 className="text-[17px] font-extrabold tracking-tight">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function AbilityBar({ k, value, potential, potentialHi, known = true }: {
  k: string; value: number; potential: number; potentialHi?: number; known?: boolean;
}) {
  // 막대는 능력치 상한(120) 기준으로 그린다
  const pct = Math.min(100, (value / ABILITY_MAX) * 100);
  const loPct = Math.min(100, (potential / ABILITY_MAX) * 100);
  const hiPct = Math.min(100, ((potentialHi ?? potential) / ABILITY_MAX) * 100);
  const tone = value >= 100 ? "var(--gold)" : value >= 84 ? "var(--brand-2)" : value >= 66 ? "#5b7d9b" : "#a6b0bb";
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[52px] shrink-0 text-[11px] font-bold text-[var(--ink-2)]">{ABILITY_LABEL[k] ?? k}</span>
      <div className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-[var(--line)]">
        {/* 스카우트가 보는 잠재력 구간 */}
        <div className="absolute inset-y-0 rounded-full bg-[var(--ink-3)]/25"
          style={{ left: `${loPct}%`, width: `${Math.max(0, hiPct - loPct)}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--ink-3)]/35" style={{ width: `${loPct}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: tone }} />
      </div>
      <span className="tabular w-[28px] shrink-0 text-right text-[12px] font-extrabold">{value}</span>
      <span className="tabular w-[52px] shrink-0 text-right text-[10px] font-bold text-[var(--ink-3)]">
        {known || potentialHi === undefined || potentialHi === potential
          ? potential
          : `${potential}~${potentialHi}`}
      </span>
    </div>
  );
}

export function Stat({ label, value, sub, big }: { label: string; value: ReactNode; sub?: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-[var(--surface-2)] px-2 py-2.5">
      <span className="eyebrow">{label}</span>
      <span className={`tabular font-extrabold ${big ? "text-[20px]" : "text-[15px]"}`}>{value}</span>
      {sub && <span className="text-[10px] text-[var(--ink-3)]">{sub}</span>}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "brand" | "danger" }) {
  const cls =
    tone === "gold" ? "bg-[var(--gold)]/15 text-[var(--gold)]"
    : tone === "brand" ? "bg-[var(--brand)]/10 text-[var(--brand)]"
    : tone === "danger" ? "bg-[var(--danger)]/12 text-[var(--danger)]"
    : "bg-[var(--line)]/70 text-[var(--ink-2)]";
  return <span className={`rounded-full px-2 py-[3px] text-[10px] font-extrabold ${cls}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-1 px-4 py-8 text-center text-[13px] text-[var(--ink-3)]">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 시즌 진행 표시                                                       */
/* ------------------------------------------------------------------ */

/**
 * 한 시즌 안에서 지금 어느 구간인지.
 *
 * 여덟 칸을 한 줄에 늘어놓으면 460px에 안 들어가 가로 스크롤이 생긴다.
 * 스크롤바가 생기는 순간 "여기 뭔가 더 있다"는 신호가 되는데, 정작 그 안에는
 * 아직 오지 않은 단계뿐이라 볼 이유가 없다.
 * 그래서 **페넌트레이스 / 스토브리그 두 묶음**으로 나누고, 지금 속한 묶음만
 * 펼쳐 보여준다. 넘어가는 순간 띠 전체가 갈아끼워진다.
 */
const SEASON_STAGES = [
  { key: "CAMP", label: "스프링캠프", icon: "🏋️" },
  { key: "H1", label: "전반기", icon: "⚾" },
  { key: "AS", label: "올스타", icon: "⭐" },
  { key: "H2", label: "후반기", icon: "⚾" },
  { key: "PS", label: "가을야구", icon: "🍁" },
  { key: "END", label: "시즌 총평", icon: "📋" },
  { key: "CONTRACT", label: "계약", icon: "✍️" },
  { key: "STOVE", label: "이적", icon: "❄️" },
] as const;

/** 묶음 — [시작, 끝] 칸과 접혔을 때 보여줄 이름 */
const GROUPS = [
  { key: "SEASON", from: 0, to: 4, label: "시즌", icon: "⚾" },
  { key: "STOVE", from: 5, to: 7, label: "스토브", icon: "❄️" },
] as const;

/** 단계별로 어느 칸에 있는지 — 아마추어·군 복무는 시즌 흐름 밖이다 */
const STAGE_OF: Record<string, number> = {
  SPRING_CAMP: 0, INTERNATIONAL: 0, MILITARY_CHOICE: 0,
  FIRST_HALF: 1,
  ALL_STAR: 2,
  POSTSEASON: 4,
  SEASON_END: 5, EVENT: 5,
  NEGOTIATION: 6, FA: 6,
  STOVE: 7,
};

export function SeasonProgress({ phase, year, extra }: {
  phase: string; year: number; extra?: string | null;
}) {
  const at = STAGE_OF[phase];
  if (at === undefined) return null;
  const gi = GROUPS.findIndex((g) => at >= g.from && at <= g.to);
  const group = GROUPS[Math.max(0, gi)];
  const other = GROUPS[gi === 0 ? 1 : 0];
  const otherDone = gi === 1;
  const pct = Math.round(((at + 1) / SEASON_STAGES.length) * 100);

  const chip = (
    key: string, label: string, icon: string,
    state: "now" | "done" | "todo",
  ) => (
    <span
      key={key}
      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-bold transition ${
        state === "now" ? "bg-[var(--brand)] text-white"
          : state === "done" ? "text-[var(--ink-3)]"
            : "text-[var(--ink-3)] opacity-40"
      }`}
    >
      {state === "now" && <span>{icon}</span>}
      {label}
    </span>
  );

  const stages = SEASON_STAGES
    .map((st, i) => ({ st, i }))
    .filter(({ i }) => i >= group.from && i <= group.to)
    .map(({ st, i }) => chip(st.key, st.label, st.icon, i === at ? "now" : i < at ? "done" : "todo"));

  // 접힌 묶음은 한 칸으로 — 지나온 쪽은 앞에, 남은 쪽은 뒤에 붙는다
  const folded = (
    <span
      key={other.key}
      className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-[3px] text-[10.5px] font-bold text-[var(--ink-3)] opacity-60"
    >
      <span>{other.icon}</span>{other.label}
    </span>
  );

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div key={group.key} className="swap flex items-center gap-1.5">
        <span className="shrink-0 pr-0.5 text-[10px] font-black text-[var(--ink-3)]">{year}</span>
        {otherDone && folded}
        {stages}
        {!otherDone && folded}
        {extra && (
          <span className="ml-auto shrink-0 rounded-full bg-[var(--gold)]/15 px-2 py-[3px] text-[10.5px] font-black text-[var(--gold)]">
            {extra}
          </span>
        )}
      </div>
      {/* 한 시즌을 얼마나 지나왔는가 */}
      <span className="mt-1.5 block h-[3px] w-full overflow-hidden rounded-full bg-[var(--line)]">
        <span
          className="block h-full rounded-full bg-[var(--brand-2)] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}
