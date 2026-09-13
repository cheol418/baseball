/** 출전 환경에 따른 성장 차이 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, grow, developmentRate, DEV_RATE_LABEL, makeTrainingOptions } from "../src/lib/player";
import type { LevelTag, Player } from "../src/lib/types";

const CASES: [LevelTag, string, string][] = [
  ["MINOR", "주전", "2군 주전"],
  ["COLLEGE", "주전", "대학"],
  ["ARMY", "주전", "상무"],
  ["KBO", "주전", "1군 주전"],
  ["KBO", "준주전", "1군 준주전"],
  ["KBO", "백업", "1군 백업"],
  ["ARMY", "복무", "현역 복무"],
];

console.log("  환경          배수(20세/26세)  등급      20→23세 OVR 상승  23→26세 상승");
for (const [level, role, label] of CASES) {
  const rateYoung = developmentRate(level, role, 20);
  const rateOld = developmentRate(level, role, 26);
  const gains: number[][] = [[], []];
  for (let i = 0; i < 200; i++) {
    const rng = new RNG(77 + i * 53);
    const p: Player = rollCandidate(
      { name: "x", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" },
      rng,
    );
    p.age = 20;
    const start = overall(p);
    for (let a = 20; a < 23; a++) {
      p.age = a;
      grow(p, rng, makeTrainingOptions(p, rng)[0], developmentRate(level, role, a));
    }
    const mid = overall(p);
    for (let a = 23; a < 26; a++) {
      p.age = a;
      grow(p, rng, makeTrainingOptions(p, rng)[0], developmentRate(level, role, a));
    }
    gains[0].push(mid - start);
    gains[1].push(overall(p) - mid);
  }
  const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  console.log(
    `  ${label.padEnd(12)} ${rateYoung.toFixed(2)}/${rateOld.toFixed(2)}  ${DEV_RATE_LABEL(rateYoung).padEnd(8)}  ` +
    `${avg(gains[0]).padStart(14)}  ${avg(gains[1]).padStart(12)}`,
  );
}
