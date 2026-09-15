/** 대졸/고졸 신인의 1군 첫 시즌 성적 — 과한지 실측 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, makeTrainingOptions, grow } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { isHitterLine } from "../src/lib/sim";
import type { HitterLine } from "../src/lib/types";

const pct = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * q)];
const f3 = (v: number) => (v < 1 ? v.toFixed(3).slice(1) : v.toFixed(3));

for (const college of [true, false]) {
  const first: { ovr: number; ops: number; avg: number; hr: number; war: number; gain: number }[] = [];
  for (let i = 0; i < 120; i++) {
    const rng = new RNG(43000 + i * 17);
    const p = rollCandidate({ name: "샘플", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy", bias: [-1, 0, 1][i % 3] }, rng);
    const draftOvr = { v: 0 };
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)), {
      college,
      onStep: (c) => { if (c.phase === "DRAFT" && !draftOvr.v) draftOvr.v = overall(c.player); },
    });
    // 처음으로 1군에서 뛴 시즌
    const rookie = g.seasons.find((s) => s.level === "KBO" && (s.line as HitterLine).pa >= 200);
    if (!rookie || !isHitterLine(rookie.line)) continue;
    const l = rookie.line as HitterLine;
    first.push({ ovr: rookie.age, ops: l.ops, avg: l.avg, hr: l.hr, war: l.war, gain: 0 });
  }
  if (!first.length) continue;
  console.log(`\n■ ${college ? "대졸" : "고졸"} — 1군 첫 풀시즌 (n=${first.length})`);
  console.log(`  나이     중앙 ${pct(first.map((r) => r.ovr), 0.5)}세`);
  console.log(`  타율     하위25% ${f3(pct(first.map((r) => r.avg), 0.25))} · 중앙 ${f3(pct(first.map((r) => r.avg), 0.5))} · 상위25% ${f3(pct(first.map((r) => r.avg), 0.75))}`);
  console.log(`  OPS      하위25% ${f3(pct(first.map((r) => r.ops), 0.25))} · 중앙 ${f3(pct(first.map((r) => r.ops), 0.5))} · 상위25% ${f3(pct(first.map((r) => r.ops), 0.75))}`);
  console.log(`  홈런     중앙 ${pct(first.map((r) => r.hr), 0.5)} · 상위25% ${pct(first.map((r) => r.hr), 0.75)}`);
  console.log(`  WAR      중앙 ${pct(first.map((r) => r.war), 0.5).toFixed(1)} · 상위25% ${pct(first.map((r) => r.war), 0.75).toFixed(1)} · 최대 ${Math.max(...first.map((r) => r.war)).toFixed(1)}`);
}

// 훈련 한 번의 최대 상승폭
console.log("\n■ 스프링캠프 훈련 한 번의 능력치 상승폭");
const gains: number[] = [];
for (let i = 0; i < 400; i++) {
  const rng = new RNG(45000 + i * 7);
  const p = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
  p.age = 22;
  const before = { ...(p.abilities as unknown as Record<string, number>) };

  const opts = makeTrainingOptions(p, rng);
  const hell = opts.find((o: { id: string }) => o.id === "hell") ?? opts[0];
  grow(p, rng, hell, 1.0);
  const after = p.abilities as unknown as Record<string, number>;
  for (const k of Object.keys(before)) gains.push(after[k] - before[k]);
}
console.log(`  능력치 하나당  중앙 +${pct(gains, 0.5)} · 상위10% +${pct(gains, 0.9)} · 최대 +${Math.max(...gains)}`);
