/** 나이별 OVR 증가 — 전성기에 성장이 멈추지 않는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const gain: Record<number, number[]> = {};
const peakOvr: number[] = [];
const peakAge: number[] = [];

for (const [kind, pos, style] of [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"],
] as ["HITTER" | "PITCHER", string, string][]) {
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(17000 + i * 29);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    // 한 나이 안에서도 여러 번 호출되므로 나이별 "최고 OVR"을 모아 비교한다
    const byAge = new Map<number, number>();
    let peak = 0, pAge = 0;
    autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), {
      onStep: (c) => {
        const o = overall(c.player);
        if (o > peak) { peak = o; pAge = c.player.age; }
        byAge.set(c.player.age, Math.max(byAge.get(c.player.age) ?? 0, o));
      },
    });
    for (const [age, o] of byAge) {
      const nxt = byAge.get(age + 1);
      if (nxt !== undefined) (gain[age] = gain[age] ?? []).push(nxt - o);
    }
    peakOvr.push(peak);
    peakAge.push(pAge);
  }
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log("■ 나이별 OVR 연간 증감 (직전 나이 → 그 다음 해)");
for (let age = 19; age <= 34; age++) {
  const a = gain[age];
  if (!a || a.length < 20) continue;
  const m = avg(a);
  const stalled = a.filter((v) => v <= 0).length;
  const bar = m > 0 ? "▇".repeat(Math.min(30, Math.round(m * 4))) : "·";
  console.log(
    `  ${age}→${age + 1}세  n=${String(a.length).padStart(3)}  평균 ${m >= 0 ? "+" : ""}${m.toFixed(2)}`
    + `  정체·하락 ${String(Math.round((stalled / a.length) * 100)).padStart(3)}%  ${bar}`,
  );
}
console.log(`\n■ 커리어 최고 OVR 평균 ${avg(peakOvr).toFixed(1)} (기준선 79~82) · 도달 나이 평균 ${avg(peakAge).toFixed(1)}세`);
