/** 인지도 눈금이 살아 있는가 — 포화되면 정보량이 0이다 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, careerTotals, seasonsAtLevel } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

const end: number[] = [], peak: number[] = [];
const byWar: { war: number; fame: number }[] = [];
const path: number[][] = [];
for (let i = 0; i < 90; i++) {
  const rng = new RNG(4400 + i * 13);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "s", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const trace: number[] = [];
  const g: GameState = autoPlay(newGame(p, "DAG", i * 29), {
    onStep: (x: GameState) => { if (x.phase === "SPRING_CAMP") trace.push(x.player.fame); },
  });
  end.push(g.player.fame);
  peak.push(Math.max(...trace, g.player.fame));
  const t = careerTotals(g.seasons, kind, "KBO") as Record<string, number>;
  byWar.push({ war: t.war, fame: g.player.fame });
  if (path.length < 3 && seasonsAtLevel(g.seasons, "KBO").length > 12) path.push(trace);
}
const q = (a: number[], x: number) => [...a].sort((m, n) => m - n)[Math.floor(a.length * x)];
console.log(`■ 은퇴 시 인지도 — 하위10% ${q(end, .1)} · 하위25% ${q(end, .25)} · 중앙 ${q(end, .5)} · 상위25% ${q(end, .75)} · 상위10% ${q(end, .9)} · 최대 ${Math.max(...end)}`);
console.log(`  100에 붙은 비율 ${(end.filter((v) => v >= 99).length / end.length * 100).toFixed(0)}% (포화되면 눈금이 죽는다)`);
console.log(`■ 커리어 최고 인지도 — 중앙 ${q(peak, .5)} · 상위10% ${q(peak, .9)}`);
console.log("\n■ 통산 WAR ↔ 은퇴 시 인지도 (눈금이 실력을 구분하는가)");
for (const [lo, hi] of [[0, 15], [15, 30], [30, 50], [50, 200]] as [number, number][]) {
  const a = byWar.filter((x) => x.war >= lo && x.war < hi);
  if (!a.length) continue;
  console.log(`  WAR ${String(lo).padStart(2)}~${hi === 200 ? "+" : hi}  n=${String(a.length).padStart(3)}  인지도 평균 ${(a.reduce((s2, x) => s2 + x.fame, 0) / a.length).toFixed(0)}`);
}
console.log("\n■ 한 선수의 인지도 흐름 (캠프마다)");
for (const t of path) console.log(`  ${t.map((v) => String(v).padStart(3)).join(" →")}`);
