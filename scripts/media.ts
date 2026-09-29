/**
 * 인터뷰가 세 숫자를 플레이어의 것으로 만들었는가.
 * 같은 선수·같은 시드로 "늘 겸손하게" ↔ "늘 세게" ↔ "말 아끼기"만 바꿔 본다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay, type AutoOptions } from "./autoplay";
import { INTERVIEWS } from "../src/lib/media";
import type { GameState } from "../src/lib/types";

const LINES: [string, AutoOptions["interview"]][] = [
  ["팀에 공을 돌린다", "humble"],
  ["세게 말한다", "bold"],
  ["말을 아낀다", "flat"],
];

const rows: Record<string, { trust: number[]; mate: number[]; fame: number[]; war: number[]; pay: number[] }> = {};
for (const [l] of LINES) rows[l] = { trust: [], mate: [], fame: [], war: [], pay: [] };

const N = 110;
for (let i = 0; i < N; i++) {
  const seed = 5600 + i * 19;
  for (const [lab, mode] of LINES) {
    const kind = i % 2 ? "HITTER" : "PITCHER";
    const p = rollCandidate({ name: "s", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, new RNG(seed));
    const g: GameState = autoPlay(newGame(p, "DAG", seed), { interview: mode });
    const r = rows[lab];
    r.trust.push(g.trust); r.mate.push(g.teammate); r.fame.push(g.player.fame);
    r.war.push(g.seasons.filter((s) => s.level === "KBO").reduce((a, s) => a + s.line.war, 0));
    r.pay.push(Math.max(0, ...g.seasons.map((s) => s.salary ?? 0)));
  }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`■ 같은 선수·같은 시드, 인터뷰 태도만 다르게 (n=${N})\n`);
console.log("  태도             구단 신뢰   동료 관계   인지도   통산WAR   최고연봉");
for (const [lab] of LINES) {
  const r = rows[lab];
  console.log(`  ${lab.padEnd(14)} ${avg(r.trust).toFixed(0).padStart(7)}  ${avg(r.mate).toFixed(0).padStart(8)}  ${avg(r.fame).toFixed(0).padStart(7)}  ${avg(r.war).toFixed(1).padStart(7)}  ${(avg(r.pay) / 1e4).toFixed(1).padStart(7)}억`);
}
const base = rows[LINES[0][0]];
const paired = (k: "trust" | "mate" | "fame") => {
  let sum = 0, n2 = 0;
  for (const [l] of LINES.slice(1)) for (let j = 0; j < base[k].length; j++) { sum += Math.abs(rows[l][k][j] - base[k][j]); n2++; }
  return sum / n2;
};
console.log(`\n  ★ 같은 시드에서 짝지어 본 폭 — 구단 신뢰 ${paired("trust").toFixed(1)} · 동료 ${paired("mate").toFixed(1)} · 인지도 ${paired("fame").toFixed(1)}`);

console.log(`\n■ 질문이 그해 사정을 따라가는가 (같은 질문만 반복되면 안 된다)`);
const qcount: Record<string, number> = {};
for (let i = 0; i < 60; i++) {
  const rng = new RNG(700 + i * 11);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "s", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seen = new Set<string>();
  autoPlay(newGame(p, "DAG", i * 13), {
    interview: "humble",
    onStep: (g: GameState) => {
      if (g.phase !== "INTERVIEW" || !g.pendingInterview) return;
      const key = `${g.year}`;
      if (seen.has(key)) return;
      seen.add(key);
      qcount[g.pendingInterview] = (qcount[g.pendingInterview] ?? 0) + 1;
    },
  });
}
const tot = Object.values(qcount).reduce((a, b) => a + b, 0);
for (const q of INTERVIEWS) {
  const v = qcount[q.id] ?? 0;
  console.log(`  ${q.id.padEnd(10)} ${String(Math.round(v / tot * 100)).padStart(3)}%  ${"█".repeat(Math.round(v / tot * 30))}  ${q.eyebrow}`);
}
