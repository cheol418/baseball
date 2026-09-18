/**
 * 연봉 협상 통보가 말이 되는가.
 *
 * "구단이 5억원까지 깎으려 했지만 5억원으로 막았습니다" — 같은 숫자가 두 번 나온다.
 * 제시액을 그대로 받는 '수용'은 막아낸 게 없는데 "막았습니다" 가지에 걸려 있었다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

type Row = { title: string; body: string; from: string; to: string };
const rows: Row[] = [];

for (let i = 0; i < 160; i++) {
  const rng = new RNG(3300 + i * 7);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const p = rollCandidate({ name: "표본", number: 1, kind, position: i % 2 ? "CF" : "SP", bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const seen = new Set<string>();
  // 협상 선택지를 돌려가며 본다 — '수용'만 타는 가지가 있어 push만으로는 안 잡힌다
  autoPlay(newGame(p, "DAG", i * 29), {
    nego: (["push", "accept", "arbitration"] as const)[i % 3],
    onStep: (g: GameState) => {
      for (const n of g.notices ?? []) {
        if (n.eyebrow !== "Contract" || seen.has(n.id)) continue;
        seen.add(n.id);
        const pay = n.change?.find((c) => c.label === "연봉");
        rows.push({ title: n.title, body: n.body, from: pay?.from ?? "", to: pay?.to ?? "" });
      }
    },
  });
}

/** 본문에 같은 금액이 두 번 나오면 문장이 자기 말을 지운다 */
const money = (t: string) => t.match(/[\d.,]+(?:억|만)원/g) ?? [];
const dup = rows.filter((r) => {
  const m = money(r.body);
  return m.length >= 2 && new Set(m).size < m.length;
});
/** 삭감인데 "막았다 / 올랐다"고 말하는 것 */
const cutRows = rows.filter((r) => r.from && r.to && parseAmount(r.to) < parseAmount(r.from));
const cutLies = cutRows.filter((r) => r.body.includes("막았습니다") && !r.body.includes("까지 깎으려"));

function parseAmount(t: string): number {
  const m = /([\d.,]+)(억|만)원/.exec(t);
  if (!m) return 0;
  const v = parseFloat(m[1].replace(/,/g, ""));
  return m[2] === "억" ? v * 10000 : v;
}

console.log(`■ 연봉 협상 통보 ${rows.length}건 (삭감 ${cutRows.length}건)`);
const byTitle = new Map<string, number>();
for (const r of rows) byTitle.set(r.title, (byTitle.get(r.title) ?? 0) + 1);
[...byTitle].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${t.padEnd(22)} ${n}`));
console.log(`■ 같은 금액이 두 번 나온 문장 ${dup.length}건 (0이어야 한다)`);
dup.slice(0, 5).forEach((r) => console.log(`  [${r.title}] ${r.body}`));
console.log(`■ 삭감인데 근거 없이 "막았다"고 한 문장 ${cutLies.length}건 (0이어야 한다)`);
cutLies.slice(0, 5).forEach((r) => console.log(`  [${r.title}] ${r.body}`));
