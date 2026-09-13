"use client";

import { isHitterLine } from "@/lib/sim";
import type { HitterLine, PitcherLine, SeasonRecord, StatLine } from "@/lib/types";

export const fmt3 = (v: number) => (v === 0 ? ".000" : v.toFixed(3).replace(/^0/, ""));
export const fmt2 = (v: number) => v.toFixed(2);

const LEVEL_LABEL: Record<string, string> = { HS: "고교", COLLEGE: "대학", MINOR: "2군", KBO: "1군" };

/** 시즌 핵심 지표 4~5개 */
export function KeyStats({ line }: { line: StatLine }) {
  const cells = isHitterLine(line)
    ? [
        { k: "AVG", v: fmt3(line.avg) }, { k: "HR", v: line.hr }, { k: "RBI", v: line.rbi },
        { k: "OPS", v: fmt3(line.ops) }, { k: "WAR", v: line.war.toFixed(1) },
      ]
    : [
        { k: "ERA", v: fmt2(line.era) }, { k: "W-L", v: `${line.w}-${line.l}` },
        { k: line.sv > line.hld ? "SV" : "HLD", v: line.sv > line.hld ? line.sv : line.hld },
        { k: "SO", v: line.so }, { k: "WAR", v: line.war.toFixed(1) },
      ];
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {cells.map((c) => (
        <div key={c.k} className="flex flex-col items-center rounded-xl bg-[var(--surface-2)] px-1 py-2">
          <span className="eyebrow">{c.k}</span>
          <span className="tabular text-[15px] font-extrabold">{c.v}</span>
        </div>
      ))}
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
  { k: "ip", label: "IP", get: (l) => l.ip.toFixed(1) }, { k: "w", label: "W", get: (l) => l.w },
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
    <div className="scroll-x card">
      <table className="tabular w-full min-w-max text-[11.5px]">
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
