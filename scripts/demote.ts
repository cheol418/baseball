/** 강등이 실력에 맞게 일어나는가 — 좋은 성적을 낸 시즌에도 내려가는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { roleTier } from "../src/lib/roles";
import type { PitcherLine, HitterLine } from "../src/lib/types";
import { isHitterLine } from "../src/lib/sim";

const bands: Record<string, { n: number; demoted: number }> = {};
for (const [kind, pos, style] of [
  ["PITCHER", "SP", "power_p"], ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"],
] as ["HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 60; i++) {
    const rng = new RNG(103000 + i * 19);
    const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    const g = autoPlay(newGame(p, "CHW", i * 23));
    for (const s of g.seasons) {
      if (s.level !== "KBO" && !s.byLevel) continue;
      const l = s.line;
      // 그 시즌 성적으로 등급을 나눈다
      const good = isHitterLine(l)
        ? (l as HitterLine).ops >= 0.850
        : (l as PitcherLine).era <= 3.60 && (l as PitcherLine).ip >= 100;
      const mid = isHitterLine(l)
        ? (l as HitterLine).ops >= 0.750
        : (l as PitcherLine).era <= 4.40;
      const band = good ? "좋은 시즌" : mid ? "평범한 시즌" : "부진한 시즌";
      bands[band] = bands[band] ?? { n: 0, demoted: 0 };
      bands[band].n++;
      // 그 해에 "2군 이동 통보"(강등)가 있었는가 — 콜업·재활은 빼고 센다
      if (g.logs.some((x) => x.year === s.year && x.title === "2군 이동 통보")) bands[band].demoted++;
    }
  }
}
console.log("■ 시즌 성적별 '시즌 중 2군 강등을 당한 비율'");
for (const k of ["좋은 시즌", "평범한 시즌", "부진한 시즌"]) {
  const b = bands[k];
  if (!b) continue;
  console.log(`  ${k.padEnd(8)} n=${String(b.n).padStart(4)}  강등 ${String(b.demoted).padStart(3)}회 (${Math.round(b.demoted / b.n * 100)}%)`);
}
