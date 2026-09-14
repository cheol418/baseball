/** FA 제안이 구단마다 다른가 — 총액·연수·옵션 비중 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, formatMoney } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

const sets: { total: number[]; years: number[]; optRate: number[]; styles: string[] }[] = [];
const CFG = [["HITTER", "1B", "slugger"], ["PITCHER", "SP", "power_p"]] as const;
for (const [kind, pos, style] of CFG) {
  for (let i = 0; i < 90; i++) {
    const rng = new RNG(81000 + i * 37);
    const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    let g: GameState = newGame(p, "DAG", i * 59);
    for (let n = 0; n < 45; n++) {
      g = autoPlay(g, { stopAt: (c) => c.phase === "FA" && !!c.pendingOffers && c !== g });
      const offs = g.pendingOffers;
      if (!offs || g.phase !== "FA") break;
      sets.push({
        total: offs.map((o) => o.total),
        years: offs.map((o) => o.years),
        optRate: offs.map((o) => (o.total ? o.incentive / o.total : 0)),
        styles: offs.map((o) => o.styleNote.split(" —")[0]),
      });
      g = autoPlay(g, { stopAt: (c) => c.phase !== "FA" });
      if (g.phase === "RETIRED") break;
    }
  }
}
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const spread = (a: number[]) => (Math.max(...a) - Math.min(...a)) / Math.max(1, Math.max(...a));
console.log(`■ FA 협상 ${sets.length}건 · 제안 ${sets.reduce((a, b) => a + b.total.length, 0)}개`);
console.log(`  한 협상 안에서 총액 편차  ${(avg(sets.map((s) => spread(s.total))) * 100).toFixed(0)}%  (최고 대비 최저가 이만큼 낮다)`);
console.log(`  연수 폭  ${avg(sets.map((s) => Math.max(...s.years) - Math.min(...s.years))).toFixed(1)}년`);
console.log(`  옵션 비중  최저 ${(avg(sets.map((s) => Math.min(...s.optRate))) * 100).toFixed(0)}% ~ 최고 ${(avg(sets.map((s) => Math.max(...s.optRate))) * 100).toFixed(0)}%`);
const all = sets.flatMap((s) => s.total);
console.log(`  총액  중앙 ${formatMoney(all.sort((a, b) => a - b)[Math.floor(all.length / 2)])} · 최대 ${formatMoney(Math.max(...all))}`);
const cap = all.filter((v) => v >= 1800000).length;
console.log(`  180억에 붙은 제안 ${cap}개 (${(cap / all.length * 100).toFixed(1)}%)`);
const styleCount: Record<string, number> = {};
for (const s of sets) for (const st of s.styles) styleCount[st] = (styleCount[st] ?? 0) + 1;
console.log(`  성향 분포 ${Object.entries(styleCount).map(([k, v]) => `${k} ${Math.round(v / all.length * 100)}%`).join(" · ")}`);
