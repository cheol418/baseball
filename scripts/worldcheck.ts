/**
 * 새로 들어온 세 시스템(동료·감독·리그)이 말이 되는가.
 * `logic.ts`가 보는 "칸 사이의 모순"과 달리, 여기서는 **세상의 상태**를 본다.
 */
import { RNG } from "../src/lib/rng";
import { overall, rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { POWER_MAX, POWER_MIN, powerOf } from "../src/lib/league";
import { competesWith, SQUAD_SIZE } from "../src/lib/squad";
import { TEAMS } from "../src/lib/teams";
import type { GameState } from "../src/lib/types";

const bad: Record<string, string[]> = {};
const add = (k: string, d: string) => { (bad[k] ??= []).push(d); };
let checks = 0;

const ARCH = [
  ["HITTER", "CF", "toolsy"], ["HITTER", "C", "defense"], ["HITTER", "DH", "slugger"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"], ["PITCHER", "RP", "control_p"],
] as const;

for (let i = 0; i < 120; i++) {
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const p = rollCandidate({ name: "나", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, new RNG(7700 + i * 13));

  autoPlay(newGame(p, "DAG", i * 29), {
    military: i % 3 === 0 ? "SANGMU" : i % 3 === 1 ? "ACTIVE" : undefined,
    transferChance: 0.4,
    onStep: (g: GameState) => {
      checks++;
      /* 리그 */
      if (g.league) {
        for (const t of TEAMS) {
          const v = powerOf(g, t.id);
          if (v < POWER_MIN - 0.1 || v > POWER_MAX + 0.1) add("전력 범위 밖", `${t.short} ${v.toFixed(1)}`);
          if (!Number.isFinite(v)) add("전력이 숫자가 아님", t.short);
        }
        const mean = TEAMS.reduce((a, t) => a + powerOf(g, t.id), 0) / TEAMS.length;
        if (Math.abs(mean - 67.8) > 1.5) add("리그 평균이 밀림", `${g.year} ${mean.toFixed(1)}`);
        if (g.league.year > g.year) add("리그가 미래를 삼", `${g.league.year} > ${g.year}`);
      }
      /* 감독 */
      const m = g.manager;
      if (m) {
        if (g.contract && m.teamId !== g.contract.teamId) add("감독이 다른 팀 소속", `${m.teamId} ≠ ${g.contract.teamId}`);
        if (m.since > g.year) add("감독이 미래에 부임", `${m.since} > ${g.year}`);
        if (m.seasons > g.year - m.since + 1) add("재임 연차가 실제보다 큼", `${m.seasons} vs ${g.year - m.since}`);
        if (m.seasons > 25) add("재임이 비정상적으로 긺", `${m.seasons}`);
      }
      /* 동료 */
      for (const s of g.squad ?? []) {
        const o = overall(s.player);
        if (s.player.age < 18 || s.player.age > 46) add("동료 나이 이상", `${s.name} ${s.player.age}세`);
        if (o < 20 || o > 120) add("동료 OVR 이상", `${s.name} ${o}`);
        if (s.name === g.player.name) add("동료가 나와 같은 이름", s.name);
        if (s.since > g.year) add("동료가 미래에 합류", `${s.name} ${s.since}`);
        if (s.kind === "PITCHER" && !["SP", "RP", "CP"].includes(s.position)) add("투수인데 야수 자리", `${s.name} ${s.position}`);
        if (s.kind === "HITTER" && ["SP", "RP", "CP"].includes(s.position)) add("야수인데 투수 자리", `${s.name} ${s.position}`);
      }
      if (g.squad?.length) {
        if (g.squad.length !== SQUAD_SIZE) add("스쿼드 인원이 다름", `${g.squad.length}명`);
        const names = new Set(g.squad.map((x) => x.name));
        if (names.size !== g.squad.length) add("동료 이름이 겹침", `${g.squad.length - names.size}건`);
        const ids = new Set(g.squad.map((x) => x.id));
        if (ids.size !== g.squad.length) add("동료 id가 겹침", `${g.squad.length - ids.size}건`);
        // 내 자리를 보는 사람이 **같은 구분**이어야 한다
        const me = { kind: g.player.kind, position: g.player.position };
        for (const s of g.squad) if (competesWith(me, s) && s.kind !== g.player.kind) add("구분이 다른데 경쟁자", s.name);
      }
      /* 은퇴 뒤에는 팀이 없다 */
      if (g.phase === "RETIRED" && g.contract) add("은퇴했는데 계약이 남음", `${g.year}`);
    },
  });
}
const total = Object.values(bad).reduce((a, b) => a + b.length, 0);
console.log(`■ 세상의 상태 ${checks.toLocaleString()}회 검사 — 이상 ${total}건 (0이어야 한다)`);
for (const [k, v] of Object.entries(bad).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  · ${k} ${v.length}건  예: ${[...new Set(v)].slice(0, 3).join(" | ")}`);
}

/* 자리 이름과 실제가 맞는가 — "스물여섯 베테랑" 같은 것 */
import { mateLabel, SLOT_LABEL } from "../src/lib/squad";
const slotBad: string[] = [];
let slotN = 0;
for (let i = 0; i < 70; i++) {
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const p2 = rollCandidate({ name: "나", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, new RNG(5400 + i * 11));
  autoPlay(newGame(p2, "DAG", i * 31), {
    onStep: (g: GameState) => {
      for (const m of g.squad ?? []) {
        slotN++;
        const lb = mateLabel(m);
        if (lb === "veteran" && m.player.age < 30) slotBad.push(`${SLOT_LABEL[lb]} ${m.player.age}세`);
        if (lb === "rookie" && m.player.age > 26) slotBad.push(`${SLOT_LABEL[lb]} ${m.player.age}세`);
      }
    },
  });
}
console.log(`\n■ 자리 이름 ↔ 나이 ${slotN.toLocaleString()}건 — 어긋남 ${slotBad.length}건`);
if (slotBad.length) console.log(`  예: ${[...new Set(slotBad)].slice(0, 5).join(" | ")}`);
