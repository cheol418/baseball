/**
 * 리그 평균 능력치(LEAGUE_AVG_ABILITY=70.5) 선수가 내는 성적.
 * "우리 선수의 OPS"가 아니라 **리그 평균**이 실제 KBO와 맞는지를 본다.
 */
import { RNG, LEAGUE_AVG_ABILITY } from "../src/lib/rng";
import { abilityKeys, rollCandidate, overall, setAb } from "../src/lib/player";
import { simHitter, simPitcher } from "../src/lib/sim";
import type { HitterLine, PitcherLine } from "../src/lib/types";

const rng = new RNG(11);
const mk = (kind: "HITTER" | "PITCHER", pos: string, val: number) => {
  const p = rollCandidate({ name: "평균", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: kind === "HITTER" ? "gap" : "control_p", armSlot: kind === "PITCHER" ? "THREE_QUARTER" : undefined }, new RNG(3));
  for (const k of abilityKeys(kind)) setAb(p.abilities, k as never, val);
  p.age = 27; p.condition = 80;
  return p;
};
console.log("■ 능력치를 전부 같은 값으로 고정했을 때의 한 시즌 (팀전력 65 · 가동률 1)\n");
console.log("  능력치  OVR   타자: 타율   출루   장타   OPS   홈런   |  투수: ERA   WHIP  K/9");
for (const v of [58, 64, 70.5, 76, 82, 90, 105, 120]) {
  const h = mk("HITTER", "LF", v), pt = mk("PITCHER", "SP", v);
  const hl: HitterLine[] = [], pl: PitcherLine[] = [];
  for (let i = 0; i < 40; i++) {
    hl.push(simHitter({ player: h, level: "KBO", role: "주전", teamPower: 65, availability: 1, rng, share: 1 }) as HitterLine);
    pl.push(simPitcher({ player: pt, level: "KBO", role: "선발", teamPower: 65, availability: 1, rng, share: 1 }) as PitcherLine);
  }
  const a = (f: (l: HitterLine) => number) => hl.reduce((x, l) => x + f(l), 0) / hl.length;
  const b = (f: (l: PitcherLine) => number) => pl.reduce((x, l) => x + f(l), 0) / pl.length;
  console.log(`  ${String(v).padStart(5)}  ${String(overall(h)).padStart(3)}        .${(a((l) => l.avg) * 1000).toFixed(0)}   .${(a((l) => l.obp) * 1000).toFixed(0)}   .${(a((l) => l.slg) * 1000).toFixed(0)}  .${(a((l) => l.ops) * 1000).toFixed(0)}  ${a((l) => l.hr).toFixed(0).padStart(4)}   |        ${b((l) => l.era).toFixed(2)}  ${b((l) => l.whip).toFixed(2)}  ${b((l) => l.k9).toFixed(1)}`);
}
console.log(`\n  LEAGUE_AVG_ABILITY = ${LEAGUE_AVG_ABILITY}`);
console.log("  실제 KBO 리그 평균(2023~2025): 타율 .268 · 출루 .343 · 장타 .390 · OPS .733 · ERA 4.10 · WHIP 1.42 · K/9 7.2");
console.log("  실제 KBO 주전(규정타석) 평균: OPS .780 안팎");

// wOBA 기준선 — WAR은 이 값과의 차이로 계산된다. 리그 공격력을 바꾸면 여기도 옮겨야 한다.
{
  const h = mk("HITTER", "LF", LEAGUE_AVG_ABILITY);
  let w = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const l = simHitter({ player: h, level: "KBO", role: "주전", teamPower: 65, availability: 1, rng, share: 1 }) as HitterLine;
    const singles = l.h - l.b2 - l.b3 - l.hr;
    w += (0.69 * l.bb + 0.72 * l.hbp + 0.89 * singles + 1.27 * l.b2 + 1.62 * l.b3 + 2.1 * l.hr) / l.pa;
  }
  console.log(`\n■ 리그 평균 능력치의 wOBA = ${(w / N).toFixed(4)}  ← sim.ts의 lgWoba가 이 값이어야 WAR 0이 된다`);
}
