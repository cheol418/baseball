/**
 * 도감 — 실제 커리어에서 칸이 채워지는가.
 *
 * `earnedFrom`은 세이브에 남은 **문자열을 맞춰** 칸을 찾는다
 * (대기록 "통산 300홈런 달성", 수상 "홈런왕"). 타입체커는 문자열이
 * 어긋난 걸 못 잡으므로, 한 칸도 안 채워지는 분류가 있는지 직접 센다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { ALL_ENTRIES, SECTIONS, earnedFrom } from "../src/lib/codex";
import type { GameState } from "../src/lib/types";

/*
 * 자리·투구폼·좌우를 **넓게 섞는다.**
 * 좁게 돌리면 '잠수함'·'좌완 파이어볼러' 같은 칸이 안 채워지는데,
 * 그게 못 채우는 칸인지 안 가본 칸인지 구별이 안 된다.
 */
const ARCH = [
  ["HITTER", "CF", "toolsy", "R", "R"], ["HITTER", "1B", "slugger", "L", "L"],
  ["HITTER", "C", "contact", "R", "R"], ["HITTER", "SS", "contact", "L", "R"],
  ["PITCHER", "SP", "power_p", "R", "R"], ["PITCHER", "SP", "control_p", "R", "L"],
  ["PITCHER", "CP", "power_p", "R", "R"], ["PITCHER", "RP", "control_p", "R", "L"],
] as const;
const SLOTS = ["OVER", "THREE_QUARTER", "SIDE", "UNDER"] as const;
const N = 480;

const seen = new Set<string>();
const perCareer: number[] = [];
for (let i = 0; i < N; i++) {
  const rng = new RNG(300 + i * 13);
  const [kind, pos, style, bats, throws] = ARCH[i % ARCH.length];
  const p = rollCandidate({
    name: "s", number: 1, kind, position: pos as never, bats, throws,
    styleId: style, armSlot: kind === "PITCHER" ? SLOTS[i % SLOTS.length] : undefined,
  }, rng);
  const g: GameState = autoPlay(newGame(p, "DAG", i * 19), {
    clutchPick: i % 3, transferChance: 0.25, secondLife: i % 7,
  });
  const got = earnedFrom(g);
  got.forEach((x) => seen.add(x));
  perCareer.push(got.length);
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`■ 커리어 ${N}개로 도감 ${seen.size} / ${ALL_ENTRIES.length}칸을 채웠다`);
console.log(`  한 커리어가 채우는 칸 — 평균 ${avg(perCareer).toFixed(1)} · 최대 ${Math.max(...perCareer)} · 최소 ${Math.min(...perCareer)}`);

let dead = 0;
for (const s of SECTIONS) {
  const n = s.entries.filter((e) => seen.has(e.id)).length;
  const miss = s.entries.filter((e) => !seen.has(e.id));
  console.log(`\n  ${s.title.padEnd(8)} ${n} / ${s.entries.length}`);
  if (n === 0) { dead++; console.log("    ⚠ 한 칸도 안 채워졌다 — 문자열이 어긋났을 수 있다"); }
  if (miss.length) console.log("    아직: " + miss.map((e) => e.name).join(" · ").slice(0, 150));
}
console.log(`\n■ 한 칸도 안 채워진 분류 ${dead}개 (0이어야 한다 — 자동 플레이로 못 닿는 칸은 따로 봐야 한다)`);
if (dead) process.exitCode = 1;
