/** 신규 시스템(올스타·가을야구·국제대회·병역·협상·이적) 동작 점검 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, formatMoney } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { TOURNAMENTS, tournamentOf } from "../src/lib/national";
import type { GameState } from "../src/lib/types";

console.log("■ 국제대회 일정");
for (let y = 2026; y <= 2033; y++) {
  const t = tournamentOf(y);
  console.log(`  ${y}  ${t!.icon} ${t!.name.padEnd(12)} ${t!.exemption ?? "병역 혜택 없음"}`);
}

function run(seed: number, military: "SANGMU" | "ACTIVE", nego: "accept" | "push" | "arbitration", transferChance: number) {
  const rng = new RNG(seed);
  const p = rollCandidate(
    { name: "점검", number: 9, kind: "HITTER", position: "CF", bats: "L", throws: "R", styleId: "toolsy" }, rng,
  );
  return autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), { military, nego, transferChance, joinNational: true });
}

const runs: GameState[] = [];
for (let i = 0; i < 30; i++) {
  runs.push(run(7000 + i * 131, i % 3 === 0 ? "ACTIVE" : "SANGMU", (["accept", "push", "arbitration"] as const)[i % 3], 0.35));
}

const pct = (n: number) => `${Math.round((n / runs.length) * 100)}%`;
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);

console.log("\n■ 시스템 발생률 (n=30)");
console.log(`  올스타 선정 경험      ${pct(runs.filter((g) => g.seasons.some((s) => s.allStar)).length)}  (평균 ${avg(runs.map((g) => g.seasons.filter((s) => s.allStar).length))}회)`);
console.log(`  가을야구 진출 경험    ${pct(runs.filter((g) => g.seasons.some((s) => s.ps)).length)}  (평균 ${avg(runs.map((g) => g.seasons.filter((s) => s.ps).length))}회)`);
console.log(`  한국시리즈 우승       ${pct(runs.filter((g) => g.seasons.some((s) => s.champion)).length)}`);
console.log(`  국가대표 발탁         ${pct(runs.filter((g) => g.intlResults.length).length)}  (평균 ${avg(runs.map((g) => g.intlResults.length))}회)`);
console.log(`  국제대회 메달         ${pct(runs.filter((g) => g.intlResults.some((r) => r.medal)).length)}`);

const byMil = runs.reduce<Record<string, number>>((a, g) => ({ ...a, [g.military]: (a[g.military] ?? 0) + 1 }), {});
console.log(`  병역 처리 결과        ${JSON.stringify(byMil)}`);
console.log(`  병역 면제(국제대회)   ${pct(runs.filter((g) => g.intlResults.some((r) => r.exempted)).length)}`);
console.log(`  상무/현역 복무 시즌   ${avg(runs.map((g) => g.seasons.filter((s) => s.level === "ARMY").length))}시즌`);
console.log(`  이적 성사 경험        ${pct(runs.filter((g) => g.logs.some((l) => l.title === "이적 성사")).length)}`);
console.log(`  최고 연봉 평균        ${formatMoney(runs.reduce((a, g) => a + Math.max(0, ...g.seasons.map((s) => s.salary)), 0) / runs.length)}`);
console.log(`  구단 신뢰 평균        ${avg(runs.map((g) => g.trust))} / 동료 관계 ${avg(runs.map((g) => g.teammate))}`);

// 대표 커리어 하나 상세
const sample = runs.find((g) => g.intlResults.length && g.seasons.some((s) => s.level === "ARMY")) ?? runs[0];
console.log(`\n■ 표본 커리어 — ${sample.player.name} (${sample.military})`);
for (const r of sample.seasons.filter((s) => s.level === "KBO" || s.level === "ARMY").slice(0, 20)) {
  const ps = r.ps ? ` PS:${r.ps.champion ? "우승" : r.ps.rounds[r.ps.rounds.length - 1]?.name ?? ""}` : "";
  console.log(`  ${r.year} ${String(r.age).padStart(2)}세 ${r.level.padEnd(5)} ${r.teamName.padEnd(10)} ${r.role.padEnd(4)} ${r.teamRank ? `${r.teamRank}위` : "   "}${r.allStar ? " ★" : "  "}${ps}${r.awards.length ? ` 🏆${r.awards.join(",")}` : ""}`);
}
for (const r of sample.intlResults) console.log(`  ${r.year} ${TOURNAMENTS[r.tournamentId].icon} ${r.tournamentName} ${r.note}${r.exempted ? " → 병역 면제" : ""}`);
