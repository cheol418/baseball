import { RNG, clamp, n50 } from "./rng";
import { roleTier } from "./roles";
import type {
  Abilities, AbilityKey, ArmSlot, Hand, Kind, LevelTag, Player, Position, TrainingOption,
} from "./types";

/** 능력치 상한 — 이 값까지 성장할 수 있다 */
export const ABILITY_MAX = 120;

export const HITTER_KEYS: AbilityKey[] = ["contact", "power", "eye", "speed", "defense", "arm"];
export const PITCHER_KEYS: AbilityKey[] = ["velocity", "control", "movement", "breaking", "stamina", "fielding"];
export const COMMON_KEYS: AbilityKey[] = ["durability", "mental"];

export const ABILITY_LABEL: Record<string, string> = {
  contact: "컨택", power: "파워", eye: "선구", speed: "주력", defense: "수비", arm: "송구",
  velocity: "구속", control: "제구", movement: "무브먼트", breaking: "변화구", stamina: "스태미나", fielding: "투수수비",
  durability: "내구성", mental: "멘탈",
};

export const abilityKeys = (kind: Kind): AbilityKey[] =>
  [...(kind === "HITTER" ? HITTER_KEYS : PITCHER_KEYS), ...COMMON_KEYS];

export const HITTER_POSITIONS: { id: Position; label: string }[] = [
  { id: "C", label: "포수" }, { id: "1B", label: "1루수" }, { id: "2B", label: "2루수" },
  { id: "3B", label: "3루수" }, { id: "SS", label: "유격수" }, { id: "LF", label: "좌익수" },
  { id: "CF", label: "중견수" }, { id: "RF", label: "우익수" }, { id: "DH", label: "지명타자" },
];
export const PITCHER_POSITIONS: { id: Position; label: string }[] = [
  { id: "SP", label: "선발투수" }, { id: "RP", label: "중간계투" }, { id: "CP", label: "마무리" },
];

export const POSITION_LABEL: Record<string, string> = Object.fromEntries(
  [...HITTER_POSITIONS, ...PITCHER_POSITIONS].map((p) => [p.id, p.label]),
);

export const HAND_LABEL: Record<Hand, string> = { R: "우", L: "좌", S: "양" };

/**
 * 투구폼 — 팔 각도에 따라 구위와 공의 성질이 달라진다.
 *
 * 위에서 내리꽂을수록 구속과 탈삼진이 늘고, 옆·아래로 갈수록
 * 구속은 줄지만 공이 지저분해져 땅볼을 유도하고 피홈런이 줄어든다.
 */
export interface ArmSlotDef {
  id: ArmSlot;
  name: string;
  desc: string;
  weights: Partial<Record<AbilityKey, number>>;
  /** 시뮬레이션 보정 배수 */
  k9: number;
  hr9: number;
  bb9: number;
}

export const ARM_SLOTS: ArmSlotDef[] = [
  {
    id: "OVER", name: "오버핸드",
    desc: "정통파. 가장 빠른 공과 낙차 큰 변화구로 삼진을 잡는다.",
    weights: { velocity: 6, breaking: 5, stamina: 2, control: -6, movement: -7 },
    k9: 1.07, hr9: 1.06, bb9: 1.04,
  },
  {
    id: "THREE_QUARTER", name: "스리쿼터",
    desc: "가장 무난한 각도. 구속과 제구의 균형이 좋다.",
    weights: { velocity: 2, control: 3, movement: 2, breaking: -4, stamina: -3 },
    k9: 1.0, hr9: 1.0, bb9: 1.0,
  },
  {
    id: "SIDE", name: "사이드암",
    desc: "옆구리에서 나오는 공. 구속은 낮아도 타자가 공을 보기 어렵다.",
    weights: { velocity: -8, movement: 9, control: 4, breaking: -3, stamina: -2 },
    k9: 0.9, hr9: 0.84, bb9: 0.95,
  },
  {
    id: "UNDER", name: "언더핸드",
    desc: "아래에서 솟아오르는 공. 삼진은 적지만 땅볼로 이닝을 지운다.",
    weights: { velocity: -12, movement: 13, control: 6, breaking: -5, stamina: -2 },
    k9: 0.8, hr9: 0.7, bb9: 0.9,
  },
];

export const armSlotById = (id?: ArmSlot): ArmSlotDef =>
  ARM_SLOTS.find((a) => a.id === id) ?? ARM_SLOTS[1];

export const ARM_SLOT_LABEL: Record<ArmSlot, string> =
  Object.fromEntries(ARM_SLOTS.map((a) => [a.id, a.name])) as Record<ArmSlot, string>;

/**
 * 투구폼별 좌우 편차(플래툰 스플릿).
 * 팔이 옆·아래로 내려갈수록 같은 손 타자는 공을 보기 어렵고,
 * 반대 손 타자는 공이 몸쪽에서 열려 들어와 훨씬 잘 친다.
 */
export const SLOT_PLATOON: Record<ArmSlot, number> = {
  OVER: 0.07,
  THREE_QUARTER: 0.12,
  SIDE: 0.26,
  UNDER: 0.34,
};

/** KBO 타석 구성 — 좌타가 많은 편이다 */
export const LEAGUE_LEFT_BATTER_SHARE = 0.42;

export interface PlatoonProfile {
  gap: number;
  /** 우타 상대 우위 (양수면 강함) */
  vsRight: number;
  /** 좌타 상대 우위 */
  vsLeft: number;
  strongSide: "우타" | "좌타";
  weakSide: "우타" | "좌타";
  /** 0(차이 없음) ~ 1(극단적) */
  severity: number;
}

/** 투수의 좌우 상대 편차 */
export function platoonProfile(p: Player): PlatoonProfile {
  const gap = SLOT_PLATOON[p.armSlot ?? "THREE_QUARTER"];
  const throwsR = p.throws !== "L";
  const half = gap / 2;
  return {
    gap,
    vsRight: throwsR ? half : -half,
    vsLeft: throwsR ? -half : half,
    strongSide: throwsR ? "우타" : "좌타",
    weakSide: throwsR ? "좌타" : "우타",
    severity: clamp((gap - 0.07) / 0.27, 0, 1),
  };
}

/**
 * 실제로 마주하는 타석 구성까지 반영한 순이익.
 *
 * 선발은 좌우를 가리지 않고 다 상대해야 하지만, 불펜은 감독이
 * 유리한 매치업에 끼워 넣어 주기 때문에 편차가 오히려 무기가 된다.
 */
export function platoonEdge(p: Player, role: string): number {
  const { gap } = platoonProfile(p);
  const throwsR = p.throws !== "L";
  const sameHandShare = throwsR ? 1 - LEAGUE_LEFT_BATTER_SHARE : LEAGUE_LEFT_BATTER_SHARE;
  const shelter = role.includes("선발") ? 0 : 0.18; // 불펜·마무리는 상대를 고를 수 있다
  const share = clamp(sameHandShare + shelter, 0, 0.85);
  return (share - 0.5) * gap * 2;
}

/** 타자의 좌우 이점 — 투수 대부분이 우완이라 좌타·스위치가 유리하다 */
export function batterPlatoonBonus(p: Player): number {
  return p.bats === "S" ? 2.4 : p.bats === "L" ? 1.8 : 0;
}

/** 선수 유형 — 생성 시 능력치 가중치를 결정 */
export interface StyleDef {
  id: string;
  name: string;
  desc: string;
  kind: Kind;
  weights: Partial<Record<AbilityKey, number>>;
}

export const STYLES: StyleDef[] = [
  /* ---- 타자 ---- */
  { id: "contact", name: "교타자", desc: "정확한 컨택으로 안타를 쌓는다", kind: "HITTER", weights: { contact: 14, eye: 5, speed: 3, power: -7 } },
  { id: "onbase", name: "출루형", desc: "볼을 골라 나가는 리드오프", kind: "HITTER", weights: { eye: 14, contact: 7, speed: 4, power: -8, arm: -3 } },
  { id: "slugger", name: "거포", desc: "한 방을 노리는 장거리 타자", kind: "HITTER", weights: { power: 16, contact: -2, eye: 4, speed: -5, defense: -2 } },
  { id: "gap", name: "중장거리형", desc: "담장을 맞히는 2루타 생산자", kind: "HITTER", weights: { power: 9, contact: 8, eye: 3, speed: 2, defense: -2 } },
  { id: "toolsy", name: "호타준족", desc: "치고 달리는 만능형", kind: "HITTER", weights: { speed: 11, contact: 4, power: 3, defense: 4 } },
  { id: "speedster", name: "대도", desc: "발 하나로 상대를 흔든다", kind: "HITTER", weights: { speed: 17, contact: 5, defense: 3, power: -10, arm: -2 } },
  { id: "defense", name: "수비형", desc: "글러브로 먹고사는 내야의 핵", kind: "HITTER", weights: { defense: 15, arm: 6, contact: -3, power: -7 } },
  { id: "cannon", name: "강견형", desc: "주자를 묶어 세우는 어깨", kind: "HITTER", weights: { arm: 16, defense: 8, power: 2, contact: -5, speed: -4 } },
  { id: "ironman_h", name: "철인형", desc: "다치지 않고 매 경기 나간다", kind: "HITTER", weights: { durability: 15, mental: 7, contact: 4, speed: -3, power: -3 } },
  { id: "clutch_h", name: "해결사", desc: "큰 경기, 중요한 타석에서 강하다", kind: "HITTER", weights: { mental: 15, power: 6, contact: 4, eye: 2, speed: -4 } },

  /* ---- 투수 ---- */
  { id: "power_p", name: "파워피처", desc: "빠른 공으로 윽박지른다", kind: "PITCHER", weights: { velocity: 15, breaking: 3, control: -7, stamina: -3 } },
  { id: "control_p", name: "제구형", desc: "코너워크로 승부하는 투수", kind: "PITCHER", weights: { control: 14, movement: 5, velocity: -7 } },
  { id: "finesse_p", name: "기교파", desc: "다양한 변화구로 타자를 속인다", kind: "PITCHER", weights: { breaking: 13, movement: 7, velocity: -6 } },
  { id: "ground_p", name: "땅볼유도형", desc: "무브먼트로 방망이를 눌러 앉힌다", kind: "PITCHER", weights: { movement: 15, control: 6, fielding: 4, velocity: -5, breaking: -3 } },
  { id: "horse_p", name: "이닝이터", desc: "많은 이닝을 소화하는 내구형", kind: "PITCHER", weights: { stamina: 15, durability: 8, velocity: -4, breaking: -4 } },
  { id: "strikeout_p", name: "탈삼진형", desc: "구위와 변화구로 삼진을 잡는다", kind: "PITCHER", weights: { velocity: 9, breaking: 10, control: -4, stamina: -3 } },
  { id: "crafty_p", name: "노련형", desc: "완급 조절과 배짱으로 버틴다", kind: "PITCHER", weights: { mental: 14, control: 8, movement: 4, velocity: -8 } },
  { id: "rubber_p", name: "고무팔", desc: "연투에도 구위가 떨어지지 않는다", kind: "PITCHER", weights: { durability: 16, stamina: 7, control: 3, breaking: -4, velocity: -3 } },
];

export interface TraitDef { id: string; name: string; desc: string; rarity: number }

export const TRAITS: TraitDef[] = [
  { id: "genius", name: "천재", desc: "어린 나이에 빠르게 성장한다", rarity: 6 },
  { id: "latebloom", name: "대기만성", desc: "30대에도 성장이 멈추지 않는다", rarity: 8 },
  { id: "clutch", name: "승부사", desc: "중요한 순간에 강하다 (타점·승리 보정)", rarity: 10 },
  { id: "ironman", name: "철강왕", desc: "좀처럼 다치지 않는다", rarity: 10 },
  { id: "glass", name: "유리몸", desc: "재능은 높지만 부상이 잦다", rarity: 10 },
  { id: "hardworker", name: "노력형", desc: "훈련 효율이 20% 높다", rarity: 12 },
  { id: "star", name: "스타성", desc: "인기가 빠르게 오르고 연봉 협상에 유리하다", rarity: 10 },
  { id: "coldblood", name: "강심장", desc: "멘탈이 흔들리지 않는다", rarity: 10 },
  { id: "normal", name: "평범", desc: "특별할 것 없는 평범한 선수", rarity: 24 },
];

/**
 * 지금 능력치 분포에서 가장 두드러진 유형을 뽑아낸다.
 *
 * 유형은 생성 시 고정되는 값이 아니라 **현재 능력치의 결과**다.
 * 파워피처로 시작해도 제구만 파고들면 제구형으로 바뀐다.
 */
export function deriveStyle(p: Player): StyleDef {
  const pool = STYLES.filter((st) => st.kind === p.kind);
  const keys = abilityKeys(p.kind);
  const vals = keys.map((k) => getAb(p.abilities, k));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;

  let best = pool[0];
  let bestScore = -Infinity;
  for (const st of pool) {
    // 가중치 벡터를 단위 길이로 맞춘다 — 그러지 않으면 가중치를 크게 준 유형이
    // 실제 선수 성향과 무관하게 항상 이긴다
    const norm = Math.sqrt(keys.reduce((a, k) => a + (st.weights[k] ?? 0) ** 2, 0)) || 1;
    let score = 0;
    for (const k of keys) {
      score += ((st.weights[k] ?? 0) / norm) * ((getAb(p.abilities, k) - mean) / sd);
    }
    if (score > bestScore) { bestScore = score; best = st; }
  }
  return best;
}

/** 유형별 어울리는 포지션 — 생성 화면에서 "추천"으로 안내한다 */
export const RECOMMENDED_POSITIONS: Record<string, Position[]> = {
  contact: ["2B", "CF", "LF", "3B"],
  slugger: ["1B", "DH", "RF", "LF"],
  toolsy: ["CF", "RF", "SS"],
  defense: ["C", "SS", "2B", "CF"],
  power_p: ["SP", "CP"],
  control_p: ["SP"],
  finesse_p: ["SP", "RP"],
  horse_p: ["SP"],
};

/* ------------------------------------------------------------------ */
/* 스카우팅 — 잠재력은 정확히 알 수 없다                                 */
/* ------------------------------------------------------------------ */

/** (시드, 능력)으로 고정된 편향값 -1 ~ 1 */
function bias(seed: number, key: string): number {
  let h = 2166136261 ^ seed;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (((h >>> 0) % 2000) / 1000) - 1;
}

export interface ScoutedPotential {
  lo: number;
  hi: number;
  /** 프로에서 충분히 뛰어 확정된 값인가 */
  known: boolean;
}

/**
 * 스카우트가 보는 잠재력.
 * 프로에서 시즌을 보낼수록 평가가 좁혀지고, 결국 실제 값이 드러난다.
 */
export function scoutedPotential(
  p: Player, k: AbilityKey, proYears: number, seed: number,
): ScoutedPotential {
  const real = getAb(p.potential, k);
  const cur = getAb(p.abilities, k);
  const width = clamp(17 - proYears * 2.6, 0, 17);
  if (width <= 0.5) return { lo: real, hi: real, known: true };
  const center = real + bias(seed, k) * width * 0.45;
  return {
    // 이미 도달한 수치보다 낮게 보일 수는 없다
    lo: Math.max(cur, Math.round(center - width)),
    hi: Math.min(ABILITY_MAX, Math.round(center + width)),
    known: false,
  };
}

/** 잠재 OVR을 범위로 */
export function scoutedOverall(p: Player, proYears: number, seed: number) {
  const keys = abilityKeys(p.kind);
  const lo = { ...p.potential } as Abilities;
  const hi = { ...p.potential } as Abilities;
  let known = true;
  for (const k of keys) {
    const sc = scoutedPotential(p, k, proYears, seed);
    setAb(lo, k, sc.lo);
    setAb(hi, k, sc.hi);
    if (!sc.known) known = false;
  }
  return {
    lo: overall({ ...p, abilities: lo }),
    hi: overall({ ...p, abilities: hi }),
    known,
  };
}

export const traitById = (id: string) => TRAITS.find((t) => t.id === id) ?? TRAITS[TRAITS.length - 1];

const ZERO: Abilities = {
  contact: 0, power: 0, eye: 0, speed: 0, defense: 0, arm: 0,
  velocity: 0, control: 0, movement: 0, breaking: 0, stamina: 0, fielding: 0,
  durability: 0, mental: 0,
} as unknown as Abilities;

export const getAb = (a: Abilities, k: AbilityKey): number =>
  (a as unknown as Record<string, number>)[k] ?? 0;
export const setAb = (a: Abilities, k: AbilityKey, v: number) => {
  (a as unknown as Record<string, number>)[k] = v;
};

export interface CreateOptions {
  name: string;
  number: number;
  kind: Kind;
  position: Position;
  bats: Hand;
  throws: Hand;
  styleId: string;
  /** 투수만 사용 */
  armSlot?: ArmSlot;
  /**
   * 완성도 ↔ 성장 여지 축. −1 완성형(즉시 전력) · 0 균형형 · +1 원석형(대기만성).
   * 이게 없으면 재능이 시작 능력치와 잠재력을 함께 올려버려,
   * OVR이 낮은 후보가 재능·잠재력까지 낮은 "그냥 나쁜 선수"가 된다.
   */
  bias?: number;
}

/** 후보 유형 — 생성 화면에서 셋을 나란히 보여준다 */
/** 후보 한 명이 특급 유망주로 나올 확률 — 셋 중 하나라도 나올 확률은 약 20% */
export const GIFTED_ODDS = 0.07;

export const CANDIDATE_KINDS = [
  { bias: -1, name: "완성형", desc: "지금 당장 쓸 수 있지만 천장이 낮다" },
  { bias: 0, name: "균형형", desc: "무난한 출발과 무난한 성장" },
  { bias: 1, name: "원석형", desc: "지금은 거칠지만 크게 자랄 수 있다" },
] as const;

/** 고교 3학년 선수 후보 1명 생성 */
export function rollCandidate(opts: CreateOptions, rng: RNG): Player {
  const style = STYLES.find((s) => s.id === opts.styleId) ?? STYLES[0];
  const keys = abilityKeys(opts.kind);
  // 재능이 높을수록 지금은 덜 완성되어 있고, 대신 자랄 여지가 크다
  const bias = opts.bias ?? 0;

  /**
   * 특급 유망주.
   *
   * 완성도와 성장 여지는 원칙적으로 맞바꿈이지만, 가끔은 **둘 다 갖춘 선수**가 나온다.
   * 드물게 터져야 "다시 뽑기"에 의미가 생기고, 만났을 때 반갑다.
   */
  const gifted = rng.chance(GIFTED_ODDS);
  const talent = clamp(
    0.75 + rng.normal() * 0.13 + bias * 0.16 + (gifted ? 0.14 : 0),
    0.6, 1.45,
  );
  // 투수는 투구폼이 능력치 배분에 함께 반영된다
  const slot = opts.kind === "PITCHER" ? armSlotById(opts.armSlot) : null;

  const abilities = { ...ZERO } as Abilities;
  const potential = { ...ZERO } as Abilities;

  for (const k of keys) {
    const w = (style.weights[k] ?? 0) + (slot?.weights[k] ?? 0);
    const base = 52 + w * 0.9 + rng.normal() * 7 + (talent - 1) * 14
      - bias * 7 + (gifted ? 5 : 0);
    const cur = clamp(Math.round(base), 22, 80);
    // 포텐셜은 현재치 + 재능/랜덤
    const room = 4 + talent * 21 + rng.float(0, 15) + (w > 0 ? 7 : 0)
      + bias * 8 + (gifted ? 6 : 0);
    setAb(abilities, k, cur);
    setAb(potential, k, clamp(Math.round(cur + room), cur + 5, ABILITY_MAX));
  }
  // 내구성/멘탈 보정
  setAb(abilities, "durability", clamp(getAb(abilities, "durability") + rng.int(0, 8), 20, 85));

  const trait = rng.weighted(TRAITS, TRAITS.map((t) => t.rarity));
  if (trait.id === "glass") {
    for (const k of keys) setAb(potential, k, clamp(getAb(potential, k) + 9, 0, ABILITY_MAX));
    setAb(abilities, "durability", clamp(getAb(abilities, "durability") - 18, 12, ABILITY_MAX));
    setAb(potential, "durability", clamp(getAb(potential, "durability") - 20, 12, ABILITY_MAX));
  }
  if (trait.id === "ironman") {
    setAb(abilities, "durability", clamp(getAb(abilities, "durability") + 14, 0, ABILITY_MAX));
    setAb(potential, "durability", clamp(getAb(potential, "durability") + 14, 0, ABILITY_MAX));
  }
  if (trait.id === "coldblood") setAb(abilities, "mental", clamp(getAb(abilities, "mental") + 15, 0, ABILITY_MAX));

  return {
    name: opts.name,
    number: opts.number,
    kind: opts.kind,
    position: opts.position,
    bats: opts.bats,
    throws: opts.throws,
    armSlot: opts.kind === "PITCHER" ? (opts.armSlot ?? "THREE_QUARTER") : undefined,
    age: 18,
    abilities,
    potential,
    talent,
    gifted,
    fame: trait.id === "star" ? 18 : 8,
    condition: 80,
    injury: 0,
    trait: trait.id,
    traitDesc: trait.desc,
  };
}

/** 능력치 총합 기반 종합 등급 (OVR) */
/**
 * 투구폼별 능력치 가중치.
 * 오버핸드는 구속으로 먹고살지만 언더핸드는 무브먼트와 제구가 본체다.
 * 같은 잣대로 재면 옆구리·언더 투수가 부당하게 저평가된다.
 */
const PITCH_WEIGHTS: Record<ArmSlot, Record<string, number>> = {
  OVER: { velocity: 1.35, control: 1.0, movement: 0.9, breaking: 1.15 },
  THREE_QUARTER: { velocity: 1.2, control: 1.2, movement: 1.0, breaking: 1.05 },
  SIDE: { velocity: 0.95, control: 1.25, movement: 1.35, breaking: 0.95 },
  UNDER: { velocity: 0.8, control: 1.3, movement: 1.55, breaking: 0.85 },
};

export function overall(p: Player): number {
  const keys = abilityKeys(p.kind);
  const w: Record<string, number> = p.kind === "HITTER"
    ? { contact: 1.25, power: 1.15, eye: 0.85, speed: 0.75, defense: 0.85, arm: 0.5, durability: 0.7, mental: 0.55 }
    : {
        ...PITCH_WEIGHTS[p.armSlot ?? "THREE_QUARTER"],
        stamina: 0.85, fielding: 0.35, durability: 0.75, mental: 0.6,
      };
  let sum = 0, tw = 0;
  for (const k of keys) { sum += getAb(p.abilities, k) * (w[k] ?? 1); tw += w[k] ?? 1; }
  return Math.round(sum / tw);
}

export function potentialOverall(p: Player): number {
  return overall({ ...p, abilities: p.potential });
}

/**
 * 등급 — 1군에서의 위치에 맞춘다.
 * S 리그 최정상 / A 올스타급 / B 주전 / C 준주전 / D 백업 / E 2군
 */
export const gradeOf = (ovr: number) =>
  ovr >= 95 ? "S" : ovr >= 87 ? "A" : ovr >= 79 ? "B" : ovr >= 69 ? "C" : ovr >= 55 ? "D" : "E";

/**
 * 능력치별 에이징 프로파일.
 *
 * 실제 야구 연구를 반영한다 — 능력마다 꺾이는 시점이 완전히 다르다.
 *  · 주력·수비는 20대 중반에 이미 하락 시작 (가장 빠르고 가파름)
 *  · 컨택은 27~28세, 파워(타구 속도)는 30세 전후까지 유지
 *  · 선구안·제구·변화구 같은 "기술"은 30대까지도 계속 좋아진다
 *
 * peak       : 그 능력이 정점을 찍는 나이
 * declineMul : 하락기 하락 폭 배수 (1보다 크면 더 빨리 무너진다)
 */
export const AGE_PROFILE: Record<string, { peak: number; declineMul: number }> = {
  // 타자
  speed: { peak: 25, declineMul: 1.5 },
  defense: { peak: 26, declineMul: 1.2 },
  arm: { peak: 27, declineMul: 1.05 },
  contact: { peak: 29, declineMul: 0.9 },
  power: { peak: 30, declineMul: 0.8 },
  eye: { peak: 33, declineMul: 0.5 },
  // 투수
  velocity: { peak: 26, declineMul: 1.4 },
  stamina: { peak: 28, declineMul: 1.1 },
  fielding: { peak: 29, declineMul: 0.9 },
  movement: { peak: 30, declineMul: 0.8 },
  breaking: { peak: 32, declineMul: 0.6 },
  control: { peak: 33, declineMul: 0.5 },
  // 공통
  durability: { peak: 26, declineMul: 1.3 },
  mental: { peak: 35, declineMul: 0.3 },
};

/** 프로파일이 기준으로 삼는 나이 — 이 나이에 고원의 한가운데에 있다 */
const REFERENCE_PEAK = 30;

/**
 * 나이에 따른 성장 계수.
 *
 * 곡선 모양: 10대 후반~20대 초반 급성장 → 25~31세 고원 → 32세부터 하락.
 * 최근 연구가 말하는 "성장 구간은 짧고, 정점에 도달한 뒤 한동안 유지되다
 * 30대 초반에 꺾인다"는 형태를 따른다.
 *
 * @param key 능력치 이름. 주면 해당 능력의 피크 나이만큼 곡선을 평행 이동한다.
 */
export function ageFactor(age: number, trait: string, key?: AbilityKey): number {
  const profile = key ? AGE_PROFILE[key] : undefined;
  // 피크가 이른 능력(주력)은 나이를 더 먹은 것처럼, 늦은 능력(선구안)은 덜 먹은 것처럼 취급
  let refAge = age + (REFERENCE_PEAK - (profile?.peak ?? REFERENCE_PEAK));
  if (trait === "latebloom") refAge -= 2.5; // 대기만성: 전 능력의 피크가 늦다

  let f: number;
  if (refAge <= 20) f = 2.1;
  else if (refAge <= 22) f = 1.7;
  else if (refAge <= 24) f = 1.15;
  else if (refAge <= 26) f = 0.62;
  else if (refAge <= 28) f = 0.38;
  else if (refAge <= 31) f = 0.22; // 고원 — 늦게 피크를 맞는 기술 능력이 계속 오른다
  else if (refAge <= 33) f = -0.7;
  else if (refAge <= 35) f = -1.5;
  else if (refAge <= 37) f = -2.4;
  else f = -3.4;

  if (trait === "genius" && age <= 22) f += 0.55;
  if (f < 0) f *= profile?.declineMul ?? 1;
  return f;
}

/**
 * 한 시즌을 어디서 어떻게 보냈는지에 따른 성장 배수.
 *
 * 원칙 두 가지:
 *  1. 1군은 어느 보직이든 2군보다 불리하지 않다. 콜업이 손해가 되면 안 된다.
 *  2. 대신 **어린 유망주**는 2군에서 매일 뛰며 가장 빨리 큰다 — 빨리 자라 1군에 올라오라는 구조.
 *     나이를 먹고도 2군에 머물면 그 이점은 사라지고 오히려 정체된다.
 */
export function developmentRate(
  level: LevelTag | null, role: string | null, age = 24,
): number {
  if (!level) return 1;
  switch (level) {
    // 아마추어 시절은 출발점이 이미 높은 대신 성장 폭을 줄였다 —
    // 대학 한 시즌에 OVR이 +16씩 뛰면 성장이 아니라 순간이동처럼 보인다
    case "HS": return 0.78;
    case "COLLEGE": return 0.74;
    case "MINOR":
      // 유망주 구간에서만 퓨처스 풀타임의 이점이 크다
      if (age <= 21) return 1.4;
      if (age <= 24) return 1.0;
      return 0.82;
    case "ARMY": return role === "복무" ? 0.6 : 1.02; // 상무는 퓨처스에서 계속 뛴다
    case "KBO": {
      // 입지가 단단할수록 전담 코치가 붙고 실전 기회도 많다
      const tier = roleTier(role);
      if (tier >= 6) return 1.15; // 간판·에이스 — 구단이 전력으로 관리한다
      if (tier >= 5) return 1.09;
      if (tier >= 4) return 1.04;
      if (tier >= 3) return 1.0;
      return 0.94; // 백업·추격조는 출장이 적어 실전 성장이 더디다
    }
    default: return 1;
  }
}

export const DEV_RATE_LABEL = (rate: number) =>
  rate >= 1.25 ? "매우 빠름" : rate >= 1.08 ? "빠름" : rate >= 0.95 ? "보통" : "더딤";

/** 오프시즌 성장 처리 */
export function grow(
  p: Player, rng: RNG, focus: TrainingOption | null, devRate = 1,
  /** 지옥 훈련 배수 — 성공 2.3배 · 실패 0.3배 · 평시 1배 */
  hellMul = 1,
): { deltas: Partial<Record<string, number>> } {
  const keys = abilityKeys(p.kind);
  const effBonus = p.trait === "hardworker" ? 1.2 : 1;
  const deltas: Record<string, number> = {};

  /**
   * 한계 돌파 — 잠재력은 스카우트의 추정일 뿐 진짜 천장이 아니다.
   * 벽에 부딪힌 채로 몸을 갈아 넣으면 아주 가끔 한 칸씩 열린다.
   * 이게 없으면 20대 중반에 모든 능력이 잠재력에 닿아 "성장 여지 0"으로
   * 커리어의 절반이 정지한다. (실제로 27세에 전 항목 0이 되는 일이 잦았다)
   */
  const breakable = p.age <= 31;
  const breakOdds = clamp(
    (p.trait === "latebloom" ? 0.26 : p.trait === "genius" ? 0.22 : 0.15)
    * (0.6 + p.talent * 0.5) * devRate,
    0.06, 0.8,
  );

  for (const k of keys) {
    const af = ageFactor(p.age, p.trait, k);
    const cur = getAb(p.abilities, k);
    let pot = getAb(p.potential, k);

    // 잠재력에 닿은 능력을 집중 훈련하면 천장 자체가 조금 밀린다.
    // 노쇠가 시작된 능력이라도 천장이 열려 있어야 훈련으로 방어가 되므로 af는 따지지 않는다.
    if (breakable && pot - cur <= 4 && pot < ABILITY_MAX) {
      const pushing = focus?.targets.includes(k) ?? false;
      if (rng.chance(breakOdds * (pushing ? 1 : 0.45))) {
        pot = clamp(pot + rng.int(1, pushing ? 5 : 3), 15, ABILITY_MAX);
        setAb(p.potential, k, pot);
      }
    }
    const headroom = clamp(Math.max(0, pot - cur) / 55, 0, 1.2); // 포텐셜에 가까울수록 둔화
    // 주력 능력은 그대로, 곁가지는 절반만 오른다
    const share = !focus ? 0
      : (focus.main ?? focus.targets).includes(k) ? 1
        : focus.targets.includes(k) ? 0.5 : 0;
    const focused = (focus?.gain ?? 0) * share * hellMul;
    let d: number;
    if (af > 0) {
      // 성장기: 포텐셜에 가까울수록 둔화
      // 어릴수록·전성기일수록 훈련 효과가 크다 (30세를 넘기면 효율이 떨어진다)
      const trainBoost = p.age <= 23 ? 1.28 : p.age <= 27 ? 1.14 : p.age <= 29 ? 1.0 : 0.82;
      d = (af * (1.0 + headroom * 1.8) * (0.72 + p.talent * 0.42)
        + focused * effBonus * trainBoost * (0.45 + headroom * 0.7)) * devRate;
      d += rng.normal() * 1.3;
    } else {
      // 노쇠기: 하락 폭은 "가진 만큼" 비례한다.
      // 원래 빠른 선수가 잃을 주력도 많고, 이미 느린 선수는 더 느려질 여지가 적다.
      const floorScale = clamp((cur - 30) / 50, 0.25, 1.2);
      // 훈련으로 하락을 방어한다. 서른 전에는 방어를 넘어 아직 끌어올릴 수 있다 —
      // 실제 피크는 26~29세인데, 27세에 성장이 통째로 끊기면 절벽처럼 느껴진다.
      const guard = p.age <= 28 ? 0.95 : p.age <= 30 ? 0.6 : 0.32;
      d = af * rng.float(0.7, 1.5) * floorScale
        + focused * effBonus * guard * (pot > cur ? 1 : 0.45);
      d += rng.normal() * 0.7;
    }
    // 한 오프시즌에 능력치가 +20씩 뛰면 성장이 아니라 순간이동이다.
    // 실제로는 한 해에 한 항목이 크게 좋아져도 그 폭이 제한적이다.
    // 지옥 훈련이 성공하면 평소 상한을 넘어설 수 있다
    const capUp = share === 0 ? 5 : Math.round((share === 1 ? 8 : 6) * clamp(hellMul, 1, 1.7));
    const capped = clamp(d, -12, capUp);
    const next = clamp(Math.round(cur + capped), 15, af > 0 ? pot : ABILITY_MAX);
    if (next !== cur) deltas[k] = next - cur;
    setAb(p.abilities, k, next);
  }
  return { deltas };
}

/**
 * 오프시즌 훈련 후보 생성.
 *
 * 잠재력에 이미 도달한 능력은 아무리 훈련해도 오르지 않으므로,
 * 성장 여지가 남은 능력을 우선해서 후보로 올린다.
 */
/**
 * 훈련 중 부상 위험 배수.
 * 나이가 들수록, 내구성이 낮을수록 몸을 갈아 넣는 대가가 커진다.
 */
export function injuryRiskMultiplier(p: Player): number {
  const age = 1 + Math.max(0, p.age - 27) * 0.07;
  const dur = clamp(1.12 - n50(getAb(p.abilities, "durability" as AbilityKey)) * 0.35, 0.72, 1.5);
  const trait = p.trait === "glass" ? 1.5 : p.trait === "ironman" ? 0.7 : 1;
  return age * dur * trait;
}

/**
 * 훈련 방향.
 *
 * 능력치를 하나씩 고르게 하면 선수를 키우는 게 아니라 스탯 창을 만지는 느낌이 된다.
 * 대신 **어떤 선수가 되고 싶은가**를 고르게 하고, 어떤 능력이 오를지는 시스템이 정한다.
 * 같은 방향을 거듭 고르면 능력치가 그쪽으로 쏠려 결국 선수 유형 자체가 바뀐다.
 */
export interface TrainingPath {
  id: string;
  name: string;
  icon: string;
  desc: string;
  kind: Kind;
  /** 주력으로 오르는 능력 */
  main: AbilityKey[];
  /** 곁가지로 조금 오르는 능력 */
  sub: AbilityKey[];
  /** 이 방향을 밀면 다다르는 유형 */
  leadsTo: string;
}

export const TRAINING_PATHS: TrainingPath[] = [
  {
    id: "power", name: "장타를 키운다", icon: "💪", kind: "HITTER",
    desc: "담장을 넘기는 힘에 집중한다.",
    main: ["power"], sub: ["contact", "durability"], leadsTo: "거포 · 중장거리형",
  },
  {
    id: "contact", name: "정확도를 키운다", icon: "🎯", kind: "HITTER",
    desc: "맞히는 기술과 공을 보는 눈을 다듬는다.",
    main: ["contact"], sub: ["eye", "power"], leadsTo: "교타자 · 출루형",
  },
  {
    id: "speed", name: "발을 키운다", icon: "⚡", kind: "HITTER",
    desc: "주루와 수비 범위를 넓힌다.",
    main: ["speed"], sub: ["defense", "contact"], leadsTo: "대도 · 호타준족",
  },
  {
    id: "defense", name: "수비를 다진다", icon: "🧤", kind: "HITTER",
    desc: "글러브와 어깨로 먹고사는 선수가 된다.",
    main: ["defense"], sub: ["arm", "speed"], leadsTo: "수비형 · 강견형",
  },
  {
    id: "body_h", name: "몸을 만든다", icon: "🏋️", kind: "HITTER",
    desc: "한 시즌을 온전히 버틸 몸과 멘탈을 만든다.",
    main: ["durability"], sub: ["mental", "power"], leadsTo: "철인형 · 해결사",
  },

  {
    id: "stuff", name: "구위를 끌어올린다", icon: "🔥", kind: "PITCHER",
    desc: "빠른 공과 결정구로 윽박지른다.",
    main: ["velocity"], sub: ["breaking", "durability"], leadsTo: "파워피처 · 탈삼진형",
  },
  {
    id: "command", name: "제구를 다듬는다", icon: "🎯", kind: "PITCHER",
    desc: "원하는 곳에 던지는 기술을 기른다.",
    main: ["control"], sub: ["movement", "mental"], leadsTo: "제구형 · 노련형",
  },
  {
    id: "breaking", name: "변화구를 늘린다", icon: "🌀", kind: "PITCHER",
    desc: "구종을 늘리고 공의 움직임을 키운다.",
    main: ["breaking"], sub: ["movement", "control"], leadsTo: "기교파 · 땅볼유도형",
  },
  {
    id: "body_p", name: "몸을 만든다", icon: "🏋️", kind: "PITCHER",
    desc: "많은 이닝과 연투를 견딜 몸을 만든다.",
    main: ["stamina"], sub: ["durability", "velocity"], leadsTo: "이닝이터 · 고무팔",
  },
];

/** 커리어에서 지옥 훈련을 쓸 수 있는 횟수 */
export const HELL_LIMIT = 2;

/**
 * 지옥 훈련 성공 확률.
 *
 * 몸을 갈아 넣는다고 늘 되는 게 아니다 — 되면 크게 늘고, 안 되면 한 해를 버린다.
 * 멘탈이 단단하고 재능이 있을수록, 어릴수록 버텨낸다.
 */
export function hellOdds(p: Player): number {
  const mental = getAb(p.abilities, "mental" as never);
  const dur = getAb(p.abilities, "durability" as never);
  const age = p.age <= 24 ? 0.08 : p.age <= 28 ? 0.02 : -0.1;
  return clamp(
    0.46 + (mental - 70) * 0.004 + (dur - 70) * 0.003 + (p.talent - 0.8) * 0.22 + age,
    0.2, 0.8,
  );
}

/**
 * 오프시즌 훈련 방향 후보.
 *
 * 능력치별 후보를 뽑던 예전 방식과 달리 방향은 늘 같은 목록이다.
 * 성장 여지는 참고용으로만 보여준다 — 여지가 없어도 한계 돌파가 일어날 수 있다.
 */
export function makeTrainingOptions(p: Player, _rng: RNG): TrainingOption[] {
  const roomOf = (ks: AbilityKey[]) =>
    Math.max(0, ...ks.map((k) => getAb(p.potential, k) - getAb(p.abilities, k)));

  return TRAINING_PATHS.filter((t) => t.kind === p.kind).map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    desc: `${t.desc} 계속하면 ${t.leadsTo} 쪽으로 자랍니다.`,
    targets: [...t.main, ...t.sub],
    main: [...t.main],
    gain: 6.0,
    risk: 0.05,
    conditionCost: 9,
    room: roomOf([...t.main, ...t.sub]),
  }));
}
