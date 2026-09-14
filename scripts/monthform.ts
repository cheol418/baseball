/** 월별 컨디션 단계 분포 · 이달의 선수 발생률 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { FORM_STYLE, judgeMonthForm, type MonthForm } from "../src/lib/form";
import { autoPlay } from "./autoplay";

const count: Record<string, number> = {};
let months = 0, kboMonths = 0, potmSeasons = 0, careers = 0, potmTotal = 0, best = 0;
const CFG = [["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"], ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"]] as const;

for (const [kind, pos, style] of CFG) {
  for (let i = 0; i < 110; i++) {
    const rng = new RNG(81000 + i * 37);
    const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    // 월별 기록은 시즌이 끝나면 지워지므로 진행 중에 훑는다
    const seen = new Set<string>();
    const g = autoPlay(newGame(p, "DAG", i * 53), {
      onStep: (c) => {
        for (const m of c.monthLines ?? []) {
          const key = `${c.year}:${m.key}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const f = judgeMonthForm(m.line, m.level);
          count[f] = (count[f] ?? 0) + 1; months++;
          if (m.level === "KBO") kboMonths++;
        }
      },
    });
    careers++;
    const n = g.seasons.reduce((a, s) => a + (s.potm?.length ?? 0), 0);
    potmTotal += n; best = Math.max(best, n);
    potmSeasons += g.seasons.filter((s) => s.potm?.length).length;
  }
}
console.log(`■ 월별 컨디션 단계 (n=${months.toLocaleString()}개월 · 1군 ${kboMonths.toLocaleString()}개월)`);
for (const f of Object.keys(FORM_STYLE) as MonthForm[]) {
  const n = count[f] ?? 0;
  console.log(`  ${FORM_STYLE[f].badge.padEnd(14)} ${String(n).padStart(5)}  ${(n / months * 100).toFixed(1)}%`);
}
console.log(`\n■ 이달의 선수 (커리어 ${careers}개)`);
console.log(`  커리어당 ${(potmTotal / careers).toFixed(2)}회 · 한 커리어 최다 ${best}회`);
console.log(`  받은 시즌이 있는 경우 ${potmSeasons}시즌  (실제 KBO는 월 1명 — 레전드가 통산 10회 안팎)`);
