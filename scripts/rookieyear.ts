/** 신인 첫 시즌을 어디서 시작하는가 — 고졸/대졸 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, STYLES } from "../src/lib/player";
import { newGame, advance } from "../src/lib/career";
import type { GameState } from "../src/lib/types";

for (const college of [false, true]) {
  let kbo = 0, minor = 0, dev = 0, total = 0;
  const kboOvr: number[] = [], minorOvr: number[] = [];

  for (let i = 0; i < 250; i++) {
    const rng = new RNG(29000 + i * 13);
    const kind = i % 2 ? "HITTER" : "PITCHER";
    const styles = STYLES.filter((s) => s.kind === kind);
    const p = rollCandidate({
      name: "샘플", number: 1, kind, position: (kind === "HITTER" ? "CF" : "SP") as never,
      bats: "R", throws: "R", styleId: rng.pick(styles).id,
      armSlot: kind === "PITCHER" ? "OVER" : undefined,
      bias: [-1, 0, 1][i % 3],
    }, rng);

    let g: GameState = newGame(p, "DAG", i * 17);
    let guard = 0;
    // 드래프트를 지나 첫 스프링캠프에서 보직이 정해질 때까지
    while (g.phase !== "FIRST_HALF" && guard++ < 30) {
      if (g.phase === "HS_SEASON" || g.phase === "COLLEGE_SEASON") g = advance(g, { type: "SIM_AMATEUR" });
      else if (g.phase === "PATH_CHOICE") {
        const col = college && g.seasons.filter((x) => x.level === "COLLEGE").length < 2;
        g = advance(g, { type: "CHOOSE_PATH", path: col ? "COLLEGE" : "DRAFT" });
      } else if (g.phase === "DRAFT") g = advance(g, { type: "DO_DRAFT" });
      else if (g.phase === "SPRING_CAMP") {
        g = advance(g, { type: "TRAIN", optionId: g.pendingTraining![0].id });
      } else break;
    }
    if (g.phase !== "FIRST_HALF") continue;
    total++;
    if (g.contract?.role === "육성선수") dev++;
    else if (g.seasonLevel === "KBO") { kbo++; kboOvr.push(overall(g.player)); }
    else { minor++; minorOvr.push(overall(g.player)); }
  }
  const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "—");
  console.log(`\n■ ${college ? "대졸" : "고졸"} 신인 첫 시즌 (n=${total})`);
  console.log(`  1군에서 시작  ${String(kbo).padStart(3)}명 (${String(Math.round((kbo / total) * 100)).padStart(2)}%)  평균 OVR ${avg(kboOvr)}`);
  console.log(`  2군에서 시작  ${String(minor).padStart(3)}명 (${String(Math.round((minor / total) * 100)).padStart(2)}%)  평균 OVR ${avg(minorOvr)}`);
  console.log(`  육성선수      ${String(dev).padStart(3)}명 (${String(Math.round((dev / total) * 100)).padStart(2)}%)`);
}
