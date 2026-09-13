/** WAR 계산 검증 — 세이버메트릭스 표준식과 대조 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { simPitcher, simHitter } from "../src/lib/sim";
import type { PitcherLine, HitterLine } from "../src/lib/types";

console.log("■ 투수 — 한 시즌 통짜 시뮬 (선발)\n");
console.log("  스태미나  GS    IP    ERA   우리WAR  표준식WAR  이닝/선발");
for (const stam of [60, 75, 90, 105, 120]) {
  const rng = new RNG(12345);
  const rows: PitcherLine[] = [];
  for (let i = 0; i < 200; i++) {
    const p = rollCandidate(
      { name: "x", number: 1, kind: "PITCHER", position: "SP", bats: "R", throws: "R", styleId: "control_p", armSlot: "THREE_QUARTER" },
      new RNG(900 + i * 31),
    );
    const ab = p.abilities as unknown as Record<string, number>;
    // 1군 정상급 투수 수준으로 맞춘 뒤 스태미나만 바꾼다
    for (const k of ["velocity", "control", "movement", "breaking", "fielding", "durability", "mental"]) ab[k] = 85;
    ab.stamina = stam;
    rows.push(simPitcher({ player: p, level: "KBO", role: "선발", teamPower: 70, availability: 1, rng }));
  }
  const avg = (f: (l: PitcherLine) => number) => rows.reduce((a, l) => a + f(l), 0) / rows.length;
  const ip = avg((l) => l.ip), era = avg((l) => l.era), gs = avg((l) => l.gs), war = avg((l) => l.war);
  // 표준식: (대체수준 RA9 5.40 − 본인 RA9) / 9 × IP / 10런당1승
  const std = ((5.4 - era * 1.07) / 9) * (ip / 1) / 10;
  console.log(`  ${String(stam).padStart(6)}  ${gs.toFixed(0).padStart(3)}  ${ip.toFixed(0).padStart(5)}  ${era.toFixed(2)}  ${war.toFixed(1).padStart(7)}  ${std.toFixed(1).padStart(8)}  ${(ip / gs).toFixed(2).padStart(8)}`);
}

console.log("\n■ 타자 — 주전 한 시즌\n");
console.log("  OVR대  PA    AVG    OPS   우리WAR  참고(wRAA기반)");
for (const lvl of [60, 70, 80, 90, 100]) {
  const rng = new RNG(4321);
  const rows: HitterLine[] = [];
  for (let i = 0; i < 200; i++) {
    const p = rollCandidate(
      { name: "x", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" },
      new RNG(300 + i * 41),
    );
    for (const k of ["contact", "power", "eye", "speed", "defense", "arm", "durability"]) {
      (p.abilities as unknown as Record<string, number>)[k] = lvl;
    }
    rows.push(simHitter({ player: p, level: "KBO", role: "주전", teamPower: 70, availability: 1, rng }));
  }
  const avg = (f: (l: HitterLine) => number) => rows.reduce((a, l) => a + f(l), 0) / rows.length;
  console.log(`  ${String(lvl).padStart(5)}  ${avg((l) => l.pa).toFixed(0).padStart(3)}  ${avg((l) => l.avg).toFixed(3)}  ${avg((l) => l.ops).toFixed(3)}  ${avg((l) => l.war).toFixed(1).padStart(7)}`);
}
