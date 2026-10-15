/** 스쿼드 — 동료가 실제로 들고 나는가, 자리 경쟁이 서사가 되는가 */
import { RNG } from "../src/lib/rng";
import { overall, rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { blockerOf, competesWith, SLOT_LABEL } from "../src/lib/squad";
import type { GameState } from "../src/lib/types";

const ARCH = [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"], ["HITTER", "C", "defense"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "SP", "control_p"], ["PITCHER", "CP", "power_p"],
] as const;

let leaves = 0, retires = 0, careers = 0, seasons = 0;
let blockerSeasons = 0, aheadSeasons = 0, noBlocker = 0;
/** 입지별로 — 간판인데 같은 자리에 나보다 나은 사람이 있으면 앞뒤가 안 맞는다 */
const byRole: Record<string, { ahead: number; n: number }> = {};
const blockerChanges: number[] = [];
const sample: string[] = [];

for (let i = 0; i < 90; i++) {
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const rng = new RNG(2600 + i * 11);
  const p = rollCandidate({ name: "나", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
  const seen = new Set<number>();
  let lastBlocker: string | null = null, changes = 0, counted = false;

  const g: GameState = autoPlay(newGame(p, "DAG", i * 17), {
    onStep: (x: GameState) => {
      if (x.phase !== "SPRING_CAMP" || !x.squad?.length || seen.has(x.year)) return;
      seen.add(x.year); seasons++; counted = true;
      const me = { kind: x.player.kind, position: x.player.position };
      const b = blockerOf(x.squad, me);
      if (!b) { noBlocker++; return; }
      blockerSeasons++;
      const ahead = overall(x.player) > overall(b.player);
      if (ahead) aheadSeasons++;
      const prev = x.seasons[x.seasons.length - 1];
      const r = prev?.level === "KBO" ? prev.role : "2군";
      (byRole[r] ??= { ahead: 0, n: 0 });
      byRole[r].n++; if (ahead) byRole[r].ahead++;
      if (lastBlocker && lastBlocker !== b.id) changes++;
      lastBlocker = b.id;
    },
  });
  if (counted) { careers++; blockerChanges.push(changes); }
  leaves += g.logs.filter((l) => / (FA 이적|트레이드)$/.test(l.title)).length;
  retires += g.logs.filter((l) => / 은퇴$/.test(l.title) && !l.title.includes("동기")).length;

  if (sample.length < 1 && g.squad?.length) {
    const me = { kind: g.player.kind, position: g.player.position };
    const b = blockerOf(g.squad, me);
    sample.push(g.squad.map((m) =>
      `    ${SLOT_LABEL[m.slot].padEnd(6)} ${m.name} (${m.position}) ${m.player.age}세 OVR ${String(overall(m.player)).padStart(2)}`
      + `${m.id === b?.id ? "  ← 내 자리를 막고 있다" : competesWith(me, m) ? "  (자리 경쟁)" : ""}`).join("\n"));
  }
}
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
console.log(`■ 스쿼드 (커리어 ${careers}개 · 스프링캠프 ${seasons}회)`);
console.log(`  커리어당 동료 은퇴 ${(retires / careers).toFixed(1)}명 · FA/트레이드 이탈 ${(leaves / careers).toFixed(1)}명`);
console.log(`  내 자리 경쟁자가 있던 시즌 ${(blockerSeasons / seasons * 100).toFixed(0)}% · 없던 시즌 ${(noBlocker / seasons * 100).toFixed(0)}%`);
console.log(`  그중 내가 더 나았던 시즌 ${(aheadSeasons / Math.max(1, blockerSeasons) * 100).toFixed(0)}%`);
console.log(`  경쟁자가 바뀐 횟수 — 커리어당 ${avg(blockerChanges).toFixed(1)}회  (안 바뀌면 이야기가 안 생긴다)`);
console.log(`\n■ 지난 시즌 입지별 — 내 자리 경쟁자보다 내가 나았나`);
for (const [k, v] of Object.entries(byRole).sort((a, b) => b[1].n - a[1].n)) {
  if (v.n < 25) continue;
  console.log(`  ${k.padEnd(8)} n=${String(v.n).padStart(4)}  내가 앞섬 ${(v.ahead / v.n * 100).toFixed(0)}%`);
}
console.log(`\n■ 은퇴 시점의 스쿼드 한 예\n${sample[0] ?? "  —"}`);
