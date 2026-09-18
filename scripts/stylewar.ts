/**
 * 같은 OVR이면 유형끼리 값이 같은가.
 *
 * 커리어 단위로 재면 표본 20개의 잡음에 묻힌다 — 한 시즌을 **같은 조건**
 * (같은 OVR · 같은 타석 · 같은 자리)으로 고정해 유형의 값만 뽑는다.
 * OVR이 같은데 값이 절반이면, 화면의 OVR이 거짓말을 하는 것이다.
 */
import { RNG } from "../src/lib/rng";
import { overall, rollCandidate, STYLES } from "../src/lib/player";
import { simHitter } from "../src/lib/sim";
import type { HitterLine, Player } from "../src/lib/types";

const OVR_TARGET = 80;

function atOvr(styleId: string, pos: string, rng: RNG): Player | null {
  // 목표 OVR에 닿을 때까지 능력치를 함께 끌어올린다
  for (let t = 0; t < 400; t++) {
    const p = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: pos as never, bats: "R", throws: "R", styleId }, rng);
    const keys = Object.keys(p.abilities) as (keyof typeof p.abilities)[];
    for (let step = 0; step < 200; step++) {
      const cur = overall(p);
      if (cur >= OVR_TARGET) return cur <= OVR_TARGET + 1 ? p : null;
      for (const k of keys) {
        const v = p.abilities[k] as number;
        if (v > 0) (p.abilities[k] as number) = Math.min(120, v + 1);
      }
    }
  }
  return null;
}

console.log(`■ OVR ${OVR_TARGET} · 중견수 · 600타석 고정 — 유형별 한 시즌 값 (각 60회)`);
console.log("  유형          AVG    HR   OPS    WAR");
for (const st of STYLES.filter((x) => x.kind === "HITTER")) {
  const rng = new RNG(4242);
  const out: HitterLine[] = [];
  for (let i = 0; i < 60; i++) {
    const p = atOvr(st.id, "CF", rng);
    if (!p) continue;
    out.push(simHitter({ player: p, level: "KBO", role: "주전", teamPower: 70, availability: 1, rng, minGames: 144 }) as HitterLine);
  }
  if (!out.length) { console.log(`  ${st.name.padEnd(8)} —`); continue; }
  const avg = (f: (l: HitterLine) => number) => out.reduce((a, l) => a + f(l), 0) / out.length;
  console.log(
    `  ${st.name.padEnd(10)} ${avg((l) => l.avg).toFixed(3).replace(/^0/, "").padStart(6)}`
    + `  ${avg((l) => l.hr).toFixed(0).padStart(4)}`
    + `  ${avg((l) => l.ops).toFixed(3).replace(/^0/, "").padStart(6)}`
    + `  ${avg((l) => l.war).toFixed(1).padStart(5)}`,
  );
}
