/** 아시안게임 연령 제한 — 실제 KBO 규정(만 25세 이하 또는 프로 4년차 이하 + 와일드카드 3명) */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";
import { isAgeEligible } from "../src/lib/national";

const byAge: Record<number, { picked: number; n: number; wild: number }> = {};
const tourCnt: Record<string, number> = {};
for (let i = 0; i < 260; i++) {
  const rng = new RNG(200 + i);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "s", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  let prev: GameState | null = null;
  autoPlay(newGame(p, "DAG", i * 13), {
    joinNational: true,
    onStep: (g: GameState) => {
      // 아시안게임이 열린 해에 발탁됐는가
      const r = g.intlResults.find((x) => x.year === g.year);
      if (r && !prev?.intlResults.some((x) => x.year === g.year)) {
        tourCnt[r.tournamentId] = (tourCnt[r.tournamentId] ?? 0) + 1;
        if (r.tournamentId === "ASIAN_GAMES") {
          const a = g.player.age;
          byAge[a] ??= { picked: 0, n: 0, wild: 0 };
          byAge[a].picked++;
          if (!isAgeEligible(g)) byAge[a].wild++;
        }
      }
      prev = g;
    },
  });
}
console.log("■ 아시안게임 발탁 나이 분포 (와일드카드 = 연령 제한 밖)");
let tot = 0, wild = 0;
for (const a of Object.keys(byAge).map(Number).sort((x, y) => x - y)) {
  const b = byAge[a];
  tot += b.picked; wild += b.wild;
  console.log(`  ${a}세  ${String(b.picked).padStart(3)}회${b.wild ? `  (와일드카드 ${b.wild})` : ""}`);
}
console.log(`  합계 ${tot}회 · 와일드카드 ${wild}회 (${(wild / Math.max(1, tot) * 100).toFixed(0)}%) — 실제는 24명 중 3명 = 13%`);
console.log("\n■ 대회별 발탁 횟수 (올림픽·P12·WBC는 연령 제한 없음)");
for (const [k, v] of Object.entries(tourCnt)) console.log(`  ${k.padEnd(14)} ${v}회`);
