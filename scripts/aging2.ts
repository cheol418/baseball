/** 나이에 따른 기록 감소 — 실제 KBO 노장과 비교 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { MAJOR_TITLES } from "../src/lib/sim";
import { autoPlay } from "./autoplay";
import type { HitterLine, PitcherLine, SeasonRecord } from "../src/lib/types";

const CFG = [
  ["타자", "HITTER", "1B", "slugger"], ["타자", "HITTER", "CF", "toolsy"],
  ["투수", "PITCHER", "SP", "power_p"], ["투수", "PITCHER", "SP", "control_p"],
] as const;

const rows: { kind: string; age: number; ovr: number; s: SeasonRecord }[] = [];
for (const [kind, k, pos, style] of CFG) {
  for (let i = 0; i < 100; i++) {
    const rng = new RNG(41000 + i * 29);
    const p = rollCandidate({ name: "s", number: 1, kind: k, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: k === "PITCHER" ? "OVER" : undefined }, rng);
    const seen = new Set<number>();
    autoPlay(newGame(p, "DAG", i * 67), {
      onStep: (c) => {
        if (seen.has(c.year) || !c.ovrAtSeasonStart) return;
        seen.add(c.year);
        rows.push({ kind, age: c.player.age, ovr: overall(c.player), s: null as never });
      },
    });
  }
}
// 시즌 기록은 완주한 커리어에서 따로 모은다
const seasons: { kind: string; age: number; s: SeasonRecord }[] = [];
for (const [kind, k, pos, style] of CFG) {
  for (let i = 0; i < 100; i++) {
    const rng = new RNG(41000 + i * 29);
    const p = rollCandidate({ name: "s", number: 1, kind: k, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: k === "PITCHER" ? "OVER" : undefined }, rng);
    const g = autoPlay(newGame(p, "DAG", i * 67), {});
    for (const s of g.seasons) if (s.level === "KBO") seasons.push({ kind, age: s.age, s });
  }
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const BANDS: [string, number, number][] = [
  ["25~27", 25, 27], ["28~30", 28, 30], ["31~33", 31, 33],
  ["34~35", 34, 35], ["36~37", 36, 37], ["38~39", 38, 39], ["40+", 40, 99],
];

console.log("■ 나이별 OVR (시즌 시작 시점)");
for (const [lab, lo, hi] of BANDS) {
  const a = rows.filter((r) => r.age >= lo && r.age <= hi);
  if (a.length < 10) continue;
  console.log(`  ${lab.padEnd(6)} n=${String(a.length).padStart(4)} · 평균 ${avg(a.map((r) => r.ovr)).toFixed(1)} · 상위10% ${[...a].map((r) => r.ovr).sort((x, y) => y - x)[Math.floor(a.length * 0.1)]}`);
}

console.log("\n■ 나이별 1군 성적 (타자)");
for (const [lab, lo, hi] of BANDS) {
  const a = seasons.filter((x) => x.kind === "타자" && x.age >= lo && x.age <= hi);
  if (a.length < 10) continue;
  const L = a.map((x) => x.s.line as HitterLine);
  const t = a.filter((x) => x.s.awards.some((w) => MAJOR_TITLES.includes(w))).length;
  console.log(`  ${lab.padEnd(6)} n=${String(a.length).padStart(4)} · ${avg(L.map((l) => l.avg)).toFixed(3)} · ${avg(L.map((l) => l.hr)).toFixed(1)}홈런 · OPS ${avg(L.map((l) => l.ops)).toFixed(3)} · WAR ${avg(L.map((l) => l.war)).toFixed(1)} · 타이틀 ${Math.round(t / a.length * 100)}%`);
}
console.log("\n■ 나이별 1군 성적 (투수)");
for (const [lab, lo, hi] of BANDS) {
  const a = seasons.filter((x) => x.kind === "투수" && x.age >= lo && x.age <= hi);
  if (a.length < 10) continue;
  const L = a.map((x) => x.s.line as PitcherLine);
  const t = a.filter((x) => x.s.awards.some((w) => MAJOR_TITLES.includes(w))).length;
  console.log(`  ${lab.padEnd(6)} n=${String(a.length).padStart(4)} · ERA ${avg(L.map((l) => l.era)).toFixed(2)} · ${avg(L.map((l) => l.ip)).toFixed(0)}이닝 · ${avg(L.map((l) => l.so)).toFixed(0)}K · WAR ${avg(L.map((l) => l.war)).toFixed(1)} · 타이틀 ${Math.round(t / a.length * 100)}%`);
}
console.log("\n  실제 KBO: 38세 이상 규정타석 타자는 시즌당 1~3명, 40세 타이틀은 사실상 없다.");
console.log("  최형우(40세) .300 17홈런이 예외적 사례로 회자되는 수준.");

/* ------------------------------------------------------------------ */
/* 생존 편향 제거 — 같은 선수의 전성기 대비 몇 %인가                      */
/* ------------------------------------------------------------------ */
const byCareer = new Map<string, { age: number; ovr: number; war: number; ops: number; era: number }[]>();
let ci = 0;
for (const [kind, k, pos, style] of CFG) {
  for (let i = 0; i < 100; i++) {
    const rng = new RNG(41000 + i * 29);
    const p = rollCandidate({ name: "s", number: 1, kind: k, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: k === "PITCHER" ? "OVER" : undefined }, rng);
    const g = autoPlay(newGame(p, "DAG", i * 67), {});
    const list = g.seasons.filter((s) => s.level === "KBO").map((s) => ({
      age: s.age, ovr: 0, war: s.line.war,
      ops: (s.line as HitterLine).ops ?? 0, era: (s.line as PitcherLine).era ?? 0,
    }));
    if (list.length >= 8) byCareer.set(`${kind}:${ci++}`, list);
  }
}
console.log(`\n■ 같은 선수 안에서 — 전성기(최고 WAR 시즌) 대비 (n=${byCareer.size}커리어)`);
for (const [lab, lo, hi] of BANDS) {
  const ratios: number[] = [];
  const opsDrop: number[] = [];
  for (const list of byCareer.values()) {
    const peak = list.reduce((a, b) => (b.war > a.war ? b : a), list[0]);
    if (peak.war <= 0.5) continue;
    for (const s of list) {
      if (s.age < lo || s.age > hi) continue;
      ratios.push(s.war / peak.war);
      if (peak.ops > 0 && s.ops > 0) opsDrop.push(s.ops - peak.ops);
    }
  }
  if (ratios.length < 10) continue;
  console.log(`  ${lab.padEnd(6)} n=${String(ratios.length).padStart(4)} · 전성기 WAR의 ${Math.round(avg(ratios) * 100)}%`
    + (opsDrop.length > 10 ? ` · OPS ${avg(opsDrop) >= 0 ? "+" : ""}${avg(opsDrop).toFixed(3)}` : ""));
}
console.log("  실제: 35세 전성기의 60~70%, 38세 40~50%, 40세 30% 안팎이 정상적인 노화 곡선.");
