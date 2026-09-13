/** 타이틀 수상 빈도 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { Kind } from "../src/lib/types";

const CFG: [string, Kind, string, string][] = [
  ["교타자 2루수", "HITTER", "contact", "2B"],
  ["거포 1루수", "HITTER", "slugger", "1B"],
  ["파워피처 선발", "PITCHER", "power_p", "SP"],
  ["파워피처 마무리", "PITCHER", "power_p", "CP"],
];

for (const [label, kind, styleId, pos] of CFG) {
  const counts: Record<string, number> = {};
  let seasons = 0, careers = 0, allstar = 0, intl = 0;
  for (let i = 0; i < 30; i++) {
    const rng = new RNG(4400 + i * 317);
    const p = rollCandidate(
      { name: "x", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId,
        armSlot: kind === "PITCHER" ? "THREE_QUARTER" : undefined }, rng,
    );
    const g = autoPlay(newGame(p, "DAJ", rng.int(1, 2 ** 30)), { transferChance: 0 });
    careers++;
    const kbo = g.seasons.filter((s) => s.level === "KBO");
    seasons += kbo.length;
    allstar += kbo.filter((s) => s.allStar).length;
    intl += g.intlResults.length;
    for (const s of kbo) for (const a of s.awards) counts[a] = (counts[a] ?? 0) + 1;
  }
  const per = (n: number) => (n / careers).toFixed(1);
  console.log(`\n■ ${label} (커리어 ${careers}개 · 1군 ${seasons}시즌)`);
  console.log(`  커리어당 — 올스타 ${per(allstar)}회 · 국가대표 ${per(intl)}회`);
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log('  ' + (rows.length
    ? rows.map(([k, v]) => `${k} ${per(v)}`).join(' · ')
    : '수상 없음'));
}
