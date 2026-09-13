/** 시즌 총 경기 수가 리그 경기 수(144)와 맞는지 확인 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { isHitterLine } from "../src/lib/sim";
import { ROLE_PT } from "../src/lib/sim";
import type { PitcherLine } from "../src/lib/types";

for (const [label, kind, pos, style] of [
  ["타자", "HITTER", "CF", "toolsy"],
  ["선발투수", "PITCHER", "SP", "power_p"],
  ["마무리", "PITCHER", "CP", "power_p"],
] as [string, "HITTER" | "PITCHER", string, string][]) {
  const rows: { role: string; g: number; exp: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(8000 + i * 23);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));
    for (const s of g.seasons) {
      if (s.level !== "KBO") continue;
      const full = kind === "HITTER" ? 144 : pos === "SP" ? 29 : pos === "CP" ? 58 : 64;
      rows.push({ role: s.role, g: s.line.g, exp: Math.round(full * (ROLE_PT[s.role] ?? 1)) });
    }
  }
  // 부상 없는(만기 출장) 시즌만 본다 — 최대치가 기대값과 같아야 한다
  const byRole: Record<string, number[]> = {};
  for (const r of rows) (byRole[r.role] = byRole[r.role] ?? []).push(r.g);
  console.log(`\n■ ${label}`);
  for (const [role, gs] of Object.entries(byRole)) {
    const full = kind === "HITTER" ? 144 : pos === "SP" ? 29 : pos === "CP" ? 58 : 64;
    const exp = Math.round(full * (ROLE_PT[role] ?? 1));
    const max = Math.max(...gs);
    console.log(`    ${role.padEnd(6)} n=${String(gs.length).padStart(3)}  최대 ${String(max).padStart(3)}경기  기대 ${String(exp).padStart(3)}경기  ${max === exp ? "✅" : `❌ ${max - exp > 0 ? "+" : ""}${max - exp}`}`);
  }
}
