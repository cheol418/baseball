/** 구장 효과 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { simHitter } from "../src/lib/sim";
import { TEAMS } from "../src/lib/teams";
import type { HitterLine } from "../src/lib/types";

console.log("  구단        구장            홈런  타율   OPS    성향");
for (const t of [...TEAMS].sort((a, b) => b.park.hr - a.park.hr)) {
  const rows: HitterLine[] = [];
  for (let i = 0; i < 300; i++) {
    const p = rollCandidate(
      { name: "x", number: 1, kind: "HITTER", position: "LF", bats: "R", throws: "R", styleId: "slugger" },
      new RNG(200 + i * 37),
    );
    const ab = p.abilities as unknown as Record<string, number>;
    for (const k of ["contact", "power", "eye", "speed", "defense", "arm", "durability"]) ab[k] = 85;
    rows.push(simHitter({ player: p, level: "KBO", role: "주전", teamPower: 70, availability: 1, rng: new RNG(7), park: t.park }));
  }
  const avg = (f: (l: HitterLine) => number) => rows.reduce((a, l) => a + f(l), 0) / rows.length;
  console.log(`  ${t.short.padEnd(10)} ${t.park.name.padEnd(14)} ${avg((l) => l.hr).toFixed(1).padStart(4)}  ${avg((l) => l.avg).toFixed(3)}  ${avg((l) => l.ops).toFixed(3)}  ${t.park.label}`);
}
