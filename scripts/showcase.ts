/** 올스타전·국제대회 연출 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, formatMoney } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { isHitterLine } from "../src/lib/sim";
import type { GameState } from "../src/lib/types";

const runs: GameState[] = [];
for (let i = 0; i < 30; i++) {
  const rng = new RNG(9500 + i * 211);
  const p = rollCandidate(
    { name: "쇼케이스", number: 7, kind: i % 2 ? "HITTER" : "PITCHER",
      position: (i % 2 ? "CF" : "SP") as never, bats: "R", throws: "R",
      styleId: i % 2 ? "toolsy" : "power_p", armSlot: i % 2 ? undefined : "THREE_QUARTER" }, rng,
  );
  runs.push(autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), { transferChance: 0.2 }));
}
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
const pct = (n: number) => `${Math.round((n / runs.length) * 100)}%`;

console.log("\n■ 경기 연출\n");
console.log(`  올스타전 출전       커리어당 ${avg(runs.map((g) => g.seasons.filter((s) => s.allStarGame).length))}회`);
console.log(`  올스타전 MVP        ${pct(runs.filter((g) => g.seasons.some((s) => s.allStarGame?.mvp)).length)}`);
console.log(`  국제대회 총 경기수  커리어당 ${avg(runs.map((g) => g.intlResults.reduce((a, r) => a + r.games.length, 0)))}경기`);
console.log(`  최고 연봉 평균      ${formatMoney(runs.reduce((a, g) => a + Math.max(0, ...g.seasons.map((s) => s.salary)), 0) / runs.length)}`);

const sample = runs.find((g) => g.intlResults.some((r) => r.games.length && r.medal)) ?? runs[0];
const intl = sample.intlResults.find((r) => r.games.length && r.medal) ?? sample.intlResults[0];
if (intl) {
  console.log(`\n■ ${intl.year} ${intl.tournamentName} — ${intl.medal ? intl.medal + "메달" : intl.rank + "위"}`);
  for (const gm of intl.games) {
    const l = gm.line;
    const stat = isHitterLine(l) ? `${l.h}안타 ${l.hr}홈런 ${l.rbi}타점` : `${l.ip.toFixed(1)}이닝 ${l.so}K ${l.er}자책`;
    console.log(`   ${gm.round.padEnd(14)} vs ${gm.opponent.padEnd(7)} ${gm.won ? "승" : "패"} ${gm.score.padEnd(5)}  ${stat}`);
  }
}
const as = sample.seasons.find((s) => s.allStarGame)?.allStarGame;
if (as) console.log(`\n■ 올스타전 — ${as.side} vs ${as.opponent} ${as.won ? "승" : "패"} ${as.score}${as.mvp ? " · MVP 🌟" : ""}`);
