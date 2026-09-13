/** 밸런스 확인용 콘솔 시뮬레이션 (게임 번들에는 포함되지 않음) */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, potentialOverall } from "../src/lib/player";
import { computeHof, careerTotals, formatMoney } from "../src/lib/career";
import { autoPlay as play } from "./autoplay";
import { newGame } from "../src/lib/career";
import { teamById } from "../src/lib/teams";

function autoPlay(seed: number, kind: "HITTER" | "PITCHER", styleId: string, pos: string) {
  const rng = new RNG(seed);
  const p = rollCandidate(
    { name: "테스트", number: 7, kind, position: pos as never, bats: "R", throws: "R", styleId },
    rng,
  );
  let peak = overall(p);
  const byAge: Record<number, number> = {};
  const g0 = newGame(p, "DAJ", rng.int(1, 2 ** 30));
  const g = play(g0, {
    onStep: (cur) => {
      peak = Math.max(peak, overall(cur.player));
      byAge[cur.player.age] = overall(cur.player);
    },
  });
  return { g, peak, byAge, startOvr: overall(p), startPot: potentialOverall(p) };
}

const configs = [
  { kind: "HITTER" as const, styleId: "slugger", pos: "1B", label: "거포 1루수" },
  { kind: "HITTER" as const, styleId: "contact", pos: "2B", label: "교타자 2루수" },
  { kind: "HITTER" as const, styleId: "toolsy", pos: "CF", label: "호타준족 중견수" },
  { kind: "PITCHER" as const, styleId: "power_p", pos: "SP", label: "파워피처 선발" },
  { kind: "PITCHER" as const, styleId: "control_p", pos: "SP", label: "제구형 선발" },
  { kind: "PITCHER" as const, styleId: "power_p", pos: "CP", label: "파워피처 마무리" },
];

for (const c of configs) {
  const runs = Array.from({ length: 40 }, (_, i) => autoPlay(1000 + i * 37, c.kind, c.styleId, c.pos));
  const hofs = runs.map((r) => computeHof(r.g));
  const kboSeasons = hofs.map((h) => h.seasons);
  const wars = hofs.map((h) => h.war);
  const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const tiers = hofs.reduce<Record<string, number>>((a, h) => ({ ...a, [h.tier]: (a[h.tier] ?? 0) + 1 }), {});
  console.log(`\n=== ${c.label} (n=40) ===`);
  console.log(`1군 시즌 평균 ${avg(kboSeasons)} (중앙 ${med(kboSeasons)}), 통산 WAR 평균 ${avg(wars)} (중앙 ${med(wars)})`);
  console.log(`은퇴 나이 평균 ${avg(runs.map((r) => r.g.player.age))}, 미지명 ${runs.filter((r) => r.g.draftPick?.overall === 0).length}명`);
  console.log("등급 분포:", tiers);

  // 대표 커리어 1개 상세
  const best = runs.reduce((a, b) => (computeHof(a.g).score > computeHof(b.g).score ? a : b));
  const t = careerTotals(best.g.seasons, c.kind, "KBO") as Record<string, number>;
  const h = computeHof(best.g);
  console.log(`  OVR 최고치 평균 ${avg(runs.map((r) => r.peak))} / 데뷔 평균 ${avg(runs.map((r) => r.startOvr))}`);
  const curve: string[] = [];
  for (let age = 19; age <= 39; age++) {
    const vals = runs.map((r) => r.byAge[age]).filter((v): v is number => v !== undefined);
    if (vals.length >= 5) curve.push(`${age}:${avg(vals)}`);
  }
  console.log(`  나이별 평균 OVR — ${curve.join("  ")}`);
  console.log(`  최고 커리어: OVR ${best.startOvr}→피크 ${best.peak}→은퇴 ${overall(best.g.player)} (잠재 ${best.startPot}), ${h.tier} ${h.score}점`);
  if (c.kind === "HITTER")
    console.log(`  통산: ${t.g}G ${t.h}안타 ${t.hr}홈런 ${t.rbi}타점 타율 ${t.avg.toFixed(3)} OPS ${t.ops.toFixed(3)} WAR ${t.war}`);
  else
    console.log(`  통산: ${t.g}G ${t.ip}이닝 ${t.w}승 ${t.l}패 ${t.sv}세이브 ERA ${t.era.toFixed(2)} ${t.so}K WAR ${t.war}`);
  const lastSalary = best.g.seasons.filter((s) => s.level === "KBO").map((s) => s.salary);
  console.log(`  최고 연봉: ${formatMoney(Math.max(0, ...lastSalary))} · 최종 소속 ${best.g.contract ? teamById(best.g.contract.teamId).name : "-"}`);
}
