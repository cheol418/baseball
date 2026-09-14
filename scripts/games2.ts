/** 입지별 출전 경기 — 간판타자는 전 경기도 나갈 수 있어야 한다 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { HitterLine } from "../src/lib/types";

const byRole = new Map<string, number[]>();
const healthy = new Map<string, number[]>();
for (const style of ["slugger", "toolsy", "contact"]) {
  for (let i = 0; i < 70; i++) {
    const rng = new RNG(61000 + i * 23);
    const p = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", i * 43), {});
    for (const s of g.seasons) {
      if (s.level !== "KBO" || s.byLevel) continue;
      const gm = (s.line as HitterLine).g;
      (byRole.get(s.role) ?? byRole.set(s.role, []).get(s.role)!).push(gm);
      // 부상 기록이 없는 시즌 = 온전히 뛴 해
      if (!s.note) (healthy.get(s.role) ?? healthy.set(s.role, []).get(s.role)!).push(gm);
    }
  }
}
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log("■ 입지별 출전 경기 (1군 전체 시즌 · 144경기)");
for (const r of ["간판타자", "핵심타자", "주전", "준주전", "백업"]) {
  const a = byRole.get(r) ?? [];
  if (a.length < 5) continue;
  const h = healthy.get(r) ?? [];
  const max = Math.max(...a);
  console.log(`  ${r.padEnd(5)} n=${String(a.length).padStart(4)} · 평균 ${avg(a).toFixed(0)}경기 · 최대 ${max}`
    + (h.length ? ` · 부상 없던 해 ${avg(h).toFixed(0)}경기` : ""));
}
console.log("  실제 KBO 주전: 130~140 · 전 경기 출장은 시즌당 1~3명 나온다.");
