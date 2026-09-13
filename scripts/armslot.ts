/** 투구폼 · 좌우 플래툰 영향 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, ARM_SLOTS, platoonProfile, platoonEdge } from "../src/lib/player";
import { newGame, careerTotals, computeHof } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { ArmSlot, Hand } from "../src/lib/types";

function run(slot: ArmSlot, throws: Hand, pos: string, n = 24) {
  const out = [] as ReturnType<typeof careerTotals>[];
  const tiers: string[] = [];
  for (let i = 0; i < n; i++) {
    const rng = new RNG(3000 + i * 613);
    const p = rollCandidate(
      { name: "폼", number: 1, kind: "PITCHER", position: pos as never, bats: throws, throws, styleId: "power_p", armSlot: slot },
      rng,
    );
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), { transferChance: 0 });
    out.push(careerTotals(g.seasons, "PITCHER", "KBO"));
    tiers.push(computeHof(g).tier);
  }
  const avg = (f: (t: (typeof out)[number]) => number) =>
    out.reduce((a, t) => a + f(t), 0) / out.length;
  return {
    era: avg((t) => ("era" in t ? (t.era as number) : 0)),
    k9: avg((t) => ("ip" in t && (t.ip as number) > 0 ? ((t.so as number) / (t.ip as number)) * 9 : 0)),
    hr9: 0,
    war: avg((t) => t.war),
    ip: avg((t) => ("ip" in t ? (t.ip as number) : 0)),
    legend: tiers.filter((x) => x.includes("레전드") || x.includes("명예")).length,
  };
}

console.log("■ 투구폼별 좌우 편차\n");
for (const a of ARM_SLOTS) {
  for (const throws of ["R", "L"] as Hand[]) {
    const p = { throws, armSlot: a.id } as never;
    const pr = platoonProfile(p);
    const sp = platoonEdge(p, "선발");
    const rp = platoonEdge(p, "불펜");
    console.log(
      `  ${a.name.padEnd(6)} ${throws === "R" ? "우완" : "좌완"}  ` +
      `${pr.strongSide} 상대 강함 / ${pr.weakSide} 약함  ` +
      `편차 ${(pr.gap * 100).toFixed(0)}%  ` +
      `순이익 선발 ${(sp * 100).toFixed(1)}% · 불펜 ${(rp * 100).toFixed(1)}%`,
    );
  }
}

console.log("\n■ 통산 성적 (n=24, 선발)\n");
console.log("  폼       손   ERA    K/9   IP평균   WAR   상위등급");
for (const a of ARM_SLOTS) {
  for (const throws of ["R", "L"] as Hand[]) {
    const r = run(a.id, throws, "SP");
    console.log(
      `  ${a.name.padEnd(6)} ${throws === "R" ? "우완" : "좌완"}  ` +
      `${r.era.toFixed(2)}  ${r.k9.toFixed(2)}  ${r.ip.toFixed(0).padStart(6)}  ${r.war.toFixed(1).padStart(5)}  ${r.legend}/24`,
    );
  }
}

console.log("\n■ 통산 성적 (n=24, 마무리)\n");
console.log("  폼       손   ERA    K/9   IP평균   WAR   상위등급");
for (const a of ARM_SLOTS) {
  for (const throws of ["R", "L"] as Hand[]) {
    const r = run(a.id, throws, "CP");
    console.log(
      `  ${a.name.padEnd(6)} ${throws === "R" ? "우완" : "좌완"}  ` +
      `${r.era.toFixed(2)}  ${r.k9.toFixed(2)}  ${r.ip.toFixed(0).padStart(6)}  ${r.war.toFixed(1).padStart(5)}  ${r.legend}/24`,
    );
  }
}
