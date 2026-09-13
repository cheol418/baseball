import { RNG, clamp, n50 } from "./rng";
import { armSlotById, batterPlatoonBonus, getAb, platoonEdge } from "./player";
import { isRotationRole } from "./roles";
import type { AllStarGame, HitterLine, LevelTag, PitcherLine, Player, Position, StatLine } from "./types";

export const LEVEL_GAMES: Record<LevelTag, number> = {
  HS: 24, COLLEGE: 38, MINOR: 110, KBO: 144, ARMY: 100,
};
/** 레벨별 난이도 보정 (아마추어일수록 성적이 잘 나온다) */
export const LEVEL_ADJ: Record<LevelTag, number> = {
  HS: 25, COLLEGE: 15, MINOR: 8, KBO: 0, ARMY: 8,
};

/** 전반기 / 후반기 경기 배분 — 올스타 브레이크는 144경기 중 약 86경기 시점 */
export const HALF_SHARE = { H1: 0.6, H2: 0.4 } as const;

export const ROLE_PT: Record<string, number> = {
  간판타자: 1.0, 핵심타자: 1.0, 주전: 1.0, 준주전: 0.66, 백업: 0.34, 육성선수: 0.18,
  에이스: 1.0, "1선발": 1.0, 선발: 0.95, "5선발": 0.8,
  마무리: 1.0, 필승조: 1.0, 불펜: 1.0, 추격조: 0.6,
};

/**
 * 수비 가치 중 어깨가 차지하는 비중.
 * 포수는 도루 저지가 곧 수비이고, 1루수는 어깨를 쓸 일이 거의 없다.
 */
const ARM_WEIGHT: Record<string, number> = {
  C: 0.45, RF: 0.35, SS: 0.3, "3B": 0.3, CF: 0.25, LF: 0.2, "2B": 0.2, "1B": 0.08, DH: 0,
};

const POS_ADJ: Record<string, number> = {
  C: 12.5, SS: 7, "2B": 2.5, "3B": 2, CF: 2.5, LF: -7, RF: -7, "1B": -12.5, DH: -17.5,
};

export interface SimInput {
  player: Player;
  /** 홈구장 보정 (홈경기가 절반이므로 효과는 절반만 적용된다) */
  park?: { hr: number; hit: number };
  level: LevelTag;
  role: string;
  teamPower: number;
  availability: number; // 0~1 (부상/컨디션 반영)
  rng: RNG;
  /** 시즌 중 이 구간이 차지하는 비율 (전반기 0.6 / 후반기 0.4 / 전체 1) */
  share?: number;
  /** 난이도 추가 보정 — 포스트시즌·국제대회처럼 상대가 강할 때 음수 */
  extraAdj?: number;
  /** 최소 출장 경기 수 — 단일 경기(올스타전·국제대회)를 돌릴 때 1 */
  minGames?: number;
  /**
   * 시즌 안에서 이 구간이 차지하는 [시작, 끝] 누적 비율.
   * 월별로 따로 반올림하면 합이 144경기와 어긋나므로,
   * 누적값의 차이로 배분해 시즌 총합을 정확히 맞춘다.
   */
  cume?: readonly [number, number];
}

/** 구간 경기 수 — cume가 있으면 누적 차분, 없으면 단순 비율 */
function allocate(inp: SimInput, total: number): number {
  if (inp.cume) {
    const [from, to] = inp.cume;
    return Math.max(0, Math.round(total * to) - Math.round(total * from));
  }
  return Math.max(inp.minGames ?? 0, Math.round(total * (inp.share ?? 1)));
}

/**
 * 한 경기·한 시리즈처럼 표본이 작을 때는 기댓값을 반올림하면
 * 매번 똑같은 결과가 나온다 (4타석이면 언제나 1안타 = .250).
 * 작은 표본에서만 실제로 추첨해 경기마다 다른 기록이 나오게 한다.
 */
function rbinom(rng: RNG, n: number, prob: number): number {
  const k = Math.max(0, Math.round(n));
  if (k === 0) return 0;
  const q = clamp(prob, 0, 1);
  let hit = 0;
  for (let i = 0; i < k; i++) if (rng.next() < q) hit++;
  return hit;
}

export function simHitter(inp: SimInput): HitterLine {
  const { player: p, level, role, teamPower, availability, rng } = inp;
  const share = inp.share ?? 1;
  // 좌타·스위치는 상대 투수 대부분이 우완이라 유리하다
  const adj = LEVEL_ADJ[level] + (inp.extraAdj ?? 0) + batterPlatoonBonus(p);
  const a = (k: string) => clamp(getAb(p.abilities, k as never) + adj, 1, 150);
  const cond = 0.92 + (p.condition / 100) * 0.16;

  // 홈경기가 절반이므로 구장 효과도 절반만 반영한다
  const parkHr = 1 + ((inp.park?.hr ?? 1) - 1) * 0.5;
  const parkHit = 1 + ((inp.park?.hit ?? 1) - 1) * 0.5;

  const bbRate = clamp(0.083 + 0.06 * n50(a("eye")) + 0.008 * n50(a("contact")) + rng.normal() * 0.011, 0.02, 0.23);
  const kRate = clamp(0.185 - 0.08 * n50(a("contact")) + 0.032 * n50(a("power")) - 0.015 * n50(a("eye")) + rng.normal() * 0.018, 0.04, 0.42);
  const babip = clamp(
    (0.300 + 0.048 * n50(a("contact")) * cond + 0.030 * n50(a("speed")) + rng.normal() * 0.017) * parkHit,
    0.21, 0.42,
  );
  /**
   * 타구당 홈런율.
   *
   * 파워를 끝까지 올린 보람이 있어야 한다 — 실제 KBO 홈런왕은 35~50개다
   * (2024 디아즈 50 · 데이비슨 46). 파워가 주도하되, 맞혀야 넘길 수 있으므로
   * 컨택도 함께 본다.
   */
  const hrPerBall = clamp(
    (0.014 + 0.100 * n50(a("power")) * cond + 0.016 * n50(a("contact")) + rng.normal() * 0.006) * parkHr,
    0.001, 0.22,
  );

  // 올스타전·국제대회처럼 한두 경기만 떼어 돌릴 때도 타석은 나와야 한다
  const games = allocate(inp, LEVEL_GAMES[level] * (ROLE_PT[role] ?? 0.6) * availability);
  const pa = Math.max(0, Math.round(games * 4.2));
  if (pa < 1) return emptyHitter(games);

  // 짧은 구간(국제대회·올스타전·단기 시리즈)만 추첨하고, 정규시즌은 기댓값 그대로 둔다
  const cnt = pa < 60
    ? (n: number, prob: number) => rbinom(rng, n, prob)
    : (n: number, prob: number) => Math.round(n * prob);

  const bb = cnt(pa, bbRate);
  const hbp = cnt(pa, 0.0095);
  const sf = cnt(pa, 0.009);
  const ab = Math.max(1, pa - bb - hbp - sf);
  const so = clamp(cnt(pa, kRate), 0, ab);
  const contacted = Math.max(0, ab - so);
  const hr = cnt(contacted, hrPerBall);
  const inPlay = Math.max(0, contacted - hr);
  const hIn = cnt(inPlay, babip);
  const b2 = cnt(hIn, clamp(0.19 + 0.055 * n50(a("power")) + 0.03 * n50(a("speed")), 0.10, 0.34));
  const b3 = cnt(hIn, clamp(0.015 + 0.035 * Math.max(0, n50(a("speed"))), 0, 0.07));
  const h = hIn + hr;

  const sbAttempt = cnt(games, clamp(0.02 + 0.45 * Math.max(0, n50(a("speed"))), 0, 0.6));
  const sbSucc = clamp(0.62 + 0.18 * n50(a("speed")), 0.45, 0.92);
  const sb = Math.round(sbAttempt * sbSucc);
  const cs = Math.max(0, sbAttempt - sb);

  const teamF = 0.84 + (teamPower / 100) * 0.32;
  const clutch = p.trait === "clutch" ? 1.1 : 1;
  const r = Math.round(((h + bb + hbp) * (0.30 + 0.10 * n50(a("speed"))) + hr * 0.6) * teamF);
  const rbi = Math.round((h * 0.33 + hr * 1.5 + pa * 0.045) * teamF * clutch);

  const singles = h - b2 - b3 - hr;
  const tb = singles + b2 * 2 + b3 * 3 + hr * 4;
  const avg = h / ab;
  const obp = (h + bb + hbp) / pa;
  const slg = tb / ab;

  const woba = (0.69 * bb + 0.72 * hbp + 0.89 * singles + 1.27 * b2 + 1.62 * b3 + 2.1 * hr) / pa;
  const lgWoba = 0.335 + LEVEL_ADJ[level] * 0.0018;
  const wraa = ((woba - lgWoba) / 1.25) * pa;
  const defW = p.position === "DH" ? 0 : 1;
  // 수비 가치는 글러브(수비)와 어깨(송구)로 나뉜다.
  // 포수의 도루 저지, 우익수의 보살처럼 자리마다 어깨의 비중이 다르다.
  const armW = ARM_WEIGHT[p.position] ?? 0.15;
  const fieldSkill = n50(getAb(p.abilities, "defense" as never)) * (1 - armW)
    + n50(getAb(p.abilities, "arm" as never)) * armW;
  // 계수 17 — 리그 최고 수비수가 한 시즌 +12런 안팎이 되도록 (FanGraphs 기준 +15~20)
  const defRuns = fieldSkill * 17 * (pa / 600) * defW;
  const posAdj = (POS_ADJ[p.position] ?? 0) * (pa / 600);
  const repl = pa * 0.0335;
  const levelScale = level === "KBO" ? 1 : level === "MINOR" ? 0.7 : 0.45;
  const war = Math.round(((wraa + defRuns + posAdj + repl) / 10) * levelScale * 10) / 10;

  return {
    g: games, pa, ab, h, b2, b3, hr, rbi, r, bb, so, sb, cs, hbp,
    avg: round3(avg), obp: round3(obp), slg: round3(slg), ops: round3(obp + slg), war,
  };
}

export function simPitcher(inp: SimInput): PitcherLine {
  const { player: p, level, role, teamPower, availability, rng } = inp;
  const share = inp.share ?? 1;
  // 좌완은 수가 적어 타자들이 자주 보지 못한다 — 희소성 프리미엄
  const handBonus = p.throws === "L" ? 1.8 : 0;
  const adj = LEVEL_ADJ[level] + (inp.extraAdj ?? 0) + handBonus;
  const a = (k: string) => clamp(getAb(p.abilities, k as never) + adj, 1, 150);
  const cond = 0.92 + (p.condition / 100) * 0.16;

  // 투구폼은 공의 성질을, 플래툰은 실제로 상대하는 타석 구성을 반영한다
  const slot = armSlotById(p.armSlot);
  const edge = platoonEdge(p, role);

  const stuff = a("velocity") * 0.55 + a("breaking") * 0.45;
  const k9 = clamp(
    (7.1 + 3.5 * n50(stuff) * cond + rng.normal() * 0.38) * slot.k9 * (1 + edge * 0.35),
    2.0, 14.5,
  );
  const bb9 = clamp(
    (3.7 - 2.2 * n50(a("control")) + rng.normal() * 0.3) * slot.bb9,
    0.6, 8.5,
  );
  const parkHr = 1 + ((inp.park?.hr ?? 1) - 1) * 0.5;
  const hr9 = clamp(
    (1.02 - 0.45 * n50(a("movement")) - 0.28 * n50(a("velocity")) + rng.normal() * 0.11)
      * slot.hr9 * (1 - edge * 0.8) * parkHr,
    0.08, 2.8,
  );
  const babip = clamp(
    0.298 - 0.012 * n50(a("movement")) - edge * 0.06 + rng.normal() * 0.012,
    0.24, 0.36,
  );

  const isSP = isRotationRole(role);
  const isCP = role === "마무리";

  let g: number, gs: number, ip: number;
  if (isSP) {
    gs = allocate(inp, 30 * availability);
    g = gs;
    const ipPerStart = clamp(5.75 + 1.95 * n50(a("stamina")), 3.6, 7.4);
    ip = Math.round(gs * ipPerStart * 10) / 10;
  } else if (isCP) {
    g = allocate(inp, 58 * availability);
    gs = 0;
    ip = Math.round(g * 0.98 * 10) / 10;
  } else {
    g = allocate(inp, 64 * availability * (ROLE_PT[role] ?? 1));
    gs = 0;
    ip = Math.round(g * 1.08 * 10) / 10;
  }
  if (ip < 1) return emptyPitcher();

  // 타자와 같은 이유 — 한두 경기 등판은 추첨한다
  const bf = Math.max(1, Math.round(ip * 4.3));
  const pcnt = ip < 25
    ? (n: number, prob: number) => rbinom(rng, n, prob)
    : (n: number, prob: number) => Math.round(n * prob);

  const so = Math.min(Math.round(ip * 3), pcnt(bf, clamp((ip / 9) * k9 / bf, 0, 1)));
  const bb = pcnt(bf, clamp((ip / 9) * bb9 / bf, 0, 1));
  const hrA = pcnt(bf, clamp((ip / 9) * hr9 / bf, 0, 1));
  const outs = ip * 3;
  const bipOuts = Math.max(0, outs - so);
  const hIn = Math.round((bipOuts * babip) / (1 - babip));
  const h = hIn + hrA;

  const fip = (13 * hrA + 3 * bb - 2 * so) / ip + 3.1 - LEVEL_ADJ[level] * 0.055;
  const mentalNoise = p.trait === "coldblood" ? 0.25 : 0.42;
  const rate = clamp(fip + rng.normal() * mentalNoise - (p.trait === "clutch" ? 0.2 : 0), 0.6, 13);
  // 자책점은 정수다. 1이닝에 기대 자책 0.4면 반올림으로 항상 0이 되어
  // 표시된 평균자책과 기록이 어긋난다(합산하면 0.00이 된다) — 짧은 구간은 추첨한다.
  const erRaw = (rate * ip) / 9;
  const er = ip < 25
    ? Math.floor(erRaw) + (rng.next() < erRaw - Math.floor(erRaw) ? 1 : 0)
    : Math.round(erRaw);
  // 평균자책은 항상 실제 자책점에서 되계산한다 — 합산해도 맞아떨어지게
  const era = ip ? Math.round(((er * 9) / ip) * 100) / 100 : 0;
  const whip = Math.round(((h + bb) / ip) * 100) / 100;

  const teamF = (teamPower - 65) * 0.004;
  let w = 0, l = 0, sv = 0, hld = 0;
  if (isSP) {
    const wr = clamp(0.36 + (4.3 - era) * 0.055 + teamF, 0.08, 0.78);
    w = Math.round(gs * wr);
    l = Math.round(gs * clamp(0.62 - wr, 0.06, 0.6));
  } else if (isCP) {
    sv = Math.round(g * clamp(0.52 + teamF * 2 - (era - 3.2) * 0.05, 0.12, 0.78));
    w = Math.round(g * 0.05);
    l = Math.round(g * 0.06);
  } else {
    hld = Math.round(g * clamp(0.34 + teamF * 2 - (era - 4) * 0.04, 0.05, 0.62));
    w = Math.round(g * 0.07);
    l = Math.round(g * 0.06);
  }

  const ra9 = era * 1.07;
  const replRa = isSP ? 5.7 : 5.9;
  const lev = isSP ? 1 : isCP ? 1.0 : 0.78;
  const levelScale = level === "KBO" ? 1 : level === "MINOR" ? 0.7 : 0.45;
  const war = Math.round(((replRa - ra9) / 10) * (ip / 9) * lev * levelScale * 10) / 10;

  return {
    g, gs, ip: Math.round(ip * 10) / 10, w, l, sv, hld, h, hrAllowed: hrA, bb, so, er,
    era: Math.round(era * 100) / 100, whip, k9: Math.round(((so / ip) * 9) * 100) / 100, war,
  };
}

export const isHitterLine = (l: HitterLine | PitcherLine): l is HitterLine =>
  (l as HitterLine).pa !== undefined;

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function emptyHitter(g = 0): HitterLine {
  return { g, pa: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 0, sb: 0, cs: 0, hbp: 0, avg: 0, obp: 0, slg: 0, ops: 0, war: 0 };
}
function emptyPitcher(): PitcherLine {
  return { g: 0, gs: 0, ip: 0, w: 0, l: 0, sv: 0, hld: 0, h: 0, hrAllowed: 0, bb: 0, so: 0, er: 0, era: 0, whip: 0, k9: 0, war: 0 };
}

/**
 * 그 해 리그 1위 기록. 매 시즌 새로 뽑아 "경쟁자를 이겼는가"로 타이틀을 준다.
 * 확률로 대충 주던 방식보다, 기록을 보고 납득할 수 있다.
 */
function leagueLeaders(rng: RNG) {
  return {
    hr: rng.int(30, 44),
    avg: rng.float(0.330, 0.368),
    rbi: rng.int(112, 142),
    sb: rng.int(34, 58),
    w: rng.int(13, 16),
    era: rng.float(2.35, 3.15),
    so: rng.int(146, 190),
    sv: rng.int(28, 40),
    hld: rng.int(26, 36),
  };
}

/** 부문 타이틀 — 연봉 협상에서 크게 쳐준다 */
export const MAJOR_TITLES = [
  "정규시즌 MVP", "홈런왕", "타격왕", "타점왕", "도루왕",
  "다승왕", "평균자책점 1위", "탈삼진왕", "세이브왕", "홀드왕",
];

/** 시즌 수상 판정 (KBO 레벨만) */
export function judgeAwards(
  p: Player, line: HitterLine | PitcherLine, level: LevelTag, isRookie: boolean, rng: RNG,
): string[] {
  if (level !== "KBO") return [];
  const out: string[] = [];
  const lead = leagueLeaders(rng);

  if (isHitterLine(line)) {
    if (line.pa < 300) return out;
    if (line.hr >= lead.hr) out.push("홈런왕");
    if (line.avg >= lead.avg && line.pa >= 440) out.push("타격왕");
    if (line.rbi >= lead.rbi) out.push("타점왕");
    if (line.sb >= lead.sb) out.push("도루왕");
    if (line.war >= 3.6 && rng.chance(0.6)) out.push("골든글러브");
    if (line.war >= 5.4 && rng.chance(0.65)) out.push("정규시즌 MVP");
    if (isRookie && line.war >= 1.8 && rng.chance(0.75)) out.push("신인왕");
  } else {
    if (line.ip < 60 && line.sv + line.hld < 20) return out;
    if (line.w >= lead.w) out.push("다승왕");
    if (line.era <= lead.era && line.ip >= 130) out.push("평균자책점 1위");
    if (line.so >= lead.so) out.push("탈삼진왕");
    if (line.sv >= lead.sv) out.push("세이브왕");
    if (line.hld >= lead.hld) out.push("홀드왕");
    // 투수 WAR는 구조적으로 타자보다 천장이 낮다(상위3% 4.7 vs 5.9).
    // 같은 문턱을 쓰면 투수가 MVP를 거의 못 받는다 — 자리마다 문턱을 따로 둔다.
    // 골든글러브는 투수 1자리뿐이다(타자는 포지션별 9자리) — 더 희소하게
    if (line.war >= 3.7 && rng.chance(0.42)) out.push("골든글러브");
    if (line.war >= 4.6 && rng.chance(0.65)) out.push("정규시즌 MVP");
    if (isRookie && line.war >= 1.8 && rng.chance(0.75)) out.push("신인왕");
  }
  // 중요한 상이 앞에 오도록 정렬
  const order = (a: string) =>
    a.includes("MVP") ? 0 : MAJOR_TITLES.includes(a) ? 1 : a === "신인왕" ? 2 : a === "골든글러브" ? 3 : 4;
  return out.sort((a, b) => order(a) - order(b));
}

export const POSITION_GROUP = (pos: Position) =>
  pos === "SP" || pos === "RP" || pos === "CP" ? "PITCHER" : "HITTER";


/* ------------------------------------------------------------------ */
/* 성적 합산                                                            */
/* ------------------------------------------------------------------ */

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** 전반기 + 후반기(+ 포스트시즌) 합산. 비율 스탯은 누적값으로 다시 계산한다. */
export function mergeLines(lines: (StatLine | null | undefined)[]): StatLine {
  const rows = lines.filter(Boolean) as StatLine[];
  if (!rows.length) return emptyHitter();
  if (isHitterLine(rows[0])) {
    const t = (rows as HitterLine[]).reduce((a, l) => ({
      g: a.g + l.g, pa: a.pa + l.pa, ab: a.ab + l.ab, h: a.h + l.h,
      b2: a.b2 + l.b2, b3: a.b3 + l.b3, hr: a.hr + l.hr, rbi: a.rbi + l.rbi,
      r: a.r + l.r, bb: a.bb + l.bb, so: a.so + l.so, sb: a.sb + l.sb,
      cs: a.cs + l.cs, hbp: a.hbp + l.hbp, war: a.war + l.war,
      avg: 0, obp: 0, slg: 0, ops: 0,
    }), emptyHitter());
    const singles = t.h - t.b2 - t.b3 - t.hr;
    const tb = singles + t.b2 * 2 + t.b3 * 3 + t.hr * 4;
    t.avg = t.ab ? r3(t.h / t.ab) : 0;
    t.obp = t.pa ? r3((t.h + t.bb + t.hbp) / t.pa) : 0;
    t.slg = t.ab ? r3(tb / t.ab) : 0;
    t.ops = r3(t.obp + t.slg);
    t.war = Math.round(t.war * 10) / 10;
    return t;
  }
  const t = (rows as PitcherLine[]).reduce((a, l) => ({
    g: a.g + l.g, gs: a.gs + l.gs, ip: a.ip + l.ip, w: a.w + l.w, l: a.l + l.l,
    sv: a.sv + l.sv, hld: a.hld + l.hld, h: a.h + l.h,
    hrAllowed: a.hrAllowed + l.hrAllowed, bb: a.bb + l.bb, so: a.so + l.so,
    er: a.er + l.er, war: a.war + l.war, era: 0, whip: 0, k9: 0,
  }), emptyPitcher());
  t.ip = Math.round(t.ip * 10) / 10;
  t.era = t.ip ? r2((t.er * 9) / t.ip) : 0;
  t.whip = t.ip ? r2((t.h + t.bb) / t.ip) : 0;
  t.k9 = t.ip ? r2((t.so / t.ip) * 9) : 0;
  t.war = Math.round(t.war * 10) / 10;
  return t;
}

/**
 * 전체 − 부분 = 나머지 구간 성적.
 * 누적 스탯은 그대로 빼고 비율 스탯은 다시 계산하므로 정확하다.
 */
export function subtractLine(full: StatLine, part: StatLine): StatLine {
  if (isHitterLine(full) && isHitterLine(part)) {
    const t: HitterLine = {
      g: full.g - part.g, pa: full.pa - part.pa, ab: full.ab - part.ab, h: full.h - part.h,
      b2: full.b2 - part.b2, b3: full.b3 - part.b3, hr: full.hr - part.hr,
      rbi: full.rbi - part.rbi, r: full.r - part.r, bb: full.bb - part.bb,
      so: full.so - part.so, sb: full.sb - part.sb, cs: full.cs - part.cs,
      hbp: full.hbp - part.hbp, war: Math.round((full.war - part.war) * 10) / 10,
      avg: 0, obp: 0, slg: 0, ops: 0,
    };
    const singles = t.h - t.b2 - t.b3 - t.hr;
    const tb = singles + t.b2 * 2 + t.b3 * 3 + t.hr * 4;
    t.avg = t.ab > 0 ? r3(t.h / t.ab) : 0;
    t.obp = t.pa > 0 ? r3((t.h + t.bb + t.hbp) / t.pa) : 0;
    t.slg = t.ab > 0 ? r3(tb / t.ab) : 0;
    t.ops = r3(t.obp + t.slg);
    return t;
  }
  const f = full as PitcherLine, p = part as PitcherLine;
  const t: PitcherLine = {
    g: f.g - p.g, gs: f.gs - p.gs, ip: Math.round((f.ip - p.ip) * 10) / 10,
    w: f.w - p.w, l: f.l - p.l, sv: f.sv - p.sv, hld: f.hld - p.hld,
    h: f.h - p.h, hrAllowed: f.hrAllowed - p.hrAllowed, bb: f.bb - p.bb,
    so: f.so - p.so, er: f.er - p.er,
    war: Math.round((f.war - p.war) * 10) / 10,
    era: 0, whip: 0, k9: 0,
  };
  t.era = t.ip > 0 ? r2((t.er * 9) / t.ip) : 0;
  t.whip = t.ip > 0 ? r2((t.h + t.bb) / t.ip) : 0;
  t.k9 = t.ip > 0 ? r2((t.so / t.ip) * 9) : 0;
  return t;
}

export const emptyLine = (kind: "HITTER" | "PITCHER"): StatLine =>
  kind === "HITTER" ? emptyHitter() : emptyPitcher();

/* ------------------------------------------------------------------ */
/* 올스타                                                               */
/* ------------------------------------------------------------------ */

/** 전반기 성적으로 올스타 선정 판정 */
/**
 * 올스타 선정 — 실제 올스타는 **보직별로** 뽑는다.
 * 하나의 식으로 판정하면 이닝이 적은 마무리가 구조적으로 불리해진다.
 * (마무리 ERA 2.89 · 34이닝인데 이닝 기준 −0.6점을 먹던 버그)
 */
export function judgeAllStar(
  line: StatLine, level: LevelTag, fame: number, rng: RNG, role?: string | null,
): boolean {
  // 실제 KBO도 퓨처스 올스타전을 따로 연다 — 2군에서 잘하면 그쪽에 뽑힌다
  if (level !== "KBO" && level !== "MINOR") return false;
  let score: number;

  if (isHitterLine(line)) {
    // 전반기 내내 주전으로 뛰어야 후보가 된다
    if (line.pa < 200) return false;
    score = (line.ops - 0.80) * 6 + line.hr * 0.05 + line.sb * 0.015 + line.war * 0.45;
  } else {
    const p = line as PitcherLine;
    if (role === "마무리") {
      // 마무리는 세이브로 평가받는다. 전반기 15세이브면 30세이브 페이스
      if (p.g < 18) return false;
      score = (3.60 - p.era) * 1.25 + p.sv * 0.10 + p.war * 0.55;
    } else if (isRotationRole(role)) {
      // 선발은 이닝과 평균자책
      if (p.ip < 55) return false;
      score = (4.10 - p.era) * 1.15 + (p.ip - 85) * 0.014 + p.w * 0.09 + p.war * 0.5;
    } else {
      // 불펜은 홀드
      if (p.g < 20) return false;
      score = (3.70 - p.era) * 1.2 + (p.hld + p.sv) * 0.07 + p.war * 0.55;
    }
  }
  score += fame * 0.006;
  // 2군 기록은 부풀려 나오므로 기준을 높게 잡는다
  if (level === "MINOR") score -= 1.6;
  // 압도적인 전반기를 보내고도 떨어지는 일은 드물어야 한다
  return rng.next() < clamp(score * 0.19, 0, 0.92);
}



/* ------------------------------------------------------------------ */
/* 올스타전                                                             */
/* ------------------------------------------------------------------ */

/**
 * 단일 경기 한 판에 해당하는 share.
 * 타자는 한 시즌 144경기 중 1경기, 투수는 등판 기준(선발 29·불펜 60)으로 환산한다.
 */
export function oneGameShare(p: Player): number {
  if (p.kind === "HITTER") return 1 / 144;
  return p.position === "SP" ? 1 / 29 : 1 / 60;
}

/** KBO 올스타는 나눔·드림 두 팀으로 나뉜다 */
const ALLSTAR_SIDES = ["나눔 올스타", "드림 올스타"] as const;
/** 퓨처스는 북부·남부 리그로 나뉜다 */
const FUTURES_SIDES = ["북부 올스타", "남부 올스타"] as const;

export function simAllStarGame(
  p: Player, teamId: string, rng: RNG, level: LevelTag = "KBO",
): AllStarGame {
  // 구단을 반으로 갈라 소속을 정한다 (실제 KBO와 같은 방식)
  const sideIdx = ["SEO", "INC", "SUW", "DAJ", "DAG"].includes(teamId) ? 0 : 1;
  const sides = level === "MINOR" ? FUTURES_SIDES : ALLSTAR_SIDES;
  const side = sides[sideIdx];
  const opponent = sides[1 - sideIdx];

  // 한 경기 — 타자는 3~4타석, 투수는 1~2이닝
  const share = p.kind === "HITTER" ? 1 / 144 : 1 / 60;
  const base = {
    player: p, level, teamPower: 80, availability: 1, rng, share, minGames: 1,
    // 올스타전은 잔치다 — 타자에게 유리하게 흘러간다
    extraAdj: p.kind === "HITTER" ? 6 : -4,
  };
  const line: StatLine = p.kind === "HITTER"
    ? simHitter({ ...base, role: "주전" })
    : simPitcher({ ...base, role: "불펜" });

  const my = rng.int(2, 11);
  const theirs = rng.int(2, 11);
  const won = my > theirs || (my === theirs && rng.chance(0.5));

  // MVP — 잘한 데다 팀이 이겨야 한다
  const great = isHitterLine(line)
    ? line.h >= 2 || line.hr >= 1
    : (line as PitcherLine).ip >= 0.9 && (line as PitcherLine).er === 0;
  const mvp = won && great && rng.chance(0.42);

  return {
    side, opponent, won,
    score: won ? `${Math.max(my, theirs)}-${Math.min(my, theirs)}` : `${Math.min(my, theirs)}-${Math.max(my, theirs)}`,
    line, mvp,
  };
}
