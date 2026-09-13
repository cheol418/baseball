/** 지옥 훈련 — 도박으로서 균형이 맞는지 (성공/실패 기대값, 일반 훈련과의 차이) */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, makeTrainingOptions, grow, hellOdds, HELL_LIMIT } from "../src/lib/player";
import type { Player } from "../src/lib/types";

const clone = (p: Player): Player => JSON.parse(JSON.stringify(p)) as Player;

for (const age of [21, 24, 27, 30]) {
  const normal: number[] = [], win: number[] = [], lose: number[] = [], odds: number[] = [];
  for (let i = 0; i < 500; i++) {
    const rng = new RNG(51000 + i * 11);
    const base = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
    base.age = age;
    // 갓 생성한 신인이 아니라 그 나이대의 실제 프로 선수 수준으로 맞춘다
    const ab = base.abilities as unknown as Record<string, number>;
    const pot = base.potential as unknown as Record<string, number>;
    const bump = age <= 21 ? 10 : age <= 24 ? 20 : age <= 27 ? 28 : 30;
    for (const k of Object.keys(ab)) {
      ab[k] = Math.min(pot[k], ab[k] + bump);
      pot[k] = Math.min(120, pot[k] + 10);
    }
    const opts = makeTrainingOptions(base, rng);
    const opt = opts[i % opts.length];
    odds.push(hellOdds(base));

    const sum = (p: Player) => {
      const before = { ...(p.abilities as unknown as Record<string, number>) };
      return () => {
        const after = p.abilities as unknown as Record<string, number>;
        return Object.keys(before).reduce((a, k) => a + (after[k] - before[k]), 0);
      };
    };
    const a = clone(base); const ga = sum(a); grow(a, new RNG(i * 3 + 1), opt, 1.0, 1); normal.push(ga());
    const b = clone(base); const gb = sum(b); grow(b, new RNG(i * 3 + 1), opt, 1.0, 2.3); win.push(gb());
    const c = clone(base); const gc = sum(c); grow(c, new RNG(i * 3 + 1), opt, 1.0, 0.42); lose.push(gc());
  }
  const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
  const o = avg(odds);
  const ev = o * avg(win) + (1 - o) * avg(lose);
  console.log(
    `  ${age}세  성공률 ${(o * 100).toFixed(0)}%`
    + `  |  일반 +${avg(normal).toFixed(1)}`
    + `  지옥성공 +${avg(win).toFixed(1)}`
    + `  지옥실패 +${avg(lose).toFixed(1)}`
    + `  → 기대값 +${ev.toFixed(1)}  (${ev > avg(normal) ? "도박이 유리" : "안전이 유리"})`,
  );
}
console.log(`\n  지옥 훈련은 커리어 ${HELL_LIMIT}회 제한.`);
console.log("  기대값이 일반보다 조금 높아야 '쓸 만한 도박'이 된다 — 크게 높으면 무조건 쓰게 되고,");
console.log("  낮으면 아무도 안 쓴다.");
