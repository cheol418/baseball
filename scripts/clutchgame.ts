/**
 * 승부처가 뜬 자리에 출장 기록이 있는가.
 *
 * 5월에 "9회말 2사 만루"가 떴는데 5월 출장이 0경기면, 화면이 없던 경기를 말한 것이다.
 * 승부처는 반기가 시작될 때 달을 정하고 그 달은 나중에 시뮬레이션되므로,
 * 부상으로 통째로 비는 달에 걸릴 수 있다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { clutchGameIndex } from "../src/lib/national";
import { autoPlay } from "./autoplay";
import type { GameState, StatLine } from "../src/lib/types";

const games = (l: StatLine) => (l as { g: number }).g ?? 0;

type Row = { stage: string; label: string; g: number };
const rows: Row[] = [];

for (let i = 0; i < 120; i++) {
  const rng = new RNG(4100 + i * 13);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "표본", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seen = new Set<string>();
  autoPlay(newGame(p, "DAG", i * 19), {
    onStep: (g: GameState) => {
      const push = (stage: string, key: string, label: string, n: number) => {
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ stage, label, g: n });
      };
      for (const m of g.monthLines ?? []) {
        if (m.clutchSituation) push("월별", `M${g.year}${m.label}`, `${g.year} ${m.label}`, games(m.line));
      }
      const ag = g.allStarGame;
      if (ag?.clutchSituation) push("올스타", `AS${g.year}`, `${g.year} 올스타전`, games(ag.line));
      const ps = g.postseason;
      if (ps?.clutchSituation) {
        const last = ps.rounds[ps.rounds.length - 1];
        push("가을야구", `PS${g.year}`, `${g.year} ${last?.name ?? "가을"}`, last ? games(last.line) : 0);
      }
      const rec = g.seasons[g.lastSeasonIndex ?? -1];
      if (rec?.clutchSituation) push("아마추어", `AM${g.year}`, `${g.year} 아마추어`, games(rec.line));
      for (const r of g.intlResults) {
        if (!r.clutchSituation) continue;
        // 중계가 승부처를 끼워 넣는 그 경기를 본다
        const target = r.games[clutchGameIndex(r.games)];
        push("국제대회", `IN${r.year}`, `${r.year} ${r.tournamentName}`, target?.appeared ? 1 : 0);
      }
    },
  });
}

console.log(`■ 승부처가 걸린 자리 ${rows.length}건`);
for (const st of ["월별", "올스타", "국제대회", "가을야구", "아마추어"]) {
  const sub = rows.filter((r) => r.stage === st);
  const bad = sub.filter((r) => r.g === 0);
  console.log(`  ${st.padEnd(5)} ${String(sub.length).padStart(4)}건 · 출장 0경기인데 승부처 ${String(bad.length).padStart(3)}건 (${sub.length ? Math.round(bad.length / sub.length * 100) : 0}%)`);
}
const bad = rows.filter((r) => r.g === 0);
console.log(`■ 없던 경기를 말한 승부처 ${bad.length}건 (0이어야 한다)`);
bad.slice(0, 8).forEach((r) => console.log(`  [${r.stage}] ${r.label} — 0경기`));
