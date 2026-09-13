/** 출신 학교 전력이 대회 성적·출전 기회를 어떻게 바꾸는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame, advance, draftForecast } from "../src/lib/career";
import { schoolOf, playingShare } from "../src/lib/school";
import { placementScore } from "../src/lib/amateur";
import { isHitterLine } from "../src/lib/sim";
import type { GameState, HitterLine } from "../src/lib/types";

const SCHOOLS = ["덕수고", "경남고", "지역강호고", "백호고", "작은고", ""];

console.log("■ 학교별 고교 3학년 시즌 (각 n=120)");
console.log("  학교          전력  대회총점  최고성적   PA   OPS    지명확률  예상라운드");
for (const name of SCHOOLS) {
  const info = schoolOf(name);
  const rows: { score: number; pa: number; ops: number; odds: number; best: string; round: string }[] = [];
  for (let i = 0; i < 120; i++) {
    const rng = new RNG(71000 + i * 13);
    const p = rollCandidate({ name: "샘플", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
    let g: GameState = newGame(p, "DAG", i * 17, name);
    let guard = 0;
    while (g.phase === "HS_SEASON" && guard++ < 5) g = advance(g, { type: "SIM_AMATEUR" });
    const rec = g.seasons[g.seasons.length - 1];
    if (!rec?.tournaments || !isHitterLine(rec.line)) continue;
    const l = rec.line as HitterLine;
    const best = rec.tournaments.reduce((a, b) => placementScore(b.placement) > placementScore(a.placement) ? b : a);
    const f = draftForecast(g);
    rows.push({
      score: rec.tournaments.reduce((a, t) => a + placementScore(t.placement), 0),
      pa: l.pa, ops: l.ops, odds: f.odds, best: best.placement, round: f.round,
    });
  }
  const avg = (f: (r: typeof rows[0]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
  const mode = (a: string[]) => {
    const c: Record<string, number> = {};
    for (const x of a) c[x] = (c[x] ?? 0) + 1;
    return Object.entries(c).sort((x, y) => y[1] - x[1])[0][0];
  };
  console.log(
    `  ${(info.elite ? "★" : " ") + info.name.padEnd(11)} ${String(info.power).padStart(3)}`
    + `  ${avg((r) => r.score).toFixed(1).padStart(6)}`
    + `  ${mode(rows.map((r) => r.best)).padStart(6)}`
    + `  ${String(Math.round(avg((r) => r.pa))).padStart(4)}`
    + `  ${avg((r) => r.ops).toFixed(3).slice(1)}`
    + `  ${(avg((r) => r.odds) * 100).toFixed(0).padStart(6)}%`
    + `  ${mode(rows.map((r) => r.round))}`,
  );
}

console.log("\n■ 출전 기회 — 같은 선수가 학교만 바꿨을 때");
for (const ovr of [45, 52, 60, 70]) {
  const line = [40, 55, 70, 85, 92].map((pw) => `전력${pw} ${(playingShare(pw, ovr) * 100).toFixed(0)}%`);
  console.log(`  OVR ${String(ovr).padStart(2)}  ${line.join(" · ")}`);
}
