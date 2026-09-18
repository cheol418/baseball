/**
 * 스프링캠프 통보가 훈련 탓과 나이 탓을 구분해서 말하는가.
 *
 * 훈련은 능력치를 깎지 않는다 — `grow()`의 훈련 몫은 늘 0 이상이다.
 * 그런데 합쳐진 값을 "훈련 결과"라고 적으면 서른다섯의 겨울이
 * "훈련 결과 −3"으로 뜬다. 훈련이 잘못한 것처럼 읽힌다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

type Row = { age: number; label: string; from: string; to: string };
const rows: Row[] = [];

for (let i = 0; i < 120; i++) {
  const rng = new RNG(4700 + i * 19);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "표본", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seen = new Set<string>();
  autoPlay(newGame(p, "DAG", i * 43), {
    onStep: (g: GameState) => {
      for (const n of g.notices ?? []) {
        if ((n.eyebrow !== "Spring Camp" && n.eyebrow !== "Hell Training") || seen.has(n.id)) continue;
        seen.add(n.id);
        for (const c of n.change ?? []) rows.push({ age: g.player.age, label: c.label, from: c.from, to: c.to });
      }
    },
  });
}

/** 훈련이 보탠 몫에 마이너스가 적히면 안 된다 */
const trainRows = rows.filter((r) => r.label === "훈련 효과");
const minus = trainRows.filter((r) => r.to.includes("−"));
const aged = rows.filter((r) => r.label === "나이 영향" || r.label === "내려감");
const ovr = rows.filter((r) => r.label === "OVR");

console.log(`■ 캠프 통보 ${ovr.length}건`);
console.log(`  훈련 효과 ${trainRows.length}줄 · 그중 "소득 없음" ${trainRows.filter((r) => r.to.includes("소득 없음")).length}줄`);
console.log(`  내려간 것/나이로 잃은 것 ${aged.length}줄 (나이 든 해에만 붙는다)`);
console.log(`■ 훈련 몫에 마이너스가 적힌 줄 ${minus.length}건 (0이어야 한다)`);
minus.slice(0, 5).forEach((r) => console.log(`  ${r.age}세 — ${r.to}`));

// 나이대별로 어떻게 읽히는지
const band = (a: number) => a < 27 ? "26세 이하" : a < 31 ? "27~30세" : a < 35 ? "31~34세" : "35세 이상";
const by = new Map<string, { n: number; lost: number }>();
for (const r of ovr) {
  const b = band(r.age);
  const cur = by.get(b) ?? { n: 0, lost: 0 };
  cur.n++;
  if (Number(r.to) < Number(r.from)) cur.lost++;
  by.set(b, cur);
}
console.log("■ 나이대별 — 캠프를 마쳤을 때 OVR이 내려간 비율");
for (const b of ["26세 이하", "27~30세", "31~34세", "35세 이상"]) {
  const v = by.get(b); if (!v) continue;
  console.log(`  ${b.padEnd(9)} ${String(v.n).padStart(4)}건 · 내려감 ${Math.round((v.lost / v.n) * 100)}%`);
}

// 실제로 화면에 뜨는 모양 — 나이대별로 한 건씩
console.log("■ 화면에 뜨는 모양");
for (const want of [24, 29, 33, 37]) {
  const idx = rows.findIndex((r, k) => r.age === want && r.label === "훈련 효과" && rows[k + 1]);
  if (idx < 0) continue;
  const block = rows.slice(idx, idx + 3).filter((r) => r.age === want);
  console.log(`  [${want}세]`);
  for (const r of block) console.log(`    ${r.label.padEnd(12)} ${r.from} → ${r.to}`);
}
