/**
 * 이름 — 실존 야구인이 게임 안에 나타나는가.
 *
 * 성 30 × 이름 30이면 조합이 900뿐이라 충돌은 시간문제다.
 * 실명으로 뛰는 선수가 "1군 못 가고 2년 만에 사라짐"으로 찍히면 곤란하고,
 * 스토어 심사에서도 걸린다.
 *
 * 네 풀이 각자 이름을 만들던 시절엔 한 곳을 막아도 나머지 셋이 뚫렸다 —
 * 지금은 `names.ts` 하나를 지난다. 그게 실제로 지켜지는지 전수로 센다.
 */
import { RNG } from "../src/lib/rng";
import {
  BLOCKED, ELDER_SURNAMES, GIVEN_CLASS, GIVEN_ELDER, GIVEN_MATE, GIVEN_YOUNG,
  SURNAMES, makeName,
} from "../src/lib/names";
import { rollCandidate } from "../src/lib/player";
import { makeRivals } from "../src/lib/rivals";
import { makeSquad } from "../src/lib/squad";
import { makeManager } from "../src/lib/manager";

const POOLS = [
  { name: "플레이어·후보", given: GIVEN_YOUNG, sur: SURNAMES },
  { name: "드래프트 동기", given: GIVEN_CLASS, sur: SURNAMES },
  { name: "같은 팀 동료", given: GIVEN_MATE, sur: SURNAMES },
  { name: "감독",        given: GIVEN_ELDER, sur: ELDER_SURNAMES },
];

console.log("■ 풀마다 만들 수 있는 조합과 그중 막은 것");
let totalCombos = 0, totalHit = 0;
for (const p of POOLS) {
  const all = p.sur.flatMap((s) => p.given.map((g) => s + g));
  const hit = all.filter((n) => BLOCKED.has(n));
  totalCombos += all.length; totalHit += hit.length;
  console.log(`  ${p.name.padEnd(14)} 조합 ${String(all.length).padStart(4)} · 막음 ${String(hit.length).padStart(2)}  ${hit.slice(0, 8).join(" ")}`);
}
console.log(`  합계 ${totalCombos}조합 중 ${totalHit} (${(totalHit / totalCombos * 100).toFixed(1)}%)`);

// ── 실제로 뽑아 본다 — 뽑는 길이 하나뿐인지가 핵심이다
let drawn = 0, leaked = 0;
const seen = new Set<string>();
const check = (n: string) => { drawn++; seen.add(n); if (BLOCKED.has(n)) { leaked++; console.log("    샘 " + n); } };

for (let i = 0; i < 400; i++) {
  const rng = new RNG(9000 + i);
  for (const p of POOLS) for (let k = 0; k < 8; k++) check(makeName(rng, p.given, p.sur));
}
console.log(`\n■ makeName 직접 호출 ${drawn}번 — 실존 인물 ${leaked}번 (0이어야 한다)`);

// ── 게임이 실제로 쓰는 길 네 개
let gdrawn = 0, gleaked = 0;
const gcheck = (n: string) => { gdrawn++; if (BLOCKED.has(n)) { gleaked++; console.log("    샘 " + n); } };
for (let i = 0; i < 300; i++) {
  const rng = new RNG(4000 + i * 7);
  gcheck(rollCandidate({
    name: "", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy",
  }, rng).name);
  for (const r of makeRivals(rng, "LG", 19, "HITTER", 10)) gcheck(r.name);
  for (const m of makeSquad(rng, { kind: "HITTER", position: "CF" }, 2030)) gcheck(m.name);
  gcheck(makeManager(rng, "LG", 2030).name);
}
console.log(`■ 생성·동기·동료·감독을 거친 이름 ${gdrawn}개 — 실존 인물 ${gleaked}개 (0이어야 한다)`);
console.log(`  서로 다른 이름 ${seen.size}종이 나왔다 (리그가 비어 보이지 않을 만큼은 돼야 한다)`);

if (leaked || gleaked) process.exitCode = 1;
