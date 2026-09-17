/**
 * 승부처 장면이 **그 달의 자리**를 말하는가.
 *
 * 승부처는 반기가 시작될 때 걸어두는데, 그 사이 콜업·말소·보직 변경이 일어난다.
 * 8월에 1군으로 올라간 선수에게 10월 "퓨처스 올스타 선발 · 2군의 간판"이 뜨면,
 * 그 달 기록은 1군인데 장면만 2군에 남아 있는 꼴이 된다.
 *
 * 장면이 어느 주머니에서 나왔는지는 소스에서 직접 읽는다 — 키워드로 짐작하면
 * "부상 복귀 첫 등판(1군)"의 본문에 '재활'이 들어가 오탐이 난다.
 */
import * as fs from "fs";
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { isRotationRole } from "../src/lib/roles";
import { sceneContext } from "../src/lib/clutch";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

/** eyebrow → 어느 주머니의 장면인가 */
function sceneOrigin(): Map<string, string> {
  const src = fs.readFileSync("src/lib/clutch.ts", "utf8");
  const map = new Map<string, string>();
  for (const name of ["HIT_SCENES", "PIT_SCENES_SP", "PIT_SCENES_RP", "MINOR_SCENES", "MINOR_SCENES_P"]) {
    const m = new RegExp(`const ${name}: Scene\\[\\] = \\[([\\s\\S]*?)\\n\\];`).exec(src);
    if (!m) throw new Error(`장면 주머니를 못 찾았다: ${name}`);
    for (const line of m[1].matchAll(/\{ eyebrow: "([^"]+)"/g)) map.set(line[1], name);
  }
  return map;
}
const ORIGIN = sceneOrigin();

type Row = {
  level: string; role: string; eyebrow: string; from: string; month: string;
  hasKbo: boolean; hasFormerTeam: boolean; injured: boolean;
};
const rows: Row[] = [];

for (let i = 0; i < 120; i++) {
  const rng = new RNG(6200 + i * 17);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "표본", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seen = new Set<string>();
  autoPlay(newGame(p, "DAG", i * 23), {
    onStep: (g: GameState) => {
      for (const m of g.monthLines ?? []) {
        if (!m.clutchSituation) continue;
        const key = `${g.year}${m.label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const from = ORIGIN.get(m.clutchSituation.eyebrow);
        const ctx = sceneContext(g);
        if (from) {
          rows.push({
            level: m.level, role: m.role, eyebrow: m.clutchSituation.eyebrow, from, month: m.label,
            ...ctx,
          });
        }
      }
    },
  });
}

const wantMinor = (r: Row) => r.level === "MINOR";
const isMinor = (r: Row) => r.from.startsWith("MINOR");
const levelBad = rows.filter((r) => wantMinor(r) !== isMinor(r));

const pitching = rows.filter((r) => r.from === "PIT_SCENES_SP" || r.from === "PIT_SCENES_RP");
const roleBad = pitching.filter((r) => isRotationRole(r.role) !== (r.from === "PIT_SCENES_SP"));

console.log(`■ 월별 승부처 ${rows.length}건`);
console.log(`  1군 ${rows.filter((r) => r.level === "KBO").length} · 2군 ${rows.filter((r) => r.level === "MINOR").length}`);
console.log(`■ 1군/2군이 어긋난 장면 ${levelBad.length}건 (0이어야 한다)`);
levelBad.slice(0, 6).forEach((r) => console.log(`  [${r.level === "KBO" ? "1군" : "2군"} ${r.role}] "${r.eyebrow}" ← ${r.from}`));
console.log(`■ 선발/불펜이 어긋난 장면 ${roleBad.length}건 / 투수 ${pitching.length}건 (0이어야 한다)`);
roleBad.slice(0, 6).forEach((r) => console.log(`  [${r.role}] "${r.eyebrow}" ← ${r.from}`));

/**
 * 없던 과거를 만들어내는 장면.
 * 1군에 올라간 적 없는 신인의 "강등 첫 경기", 한 팀에서만 뛴 선수의 "친정팀 상대",
 * 다친 적 없는 해의 "재활 마지막 날" — 그리고 9월에 뜨는 "개막전".
 */
const HISTORY: { mark: string; ok: (r: Row) => boolean; why: string }[] = [
  { mark: "강등 첫", ok: (r) => r.hasKbo, why: "1군 경험이 없다" },
  { mark: "친정팀", ok: (r) => r.hasFormerTeam, why: "한 팀에서만 뛰었다" },
  { mark: "재활", ok: (r) => r.injured, why: "올해 다친 적이 없다" },
  { mark: "부상 복귀", ok: (r) => r.injured, why: "올해 다친 적이 없다" },
  { mark: "개막전", ok: (r) => r.month === "4월", why: "개막 달이 아니다" },
  { mark: "최종전", ok: (r) => r.month === "10월", why: "마지막 달이 아니다" },
  { mark: "20승 도전", ok: (r) => r.month === "10월", why: "마지막 달이 아니다" },
  { mark: "40세이브 도전", ok: (r) => r.month === "10월", why: "마지막 달이 아니다" },
];
const histBad = rows.filter((r) => HISTORY.some((h) => r.eyebrow.includes(h.mark) && !h.ok(r)));
console.log(`■ 없던 과거를 만들어낸 장면 ${histBad.length}건 (0이어야 한다)`);
histBad.slice(0, 6).forEach((r) => {
  const h = HISTORY.find((x) => r.eyebrow.includes(x.mark) && !x.ok(r))!;
  console.log(`  [${r.month}] "${r.eyebrow}" — ${h.why}`);
});

// 조건을 붙인 장면이 **아예 안 나오게** 되진 않았는지 — 걸러내다 지워버리면 모른다
console.log("■ 조건이 붙은 장면이 실제로 나오는가");
for (const mark of ["개막전", "최종전", "20승 도전", "40세이브 도전", "강등 첫", "친정팀", "재활", "부상 복귀"]) {
  const hit = rows.filter((r) => r.eyebrow.includes(mark));
  const months = [...new Set(hit.map((r) => r.month))].sort().join(",");
  console.log(`  ${mark.padEnd(8)} ${String(hit.length).padStart(4)}건${hit.length ? ` · ${months}` : " ← 한 번도 안 나온다"}`);
}
