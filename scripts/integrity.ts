/**
 * 기록이 자기 자신과 어긋나지 않는가.
 *
 * 화면에 보이는 "에러"는 대개 한 줄 안에서 숫자끼리 모순되는 것이다 —
 * 안타보다 많은 홈런, 등판 수보다 많은 승, 이닝 대비 맞지 않는 평균자책.
 * 커리어가 만들어내는 **모든 기록 줄**을 한 번씩 검사한다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { isHitterLine } from "../src/lib/sim";
import { autoPlay } from "./autoplay";
import type { GameState, HitterLine, PitcherLine, StatLine } from "../src/lib/types";

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;

type Check = { rule: string; where: string; detail: string };
const bad: Check[] = [];
let lines = 0;

function checkHitter(l: HitterLine, where: string) {
  const fail = (rule: string, detail: string) => bad.push({ rule, where, detail });
  if (l.ab > l.pa) fail("타수 ≤ 타석", `AB ${l.ab} > PA ${l.pa}`);
  if (l.h > l.ab) fail("안타 ≤ 타수", `H ${l.h} > AB ${l.ab}`);
  if (l.b2 + l.b3 + l.hr > l.h) fail("장타 ≤ 안타", `2B+3B+HR ${l.b2 + l.b3 + l.hr} > H ${l.h}`);
  if (l.ab + l.bb + l.hbp > l.pa) fail("타수+볼넷+사구 ≤ 타석", `${l.ab + l.bb + l.hbp} > PA ${l.pa}`);
  if (l.so > l.ab) fail("삼진 ≤ 타수", `SO ${l.so} > AB ${l.ab}`);
  if (l.rbi < l.hr) fail("타점 ≥ 홈런", `RBI ${l.rbi} < HR ${l.hr}`);
  if (l.r < l.hr) fail("득점 ≥ 홈런", `R ${l.r} < HR ${l.hr}`);
  if (l.g > 144) fail("경기 ≤ 144", `G ${l.g}`);
  if (l.pa > 0 && l.g === 0) fail("타석이 있으면 경기도 있다", `PA ${l.pa} · G 0`);
  if (l.ab > 0 && r3(l.h / l.ab) !== r3(l.avg)) fail("타율 = 안타/타수", `${l.avg} vs ${r3(l.h / l.ab)}`);
  if (l.ab > 0) {
    const tb = l.h + l.b2 + l.b3 * 2 + l.hr * 3;
    if (r3(tb / l.ab) !== r3(l.slg)) fail("장타율 = 루타/타수", `${l.slg} vs ${r3(tb / l.ab)}`);
  }
  if (l.pa > 0 && r3((l.h + l.bb + l.hbp) / l.pa) !== r3(l.obp)) {
    fail("출루율 = (안타+볼넷+사구)/타석", `${l.obp} vs ${r3((l.h + l.bb + l.hbp) / l.pa)}`);
  }
  if (r3(l.obp + l.slg) !== r3(l.ops)) fail("OPS = 출루 + 장타", `${l.ops} vs ${r3(l.obp + l.slg)}`);
}

function checkPitcher(l: PitcherLine, where: string) {
  const fail = (rule: string, detail: string) => bad.push({ rule, where, detail });
  if (l.gs > l.g) fail("선발 등판 ≤ 등판", `GS ${l.gs} > G ${l.g}`);
  if (l.w + l.l > l.g) fail("승+패 ≤ 등판", `W ${l.w} + L ${l.l} > G ${l.g}`);
  if (l.sv + l.hld > l.g) fail("세이브+홀드 ≤ 등판", `SV ${l.sv} + HLD ${l.hld} > G ${l.g}`);
  if (l.g > 0 && l.gs === l.g && l.sv > 0) fail("전 경기 선발인데 세이브", `G ${l.g} GS ${l.gs} SV ${l.sv}`);
  if (l.hrAllowed > l.h) fail("피홈런 ≤ 피안타", `HR ${l.hrAllowed} > H ${l.h}`);
  if (l.er > l.h + l.bb) fail("자책 ≤ 피안타+볼넷", `ER ${l.er} > H+BB ${l.h + l.bb}`);
  if (l.g > 0 && l.ip <= 0) fail("등판했으면 이닝이 있다", `G ${l.g} IP ${l.ip}`);
  if (l.ip > 0 && l.g === 0) fail("이닝이 있으면 등판도 있다", `IP ${l.ip} G 0`);
  if (l.g > 144) fail("등판 ≤ 144", `G ${l.g}`);
  if (l.ip > 0 && r2((l.er * 9) / l.ip) !== r2(l.era)) fail("ERA = 자책×9/이닝", `${l.era} vs ${r2((l.er * 9) / l.ip)}`);
  if (l.ip > 0 && r2((l.h + l.bb) / l.ip) !== r2(l.whip)) fail("WHIP = (피안타+볼넷)/이닝", `${l.whip} vs ${r2((l.h + l.bb) / l.ip)}`);
  if (l.ip > 0 && r2((l.so / l.ip) * 9) !== r2(l.k9)) fail("K/9 = 탈삼진×9/이닝", `${l.k9} vs ${r2((l.so / l.ip) * 9)}`);
  if (r1(l.ip) !== r1(Math.round(l.ip * 10) / 10)) fail("이닝은 소수 한 자리", `IP ${l.ip}`);
}

function check(l: StatLine | null | undefined, where: string) {
  if (!l) return;
  lines++;
  if (isHitterLine(l)) checkHitter(l, where);
  else checkPitcher(l as PitcherLine, where);
}

for (let i = 0; i < 80; i++) {
  const rng = new RNG(8800 + i * 13);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const pos = i % 2 ? "CF" : (i % 4 === 0 ? "SP" : "CP");
  const p = rollCandidate({ name: "표본", number: 1, kind, position: pos, bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  const done = autoPlay(newGame(p, "DAG", i * 31), {
    nego: (["push", "accept", "arbitration"] as const)[i % 3],
  });
  {
    const g: GameState = done;
      for (const rec of g.seasons) {
        const tag = `${rec.year} ${rec.level}`;
        check(rec.line, `${tag} 시즌`);
        check(rec.half, `${tag} 전반기`);
        check(rec.byLevel?.KBO, `${tag} 1군`);
        check(rec.byLevel?.MINOR, `${tag} 2군`);
        check(rec.allStarGame?.line, `${tag} 올스타`);
        for (const r of rec.ps?.rounds ?? []) check(r.line, `${tag} ${r.name}`);
        check(rec.ps?.line, `${tag} 가을야구`);
      }
      for (const r of g.intlResults) {
        check(r.line, `${r.year} ${r.tournamentName}`);
        for (const gm of r.games) check(gm.line, `${r.year} ${r.tournamentName} ${gm.round}`);
      }
    for (const m of g.monthLines ?? []) check(m.line, `${g.year} ${m.label}`);
  }
}

const byRule = new Map<string, Check[]>();
for (const b of bad) byRule.set(b.rule, [...(byRule.get(b.rule) ?? []), b]);
console.log(`■ 기록 ${lines.toLocaleString()}줄 검사 — 어긋난 줄 ${bad.length}건 (0이어야 한다)`);
[...byRule].sort((a, b) => b[1].length - a[1].length).forEach(([rule, list]) => {
  console.log(`  ${rule.padEnd(26)} ${String(list.length).padStart(5)}건   예: ${list[0].where} — ${list[0].detail}`);
});
