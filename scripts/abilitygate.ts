/**
 * 특수능력 조건 ↔ 실제 기록 — 표기한 선을 넘지 않았는데 주는가.
 * `judgeAbilities`가 1군·2군을 오간 시즌의 **합계**를 보면 2군 이닝이 얹힌다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, seasonsAtLevel } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState, PitcherLine, SeasonRecord } from "../src/lib/types";

const ARCH = [
  ["PITCHER", "SP", "power_p"], ["PITCHER", "SP", "control_p"], ["PITCHER", "RP", "power_p"],
] as const;
const N = 240;
const P = (r: SeasonRecord) => r.line as PitcherLine;

let holders = 0, bogus = 0, byTitle = 0;
const examples: string[] = [];
for (let i = 0; i < N; i++) {
  const rng = new RNG(5000 + i * 31);
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: "OVER" }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 29), { clutchPick: i % 3 });
  if (!g.logs.some((l) => l.title === "특수능력 획득 — 이닝이터")) continue;
  holders++;
  const kbo = seasonsAtLevel(g.seasons, "KBO");
  const title = kbo.filter((r) => r.awards.includes("최다이닝")).length;
  const over = kbo.filter((r) => P(r).ip >= 180).length;
  if (title > 0) { byTitle++; continue; }
  if (over < 2) {
    bogus++;
    if (examples.length < 4) {
      const top = kbo.map((r) => P(r).ip).sort((a, b) => b - a).slice(0, 3).map((v) => v.toFixed(0));
      examples.push(`최다이닝 0회 · 180이닝 ${over}시즌 · 1군 상위 이닝 ${top.join(" / ")}`);
    }
  }
}
console.log(`■ 이닝이터 — "180이닝 2시즌 또는 최다이닝"`);
console.log(`  보유 ${holders}명 중 최다이닝으로 ${byTitle}명 · 조건 미달 ${bogus}명 (${(bogus / Math.max(1, holders) * 100).toFixed(0)}%)`);
examples.forEach((e) => console.log("    " + e));

// ── 최다이닝 수상 시즌이 실제로 몇 이닝인가 (1군만 / 합계)
let w = 0, under = 0;
const rows: string[] = [];
for (let i = 0; i < N; i++) {
  const rng = new RNG(5000 + i * 31);
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: "OVER" }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 29), { clutchPick: i % 3 });
  for (const r of g.seasons) {
    if (!r.awards.includes("최다이닝")) continue;
    w++;
    const kboIp = (r.byLevel?.KBO as PitcherLine | undefined)?.ip ?? (r.level === "KBO" ? P(r).ip : 0);
    const allIp = P(r).ip;
    if (kboIp < 183) {
      under++;
      if (rows.length < 5) rows.push(`${r.year} 1군 ${kboIp.toFixed(1)}이닝 · 기록줄 합계 ${allIp.toFixed(1)}이닝${r.byLevel ? " (1·2군 오감)" : ""}`);
    }
  }
}
console.log(`\n■ 최다이닝 수상 ${w}회 중 1군 183이닝 미만 ${under}회 (${(under / Math.max(1, w) * 100).toFixed(0)}%)`);
rows.forEach((x) => console.log("    " + x));

// ── 통보 문구가 "안 한 일"을 적는가 — 조건 목록을 그대로 쓰면 그렇게 된다
const BRANCHED: Record<string, { title: string; other: string }> = {
  이닝이터: { title: "최다이닝", other: "180이닝" },
  탈삼진머신: { title: "탈삼진왕", other: "180탈삼진" },
};
let notices = 0, mixed = 0;
const said: string[] = [];
for (let i = 0; i < N; i++) {
  const rng = new RNG(5000 + i * 31);
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const p2 = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: "OVER" }, rng);
  const g: GameState = autoPlay(newGame(p2, "DAG", i * 29), { clutchPick: i % 3 });
  for (const [name, b] of Object.entries(BRANCHED)) {
    const l = g.logs.find((x) => x.title === `특수능력 획득 — ${name}`);
    if (!l) continue;
    notices++;
    const body = l.body ?? "";
    if (body.includes(b.title) && body.includes(b.other)) {
      mixed++;
      if (said.length < 3) said.push(`${name}: ${body}`);
    } else if (said.length < 3) said.push(`${name}: ${body}`);
  }
}
console.log(`\n■ 가지가 여럿인 능력의 획득 문구 ${notices}건 중 두 가지를 같이 적은 것 ${mixed}건 (0이어야 한다)`);
said.forEach((x) => console.log("    " + x));
