/**
 * 화면에 뜨는 확률이 실제와 맞는가.
 * 표기 확률이 실제와 다르면 플레이어가 세운 계획이 통째로 어긋난다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, hellOdds } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { sangmuOdds } from "../src/lib/national";
import type { GameState } from "../src/lib/types";

type Bucket = { shown: number[]; hit: number[] };
const B: Record<string, Bucket> = {};
const add = (k: string, shown: number, hit: boolean) => {
  (B[k] ??= { shown: [], hit: [] });
  B[k].shown.push(shown); B[k].hit.push(hit ? 1 : 0);
};

for (let i = 0; i < 160; i++) {
  const rng = new RNG(3300 + i * 7);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "s", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const done = new Set<string>();
  let pend: { kind: string; shown: number } | null = null;
  let prevHell = 0;
  let prevSangmu: number | null = null;
  let prevTries = 0;
  autoPlay(newGame(p, "DAG", i * 19), {
    joinNational: true, transferChance: 0.6, military: "SANGMU",
    onStep: (g: GameState) => {
      // 승부처 — 표기 성공률 ↔ 실제 성공
      // clone()이 JSON 왕복이라 객체에 표식을 남길 수 없다 — 키로 중복을 막는다
      (g.monthLines ?? []).forEach((m, mi) => {
        if (!m.clutch || !m.clutchSituation) return;
        const key = `${g.year}-${g.liveHalf}-${mi}-${m.clutchSituation.title}`;
        if (done.has(key)) return;
        done.add(key);
        const o = m.clutchSituation.options.find((x) => x.id === m.clutch!.optionId);
        if (o) add("승부처", o.odds, m.clutch.outcome.good);
      });
      const ag = g.allStarGame;
      if (ag?.clutch && ag.clutchSituation) {
        const key = `AS-${g.year}`;
        if (!done.has(key)) {
          done.add(key);
          const o = ag.clutchSituation.options.find((x) => x.id === ag.clutch!.optionId);
          if (o) add("올스타 승부처", o.odds, ag.clutch.outcome.good);
        }
      }
      // 지옥 훈련 — 표기 성공률 ↔ 실제
      if ((g.hellUsed ?? 0) > prevHell) {
        prevHell = g.hellUsed ?? 0;
        if (pend?.kind === "hell") {
          const won = g.logs.some((l) => l.year === g.year && l.title === "지옥 훈련 성공");
          add("지옥 훈련", pend.shown, won);
        }
        pend = null;
      }
      if (g.phase === "SPRING_CAMP") pend = { kind: "hell", shown: hellOdds(g.player) };
      // 상무 — 표기 선발 확률 ↔ 실제 합격 (지원은 스토브리그의 APPLY_SANGMU다)
      const tries = g.sangmuTries ?? 0;
      if (prevSangmu !== null && tries > prevTries) {
        prevTries = tries;
        add("상무 지원", prevSangmu, g.military === "SANGMU");
        prevSangmu = null;
      }
      if (g.phase === "STOVE" && g.military === "PENDING") prevSangmu = sangmuOdds(g, overall(g.player));
    },
  });
}

console.log("■ 표기 확률 ↔ 실제 발생률\n");
console.log("  항목          표본    표기 평균   실제      오차");
for (const [k, b] of Object.entries(B)) {
  const shown = b.shown.reduce((a, x) => a + x, 0) / b.shown.length;
  const real = b.hit.reduce((a, x) => a + x, 0) / b.hit.length;
  const gap = (real - shown) * 100;
  const flag = Math.abs(gap) > 5 ? "  ← 어긋남" : "";
  console.log(`  ${k.padEnd(12)} ${String(b.shown.length).padStart(5)}  ${(shown * 100).toFixed(1).padStart(7)}%  ${(real * 100).toFixed(1).padStart(6)}%  ${gap >= 0 ? "+" : ""}${gap.toFixed(1)}%p${flag}`);
}

// 구간별로도 본다 — 평균만 맞고 구간별로 어긋나는 경우가 있다
console.log("\n■ 승부처 — 표기 구간별");
const c = B["승부처"];
if (c) {
  for (const [lo, hi] of [[0, 0.25], [0.25, 0.4], [0.4, 0.55], [0.55, 0.7], [0.7, 1]] as [number, number][]) {
    const idx = c.shown.map((v, j) => [v, j] as const).filter(([v]) => v >= lo && v < hi).map(([, j]) => j);
    if (idx.length < 20) continue;
    const shown = idx.reduce((a, j) => a + c.shown[j], 0) / idx.length;
    const real = idx.reduce((a, j) => a + c.hit[j], 0) / idx.length;
    console.log(`  표기 ${(lo * 100).toFixed(0)}~${(hi * 100).toFixed(0)}%  n=${String(idx.length).padStart(5)}  표기 ${(shown * 100).toFixed(1)}% → 실제 ${(real * 100).toFixed(1)}%  (${((real - shown) * 100 >= 0 ? "+" : "") + ((real - shown) * 100).toFixed(1)}%p)`);
  }
}
