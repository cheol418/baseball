/** 희망 구단 선택이 실제로 의미가 있는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, wishOdds } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { TEAMS } from "../src/lib/teams";
import type { GameState } from "../src/lib/types";

let got = 0, n = 0;
const byPick: Record<string, { got: number; n: number }> = {};
const byYouth: Record<string, { got: number; n: number }> = {};
for (let i = 0; i < 400; i++) {
  const rng = new RNG(9300 + i * 7);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "s", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const wishId = TEAMS[i % TEAMS.length].id;
  let done = false;
  autoPlay(newGame(p, wishId, i * 13), {
    onStep: (g: GameState) => {
      if (done || !g.draftPick || g.draftPick.overall === 0) return;
      done = true; n++;
      const hit = g.draftPick.teamId === wishId;
      if (hit) got++;
      const pk = g.draftPick.overall;
      const band = pk <= 10 ? "1~10순위" : pk <= 30 ? "11~30순위" : "31순위~";
      (byPick[band] ??= { got: 0, n: 0 });
      byPick[band].n++; if (hit) byPick[band].got++;
      const y = TEAMS.find((t) => t.id === wishId)!.youth;
      const yb = y >= 70 ? "육성 70+" : y >= 60 ? "육성 60~69" : "육성 ~59";
      (byYouth[yb] ??= { got: 0, n: 0 });
      byYouth[yb].n++; if (hit) byYouth[yb].got++;
    },
  });
}
console.log(`■ 희망 구단 입단 성공률  ${got}/${n} = ${(got / n * 100).toFixed(1)}%  (아무 팀이나 걸릴 확률 ${(100 / TEAMS.length).toFixed(0)}%)`);
console.log("\n■ 공식 자체 — 지명 순위 × 구단 육성 성향 (교란 없이)");
console.log("     순위    육성50   육성62   육성75");
for (const pk of [1, 5, 10, 20, 35, 50, 70]) {
  console.log(`    ${String(pk).padStart(3)}순위   ${[50, 62, 75].map((y) => `${(wishOdds(pk, y) * 100).toFixed(0)}%`.padStart(6)).join("  ")}`);
}
console.log("\n  지명 순위별 (실측 — 밴드마다 육성 성향이 섞여 있어 교란됨)");
for (const [k, v] of Object.entries(byPick)) console.log(`    ${k.padEnd(10)} ${(v.got / v.n * 100).toFixed(1)}%  (n=${v.n})`);
console.log("  희망 구단의 육성 성향별");
for (const [k, v] of Object.entries(byYouth).sort()) console.log(`    ${k.padEnd(10)} ${(v.got / v.n * 100).toFixed(1)}%  (n=${v.n})`);
/* 커리어 전체에서 희망 구단과 얼마나 엮이는가 */
let everPlayed = 0, seasonsAt = 0, totalSeasons = 0, careers = 0;
for (let i = 0; i < 160; i++) {
  const rng = new RNG(4100 + i * 11);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "s", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const wishId = TEAMS[i % TEAMS.length].id;
  const g: GameState = autoPlay(newGame(p, wishId, i * 29), { transferChance: 0.5 });
  const kbo = g.seasons.filter((x) => x.level === "KBO");
  if (!kbo.length) continue;
  careers++;
  const at = kbo.filter((x) => x.teamId === wishId).length;
  seasonsAt += at; totalSeasons += kbo.length;
  if (at > 0) everPlayed++;
}
console.log(`\n■ 커리어 전체 (n=${careers}, 이적 적극)`);
console.log(`  희망 구단에서 한 시즌이라도 뛴 커리어  ${(everPlayed / careers * 100).toFixed(0)}%`);
console.log(`  1군 시즌 중 희망 구단에서 보낸 비율    ${(seasonsAt / totalSeasons * 100).toFixed(0)}%  (무작위면 10%)`);
