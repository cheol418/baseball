/**
 * 숫자가 있을 수 없는 값을 가지지 않는가.
 *
 * 능력치·OVR·연봉·계약은 화면 여기저기에 그대로 찍힌다.
 * 범위를 벗어나거나 서로 어긋난 값이 하나 있으면 그 화면 전체가 의심받는다.
 */
import { RNG, clamp } from "../src/lib/rng";
import { ABILITY_MAX, abilityKeys, gradeOf, overall, rollCandidate } from "../src/lib/player";
import { MAX_SALARY, MIN_SALARY, newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

type Bad = { rule: string; detail: string };
const bad: Bad[] = [];
let checked = 0;
const fail = (rule: string, detail: string) => bad.push({ rule, detail });

/** 등급 문턱 — player.ts의 gradeOf와 같은 선을 쓰는지 되짚는다 */
const gradeBar: [string, number][] = [["S", 95], ["A", 87], ["B", 79], ["C", 69], ["D", 55]];

for (let i = 0; i < 90; i++) {
  const rng = new RNG(9100 + i * 11);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "표본", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  autoPlay(newGame(p, "DAG", i * 37), {
    nego: (["push", "accept", "arbitration"] as const)[i % 3],
    onStep: (g: GameState) => {
      checked++;
      // 능력치 — 그 선수가 실제로 쓰는 항목만 본다(투수의 '컨택'은 빈칸이다)
      const keys = abilityKeys(g.player.kind) as string[];
      const abil = g.player.abilities as unknown as Record<string, number>;
      for (const [k, v] of Object.entries(abil).filter(([k2]) => keys.includes(k2))) {
        if (typeof v !== "number" || !Number.isFinite(v)) fail("능력치는 숫자다", `${k}=${v}`);
        else if (v < 1 || v > ABILITY_MAX) fail(`능력치 1~${ABILITY_MAX}`, `${g.year} ${k}=${v}`);
        else if (v !== Math.round(v)) fail("능력치는 정수다", `${g.year} ${k}=${v}`);
      }
      const ovr = overall(g.player);
      if (!Number.isFinite(ovr) || ovr < 1 || ovr > ABILITY_MAX) fail("OVR 범위", `${g.year} ${ovr}`);
      // 등급은 OVR 문턱과 같은 말을 해야 한다
      const grade = gradeOf(ovr);
      const want = gradeBar.find(([, bar]) => ovr >= bar)?.[0] ?? "E";
      if (grade !== want) fail("등급 = OVR 문턱", `${g.year} OVR ${ovr} → ${grade} (기대 ${want})`);
      // 인지도·신뢰·컨디션
      for (const [label, v] of [["인지도", g.player.fame], ["구단 신뢰", g.trust], ["컨디션", g.player.condition]] as const) {
        if (v < 0 || v > 100) fail(`${label} 0~100`, `${g.year} ${v}`);
      }
      // 연봉·계약
      const c = g.contract;
      if (c) {
        if (c.salary < MIN_SALARY || c.salary > MAX_SALARY) fail("연봉 범위", `${g.year} ${c.salary}만원`);
        if (c.salary !== Math.round(c.salary)) fail("연봉은 정수다", `${g.year} ${c.salary}`);
        if (c.remaining < 0) fail("계약 잔여 연수 ≥ 0", `${g.year} ${c.remaining}`);
        if (c.years !== undefined && c.remaining > c.years) fail("잔여 ≤ 계약 연수", `${g.year} ${c.remaining}/${c.years}`);
      }
      if (g.player.age < 17 || g.player.age > 50) fail("나이 범위", `${g.year} ${g.player.age}세`);
      if (g.serviceYears < 0) fail("서비스타임 ≥ 0", `${g.serviceYears}`);
      for (const rec of g.seasons) {
        if (rec.salary < 0 || rec.salary > MAX_SALARY) fail("시즌 기록 연봉 범위", `${rec.year} ${rec.salary}만원`);
      }
      // 통보에 적힌 값이 비어 있지 않은가
      for (const n of g.notices ?? []) {
        for (const ch of n.change ?? []) {
          if (!ch.to || ch.to === "undefined" || ch.to === "NaN" || ch.to === "null") {
            fail("통보에 빈 값", `${n.title} · ${ch.label} → "${ch.to}"`);
          }
        }
      }
    },
  });
}

console.log(`■ 상태 ${checked.toLocaleString()}회 검사 — 있을 수 없는 값 ${bad.length}건 (0이어야 한다)`);
const byRule = new Map<string, Bad[]>();
for (const b of bad) byRule.set(b.rule, [...(byRule.get(b.rule) ?? []), b]);
Array.from(byRule).sort((a, b) => b[1].length - a[1].length).forEach(([rule, list]) => {
  console.log(`  ${rule.padEnd(24)} ${String(list.length).padStart(5)}건   예: ${list[0].detail}`);
});
void clamp;
