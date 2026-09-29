import type { GameState, HitterLine, PitcherLine, SeasonRecord } from "./types";

/* ------------------------------------------------------------------ */
/* 특수능력                                                             */
/* ------------------------------------------------------------------ */

/**
 * 왜 필요한가.
 *
 * 특성(`Player.trait`)은 생성 때 9종 중 하나를 뽑아 **평생 고정**이었다.
 * 읽는 곳은 열 군데인데 쓰는 곳이 없어, 커리어가 쌓여도 선수가 달라졌다는
 * 감각이 없었다.
 *
 * 특수능력은 **커리어 중에 얻고 잃는다.** 만루에서 세 번 해결하면 그 자리가
 * 편해지고, 끝내기에서 다섯 번 무너지면 새가슴이 붙는다.
 * 이미 있는 세 시스템(승부처·시뮬레이션·커리어)에 각각 물리도록 짰다.
 *
 * 균형의 원칙
 *  · 획득 조건은 **이미 세고 있는 것**에서만 뽑는다 — 새 통계는 승부처
 *    태그별 누적(`clutchTally`) 하나뿐이다.
 *  · 효과는 승부처 카드에 **그대로 표시한다** (표기 = 실제).
 *  · 파란특은 거부할 수 없다 — 마이너스가 없으면 수집이 아니라 적립이 된다.
 *  · 한 장면에 붙는 승부처 보정은 **+20%p를 넘지 않는다**(`CLUTCH_CAP`).
 *
 * 실측(`scripts/abilitysim.ts`) — 커리어당 금특 4.9 · 파란특 1.0 ·
 * 획득률 7~55% · 보정이 붙는 장면 57%(붙으면 중앙 +10%p) · 상한에 걸리는 장면 1.8%.
 */

/** 승부처 장면에 달리는 태그 */
export type ClutchTag = "만루" | "끝내기" | "위기" | "원정" | "무대" | "세이브" | "대기록";

export interface AbilityEffect {
  /** 승부처 — 이 태그가 달린 장면에서 성공률 +n (0~1) */
  clutchTag?: Partial<Record<ClutchTag, number>>;
  /** 승부처 — 이 선택지를 골랐을 때 성공률 +n */
  clutchOption?: Record<string, number>;

  /* 시즌 시뮬레이션 — 작게 건다. 리그 기준선이 움직이므로 */
  hrMul?: number;        // 타구당 홈런율
  babipAdd?: number;     // 인플레이 타구 안타율
  bbAdd?: number;        // 볼넷률
  soAdd?: number;        // 삼진율 (타자)
  sbMul?: number;        // 도루 시도
  defMul?: number;       // 수비 런
  k9Add?: number;        // 탈삼진 (투수)
  hr9Mul?: number;       // 피홈런
  ipPerStartAdd?: number;// 선발당 이닝

  /* 커리어 */
  trustPerSeason?: number;
  teammatePerSeason?: number;
  fameMul?: number;      // 인지도 상승폭
  injuryMul?: number;    // 부상 확률
  missMul?: number;      // 부상 결장 기간
  declineMul?: number;   // 노쇠 낙폭
  trainTilt?: number;    // 훈련 성과 등급 기울기
  faHome?: number;       // 원소속팀 FA 제안 배수
}

export interface AbilityDef {
  id: string;
  name: string;
  icon: string;
  /** 금특(좋은 것) / 파란특(나쁜 것) */
  blue?: boolean;
  kind?: "HITTER" | "PITCHER";
  /** 화면에 그대로 내는 한 줄 */
  desc: string;
  effect: AbilityEffect;
  /** 얻는 조건 — 화면 설명 */
  how: string;
  /** 얻는 조건 — 판정 */
  gain: (c: AbilityContext) => boolean;
  /** 잃는 조건 (없으면 평생 간다) */
  lose?: (c: AbilityContext) => boolean;
}

/** 판정에 필요한 것들을 한 번만 모아 넘긴다 */
export interface AbilityContext {
  s: GameState;
  kbo: SeasonRecord[];
  /** 그 상 이름을 몇 번 받았는가 */
  awards: (name: string) => number;
  /** 조건을 만족하는 1군 시즌 수 */
  seasons: (f: (r: SeasonRecord) => boolean) => number;
  /** 승부처 태그별 성패 */
  tag: (t: string) => { win: number; lose: number };
  /** 승부처 선택지별 성패 */
  opt: (id: string) => { win: number; lose: number };
  ability: (k: string) => number;
  /** 한 팀에서 보낸 최장 시즌 수 */
  longestStay: number;
}

const H = (r: SeasonRecord) => r.line as HitterLine;
const P = (r: SeasonRecord) => r.line as PitcherLine;
const rate = (t: { win: number; lose: number }) => (t.win + t.lose ? t.win / (t.win + t.lose) : 0);

/** 한 장면에 겹쳐 붙는 승부처 보정의 상한 */
export const CLUTCH_CAP = 0.20;

export const ABILITIES: AbilityDef[] = [
  /* --- A. 승부처 --- */
  {
    id: "bases_loaded", name: "만루의 사나이", icon: "🔥",
    desc: "만루에서 성공률 +12%p", how: "만루 승부처 3승 · 승률 60% 이상",
    effect: { clutchTag: { 만루: 0.12 } },
    gain: (c) => c.tag("만루").win >= 3 && rate(c.tag("만루")) >= 0.6,
    lose: (c) => c.tag("만루").lose >= 5 && rate(c.tag("만루")) < 0.4,
  },
  {
    id: "walkoff", name: "끝내기 사나이", icon: "🔥",
    desc: "경기를 끝낼 수 있는 자리에서 +10%p", how: "끝내기 상황 4승",
    effect: { clutchTag: { 끝내기: 0.10 } },
    gain: (c) => c.tag("끝내기").win >= 4,
  },
  {
    id: "big_stage", name: "큰 경기에 강하다", icon: "🔥",
    desc: "올스타·국가대표·가을야구에서 +10%p", how: "큰 무대 승부처 8승",
    effect: { clutchTag: { 무대: 0.10 } },
    gain: (c) => c.tag("무대").win >= 8,
  },
  {
    id: "road_warrior", name: "원정 불패", icon: "🔥",
    desc: "적지에서 +8%p", how: "원정 승부처 3승",
    effect: { clutchTag: { 원정: 0.08 } },
    gain: (c) => c.tag("원정").win >= 3,
  },
  {
    id: "first_pitch", name: "초구 노림수", icon: "🔥", kind: "HITTER",
    desc: "`초구부터 노린다` +8%p", how: "그 선택으로 6승",
    effect: { clutchOption: { swing: 0.08 } },
    gain: (c) => c.opt("swing").win >= 6,
  },
  {
    id: "good_eye", name: "선구안의 대가", icon: "🔥", kind: "HITTER",
    desc: "`끝까지 골라낸다` +8%p · 볼넷률 +0.6%p", how: "그 선택으로 5승 또는 출루율 1위",
    effect: { clutchOption: { patient: 0.08 }, bbAdd: 0.006 },
    gain: (c) => c.opt("patient").win >= 5 || c.awards("출루율 1위") > 0,
  },
  {
    id: "escape", name: "위기 관리", icon: "🔥", kind: "PITCHER",
    desc: "주자를 두고 던지는 자리에서 +10%p", how: "위기 승부처 5승",
    effect: { clutchTag: { 위기: 0.10 } },
    gain: (c) => c.tag("위기").win >= 5,
  },
  {
    id: "closer_mind", name: "뒷문의 주인", icon: "🔥", kind: "PITCHER",
    desc: "세이브 상황에서 +10%p", how: "세이브왕·홀드왕 또는 세이브 승부처 3승",
    effect: { clutchTag: { 세이브: 0.10 } },
    gain: (c) => c.awards("세이브왕") > 0 || c.awards("홀드왕") > 0 || c.tag("세이브").win >= 3,
  },
  {
    id: "choker", name: "새가슴", icon: "💧", blue: true,
    desc: "경기를 끝낼 수 있는 자리에서 −10%p", how: "끝내기 상황 5패 (승 2 이하)",
    effect: { clutchTag: { 끝내기: -0.10 } },
    gain: (c) => c.tag("끝내기").lose >= 5 && c.tag("끝내기").win <= 2,
    lose: (c) => c.tag("끝내기").win >= 7,
  },
  {
    id: "wild", name: "볼넷 남발", icon: "💧", blue: true, kind: "PITCHER",
    desc: "`코너를 노린다` −8%p", how: "그 선택으로 5패",
    effect: { clutchOption: { corner: -0.08 } },
    gain: (c) => c.opt("corner").lose >= 5,
    lose: (c) => c.ability("control") >= 85,
  },

  /* --- B. 시즌 시뮬레이션 (작게) --- */
  {
    id: "power_hitter", name: "한 방이 있다", icon: "🔥", kind: "HITTER",
    desc: "홈런이 6% 더 나온다", how: "28홈런 2시즌 또는 홈런왕",
    effect: { hrMul: 1.06 },
    gain: (c) => c.seasons((r) => H(r).hr >= 28) >= 2 || c.awards("홈런왕") > 0,
  },
  {
    id: "hit_machine", name: "안타 제조기", icon: "🔥", kind: "HITTER",
    desc: "인플레이 타구가 더 안타가 된다", how: "165안타 2시즌 또는 타격왕",
    effect: { babipAdd: 0.008 },
    gain: (c) => c.seasons((r) => H(r).h >= 165) >= 2 || c.awards("타격왕") > 0,
  },
  {
    id: "burner", name: "대도", icon: "🔥", kind: "HITTER",
    desc: "도루를 20% 더 시도한다", how: "25도루 시즌",
    effect: { sbMul: 1.2 },
    gain: (c) => c.seasons((r) => H(r).sb >= 25) >= 1,
    lose: (c) => c.ability("speed") < 70,
  },
  {
    id: "gold_glove", name: "철벽 수비", icon: "🔥", kind: "HITTER",
    desc: "수비로 벌어들이는 값이 15% 크다", how: "골든글러브 2회",
    effect: { defMul: 1.15 },
    gain: (c) => c.awards("골든글러브") >= 2,
    lose: (c) => c.ability("defense") < 68,
  },
  {
    id: "k_machine", name: "탈삼진 머신", icon: "🔥", kind: "PITCHER",
    desc: "9이닝당 탈삼진 +0.4", how: "탈삼진왕 또는 180K 2시즌",
    effect: { k9Add: 0.4 },
    gain: (c) => c.awards("탈삼진왕") > 0 || c.seasons((r) => P(r).so >= 180) >= 2,
  },
  {
    id: "grounder", name: "땅볼 유도", icon: "🔥", kind: "PITCHER",
    desc: "피홈런이 8% 적다", how: "규정이닝에서 피홈런 14개 이하 2시즌",
    effect: { hr9Mul: 0.92 },
    gain: (c) => c.seasons((r) => P(r).ip >= 130 && P(r).hrAllowed <= 14) >= 2,
  },
  {
    id: "workhorse", name: "이닝이터", icon: "🔥", kind: "PITCHER",
    desc: "등판마다 0.25이닝을 더 던진다", how: "180이닝 2시즌 또는 최다이닝",
    effect: { ipPerStartAdd: 0.25 },
    gain: (c) => c.awards("최다이닝") > 0 || c.seasons((r) => P(r).ip >= 180) >= 2,
    lose: (c) => c.ability("stamina") < 70,
  },
  {
    id: "gopher", name: "피홈런 체질", icon: "💧", blue: true, kind: "PITCHER",
    desc: "피홈런이 10% 많다", how: "시즌 25피홈런 2회",
    effect: { hr9Mul: 1.10 },
    gain: (c) => c.seasons((r) => P(r).hrAllowed >= 25) >= 2,
  },
  {
    id: "strikeout_prone", name: "헛스윙이 늘었다", icon: "💧", blue: true, kind: "HITTER",
    desc: "삼진이 1.5%p 늘어난다", how: "110삼진 3시즌",
    effect: { soAdd: 0.015 },
    gain: (c) => c.seasons((r) => H(r).so >= 110) >= 3,
    lose: (c) => c.ability("contact") >= 85,
  },

  /* --- C. 커리어 --- */
  {
    id: "leader", name: "라커룸 리더", icon: "🔥",
    desc: "매 시즌 구단 신뢰 +3 · 동료 관계 +2", how: "주장 완장을 차고 10시즌 이상",
    effect: { trustPerSeason: 3, teammatePerSeason: 2 },
    gain: (c) => c.kbo.length >= 10 && c.s.logs.some((l) => l.title.includes("주장 선임")),
  },
  {
    id: "franchise", name: "팀의 얼굴", icon: "🔥",
    desc: "원소속팀 FA 제안이 20% 크다", how: "한 팀에서 15시즌",
    effect: { faHome: 1.2 },
    gain: (c) => c.longestStay >= 15,
  },
  {
    id: "media", name: "언론 친화", icon: "🔥",
    desc: "인지도가 25% 빠르게 오른다", how: "인지도 90 · 올스타 5회 · 광고 촬영 경험",
    effect: { fameMul: 1.25 },
    gain: (c) => c.s.player.fame >= 90 && c.awards("올스타") >= 5 && c.s.logs.some((l) => l.title.includes("광고 촬영")),
  },
  {
    id: "quick_heal", name: "회복력", icon: "🔥",
    desc: "부상 결장 기간이 25% 짧다", how: "심각한 부상에서 돌아와 WAR 3 이상",
    effect: { missMul: 0.75 },
    gain: (c) => c.kbo.some((r) => (r.note ?? "").includes("심각")) && c.kbo.some((r) => r.line.war >= 3),
  },
  {
    id: "latebloom_x", name: "늦게 피는 꽃", icon: "🔥",
    desc: "서른하나부터 노쇠가 20% 더디다", how: "32세 이후 자기 최고 WAR 경신",
    effect: { declineMul: 0.8 },
    gain: (c) => {
      let best = 0;
      for (const r of c.kbo) { if (r.age >= 32 && r.line.war > best) return true; best = Math.max(best, r.line.war); }
      return false;
    },
  },
  {
    id: "grinder", name: "연습 벌레", icon: "🔥",
    desc: "훈련이 잘 풀릴 확률이 오른다", how: "훈련 대성공 3회",
    effect: { trainTilt: 0.35 },
    gain: (c) => c.s.logs.filter((l) => l.title.includes("훈련 대성공")).length >= 3,
  },
  {
    id: "brittle", name: "부상 체질", icon: "💧", blue: true,
    desc: "부상 확률이 15% 높다", how: "심각한 부상 2회",
    effect: { injuryMul: 1.15 },
    gain: (c) => c.kbo.filter((r) => (r.note ?? "").includes("심각")).length >= 2,
    lose: (c) => c.kbo.slice(-4).length === 4 && c.kbo.slice(-4).every((r) => !r.note?.includes("부상")),
  },
  {
    id: "fading", name: "노쇠 가속", icon: "💧", blue: true,
    desc: "서른셋부터 낙폭이 20% 크다", how: "33세 이후 3년 연속 하락 · 최고의 25% 미만",
    effect: { declineMul: 1.2 },
    gain: (c) => {
      for (let i = 2; i < c.kbo.length; i++) {
        const a = c.kbo[i], b = c.kbo[i - 1], d = c.kbo[i - 2];
        if (a.age >= 33 && a.line.war < b.line.war && b.line.war < d.line.war && a.line.war < d.line.war * 0.25) return true;
      }
      return false;
    },
  },
];

export const abilityById = (id: string) => ABILITIES.find((a) => a.id === id);

/** 지금 들고 있는 능력들의 효과를 한 덩어리로 합친다 */
export function mergeEffects(ids: string[] | undefined | null): AbilityEffect {
  const out: AbilityEffect = {};
  for (const id of ids ?? []) {
    const e = abilityById(id)?.effect;
    if (!e) continue;
    for (const [k, v] of Object.entries(e) as [keyof AbilityEffect, unknown][]) {
      if (k === "clutchTag" || k === "clutchOption") {
        const dst = (out[k] ??= {}) as Record<string, number>;
        for (const [t, n] of Object.entries(v as Record<string, number>)) dst[t] = (dst[t] ?? 0) + n;
      } else if (k.endsWith("Mul")) {
        (out as Record<string, number>)[k] = ((out as Record<string, number>)[k] ?? 1) * (v as number);
      } else {
        (out as Record<string, number>)[k] = ((out as Record<string, number>)[k] ?? 0) + (v as number);
      }
    }
  }
  return out;
}

/**
 * 이 장면에서 실제로 걸리는 보정과, 그걸 만든 능력들.
 * 화면에 근거를 그대로 보여주려고 목록도 함께 돌려준다.
 */
export function clutchBonus(
  ids: string[] | undefined | null, tags: readonly string[] | undefined, optionId: string,
): { bonus: number; from: AbilityDef[] } {
  const from: AbilityDef[] = [];
  let raw = 0;
  for (const id of ids ?? []) {
    const a = abilityById(id);
    if (!a) continue;
    let v = 0;
    for (const t of tags ?? []) v += a.effect.clutchTag?.[t as ClutchTag] ?? 0;
    v += a.effect.clutchOption?.[optionId] ?? 0;
    if (v !== 0) { raw += v; from.push(a); }
  }
  // 겹쳐도 한 장면에서 ±20%p를 넘지 않는다 (실측: 걸리는 장면 1.8%)
  const bonus = Math.max(-CLUTCH_CAP, Math.min(CLUTCH_CAP, raw));
  return { bonus, from };
}
