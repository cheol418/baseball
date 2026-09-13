/** 국가대표 발탁이 실제로 몇 살에, 얼마나 뜨는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { isCalledUp, tournamentOf, TOURNAMENTS } from "../src/lib/national";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

// 대회별 발탁 확률을 나이대별로 직접 계산
console.log("■ 나이별 발탁 확률 (WAR 3.0 · 인지도 30 가정, 병역 미필)\n");
console.log("  나이  OVR   아시안게임  프리미어12  올림픽   WBC");
for (const [age, ovr] of [[21, 56], [23, 60], [25, 62], [27, 63], [29, 63], [31, 62]] as [number, number][]) {
  const row: string[] = [];
  for (const t of [TOURNAMENTS.ASIAN_GAMES, TOURNAMENTS.PREMIER12, TOURNAMENTS.OLYMPIC, TOURNAMENTS.WBC]) {
    let hit = 0;
    for (let i = 0; i < 3000; i++) {
      const fake = {
        player: { age, fame: 30, name: "x" },
        military: "PENDING",
        seasons: [{ level: "KBO", line: { war: 3 }, awards: [] }],
      } as unknown as GameState;
      // overall()을 쓸 수 없으니 isCalledUp 내부 계산을 그대로 재현
      const score = (ovr - t.bar) * 1.1 + 3 * 2.2 + 30 * 0.06
        + (t.id === "ASIAN_GAMES" && age <= 27 ? 7 : 0)
        + (t.id === "ASIAN_GAMES" && age >= 30 ? -6 : 0);
      const p = Math.max(0.01, Math.min(0.9, 0.1 + score * 0.05));
      if (Math.random() < p) hit++;
      void fake;
    }
    row.push(`${((hit / 3000) * 100).toFixed(0)}%`.padStart(8));
  }
  console.log(`  ${age}세  ${String(ovr).padStart(3)}  ${row.join("  ")}`);
}

console.log("\n■ 실제 커리어에서의 발탁 (n=40)\n");
const ages: number[] = [];
let careers = 0, withIntl = 0, exempt = 0;
for (let i = 0; i < 40; i++) {
  const rng = new RNG(2100 + i * 391);
  const p = rollCandidate(
    { name: "x", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng,
  );
  const g = autoPlay(newGame(p, "DAJ", rng.int(1, 2 ** 30)), { transferChance: 0 });
  careers++;
  if (g.intlResults.length) withIntl++;
  if (g.military === "EXEMPT") exempt++;
  for (const r of g.intlResults) {
    const rec = g.seasons.find((s) => s.year === r.year);
    if (rec) ages.push(rec.age);
  }
}
const before28 = ages.filter((a) => a <= 27).length;
console.log(`  발탁 경험      ${withIntl}/${careers}`);
console.log(`  총 발탁 횟수   ${ages.length} (커리어당 ${(ages.length / careers).toFixed(1)}회)`);
console.log(`  28세 이전 발탁 ${before28}회 (${ages.length ? Math.round((before28 / ages.length) * 100) : 0}%)`);
console.log(`  최초 발탁 나이 ${ages.length ? Math.min(...ages) : "-"}세 / 평균 ${ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "-"}세`);
console.log(`  국제대회로 병역 면제  ${exempt}/${careers}`);
void tournamentOf; void isCalledUp; void overall;
