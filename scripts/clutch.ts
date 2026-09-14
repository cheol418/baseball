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
  let halves = 0, armed = 0, careers = 0;
  const war: number[] = [];
  for (const [grp, kind, pos, style] of CFG) {
    for (let i = 0; i < 60; i++) {
      const rng = new RNG(12000 + i * 37);
      const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
      careers++;
      const seen = new Set<string>();
      const g: GameState = autoPlay(newGame(p, "DAG", i * 61), {
        clutchPick: which,
        onStep: (c) => {
          if (c.phase === "FIRST_HALF" || c.phase === "ALL_STAR") {
            const k = `${c.year}:${c.phase}`;
            if (!seen.has(k)) { seen.add(k); halves++; if (c.pendingClutch) armed++; }
          }
          for (const m of c.monthLines ?? []) {
            if (!m.clutch) continue;
            const k = `${c.year}:${m.key}`;
            if (seen.has(k)) continue;
            seen.add(k);
            rows.push({ grp, opt: m.clutch.optionLabel, outcome: m.clutch.outcome.title, success: m.clutch.success, fame: m.clutch.outcome.fame });
          }
        },
      });
      war.push(g.seasons.filter((s) => s.level === "KBO").reduce((a, b) => a + b.line.war, 0));
    }
  }
  return { rows, halves, armed, careers, war };
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const base = run(0);
console.log(`■ 승부처 발생 — 반기 ${base.halves}번 중 ${base.armed}번 (${Math.round(base.armed / base.halves * 100)}%)`);
console.log(`  실제로 치른 승부처 ${base.rows.length}회 · 커리어당 ${(base.rows.length / base.careers).toFixed(1)}회\n`);

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
