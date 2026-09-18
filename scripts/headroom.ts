/**
 * 훈련이 언제부터 의미가 없어지는가.
 *
 * "20대 중후반이면 모든 능력치가 잠재력에 닿아 훈련해도 안 오른다"는 체감을 잰다.
 *  · 성장 여지 = Σ(잠재력 − 현재). 이게 0이면 훈련이 밀어 올릴 곳이 없다.
 *  · 훈련 몫 = grow()가 실제로 보탠 값의 합 (늘 0 이상)
 *  · 노쇠 몫 = 훈련이 없었다면 움직였을 값의 합
 */
import { RNG, clamp } from "../src/lib/rng";
import { abilityKeys, ABILITY_MAX, getAb, grow, overall, rollCandidate } from "../src/lib/player";
import { makeTrainingOptions } from "../src/lib/player";
import type { Player } from "../src/lib/types";

type Row = { train: number; age: number; gain: number; loss: number; room: number; capped: number; ovr: number };
const rows: Row[] = [];

for (let i = 0; i < 400; i++) {
  const rng = new RNG(1200 + i * 7);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p: Player = rollCandidate({
    name: "표본", number: 1, kind, position: i % 2 ? "CF" : "SP",
    bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER",
  }, rng);
  const keys = abilityKeys(p.kind);
  p.age = 19;
  for (let age = 19; age <= 38; age++) {
    p.age = age;
    const opts = makeTrainingOptions(p, rng);
    const opt = opts[0];
    const room = keys.reduce((a, k) => a + Math.max(0, getAb(p.potential, k) - getAb(p.abilities, k)), 0);
    // 잠재력에 닿아 더 못 오르는 항목 수
    const capped = keys.filter((k) => getAb(p.potential, k) - getAb(p.abilities, k) <= 0).length;
    const { gains, aging } = grow(p, rng, opt, 1.0);
    const gain = Object.values(gains).reduce((a: number, v) => a + (v ?? 0), 0);
    const loss = Object.values(aging).reduce((a: number, v) => a + (v ?? 0), 0);
    rows.push({ train: i, age, gain, loss, room, capped: capped / keys.length, ovr: overall(p) });
  }
}

const ages = [...new Set(rows.map((r) => r.age))].sort((a, b) => a - b);
console.log("  나이   성장 여지  잠재력에 닿은 항목  훈련 몫  노쇠 몫  합계   OVR");
for (const age of ages) {
  const sub = rows.filter((r) => r.age === age);
  const avg = (f: (r: Row) => number) => sub.reduce((a, r) => a + f(r), 0) / sub.length;
  const g = avg((r) => r.gain), l = avg((r) => r.loss);
  console.log(
    `  ${String(age).padStart(3)}세  ${avg((r) => r.room).toFixed(1).padStart(8)}`
    + `  ${(avg((r) => r.capped) * 100).toFixed(0).padStart(14)}%`
    + `  ${g.toFixed(2).padStart(7)}  ${l.toFixed(2).padStart(7)}`
    + `  ${(g + l).toFixed(2).padStart(6)}  ${avg((r) => r.ovr).toFixed(1).padStart(5)}`,
  );
}
const dead = rows.filter((r) => r.gain === 0);
console.log(`\n■ 훈련이 한 칸도 못 올린 겨울 ${dead.length}/${rows.length}건 (${Math.round(dead.length / rows.length * 100)}%)`);
for (const band of [[19, 24], [25, 27], [28, 30], [31, 34], [35, 38]]) {
  const sub = rows.filter((r) => r.age >= band[0] && r.age <= band[1]);
  const d = sub.filter((r) => r.gain === 0);
  console.log(`  ${band[0]}~${band[1]}세  ${Math.round(d.length / sub.length * 100)}%가 소득 0`);
}
console.log(`■ 능력치 상한 ${ABILITY_MAX}`);
void clamp;
