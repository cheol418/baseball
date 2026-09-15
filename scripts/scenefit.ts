/** 장면과 선택지가 같은 자리를 말하는가 — 투수에게 "한 타석"이 뜨면 안 된다 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

/**
 * **내가 하는 일**을 가리키는 말만 본다.
 * "타자들이 타석에 들어섭니다"는 투수 시점으로 옳으므로, 단순히 '타석'이
 * 들어갔다고 잡으면 오탐이 난다. 1인칭으로 읽히는 표현만 걸러낸다.
 */
const HIT_WORDS = ["한 타석", "이 한 번", "첫 스윙", "휘두", "배트", "타석은 돌아", "내 타석"];
const PIT_WORDS = ["한 구", "내 손으로", "첫 공", "던지는", "등판합니다", "스피드건", "투구수"];

let bad = 0, n = 0;
const ex: string[] = [];
for (let i = 0; i < 80; i++) {
  const rng = new RNG(5900 + i * 7);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "s", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seen = new Set<string>();
  autoPlay(newGame(p, "DAG", i * 13), {
    onStep: (g: GameState) => {
      const pool: { eyebrow: string; title: string; body: string }[] = [];
      for (const m of g.monthLines ?? []) if (m.clutchSituation) pool.push(m.clutchSituation);
      if (g.allStarGame?.clutchSituation) pool.push(g.allStarGame.clutchSituation);
      if (g.postseason?.clutchSituation) pool.push(g.postseason.clutchSituation);
      for (const r of g.intlResults) if (r.clutchSituation) pool.push(r.clutchSituation);
      const rec = g.seasons[g.lastSeasonIndex ?? -1];
      if (rec?.clutchSituation) pool.push(rec.clutchSituation);
      for (const c of pool) {
        const key = `${c.eyebrow}|${c.title}`;
        if (seen.has(key)) continue;
        seen.add(key); n++;
        const text = `${c.eyebrow} ${c.title} ${c.body}`;
        const wrong = kind === "PITCHER" ? HIT_WORDS : PIT_WORDS;
        if (wrong.some((w) => text.includes(w))) {
          bad++;
          if (ex.length < 6) ex.push(`  [${kind === "PITCHER" ? "투수" : "타자"}] ${c.title} — "${c.body.slice(0, 40)}…"`);
        }
      }
    },
  });
}
console.log(`■ 장면 ${n}개 검사 — 자리와 말투가 어긋난 장면 ${bad}건 (0이어야 한다)`);
ex.forEach((e) => console.log(e));
