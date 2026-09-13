/** 1군 진입 시점 측정 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { Kind } from "../src/lib/types";

const CONFIGS: [string, Kind, string, string][] = [
  ["교타자 2루수", "HITTER", "contact", "2B"],
  ["거포 1루수", "HITTER", "slugger", "1B"],
  ["호타준족 CF", "HITTER", "toolsy", "CF"],
  ["파워피처 선발", "PITCHER", "power_p", "SP"],
  ["제구형 선발", "PITCHER", "control_p", "SP"],
];

const pct = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * q)];
const avg = (a: number[]) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "-";

console.log("  진로   유형            드래프트OVR  드래프트나이  1군데뷔  주전정착  2군시즌");
for (const college of [false, true]) {
for (const [label, kind, styleId, pos] of CONFIGS) {
  const firstKbo: number[] = [], firstStarter: number[] = [], minorYears: number[] = [];
  const draftOvr: number[] = [], draftAge: number[] = [];
  let never = 0;
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(9000 + i * 271);
    const p = rollCandidate(
      { name: "x", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId,
        armSlot: kind === "PITCHER" ? "THREE_QUARTER" : undefined }, rng,
    );
    let atDraft = 0;
    let atAge = 0;
    const g = autoPlay(newGame(p, "DAJ", rng.int(1, 2 ** 30)), {
      transferChance: 0, college,
      onStep: (c) => { if (c.phase === "DRAFT") { atDraft = overall(c.player); atAge = c.player.age; } },
    });
    if (atDraft) { draftOvr.push(atDraft); draftAge.push(atAge); }
    const kbo = g.seasons.filter((s) => s.level === "KBO");
    const starter = kbo.find((s) => ["주전", "1선발", "선발", "마무리"].includes(s.role));
    if (kbo.length) firstKbo.push(kbo[0].age); else never++;
    if (starter) firstStarter.push(starter.age);
    minorYears.push(g.seasons.filter((s) => s.level === "MINOR").length);
  }
  console.log(
    `  ${(college ? "대졸" : "고졸").padEnd(5)} ${label.padEnd(14)} ${avg(draftOvr).padStart(9)}  ` +
    `${avg(draftAge).padStart(10)}세  ${avg(firstKbo).padStart(6)}세  ${avg(firstStarter).padStart(6)}세  ` +
    `${avg(minorYears).padStart(6)}`,
  );
  void never; void pct;
}
console.log("");
}
