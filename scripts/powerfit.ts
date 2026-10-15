/**
 * 팀 전력이 보직에 제대로 반영되는가.
 *
 * `bar`는 전력이 높을수록 올라가는데(어려워진다), `typicalRival`도 같이
 * 올라간다(쉬워진다). 스쿼드는 팀 전력을 안 보므로 둘이 상쇄돼
 * **"강팀에 가면 자리 잡기 어렵다"가 사라졌을 수 있다.**
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { assignRole } from "../src/lib/career";
import { roleTier } from "../src/lib/roles";
import { competeAdjust } from "../src/lib/squad";
import { TEAMS } from "../src/lib/teams";

const rng = new RNG(31);
import { abilityKeys, setAb } from "../src/lib/player";
const p = rollCandidate({ name: "x", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "gap" }, new RNG(9));
p.age = 27;
// 전성기 주전급으로 고정 — 갓 생성된 18세(OVR 52)로 재면 전부 2군이라 차이가 안 보인다
for (const k of abilityKeys("HITTER")) setAb(p.abilities, k as never, 78);

console.log("■ 같은 선수(OVR 고정)를 전력만 다른 팀에 놓았을 때의 평균 입지 티어\n");
console.log("  전력   경쟁자 없음   경쟁자 OVR 80(보통)   경쟁자 OVR 88(강함)");
for (const pw of [56, 62, 68, 74, 80, 86]) {
  const team = { ...TEAMS[0], power: pw };
  const row = [0, competeAdjust(80, pw), competeAdjust(88, pw)].map((adj) => {
    let sum = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const r = assignRole(p, team, 5, 55, rng, 9, adj, pw);
      sum += r.level === "KBO" ? roleTier(r.role) : 0;
    }
    return (sum / N).toFixed(2);
  });
  console.log(`  ${String(pw).padStart(3)}    ${row[0].padStart(8)}   ${row[1].padStart(18)}   ${row[2].padStart(17)}`);
}
console.log(`\n  (티어: 간판 6 · 핵심 5 · 주전 4 · 준주전 3 · 백업 2 · 2군 0)`);
console.log(`  OVR ${overall(p)} 기준 — 전력이 올라갈수록 티어가 내려가야 "강팀일수록 자리 잡기 어렵다"가 성립한다`);
