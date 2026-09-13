import { RNG } from "./rng";
import { isHitterLine } from "./sim";
import type { GameState, Kind, SeasonGoal, SeasonRecord, StatLine, PitcherLine, HitterLine } from "./types";

/* ------------------------------------------------------------------ */
/* 구단 시즌 목표                                                       */
/* ------------------------------------------------------------------ */

/** 보직과 기량에 맞춰 구단이 요구하는 것 */
export function makeSeasonGoal(s: GameState, rng: RNG): SeasonGoal | null {
  const level = s.seasonLevel;
  const role = s.seasonRole ?? "";
  if (!level || level === "ARMY") return null;

  if (level === "MINOR") {
    return {
      id: "callup", label: "1군 진입",
      desc: "시즌의 절반 이상을 1군 엔트리에서 보낸다.",
      reward: 10, penalty: -4,
    };
  }
  if (s.player.kind === "HITTER") {
    const starter = ["주전", "준주전"].includes(role);
    if (!starter) {
      return { id: "hold", label: "1군 잔류", desc: "시즌의 70% 이상을 1군에서 버틴다.", reward: 8, penalty: -5 };
    }
    return rng.pick<SeasonGoal>([
      { id: "war3", label: "WAR 3.0", desc: "팀에 3승 이상을 보탠다.", reward: 10, penalty: -7 },
      { id: "avg290", label: "타율 .290", desc: "규정타석을 채우고 타율 .290 이상.", reward: 10, penalty: -7 },
      { id: "hr20", label: "20홈런", desc: "한 시즌 20홈런을 넘긴다.", reward: 11, penalty: -6 },
      { id: "ops820", label: "OPS .820", desc: "출루와 장타를 함께 끌어올린다.", reward: 10, penalty: -7 },
    ]);
  }
  const isSP = role.includes("선발");
  if (isSP) {
    return rng.pick<SeasonGoal>([
      { id: "ip140", label: "140이닝", desc: "로테이션을 끝까지 지킨다.", reward: 10, penalty: -7 },
      { id: "era400", label: "평균자책 4.00", desc: "100이닝 이상에서 평균자책 4.00 이하.", reward: 11, penalty: -7 },
      { id: "w12", label: "12승", desc: "두 자릿수를 넘어 12승을 채운다.", reward: 11, penalty: -6 },
    ]);
  }
  return rng.pick<SeasonGoal>([
    { id: "app50", label: "50경기 등판", desc: "불펜의 기둥으로 한 시즌을 버틴다.", reward: 9, penalty: -6 },
    { id: "era350", label: "평균자책 3.50", desc: "40경기 이상에서 평균자책 3.50 이하.", reward: 11, penalty: -7 },
  ]);
}

export function judgeSeasonGoal(goal: SeasonGoal, line: StatLine, kboShare: number): boolean {
  const h = line as HitterLine;
  const p = line as PitcherLine;
  switch (goal.id) {
    case "callup": return kboShare >= 0.5;
    case "hold": return kboShare >= 0.7;
    case "war3": return line.war >= 3;
    case "avg290": return h.pa >= 400 && h.avg >= 0.29;
    case "hr20": return h.hr >= 20;
    case "ops820": return h.pa >= 400 && h.ops >= 0.82;
    case "ip140": return p.ip >= 140;
    case "era400": return p.ip >= 100 && p.era <= 4.0;
    case "w12": return p.w >= 12;
    case "app50": return p.g >= 50;
    case "era350": return p.g >= 40 && p.era <= 3.5;
    default: return false;
  }
}

/* ------------------------------------------------------------------ */
/* 한 경기 대기록                                                       */
/* ------------------------------------------------------------------ */

/** 시즌 성적을 근거로 그 해 나온 대기록을 판정한다 */
export function rollFeats(line: StatLine, level: string, rng: RNG): string[] {
  if (level !== "KBO") return [];
  const out: string[] = [];

  if (isHitterLine(line)) {
    if (line.pa < 300) return out;
    // 사이클링히트 — 장타력과 주력이 함께 있어야 나온다
    const cycleP = (line.b3 * 0.006) + (line.b2 * 0.0008) + (line.hr * 0.0004);
    if (rng.chance(Math.min(0.12, cycleP * 1.3))) out.push("사이클링 히트");
    // 한 경기 4홈런
    if (line.hr >= 25 && rng.chance(Math.min(0.05, (line.hr - 24) * 0.004))) out.push("한 경기 4홈런");
    // 연속 경기 안타
    if (line.avg >= 0.31 && rng.chance(0.17)) out.push(`${rng.int(22, 34)}경기 연속 안타`);
    return out;
  }

  const p = line as PitcherLine;
  if (p.gs >= 15) {
    const dominance = Math.max(0, (4.2 - p.era)) * 0.02 + Math.max(0, p.k9 - 7) * 0.004;
    if (rng.chance(Math.min(0.085, dominance * 1.3))) {
      out.push(rng.chance(0.15) ? "퍼펙트 게임" : "노히트 노런");
    }
    if (p.era <= 3.4 && rng.chance(0.2)) out.push("완봉승");
    if (p.k9 >= 9.2 && rng.chance(0.14)) out.push(`한 경기 ${rng.int(15, 18)}탈삼진`);
  }
  if (p.sv >= 30 && rng.chance(0.1)) out.push(`${rng.int(18, 28)}연속 세이브 성공`);
  return out;
}

/* ------------------------------------------------------------------ */
/* 통산 이정표                                                          */
/* ------------------------------------------------------------------ */

const HIT_MARKS: [string, number[]][] = [
  ["안타", [500, 1000, 1500, 2000, 2500, 3000]],
  ["홈런", [100, 200, 300, 400, 500, 600]],
  ["타점", [500, 1000, 1500, 2000]],
  ["도루", [100, 200, 300, 400]],
];
const PIT_MARKS: [string, number[]][] = [
  ["승", [50, 100, 150, 200, 250]],
  ["탈삼진", [500, 1000, 1500, 2000, 2500]],
  ["세이브", [100, 200, 300, 400]],
  ["홀드", [100, 150, 200]],
  ["이닝", [1000, 1500, 2000, 2500, 3000]],
];

const totalOf = (rows: SeasonRecord[], kind: Kind) => {
  const t: Record<string, number> = {};
  for (const r of rows) {
    const l = r.line as HitterLine & PitcherLine;
    if (kind === "HITTER") {
      t["안타"] = (t["안타"] ?? 0) + l.h;
      t["홈런"] = (t["홈런"] ?? 0) + l.hr;
      t["타점"] = (t["타점"] ?? 0) + l.rbi;
      t["도루"] = (t["도루"] ?? 0) + l.sb;
    } else {
      t["승"] = (t["승"] ?? 0) + l.w;
      t["탈삼진"] = (t["탈삼진"] ?? 0) + l.so;
      t["세이브"] = (t["세이브"] ?? 0) + l.sv;
      t["홀드"] = (t["홀드"] ?? 0) + l.hld;
      t["이닝"] = (t["이닝"] ?? 0) + l.ip;
    }
  }
  return t;
};

/** 이번 시즌에 새로 넘어선 통산 이정표 */
export function newMilestones(seasons: SeasonRecord[], kind: Kind): string[] {
  const kbo = seasons.filter((r) => r.level === "KBO");
  if (kbo.length < 1) return [];
  const before = totalOf(kbo.slice(0, -1), kind);
  const after = totalOf(kbo, kind);
  const marks = kind === "HITTER" ? HIT_MARKS : PIT_MARKS;
  const out: string[] = [];
  for (const [label, steps] of marks) {
    for (const n of steps) {
      if ((before[label] ?? 0) < n && (after[label] ?? 0) >= n) {
        out.push(`통산 ${n.toLocaleString()}${label} 달성`);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 역대 기록 순위 — 가상의 KBO 역대 10걸                                 */
/* ------------------------------------------------------------------ */

const ALLTIME: Record<string, number[]> = {
  안타: [3084, 2870, 2711, 2588, 2461, 2352, 2248, 2140, 2044, 1951],
  홈런: [608, 551, 502, 468, 441, 415, 390, 366, 344, 321],
  타점: [1982, 1854, 1740, 1651, 1566, 1488, 1410, 1338, 1270, 1204],
  도루: [594, 512, 458, 411, 372, 338, 307, 279, 254, 231],
  승: [242, 221, 203, 188, 174, 161, 149, 138, 128, 118],
  탈삼진: [2519, 2331, 2178, 2044, 1922, 1810, 1706, 1608, 1516, 1430],
  세이브: [412, 366, 327, 294, 265, 239, 216, 195, 176, 159],
  이닝: [3421, 3180, 2972, 2788, 2622, 2470, 2330, 2200, 2078, 1963],
};

export interface AllTimeRank { label: string; value: number; rank: number }

/** 통산 기록이 역대 몇 위인지 (10위 밖은 제외) */
export function allTimeRanks(seasons: SeasonRecord[], kind: Kind): AllTimeRank[] {
  const kbo = seasons.filter((r) => r.level === "KBO");
  if (!kbo.length) return [];
  const t = totalOf(kbo, kind);
  const out: AllTimeRank[] = [];
  for (const [label, list] of Object.entries(ALLTIME)) {
    const v = Math.round(t[label] ?? 0);
    if (!v) continue;
    const rank = list.findIndex((n) => v >= n) + 1;
    if (rank > 0) out.push({ label, value: v, rank });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

/* ------------------------------------------------------------------ */
/* 별명                                                                */
/* ------------------------------------------------------------------ */

/** 커리어가 쌓이면 팬들이 이름 대신 이걸로 부른다 */
export function nickname(s: GameState): string | null {
  const kbo = s.seasons.filter((r) => r.level === "KBO");
  if (kbo.length < 3) return null;
  const kind = s.player.kind;
  const t = totalOf(kbo, kind);
  const mvp = kbo.reduce((a, r) => a + r.awards.filter((x) => x.includes("MVP")).length, 0);
  const rings = kbo.filter((r) => r.champion).length;
  const gold = s.intlResults.some((r) => r.medal === "금");
  const slot = s.player.armSlot;
  const pos = s.player.position;

  const picks: [boolean, string][] = kind === "HITTER" ? [
    [mvp >= 2, "리그의 지배자"],
    [(t["홈런"] ?? 0) >= 450, "홈런 군주"],
    [(t["홈런"] ?? 0) >= 300, "거포"],
    [(t["안타"] ?? 0) >= 2400, "안타 제조기"],
    [(t["도루"] ?? 0) >= 350, "대도"],
    [gold, `국민 타자`],
    [rings >= 3, "우승 청부사"],
    [(t["안타"] ?? 0) >= 1500, "꾸준함의 대명사"],
    [pos === "C", "안방마님"],
  ] : [
    [mvp >= 2, "리그의 지배자"],
    [(t["승"] ?? 0) >= 180, "대투수"],
    [(t["세이브"] ?? 0) >= 280, "수호신"],
    [(t["탈삼진"] ?? 0) >= 2000, "닥터 K"],
    [slot === "UNDER", "잠수함"],
    [slot === "SIDE" && (t["세이브"] ?? 0) + (t["홀드"] ?? 0) >= 150, "옆구리 마당쇠"],
    [gold, "국민 투수"],
    [s.player.throws === "L" && (t["탈삼진"] ?? 0) >= 1200, "좌완 파이어볼러"],
    [rings >= 3, "우승 청부사"],
    [(t["이닝"] ?? 0) >= 2000, "이닝이터"],
  ];
  return picks.find(([ok]) => ok)?.[1] ?? null;
}
