/**
 * 투수가 보직 사이를 오가는가.
 *
 * 실제 KBO에서 불펜은 머무는 자리가 아니다 — 긴 이닝을 견디면 선발로 돌리고,
 * 짧게 윽박지르면 뒷문을 맡긴다. 그 길이 없으면 중간계투로 시작한 선수는
 * 평생 중간계투로 끝나고, 같은 기량인데 통산 WAR이 선발의 절반에 묶인다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { POSITION_LABEL } from "../src/lib/player";
import type { GameState, Position, SeasonRecord } from "../src/lib/types";

const P_STYLES = ["power_p", "control_p", "breaking_p", "horse_p"];
for (const start of ["RP", "SP", "CP"] as Position[]) {
  const ends = new Map<string, number>();
  let switched = 0, war = 0, n = 0;
  for (let i = 0; i < 60; i++) {
    const rng = new RNG(5900 + i * 17);
    const p = rollCandidate({ name: "표본", number: 1, kind: "PITCHER", position: start, bats: "R", throws: "R", styleId: P_STYLES[i % P_STYLES.length], armSlot: "OVER" }, rng);
    const g: GameState = autoPlay(newGame(p, "DAG", i * 59));
    n++;
    const end = g.player.position;
    ends.set(end, (ends.get(end) ?? 0) + 1);
    if (end !== start) switched++;
    for (const rec of g.seasons as SeasonRecord[]) if (rec.level === "KBO") war += rec.line.war;
  }
  const spread = [...ends].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / n * 100)}%`).join(" · ");
  console.log(`■ ${start}로 시작 — 보직을 옮긴 커리어 ${Math.round(switched / n * 100)}% · 통산 WAR 평균 ${(war / n).toFixed(1)}`);
  console.log(`   은퇴 시 자리: ${spread}`);
}

/** 타자 — 수비 스펙트럼을 오르내리는가 */
const H_START: Position[] = ["C", "SS", "2B", "3B", "CF", "LF", "1B"];
const H_STYLES = ["gap", "slugger", "contact", "toolsy", "defense"];
console.log("");
for (const start of H_START) {
  const ends = new Map<string, number>();
  let moved = 0, n = 0;
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(6400 + i * 13);
    const p = rollCandidate({ name: "표본", number: 1, kind: "HITTER", position: start, bats: "R", throws: "R", styleId: H_STYLES[i % H_STYLES.length] }, rng);
    const g: GameState = autoPlay(newGame(p, "DAG", i * 61));
    n++;
    const end = g.player.position;
    ends.set(end, (ends.get(end) ?? 0) + 1);
    if (end !== start) moved++;
  }
  const spread = [...ends].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${POSITION_LABEL[k as Position]} ${Math.round(v / n * 100)}%`).join(" · ");
  console.log(`■ ${POSITION_LABEL[start]}로 시작 — 자리를 옮긴 커리어 ${Math.round(moved / n * 100)}%`);
  console.log(`   은퇴 시 자리: ${spread}`);
}
