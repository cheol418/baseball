/** 은퇴 후 컨텐츠 — 명예의 전당 헌액률과 진로 분포 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, computeHof, legacyContext, secondLifeOptions } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const tiers: Record<string, { n: number; in: number; ballots: number[] }> = {};
const paths: Record<string, { n: number; ok: number }> = {};
let optCount = 0, careers = 0;

for (const [kind, pos, style] of [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"],
] as ["HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(9000 + i * 19);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), { secondLife: i % 7 });
    careers++;

    const t = computeHof(g).tier;
    const v = g.hofVote;
    tiers[t] = tiers[t] ?? { n: 0, in: 0, ballots: [] };
    tiers[t].n++;
    if (v?.inducted) { tiers[t].in++; tiers[t].ballots.push(v.ballots.length); }

    const life = g.secondLife;
    if (life) {
      paths[life.name] = paths[life.name] ?? { n: 0, ok: 0 };
      paths[life.name].n++;
      if (life.success) paths[life.name].ok++;
    }
    optCount += secondLifeOptions(legacyContext(g, g.hofScore ?? 0)).length;
  }
}

const ORDER = ["레전드 (전설)", "명예의 전당", "프랜차이즈 스타", "리그 주전급", "1군 백업", "짧은 도전"];
console.log("■ 명예의 전당 헌액 (은퇴 5년 뒤부터 최대 10차 투표 · 기준 75%)");
for (const t of ORDER) {
  const r = tiers[t];
  if (!r) continue;
  const avgB = r.ballots.length ? (r.ballots.reduce((a, b) => a + b, 0) / r.ballots.length).toFixed(1) : "—";
  console.log(`  ${t.padEnd(14)} ${String(r.n).padStart(3)}명 중 헌액 ${String(r.in).padStart(3)}명 (${String(Math.round((r.in / r.n) * 100)).padStart(3)}%) · 평균 ${avgB}차 투표`);
}
console.log(`\n■ 은퇴 후 진로 (고를 수 있는 길 평균 ${(optCount / careers).toFixed(1)}가지)`);
for (const [name, r] of Object.entries(paths).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${name.padEnd(12)} ${String(r.n).padStart(3)}명 · 성공 ${String(Math.round((r.ok / r.n) * 100)).padStart(3)}%`);
}
