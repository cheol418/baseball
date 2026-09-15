/** 통산 기록이 시즌 합계와 맞는지 — 비율 스탯 재계산 검증 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, careerTotals, seasonsAtLevel } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { isHitterLine } from "../src/lib/sim";
import type { HitterLine, PitcherLine } from "../src/lib/types";

let bad = 0, checked = 0;
const show: string[] = [];

for (const [kind, pos, style] of [
  ["HITTER", "CF", "toolsy"], ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"],
] as ["HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 30; i++) {
    const rng = new RNG(19000 + i * 41);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));
    // 1군·2군을 오간 시즌은 byLevel로 나뉜다 — careerTotals와 같은 방식으로 뽑아야
    // 비교가 성립한다 (전체 line을 쓰면 2군 몫까지 더해져 늘 어긋난다)
    const kbo = seasonsAtLevel(g.seasons, "KBO");
    if (!kbo.length) continue;
    const t = careerTotals(g.seasons, kind, "KBO") as Record<string, number>;
    checked++;

    if (kind === "HITTER") {
      const h = kbo.reduce((a, s) => a + (s.line as HitterLine).h, 0);
      const ab = kbo.reduce((a, s) => a + (s.line as HitterLine).ab, 0);
      const expAvg = Math.round((h / ab) * 1000) / 1000;
      if (Math.abs(t.avg - expAvg) > 0.002 || t.h !== h) {
        bad++; show.push(`타자 통산 AVG ${t.avg} vs 계산 ${expAvg} (H ${t.h}/${h})`);
      }
    } else {
      const er = kbo.reduce((a, s) => a + (s.line as PitcherLine).er, 0);
      const ip = Math.round(kbo.reduce((a, s) => a + (s.line as PitcherLine).ip, 0) * 10) / 10;
      const expEra = Math.round(((er * 9) / ip) * 100) / 100;
      if (Math.abs(t.era - expEra) > 0.02) {
        bad++; show.push(`투수 통산 ERA ${t.era} vs 계산 ${expEra} (ER ${er} / IP ${ip})`);
      }
      // 시즌별 ERA와 자책점이 서로 맞는지
      for (const s of kbo) {
        const l = s.line as PitcherLine;
        if (l.ip < 1) continue;
        const own = Math.round(((l.er * 9) / l.ip) * 100) / 100;
        if (Math.abs(l.era - own) > 0.02) {
          bad++; show.push(`${s.year} 시즌 ERA ${l.era} vs 자책점에서 계산 ${own} (ER ${l.er} / IP ${l.ip})`);
        }
      }
    }
    // 가을야구 시리즈 합계
    for (const s of kbo) {
      const ps = s.ps;
      if (!ps) continue;
      const l = ps.line;
      if (isHitterLine(l)) {
        const h = ps.rounds.reduce((a, r) => a + (r.line as HitterLine).h, 0);
        if (l.h !== h) { bad++; show.push(`${s.year} 가을야구 안타 합계 ${l.h} vs 시리즈합 ${h}`); }
      } else {
        const er = ps.rounds.reduce((a, r) => a + (r.line as PitcherLine).er, 0);
        const ip = Math.round(ps.rounds.reduce((a, r) => a + (r.line as PitcherLine).ip, 0) * 10) / 10;
        const exp = ip ? Math.round(((er * 9) / ip) * 100) / 100 : 0;
        if (Math.abs((l as PitcherLine).era - exp) > 0.02) {
          bad++; show.push(`${s.year} 가을야구 ERA ${(l as PitcherLine).era} vs 시리즈합 ${exp}`);
        }
      }
    }
  }
}
console.log(`■ 통산·구간 기록 정합성 — 커리어 ${checked}개 검사, 불일치 ${bad}건`);
for (const m of show.slice(0, 12)) console.log(`  · ${m}`);
if (!bad) console.log("  모두 일치");
