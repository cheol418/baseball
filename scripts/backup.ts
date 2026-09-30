/** 내보내기·가져오기 — 되돌려 받았을 때 그대로인가, 합칠 때 최신이 남는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { buildBackup, mergeSaves, parseBackup, backupFilename } from "../src/lib/backup";
import type { GameState } from "../src/lib/types";

const make = (i: number, seasons = true): GameState => {
  const p = rollCandidate({ name: `선수${i}`, number: i, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "gap" }, new RNG(400 + i));
  const g = newGame(p, "DAG", i * 13);
  return seasons ? autoPlay(g, {}) : g;
};

/* 1. 왕복 — 내보냈다 들여오면 그대로인가 */
const games = [make(1), make(2), make(3)];
const text = JSON.stringify(buildBackup(games));
const back = parseBackup(text);
if (!back.ok) throw new Error("왕복 실패: " + back.error);
let diff = 0;
for (let i = 0; i < games.length; i++) {
  // migrate를 한 번 통과하므로 새 필드의 기본값이 붙는다 — 그 외에는 같아야 한다
  const a = games[i], b = back.games[i];
  if (a.id !== b.id || a.player.name !== b.player.name || a.seasons.length !== b.seasons.length) diff++;
  const key = (g: GameState) => JSON.stringify(g.seasons.map((s) => [s.year, s.line.war, s.awards.join()]));
  if (key(a) !== key(b)) diff++;
}
const kb = (n: number) => (new TextEncoder().encode(text).length / 1024).toFixed(0);
console.log(`■ 왕복 — 선수 ${games.length}명 · 파일 ${kb(0)}KB · 어긋난 항목 ${diff}건 (0이어야 한다)`);
console.log(`  파일 이름 예: ${backupFilename(new Date(2026, 9, 1))}`);

/* 2. 엉뚱한 파일을 걸러내는가 */
const bad: [string, string][] = [
  ["JSON이 아님", "hello"],
  ["다른 JSON", JSON.stringify({ hello: "world" })],
  ["미래 버전", JSON.stringify({ ...buildBackup(games), version: 99 })],
  ["빈 파일", JSON.stringify({ ...buildBackup([]), games: [] })],
];
console.log(`\n■ 잘못된 파일`);
for (const [label, t] of bad) {
  const r = parseBackup(t);
  console.log(`  ${label.padEnd(10)} → ${r.ok ? "❌ 통과시킴" : `✅ ${r.error}`}`);
}

/* 3. 합치기 — 최신이 남는가 */
console.log(`\n■ 합치기 (기본 규칙: 저장 시각이 늦은 쪽이 남는다)`);
const mine = { ...make(1), savedAt: 2000 };
const theirsOld = { ...mine, savedAt: 1000, seasons: [] as GameState["seasons"] };
const theirsNew = { ...mine, savedAt: 3000, seasons: [] as GameState["seasons"] };
const fresh = make(9);
for (const [label, incoming, mode] of [
  ["더 오래된 것이 들어옴", [theirsOld], "newer"],
  ["더 새것이 들어옴", [theirsNew], "newer"],
  ["없던 선수가 들어옴", [fresh], "newer"],
  ["둘 다 남기기", [theirsOld], "both"],
  ["지금 것 지키기", [theirsNew], "keep"],
] as const) {
  const p = mergeSaves([mine], [...incoming] as GameState[], mode);
  console.log(`  ${label.padEnd(14)} 최종 ${p.result.length}명 · 추가 ${p.added.length} · 교체 ${p.updated.length} · 유지 ${p.kept.length}`);
}
