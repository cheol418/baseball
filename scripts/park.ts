/** 구장 성향이 성적을 얼마나 흔드는가 — 같은 선수를 구장만 바꿔 돌린다 */
import { RNG } from "../src/lib/rng";
import { abilityKeys, rollCandidate, setAb } from "../src/lib/player";
import { simHitter, simPitcher } from "../src/lib/sim";
import { TEAMS } from "../src/lib/teams";
import type { HitterLine, PitcherLine } from "../src/lib/types";

const rng = new RNG(17);
const mk = (kind: "HITTER" | "PITCHER", pos: string, val: number) => {
  const p = rollCandidate({ name: "x", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: kind === "HITTER" ? "slugger" : "power_p", armSlot: kind === "PITCHER" ? "THREE_QUARTER" : undefined }, new RNG(5));
  for (const k of abilityKeys(kind)) setAb(p.abilities, k as never, val);
  p.age = 27; p.condition = 80;
  return p;
};
const h = mk("HITTER", "LF", 82), pt = mk("PITCHER", "SP", 82);
const N = 60;
const rows = TEAMS.map((t) => {
  const hl: HitterLine[] = [], pl: PitcherLine[] = [];
  for (let i = 0; i < N; i++) {
    hl.push(simHitter({ player: h, level: "KBO", role: "주전", teamPower: 65, availability: 1, rng, share: 1, park: t.park }) as HitterLine);
    pl.push(simPitcher({ player: pt, level: "KBO", role: "선발", teamPower: 65, availability: 1, rng, share: 1, park: t.park }) as PitcherLine);
  }
  const a = (f: (l: HitterLine) => number) => hl.reduce((x, l) => x + f(l), 0) / N;
  const b = (f: (l: PitcherLine) => number) => pl.reduce((x, l) => x + f(l), 0) / N;
  return { t, hr: a((l) => l.hr), ops: a((l) => l.ops), avg: a((l) => l.avg), war: a((l) => l.war), era: b((l) => l.era), pwar: b((l) => l.war) };
});
console.log("■ 같은 선수(능력치 82 고정)를 구장만 바꿔 한 시즌씩\n");
console.log("  구장                 HR계수  타자: 홈런   타율    OPS    WAR  |  투수: ERA    WAR");
for (const r of rows.sort((x, y) => y.hr - x.hr)) {
  console.log(`  ${r.t.park.name.padEnd(18)} ${r.t.park.hr.toFixed(2)}   ${r.hr.toFixed(1).padStart(6)}  .${(r.avg * 1000).toFixed(0)}  .${(r.ops * 1000).toFixed(0)}  ${r.war.toFixed(1).padStart(5)}  |  ${r.era.toFixed(2).padStart(6)}  ${r.pwar.toFixed(1).padStart(5)}`);
}
const hr = rows.map((r) => r.hr), ops = rows.map((r) => r.ops), war = rows.map((r) => r.war);
const eras = rows.map((r) => r.era), pw = rows.map((r) => r.pwar);
const gap = (a: number[]) => Math.max(...a) - Math.min(...a);
console.log(`\n  최고 구장 ↔ 최저 구장 차이 — 홈런 ${gap(hr).toFixed(1)}개 · OPS ${(gap(ops) * 1000).toFixed(0)} · 타자 WAR ${gap(war).toFixed(1)} · ERA ${gap(eras).toFixed(2)} · 투수 WAR ${gap(pw).toFixed(1)}`);
console.log("  실제 KBO 구장 효과: 홈런 ±10~15%(대구↔잠실 시즌 5~8개) · OPS 20~30 · ERA 0.25~0.40");
