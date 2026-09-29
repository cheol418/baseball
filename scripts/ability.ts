/** 특수능력 실측 — 드라이런 예측과 맞는가, 리그가 흔들리지 않는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { ABILITIES, abilityById } from "../src/lib/ability";
import type { GameState } from "../src/lib/types";

const ARCH = [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"], ["HITTER", "2B", "contact"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "SP", "control_p"], ["PITCHER", "CP", "power_p"],
] as const;
const N = 180;

const got: Record<string, number> = {};
/** 한 번이라도 얻어본 적 — 은퇴 시 보유와 나눠 본다 (얻었다 잃는 능력이 있다) */
const ever: Record<string, number> = {};
const per: { gold: number; blue: number }[] = [];
let lost = 0;
for (let i = 0; i < N; i++) {
  const rng = new RNG(1200 + i * 17);
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 23), { clutchPick: i % 3 });
  let gold = 0, blue = 0;
  for (const id of g.perks ?? []) {
    const a = abilityById(id); if (!a) continue;
    got[a.name] = (got[a.name] ?? 0) + 1;
    if (a.blue) blue++; else gold++;
  }
  for (const a of ABILITIES) {
    if (g.logs.some((l) => l.title === `특수능력 획득 — ${a.name}`)) ever[a.name] = (ever[a.name] ?? 0) + 1;
  }
  per.push({ gold, blue });
  lost += g.logs.filter((l) => l.title.includes("특수능력 상실")).length;
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const q = (a: number[], x: number) => [...a].sort((m, n) => m - n)[Math.floor(a.length * x)];
console.log(`■ 은퇴 시점에 들고 있는 특수능력 (n=${N})`);
console.log(`  금특  평균 ${avg(per.map((c) => c.gold)).toFixed(1)} · 중앙 ${q(per.map((c) => c.gold), .5)} · 최대 ${Math.max(...per.map((c) => c.gold))}   (드라이런 4.9)`);
console.log(`  파란특 평균 ${avg(per.map((c) => c.blue)).toFixed(1)} · 중앙 ${q(per.map((c) => c.blue), .5)} · 최대 ${Math.max(...per.map((c) => c.blue))}   (드라이런 1.0)`);
console.log(`  하나도 없는 커리어 ${per.filter((c) => c.gold + c.blue === 0).length}건 · 커리어당 상실 ${(lost / N).toFixed(2)}회`);
console.log(`\n■ 능력별 — 획득 경험 / 은퇴 시 보유`);
for (const a of ABILITIES) {
  const e = ever[a.name] ?? 0, v = got[a.name] ?? 0;
  const gap = e > v ? `  (${Math.round((e - v) / N * 100)}%는 잃었다)` : "";
  console.log(`  ${a.blue ? "💧" : "🔥"} ${a.name.padEnd(12)} ${String(Math.round(e / N * 100)).padStart(3)}% → ${String(Math.round(v / N * 100)).padStart(3)}%  ${"█".repeat(Math.round(e / N * 22))}${gap}`);
}
console.log(`\n  커리어당 획득 경험 ${(Object.values(ever).reduce((a, b) => a + b, 0) / N).toFixed(1)}개 · 은퇴 시 보유 ${(avg(per.map((c) => c.gold + c.blue))).toFixed(1)}개`);
