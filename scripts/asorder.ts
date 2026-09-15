/** 전반기 중계가 그려지는 시점(HALF_REVIEW)에 올스타 판정이 끝나 있는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

let hidden = 0;
let review = 0, scoreEarly = 0;
const prev = new Map<string, boolean>();
for (let i = 0; i < 60; i++) {
  const rng = new RNG(900 + i);
  const p = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "gap" }, rng);
  let pendingBust = false;
  autoPlay(newGame(p, "DAG", i * 7), {
    onStep: (g: GameState) => {
      if (g.phase === "HALF_REVIEW" && g.liveHalf === "H1") {
        review++;
        // 중계에 "불발" 문구가 실제로 들어가는가 (문구는 broadcast.tsx가 만든다)
        pendingBust = !g.allStar;
      }
      if (g.phase === "ALL_STAR") {
        pendingBust = false;
        // 승부처가 남아 있는데 최종 스코어가 이미 확정돼 화면에 뜬다
        // ALL_STAR 화면이 스코어를 감추는 조건 (page.tsx의 asPending과 같은 식)
        // 불변식: 승부처가 열려 있는 동안에는 화면이 스코어를 감춘다
        const asPending = !!g.allStarGame?.clutchSituation && !g.allStarGame.clutch;
        if (asPending) { hidden++; if (!asPending) scoreEarly++; }
        // 소식란에도 결과가 미리 적히면 안 된다
        if (asPending && g.logs.some((l) => l.year === g.year && l.title.startsWith("올스타전"))) scoreEarly++;
      }
    },
  });
}
void prev;
console.log(`전반기 중계 ${review}회 (이제 올스타 문구 없음)`);
console.log(`승부처가 열린 채 올스타 화면에 머문 상태 ${hidden}회`);
console.log(`  → 그 사이 스코어·소식이 먼저 새어 나간 경우 ${scoreEarly}회 (0이어야 한다)`);
console.log(`\n주의: 선정 판정은 여전히 FINISH_HALF에서 난다 — 중계(HALF_REVIEW)는 그 사실을 말하지 않고,\n      선정 발표와 올스타전은 ALL_STAR 화면이 맡는다.`);
