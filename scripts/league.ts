/**
 * 리그 판도 — 평균은 고정인가, 팀은 실제로 움직이는가.
 *
 * 평균이 밀리면 성적·입지·순위가 통째로 인플레된다(규칙 2).
 * 그렇다고 안 움직이면 이적·FA가 계산 한 번으로 끝나는 고정 문제가 된다.
 */
import { RNG } from "../src/lib/rng";
import { advanceLeague, newLeague, type League } from "../src/lib/league";
import { TEAMS } from "../src/lib/teams";

const BASE_MEAN = TEAMS.reduce((a, t) => a + t.power, 0) / TEAMS.length;
const YEARS = 18, RUNS = 300;

const means: number[] = [], spreads: number[] = [];
const swings: number[] = [];          // 한 팀이 18년 동안 오간 폭
const tops: Record<string, number> = {};   // 1위를 한 해 수
let flips = 0, topYears = 0;          // 하위권 → 상위권 뒤집힘

for (let r = 0; r < RUNS; r++) {
  const rng = new RNG(1500 + r * 7);
  let lg: League = newLeague(2026);
  const hist: Record<string, number[]> = Object.fromEntries(TEAMS.map((t) => [t.id, [lg.power[t.id]]]));
  for (let y = 1; y <= YEARS; y++) {
    lg = advanceLeague(lg, rng, 2026 + y);
    const vals = TEAMS.map((t) => lg.power[t.id]);
    means.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    spreads.push(Math.max(...vals) - Math.min(...vals));
    const best = TEAMS.slice().sort((a, b) => lg.power[b.id] - lg.power[a.id])[0];
    tops[best.short] = (tops[best.short] ?? 0) + 1; topYears++;
    for (const t of TEAMS) hist[t.id].push(lg.power[t.id]);
  }
  for (const t of TEAMS) {
    const h = hist[t.id];
    swings.push(Math.max(...h) - Math.min(...h));
    // 바닥권(하위3)에 있다가 상위3까지 올라온 적이 있는가
    let wasLow = false;
    for (const v of h) {
      if (v <= 62) wasLow = true;
      else if (wasLow && v >= 76) { flips++; break; }
    }
  }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const q = (a: number[], x: number) => [...a].sort((m, n) => m - n)[Math.floor(a.length * x)];
console.log(`■ ${RUNS}번 × ${YEARS}년`);
console.log(`  리그 평균 — 처음 ${BASE_MEAN.toFixed(1)} → 이후 평균 ${avg(means).toFixed(2)} (최소 ${Math.min(...means).toFixed(1)} · 최대 ${Math.max(...means).toFixed(1)})`);
console.log(`     ★ 평균이 밀리면 안 된다 — 오차 ${(avg(means) - BASE_MEAN).toFixed(2)}`);
console.log(`  최강 ↔ 최약 차이 — 중앙 ${q(spreads, .5).toFixed(0)} (처음 ${(Math.max(...TEAMS.map((t) => t.power)) - Math.min(...TEAMS.map((t) => t.power))).toFixed(0)})`);
console.log(`  한 팀이 18년 동안 오간 폭 — 중앙 ${q(swings, .5).toFixed(0)} · 상위10% ${q(swings, .9).toFixed(0)}`);
console.log(`  바닥권(62↓)에서 상위권(76↑)까지 올라간 사례 ${(flips / (RUNS * TEAMS.length) * 100).toFixed(0)}% (팀·커리어 기준)`);
console.log(`\n■ 1위를 차지한 해의 몫 (한 팀이 독식하면 판도가 아니다)`);
for (const [k, v] of Object.entries(tops).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(6)} ${(v / topYears * 100).toFixed(0)}%  ${"█".repeat(Math.round(v / topYears * 60))}`);
