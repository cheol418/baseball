/**
 * 승부처 문구와 경기 결과가 같은 말을 하는가.
 *
 * "끝내기 만루홈런"이 뜬 자리 바로 옆에 "패" 카드가 붙으면 화면이 자기 말을 뒤집는다.
 * 무대 승부처(올스타·국대·가을야구)는 결과 카드가 붙어 있으므로 반드시 맞아야 하고,
 * "끝내기"는 경기를 끝낼 수 있는 자리에서만 쓸 수 있다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

/** 우리 팀이 그 경기를 이겼다고 못 박는 말 */
const WON_WORDS = ["끝내기", "이겼습니다", "경기가 뒤집혔습니다", "결승점", "결승 적시타"];
/** 경기를 끝냈다고 못 박는 말 */
const OVER_WORDS = ["끝내기"];

type Row = { stage: string; won?: boolean; walkoff: boolean; text: string; title: string };
const rows: Row[] = [];

for (let i = 0; i < 120; i++) {
  const rng = new RNG(7700 + i * 11);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "표본", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seen = new Set<string>();
  autoPlay(newGame(p, "DAG", i * 17), {
    onStep: (g: GameState) => {
      const push = (stage: string, won: boolean | undefined, key: string,
        c?: { walkoff?: boolean }, r?: { outcome: { title: string; body: string } }) => {
        if (!r || !c || seen.has(key)) return;
        seen.add(key);
        rows.push({
          stage, won, walkoff: c.walkoff ?? false,
          title: r.outcome.title, text: `${r.outcome.title} ${r.outcome.body}`,
        });
      };
      const ag = g.allStarGame;
      if (ag?.clutch) push("올스타", ag.won, `AS${g.year}`, ag.clutchSituation, ag.clutch);
      const ps = g.postseason;
      if (ps?.clutch) push("가을야구", ps.rounds[ps.rounds.length - 1]?.win, `PS${g.year}`, ps.clutchSituation, ps.clutch);
      for (const r of g.intlResults) {
        if (r.clutch) push("국제대회", r.games[r.games.length - 1]?.won, `IN${r.year}`, r.clutchSituation, r.clutch);
      }
      for (const m of g.monthLines ?? []) {
        if (m.clutch) push("월별", undefined, `M${g.year}${m.label}`, m.clutchSituation, m.clutch);
      }
    },
  });
}

const saysWon = (r: Row) => WON_WORDS.some((w) => r.text.includes(w));
const saysOver = (r: Row) => OVER_WORDS.some((w) => r.text.includes(w));

const liedAboutResult = rows.filter((r) => r.won === false && saysWon(r));
const liedAboutScene = rows.filter((r) => !r.walkoff && saysOver(r));

console.log(`■ 승부처 ${rows.length}건`);
for (const st of ["올스타", "국제대회", "가을야구", "월별"]) {
  const sub = rows.filter((r) => r.stage === st);
  const lost = sub.filter((r) => r.won === false);
  const bad = sub.filter((r) => r.won === false && saysWon(r));
  console.log(`  ${st.padEnd(5)} ${String(sub.length).padStart(4)}건 (진 경기 ${String(lost.length).padStart(3)}) · 모순 ${bad.length}`);
}
console.log(`■ 진 경기인데 이겼다고 말함 ${liedAboutResult.length}건 (0이어야 한다)`);
liedAboutResult.slice(0, 5).forEach((r) => console.log(`  [${r.stage}·패] ${r.text.slice(0, 50)}…`));
console.log(`■ 끝낼 수 없는 자리에서 "끝내기" ${liedAboutScene.length}건 (0이어야 한다)`);
liedAboutScene.slice(0, 5).forEach((r) => console.log(`  [${r.stage}] ${r.text.slice(0, 50)}…`));
const wo = rows.filter((r) => r.walkoff);
console.log(`■ 끝내기가 가능한 자리 ${wo.length}건 · 그중 실제 "끝내기" ${wo.filter(saysOver).length}건`);
