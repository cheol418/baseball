/**
 * FA 시장이 자리를 가리는가.
 *
 * 마무리·불펜은 정규시즌 WAR과 연봉이 선발보다 낮다. 그 차이가 FA에서
 * **몇 배로 벌어지는지**를 본다 — 실제 KBO에서는 정상급 마무리가
 * 선발 못지않은 FA 계약을 따낸다(오승환·정우람·김재윤).
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { faGradeOf } from "../src/lib/career";
import type { GameState, Offer, Position } from "../src/lib/types";

type Row = { pos: string; total: number; years: number; perYear: number; offers: number; grade: string; prevPay: number };
const rows: Row[] = [];

const SET: { pos: Position; kind: "HITTER" | "PITCHER"; style: string }[] = [
  { pos: "SP", kind: "PITCHER", style: "control_p" },
  { pos: "CP", kind: "PITCHER", style: "power_p" },
  { pos: "RP", kind: "PITCHER", style: "power_p" },
  { pos: "CF", kind: "HITTER", style: "gap" },
  { pos: "1B", kind: "HITTER", style: "slugger" },
];

for (const { pos, kind, style } of SET) {
  for (let i = 0; i < 50; i++) {
    const rng = new RNG(2700 + i * 23);
    const p = rollCandidate({ name: "표본", number: 1, kind, position: pos, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    const seen = new Set<string>();
    autoPlay(newGame(p, "DAG", i * 79), {
      onStep: (g: GameState) => {
        const offers = g.pendingOffers;
        if (g.phase !== "FA" || !offers?.length) return;
        const key = `${g.year}`;
        if (seen.has(key)) return;
        seen.add(key);
        const best = offers.reduce((a: Offer, o: Offer) => (o.total > a.total ? o : a));
        rows.push({
          pos, total: best.total, years: best.years, perYear: best.total / best.years,
          offers: offers.length, grade: faGradeOf(g.contract?.salary ?? 0).grade,
          prevPay: g.contract?.salary ?? 0,
        });
      },
    });
  }
}

console.log("■ 자리별 FA (각 50명 · 최고 제시 기준)");
console.log("  자리   FA 도달   붙은 구단   최고 총액    연수   연평균    직전연봉   등급(최빈)");
for (const { pos } of SET) {
  const sub = rows.filter((r) => r.pos === pos);
  if (!sub.length) { console.log(`  ${pos} — FA 도달 없음`); continue; }
  const avg = (f: (r: Row) => number) => sub.reduce((a, r) => a + f(r), 0) / sub.length;
  const g = new Map<string, number>();
  for (const r of sub) g.set(r.grade, (g.get(r.grade) ?? 0) + 1);
  const top = [...g].sort((a, b) => b[1] - a[1])[0];
  console.log(
    `  ${pos.padEnd(5)} ${String(sub.length).padStart(6)}건`
    + `  ${avg((r) => r.offers).toFixed(1).padStart(8)}`
    + `  ${(avg((r) => r.total) / 10000).toFixed(1).padStart(8)}억`
    + `  ${avg((r) => r.years).toFixed(1).padStart(5)}`
    + `  ${(avg((r) => r.perYear) / 10000).toFixed(1).padStart(6)}억`
    + `  ${(avg((r) => r.prevPay) / 10000).toFixed(1).padStart(8)}억`
    + `  ${top[0]}`,
  );
}
