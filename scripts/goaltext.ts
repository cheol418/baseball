/**
 * 시즌 목표의 **표기와 판정 기준이 같은 숫자를 말하는가.**
 *
 * 목표 라벨("165이닝")과 실제로 재는 선(ip >= 165)이 따로 놀면,
 * 168이닝을 던지고도 실패로 찍힌다. id는 예전 값으로 남아 있는 게 많아
 * (`ip170` 라벨이 "165이닝") 눈으로는 안 보인다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

/** 문장에서 숫자만 뽑는다 — ".300" "3.00" "165" "8.5" */
const nums = (t: string) => (t.match(/\d*\.?\d+/g) ?? []).map(Number);

type Row = { label: string; reason: string };
const rows: Row[] = [];
const seen = new Set<string>();

for (let i = 0; i < 120; i++) {
  const rng = new RNG(5200 + i * 17);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const pos = i % 2 ? "CF" : (i % 4 === 0 ? "SP" : "CP");
  const p = rollCandidate({ name: "표본", number: 1, kind, position: pos, bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 41));
  for (const rec of g.seasons) {
    const goal = rec.goal;
    if (!goal || goal.met || !goal.reason) continue;
    const key = `${goal.label}|${goal.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ label: goal.label, reason: goal.reason });
  }
}

/** 출장·이닝 조건에 먼저 걸린 경우는 라벨과 다른 숫자를 말하는 게 맞다 */
const gate = (r: Row) => r.reason.includes("채우지 못했습니다");
const judged = rows.filter((r) => !gate(r));
const bad = judged.filter((r) => {
  const want = nums(r.label);
  const got = nums(r.reason);
  if (!want.length || !got.length) return false;
  // 판정 문장은 "X에 미치지 못했습니다 (실제)" — 앞의 X가 라벨의 숫자와 같아야 한다
  return !want.every((w) => got.includes(w));
});

console.log(`■ 미달 사유 ${rows.length}종 (출장·이닝 조건 ${rows.length - judged.length}종 제외, 판정 ${judged.length}종)`);
console.log(`■ 표기와 판정 기준이 다른 목표 ${bad.length}종 (0이어야 한다)`);
bad.forEach((r) => console.log(`  "${r.label}" ← ${r.reason}`));
