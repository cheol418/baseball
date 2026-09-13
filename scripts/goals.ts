/** 시즌 목표 — 유형·보직별로 다르게 나오는지, 달성률이 적절한지 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const CONFIGS: [string, "HITTER" | "PITCHER", string, string][] = [
  ["거포 1루수", "HITTER", "1B", "slugger"],
  ["교타자 2루수", "HITTER", "2B", "contact"],
  ["호타준족 중견수", "HITTER", "CF", "toolsy"],
  ["수비형 포수", "HITTER", "C", "defense"],
  ["파워피처 선발", "PITCHER", "SP", "power_p"],
  ["제구형 선발", "PITCHER", "SP", "control_p"],
  ["이닝이터 선발", "PITCHER", "SP", "horse_p"],
  ["마무리", "PITCHER", "CP", "power_p"],
  ["불펜", "PITCHER", "RP", "finesse_p"],
];

let allMet = 0, allTot = 0, noReason = 0;

for (const [label, kind, pos, style] of CONFIGS) {
  const seen: Record<string, [number, number]> = {}; // id -> [달성, 전체]
  for (let i = 0; i < 30; i++) {
    const rng = new RNG(3000 + i * 41);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));
    for (const s of g.seasons) {
      if (!s.goal) continue;
      const k = s.goal.label;
      seen[k] = seen[k] ?? [0, 0];
      seen[k][1]++;
      if (s.goal.met) seen[k][0]++;
      allTot++;
      if (s.goal.met) allMet++;
      else if (!s.goal.reason) noReason++;
    }
  }
  const rows = Object.entries(seen).sort((a, b) => b[1][1] - a[1][1]);
  const tot = rows.reduce((a, r) => a + r[1][1], 0);
  const met = rows.reduce((a, r) => a + r[1][0], 0);
  console.log(`\n■ ${label} — 목표 ${tot}건 · 달성률 ${Math.round((met / tot) * 100)}% · 종류 ${rows.length}가지`);
  for (const [k, [m, t]] of rows) {
    console.log(`    ${k.padEnd(18)} ${String(t).padStart(3)}건  달성 ${String(Math.round((m / t) * 100)).padStart(3)}%`);
  }
}
console.log(`\n■ 전체 — ${allTot}건 · 달성률 ${Math.round((allMet / allTot) * 100)}% · 사유 없는 미달 ${noReason}건`);
