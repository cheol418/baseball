/**
 * 실제 커리어에서 천장이 언제 막히고, 훈련이 얼마나 듣는가.
 *
 * `headroom.ts`는 grow()만 직접 굴리는 합성 테스트라 시즌 성적에 딸린 것들
 * (스카우팅 리포트 수정 등)이 안 걸린다. 여기서는 커리어를 통째로 돌린다.
 */
import { RNG } from "../src/lib/rng";
import { abilityKeys, getAb, overall, rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

type Row = { age: number; stuck: number; room: number; ovr: number; gain: number; loss: number };
const rows: Row[] = [];
let revised = 0, camps = 0;

for (let i = 0; i < 120; i++) {
  const rng = new RNG(7300 + i * 11);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const pos = i % 2 ? "CF" : (i % 4 === 0 ? "SP" : "CP");
  const p = rollCandidate({ name: "표본", number: 1, kind, position: pos, bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seenNotice = new Set<string>();
  let prevAge = 0;
  autoPlay(newGame(p, "DAG", i * 53), {
    onStep: (g: GameState) => {
      for (const n of g.notices ?? []) {
        if (seenNotice.has(n.id)) continue;
        seenNotice.add(n.id);
        if (n.eyebrow === "Scouting") revised++;
        if (n.eyebrow === "Spring Camp" || n.eyebrow === "Hell Training") {
          camps++;
          const gain = (n.change ?? []).find((c) => c.label === "훈련 효과")?.to ?? "";
          const loss = (n.change ?? []).find((c) => c.label === "나이 영향" || c.label === "내려감")?.to ?? "";
          const sum = (t: string) => (t.match(/[+−]\d+/g) ?? [])
            .reduce((a, x) => a + (x[0] === "−" ? -1 : 1) * Number(x.slice(1)), 0);
          const keys = abilityKeys(g.player.kind);
          const stuck = keys.filter((k) => getAb(g.player.potential, k) - getAb(g.player.abilities, k) <= 0).length;
          const room = keys.reduce((a, k) => a + Math.max(0, getAb(g.player.potential, k) - getAb(g.player.abilities, k)), 0);
          rows.push({ age: g.player.age, stuck: stuck / keys.length, room, ovr: overall(g.player), gain: sum(gain), loss: sum(loss) });
        }
      }
      prevAge = g.player.age;
    },
  });
  void prevAge;
}

console.log("  나이대    캠프   막힌 항목   성장 여지   훈련 몫   나이 몫    OVR");
for (const [lo, hi] of [[19, 23], [24, 26], [27, 29], [30, 32], [33, 35], [36, 40]]) {
  const sub = rows.filter((r) => r.age >= lo && r.age <= hi);
  if (!sub.length) continue;
  const avg = (f: (r: Row) => number) => sub.reduce((a, r) => a + f(r), 0) / sub.length;
  console.log(
    `  ${lo}~${hi}세 ${String(sub.length).padStart(6)}`
    + `  ${(avg((r) => r.stuck) * 100).toFixed(0).padStart(8)}%`
    + `  ${avg((r) => r.room).toFixed(1).padStart(9)}`
    + `  ${avg((r) => r.gain).toFixed(2).padStart(8)}`
    + `  ${avg((r) => r.loss).toFixed(2).padStart(8)}`
    + `  ${avg((r) => r.ovr).toFixed(1).padStart(6)}`,
  );
}
console.log(`\n■ 스카우팅 리포트 수정 ${revised}회 / 캠프 ${camps}회 (커리어당 ${(revised / 120).toFixed(1)}회)`);
