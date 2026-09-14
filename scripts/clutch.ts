/** 승부처 — 발생률, 선택지 균형, 기록에 미치는 영향 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState, HitterLine, PitcherLine } from "../src/lib/types";

const CFG = [
  ["거포", "HITTER", "1B", "slugger"], ["교타자", "HITTER", "CF", "contact"],
  ["파워투수", "PITCHER", "SP", "power_p"], ["제구투수", "PITCHER", "SP", "control_p"],
] as const;

type Row = { grp: string; opt: string; outcome: string; success: boolean; fame: number };

/** 선택지 index를 고정해 커리어를 돌린다 */
function run(which: number) {
  const rows: Row[] = [];
  const byStage: Record<string, number> = {};
  let careers = 0;
  for (const [grp, kind, pos, style] of CFG) {
    for (let i = 0; i < 60; i++) {
      const rng = new RNG(12000 + i * 37);
      const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
      careers++;
      const seen = new Set<string>();
      const take = (key: string, stage: string, c: { optionLabel: string; outcome: { title: string; fame: number }; success: boolean }) => {
        if (seen.has(key)) return;
        seen.add(key);
        byStage[stage] = (byStage[stage] ?? 0) + 1;
        rows.push({ grp, opt: c.optionLabel, outcome: c.outcome.title, success: c.success, fame: c.outcome.fame });
      };
      autoPlay(newGame(p, "DAG", i * 61), {
        clutchPick: which,
        onStep: (c) => {
          for (const m of c.monthLines ?? []) {
            if (m.clutch) take(`${c.year}:${m.key}`, m.level === "MINOR" ? "2군" : "1군 월별", m.clutch);
          }
          for (const s2 of c.seasons) {
            if (s2.clutch) take(`am:${s2.year}`, s2.level === "COLLEGE" ? "대학" : "고교", s2.clutch);
            if (s2.allStarGame?.clutch) take(`as:${s2.year}`, "올스타", s2.allStarGame.clutch);
            if (s2.ps?.clutch) take(`ps:${s2.year}`, "가을야구", s2.ps.clutch);
          }
          for (const r of c.intlResults) {
            if (r.clutch) take(`intl:${r.year}`, "국제대회", r.clutch);
          }
        },
      });
    }
  }
  return { rows, careers, byStage };
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const base = run(0);
console.log(`■ 승부처 발생 (커리어 ${base.careers}개 · 총 ${base.rows.length}회 · 커리어당 ${(base.rows.length / base.careers).toFixed(1)}회)`);
for (const [k, v] of Object.entries(base.byStage).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(8)} ${String(v).padStart(5)}회 · 커리어당 ${(v / base.careers).toFixed(2)}`);
}
console.log("");

console.log("■ 선택지별 결과 — 타자/투수를 갈라서 (같은 시드에서 선택만 바꿈)");
for (const kindGrp of [["거포"], ["교타자"], ["파워투수"], ["제구투수"]]) {
  console.log(`\n  [${kindGrp.join(" · ")}]`);
  for (const which of [0, 1, 2]) {
    const r = which === 0 ? base : run(which);
    const rows = r.rows.filter((x) => kindGrp.includes(x.grp));
    if (!rows.length) continue;
    const label = rows[0].opt;
    const ok = rows.filter((x) => x.success).length;
    const evFame = avg(rows.map((x) => x.fame));
    console.log(
      `   ${which} ${label.padEnd(12)} n=${String(rows.length).padStart(4)}`
      + ` · 성공 ${Math.round(ok / rows.length * 100)}%`
      + ` · 기대 인지도 ${evFame >= 0 ? "+" : ""}${evFame.toFixed(2)}`,
    );
    const by: Record<string, number> = {};
    for (const x of rows) by[x.outcome] = (by[x.outcome] ?? 0) + 1;
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${Math.round(v / rows.length * 100)}%`).join(" · ");
    console.log(`${" ".repeat(7)}${top}`);
  }
}
