/** 감독 — 재임이 실제와 맞는가, 교체가 커리어를 흔드는가, 분포를 깨지 않는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { managerFit, managerStyle, MANAGER_STYLES } from "../src/lib/manager";
import type { GameState } from "../src/lib/types";

const ARCH = [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"], ["HITTER", "C", "defense"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "SP", "control_p"], ["PITCHER", "CP", "power_p"],
] as const;

const tenures: number[] = [];
const changes: number[] = [];
const fits: number[] = [];
const byStyle: Record<string, { fit: number; n: number }> = {};
const trustDrops: number[] = [];
let seasons = 0;

for (let i = 0; i < 110; i++) {
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const rng = new RNG(4800 + i * 13);
  const p = rollCandidate({ name: "나", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
  const seen = new Set<number>();
  let lastName: string | null = null, lastSeasons = 0, nChange = 0, lastTrust = 55;

  const g: GameState = autoPlay(newGame(p, "DAG", i * 19), {
    onStep: (x: GameState) => {
      if (x.phase !== "SPRING_CAMP" || !x.manager || seen.has(x.year)) return;
      seen.add(x.year); seasons++;
      const m = x.manager;
      if (lastName && lastName !== m.name) {
        tenures.push(lastSeasons);
        nChange++;
        // 교체 직후 신뢰가 얼마나 빠졌나 (팀 이동이 아닌 경질만 대략 잡힌다)
        if (lastTrust > x.trust) trustDrops.push(lastTrust - x.trust);
      }
      lastName = m.name; lastSeasons = m.seasons + 1; lastTrust = x.trust;
      const f = managerFit(m, x);
      fits.push(f);
      const s2 = managerStyle(m.styleId).name;
      (byStyle[s2] ??= { fit: 0, n: 0 });
      byStyle[s2].fit += f; byStyle[s2].n++;
    },
  });
  void g;
  changes.push(nChange);
}
const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const q = (a: number[], x: number) => [...a].sort((m, n) => m - n)[Math.floor(a.length * x)] ?? 0;
console.log(`■ 감독 (스프링캠프 ${seasons}회)`);
console.log(`  재임 — 평균 ${avg(tenures).toFixed(1)}시즌 · 중앙 ${q(tenures, .5)} · 최대 ${Math.max(...tenures, 0)}   (실제 KBO 3년 안팎)`);
console.log(`  커리어당 감독 교체 ${avg(changes).toFixed(1)}회`);
console.log(`  경질 시 신뢰 낙폭 — 평균 ${avg(trustDrops).toFixed(1)} · 상위10% ${q(trustDrops, .9).toFixed(0)}`);
console.log(`\n■ 성향별 "나를 보는 눈" (인구 평균이 0 근처여야 분포가 안 밀린다)`);
for (const st of MANAGER_STYLES) {
  const v = byStyle[st.name];
  if (!v) continue;
  console.log(`  ${st.name.padEnd(9)} n=${String(v.n).padStart(4)}  평균 ${(v.fit / v.n >= 0 ? "+" : "") + (v.fit / v.n).toFixed(2)}`);
}
console.log(`  ★ 전체 평균 ${(avg(fits) >= 0 ? "+" : "") + avg(fits).toFixed(2)}  (0에서 멀면 입지 분포가 밀린다)`);
