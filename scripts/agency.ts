/**
 * 선택이 결과를 바꾸는가 — 같은 선수·같은 시드로 전략만 바꿔 끝까지 돌린다.
 * 바뀌지 않으면 그 선택은 연출이지 게임이 아니다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay, type AutoOptions } from "./autoplay";
import { careerTotals } from "../src/lib/career";
import { MAJOR_TITLES } from "../src/lib/sim";
import type { GameState } from "../src/lib/types";

const VARIANTS: [string, AutoOptions][] = [
  ["기준(팀에 맞춘다)", { clutchPick: 0, nego: "accept", transferChance: 0, resolve: "team" }],
  ["각오: 타이틀 도전", { clutchPick: 0, nego: "accept", transferChance: 0, resolve: "title" }],
  ["각오: 몸을 만든다", { clutchPick: 0, nego: "accept", transferChance: 0, resolve: "build" }],
  ["각오: 무리하지 않는다", { clutchPick: 0, nego: "accept", transferChance: 0, resolve: "manage" }],
  ["승부처 2번만", { clutchPick: 2, nego: "accept", transferChance: 0, resolve: "team" }],
  ["협상 강하게", { clutchPick: 0, nego: "push", transferChance: 0, resolve: "team" }],
  ["이적 적극", { clutchPick: 0, nego: "accept", transferChance: 0.9, resolve: "team" }],
];

const rows: Record<string, { war: number[]; pay: number[]; fame: number[]; yrs: number[]; hof: number[]; peak: number[]; titles: number[] }> = {};
for (const [lab] of VARIANTS) rows[lab] = { war: [], pay: [], fame: [], yrs: [], hof: [], peak: [], titles: [] };

for (let i = 0; i < 130; i++) {
  const seed = 7700 + i * 29;
  for (const [lab, opt] of VARIANTS) {
    const p = rollCandidate({ name: "s", number: 1, kind: i % 2 ? "HITTER" : "PITCHER", position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, new RNG(seed));
    const g: GameState = autoPlay(newGame(p, "DAG", seed), opt);
    const t = careerTotals(g.seasons, i % 2 ? "HITTER" : "PITCHER", "KBO") as Record<string, number>;
    rows[lab].war.push(t.war);
    rows[lab].pay.push(Math.max(0, ...g.seasons.map((s) => s.salary ?? 0)));
    rows[lab].fame.push(g.player.fame);
    rows[lab].hof.push(g.hofScore ?? 0);
    rows[lab].peak.push(overall(g.player));
    rows[lab].titles.push(g.seasons.reduce((a, x) => a + x.awards.filter((w) => MAJOR_TITLES.includes(w)).length, 0));
    rows[lab].yrs.push(g.seasons.filter((s) => s.level === "KBO").length);
  }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const base = rows[VARIANTS[0][0]];
console.log("■ 같은 선수·같은 시드, 전략만 다르게 (n=130)\n");
console.log("  전략                        통산WAR   최고연봉   1군시즌  은퇴OVR  타이틀  HOF점수");
for (const [lab] of VARIANTS) {
  const r = rows[lab];
  const d = avg(r.war) - avg(base.war);
  void d;
  console.log(`  ${lab.padEnd(26)} ${avg(r.war).toFixed(1).padStart(6)}  ${(avg(r.pay) / 1e4).toFixed(1).padStart(7)}억  ${avg(r.yrs).toFixed(1).padStart(6)}  ${avg(r.peak).toFixed(1).padStart(6)}  ${avg(r.titles).toFixed(1).padStart(5)}  ${avg(r.hof).toFixed(0).padStart(6)}`);
}

// 비교 대상 — 같은 전략에서 시드만 다를 때의 폭
const spread = base.war.slice().sort((a, b) => a - b);
const q = (p: number) => spread[Math.floor(spread.length * p)];
console.log(`\n■ 비교: 같은 전략인데 시드만 다를 때 통산 WAR — 하위10% ${q(0.1).toFixed(1)} · 중앙 ${q(0.5).toFixed(1)} · 상위10% ${q(0.9).toFixed(1)} (폭 ${(q(0.9) - q(0.1)).toFixed(1)})`);
/**
 * 평균끼리 빼면 상쇄된다 — 균형 잡힌 선택지는 평균이 같아야 정상이다.
 * "내 선택이 내 커리어를 바꾸는가"는 **같은 시드에서 짝지어** 재야 한다.
 */
const paired = (key: "war" | "yrs" | "peak" | "pay") => {
  let sum = 0, n2 = 0;
  for (const [lab] of VARIANTS.slice(1)) {
    for (let j = 0; j < base[key].length; j++) { sum += Math.abs(rows[lab][key][j] - base[key][j]); n2++; }
  }
  return sum / n2;
};
console.log(`  전략을 바꿔서 움직인 폭 (평균끼리) ${(Math.max(...VARIANTS.map(([l]) => avg(rows[l].war))) - Math.min(...VARIANTS.map(([l]) => avg(rows[l].war)))).toFixed(1)}`);
console.log(`  ★ 같은 시드에서 짝지어 본 폭 — WAR ${paired("war").toFixed(1)} · 1군시즌 ${paired("yrs").toFixed(1)} · 은퇴OVR ${paired("peak").toFixed(1)} · 최고연봉 ${(paired("pay") / 1e4).toFixed(1)}억`);
console.log(`  → 운(시드 폭 ${(q(0.9) - q(0.1)).toFixed(1)}) 대비 ${((q(0.9) - q(0.1)) / Math.max(0.1, paired("war"))).toFixed(1)}배`);

// 인지도가 포화되는가
const fameAll = base.fame.slice().sort((a, b) => a - b);
console.log(`\n■ 은퇴 시 인지도 — 최소 ${fameAll[0]} · 중앙 ${fameAll[Math.floor(fameAll.length / 2)]} · 최대 ${fameAll[fameAll.length - 1]} (0~100)`);
