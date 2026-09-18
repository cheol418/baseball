/** 같은 장면이 한 커리어에서 몇 번 되풀이되는가 — 반복은 재미의 반대말이다 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

const scenes: number[] = [], uniq: number[] = [], evTypes: number[] = [], evN: number[] = [];
const topScene: Record<string, number> = {};
for (let i = 0; i < 40; i++) {
  const rng = new RNG(5500 + i * 11);
  const p = rollCandidate({ name: "s", number: 1, kind: i % 2 ? "HITTER" : "PITCHER", position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seen: string[] = [];
  const ev: string[] = [];
  let prev: GameState | null = null;
  /**
   * 같은 승부처를 두 번 세지 않는다.
   * `onStep`은 한 상태를 여러 번 훑으므로, 그대로 밀어 넣으면 한 커리어가
   * 200번 넘게 마주친 것으로 찍힌다 — 실제로는 쉰 번 안팎이다. (실제로 겪음)
   * 그 해·그 달의 승부처 하나를 한 번만 센다.
   */
  const counted = new Set<string>();
  autoPlay(newGame(p, "DAG", i * 23), {
    onStep: (g: GameState) => {
      const take = (key: string, title: string) => {
        if (counted.has(key)) return;
        counted.add(key); seen.push(title);
      };
      for (const m of g.monthLines ?? []) {
        if (m.clutchSituation) take(`M${g.year}${m.label}`, m.clutchSituation.title);
      }
      if (g.allStarGame?.clutchSituation) take(`AS${g.year}`, g.allStarGame.clutchSituation.title);
      if (g.postseason?.clutchSituation) take(`PS${g.year}`, g.postseason.clutchSituation.title);
      for (const r of g.intlResults) {
        if (r.clutchSituation) take(`IN${r.year}`, r.clutchSituation.title);
      }
      const rec = g.seasons[g.lastSeasonIndex ?? -1];
      if (rec?.clutchSituation) take(`AM${rec.year}`, rec.clutchSituation.title);
      if (g.pendingEvent && g.pendingEvent.title !== prev?.pendingEvent?.title) ev.push(g.pendingEvent.title);
      prev = g;
    },
  });
  const u = new Set(seen);
  scenes.push(seen.length); uniq.push(u.size);
  for (const t of u) topScene[t] = (topScene[t] ?? 0) + 1;
  evN.push(ev.length); evTypes.push(new Set(ev).size);
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`■ 승부처 — 커리어당 ${avg(scenes).toFixed(0)}번 마주치는데 서로 다른 장면은 ${avg(uniq).toFixed(0)}종`);
console.log(`  → 같은 장면을 평균 ${(avg(scenes) / avg(uniq)).toFixed(1)}번씩 다시 본다`);
console.log(`\n■ 이벤트 — 커리어당 ${avg(evN).toFixed(1)}회 · 서로 다른 종류 ${avg(evTypes).toFixed(1)}종`);
console.log(`\n■ 가장 자주 나오는 승부처 장면 (40커리어 중 몇 커리어에서 봤나)`);
for (const [k, v] of Object.entries(topScene).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`  ${k.padEnd(22)} ${v}/40`);
}
