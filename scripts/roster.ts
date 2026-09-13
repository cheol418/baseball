/** 월별 콜업·강등이 실제로 일어나는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, formatMoney } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

const runs: GameState[] = [];
for (let i = 0; i < 30; i++) {
  const rng = new RNG(8800 + i * 211);
  const p = rollCandidate(
    { name: "x", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng,
  );
  runs.push(autoPlay(newGame(p, "DAJ", rng.int(1, 2 ** 30)), { transferChance: 0 }));
}

const ups = runs.map((g) => g.logs.filter((l) => l.title === "1군 콜업").length);
const downs = runs.map((g) => g.logs.filter((l) => l.title === "2군 이동 통보").length);
const split = runs.flatMap((g) => g.seasons.filter((s) => s.note?.includes("1군에서 보냈")).length);
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);

console.log("■ 엔트리 이동 (n=30 커리어)\n");
console.log(`  커리어당 콜업 ${avg(ups)}회 · 강등 ${avg(downs)}회`);
console.log(`  1군/2군을 섞어 보낸 시즌 ${avg(split)}회`);
console.log(`  최고 연봉 평균 ${formatMoney(runs.reduce((a, g) => a + Math.max(0, ...g.seasons.map((s) => s.salary)), 0) / runs.length)}`);
console.log(`  1군 시즌 평균 ${avg(runs.map((g) => g.seasons.filter((s) => s.level === "KBO").length))}`);

// 표본 하나의 초반 흐름
const sample = runs.find((g) => g.logs.some((l) => l.title === "1군 콜업")) ?? runs[0];
console.log(`\n■ 표본 — ${sample.player.name}`);
for (const s of sample.seasons.slice(0, 8)) {
  console.log(`  ${s.year} ${s.age}세 ${s.level.padEnd(7)} ${s.role.padEnd(4)} ${formatMoney(s.salary).padStart(9)}  ${s.note ?? ""}`);
}
for (const l of sample.logs.filter((x) => x.title.includes("콜업") || x.title.includes("2군 이동")).slice(0, 6)) {
  console.log(`  ${l.year} ${l.icon} ${l.title} — ${l.body}`);
}
