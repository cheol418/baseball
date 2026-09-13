/** 국가대표 발탁 — 커리어 수준별로 제대로 뽑히는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, careerTotals } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { HitterLine } from "../src/lib/types";

const rows: { titles: number; hr: number; war: number; calls: number; kbo: number; pos: string }[] = [];

for (const [kind, pos, style] of [
  ["HITTER", "1B", "slugger"], ["HITTER", "CF", "toolsy"], ["HITTER", "DH", "slugger"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"],
] as ["HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(77000 + i * 19);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));
    const kbo = g.seasons.filter((s) => s.level === "KBO");
    if (kbo.length < 5) continue;
    const t = careerTotals(g.seasons, kind, "KBO") as Record<string, number>;
    const titles = kbo.reduce((a, s) =>
      a + s.awards.filter((x) => x.endsWith("왕") || x.includes("MVP") || x === "골든글러브").length, 0);
    rows.push({
      titles, hr: kind === "HITTER" ? t.hr : t.w, war: t.war,
      calls: g.intlResults.length, kbo: kbo.length, pos,
    });
  }
}

const band = (r: typeof rows[0]) =>
  r.titles >= 5 ? "타이틀 5회+" : r.titles >= 2 ? "타이틀 2~4회" : r.titles >= 1 ? "타이틀 1회" : "무관";
const groups: Record<string, typeof rows> = {};
for (const r of rows) (groups[band(r)] = groups[band(r)] ?? []).push(r);

console.log(`■ 커리어 수준별 국가대표 발탁 (n=${rows.length})`);
console.log("  구간            n   평균 타이틀  통산 WAR  발탁 횟수  한 번도 못 뽑힘");
for (const k of ["타이틀 5회+", "타이틀 2~4회", "타이틀 1회", "무관"]) {
  const a = groups[k];
  if (!a?.length) continue;
  const avg = (f: (r: typeof rows[0]) => number) => a.reduce((x, r) => x + f(r), 0) / a.length;
  const never = a.filter((r) => r.calls === 0).length;
  console.log(
    `  ${k.padEnd(12)} ${String(a.length).padStart(3)}`
    + `  ${avg((r) => r.titles).toFixed(1).padStart(9)}`
    + `  ${avg((r) => r.war).toFixed(1).padStart(8)}`
    + `  ${avg((r) => r.calls).toFixed(1).padStart(8)}`
    + `  ${String(never).padStart(6)}명 (${Math.round((never / a.length) * 100)}%)`,
  );
}

console.log("\n■ 포지션별 (수비 가치가 낮은 자리가 불리한가)");
const byPos: Record<string, typeof rows> = {};
for (const r of rows) (byPos[r.pos] = byPos[r.pos] ?? []).push(r);
for (const [k, a] of Object.entries(byPos)) {
  const avg = (f: (r: typeof rows[0]) => number) => a.reduce((x, r) => x + f(r), 0) / a.length;
  console.log(`  ${k.padEnd(4)} n=${String(a.length).padStart(3)}  통산 WAR ${avg((r) => r.war).toFixed(1).padStart(5)}  발탁 ${avg((r) => r.calls).toFixed(1)}회  한 번도 못 뽑힘 ${a.filter((r) => r.calls === 0).length}명`);
}
