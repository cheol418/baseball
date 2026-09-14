/** 대박 시즌인데 연봉이 깎이는가 — 성적과 제시액의 관계 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, formatMoney } from "../src/lib/career";
import { MAJOR_TITLES } from "../src/lib/sim";
import { autoPlay } from "./autoplay";
import type { GameState, HitterLine } from "../src/lib/types";

type Row = { war: number; titles: number; mvp: boolean; prev: number; offer: number; svc: number; age: number };
const rows: Row[] = [];
const CFG = [["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"], ["PITCHER", "SP", "power_p"]] as const;

for (const [kind, pos, style] of CFG) {
  for (let i = 0; i < 130; i++) {
    const rng = new RNG(71000 + i * 31);
    const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    // 협상마다 멈춰서 제시액을 훑는다
    let g: GameState = newGame(p, "BUS", i * 47);
    for (let step = 0; step < 60; step++) {
      g = autoPlay(g, { stopAt: (c) => c.phase === "NEGOTIATION" && !!c.pendingNegotiation && c !== g });
      const n = g.pendingNegotiation;
      if (!n || g.phase !== "NEGOTIATION") break;
      const rec = g.seasons.filter((x) => x.level === "KBO").at(-1);
      if (rec) {
        rows.push({
          war: rec.line.war, titles: rec.awards.filter((a) => MAJOR_TITLES.includes(a)).length,
          mvp: rec.awards.some((a) => a.includes("MVP")),
          prev: n.previous, offer: n.offer, svc: g.serviceYears, age: rec.age,
        });
      }
      g = autoPlay(g, { stopAt: (c) => c.phase !== "NEGOTIATION" });
      if (g.phase === "RETIRED") break;
    }
  }
}
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const cut = (a: Row[]) => a.filter((r) => r.offer < r.prev).length;
console.log(`■ 연봉 협상 제시액 (n=${rows.length})`);
const BANDS: [string, (r: Row) => boolean][] = [
  ["MVP 시즌", (r) => r.mvp],
  ["타이틀 2개+", (r) => r.titles >= 2],
  ["WAR 5+", (r) => r.war >= 5],
  ["WAR 4~5", (r) => r.war >= 4 && r.war < 5],
  ["WAR 2~4", (r) => r.war >= 2 && r.war < 4],
  ["WAR 0~2", (r) => r.war >= 0 && r.war < 2],
];
for (const [lab, f] of BANDS) {
  const a = rows.filter(f);
  if (!a.length) continue;
  console.log(`  ${lab.padEnd(10)} n=${String(a.length).padStart(4)} · 직전 ${formatMoney(avg(a.map((r) => r.prev))).padStart(8)}`
    + ` → 제시 ${formatMoney(avg(a.map((r) => r.offer))).padStart(8)}`
    + `  평균 ${((avg(a.map((r) => r.offer)) / avg(a.map((r) => r.prev)) - 1) * 100).toFixed(1)}%`
    + `  |  삭감된 경우 ${cut(a)}/${a.length} (${Math.round(cut(a) / a.length * 100)}%)`);
}
console.log(`\n■ 고액 연봉자(직전 10억+)에서 대박 시즌을 보낸 경우`);
const rich = rows.filter((r) => r.prev >= 100000 && r.war >= 4.5);
if (rich.length) {
  console.log(`  n=${rich.length} · 직전 ${formatMoney(avg(rich.map((r) => r.prev)))} → 제시 ${formatMoney(avg(rich.map((r) => r.offer)))}`
    + `  삭감 ${cut(rich)}/${rich.length} (${Math.round(cut(rich) / rich.length * 100)}%)`);
}
