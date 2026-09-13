/** 예전 버전 세이브가 현재 코드에서 살아나는지 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, advance, computeHof } from "../src/lib/career";
import { migrateSave } from "../src/lib/migrate";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

/** 신규 필드를 걷어내고 예전 phase 이름을 되돌려 "구버전 세이브"를 흉내낸다 */
function downgrade(g: GameState, oldPhase: string) {
  const o = JSON.parse(JSON.stringify(g)) as Record<string, unknown>;
  for (const k of [
    "monthLines", "halfLine", "seasonLine", "seasonLevel", "seasonRole",
    "seasonAvailability", "allStar", "seasonNote", "ovrAtSeasonStart",
    "teamRank", "postseason", "trust", "teammate", "military", "militaryLeft",
    "intlResults", "pendingNegotiation", "pendingTransfers", "pendingTournament",
    "transferRequested",
  ]) delete o[k];
  o.phase = oldPhase;
  return o;
}

const rng = new RNG(4242);
const p = rollCandidate({ name: "구버전", number: 7, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
const live = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), {
  stopAt: (c) => c.phase === "SPRING_CAMP" && c.seasons.filter((s) => s.level === "KBO").length >= 5,
});

for (const oldPhase of ["SEASON", "OFFSEASON", "RETIRED"]) {
  const old = downgrade(live, oldPhase);
  const m = migrateSave(old);
  if (!m) { console.log(`${oldPhase}: 마이그레이션 실패`); continue; }
  const hof = computeHof(m);
  let ok = "정상";
  try {
    // 한 시즌을 실제로 굴려본다
    if (m.phase !== "RETIRED") {
      let g2 = advance(m, { type: "TRAIN", optionId: m.pendingTraining![0].id });
      g2 = advance(g2, { type: "PLAY_FIRST_HALF" });
      g2 = advance(g2, { type: "PLAY_SECOND_HALF" });
      ok = `진행 OK → ${g2.phase}`;
    }
  } catch (e) { ok = `실패: ${(e as Error).message}`; }
  console.log(`  ${oldPhase.padEnd(10)} → ${String(m.phase).padEnd(12)} HOF ${String(hof.score).padStart(3)}점 · 메달 ${hof.medals} · 신뢰 ${m.trust} · 병역 ${m.military} · ${ok}`);
}

// 완전히 망가진 데이터도 조용히 걸러내는지
console.log("  깨진 데이터    →", migrateSave({ foo: 1 }), "/", migrateSave(null));
