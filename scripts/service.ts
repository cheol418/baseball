/** 병역 복무가 정확히 18개월(1.5시즌)인지 — 복무 시즌 수와 복귀 시점 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { isHitterLine } from "../src/lib/sim";
import type { HitterLine } from "../src/lib/types";

for (const mil of ["SANGMU", "ACTIVE"] as const) {
  const armySeasons: number[] = [];
  const returnPa: number[] = [];
  let careers = 0, served = 0;

  for (let i = 0; i < 80; i++) {
    const rng = new RNG(61000 + i * 17);
    const p = rollCandidate({ name: "샘플", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), { military: mil });
    careers++;
    const army = g.seasons.filter((s) => s.level === "ARMY");
    if (!army.length) continue;
    served++;
    armySeasons.push(army.length);

    // 복무 기록 바로 다음 시즌 = 후반기 합류 시즌
    const lastArmyYear = army[army.length - 1].year;
    const back = g.seasons.find((s) => s.year === lastArmyYear + 1 && s.level !== "ARMY");
    if (back && isHitterLine(back.line)) returnPa.push((back.line as HitterLine).pa);
  }
  const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "—");
  const dist: Record<number, number> = {};
  for (const n of armySeasons) dist[n] = (dist[n] ?? 0) + 1;
  console.log(`\n■ ${mil === "SANGMU" ? "상무" : "현역"} (복무 경험 ${served}/${careers})`);
  console.log(`  복무 기록 시즌 수  ${Object.entries(dist).map(([k, v]) => `${k}시즌 ${v}명`).join(" · ")}  (기대: 1시즌)`);
  console.log(`  복귀 시즌 타석     평균 ${avg(returnPa)}  (후반기만 뛰므로 주전 기준 250 안팎이면 정상)`);
}
