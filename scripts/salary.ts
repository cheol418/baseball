/** 연봉 곡선 — 나이·연차별 분포와 커리어 최고 연봉 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, formatMoney } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const pct = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))];

const byAge: Record<number, number[]> = {};
const peaks: number[] = [];
const allKbo: number[] = [];

for (const [kind, pos, style] of [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"],
] as [ "HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(7000 + i * 31);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));
    let peak = 0;
    for (const s of g.seasons) {
      if (s.level !== "KBO") continue;
      (byAge[s.age] = byAge[s.age] ?? []).push(s.salary);
      allKbo.push(s.salary);
      peak = Math.max(peak, s.salary);
    }
    if (peak) peaks.push(peak);
  }
}

console.log("■ 나이별 1군 연봉");
for (let age = 20; age <= 38; age++) {
  const a = byAge[age];
  if (!a || a.length < 12) continue;
  console.log(
    `  ${age}세  n=${String(a.length).padStart(3)}`
    + `  중앙 ${formatMoney(pct(a, 0.5)).padStart(9)}`
    + `  상위25% ${formatMoney(pct(a, 0.75)).padStart(9)}`
    + `  상위10% ${formatMoney(pct(a, 0.9)).padStart(9)}`,
  );
}
console.log(`\n■ 전체 1군 시즌 연봉 — 중앙 ${formatMoney(pct(allKbo, 0.5))} · 상위10% ${formatMoney(pct(allKbo, 0.9))} · 최대 ${formatMoney(Math.max(...allKbo))}`);
console.log(`■ 커리어 최고 연봉 (n=${peaks.length}) — 하위25% ${formatMoney(pct(peaks, 0.25))} · 중앙 ${formatMoney(pct(peaks, 0.5))} · 상위25% ${formatMoney(pct(peaks, 0.75))} · 최대 ${formatMoney(Math.max(...peaks))}`);
console.log(`■ 10억 이상 받은 커리어 ${peaks.filter((v) => v >= 100000).length}/${peaks.length} · 20억 이상 ${peaks.filter((v) => v >= 200000).length}/${peaks.length}`);
