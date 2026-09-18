/**
 * 유형별 커리어 격차가 어디서 오는가.
 *
 * 같은 OVR이면 유형끼리 값이 3.5~4.2 WAR로 붙어 있는데(`stylewar.ts`),
 * 커리어 통산 WAR은 25 ↔ 51로 두 배가 벌어진다. 값이 아니라
 * **얼마나 크는지 · 얼마나 나가는지**에서 갈리는 것이다.
 */
import { RNG } from "../src/lib/rng";
import { overall, rollCandidate, STYLES, deriveStyle } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState, HitterLine, SeasonRecord } from "../src/lib/types";

console.log("■ 타자 유형별 — 시작 OVR이 같을 때 커리어가 어떻게 갈리는가 (각 24명)");
console.log("  유형         생성OVR   피크OVR   1군시즌   평균타석   시즌WAR   통산WAR   유형유지");
for (const st of STYLES.filter((x) => x.kind === "HITTER")) {
  let gen = 0, peak = 0, seasons = 0, pa = 0, war = 0, kept = 0, n = 0;
  for (let i = 0; i < 24; i++) {
    const rng = new RNG(8100 + i * 31);
    const p = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: st.id }, rng);
    gen += overall(p);
    let hi = 0;
    const g: GameState = autoPlay(newGame(p, "DAG", i * 53), {
      onStep: (s: GameState) => { hi = Math.max(hi, overall(s.player)); },
    });
    peak += hi; n++;
    if (deriveStyle(g.player).id === st.id) kept++;
    for (const rec of g.seasons as SeasonRecord[]) {
      if (rec.level !== "KBO") continue;
      seasons++; pa += (rec.line as HitterLine).pa; war += rec.line.war;
    }
  }
  console.log(
    `  ${st.name.padEnd(10)} ${(gen / n).toFixed(1).padStart(6)}  ${(peak / n).toFixed(1).padStart(7)}`
    + `  ${(seasons / n).toFixed(1).padStart(7)}  ${(pa / seasons).toFixed(0).padStart(8)}`
    + `  ${(war / seasons).toFixed(2).padStart(7)}  ${(war / n).toFixed(1).padStart(7)}`
    + `  ${((kept / n) * 100).toFixed(0).padStart(6)}%`,
  );
}
