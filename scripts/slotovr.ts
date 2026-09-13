/** 투구폼에 따라 생성 OVR이 공평한지 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, potentialOverall, ARM_SLOTS, getAb } from "../src/lib/player";
import type { ArmSlot } from "../src/lib/types";

const styles = ["power_p", "control_p", "finesse_p", "horse_p"];
console.log("  유형        폼        OVR평균  잠재평균  구속  제구  무브  변화");
for (const st of styles) {
  for (const a of ARM_SLOTS) {
    const rows = Array.from({ length: 300 }, (_, i) => {
      const p = rollCandidate(
        { name: "x", number: 1, kind: "PITCHER", position: "SP", bats: "R", throws: "R", styleId: st, armSlot: a.id as ArmSlot },
        new RNG(500 + i * 37),
      );
      return { o: overall(p), pot: potentialOverall(p), p };
    });
    const avg = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
    const ab = (k: string) => avg((r) => getAb(r.p.abilities, k as never)).toFixed(0);
    console.log(
      `  ${st.padEnd(10)} ${a.name.padEnd(8)} ${avg((r) => r.o).toFixed(1).padStart(6)}  ${avg((r) => r.pot).toFixed(1).padStart(7)}  ` +
      `${ab("velocity").padStart(4)}  ${ab("control").padStart(4)}  ${ab("movement").padStart(4)}  ${ab("breaking").padStart(4)}`,
    );
  }
}
