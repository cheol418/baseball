/** 부상이 달력 위에 놓이는가 — 다친 달은 비고, 성한 달은 제 몫을 뛴다 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState, PitcherLine, HitterLine } from "../src/lib/types";

const cases: { avail: number; months: number[]; zero: number; total: number }[] = [];
for (let i = 0; i < 120; i++) {
  const rng = new RNG(6200 + i * 7);
  const p = rollCandidate({ name: "s", number: 1, kind: "PITCHER", position: "SP", bats: "R", throws: "R", styleId: "power_p", armSlot: "OVER" }, rng);
  const seen = new Set<number>();
  // monthLines는 그 반기 것만 들고 있다 — 전반기·후반기를 따로 받아 이어 붙인다
  let h1: number[] = [];
  autoPlay(newGame(p, "DAG", i * 19), {
    onStep: (g: GameState) => {
      if (g.phase === "HALF_REVIEW" && g.liveHalf === "H1" && g.monthLines) {
        h1 = g.monthLines.map((m) => (m.line as PitcherLine).ip ?? (m.line as HitterLine).pa ?? 0);
      }
      if (g.phase !== "SEASON_END" || seen.has(g.lastSeasonIndex ?? -1)) return;
      seen.add(g.lastSeasonIndex ?? -1);
      const rec = g.seasons[g.lastSeasonIndex ?? -1];
      if (!rec || rec.level !== "KBO" || !g.monthLines) return;
      const ips = [...h1, ...g.monthLines.map((m) => (m.line as PitcherLine).ip ?? (m.line as HitterLine).pa ?? 0)];
      cases.push({
        avail: g.seasonAvailability,
        months: ips,
        zero: ips.filter((v) => v < 1).length,
        total: ips.reduce((a, b) => a + b, 0),
      });
    },
  });
}
const hurt = cases.filter((c) => c.avail < 0.7);
const fine = cases.filter((c) => c.avail >= 0.97);
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
console.log(`■ 크게 다친 시즌 (가동률 < 0.70) n=${hurt.length}`);
console.log(`  기록이 0인 달 평균 ${avg(hurt.map((c) => c.zero)).toFixed(1)}개 / 7개  (부상이면 몇 달은 통째로 비어야 한다)`);
console.log(`  0인 달이 하나도 없는 시즌 ${hurt.filter((c) => c.zero === 0).length}건`);
console.log(`■ 건강한 시즌 (가동률 ≥ 0.97) n=${fine.length}  기록이 0인 달 평균 ${avg(fine.map((c) => c.zero)).toFixed(1)}개`);
console.log("\n■ 크게 다친 시즌의 월별 이닝 표본");
for (const c of hurt.slice(0, 6)) {
  console.log(`  가동률 ${c.avail.toFixed(2)}  [${c.months.map((v) => v.toFixed(0).padStart(3)).join(" ")}]  합 ${c.total.toFixed(0)}`);
}
