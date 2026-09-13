/** 성적 대비 타이틀 — 같은 WAR 구간에서 타자와 투수가 상을 똑같이 받는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { MAJOR_TITLES } from "../src/lib/sim";
import { autoPlay } from "./autoplay";
import type { PitcherLine, HitterLine, SeasonRecord } from "../src/lib/types";

const CFG = [
  ["타자", "HITTER", "CF", "toolsy"], ["타자", "HITTER", "1B", "slugger"],
  ["선발", "PITCHER", "SP", "power_p"], ["선발", "PITCHER", "SP", "control_p"],
  ["마무리", "PITCHER", "CP", "power_p"],
] as const;

const seasons: { grp: string; s: SeasonRecord }[] = [];
for (const [grp, kind, pos, style] of CFG) {
  for (let i = 0; i < 110; i++) {
    const rng = new RNG(31000 + i * 23);
    const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    const g = autoPlay(newGame(p, "DAG", i * 41), {});
    for (const s of g.seasons) if (s.level === "KBO") seasons.push({ grp, s });
  }
}
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const BUCKETS: [string, number, number][] = [["WAR 2~3", 2, 3], ["WAR 3~4", 3, 4], ["WAR 4~5", 4, 5], ["WAR 5+", 5, 99]];

console.log("■ WAR 구간별 · 그 시즌에 타이틀을 받았을 확률");
for (const [lab, lo, hi] of BUCKETS) {
  const line: string[] = [];
  for (const grp of ["타자", "선발", "마무리"]) {
    const a = seasons.filter((x) => x.grp === grp && x.s.line.war >= lo && x.s.line.war < hi);
    if (a.length < 12) { line.push(`${grp} —`); continue; }
    const t = a.filter((x) => x.s.awards.some((w) => MAJOR_TITLES.includes(w))).length;
    const gg = a.filter((x) => x.s.awards.includes("골든글러브")).length;
    line.push(`${grp} 타이틀 ${Math.round(t / a.length * 100)}% 골글 ${Math.round(gg / a.length * 100)}% (n=${a.length})`);
  }
  console.log(`  ${lab.padEnd(8)} ${line.join(" | ")}`);
}

console.log("\n■ 에이스 시즌의 실제 성적 (선발, WAR 3.5+)");
const ace = seasons.filter((x) => x.grp === "선발" && x.s.line.war >= 3.5).map((x) => x.s.line as PitcherLine);
console.log(`  n=${ace.length}  ERA ${avg(ace.map((l) => l.era)).toFixed(2)} · ${avg(ace.map((l) => l.w)).toFixed(1)}승 · ${avg(ace.map((l) => l.ip)).toFixed(0)}이닝 · ${avg(ace.map((l) => l.so)).toFixed(0)}K · K/9 ${avg(ace.map((l) => l.k9)).toFixed(2)}`);
const top = seasons.filter((x) => x.grp === "타자" && x.s.line.war >= 3.5).map((x) => x.s.line as HitterLine);
console.log(`■ 주전 타자 (WAR 3.5+) n=${top.length}  ${avg(top.map((l) => l.avg)).toFixed(3)} · ${avg(top.map((l) => l.hr)).toFixed(1)}홈런 · ${avg(top.map((l) => l.rbi)).toFixed(0)}타점`);
console.log(`\n리그 1위 기준선: 홈런 30~44 · 타율 .330~.368 · 타점 112~142 | 다승 13~17 · ERA 2.35~3.15 · 탈삼진 138~180`);

console.log("\n■ WAR 상위 꼬리 (1군 시즌 전체 대비 비율)");
for (const grp of ["타자", "선발", "마무리"]) {
  const a = seasons.filter((x) => x.grp === grp).map((x) => x.s.line.war);
  const pct = (q: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * q)]?.toFixed(1);
  console.log(`  ${grp.padEnd(4)} n=${a.length}  중앙 ${pct(0.5)} · 상위10% ${pct(0.9)} · 상위3% ${pct(0.97)} · 최대 ${Math.max(...a).toFixed(1)}`
    + `  |  WAR5+ ${(a.filter((v) => v >= 5.4).length / a.length * 100).toFixed(1)}%  (MVP 문턱)`);
}
console.log("\n■ 선발 최고 시즌 승수 분포 (다승왕 기준선 13~17)");
const spw = seasons.filter((x) => x.grp === "선발").map((x) => (x.s.line as PitcherLine).w);
const sp = (q: number) => [...spw].sort((x, y) => x - y)[Math.floor(spw.length * q)];
console.log(`  중앙 ${sp(0.5)}승 · 상위10% ${sp(0.9)}승 · 상위3% ${sp(0.97)}승 · 최대 ${Math.max(...spw)}승`);
const spip = seasons.filter((x) => x.grp === "선발").map((x) => (x.s.line as PitcherLine).ip);
console.log(`  이닝 중앙 ${sp === null ? 0 : [...spip].sort((x, y) => x - y)[Math.floor(spip.length * 0.5)].toFixed(0)} · 상위10% ${[...spip].sort((x, y) => x - y)[Math.floor(spip.length * 0.9)].toFixed(0)} (실제 KBO 규정이닝 144, 에이스 180~190)`);

console.log("\n■ 커리어당 수상");
const careers: Record<string, { t: number; gg: number; mvp: number; n: number }> = {};
for (const grp of ["타자", "선발", "마무리"]) {
  const a = seasons.filter((x) => x.grp === grp);
  const nCareer = grp === "마무리" ? 110 : 220;
  const t = a.filter((x) => x.s.awards.some((w) => MAJOR_TITLES.includes(w))).length;
  careers[grp] = { t, gg: a.filter((x) => x.s.awards.includes("골든글러브")).length, mvp: a.filter((x) => x.s.awards.some((w) => w.includes("MVP"))).length, n: nCareer };
  const c = careers[grp];
  console.log(`  ${grp.padEnd(4)} 타이틀 ${(c.t / c.n).toFixed(2)}회 · 골글 ${(c.gg / c.n).toFixed(2)}회 · MVP ${(c.mvp / c.n).toFixed(2)}회  (실제 KBO 레전드 기준 MVP 0.3~1회)`);
}
