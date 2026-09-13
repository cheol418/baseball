/** 이적 관심도 분포 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame, makeTransferTargets } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { teamById } from "../src/lib/teams";

for (const [label, seed, kbo] of [["평범한 준주전", 1013, 4], ["리그 정상급", 1031, 9]] as [string, number, number][]) {
  const rng = new RNG(seed);
  const p = rollCandidate({ name: "샘플", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
  const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), {
    stopAt: (c) => c.phase === "STOVE" && c.seasons.filter((x) => x.level === "KBO").length >= kbo,
  });
  if (g.phase !== "STOVE") { console.log(`${label}: 도달 실패`); continue; }
  console.log(`\n■ ${label} — OVR ${overall(g.player)} · 신뢰 ${Math.round(g.trust)} · ${g.year}년`);
  for (const t of makeTransferTargets(g, new RNG(g.seed))) {
    const tm = teamById(t.teamId);
    console.log(`  ${tm.short.padEnd(8)} 전력${String(tm.power).padStart(3)} 육성${String(tm.youth).padStart(3)} 자금${String(tm.money).padStart(3)}  관심 ${String(t.interest).padStart(2)}  성사 ${String(Math.round(t.odds * 100)).padStart(2)}%  ${t.note}`);
  }
}
