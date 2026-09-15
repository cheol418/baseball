/** 동기 — 리그가 살아 있는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, careerTotals } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { myRankAmong } from "../src/lib/rivals";
import type { GameState } from "../src/lib/types";

let nRiv = 0, nCareer = 0;
const titles: number[] = [], wars: number[] = [], seasons: number[] = [], ranks: number[] = [];
const retiredBy: number[] = [];
let mvps = 0, bust = 0;
const samples: string[] = [];
for (let i = 0; i < 60; i++) {
  const rng = new RNG(7000 + i * 11);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "나", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 23), {});
  const rv = g.rivals ?? [];
  if (!rv.length) continue;
  nCareer++;
  const t = careerTotals(g.seasons, kind, "KBO") as Record<string, number>;
  ranks.push(myRankAmong(rv, t.war));
  for (const r of rv) {
    nRiv++; titles.push(r.titles); wars.push(r.war); seasons.push(r.seasons);
    mvps += r.mvp;
    if (r.seasons === 0) bust++;
    if (r.retiredYear) retiredBy.push(r.retiredYear);
  }
  if (samples.length < 2) {
    samples.push(`  [커리어 ${i}] 나 WAR ${t.war.toFixed(1)} → 동기 중 ${myRankAmong(rv, t.war)}위\n`
      + rv.map((r) => `    ${String(r.pick).padStart(2)}순위 ${r.name} (${r.position})  ${String(r.seasons).padStart(2)}시즌 WAR ${r.war.toFixed(1).padStart(5)} 타이틀 ${r.titles} MVP ${r.mvp}${r.retiredYear ? ` · ${r.retiredYear} 은퇴` : ""}`).join("\n"));
  }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)];
console.log(`■ 동기 ${nRiv}명 (커리어 ${nCareer}개 × 6)`);
console.log(`  1군 시즌  중앙 ${q(seasons, .5)} · 상위10% ${q(seasons, .9)} · 최대 ${Math.max(...seasons)}`);
console.log(`  통산 WAR  중앙 ${q(wars, .5).toFixed(1)} · 상위10% ${q(wars, .9).toFixed(1)} · 최대 ${Math.max(...wars).toFixed(1)}`);
console.log(`  타이틀    평균 ${avg(titles).toFixed(1)} · 한 명이라도 받은 비율 ${(titles.filter((x) => x > 0).length / nRiv * 100).toFixed(0)}%`);
console.log(`  MVP 총 ${mvps}회 · 1군 기록 없이 사라진 동기 ${(bust / nRiv * 100).toFixed(0)}%`);
console.log(`\n■ 내 통산 WAR이 동기 6명 중 몇 위인가 — 평균 ${avg(ranks).toFixed(1)}위 · 1위 비율 ${(ranks.filter((x) => x === 1).length / ranks.length * 100).toFixed(0)}%`);
console.log(`\n■ 표본\n${samples.join("\n")}`);

/* 불변식 — 한 해에 같은 부문 1위가 둘일 수 없다 */
import { MAJOR_TITLES } from "../src/lib/sim";
let dup = 0, checked = 0, beaten = 0, beat = 0;
for (let i = 0; i < 40; i++) {
  const rng2 = new RNG(9100 + i * 7);
  const kind2 = i % 2 ? "HITTER" : "PITCHER";
  const p2 = rollCandidate({ name: "나", number: 1, kind: kind2, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng2);
  const seen = new Map<string, number>();
  autoPlay(newGame(p2, "DAG", i * 37), {
    onStep: (g2: GameState) => {
      // 동기의 lastAwards는 **그 시즌이 닫힌 직후**에만 그 해의 것이다.
      // 한 스텝이라도 지나면 다음 해로 덮여, 없는 중복이 보인다.
      const idx = g2.lastSeasonIndex ?? -1;
      const rec = g2.seasons[idx];
      if (!rec || rec.level !== "KBO" || seen.has(`${idx}`)) return;
      seen.set(`${idx}`, 1);
      const holders: Record<string, number> = {};
      for (const a of rec.awards) if (MAJOR_TITLES.includes(a)) holders[a] = (holders[a] ?? 0) + 1;
      for (const r of g2.rivals ?? []) for (const a of r.lastAwards) if (MAJOR_TITLES.includes(a)) holders[a] = (holders[a] ?? 0) + 1;
      for (const v of Object.values(holders)) { checked++; if (v > 1) dup++; }
      beaten += g2.logs.filter((l) => l.year === rec.year && l.title.endsWith("놓쳤다")).length;
      beat += rec.awards.filter((a) => MAJOR_TITLES.includes(a)).length;
    },
  });
}
console.log(`\n■ 불변식 — 부문 1위가 한 해에 둘 이상인 경우 ${dup}/${checked}건 (0이어야 한다)`);
console.log(`  동기에게 타이틀을 뺏긴 횟수 ${beaten}회 · 내가 가져간 횟수 ${beat}회`);
