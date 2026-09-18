/**
 * 대표팀 발탁이 자리를 가리는가.
 *
 * 국제대회는 단기전이라 실제로는 **불펜이 매우 중요하다** — 오승환·정우람·고우석 모두
 * 마무리로 대표팀 단골이었다. 점수식이 선발만 쳐주고 있으면 그게 안 나온다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState, Position, SeasonRecord } from "../src/lib/types";

type Row = { pos: string; picks: number; kboSeasons: number; war: number };
const rows: Row[] = [];

const SET: { pos: Position; kind: "HITTER" | "PITCHER"; style: string }[] = [
  { pos: "SP", kind: "PITCHER", style: "control_p" },
  { pos: "CP", kind: "PITCHER", style: "power_p" },
  { pos: "RP", kind: "PITCHER", style: "power_p" },
  { pos: "C", kind: "HITTER", style: "gap" },
  { pos: "SS", kind: "HITTER", style: "toolsy" },
  { pos: "CF", kind: "HITTER", style: "gap" },
  { pos: "1B", kind: "HITTER", style: "slugger" },
  { pos: "DH", kind: "HITTER", style: "slugger" },
];

for (const { pos, kind, style } of SET) {
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(3100 + i * 19);
    const p = rollCandidate({ name: "표본", number: 1, kind, position: pos, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    const g: GameState = autoPlay(newGame(p, "DAG", i * 73));
    let seasons = 0, war = 0;
    for (const rec of g.seasons as SeasonRecord[]) {
      if (rec.level !== "KBO") continue;
      seasons++; war += rec.line.war;
    }
    rows.push({ pos, picks: g.intlResults.length, kboSeasons: seasons, war });
  }
}

console.log("■ 자리별 대표팀 발탁 (각 40명 · 커리어 전체)");
console.log("  자리   커리어당 발탁   한 번도 못 뽑힌 비율   1군 시즌   통산WAR");
for (const { pos } of SET) {
  const sub = rows.filter((r) => r.pos === pos);
  const avg = (f: (r: Row) => number) => sub.reduce((a, r) => a + f(r), 0) / sub.length;
  const never = sub.filter((r) => r.picks === 0).length / sub.length;
  console.log(
    `  ${pos.padEnd(5)} ${avg((r) => r.picks).toFixed(1).padStart(10)}`
    + `  ${(never * 100).toFixed(0).padStart(16)}%`
    + `  ${avg((r) => r.kboSeasons).toFixed(1).padStart(9)}`
    + `  ${avg((r) => r.war).toFixed(1).padStart(8)}`,
  );
}
