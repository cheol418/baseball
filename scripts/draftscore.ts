/** 고교 성적과 지명 예상의 관계 — 어떤 시즌이 몇 라운드로 평가되는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, potentialOverall } from "../src/lib/player";
import { newGame, advance, draftScore, draftForecast } from "../src/lib/career";
import { isHitterLine } from "../src/lib/sim";
import type { GameState, HitterLine } from "../src/lib/types";

const rows: { ovr: number; pot: number; ops: number; hr: number; war: number; score: number; round: string; odds: number }[] = [];

for (let i = 0; i < 300; i++) {
  const rng = new RNG(23000 + i * 17);
  const p = rollCandidate({ name: "샘플", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
  let g: GameState = newGame(p, "DAG", i * 13);
  let guard = 0;
  while (g.phase !== "PATH_CHOICE" && guard++ < 12) {
    if (g.phase === "HS_SEASON") g = advance(g, { type: "SIM_AMATEUR" });
    else break;
  }
  if (g.phase !== "PATH_CHOICE") continue;
  const last = g.seasons[g.seasons.length - 1];
  if (!last || !isHitterLine(last.line)) continue;
  const l = last.line as HitterLine;
  const f = draftForecast(g);
  rows.push({
    ovr: overall(g.player), pot: potentialOverall(g.player),
    ops: l.ops, hr: l.hr, war: l.war,
    score: draftScore(g), round: f.round, odds: f.odds,
  });
}

const byRound: Record<string, typeof rows> = {};
for (const r of rows) (byRound[r.round] = byRound[r.round] ?? []).push(r);
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
/** OPS는 1을 넘을 수 있으므로 1 미만일 때만 앞자리 0을 뗀다 */
const f3 = (v: number) => (v < 1 ? v.toFixed(3).slice(1) : v.toFixed(3));

const ORDER = ["1라운드 상위", "1라운드", "2~3라운드", "4~6라운드", "7~9라운드", "10라운드", "미지명 유력"];
console.log(`■ 고교 3학년 마친 시점의 지명 예상 분포 (n=${rows.length})`);
console.log("  예상             비율   평균 OVR  평균 잠재  평균 OPS  평균 HR  평균 WAR");
for (const k of ORDER) {
  const a = byRound[k];
  if (!a?.length) continue;
  console.log(
    `  ${k.padEnd(12)} ${String(Math.round((a.length / rows.length) * 100)).padStart(4)}%`
    + `  ${avg(a.map((r) => r.ovr)).toFixed(1).padStart(7)}`
    + `  ${avg(a.map((r) => r.pot)).toFixed(1).padStart(8)}`
    + `  ${f3(avg(a.map((r) => r.ops))).padStart(8)}`
    + `  ${avg(a.map((r) => r.hr)).toFixed(1).padStart(6)}`
    + `  ${avg(a.map((r) => r.war)).toFixed(1).padStart(7)}`,
  );
}
console.log(`\n  전체 평균 OVR ${avg(rows.map((r) => r.ovr)).toFixed(1)} · OPS ${f3(avg(rows.map((r) => r.ops)))} · 점수 ${avg(rows.map((r) => r.score)).toFixed(1)}`);
const top = [...rows].sort((a, b) => b.score - a.score).slice(0, 5);
console.log("\n■ 최상위 5명 상세");
for (const r of top) {
  console.log(`  점수 ${r.score.toFixed(1)}  OVR ${r.ovr}  잠재 ${r.pot}  OPS ${r.ops.toFixed(3)}  HR ${r.hr}  WAR ${r.war.toFixed(1)}  → ${r.round}`);
}

console.log("\n■ 화면 사례 대조 — OVR 52 · OPS .726 · 2홈런 · WAR −0.2 근처인 선수들");
const like = rows.filter((r) => r.ovr <= 54 && r.ops <= 0.76);
if (like.length) {
  const dist: Record<string, number> = {};
  for (const r of like) dist[r.round] = (dist[r.round] ?? 0) + 1;
  console.log(`  n=${like.length} → ${ORDER.filter((k) => dist[k]).map((k) => `${k} ${Math.round((dist[k] / like.length) * 100)}%`).join(" · ")}`);
}
