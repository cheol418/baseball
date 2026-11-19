/**
 * 보직 이동 통보 — **옆으로 간 것을 하락이라고 적지 않는가.**
 *
 * 판정이 `roleTier(새) > roleTier(옛)` 하나뿐이면 같은 티어로 옮긴 이동이
 * 전부 "하락"으로 떨어진다 (1군 불펜 → 1군 5선발, 둘 다 tier 3).
 * 로그 문장은 타입체커가 못 잡으므로 실제 커리어에서 세어본다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { ROLES, roleShift } from "../src/lib/roles";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

const ARCH = [
  ["PITCHER", "SP", "power_p"], ["PITCHER", "SP", "control_p"],
  ["PITCHER", "RP", "power_p"], ["PITCHER", "RP", "control_p"],
  ["PITCHER", "CP", "power_p"], ["HITTER", "CF", "toolsy"],
] as const;
const N = 180;

const counts: Record<string, number> = { UP: 0, SIDE: 0, DOWN: 0 };
const pairs: Record<string, number> = {};
let wrong = 0;

for (let i = 0; i < N; i++) {
  const rng = new RNG(5100 + i * 7);
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const p = rollCandidate({
    name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style,
  }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 17), {
    clutchPick: i % 3, transferChance: 0.25, secondLife: i % 7,
  });

  for (const l of g.logs ?? []) {
    if (!l.title?.startsWith("보직 ")) continue;
    const kindOf = l.title === "보직 상승" ? "UP" : l.title === "보직 변경" ? "SIDE" : "DOWN";
    counts[kindOf]++;
    /*
     * 문장과 아이콘이 제목과 같은 말을 하는가.
     * "보직 변경"인데 "밀렸습니다"가 붙으면 화면이 두 말을 한다.
     */
    const says = l.body ?? "";
    const bad =
      (kindOf === "SIDE" && (says.includes("밀렸") || says.includes("인정받아")))
      || (kindOf === "DOWN" && !says.includes("밀렸"))
      || (kindOf === "UP" && !says.includes("인정받아"));
    if (bad) { wrong++; if (wrong <= 5) console.log(`  어긋남: [${l.title}] ${says}`); }
  }
}

console.log(`■ 커리어 ${N}개의 1군 안 보직 이동`);
const total = counts.UP + counts.SIDE + counts.DOWN;
for (const k of ["UP", "SIDE", "DOWN"]) {
  const label = k === "UP" ? "상승" : k === "SIDE" ? "변경(옆으로)" : "하락";
  console.log(`  ${label.padEnd(14)} ${String(counts[k]).padStart(4)}  ${(counts[k] / total * 100).toFixed(1)}%`);
}
console.log(`  커리어당 ${(total / N).toFixed(1)}회`);
console.log(`\n■ 제목과 문장이 어긋난 통보 ${wrong}건 (0이어야 한다)`);

/*
 * 같은 티어끼리 옮길 수 있는 자리가 실제로 있는지 — 표가 바뀌면
 * '변경'이 영영 안 나오는 분류가 생길 수 있다.
 */
const byTier: Record<number, string[]> = {};
for (const r of Object.values(ROLES)) (byTier[r.tier] ??= []).push(r.name);
console.log("\n■ 같은 무게의 자리들 (여기끼리 옮기면 '변경')");
for (const [tier, names] of Object.entries(byTier).sort((a, b) => Number(b[0]) - Number(a[0]))) {
  if (names.length > 1) console.log(`  tier ${tier}  ${names.join(" · ")}`);
}
console.log(`  표본 확인 — 불펜→5선발 = ${roleShift("불펜", "5선발")} · 5선발→선발 = ${roleShift("5선발", "선발")} · 필승조→불펜 = ${roleShift("필승조", "불펜")}`);
void pairs;

if (wrong) process.exitCode = 1;
