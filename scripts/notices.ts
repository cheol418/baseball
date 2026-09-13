/** 통보가 실제로 발생하는지 — 콜업·이적·발탁 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const seen: Record<string, number> = {};
let moves = 0, careers = 0;

for (const [kind, pos, style] of [
  ["HITTER", "CF", "toolsy"], ["PITCHER", "SP", "power_p"],
] as ["HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(31000 + i * 23);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), { transferChance: 0.5 });
    careers++;
    // 통보는 확인하면 소비되지만 autoplay는 확인하지 않으므로 그대로 쌓인다
    for (const n of g.notices ?? []) seen[n.title] = (seen[n.title] ?? 0) + 1;
    // 엔트리 이동은 시즌 기록의 monthLines에 남지 않으므로 로그로 센다
    moves += g.logs.filter((l) => l.title === "1군 콜업" || l.title === "2군 이동 통보").length;
  }
}

console.log(`■ 통보 발생 (커리어 ${careers}개)`);
for (const [k, v] of Object.entries(seen).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${String(v).padStart(4)}회  (커리어당 ${(v / careers).toFixed(1)})`);
}
console.log(`\n■ 엔트리 이동 (중계 안에서 카드로 표시)`);
console.log(`  1군 콜업 · 2군 말소 ${moves}회 (커리어당 ${(moves / careers).toFixed(1)})`);
