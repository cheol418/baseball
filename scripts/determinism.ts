/**
 * 같은 시드 → 같은 커리어인가.
 *
 * 이 프로젝트의 측정은 거의 전부 **같은 시드에서 짝지어 재는 것**이다
 * (`agency` · `styledrift` · `campreport`). 하네스가 시드 밖에서 고르면
 * 짝이 맞지 않아 그 차이가 전부 선택의 몫으로 잘못 돌아간다.
 * 실제로 겪음: `autoplay.ts`가 이벤트·인터뷰·복무 방침을 `Math.random()`으로
 * 골라, 같은 시드로 두 번 돌린 통산 WAR이 82.8 ↔ 77.0이었다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

const ARCH = [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"],
] as const;

/** 커리어를 한 줄로 요약 — 어디가 갈렸는지 바로 보이게 */
const fingerprint = (g: GameState) => JSON.stringify({
  war: g.seasons.reduce((a, s) => a + s.line.war, 0).toFixed(2),
  seasons: g.seasons.length,
  perks: [...(g.perks ?? [])].sort(),
  team: g.contract?.teamId ?? null,
  age: g.player.age,
  fame: g.player.fame,
  logs: g.logs.length,
});

let same = 0, diff = 0;
const shown: string[] = [];
for (let i = 0; i < 60; i++) {
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const make = () => {
    const p = rollCandidate({
      name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R",
      styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined,
    }, new RNG(7000 + i));
    return autoPlay(newGame(p, "DAG", i * 13), { clutchPick: i % 3, transferChance: 0.3 });
  };
  const a = fingerprint(make()), b = fingerprint(make());
  if (a === b) same++;
  else {
    diff++;
    if (shown.length < 2) shown.push(`  시드 ${i}\n    1회차 ${a}\n    2회차 ${b}`);
  }
}
console.log(`■ 같은 시드를 두 번 돌렸을 때 — 같음 ${same} · 다름 ${diff} (다름이 0이어야 한다)`);
shown.forEach((x) => console.log(x));
if (diff) {
  console.log("\n  시드 밖에서 고르는 곳을 찾는다: grep -rn 'Math.random' scripts/ src/lib/");
  process.exitCode = 1;
}
