import { RNG } from "./rng";
import { deriveStyle } from "./player";
import { isFranchiseRole, isRotationRole, roleTier } from "./roles";
import { isHitterLine } from "./sim";
import type { GameState, Kind, SeasonGoal, SeasonRecord, StatLine, PitcherLine, HitterLine } from "./types";

/* ------------------------------------------------------------------ */
/* 구단 시즌 목표                                                       */
/* ------------------------------------------------------------------ */

/** 선수 유형 · 포지션 · 보직에 맞춰 구단이 요구하는 것 */
export function makeSeasonGoal(s: GameState, rng: RNG): SeasonGoal | null {
  const level = s.seasonLevel;
  const role = s.seasonRole ?? "";
  const p = s.player;
  if (!level || level === "ARMY") return null;

  if (level === "MINOR") {
    return {
      id: "callup", label: "1군 진입",
      desc: "시즌 중 1군 엔트리에 이름을 올린다.",
      reward: 10, penalty: -4,
    };
  }

  const style = deriveStyle(p).id;

  if (p.kind === "HITTER") {
    if (roleTier(role) < 3) {
      return { id: "hold", label: "1군 잔류", desc: "시즌의 70% 이상을 1군에서 버틴다.", reward: 8, penalty: -5 };
    }

    // 준주전은 규정타석을 채울 만큼 나가지 못한다 — 비율 기록 기준을 낮춘다
    if (roleTier(role) === 3) {
      const bench: SeasonGoal[] = [
        { id: "war2", label: "WAR 1.8", desc: "적은 출장 안에서도 팀에 1.8승을 보탠다.", reward: 10, penalty: -6 },
        { id: "ops800h", label: "OPS .770", desc: "300타석 이상에서 OPS .770.", reward: 10, penalty: -6 },
      ];
      if (style === "slugger") bench.push({ id: "hr15", label: "12홈런", desc: "적은 타석에서도 12홈런을 넘긴다.", reward: 11, penalty: -6 });
      if (style === "contact") bench.push({ id: "avg295b", label: "타율 .285", desc: "300타석 이상에서 타율 .285.", reward: 10, penalty: -6 });
      if (style === "toolsy") bench.push({ id: "sb15", label: "14도루", desc: "기회를 얻을 때마다 베이스를 훔친다.", reward: 10, penalty: -5 });
      if (style === "defense") bench.push({ id: "def1", label: "수비 기여", desc: "수비만으로도 팀에 보탬이 된다 — WAR 1.5.", reward: 10, penalty: -5 });
      return rng.pick(bench);
    }

    // 주전 — 유형이 곧 구단이 기대하는 역할이다
    const pool: SeasonGoal[] = [
      { id: "war3", label: "WAR 3.0", desc: "팀에 3승 이상을 보탠다.", reward: 10, penalty: -7 },
    ];
    // 팀의 간판에게는 리그 정상급을 요구한다
    if (isFranchiseRole(role)) pool.push(
      { id: "war5", label: "WAR 5.0", desc: "팀의 간판답게 5승을 만들어낸다.", reward: 14, penalty: -9 },
      { id: "ops900", label: "OPS .900", desc: "규정타석(400타석)을 채우고 OPS .900.", reward: 14, penalty: -9 },
    );
    if (style === "slugger") pool.push(
      { id: "hr25", label: "25홈런", desc: "중심타선의 몫 — 25홈런.", reward: 11, penalty: -7 },
      { id: "rbi85", label: "105타점", desc: "주자를 불러들이는 해결사가 된다.", reward: 11, penalty: -7 },
      { id: "slg500", label: "장타율 .500", desc: "규정타석(400타석)을 채우고 장타율 .500.", reward: 11, penalty: -7 },
    );
    else if (style === "contact") pool.push(
      { id: "avg300", label: "타율 .300", desc: "규정타석(400타석)을 채우고 3할을 친다.", reward: 11, penalty: -7 },
      { id: "h145", label: "145안타", desc: "꾸준히 방망이를 맞혀 안타를 쌓는다.", reward: 10, penalty: -6 },
      { id: "obp380", label: "출루율 .370", desc: "규정타석(400타석)을 채우고 출루율 .370.", reward: 11, penalty: -7 },
    );
    else if (style === "toolsy") pool.push(
      { id: "sb25", label: "25도루", desc: "발로 상대 배터리를 흔든다.", reward: 11, penalty: -6 },
      { id: "ops820", label: "OPS .820", desc: "규정타석(400타석)을 채우고 OPS .820.", reward: 10, penalty: -7 },
      { id: "hr15sb15", label: "12홈런-12도루", desc: "호타준족의 증명 — 12홈런 12도루.", reward: 12, penalty: -7 },
    );
    else pool.push(
      { id: "war3d", label: "WAR 3.0 (수비형)", desc: "방망이보다 글러브로 3승을 만든다.", reward: 11, penalty: -6 },
      { id: "avg275", label: "타율 .262", desc: "수비형이라도 규정타석(400타석)에서 타율 .262.", reward: 10, penalty: -6 },
    );
    // 센터라인은 수비 부담이 커 타격 요구가 한 단계 낮다
    if (["C", "SS", "2B", "CF"].includes(p.position)) pool.push(
      { id: "war25c", label: "WAR 2.5", desc: `${p.position} 자리를 지키며 팀에 2.5승을 보탠다.`, reward: 10, penalty: -6 },
    );
    if (p.position === "DH" || p.position === "1B") pool.push(
      { id: "ops850", label: "OPS .850", desc: "수비 부담이 없는 자리 — 규정타석(400타석)에서 OPS .850.", reward: 11, penalty: -8 },
    );
    return rng.pick(pool);
  }

  /* ---- 투수 ---- */
  const isSP = isRotationRole(role);
  const isCP = role === "마무리";

  if (isSP) {
    const pool: SeasonGoal[] = [
      { id: "w12", label: "12승", desc: "두 자릿수를 넘어 12승을 채운다.", reward: 11, penalty: -6 },
      { id: "era400", label: "평균자책 4.00", desc: "100이닝 이상에서 평균자책 4.00 이하.", reward: 11, penalty: -7 },
    ];
    // 에이스에게는 팀을 이끌 성적을 요구한다
    if (isFranchiseRole(role)) pool.push(
      { id: "era300ace", label: "평균자책 3.00", desc: "에이스의 몫 — 140이닝 이상에서 평균자책 3.00 이하.", reward: 14, penalty: -9 },
      { id: "war5", label: "WAR 5.0", desc: "팀의 에이스답게 5승을 만들어낸다.", reward: 14, penalty: -9 },
    );
    if (style === "horse_p") pool.push(
      { id: "ip170", label: "165이닝", desc: "이닝이터의 몫 — 로테이션을 끝까지 지킨다.", reward: 12, penalty: -7 },
      { id: "qs15", label: "13선발승", desc: "많은 이닝과 승리를 함께 가져간다.", reward: 11, penalty: -6 },
    );
    else if (style === "power_p") pool.push(
      { id: "so150", label: "140탈삼진", desc: "구위로 타자를 돌려세운다.", reward: 12, penalty: -7 },
      { id: "k9_9", label: "9이닝당 8탈삼진", desc: "100이닝 이상에서 K/9 8.0.", reward: 11, penalty: -6 },
    );
    else if (style === "control_p") pool.push(
      { id: "whip120", label: "WHIP 1.32", desc: "100이닝 이상에서 주자를 내보내지 않는다.", reward: 12, penalty: -7 },
      { id: "bb45", label: "볼넷 52개 이하", desc: "100이닝 이상에서 제구로 승부한다.", reward: 11, penalty: -6 },
    );
    else pool.push(
      { id: "era350sp", label: "평균자책 3.80", desc: "100이닝 이상에서 평균자책 3.80 이하.", reward: 12, penalty: -7 },
      { id: "ip140", label: "150이닝", desc: "로테이션을 끝까지 지킨다.", reward: 10, penalty: -7 },
    );
    return rng.pick(pool);
  }

  if (isCP) {
    return rng.pick<SeasonGoal>([
      { id: "sv25", label: "25세이브", desc: "9회를 책임진다.", reward: 12, penalty: -7 },
      { id: "era280cp", label: "평균자책 3.35", desc: "40경기 이상에서 평균자책 3.35 이하.", reward: 12, penalty: -7 },
      { id: "sv20era300", label: "20세이브-방어율 3.30", desc: "안정적으로 뒷문을 잠근다.", reward: 12, penalty: -7 },
    ]);
  }

  // 불펜 · 추격조
  const pool: SeasonGoal[] = [
    { id: "app50", label: "50경기 등판", desc: "불펜의 기둥으로 한 시즌을 버틴다.", reward: 9, penalty: -6 },
    { id: "era350", label: "평균자책 3.80", desc: "40경기 이상에서 평균자책 3.80 이하.", reward: 11, penalty: -7 },
  ];
  if (roleTier(role) >= 3) pool.push(
    { id: "hld15", label: "18홀드", desc: "리드를 지켜 다음 투수에게 넘긴다.", reward: 11, penalty: -6 },
  );
  if (style === "power_p") pool.push(
    { id: "k9_10", label: "9이닝당 8.5탈삼진", desc: "30이닝 이상에서 K/9 8.5.", reward: 11, penalty: -6 },
  );
  return rng.pick(pool);
}

/** 목표 판정 — 못 채웠다면 "무엇 때문에" 못 채웠는지까지 돌려준다 */
export function judgeSeasonGoal(
  goal: SeasonGoal, line: StatLine, kboShare: number,
): { met: boolean; reason: string } {
  const h = line as HitterLine;
  const p = line as PitcherLine;
  const f3 = (v: number) => v.toFixed(3).replace(/^0/, "");
  const ok = (met: boolean, miss: string) => ({ met, reason: met ? "" : miss });
  /** 타석 조건이 먼저 걸리면 그 사실을 그대로 알려준다 */
  const rate = (need: number, hit: boolean, miss: string) =>
    h.pa < need
      ? { met: false, reason: `${need}타석을 채우지 못했습니다 (${h.pa}타석).` }
      : ok(hit, miss);
  /** 투수도 마찬가지 — 이닝·등판 수 조건을 먼저 본다 */
  const ipGate = (need: number, hit: boolean, miss: string) =>
    p.ip < need
      ? { met: false, reason: `${need}이닝을 채우지 못했습니다 (${p.ip.toFixed(1)}이닝).` }
      : ok(hit, miss);
  const gGate = (need: number, hit: boolean, miss: string) =>
    p.g < need
      ? { met: false, reason: `${need}경기 등판을 채우지 못했습니다 (${p.g}경기).` }
      : ok(hit, miss);

  switch (goal.id) {
    /* 출장 */
    case "callup": return ok(kboShare >= 0.08, "끝내 1군의 부름을 받지 못했습니다.");
    case "hold": return ok(kboShare >= 0.7, "1군에 머문 기간이 시즌의 70%에 미치지 못했습니다.");

    /* 타자 — 종합 */
    case "war5": return ok(line.war >= 5, `WAR 5.0에 미치지 못했습니다 (${line.war.toFixed(1)}).`);
    case "ops900": return rate(400, h.ops >= 0.900, `OPS .900에 미치지 못했습니다 (${f3(h.ops)}).`);
    case "war3":
    case "war3d": return ok(line.war >= 3, `WAR 3.0에 미치지 못했습니다 (${line.war.toFixed(1)}).`);
    case "war25c": return ok(line.war >= 2.5, `WAR 2.5에 미치지 못했습니다 (${line.war.toFixed(1)}).`);
    case "war2": return ok(line.war >= 1.8, `WAR 1.8에 미치지 못했습니다 (${line.war.toFixed(1)}).`);
    case "def1": return ok(line.war >= 1.5, `WAR 1.5에 미치지 못했습니다 (${line.war.toFixed(1)}).`);

    /* 타자 — 비율 (규정타석) */
    case "avg300": return rate(400, h.avg >= 0.300, `타율 .300에 미치지 못했습니다 (${f3(h.avg)}).`);
    case "avg290": return rate(400, h.avg >= 0.290, `타율 .290에 미치지 못했습니다 (${f3(h.avg)}).`);
    case "avg275": return rate(400, h.avg >= 0.262, `타율 .262에 미치지 못했습니다 (${f3(h.avg)}).`);
    case "avg295b": return rate(300, h.avg >= 0.285, `타율 .285에 미치지 못했습니다 (${f3(h.avg)}).`);
    case "obp380": return rate(400, h.obp >= 0.370, `출루율 .370에 미치지 못했습니다 (${f3(h.obp)}).`);
    case "slg500": return rate(400, h.slg >= 0.500, `장타율 .500에 미치지 못했습니다 (${f3(h.slg)}).`);
    case "ops850": return rate(400, h.ops >= 0.850, `OPS .850에 미치지 못했습니다 (${f3(h.ops)}).`);
    case "ops820": return rate(400, h.ops >= 0.820, `OPS .820에 미치지 못했습니다 (${f3(h.ops)}).`);
    case "ops800h": return rate(300, h.ops >= 0.770, `OPS .770에 미치지 못했습니다 (${f3(h.ops)}).`);

    /* 타자 — 누적 */
    case "hr25": return ok(h.hr >= 25, `25홈런에 미치지 못했습니다 (${h.hr}홈런).`);
    case "hr20": return ok(h.hr >= 20, `20홈런에 미치지 못했습니다 (${h.hr}홈런).`);
    case "hr15": return ok(h.hr >= 12, `12홈런에 미치지 못했습니다 (${h.hr}홈런).`);
    case "rbi85": return ok(h.rbi >= 105, `105타점에 미치지 못했습니다 (${h.rbi}타점).`);
    case "h145": return ok(h.h >= 145, `145안타에 미치지 못했습니다 (${h.h}안타).`);
    case "sb25": return ok(h.sb >= 25, `25도루에 미치지 못했습니다 (${h.sb}도루).`);
    case "sb15": return ok(h.sb >= 14, `14도루에 미치지 못했습니다 (${h.sb}도루).`);
    case "hr15sb15": return ok(h.hr >= 12 && h.sb >= 12,
      `12홈런 12도루에 미치지 못했습니다 (${h.hr}홈런 ${h.sb}도루).`);

    /* 투수 — 선발 */
    case "w12": return ok(p.w >= 12, `12승에 미치지 못했습니다 (${p.w}승).`);
    case "qs15": return ok(p.w >= 13, `13승에 미치지 못했습니다 (${p.w}승).`);
    case "ip170": return ok(p.ip >= 165, `165이닝에 미치지 못했습니다 (${p.ip.toFixed(1)}이닝).`);
    case "ip140": return ok(p.ip >= 150, `150이닝에 미치지 못했습니다 (${p.ip.toFixed(1)}이닝).`);
    case "so150": return ok(p.so >= 140, `140탈삼진에 미치지 못했습니다 (${p.so}탈삼진).`);
    case "era400": return ipGate(100, p.era <= 4.00, `평균자책 4.00을 넘겼습니다 (${p.era.toFixed(2)}).`);
    case "era300ace": return ipGate(140, p.era <= 3.00, `평균자책 3.00을 넘겼습니다 (${p.era.toFixed(2)}).`);
    case "era350sp": return ipGate(100, p.era <= 3.80, `평균자책 3.80을 넘겼습니다 (${p.era.toFixed(2)}).`);
    case "whip120": return ipGate(100, p.whip <= 1.32, `WHIP 1.32를 넘겼습니다 (${p.whip.toFixed(2)}).`);
    case "bb45": return ipGate(100, p.bb <= 52, `볼넷이 52개를 넘었습니다 (${p.bb}볼넷).`);
    case "k9_9": return ipGate(100, p.k9 >= 8.0, `K/9 8.0에 미치지 못했습니다 (${p.k9.toFixed(1)}).`);

    /* 투수 — 불펜 */
    case "sv25": return ok(p.sv >= 25, `25세이브에 미치지 못했습니다 (${p.sv}세이브).`);
    case "sv20era300": return ok(p.sv >= 20 && p.era <= 3.30,
      `20세이브-방어율 3.30에 미치지 못했습니다 (${p.sv}세이브 ${p.era.toFixed(2)}).`);
    case "era280cp": return gGate(40, p.era <= 3.35, `평균자책 3.35를 넘겼습니다 (${p.era.toFixed(2)}).`);
    case "era350": return gGate(40, p.era <= 3.80, `평균자책 3.80을 넘겼습니다 (${p.era.toFixed(2)}).`);
    case "app50": return ok(p.g >= 50, `50경기 등판에 미치지 못했습니다 (${p.g}경기).`);
    case "hld15": return ok(p.hld >= 18, `18홀드에 미치지 못했습니다 (${p.hld}홀드).`);
    case "k9_10": return ipGate(30, p.k9 >= 8.5, `K/9 8.5에 미치지 못했습니다 (${p.k9.toFixed(1)}).`);

    default: return { met: false, reason: "" };
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
