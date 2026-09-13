/** FA 계약 규모 — 직전 연봉 대비 배수가 실제 KBO와 맞는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, formatMoney } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const rows: { age: number; prev: number; total: number; years: number; aav: number }[] = [];

for (const [kind, pos, style] of [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"],
] as ["HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(13000 + i * 37);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), {
      stopAt: (c) => c.phase === "FA" && !!c.pendingOffers?.length,
    });
    if (g.phase !== "FA" || !g.pendingOffers?.length) continue;
    const prev = g.contract?.salary ?? 0;
    for (const o of g.pendingOffers) {
      rows.push({ age: g.player.age, prev, total: o.total, years: o.years, aav: o.total / o.years });
    }
  }
}

const pct = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * q)];
const mult = rows.filter((r) => r.prev > 0).map((r) => r.aav / r.prev);
console.log(`■ FA 제안 ${rows.length}건 (커리어 ${new Set(rows.map((r) => r.prev)).size}개)`);
console.log(`  총액      하위25% ${formatMoney(pct(rows.map((r) => r.total), 0.25))} · 중앙 ${formatMoney(pct(rows.map((r) => r.total), 0.5))} · 상위25% ${formatMoney(pct(rows.map((r) => r.total), 0.75))} · 최대 ${formatMoney(Math.max(...rows.map((r) => r.total)))}`);
console.log(`  연평균    하위25% ${formatMoney(pct(rows.map((r) => r.aav), 0.25))} · 중앙 ${formatMoney(pct(rows.map((r) => r.aav), 0.5))} · 상위25% ${formatMoney(pct(rows.map((r) => r.aav), 0.75))}`);
console.log(`  계약연수  중앙 ${pct(rows.map((r) => r.years), 0.5)}년 · 최대 ${Math.max(...rows.map((r) => r.years))}년`);
console.log(`  ★ 연평균÷직전연봉  하위25% ${pct(mult, 0.25).toFixed(1)}배 · 중앙 ${pct(mult, 0.5).toFixed(1)}배 · 상위25% ${pct(mult, 0.75).toFixed(1)}배`);
console.log(`     (실제 KBO 2026: 강백호 3.6 · 박찬호 4.4 · 박해민 2.7 · 김현수 3.3 · 최형우 1.3)`);

const byAge: Record<string, number[]> = {};
for (const r of rows.filter((x) => x.prev > 0)) {
  const k = r.age <= 29 ? "29세 이하" : r.age <= 32 ? "30~32세" : r.age <= 35 ? "33~35세" : "36세 이상";
  (byAge[k] = byAge[k] ?? []).push(r.aav / r.prev);
}
console.log("\n■ 나이대별 연평균÷직전연봉");
for (const k of ["29세 이하", "30~32세", "33~35세", "36세 이상"]) {
  const a = byAge[k];
  if (!a?.length) continue;
  console.log(`  ${k.padEnd(9)} n=${String(a.length).padStart(3)}  중앙 ${pct(a, 0.5).toFixed(1)}배`);
}
