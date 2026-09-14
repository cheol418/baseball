/** 고교·대학 대회 개인상 — 성적에 값하는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { HitterLine, PitcherLine } from "../src/lib/types";

type Row = { award: string | null; place: string; hitter: boolean; avg: number; hr: number; ops: number; era: number; ip: number; h: number };
const rows: Row[] = [];
for (const [kind, pos, style] of [["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"], ["PITCHER", "SP", "power_p"]] as const) {
  for (let i = 0; i < 120; i++) {
    const rng = new RNG(71000 + i * 19);
    const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    const g = autoPlay(newGame(p, "DAG", i * 31), { college: true });
    for (const s of g.seasons) {
      for (const t of s.tournaments ?? []) {
        const l = t.line as HitterLine & PitcherLine;
        rows.push({
          award: t.award, place: t.placement, hitter: l.pa !== undefined,
          avg: l.avg ?? 0, hr: l.hr ?? 0, ops: l.ops ?? 0, era: l.era ?? 0, ip: l.ip ?? 0, h: l.h ?? 0,
        });
      }
    }
  }
}
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const mvp = rows.filter((r) => r.award === "최우수선수상");
const good = rows.filter((r) => r.award === "우수선수상");
console.log(`■ 대회 ${rows.length}건 · 최우수 ${mvp.length}(${(mvp.length / rows.length * 100).toFixed(1)}%) · 우수 ${good.length}(${(good.length / rows.length * 100).toFixed(1)}%)`);
for (const [lab, a] of [["최우수선수상", mvp], ["우수선수상", good], ["무관", rows.filter((r) => !r.award)]] as const) {
  const hh = a.filter((r) => r.hitter);
  const pp = a.filter((r) => !r.hitter);
  console.log(`  ${lab.padEnd(7)} 타자 n=${String(hh.length).padStart(4)} 타율 ${avg(hh.map((r) => r.avg)).toFixed(3)} · ${avg(hh.map((r) => r.h)).toFixed(1)}안타 · ${avg(hh.map((r) => r.hr)).toFixed(2)}홈런 · OPS ${avg(hh.map((r) => r.ops)).toFixed(3)}`);
  console.log(`${" ".repeat(9)}투수 n=${String(pp.length).padStart(4)} ERA ${avg(pp.map((r) => r.era)).toFixed(2)} · ${avg(pp.map((r) => r.ip)).toFixed(1)}이닝`);
}
const bad = mvp.filter((r) => r.hitter && r.avg < 0.280);
console.log(`\n  ✗ 타율 .280 미만인데 최우수선수상 ${bad.length}건 (${mvp.filter((r) => r.hitter).length}건 중)`);
