/** 훈련 성과 등급 — 분포와 기댓값이 1.0 근처인가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, rollTrainGrade } from "../src/lib/player";
const rng = new RNG(7);
const cnt: Record<string, number> = {}; let ev = 0; const N = 40000;
for (let i = 0; i < N; i++) {
  const p = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "gap" }, new RNG(1000 + i));
  p.age = 20 + (i % 15);
  const g = rollTrainGrade(p, rng);
  cnt[g.label] = (cnt[g.label] ?? 0) + 1; ev += g.mul;
}
for (const [k, v] of Object.entries(cnt)) console.log(`  ${k.padEnd(12)} ${(v / N * 100).toFixed(1)}%`);
console.log(`  기댓값 ${(ev / N).toFixed(3)} (1.0 근처여야 성장 곡선이 그대로다)`);
