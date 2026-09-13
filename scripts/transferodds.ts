/** 표기된 성사 확률이 실제 성사율과 맞는지 + 구간별 분포 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame, advance, makeTransferTargets } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

const buckets: Record<string, { shown: number[]; tried: number; ok: number }> = {};
const key = (p: number) => p < 0.15 ? "0~15%" : p < 0.3 ? "15~30%" : p < 0.5 ? "30~50%" : p < 0.7 ? "50~70%" : "70%+";

let attempts = 0, success = 0;
for (let i = 0; i < 400; i++) {
  const rng = new RNG(53000 + i * 13);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({
    name: "샘플", number: 1, kind, position: (kind === "HITTER" ? "CF" : "SP") as never,
    bats: "R", throws: "R", styleId: kind === "HITTER" ? "toolsy" : "power_p",
    armSlot: kind === "PITCHER" ? "OVER" : undefined,
  }, rng);
  let g: GameState = autoPlay(newGame(p, "DAG", i * 29), {
    stopAt: (c) => c.phase === "STOVE" && !c.transferRequested && (c.pendingTransfers?.length ?? 0) > 0
      && c.seasons.filter((x) => x.level === "KBO").length >= 3,
  });
  if (g.phase !== "STOVE" || !g.pendingTransfers?.length) continue;

  // 표기된 확률 그대로 신청해 실제 성사 여부를 본다
  const t = g.pendingTransfers[i % g.pendingTransfers.length];
  const before = g.contract?.teamId;
  const k = key(t.odds);
  buckets[k] = buckets[k] ?? { shown: [], tried: 0, ok: 0 };
  buckets[k].shown.push(t.odds);
  buckets[k].tried++;
  attempts++;
  g = advance(g, { type: "REQUEST_TRANSFER", teamId: t.teamId });
  if (g.contract?.teamId !== before) { buckets[k].ok++; success++; }
}

console.log(`■ 표기 확률 vs 실제 성사 (신청 ${attempts}건)`);
for (const k of ["0~15%", "15~30%", "30~50%", "50~70%", "70%+"]) {
  const b = buckets[k];
  if (!b?.tried) continue;
  const shown = (b.shown.reduce((a, x) => a + x, 0) / b.shown.length) * 100;
  const real = (b.ok / b.tried) * 100;
  console.log(`  ${k.padEnd(8)} n=${String(b.tried).padStart(3)}  표기 평균 ${shown.toFixed(0)}%  실제 ${real.toFixed(0)}%  ${Math.abs(shown - real) <= 8 ? "✅" : "❌ 어긋남"}`);
}
console.log(`  전체 성사율 ${((success / attempts) * 100).toFixed(0)}%`);

// 기량대별 최고 성사 확률
console.log("\n■ 기량대별 '가장 성사 가능성 높은 구단'의 확률");
const byOvr: Record<string, number[]> = {};
for (let i = 0; i < 300; i++) {
  const rng = new RNG(57000 + i * 17);
  const p = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
  const g = autoPlay(newGame(p, "DAG", i * 31), {
    stopAt: (c) => c.phase === "STOVE" && (c.pendingTransfers?.length ?? 0) > 0
      && c.seasons.filter((x) => x.level === "KBO").length >= 2,
  });
  if (!g.pendingTransfers?.length) continue;
  const o = overall(g.player);
  const k = o < 70 ? "OVR ~69" : o < 80 ? "OVR 70~79" : o < 90 ? "OVR 80~89" : "OVR 90+";
  (byOvr[k] = byOvr[k] ?? []).push(Math.max(...g.pendingTransfers.map((t) => t.odds)));
}
for (const k of ["OVR ~69", "OVR 70~79", "OVR 80~89", "OVR 90+"]) {
  const a = byOvr[k];
  if (!a?.length) continue;
  console.log(`  ${k.padEnd(10)} n=${String(a.length).padStart(3)}  최고 성사 확률 평균 ${((a.reduce((x, y) => x + y, 0) / a.length) * 100).toFixed(0)}%`);
}
