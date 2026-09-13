/** 이적 관심도 분포 확인 — 기량·명성·보직대로 시장 반응이 갈리는지 본다 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame, makeTransferTargets } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { teamById } from "../src/lib/teams";

const CASES: [string, number, number][] = [
  ["2군을 오가는 저연차", 1013, 1],
  ["1군 준주전", 1013, 4],
  ["1군 주전", 1007, 6],
  ["리그 정상급", 1031, 9],
];

for (const [label, seed, kbo] of CASES) {
  const rng = new RNG(seed);
  const p = rollCandidate({ name: "샘플", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
  const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), {
    stopAt: (c) => c.phase === "STOVE" && c.seasons.filter((x) => x.level === "KBO").length >= kbo,
  });
  if (g.phase !== "STOVE") { console.log(`${label}: 도달 실패`); continue; }

  const last = g.seasons[g.seasons.length - 1];
  const targets = makeTransferTargets(g, new RNG(g.seed));
  const ints = targets.map((t) => t.interest);
  const odds = targets.map((t) => t.odds);
  console.log(
    `\n■ ${label} — OVR ${overall(g.player)} · 명성 ${Math.round(g.player.fame)} · 신뢰 ${Math.round(g.trust)}`
    + ` · ${last.level} ${last.role} · 직전 WAR ${last.line.war.toFixed(1)}`,
  );
  console.log(
    `  관심 ${Math.min(...ints)}~${Math.max(...ints)} (평균 ${(ints.reduce((a, b) => a + b, 0) / ints.length).toFixed(1)})`
    + ` · 성사 ${Math.round(Math.min(...odds) * 100)}~${Math.round(Math.max(...odds) * 100)}%`
    + ` · 관심 70↑ 구단 ${ints.filter((v) => v >= 70).length}/${ints.length}`,
  );
  for (const t of targets) {
    const tm = teamById(t.teamId);
    console.log(
      `    ${tm.short.padEnd(8)} 전력${String(tm.power).padStart(3)} 육성${String(tm.youth).padStart(3)} 자금${String(tm.money).padStart(3)}`
      + `  관심 ${String(t.interest).padStart(2)}  성사 ${String(Math.round(t.odds * 100)).padStart(2)}%  ${t.role.padEnd(4)} ${t.note}`,
    );
  }
}
