/** 새 타이틀 기준선을 잡기 위한 분포 측정 — 안타·득점·출루율·장타율 / 승률·이닝 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { PitcherLine, HitterLine, SeasonRecord } from "../src/lib/types";

const CFG = [
  ["타자", "HITTER", "CF", "toolsy"], ["타자", "HITTER", "1B", "slugger"],
  ["타자", "HITTER", "2B", "contact"],
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
const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)] ?? 0;
const show = (lab: string, a: number[], f = 0) =>
  console.log(`  ${lab.padEnd(10)} n=${String(a.length).padEnd(5)} 중앙 ${q(a, .5).toFixed(f)} · 상위10% ${q(a, .9).toFixed(f)} · 상위3% ${q(a, .97).toFixed(f)} · 상위1% ${q(a, .99).toFixed(f)} · 최대 ${Math.max(...a).toFixed(f)}`);

const H = seasons.filter((x) => x.grp === "타자" && (x.s.line as HitterLine).pa >= 440).map((x) => x.s.line as HitterLine);
console.log("■ 규정타석(pa>=440) 타자");
show("안타", H.map((l) => l.h));
show("득점", H.map((l) => l.r));
show("출루율", H.map((l) => l.obp), 3);
show("장타율", H.map((l) => l.slg), 3);
show("타율", H.map((l) => l.avg), 3);
show("홈런", H.map((l) => l.hr));
show("타점", H.map((l) => l.rbi));
show("도루", H.map((l) => l.sb));

const P = seasons.filter((x) => x.grp === "선발" && (x.s.line as PitcherLine).ip >= 100).map((x) => x.s.line as PitcherLine);
console.log("\n■ 선발(ip>=100)");
show("이닝", P.map((l) => l.ip));
show("승", P.map((l) => l.w));
show("승률", P.filter((l) => l.w + l.l >= 10).map((l) => l.w / (l.w + l.l)), 3);
show("탈삼진", P.map((l) => l.so));
const lo=(a: number[], p: number)=>[...a].sort((x,y)=>x-y)[Math.floor(a.length*p)];
const eras=P.filter((l)=>l.ip>=130).map((l)=>l.era);
console.log(`  ERA(ip>=130) n=${eras.length} 하위10% ${lo(eras,.1).toFixed(2)} · 하위3% ${lo(eras,.03).toFixed(2)} · 하위1% ${lo(eras,.01).toFixed(2)} · 최소 ${Math.min(...eras).toFixed(2)}`);
const cp=seasons.filter((x)=>x.grp==="마무리").map((x)=>x.s.line as PitcherLine);
show("세이브", cp.map((l)=>l.sv));

console.log("\n■ 현재 타이틀별 수상 빈도 (1군 시즌 전체 대비)");
const all = seasons.length;
const cnt: Record<string, number> = {};
for (const x of seasons) for (const a of x.s.awards) cnt[a] = (cnt[a] ?? 0) + 1;
for (const [k, v] of Object.entries(cnt).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(12)} ${v} / ${all} = ${(v / all * 100).toFixed(1)}%`);
