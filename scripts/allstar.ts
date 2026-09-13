/** 올스타 선정률 — 보직별로 공정한지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { roleTier } from "../src/lib/roles";

const bag: Record<string, { n: number; as: number }> = {};

for (const [kind, pos, style] of [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"], ["PITCHER", "RP", "finesse_p"],
] as ["HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 30; i++) {
    const rng = new RNG(15000 + i * 31);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));
    for (const s of g.seasons) {
      if (s.level !== "KBO" || roleTier(s.role) < 4) continue;
      const k = s.role;
      bag[k] = bag[k] ?? { n: 0, as: 0 };
      bag[k].n++;
      if (s.allStar) bag[k].as++;
    }
  }
}

console.log("■ 보직별 올스타 선정률 (주전급 시즌만)");
for (const [k, v] of Object.entries(bag).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${k.padEnd(6)} ${String(v.n).padStart(4)}시즌 중 ${String(v.as).padStart(3)}회 (${String(Math.round((v.as / v.n) * 100)).padStart(2)}%)`);
}
