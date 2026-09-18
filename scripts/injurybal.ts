/**
 * 부상은 얼마나 자주, 얼마나 크게 오는가 — 그리고 커리어를 얼마나 바꾸는가.
 *
 * 실제 KBO를 잣대로 삼는다.
 *  · 규정타석(446) 도달: 10개 구단에서 한 해 25~35명 — 주전 야수의 절반 안팎
 *  · 한 달 이상 이탈: 주전급의 30~40%가 한 시즌에 한 번은 겪는다
 *  · 반 시즌 이상 이탈: 팀당 한두 명 — 리그 전체로 10명 안팎(5% 미만)
 */
import { RNG } from "../src/lib/rng";
import { getAb, overall, rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState, HitterLine, SeasonRecord } from "../src/lib/types";

type Row = { age: number; dur: number; missed: number; severity: string | null; pa: number; war: number; level: string };
const rows: Row[] = [];
type Career = { injuries: number; heavy: number; war: number; seasons: number; peakOvr: number; retireAge: number };
const careers: Career[] = [];
const paired: { before: number[]; during: number[]; after: number[] }[] = [];
const preHeavy = { n: 0, hurt: 0 };
const postHeavy = { n: 0, hurt: 0 };
const afterNone = { n: 0, down: 0 };
const afterMid = { n: 0, down: 0 };
const afterHeavy = { n: 0, down: 0 };

const SEV = /(경미|중간|심각)/;
const MISS = /약 (\d+)경기를 결장/;

for (let i = 0; i < 150; i++) {
  const rng = new RNG(2400 + i * 19);
  const p = rollCandidate({ name: "표본", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "gap" }, rng);
  let peak = 0;
  const g: GameState = autoPlay(newGame(p, "DAG", i * 71), {
    onStep: (s: GameState) => { peak = Math.max(peak, overall(s.player)); },
  });
  let inj = 0, heavy = 0, war = 0, seasons = 0;
  const kbo = (g.seasons as SeasonRecord[]).filter((r) => r.level === "KBO");
  const line = { before: [] as number[], during: [] as number[], after: [] as number[] };
  let firstHeavy = -1;
  kbo.forEach((rec, idx) => {
    const note = rec.note ?? "";
    const sev = SEV.exec(note)?.[1] ?? null;
    const missed = Number(MISS.exec(note)?.[1] ?? 0);
    // 한 달 이상 빠진 시즌만 '부상 시즌'으로 본다 — 경미한 결장은 흐름을 안 끊는다
    if (sev && missed >= 25) {
      const prev = kbo[idx - 1], next = kbo[idx + 1];
      if (prev && next && !SEV.test(prev.note ?? "") && !SEV.test(next.note ?? "")) {
        line.before.push(prev.line.war); line.during.push(rec.line.war); line.after.push(next.line.war);
      }
    }
    if (missed >= 50 && firstHeavy < 0) firstHeavy = idx;
  });
  paired.push(line);
  // 부상이 그 다음 해의 자리를 밀어내는가 — 가동률 0.6 미만이면 개막부터 2군이다
  const all2 = (g.seasons as SeasonRecord[]).filter((r) => r.level === "KBO" || r.level === "MINOR");
  all2.forEach((rec, idx) => {
    const next = all2[idx + 1];
    if (!next || rec.level !== "KBO") return;
    const missed = Number(MISS.exec(rec.note ?? "")?.[1] ?? 0);
    const bucket = missed >= 50 ? afterHeavy : missed >= 25 ? afterMid : afterNone;
    bucket.n++;
    if (next.level === "MINOR") bucket.down++;
  });
  if (firstHeavy >= 0) {
    kbo.forEach((rec, idx) => {
      const bucket = idx < firstHeavy ? preHeavy : idx > firstHeavy ? postHeavy : null;
      if (!bucket) return;
      bucket.n++;
      if (SEV.test(rec.note ?? "")) bucket.hurt++;
    });
  }
  for (const rec of g.seasons as SeasonRecord[]) {
    if (rec.level !== "KBO") continue;
    seasons++; war += rec.line.war;
    const note = rec.note ?? "";
    const sev = SEV.exec(note)?.[1] ?? null;
    const missed = Number(MISS.exec(note)?.[1] ?? 0);
    if (sev) { inj++; if (missed >= 50) heavy++; }
    rows.push({
      age: rec.age, dur: getAb(g.player.abilities, "durability" as never),
      missed, severity: sev, pa: (rec.line as HitterLine).pa, war: rec.line.war, level: rec.level,
    });
  }
  careers.push({ injuries: inj, heavy, war, seasons, peakOvr: peak, retireAge: g.player.age });
}

const n = rows.length;
const hurt = rows.filter((r) => r.severity);
console.log(`■ 1군 시즌 ${n}개 — 부상 ${hurt.length}건 (${Math.round(hurt.length / n * 100)}%)`);
for (const s of ["경미", "중간", "심각"]) {
  const sub = hurt.filter((r) => r.severity === s);
  const avg = sub.reduce((a, r) => a + r.missed, 0) / (sub.length || 1);
  console.log(`  ${s}  ${String(sub.length).padStart(4)}건 (전체의 ${(sub.length / n * 100).toFixed(0)}%) · 평균 ${avg.toFixed(0)}경기 결장`);
}
const monthOut = rows.filter((r) => r.missed >= 25).length;
const halfOut = rows.filter((r) => r.missed >= 72).length;
console.log(`  한 달(25경기) 이상 이탈 ${(monthOut / n * 100).toFixed(0)}%  ·  반 시즌(72경기) 이상 ${(halfOut / n * 100).toFixed(1)}%`);
console.log(`  규정타석(446) 도달 ${(rows.filter((r) => r.pa >= 446).length / n * 100).toFixed(0)}%`);

console.log("\n■ 나이별 부상률");
for (const [lo, hi] of [[19, 26], [27, 30], [31, 33], [34, 36], [37, 42]]) {
  const sub = rows.filter((r) => r.age >= lo && r.age <= hi);
  if (sub.length < 10) continue;
  const h = sub.filter((r) => r.severity).length;
  console.log(`  ${lo}~${hi}세  ${String(sub.length).padStart(4)}시즌 · 부상 ${(h / sub.length * 100).toFixed(0)}% · 평균 ${(sub.reduce((a, r) => a + r.missed, 0) / sub.length).toFixed(0)}경기 결장`);
}

/**
 * 부상이 커리어를 얼마나 바꾸는가.
 *
 * **부상 횟수로 나누면 안 된다** — 부상을 여섯 번 당하려면 열여섯 시즌을 뛰어야 하므로,
 * 오래 뛴(=좋은) 커리어가 통째로 '부상 많음' 쪽에 몰린다. 생존 편향이다.
 * 시즌당 부상률로 정규화하고, 같은 선수 안에서 부상 시즌과 성한 시즌을 짝지어 본다.
 */
console.log("\n■ 커리어당 부상률로 본 영향 (커리어 150개)");
console.log("  시즌당 부상률   커리어   통산 WAR   1군 시즌   피크 OVR   은퇴 나이");
for (const [lo, hi] of [[0, 0.2], [0.2, 0.3], [0.3, 0.4], [0.4, 1]]) {
  const sub = careers.filter((c) => c.seasons >= 5 && c.injuries / c.seasons >= lo && c.injuries / c.seasons < hi);
  if (sub.length < 5) continue;
  const avg = (f: (c: Career) => number) => sub.reduce((a, c) => a + f(c), 0) / sub.length;
  console.log(
    `  ${`${(lo * 100).toFixed(0)}~${(hi * 100).toFixed(0)}%`.padEnd(12)} ${String(sub.length).padStart(5)}`
    + `  ${avg((c) => c.war).toFixed(1).padStart(8)}  ${avg((c) => c.seasons).toFixed(1).padStart(8)}`
    + `  ${avg((c) => c.peakOvr).toFixed(1).padStart(8)}  ${avg((c) => c.retireAge).toFixed(1).padStart(8)}`,
  );
}

console.log("\n■ 같은 선수 안에서 — 부상 시즌과 그 앞뒤");
const pairs = { before: [] as number[], during: [] as number[], after: [] as number[] };
for (const line of paired) {
  pairs.before.push(...line.before); pairs.during.push(...line.during); pairs.after.push(...line.after);
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
console.log(`  부상 **직전** 시즌 WAR ${mean(pairs.before).toFixed(2)} (n=${pairs.before.length})`);
console.log(`  부상 **그해**  WAR ${mean(pairs.during).toFixed(2)} (n=${pairs.during.length})  ← ${(mean(pairs.during) - mean(pairs.before)).toFixed(2)}`);
console.log(`  부상 **이듬해** WAR ${mean(pairs.after).toFixed(2)} (n=${pairs.after.length})  ← ${(mean(pairs.after) - mean(pairs.before)).toFixed(2)}`);

console.log("\n■ 심각 부상은 눈덩이가 되는가 (내구성이 영구히 깎인다)");
console.log(`  심각 부상 전 부상률 ${(preHeavy.hurt / (preHeavy.n || 1) * 100).toFixed(0)}% (n=${preHeavy.n})`);
console.log(`  심각 부상 후 부상률 ${(postHeavy.hurt / (postHeavy.n || 1) * 100).toFixed(0)}% (n=${postHeavy.n})`);

console.log("\n■ 부상이 이듬해의 자리를 밀어내는가 (1군 → 이듬해 2군 비율)");
for (const [label, b] of [["결장 없음/경미", afterNone], ["한 달 이상(25+)", afterMid], ["반 시즌 가까이(50+)", afterHeavy]] as const) {
  console.log(`  ${label.padEnd(18)} ${String(b.n).padStart(5)}시즌 · 이듬해 2군 ${(b.down / (b.n || 1) * 100).toFixed(0)}%`);
}
