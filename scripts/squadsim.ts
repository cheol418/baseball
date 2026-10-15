/**
 * 자리 경쟁 드라이런 — 코드에 물리기 전에 입지 분포가 얼마나 흔들리는지 본다.
 *
 * 기준선(간판 5~15% / 핵심 11~29% / 주전 31~41% / 준주전 19~31% / 백업 9~12%)을
 * 깨면 안 된다. 깨면 OVR 문턱을 쓰는 곳을 전부 다시 잡아야 한다(규칙 2).
 */
import { RNG } from "../src/lib/rng";
import { overall, rollCandidate } from "../src/lib/player";
import { assignRole, newGame } from "../src/lib/career";
import { teamById } from "../src/lib/teams";
import { autoPlay } from "./autoplay";
import { advanceSquad, blockerOf, competeAdjust, makeSquad, typicalRival, type Mate } from "../src/lib/squad";
import type { GameState } from "../src/lib/types";

const ARCH = [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"], ["HITTER", "C", "defense"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "SP", "control_p"], ["PITCHER", "CP", "power_p"],
] as const;

const before: Record<string, number> = {};
const after: Record<string, number> = {};
const gaps: number[] = [];       // 경쟁자 OVR − 내 OVR
const blockerOvrs: number[] = [];
const typicals: number[] = [];
const penalties: number[] = [];
let blocked = 0, total = 0, pushedOut = 0;

for (let i = 0; i < 120; i++) {
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const rng = new RNG(3100 + i * 13);
  const p = rollCandidate({ name: "나", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);

  // 스쿼드는 커리어와 **같은 해에** 같이 늙어야 비교가 성립한다
  const srng = new RNG(9100 + i * 7);
  let squad: Mate[] | null = null;
  const seen = new Set<number>();

  autoPlay(newGame(p, "DAG", i * 23), {
    onStep: (g: GameState) => {
      if (g.phase !== "SPRING_CAMP" || !g.contract) return;
      if (seen.has(g.year)) return;
      seen.add(g.year);
      const me = { kind: g.player.kind, position: g.player.position };
      squad = squad ? advanceSquad(squad, srng, g.year, me).squad : makeSquad(srng, me, g.year);

      // 지금 규칙으로 받은 자리
      const team = teamById(g.contract.teamId);
      const proYears = g.seasons.filter((r) => r.level === "KBO" || r.level === "MINOR").length;
      const now = assignRole(g.player, team, g.serviceYears, g.trust, new RNG(g.seed), proYears);
      // 경쟁을 얹었을 때의 자리 — OVR을 깎아 같은 함수를 다시 부른다
      const b = blockerOf(squad, me);
      const myOvr = overall(g.player);
      const pen = b ? competeAdjust(overall(b.player), team.power) : 0;
      const hit = { ...g.player, abilities: { ...g.player.abilities } };
      // assignRole은 overall()을 쓰므로 감점을 신뢰 쪽으로 환산해 넣는다 (bonus = (trust-55)*0.075)
      const fakeTrust = g.trust + pen / 0.075;
      const next = assignRole(hit, team, g.serviceYears, fakeTrust, new RNG(g.seed), proYears);

      total++;
      if (b) { gaps.push(overall(b.player) - myOvr); blockerOvrs.push(overall(b.player)); typicals.push(typicalRival(team.power)); penalties.push(pen); if (pen < 0) blocked++; }
      void myOvr;
      const key = (r: { level: string; role: string }) => (r.level === "KBO" ? r.role : "2군");
      before[key(now)] = (before[key(now)] ?? 0) + 1;
      after[key(next)] = (after[key(next)] ?? 0) + 1;
      if (key(now) !== key(next)) pushedOut++;
    },
  });
}

const pct = (m: Record<string, number>, k: string) => ((m[k] ?? 0) / total * 100).toFixed(1) + "%";
const ORDER = ["간판타자", "핵심타자", "주전", "준주전", "백업", "에이스", "1선발", "선발", "5선발", "마무리", "필승조", "불펜", "추격조", "2군"];
console.log(`■ 자리 경쟁을 얹었을 때 입지가 어떻게 바뀌나 (시즌 ${total}개)\n`);
console.log("  자리         지금 →  경쟁 적용");
for (const k of ORDER) {
  if (!before[k] && !after[k]) continue;
  const d = ((after[k] ?? 0) - (before[k] ?? 0)) / total * 100;
  console.log(`  ${k.padEnd(10)} ${pct(before, k).padStart(6)} → ${pct(after, k).padStart(6)}   ${d > 0 ? "+" : ""}${d.toFixed(1)}%p`);
}
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const q = (a: number[], x: number) => [...a].sort((m, n) => m - n)[Math.floor(a.length * x)] ?? 0;
console.log(`\n  자리가 바뀐 시즌 ${pushedOut}/${total} = ${(pushedOut / total * 100).toFixed(0)}%`);
console.log(`  보통보다 센 경쟁자를 만난 시즌 ${blocked}/${total} = ${(blocked / total * 100).toFixed(0)}%`);
console.log(`  기량 차이 — 중앙 ${q(gaps, .5).toFixed(0)} · 상위10% ${q(gaps, .9).toFixed(0)}`);
console.log(`  경쟁자 OVR — 하위25% ${q(blockerOvrs, .25).toFixed(0)} · 중앙 ${q(blockerOvrs, .5).toFixed(0)} · 상위25% ${q(blockerOvrs, .75).toFixed(0)}  (지금 기준점 평균 ${avg(typicals).toFixed(1)})`);
console.log(`  보정 — 평균 ${avg(penalties).toFixed(1)} · 중앙 ${q(penalties, .5).toFixed(1)} · 상위10% ${q(penalties, .9).toFixed(1)} (−9 ~ +4)`);
