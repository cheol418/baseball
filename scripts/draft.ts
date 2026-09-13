/** 진로 선택(고졸 드래프트 vs 대학 진학)이 지명 결과를 어떻게 바꾸는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame, advance } from "../src/lib/career";
import type { GameState } from "../src/lib/types";

function run(seed: number, path: "DRAFT" | "COLLEGE") {
  const rng = new RNG(seed);
  const p = rollCandidate({ name: "샘플", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
  let g: GameState = newGame(p, "DAG", seed * 13);
  let guard = 0;
  while (g.phase !== "SPRING_CAMP" && guard++ < 30) {
    if (g.phase === "HS_SEASON" || g.phase === "COLLEGE_SEASON") g = advance(g, { type: "SIM_AMATEUR" });
    else if (g.phase === "PATH_CHOICE") {
      // 첫 갈림길만 선택을 따르고, 미지명 후에는 대학으로 재도전
      g = advance(g, { type: "CHOOSE_PATH", path: g.draftMissed ? "COLLEGE" : path });
    } else if (g.phase === "DRAFT") g = advance(g, { type: "DO_DRAFT" });
    else break;
  }
  return {
    pick: g.draftPick?.overall ?? -1,
    age: g.player.age,
    ovr: overall(g.player),
    missed: g.draftPick?.overall === 0,
  };
}

for (const path of ["DRAFT", "COLLEGE"] as const) {
  const rows = Array.from({ length: 200 }, (_, i) => run(20000 + i * 17, path));
  const picked = rows.filter((r) => r.pick > 0);
  const pct = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * q)];
  const picks = picked.map((r) => r.pick);
  console.log(`\n■ ${path === "DRAFT" ? "고졸 — 곧바로 신인 드래프트" : "대학 진학 후 드래프트"} (n=200)`);
  console.log(`  지명 ${picked.length}명 · 미지명 ${rows.filter((r) => r.missed).length}명`);
  console.log(`  지명 순위  상위25% ${pct(picks, 0.25)}순위 · 중앙 ${pct(picks, 0.5)}순위 · 하위25% ${pct(picks, 0.75)}순위`);
  console.log(`  1라운드(10순위 내) ${picks.filter((v) => v <= 10).length}명 · 전체 1~3순위 ${picks.filter((v) => v <= 3).length}명`);
  console.log(`  입단 시 나이 평균 ${(rows.reduce((a, r) => a + r.age, 0) / rows.length).toFixed(1)}세 · OVR 평균 ${(rows.reduce((a, r) => a + r.ovr, 0) / rows.length).toFixed(1)}`);
}
