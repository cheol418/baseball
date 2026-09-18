/**
 * 초반이 답답한가 — 고졸 입단 뒤 첫 여덟 시즌을 따라간다.
 *
 * "성장 곡선의 앞을 깎았다"는 조정이 실제 플레이에서 어떻게 읽히는지 본다.
 * 숫자만이 아니라 **그 시즌에 무슨 일이 있었는지**(소속·보직·기록)를 같이 본다.
 */
import { RNG } from "../src/lib/rng";
import { overall, rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState, HitterLine, StatLine } from "../src/lib/types";

type Season = { age: number; level: string; role: string; ovr: number; line: StatLine; war: number };
const runs: Season[][] = [];

for (let i = 0; i < 60; i++) {
  const rng = new RNG(9900 + i * 13);
  const p = rollCandidate({
    name: "표본", number: 1, kind: "HITTER", position: "CF",
    bats: "R", throws: "R", styleId: "gap",
  }, rng);
  const seen: Season[] = [];
  const g: GameState = autoPlay(newGame(p, "DAG", i * 61), {
    onStep: (s: GameState) => {
      // 시즌이 닫힌 직후의 OVR을 함께 담는다
      const rec = s.seasons[s.seasons.length - 1];
      if (!rec || seen.some((x) => x.age === rec.age)) return;
      if (rec.level !== "KBO" && rec.level !== "MINOR") return;
      seen.push({ age: rec.age, level: rec.level, role: rec.role, ovr: overall(s.player), line: rec.line, war: rec.line.war });
    },
  });
  void g;
  runs.push(seen.slice(0, 8));
}

console.log("■ 고졸 야수 60명 — 입단 뒤 여덟 시즌");
console.log("  나이   1군 비율   보직(최빈)      OVR   타석   타율    OPS   WAR");
for (let n = 0; n < 8; n++) {
  const at = runs.map((r) => r[n]).filter(Boolean);
  if (!at.length) continue;
  const kbo = at.filter((x) => x.level === "KBO").length / at.length;
  const roles = new Map<string, number>();
  for (const x of at) roles.set(x.role, (roles.get(x.role) ?? 0) + 1);
  const top = [...roles].sort((a, b) => b[1] - a[1])[0];
  const avg = (f: (x: Season) => number) => at.reduce((a, x) => a + f(x), 0) / at.length;
  const l = (x: Season) => x.line as HitterLine;
  console.log(
    `  ${String(Math.round(avg((x) => x.age))).padStart(3)}세`
    + `  ${(kbo * 100).toFixed(0).padStart(7)}%`
    + `  ${(top[0] + ` ${Math.round((top[1] / at.length) * 100)}%`).padEnd(14)}`
    + `  ${avg((x) => x.ovr).toFixed(1).padStart(4)}`
    + `  ${avg((x) => l(x).pa).toFixed(0).padStart(5)}`
    + `  ${avg((x) => l(x).avg).toFixed(3).replace(/^0/, "").padStart(6)}`
    + `  ${avg((x) => l(x).ops).toFixed(3).replace(/^0/, "").padStart(6)}`
    + `  ${avg((x) => x.war).toFixed(1).padStart(5)}`,
  );
}
/** 1군에서 처음 규정타석에 가까운 시즌을 치르는 나이 */
const firstReal = runs.map((r) => r.find((x) => x.level === "KBO" && (x.line as HitterLine).pa >= 400)?.age).filter(Boolean) as number[];
firstReal.sort((a, b) => a - b);
console.log(`\n■ 1군 400타석을 처음 채우는 나이 — 중앙 ${firstReal[Math.floor(firstReal.length / 2)]}세 (${firstReal.length}/60명)`);
const stuck2 = runs.filter((r) => r.slice(0, 4).every((x) => x.level === "MINOR")).length;
console.log(`■ 입단 뒤 네 시즌을 통째로 2군에서 보낸 선수 ${stuck2}/60명 (${Math.round(stuck2 / 60 * 100)}%)`);
