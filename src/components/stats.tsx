"use client";

import { fmtIP, isHitterLine, titleOfStat } from "@/lib/sim";

export { fmtIP };
import type { HitterLine, PitcherLine, SeasonRecord, StatLine } from "@/lib/types";

export const fmt3 = (v: number) => (v === 0 ? ".000" : v.toFixed(3).replace(/^0/, ""));
export const fmt2 = (v: number) => v.toFixed(2);


const LEVEL_LABEL: Record<string, string> = { HS: "고교", COLLEGE: "대학", MINOR: "2군", KBO: "1군" };

/**
 * 시즌 핵심 지표 4~5개.
 * `awards`를 넘기면 그 기록으로 받은 타이틀을 숫자 위에 얹는다 — 39홈런이
 * 왜 금색인지 바로 보이게.
 */
export function KeyStats({ line, awards }: { line: StatLine; awards?: string[] }) {
  const relief = isHitterLine(line) ? null : line.sv > line.hld ? "sv" : "hld";
  const cells = isHitterLine(line)
    ? [
        { k: "AVG", stat: "avg", v: fmt3(line.avg) }, { k: "HR", stat: "hr", v: line.hr },
        { k: "RBI", stat: "rbi", v: line.rbi },
        { k: "OPS", stat: "ops", v: fmt3(line.ops) }, { k: "WAR", stat: "war", v: line.war.toFixed(1) },
      ]
    : [
        { k: "ERA", stat: "era", v: fmt2(line.era) },
        { k: "W-L", stat: "w", v: `${line.w}-${line.l}` },
        { k: relief === "sv" ? "SV" : "HLD", stat: relief!, v: relief === "sv" ? line.sv : line.hld },
        { k: "SO", stat: "so", v: line.so }, { k: "WAR", stat: "war", v: line.war.toFixed(1) },
      ];
  // 전광판 한 판 — 숫자가 주인공이라 어두운 판 위에 올린다
  return (
    <div className="scoreboard grid grid-cols-5 gap-px overflow-hidden rounded-xl p-px">
      {cells.map((c) => {
        const title = titleOfStat(awards, c.stat);
        return (
          <div
            key={c.k}
            title={title ?? undefined}
            className="flex flex-col items-center px-1 py-2.5"
            style={title ? { background: "rgba(255,209,102,.12)" } : undefined}
          >
            <span className="text-[8.5px] font-black uppercase tracking-[0.16em] text-white/45">
              {title ? "👑 " : ""}{c.k}
            </span>
            <span className="scoreboard-num mt-0.5 text-[16px] font-black">{c.v}</span>
            {title && (
              <span className="mt-0.5 text-[8px] font-bold text-[#ffd166]">{title}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const HIT_COLS: { k: string; label: string; get: (l: HitterLine) => string | number }[] = [
  { k: "g", label: "G", get: (l) => l.g }, { k: "pa", label: "PA", get: (l) => l.pa },
  { k: "ab", label: "AB", get: (l) => l.ab }, { k: "h", label: "H", get: (l) => l.h },
  { k: "b2", label: "2B", get: (l) => l.b2 }, { k: "b3", label: "3B", get: (l) => l.b3 },
  { k: "hr", label: "HR", get: (l) => l.hr }, { k: "rbi", label: "RBI", get: (l) => l.rbi },
  { k: "r", label: "R", get: (l) => l.r }, { k: "bb", label: "BB", get: (l) => l.bb },
  { k: "so", label: "SO", get: (l) => l.so }, { k: "sb", label: "SB", get: (l) => l.sb },
  { k: "avg", label: "AVG", get: (l) => fmt3(l.avg) }, { k: "obp", label: "OBP", get: (l) => fmt3(l.obp) },
  { k: "slg", label: "SLG", get: (l) => fmt3(l.slg) }, { k: "ops", label: "OPS", get: (l) => fmt3(l.ops) },
  { k: "war", label: "WAR", get: (l) => l.war.toFixed(1) },
];

const PIT_COLS: { k: string; label: string; get: (l: PitcherLine) => string | number }[] = [
  { k: "g", label: "G", get: (l) => l.g }, { k: "gs", label: "GS", get: (l) => l.gs },
  { k: "ip", label: "IP", get: (l) => fmtIP(l.ip) }, { k: "w", label: "W", get: (l) => l.w },
  { k: "l", label: "L", get: (l) => l.l }, { k: "sv", label: "SV", get: (l) => l.sv },
  { k: "hld", label: "HLD", get: (l) => l.hld }, { k: "so", label: "SO", get: (l) => l.so },
  { k: "bb", label: "BB", get: (l) => l.bb }, { k: "h", label: "H", get: (l) => l.h },
  { k: "era", label: "ERA", get: (l) => fmt2(l.era) }, { k: "whip", label: "WHIP", get: (l) => fmt2(l.whip) },
  { k: "k9", label: "K/9", get: (l) => fmt2(l.k9) }, { k: "war", label: "WAR", get: (l) => l.war.toFixed(1) },
];

export function SeasonTable({ seasons, kind, totals }: {
  seasons: SeasonRecord[]; kind: "HITTER" | "PITCHER"; totals?: Record<string, number>;
}) {
  const cols = kind === "HITTER" ? HIT_COLS : PIT_COLS;
  return (
    /* 스코어북 위에 적는 느낌 — 격자는 아주 옅게 깐다 */
    <div className="scroll-x card relative">
      <div className="scorebook pointer-events-none absolute inset-0" aria-hidden />
      <table className="num relative w-full min-w-max text-[11.5px]">
        <thead>
          <tr className="border-b border-[var(--line)] text-[10px] text-[var(--ink-3)]">
            <th className="sticky left-0 z-10 bg-[var(--surface)] px-2.5 py-2 text-left font-bold">연도</th>
            <th className="px-2 py-2 text-left font-bold">팀</th>
            {cols.map((c) => <th key={c.k} className="px-2 py-2 text-right font-bold">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {seasons.map((s, i) => (
            <tr key={i} className="border-b border-[var(--line)]/60 last:border-0">
              <th className="sticky left-0 z-10 bg-[var(--surface)] px-2.5 py-2 text-left font-bold">
                {s.year}
                <span className="ml-1 text-[9px] font-semibold text-[var(--ink-3)]">{LEVEL_LABEL[s.level]}</span>
              </th>
              <td className="whitespace-nowrap px-2 py-2 text-[var(--ink-2)]">
                {s.teamName.replace(/^\S+\s/, "")}
                {s.awards.length > 0 && <span className="ml-1">🏆</span>}
              </td>
              {cols.map((c) => (
                <td key={c.k} className="px-2 py-2 text-right">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(c.get as any)(s.line)}
                </td>
              ))}
            </tr>
          ))}
          {totals && (
            <tr className="bg-[var(--surface-2)] font-extrabold">
              <th className="sticky left-0 z-10 bg-[var(--surface-2)] px-2.5 py-2 text-left">통산</th>
              <td className="px-2 py-2" />
              {cols.map((c) => (
                <td key={c.k} className="px-2 py-2 text-right">
                  {formatTotal(c.k, totals)}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatTotal(k: string, t: Record<string, number>) {
  const v = t[k];
  if (v === undefined) return "-";
  if (["avg", "obp", "slg", "ops"].includes(k)) return fmt3(v);
  if (["era", "whip", "k9"].includes(k)) return fmt2(v);
  if (k === "war") return v.toFixed(1);
  if (k === "ip") return v.toFixed(1);
  return v;
}
