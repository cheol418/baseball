/**
 * 은퇴 성적표 — **밖으로 나가는 한 장이 거짓말을 하지 않는가.**
 *
 * 이건 남에게 보여줄 화면이라 다른 곳보다 틀리면 안 된다.
 * 안에서 `undefined`가 찍히면 "선수 이름 · undefined 시즌"이 그대로 공유된다.
 *
 * 세 가지를 센다
 *   ① 빈칸 — 모든 문자열에 null/undefined/NaN이 없다 (`textcheck`와 같은 원칙)
 *   ② 숫자 — 카드의 수치가 `careerTotals`의 **1군 기록**과 글자까지 같다
 *   ③ 팀 — 가장 오래 몸담은 팀을 적는다 (마지막 소속이 아니다)
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { careerTotals, newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { cardText, shareCard, SITE } from "../src/lib/card";
import type { GameState } from "../src/lib/types";

const ARCH = [
  ["HITTER", "CF", "toolsy", "R", "R"], ["HITTER", "1B", "slugger", "L", "L"],
  ["HITTER", "C", "contact", "R", "R"], ["HITTER", "SS", "contact", "L", "R"],
  ["PITCHER", "SP", "power_p", "R", "R"], ["PITCHER", "SP", "control_p", "R", "L"],
  ["PITCHER", "CP", "power_p", "R", "R"], ["PITCHER", "RP", "control_p", "R", "L"],
] as const;
const SLOTS = ["OVER", "THREE_QUARTER", "SIDE", "UNDER"] as const;
const N = 320;

const BAD = /undefined|null|NaN|Infinity|\[object/;

let blank = 0, wrongNum = 0, wrongTeam = 0, noStats = 0, wasted = 0;
const sixth: Record<string, number> = {};
let badges = 0, nicks = 0, longest = 0;
const tiers: Record<string, number> = {};

for (let i = 0; i < N; i++) {
  const rng = new RNG(700 + i * 11);
  const [kind, pos, style, bats, throws] = ARCH[i % ARCH.length];
  const p = rollCandidate({
    name: "s", number: 1, kind, position: pos as never, bats, throws,
    styleId: style, armSlot: kind === "PITCHER" ? SLOTS[i % SLOTS.length] : undefined,
  }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 23), {
    clutchPick: i % 3, transferChance: 0.25, secondLife: i % 7,
  });

  const c = shareCard(g);
  const text = cardText(c, SITE);

  // ① 빈칸 — 카드에 실리는 모든 문자열
  const strings = [
    c.name, c.teamShort, c.position, c.tier, c.earned, c.nickname ?? "",
    ...c.stats.flatMap((x) => [x.label, x.value]), ...c.badges, text,
  ];
  if (strings.some((x) => BAD.test(x))) {
    blank++;
    if (blank <= 3) console.log("  빈칸: " + strings.find((x) => BAD.test(x)));
  }
  if (!Number.isFinite(c.score) || !Number.isFinite(c.seasons)) blank++;

  // ② 숫자 — 1군 통산과 맞는가
  const war = (kind === "HITTER"
    ? careerTotals(g.seasons, "HITTER", "KBO")
    : careerTotals(g.seasons, "PITCHER", "KBO")).war;
  const shown = Number(c.stats.find((x) => x.label === "WAR")?.value);
  if (Math.abs(shown - war) > 0.051) {
    wrongNum++;
    if (wrongNum <= 3) console.log(`  WAR 불일치: 카드 ${shown} ↔ 통산 ${war}`);
  }
  if (c.stats.length !== 6) noStats++;

  /*
   * 여섯째 칸이 **제 값을 깎지 않는가.**
   * 서른 홀드를 한 필승조에게 "세이브 0"이 찍히면 카드가 거짓으로 겸손해진다.
   */
  if (kind === "PITCHER") {
    const t = careerTotals(g.seasons, "PITCHER", "KBO") as { sv: number; hld: number };
    const cell = c.stats[3];
    sixth[cell.label] = (sixth[cell.label] ?? 0) + 1;
    const shownZero = Number(cell.value.replace(/,/g, "")) === 0;
    if (shownZero && Math.max(t.sv, t.hld) >= 30) {
      wasted++;
      if (wasted <= 3) console.log(`  빈 칸: ${cell.label} 0인데 세이브 ${t.sv} · 홀드 ${t.hld}`);
    }
  }

  // ③ 팀 — 가장 오래 있었던 곳
  const kbo = g.seasons.filter((r) => r.level === "KBO" || r.byLevel?.KBO);
  if (kbo.length) {
    const by = new Map<string, number>();
    for (const r of kbo) by.set(r.teamId, (by.get(r.teamId) ?? 0) + 1);
    const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (c.teamId !== top) {
      wrongTeam++;
      if (wrongTeam <= 3) console.log(`  팀 불일치: 카드 ${c.teamId} ↔ 최장 ${top}`);
    }
    // 연도는 1군 첫 해 ~ 마지막 해
    if (c.from > c.to) { blank++; console.log(`  연도 역전: ${c.from}–${c.to}`); }
  }

  badges += c.badges.length;
  if (c.nickname) nicks++;
  longest = Math.max(longest, ...c.badges.map((b) => b.length), c.name.length);
  tiers[c.tier] = (tiers[c.tier] ?? 0) + 1;
}

console.log(`\n■ 은퇴 성적표 ${N}장`);
console.log(`  빈칸(undefined·NaN)   ${blank}건  (0이어야 한다)`);
console.log(`  숫자 불일치           ${wrongNum}건  (0이어야 한다)`);
console.log(`  팀 불일치             ${wrongTeam}건  (0이어야 한다)`);
console.log(`  기록 칸이 6개가 아님  ${noStats}건  (0이어야 한다)`);
console.log(`  제 값을 깎는 칸       ${wasted}건  (0이어야 한다)`);
console.log("  투수 여섯째 칸 — " + Object.entries(sixth).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log(`\n  훈장 평균 ${(badges / N).toFixed(1)}개 · 별명이 붙는 카드 ${Math.round(nicks / N * 100)}%`);
console.log(`  가장 긴 글자 ${longest}자 (카드 폭이 감당할 길이인지)`);
console.log("\n  등급 분포");
for (const [k, v] of Object.entries(tiers).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(14)} ${String(v).padStart(3)}  ${(v / N * 100).toFixed(0)}%`);
}

if (blank || wrongNum || wrongTeam || noStats || wasted) process.exitCode = 1;
