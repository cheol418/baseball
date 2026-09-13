/** 상무 지원·선발 결과 — 지원해도 떨어지는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";

let careers = 0, applied = 0, passed = 0, exempt = 0, active = 0, tries: number[] = [];

for (const [kind, pos, style] of [
  ["HITTER", "CF", "toolsy"], ["PITCHER", "SP", "power_p"],
] as ["HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 60; i++) {
    const rng = new RNG(37000 + i * 19);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), { military: "SANGMU" });
    careers++;
    const apps = g.logs.filter((l) => l.title === "상무 합격" || l.title === "상무 불합격");
    if (apps.length) { applied++; tries.push(apps.length); }
    if (g.logs.some((l) => l.title === "상무 합격")) passed++;
    if (g.military === "EXEMPT") exempt++;
    if (g.seasons.some((s) => s.teamName === "현역 복무")) active++;
  }
}
const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "—");
console.log(`■ 상무 (커리어 ${careers}개)`);
console.log(`  지원 경험      ${applied}명 (${Math.round((applied / careers) * 100)}%) · 평균 ${avg(tries)}회 지원`);
console.log(`  상무 합격      ${passed}명 (지원자의 ${Math.round((passed / Math.max(1, applied)) * 100)}%)`);
console.log(`  국제대회 면제  ${exempt}명 (${Math.round((exempt / careers) * 100)}%)`);
console.log(`  현역 복무      ${active}명 (${Math.round((active / careers) * 100)}%)`);
