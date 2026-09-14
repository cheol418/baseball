/** 은퇴 권고를 뿌리친 해의 연봉 협상 — 구단이 잡을 생각이 없어야 한다 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, formatMoney } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

type Row = { refused: boolean; prev: number; offer: number; push: number };
const rows: Row[] = [];
const CFG = [["HITTER", "1B", "slugger"], ["PITCHER", "SP", "power_p"]] as const;
for (const [kind, pos, style] of CFG) {
  for (let i = 0; i < 140; i++) {
    const rng = new RNG(51000 + i * 31);
    const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    let g: GameState = newGame(p, "DAG", i * 71);
    for (let n = 0; n < 45; n++) {
      g = autoPlay(g, { stopAt: (c) => c.phase === "NEGOTIATION" && !!c.pendingNegotiation && c !== g });
      const neg = g.pendingNegotiation;
      if (!neg || g.phase !== "NEGOTIATION") break;
      const push = neg.options.find((o) => o.id === "push");
      rows.push({
        refused: g.retireRefusedYear === g.year,
        prev: neg.previous, offer: neg.offer, push: push?.odds ?? 0,
      });
      g = autoPlay(g, { stopAt: (c) => c.phase !== "NEGOTIATION" });
      if (g.phase === "RETIRED") break;
    }
  }
}
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
for (const [lab, f] of [["평소", (r: Row) => !r.refused], ["은퇴 권고를 뿌리친 해", (r: Row) => r.refused]] as const) {
  const a = rows.filter(f);
  if (!a.length) { console.log(`  ${lab} — 표본 없음`); continue; }
  const cut = a.filter((r) => r.offer < r.prev).length;
  console.log(
    `  ${lab.padEnd(16)} n=${String(a.length).padStart(4)}`
    + ` · 직전 ${formatMoney(avg(a.map((r) => r.prev))).padStart(8)}`
    + ` → 제시 ${formatMoney(avg(a.map((r) => r.offer))).padStart(8)}`
    + ` (${((avg(a.map((r) => r.offer)) / avg(a.map((r) => r.prev)) - 1) * 100).toFixed(1)}%)`
    + ` · 삭감 ${Math.round(cut / a.length * 100)}%`
    + ` · 재협상 성공률 ${Math.round(avg(a.map((r) => r.push)) * 100)}%`,
  );
}
