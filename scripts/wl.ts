/** 투수 승패 — 구간을 나눠 반올림하다 승리가 사라지지 않는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { PitcherLine } from "../src/lib/types";

for (const [lab, pos, style] of [["마무리", "CP", "power_p"], ["불펜", "RP", "power_p"], ["선발", "SP", "power_p"]] as const) {
  let w = 0, l = 0, sv = 0, hld = 0, g = 0, n = 0;
  const seasons: PitcherLine[] = [];
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(6100 + i * 19);
    const p = rollCandidate({ name: "s", number: 1, kind: "PITCHER", position: pos, bats: "R", throws: "R", styleId: style, armSlot: "OVER" }, rng);
    const gm = autoPlay(newGame(p, "DAG", i * 31), {});
    for (const s of gm.seasons) {
      if (s.level !== "KBO") continue;
      const li = s.line as PitcherLine;
      w += li.w; l += li.l; sv += li.sv; hld += li.hld; g += li.g; n++;
      seasons.push(li);
    }
  }
  const zeroW = seasons.filter((x) => x.w === 0 && x.g >= 40).length;
  const many40 = seasons.filter((x) => x.g >= 40).length;
  console.log(`${lab.padEnd(4)} 시즌 ${n} · 통산 ${w}승 ${l}패 ${sv}세 ${hld}홀드 (${g}G)`);
  console.log(`      경기당 승 ${(w / g).toFixed(3)} · 패 ${(l / g).toFixed(3)} · 승패비 ${(w / Math.max(1, l)).toFixed(2)}`
    + `  | 40경기 이상인데 0승인 시즌 ${zeroW}/${many40}`);
}
console.log("\n실제 KBO 마무리 통산 예: 오승환 28승 41패 (승패비 0.68) · 정우람 40승 46패 (0.87)");
console.log("실제 KBO 불펜 통산 예: 한현희·이명우 등 승패비 0.8~1.2");
