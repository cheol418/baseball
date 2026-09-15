/**
 * 선택이 결과를 바꾸는가 — 같은 선수·같은 시드로 전략만 바꿔 끝까지 돌린다.
 * 바뀌지 않으면 그 선택은 연출이지 게임이 아니다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay, type AutoOptions } from "./autoplay";
import { careerTotals } from "../src/lib/career";
import type { GameState } from "../src/lib/types";

const VARIANTS: [string, AutoOptions][] = [
  ["기준(승부처 0번·협상 수용)", { clutchPick: 0, nego: "accept", transferChance: 0 }],
  ["승부처 1번만", { clutchPick: 1, nego: "accept", transferChance: 0 }],
  ["승부처 2번만", { clutchPick: 2, nego: "accept", transferChance: 0 }],
  ["협상 강하게", { clutchPick: 0, nego: "push", transferChance: 0 }],
  ["이적 적극", { clutchPick: 0, nego: "accept", transferChance: 0.9 }],
];

const rows: Record<string, { war: number[]; pay: number[]; fame: number[]; yrs: number[]; hof: number[] }> = {};
for (const [lab] of VARIANTS) rows[lab] = { war: [], pay: [], fame: [], yrs: [], hof: [] };

for (let i = 0; i < 60; i++) {
  const seed = 7700 + i * 29;
  for (const [lab, opt] of VARIANTS) {
    const p = rollCandidate({ name: "s", number: 1, kind: i % 2 ? "HITTER" : "PITCHER", position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, new RNG(seed));
    const g: GameState = autoPlay(newGame(p, "DAG", seed), opt);
    const t = careerTotals(g.seasons, i % 2 ? "HITTER" : "PITCHER", "KBO") as Record<string, number>;
    rows[lab].war.push(t.war);
    rows[lab].pay.push(Math.max(0, ...g.seasons.map((s) => s.salary ?? 0)));
    rows[lab].fame.push(g.player.fame);
    rows[lab].hof.push(g.hofScore ?? 0);
    rows[lab].yrs.push(g.seasons.filter((s) => s.level === "KBO").length);
  }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const base = rows[VARIANTS[0][0]];
console.log("■ 같은 선수·같은 시드, 전략만 다르게 (n=60)\n");
console.log("  전략                        통산WAR   최고연봉    인지도   1군시즌   HOF점수  기준대비WAR");
for (const [lab] of VARIANTS) {
  const r = rows[lab];
  const d = avg(r.war) - avg(base.war);
  console.log(`  ${lab.padEnd(26)} ${avg(r.war).toFixed(1).padStart(6)}  ${(avg(r.pay) / 1e4).toFixed(1).padStart(7)}억  ${avg(r.fame).toFixed(0).padStart(5)}  ${avg(r.yrs).toFixed(1).padStart(6)}  ${avg(r.hof).toFixed(0).padStart(6)}   ${d >= 0 ? "+" : ""}${d.toFixed(1)}`);
}

// 비교 대상 — 같은 전략에서 시드만 다를 때의 폭
const spread = base.war.slice().sort((a, b) => a - b);
const q = (p: number) => spread[Math.floor(spread.length * p)];
console.log(`\n■ 비교: 같은 전략인데 시드만 다를 때 통산 WAR — 하위10% ${q(0.1).toFixed(1)} · 중앙 ${q(0.5).toFixed(1)} · 상위10% ${q(0.9).toFixed(1)} (폭 ${(q(0.9) - q(0.1)).toFixed(1)})`);
const stratSpread = Math.max(...VARIANTS.map(([l]) => avg(rows[l].war))) - Math.min(...VARIANTS.map(([l]) => avg(rows[l].war)));
console.log(`  전략을 바꿔서 움직인 폭 ${stratSpread.toFixed(1)}`);
console.log(`  → 운이 전략보다 ${((q(0.9) - q(0.1)) / Math.max(0.1, stratSpread)).toFixed(1)}배 크게 작용한다`);

// 인지도가 포화되는가
const fameAll = base.fame.slice().sort((a, b) => a - b);
console.log(`\n■ 은퇴 시 인지도 — 최소 ${fameAll[0]} · 중앙 ${fameAll[Math.floor(fameAll.length / 2)]} · 최대 ${fameAll[fameAll.length - 1]} (0~100)`);
