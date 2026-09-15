/** 올스타전 스코어와 승패가 어긋나지 않는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { simAllStarGame } from "../src/lib/sim";
let bad = 0, tie = 0;
for (let i = 0; i < 20000; i++) {
  const rng = new RNG(i + 1);
  const p = rollCandidate({ name: "s", number: 1, kind: i % 2 ? "HITTER" : "PITCHER", position: i % 2 ? "CF" : "RP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const g = simAllStarGame(p, "DAG", rng);
  const [a, b] = g.score.split("-").map(Number);
  if (a === b) tie++;
  if ((a > b) !== g.won) bad++;
}
console.log(`올스타전 20000경기 — 스코어와 승패가 어긋난 경우 ${bad}건 · 동점 표기 ${tie}건 (둘 다 0이어야 한다)`);
