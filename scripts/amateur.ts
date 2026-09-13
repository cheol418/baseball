/** 고교 전국대회 — 기량이 성적에, 성적이 드래프트에 반영되는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame, advance, draftForecast } from "../src/lib/career";
import { placementScore } from "../src/lib/amateur";

const buckets: Record<string, { n: number; score: number; odds: number; round: Record<string, number> }> = {};

for (let i = 0; i < 400; i++) {
  const rng = new RNG(6000 + i * 173);
  const p = rollCandidate(
    { name: "x", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" },
    rng,
  );
  let g = newGame(p, "DAJ", rng.int(1, 2 ** 30));
  const ovr = overall(p);
  g = advance(g, { type: "SIM_AMATEUR" });
  const rec = g.seasons[0];
  const total = (rec.tournaments ?? []).reduce((a, t) => a + placementScore(t.placement), 0);
  const f = draftForecast(g);
  const key = ovr >= 52 ? "상위(OVR 52+)" : ovr >= 46 ? "중위(46~51)" : "하위(~45)";
  const b = buckets[key] ??= { n: 0, score: 0, odds: 0, round: {} };
  b.n++; b.score += total; b.odds += f.odds;
  for (const t of rec.tournaments ?? []) b.round[t.placement] = (b.round[t.placement] ?? 0) + 1;
}

console.log("■ 기량대별 고교 전국대회 성적 (n=400)\n");
for (const [k, b] of Object.entries(buckets)) {
  const tot = Object.values(b.round).reduce((a, c) => a + c, 0);
  const dist = ["우승", "준우승", "4강", "8강", "16강 탈락"]
    .map((p) => `${p} ${Math.round(((b.round[p] ?? 0) / tot) * 100)}%`).join(" · ");
  console.log(`  ${k.padEnd(14)} 표본 ${String(b.n).padStart(3)}  대회점수 평균 ${(b.score / b.n).toFixed(1)}/12  지명확률 ${Math.round((b.odds / b.n) * 100)}%`);
  console.log(`     ${dist}`);
}
