/** 통산 연봉이 말이 되는 크기인가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { computeHof, formatMoney, newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

const rows: { earned: number; seasons: number; tier: string }[] = [];
for (let i = 0; i < 80; i++) {
  const rng = new RNG(1700 + i * 13);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "표본", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "control_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 83));
  const h = computeHof(g);
  rows.push({ earned: h.earned, seasons: h.seasons, tier: h.tier });
}
rows.sort((a, b) => a.earned - b.earned);
const at = (q: number) => rows[Math.floor(rows.length * q)];
console.log(`■ 통산 연봉 (커리어 ${rows.length}개)`);
console.log(`  하위10% ${formatMoney(at(0.1).earned)} · 중앙 ${formatMoney(at(0.5).earned)} · 상위10% ${formatMoney(at(0.9).earned)} · 최대 ${formatMoney(rows[rows.length - 1].earned)}`);
const byTier = new Map<string, number[]>();
for (const r of rows) byTier.set(r.tier, [...(byTier.get(r.tier) ?? []), r.earned]);
for (const [t, list] of byTier) {
  const avg = list.reduce((a, b) => a + b, 0) / list.length;
  console.log(`  ${t.padEnd(12)} ${String(list.length).padStart(3)}명 · 평균 ${formatMoney(Math.round(avg))}`);
}
