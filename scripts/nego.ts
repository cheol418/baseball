/** 연봉 협상 — 결렬이 실제로 손해인가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, formatMoney } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const rows: { prev: number; offer: number; opt: string; ok: number; fail: number; odds: number }[] = [];
for (let i = 0; i < 300; i++) {
  const rng = new RNG(107000 + i * 17);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "s", number: 1, kind, position: (kind === "HITTER" ? "CF" : "SP") as never, bats: "R", throws: "R", styleId: kind === "HITTER" ? "toolsy" : "power_p", armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
  const g = autoPlay(newGame(p, "DAG", i * 29), {
    stopAt: (c) => c.phase === "NEGOTIATION" && !!c.pendingNegotiation && c.seasons.filter((x) => x.level === "KBO").length >= 4,
  });
  const n = g.pendingNegotiation;
  if (!n) continue;
  for (const o of n.options) {
    if (o.id === "accept") continue;
    rows.push({ prev: n.previous, offer: n.offer, opt: o.label, ok: o.onSuccess, fail: o.onFail, odds: o.odds });
  }
}
const by: Record<string, typeof rows> = {};
for (const r of rows) (by[r.opt] = by[r.opt] ?? []).push(r);
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`■ 협상 선택지 (n=${rows.length / 2}건)`);
for (const [k, a] of Object.entries(by)) {
  const below = a.filter((r) => r.fail < r.prev).length;
  console.log(
    `  ${k.padEnd(10)} 성공률 ${(avg(a.map((r) => r.odds)) * 100).toFixed(0)}%`
    + `  직전 ${formatMoney(avg(a.map((r) => r.prev)))}`
    + ` → 성공 ${formatMoney(avg(a.map((r) => r.ok)))}`
    + ` / 실패 ${formatMoney(avg(a.map((r) => r.fail)))}`
    + `  실패가 직전보다 낮음 ${below}/${a.length} (${Math.round(below / a.length * 100)}%)`,
  );
  const ev = avg(a.map((r) => r.odds * r.ok + (1 - r.odds) * r.fail));
  console.log(`${" ".repeat(13)}기대값 ${formatMoney(ev)}  (수용 ${formatMoney(avg(a.map((r) => r.offer)))} 대비 ${ev > avg(a.map((r) => r.offer)) ? "유리" : "불리"})`);
}

console.log(`\n■ 기대값 정밀 (만원)`);
for (const [k, a] of Object.entries(by)) {
  const ev = avg(a.map((r) => r.odds * r.ok + (1 - r.odds) * r.fail));
  const acc = avg(a.map((r) => r.offer));
  console.log(`  ${k.padEnd(10)} 기대 ${Math.round(ev)} vs 수용 ${Math.round(acc)}  (${((ev / acc - 1) * 100).toFixed(1)}%)`);
  const notBelow = a.filter((r) => r.fail >= r.prev);
  if (notBelow.length) {
    console.log(`${" ".repeat(13)}실패가 직전 이상인 ${notBelow.length}건 — 직전 연봉 평균 ${Math.round(avg(notBelow.map((r) => r.prev)))}만원 (최저연봉 바닥)`);
  }
}
