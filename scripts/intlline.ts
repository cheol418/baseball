/** 국제대회·올스타전 개인 기록이 경기마다 제대로 갈리는지 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { isHitterLine } from "../src/lib/sim";
import type { HitterLine, PitcherLine } from "../src/lib/types";

for (const [label, kind, pos, style] of [
  ["타자", "HITTER", "CF", "toolsy"],
  ["선발투수", "PITCHER", "SP", "power_p"],
  ["마무리", "PITCHER", "CP", "power_p"],
] as [string, "HITTER" | "PITCHER", string, string][]) {
  const intl: string[] = [];
  const allstar: string[] = [];
  let zeroIntl = 0, zeroAs = 0;

  for (let i = 0; i < 30; i++) {
    const rng = new RNG(2000 + i * 53);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));

    for (const r of g.intlResults) {
      const l = r.line;
      if (isHitterLine(l)) {
        if (l.pa === 0) { zeroIntl++; continue; }
        intl.push(`${l.g}G ${l.pa}PA ${l.avg.toFixed(3).slice(1)} ${l.hr}HR`);
      } else {
        const q = l as PitcherLine;
        if (q.ip === 0) { zeroIntl++; continue; }
        intl.push(`${q.g}G ${q.ip.toFixed(1)}IP ERA ${q.era.toFixed(2)} ${q.so}K`);
      }
    }
    for (const s of g.seasons) {
      const ag = s.allStarGame;
      if (!ag) continue;
      const l = ag.line;
      if (isHitterLine(l)) {
        if (l.pa === 0) { zeroAs++; continue; }
        allstar.push(`${(l as HitterLine).pa}PA ${l.h}H ${l.hr}HR`);
      } else {
        const q = l as PitcherLine;
        if (q.ip === 0) { zeroAs++; continue; }
        allstar.push(`${q.ip.toFixed(1)}IP ${q.er}ER ${q.so}K`);
      }
    }
  }
  const uniq = (a: string[]) => new Set(a).size;
  console.log(`\n■ ${label}`);
  console.log(`  국제대회 ${intl.length}건 (서로 다른 기록 ${uniq(intl)}종) · 빈 기록 ${zeroIntl}건`);
  console.log(`    ${intl.slice(0, 6).join(" | ")}`);
  console.log(`  올스타전 ${allstar.length}건 (서로 다른 기록 ${uniq(allstar)}종) · 빈 기록 ${zeroAs}건`);
  console.log(`    ${allstar.slice(0, 6).join(" | ")}`);
}
