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

/* 성공률 구간별로 실패했을 때 얼마나 깎이는가 — 근거가 셀수록 덜 깎여야 한다 */
{
  const rows: { odds: number; cut: number }[] = [];
  for (let i = 0; i < 500; i++) {
    const rng2 = new RNG(8800 + i * 13);
    const kind2 = i % 2 ? "HITTER" : "PITCHER";
    const p2 = rollCandidate({ name: "s", number: 1, kind: kind2, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng2);
    autoPlay(newGame(p2, "DAG", i * 17), {
      stopAt: (g) => {
        const n = g.pendingNegotiation;
        const o = n?.options.find((x) => x.id === "push");
        if (n && o && n.previous > 0) rows.push({ odds: o.odds, cut: (o.onFail - n.offer) / n.offer });
        return false;
      },
    });
  }
  console.log("\n■ 재협상 요구 — 성공률 구간별 '결렬 시 '구단 제시액' 대비 손해'");
  for (const [lo, hi] of [[0, 0.4], [0.4, 0.6], [0.6, 0.75], [0.75, 1]] as [number, number][]) {
    const a = rows.filter((r) => r.odds >= lo && r.odds < hi);
    if (!a.length) continue;
    const avg = a.reduce((x, r) => x + r.cut, 0) / a.length;
    console.log(`  성공률 ${(lo * 100).toFixed(0)}~${(hi * 100).toFixed(0)}%  n=${String(a.length).padStart(5)}  결렬 시 ${(avg * 100).toFixed(1)}%`);
  }
}
