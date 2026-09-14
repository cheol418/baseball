/** 같은 선수의 나이별 OVR — 생존 편향 없이 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const CFG = [
  ["타자", "HITTER", "1B", "slugger"], ["타자", "HITTER", "CF", "toolsy"],
  ["투수", "PITCHER", "SP", "power_p"], ["투수", "PITCHER", "SP", "control_p"],
] as const;

const careers: { peak: number; peakAge: number; byAge: Map<number, number> }[] = [];
for (const [, k, pos, style] of CFG) {
  for (let i = 0; i < 90; i++) {
    const rng = new RNG(41000 + i * 29);
    const p = rollCandidate({ name: "s", number: 1, kind: k, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: k === "PITCHER" ? "OVER" : undefined }, rng);
    const byAge = new Map<number, number>();
    autoPlay(newGame(p, "DAG", i * 67), {
      onStep: (c) => {
        if (!c.contract) return;
        const a = c.player.age;
        if (!byAge.has(a)) byAge.set(a, overall(c.player));
      },
    });
    if (byAge.size < 8) continue;
    let peak = 0, peakAge = 0;
    for (const [a, v] of byAge) if (v > peak) { peak = v; peakAge = a; }
    careers.push({ peak, peakAge, byAge });
  }
}
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log(`■ 같은 선수의 OVR — 전성기 대비 (n=${careers.length}커리어)`);
console.log(`  전성기 나이 평균 ${avg(careers.map((c) => c.peakAge)).toFixed(1)}세 · 전성기 OVR 평균 ${avg(careers.map((c) => c.peak)).toFixed(1)}`);
for (const age of [28, 30, 32, 34, 35, 36, 37, 38, 39, 40]) {
  const vs = careers.filter((c) => c.byAge.has(age));
  if (vs.length < 5) continue;
  const drop = vs.map((c) => c.byAge.get(age)! - c.peak);
  console.log(`  ${age}세  n=${String(vs.length).padStart(3)} · OVR ${avg(vs.map((c) => c.byAge.get(age)!)).toFixed(1)}`
    + ` · 전성기 대비 ${avg(drop) >= 0 ? "+" : ""}${avg(drop).toFixed(1)}`);
}
console.log("  실제: 35세 -4~6 · 38세 -8~12 · 40세 -12~16 정도가 자연스러운 낙폭.");

/* 나이별 출전 경기 — 실제 노장은 풀타임을 못 뛴다 */
import type { HitterLine } from "../src/lib/types";
const gamesByAge = new Map<number, number[]>();
const roleByAge = new Map<number, string[]>();
for (const [, k, pos, style] of CFG) {
  for (let i = 0; i < 90; i++) {
    const rng = new RNG(41000 + i * 29);
    const p = rollCandidate({ name: "s", number: 1, kind: k, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: k === "PITCHER" ? "OVER" : undefined }, rng);
    const g = autoPlay(newGame(p, "DAG", i * 67), {});
    for (const s of g.seasons) {
      if (s.level !== "KBO" || k !== "HITTER") continue;
      (gamesByAge.get(s.age) ?? gamesByAge.set(s.age, []).get(s.age)!).push((s.line as HitterLine).g);
      (roleByAge.get(s.age) ?? roleByAge.set(s.age, []).get(s.age)!).push(s.role);
    }
  }
}
console.log("\n■ 나이별 출전 경기 (타자 · 1군)");
for (const age of [27, 30, 33, 35, 36, 37, 38, 39]) {
  const a = gamesByAge.get(age) ?? [];
  if (a.length < 8) continue;
  const roles = roleByAge.get(age) ?? [];
  const starter = roles.filter((r) => r === "간판타자" || r === "핵심타자" || r === "주전").length;
  console.log(`  ${age}세  n=${String(a.length).padStart(3)} · 평균 ${avg(a).toFixed(0)}경기 · 주전급 ${Math.round(starter / roles.length * 100)}%`);
}
console.log("  실제 KBO 144경기: 전성기 130~140 · 36세 110~125 · 38세 90~110이 흔하다.");
