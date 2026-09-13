/** 1군 입지 세분화 — 각 등급이 실제로 도달 가능한지, 커리어에서 어떻게 움직이는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { ROLES, roleTier } from "../src/lib/roles";
import { autoPlay } from "./autoplay";

const CONFIGS: [string, "HITTER" | "PITCHER", string, string][] = [
  ["타자", "HITTER", "CF", "toolsy"],
  ["거포", "HITTER", "1B", "slugger"],
  ["선발투수", "PITCHER", "SP", "power_p"],
  ["마무리", "PITCHER", "CP", "power_p"],
  ["불펜", "PITCHER", "RP", "finesse_p"],
];

for (const [label, kind, pos, style] of CONFIGS) {
  const count: Record<string, number> = {};
  let peakTier = 0, everReachedTop = 0, careers = 0, kboSeasons = 0;

  for (let i = 0; i < 40; i++) {
    const rng = new RNG(6000 + i * 29);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));
    careers++;
    let best = 0;
    for (const s of g.seasons) {
      if (s.level !== "KBO") continue;
      kboSeasons++;
      count[s.role] = (count[s.role] ?? 0) + 1;
      best = Math.max(best, roleTier(s.role));
    }
    peakTier += best;
    if (best >= 6) everReachedTop++;
  }

  const rows = Object.entries(count).sort((a, b) => roleTier(b[0]) - roleTier(a[0]));
  console.log(`\n■ ${label} — 1군 ${kboSeasons}시즌 · 커리어 최고 등급 평균 ${(peakTier / careers).toFixed(1)} · 간판 도달 ${everReachedTop}/${careers}`);
  for (const [r, n] of rows) {
    const bar = "█".repeat(Math.max(1, Math.round((n / kboSeasons) * 40)));
    console.log(`    T${roleTier(r)} ${(ROLES[r]?.name ?? r).padEnd(6)} ${String(n).padStart(4)} (${String(Math.round((n / kboSeasons) * 100)).padStart(2)}%) ${bar}`);
  }
}
