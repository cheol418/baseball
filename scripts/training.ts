/** 훈련 선택지별 실제 성장량 비교 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, grow, makeTrainingOptions, abilityKeys, getAb, ABILITY_LABEL, injuryRiskMultiplier } from "../src/lib/player";
import type { Player } from "../src/lib/types";

function trial(optId: string, age: number, n = 400) {
  let sumTotal = 0, sumOvr = 0, sumBest = 0;
  for (let i = 0; i < n; i++) {
    const rng = new RNG(555 + i * 71);
    const p: Player = rollCandidate(
      { name: "x", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng,
    );
    p.age = age;
    const opts = makeTrainingOptions(p, rng);
    const opt = opts.find((o) => o.id.startsWith(optId)) ?? opts[0];
    const before = abilityKeys(p.kind).map((k) => getAb(p.abilities, k));
    const ovrBefore = overall(p);
    grow(p, rng, opt, 1.15);
    const after = abilityKeys(p.kind).map((k) => getAb(p.abilities, k));
    const deltas = after.map((v, j) => v - before[j]);
    sumTotal += deltas.reduce((a, b) => a + b, 0);
    sumBest += Math.max(...deltas);
    sumOvr += overall(p) - ovrBefore;
  }
  return { total: sumTotal / n, ovr: sumOvr / n, best: sumBest / n };
}

console.log("  나이 훈련            총 상승  OVR 상승  최대 단일  부상위험");
for (const [id, label] of [["hell", "지옥 훈련"], ["focus", "집중 훈련"], ["balance", "밸런스"], ["rest", "재활 & 휴식"]] as [string, string][]) {
  for (const age of [20, 30]) {
    const r = trial(id, age);
    const rng2 = new RNG(1);
    const pp = rollCandidate({ name: "x", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng2);
    pp.age = age;
    const real = id === "hell" ? 0.28 : id === "focus" ? 0.05 : id === "balance" ? 0.02 : 0;
    const eff = Math.min(0.75, real * injuryRiskMultiplier(pp));
    console.log(`  ${age}세 ${label.padEnd(13)} ${r.total.toFixed(1).padStart(6)}  ${r.ovr.toFixed(1).padStart(7)}  ${r.best.toFixed(1).padStart(8)}  ${(eff * 100).toFixed(0).padStart(6)}%`);
  }
}
void ABILITY_LABEL;
