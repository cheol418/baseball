/** 신규 시스템 발생률 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, scoutedOverall, potentialOverall } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

const runs: GameState[] = [];
for (let i = 0; i < 40; i++) {
  const rng = new RNG(9100 + i * 173);
  const p = rollCandidate(
    { name: "x", number: 1, kind: i % 2 ? "HITTER" : "PITCHER",
      position: (i % 2 ? "CF" : "SP") as never, bats: "R", throws: "R",
      styleId: i % 2 ? "toolsy" : "power_p",
      armSlot: i % 2 ? undefined : "THREE_QUARTER" }, rng,
  );
  runs.push(autoPlay(newGame(p, "DAJ", rng.int(1, 2 ** 30)), { transferChance: 0.2 }));
}
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
const pct = (n: number) => `${Math.round((n / runs.length) * 100)}%`;

console.log("■ 신규 시스템 (n=40 커리어)\n");
const chains = runs.map((g) => g.seenEvents.length + g.logs.filter((l) => l.title.includes("체인") || l.title.includes("적응") || l.title.includes("복귀") || l.title.includes("개조")).length);
console.log(`  이벤트 체인 경험      ${pct(runs.filter((g) => g.seenEvents.length > 0).length)}  (커리어당 ${avg(runs.map((g) => g.seenEvents.length))}종)`);
console.log(`  포지션 전환 발생      ${pct(runs.filter((g) => g.logs.some((l) => l.title.includes("전환"))).length)}`);
console.log(`  재활 계획 선택        ${pct(runs.filter((g) => g.logs.some((l) => l.title.includes("복귀") || l.title.includes("회복 우선"))).length)}`);
console.log(`  구단 목표 달성률      ${avg(runs.map((g) => {
  const withGoal = g.seasons.filter((s) => s.goal);
  return withGoal.length ? (withGoal.filter((s) => s.goal!.met).length / withGoal.length) * 100 : 0;
}))}%`);
console.log(`  대기록(경기)          커리어당 ${avg(runs.map((g) => g.seasons.reduce((a, s) => a + (s.feats?.length ?? 0), 0)))}회`);
console.log(`  통산 이정표           커리어당 ${avg(runs.map((g) => g.seasons.reduce((a, s) => a + (s.milestones?.length ?? 0), 0)))}회`);
void chains;

console.log("\n■ 스카우팅 불확실성 (실제 잠재 OVR 대비)\n");
console.log("  프로연차   추정 범위 폭   실제값 포함률");
for (const yrs of [0, 2, 4, 6, 8]) {
  let width = 0, inside = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    const rng = new RNG(700 + i * 53);
    const p = rollCandidate({ name: "x", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng);
    const sc = scoutedOverall(p, yrs, 12345 + i);
    const real = potentialOverall(p);
    width += sc.hi - sc.lo;
    if (real >= sc.lo - 1 && real <= sc.hi + 1) inside++;
    n++;
  }
  console.log(`  ${String(yrs).padStart(6)}년  ${(width / n).toFixed(1).padStart(11)}  ${((inside / n) * 100).toFixed(0).padStart(12)}%`);
}

const sample = runs.find((g) => g.seasons.some((s) => (s.milestones?.length ?? 0) > 0)) ?? runs[0];
console.log(`\n■ 표본 — ${sample.player.name}`);
for (const l of sample.logs.filter((x) => ["대기록", "구단 목표 달성", "포지션 전환", "첫 콜업 체인 정착", "개조 성공"].some((k) => x.title.includes(k))).slice(0, 8)) {
  console.log(`  ${l.year} ${l.icon} ${l.title} — ${l.body}`);
}

// ── 추가 시스템 ──────────────────────────────────────────────
import { allTimeRanks, nickname } from "../src/lib/records";
import { teamById } from "../src/lib/teams";
console.log("\n■ 추가 시스템\n");
console.log(`  별명 획득          ${pct(runs.filter((g) => nickname(g)).length)}`);
const nicks = runs.map((g) => nickname(g)).filter(Boolean) as string[];
console.log(`  별명 종류          ${[...new Set(nicks)].join(", ") || "없음"}`);
console.log(`  역대 10걸 진입     ${pct(runs.filter((g) => allTimeRanks(g.seasons, g.player.kind).length > 0).length)}  (평균 ${avg(runs.map((g) => allTimeRanks(g.seasons, g.player.kind).length))}개 부문)`);
console.log(`  트레이드 제안 경험 ${pct(runs.filter((g) => g.logs.some((l) => l.title === "트레이드 제안")).length)}  (커리어당 ${avg(runs.map((g) => g.logs.filter((l) => l.title === "트레이드 제안").length))}회)`);
console.log(`  트레이드 성사      ${pct(runs.filter((g) => g.logs.some((l) => l.title === "트레이드 성사")).length)}`);
console.log(`  영구결번/은퇴식    ${pct(runs.filter((g) => g.logs.some((l) => l.title.includes("영구결번") || l.title.includes("은퇴식"))).length)}`);
const top = runs.map((g) => ({ g, r: allTimeRanks(g.seasons, g.player.kind) })).filter((x) => x.r.length).sort((a, b) => a.r[0].rank - b.r[0].rank)[0];
if (top) {
  console.log(`\n  최고 커리어 — ${top.g.player.name} (${nickname(top.g) ?? "별명 없음"}) · ${teamById(top.g.seasons.filter((s)=>s.level==="KBO").slice(-1)[0]?.teamId ?? "SEO").short}`);
  for (const r of top.r.slice(0, 4)) console.log(`    통산 ${r.label} ${r.value.toLocaleString()} — 역대 ${r.rank}위`);
}
