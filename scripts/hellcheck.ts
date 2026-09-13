/** 어떤 상황에서도 지옥 훈련이 가장 크게 성장하는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, grow, makeTrainingOptions, abilityKeys, getAb } from "../src/lib/player";
import type { Player, TrainingOption } from "../src/lib/types";

function clone(p: Player): Player { return JSON.parse(JSON.stringify(p)); }

let lossTotal = 0, lossOvr = 0, n = 0;
const worst: string[] = [];
const byAge: Record<number, { hell: number; best: number; n: number }> = {};

for (const age of [19, 22, 25, 28, 31, 34]) {
  for (let i = 0; i < 250; i++) {
    const rng = new RNG(4000 + i * 97 + age * 13);
    const base = rollCandidate(
      { name: "x", number: 1, kind: i % 2 ? "HITTER" : "PITCHER",
        position: (i % 2 ? "CF" : "SP") as never, bats: "R", throws: "R",
        styleId: i % 2 ? "toolsy" : "power_p",
        armSlot: i % 2 ? undefined : "THREE_QUARTER" }, rng,
    );
    base.age = age;
    // 커리어 중반 상태를 흉내내기 위해 몇 해 성장시킨다
    for (let a = 19; a < age; a++) { base.age = a; grow(base, rng, null, 1.05); }
    base.age = age;

    const opts = makeTrainingOptions(base, new RNG(rng.int(1, 1e9)));
    const results = opts.map((o: TrainingOption) => {
      const p2 = clone(base);
      const r2 = new RNG(777);
      const before = abilityKeys(p2.kind).map((k) => getAb(p2.abilities, k));
      const ovrB = overall(p2);
      grow(p2, r2, o, 1.05);
      const after = abilityKeys(p2.kind).map((k) => getAb(p2.abilities, k));
      return {
        id: o.id,
        total: after.reduce((s, v, j) => s + (v - before[j]), 0),
        ovr: overall(p2) - ovrB,
      };
    });
    const hell = results.find((r) => r.id === "hell")!;
    const bestTotal = Math.max(...results.map((r) => r.total));
    const bestOvr = Math.max(...results.map((r) => r.ovr));
    if (hell.total < bestTotal) { lossTotal++; if (worst.length < 4) worst.push(`${age}세 총합 ${hell.total} < ${bestTotal} (${results.find(r=>r.total===bestTotal)!.id})`); }
    if (hell.ovr < bestOvr) lossOvr++;
    const b = byAge[age] ??= { hell: 0, best: 0, n: 0 };
    b.hell += hell.total; b.best += bestTotal; b.n++;
    n++;
  }
}
console.log(`■ 지옥 훈련이 최고가 아닌 경우 (n=${n})\n`);
console.log(`  총 상승 기준  ${lossTotal}건 (${((lossTotal / n) * 100).toFixed(1)}%)`);
console.log(`  OVR 기준      ${lossOvr}건 (${((lossOvr / n) * 100).toFixed(1)}%)`);
if (worst.length) console.log("  예시: " + worst.join(" / "));
console.log("\n  나이별 평균 총 상승 (지옥 / 최고)");
for (const [age, b] of Object.entries(byAge)) {
  console.log(`   ${age}세  ${(b.hell / b.n).toFixed(1).padStart(6)} / ${(b.best / b.n).toFixed(1).padStart(6)}`);
}
