/** UI 검증용 — 각 단계(phase)에 멈춘 세이브를 하나씩 만든다 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState, Phase } from "../src/lib/types";

function reach(phase: Phase, name: string, minKbo = 4, tries = 40): GameState | null {
  for (let i = 0; i < tries; i++) {
    const rng = new RNG(1000 + i * 977);
    const p = rollCandidate(
      { name, number: 33, kind: "HITTER", position: "CF", bats: "L", throws: "R", styleId: "toolsy" }, rng,
    );
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), {
      joinNational: true, military: "SANGMU", nego: "push", transferChance: 0,
      stopAt: (cur) =>
        cur.phase === phase && cur.seasons.filter((s) => s.level === "KBO").length >= minKbo,
    });
    if (g.phase === phase) return g;
  }
  return null;
}

const targets: [Phase, string][] = [
  ["SPRING_CAMP", "캠프중"],
  ["ALL_STAR", "올스타"],
  ["POSTSEASON", "가을남자"],
  ["SEASON_END", "시즌끝"],
  ["INTERNATIONAL", "국대"],
  ["MILITARY_CHOICE", "미필이"],
  ["NEGOTIATION", "협상중"],
  ["STOVE", "이적생"],
  ["FA", "박FA"],
];

const all: Record<string, GameState> = {};
for (const [phase, name] of targets) {
  const g = reach(phase, name, phase === "MILITARY_CHOICE" ? 6 : 4);
  if (g) all[g.id] = g;
  console.error(`${phase.padEnd(16)} ${g ? `OK  ${g.year} ${g.player.age}세 ${g.id}` : "미도달"}`);
}
console.log(JSON.stringify(all));
