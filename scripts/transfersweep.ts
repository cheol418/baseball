/** 이적 관심도 — 오버롤·나이·연봉·포지션이 제대로 반영되는지 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame, makeTransferTargets } from "../src/lib/career";
import { emptyLine } from "../src/lib/sim";
import type { GameState, Position } from "../src/lib/types";

const base = new RNG(7);
const seed = rollCandidate({ name: "샘플", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, base);

function probe(label: string, ovrTarget: number, war: number, fame: number, trust: number, age: number, salary: number, pos: Position) {
  const g = newGame(seed, "DAG", 12345) as GameState;
  g.player.position = pos;
  const keys = Object.keys(g.player.abilities) as (keyof typeof g.player.abilities)[];
  for (let i = 0; i < 400; i++) {
    if (overall(g.player) === ovrTarget) break;
    const up = overall(g.player) < ovrTarget;
    for (const k of keys) g.player.abilities[k] += up ? 1 : -1;
  }
  g.player.age = age;
  g.player.fame = fame;
  g.trust = trust;
  g.contract = { teamId: "DAG", salary, years: 1, remaining: 1, role: "주전" };
  g.seasons.push({
    year: 2030, age, level: "KBO", teamId: "DAG", teamName: "대구", position: pos,
    role: "주전", salary, awards: [], line: { ...emptyLine("HITTER"), war },
  } as never);

  const ts = makeTransferTargets(g, new RNG(99));
  const ints = ts.map((t) => t.interest);
  const odds = ts.map((t) => Math.round(t.odds * 100));
  console.log(
    `  ${label.padEnd(22)} 관심 ${String(Math.min(...ints)).padStart(2)}~${String(Math.max(...ints)).padStart(2)}`
    + `  성사 ${String(Math.min(...odds)).padStart(2)}~${String(Math.max(...odds)).padStart(2)}%`
    + `  적극영입(68↑) ${ints.filter((v) => v >= 68).length}/9`,
  );
}

console.log("\n■ 기량 (26세 · CF · 연봉 1억 · 신뢰 50)");
probe("OVR 62 WAR -0.5", 62, -0.5, 10, 50, 26, 10000, "CF");
probe("OVR 70 WAR 0.5", 70, 0.5, 20, 50, 26, 10000, "CF");
probe("OVR 76 WAR 1.5", 76, 1.5, 35, 50, 26, 10000, "CF");
probe("OVR 82 WAR 3.5", 82, 3.5, 60, 50, 26, 10000, "CF");
probe("OVR 90 WAR 6.0", 90, 6.0, 90, 50, 26, 10000, "CF");

console.log("\n■ 나이 (OVR 82 · WAR 3.5 · CF · 연봉 1억)");
for (const a of [23, 26, 29, 31, 34, 37]) probe(`${a}세`, 82, 3.5, 60, 50, a, 10000, "CF");

console.log("\n■ 연봉 (OVR 82 · WAR 3.5 · 30세 · CF)");
for (const sal of [5000, 30000, 80000, 146000, 250000]) probe(`${(sal / 10000).toFixed(1)}억원`, 82, 3.5, 100, 76, 30, sal, "CF");

console.log("\n■ 포지션 (OVR 82 · WAR 3.5 · 30세 · 연봉 14.6억)");
for (const pos of ["C", "SS", "CF", "RF", "1B", "DH"] as Position[]) probe(pos, 82, 3.5, 100, 76, 30, 146000, pos);

console.log("\n■ 화면의 사례 — 이승엽 (OVR 82 · 30세 · 지명타자 · 14.6억 · 신뢰 76 · 인지도 100)");
for (const w of [1.5, 3.5, 5.5]) probe(`직전 WAR ${w}`, 82, w, 100, 76, 30, 146000, "DH");
