/**
 * 한 커리어에서 플레이어가 실제로 "고르는" 횟수 — 그냥 [다음]인 단계와 나눈다.
 * 시뮬레이션 게임의 재미는 결정의 밀도에서 나온다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

/** 그 phase에서 선택지가 둘 이상인가 */
const CHOICE: Record<string, string> = {
  PATH_CHOICE: "진로(드래프트/대학)",
  SPRING_CAMP: "훈련 방향 + 지옥 훈련",
  HALF_REVIEW: "승부처",
  ALL_STAR: "올스타 승부처",
  INTERNATIONAL: "대표팀 수락/고사",
  MILITARY_CHOICE: "병역 선택",
  NEGOTIATION: "연봉 협상 전략",
  FA: "FA 구단 선택",
  STOVE: "이적 신청",
  EVENT: "이벤트 선택지",
  CROSSROAD: "커리어 갈림길",
  TRANSFER: "이적 제안",
  RETIRE_CHOICE: "은퇴 권고 수락/거부",
  SECOND_LIFE: "은퇴 후 진로",
  DRAFT: "(통보)",
  FIRST_HALF: "(진행)", POSTSEASON: "(진행)", MILITARY_SEASON: "(진행)", HS_SEASON: "(진행)",
  SEASON: "(진행)",
  SEASON_END: "(진행)",
  HS: "(진행)",
};

const counts: Record<string, number[]> = {};
let totalSteps = 0, totalChoices = 0, n = 0;
for (let i = 0; i < 40; i++) {
  const rng = new RNG(8800 + i * 13);
  const p = rollCandidate({ name: "s", number: 1, kind: i % 2 ? "HITTER" : "PITCHER", position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seen: Record<string, number> = {};
  let steps = 0;
  autoPlay(newGame(p, "DAG", i * 17), {
    onStep: (g: GameState) => {
      steps++;
      seen[g.phase] = (seen[g.phase] ?? 0) + 1;
    },
  });
  n++; totalSteps += steps;
  for (const [k, v] of Object.entries(seen)) {
    (counts[k] ??= []).push(v);
    if (CHOICE[k] && !CHOICE[k].startsWith("(")) totalChoices += v;
  }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / n;
console.log(`■ 커리어당 화면 전환 ${(totalSteps / n).toFixed(0)}회 · 그중 실제 선택 ${(totalChoices / n).toFixed(0)}회 (${(totalChoices / totalSteps * 100).toFixed(0)}%)\n`);
console.log("  단계                 커리어당   무엇을 고르는가");
for (const [k, v] of Object.entries(counts).sort((a, b) => avg(b[1]) - avg(a[1]))) {
  console.log(`  ${k.padEnd(20)} ${avg(v).toFixed(1).padStart(6)}   ${CHOICE[k] ?? "—"}`);
}
