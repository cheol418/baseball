/**
 * OVR이 오르는데 보직이 안 따라오는 구간이 있는가.
 *
 * 실제로 플레이해보니 22~25세에 OVR 67→73으로 오르는 동안 보직은
 * 백업·준주전에 머물렀다. 타석이 적으니 성적이 안 나오고, 성적이 안 나오니
 * 보직도 안 오른다 — 성장 곡선과 무관한 정체 구간일 수 있다.
 */
import { RNG } from "../src/lib/rng";
import { overall, rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { roleTier } from "../src/lib/roles";
import { autoPlay } from "./autoplay";
import type { GameState, HitterLine } from "../src/lib/types";

type Row = { ovr: number; role: string; tier: number; pa: number; war: number; age: number };
const rows: Row[] = [];

for (let i = 0; i < 80; i++) {
  const rng = new RNG(3800 + i * 17);
  const p = rollCandidate({ name: "표본", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "gap" }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 67));
  let prevOvr = 0;
  for (const rec of g.seasons) {
    if (rec.level !== "KBO") continue;
    // 시즌 시작 시점의 기량으로 보직이 정해지므로 직전 시즌 뒤의 OVR로 본다
    const l = rec.line as HitterLine;
    rows.push({ ovr: prevOvr || overall(g.player), role: rec.role, tier: roleTier(rec.role), pa: l.pa, war: rec.line.war, age: rec.age });
    prevOvr = 0;
  }
}

console.log("■ 1군 시즌의 OVR대별 보직·출장 (타자)");
console.log("  OVR대     시즌   주전 이상   최빈 보직        타석   WAR");
for (const [lo, hi] of [[60, 66], [67, 70], [71, 73], [74, 76], [77, 79], [80, 84], [85, 99]]) {
  const sub = rows.filter((r) => r.ovr >= lo && r.ovr <= hi);
  if (sub.length < 5) continue;
  const starter = sub.filter((r) => r.tier >= 4).length / sub.length;
  const roles = new Map<string, number>();
  for (const r of sub) roles.set(r.role, (roles.get(r.role) ?? 0) + 1);
  const top = [...roles].sort((a, b) => b[1] - a[1])[0];
  const avg = (f: (r: Row) => number) => sub.reduce((a, r) => a + f(r), 0) / sub.length;
  console.log(
    `  ${lo}~${hi}  ${String(sub.length).padStart(6)}  ${(starter * 100).toFixed(0).padStart(8)}%`
    + `  ${(top[0] + ` ${Math.round((top[1] / sub.length) * 100)}%`).padEnd(14)}`
    + `  ${avg((r) => r.pa).toFixed(0).padStart(5)}  ${avg((r) => r.war).toFixed(1).padStart(5)}`,
  );
}
