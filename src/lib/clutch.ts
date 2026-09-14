import { getAb, overall } from "./player";
import { clamp, n50, RNG } from "./rng";
import { isRotationRole } from "./roles";
import type { GameState, HitterLine, PitcherLine, StatLine } from "./types";

/**
 * 승부처.
 *
 * 시즌이 "버튼을 누르고 지켜보는 것"만으로 끝나면 심심하다는 말을 들었다.
 * 월별 중계 자체에 끼어들려면 시뮬레이션을 중간에 멈췄다 재개해야 하는데,
 * 그건 한 반기를 한 번에 계산하는 구조를 뒤집는 일이다.
 *
 * 그래서 **반기가 시작될 때 고르고, 결과는 중계가 그 달에 닿았을 때 공개**한다.
 * 선택은 진짜로 기록을 바꾸고, 무엇이 나올지는 중계를 볼 때까지 모른다.
 */

export interface ClutchOption {
  id: string;
  label: string;
  desc: string;
  /** 이 선택이 기대는 능력치 (화면에 근거로 보여준다) */
  leans: string;
  /** 성공 확률 0~1 */
  odds: number;
  /** 실패해도 얻는 것이 있는가 */
  safe?: boolean;
}

export interface ClutchOutcome {
  id: string;
  /** 결과 제목 */
  title: string;
  /** 한 줄 묘사 */
  body: string;
  tone: "epic" | "good" | "neutral" | "bad";
  /**
   * 승부를 이겼는가.
   * 성공 여부를 id 목록으로 따로 관리했더니 타자의 "헛스윙 삼진"과
   * 투수의 "삼진으로 위기 탈출"이 같은 id를 써서 뒤엉켰다. 결과 자체에 적는다.
   */
  good: boolean;
  /** 그 달 기록에 더해지는 값 */
  stat: Partial<Record<string, number>>;
  fame: number;
  trust: number;
  condition: number;
}

export interface Clutch {
  /** 어느 달의 경기인가 (H1_MONTHS / H2_MONTHS의 인덱스) */
  monthIndex: number;
  monthLabel: string;
  eyebrow: string;
  title: string;
  body: string;
  opponent: string;
  options: ClutchOption[];
}

export interface ClutchResult {
  monthIndex: number;
  monthLabel: string;
  /** 무엇을 골랐는가 */
  optionId: string;
  optionLabel: string;
  /** 그 선택에서 나올 수 있었던 결과 전부 (뽑기 연출용) */
  pool: ClutchOutcome[];
  /** 실제로 나온 결과 */
  outcome: ClutchOutcome;
  success: boolean;
}

/* ------------------------------------------------------------------ */
/* 상황                                                               */
/* ------------------------------------------------------------------ */

const HIT_SCENES = [
  { eyebrow: "9회말 2사 만루", title: "한 방이면 끝난다", body: "1점 차로 뒤진 9회말 2사 만루. 구장 전체가 일어섰습니다." },
  { eyebrow: "연장 10회 1사 3루", title: "외야 뜬공이면 끝난다", body: "동점으로 맞선 연장 10회. 3루 주자가 홈을 노리고 있습니다." },
  { eyebrow: "8회 2사 2·3루", title: "역전의 기회", body: "두 점 차 추격. 여기서 한 방이면 경기를 뒤집습니다." },
  { eyebrow: "개막전 첫 타석", title: "한 해의 첫 스윙", body: "만원 관중 앞에서 맞는 올 시즌 첫 타석입니다." },
  { eyebrow: "라이벌전 9회초", title: "적지에서의 한 타석", body: "야유가 쏟아지는 원정 구장, 동점 주자가 2루에 있습니다." },
];

const PIT_SCENES_SP = [
  { eyebrow: "7회 무사 1·2루", title: "여기서 끊어야 한다", body: "1점 차 리드. 투구수 95개, 불펜은 아직 몸을 풀고 있습니다." },
  { eyebrow: "8회 2사 만루", title: "한 타자만 더", body: "완봉이 눈앞입니다. 상대는 이번 시즌 타율 3할의 4번 타자." },
  { eyebrow: "노히트 진행 중 · 8회", title: "아무도 말을 걸지 않는다", body: "더그아웃이 조용합니다. 8회를 무사히 넘기면 역사가 됩니다." },
  { eyebrow: "개막전 선발", title: "한 해의 첫 공", body: "만원 관중 앞에서 던지는 올 시즌 첫 이닝입니다." },
];

const PIT_SCENES_RP = [
  { eyebrow: "9회 1점 차 등판", title: "세이브 상황", body: "선두 타자가 출루하면 동점 주자가 나갑니다." },
  { eyebrow: "8회 무사 만루 승계", title: "불을 꺼야 한다", body: "앞선 투수가 만들어 놓은 위기. 실점 없이 막으면 팀이 이깁니다." },
  { eyebrow: "연장 11회 등판", title: "지면 끝난다", body: "양 팀 불펜이 모두 소진됐습니다. 이 이닝을 막아야 합니다." },
];

/* ------------------------------------------------------------------ */
/* 선택지                                                             */
/* ------------------------------------------------------------------ */

const ab = (s: GameState, k: string) => getAb(s.player.abilities, k as never);

function hitterOptions(s: GameState): ClutchOption[] {
  const cond = s.player.condition / 100;
  const pw = n50(ab(s, "power"));
  const ct = n50(ab(s, "contact"));
  const ey = n50(ab(s, "eye"));
  const mt = n50(ab(s, "mental"));
  return [
    {
      id: "swing", label: "초구부터 노린다", leans: "파워 · 멘탈",
      desc: "가장 좋은 공 하나를 노려 크게 휘두른다. 성공하면 경기를 끝내지만, 빗나가면 허무하게 끝난다.",
      odds: clamp(0.20 + pw * 0.30 + mt * 0.10 + (cond - 0.7) * 0.15, 0.08, 0.55),
    },
    {
      id: "contact", label: "맞혀서 내보낸다", leans: "컨택",
      desc: "크게 노리지 않고 정확히 맞힌다. 극적이진 않아도 주자를 불러들일 수 있다.",
      odds: clamp(0.36 + ct * 0.30 + (cond - 0.7) * 0.12, 0.18, 0.72),
    },
    {
      id: "patient", label: "끝까지 골라낸다", leans: "선구", safe: true,
      desc: "승부를 피하는 공에 손대지 않는다. 화려하진 않지만 다음 타자에게 기회를 넘긴다.",
      odds: clamp(0.46 + ey * 0.30, 0.28, 0.78),
    },
  ];
}

function pitcherOptions(s: GameState): ClutchOption[] {
  const cond = s.player.condition / 100;
  const ve = n50(ab(s, "velocity"));
  const co = n50(ab(s, "control"));
  const mv = n50(ab(s, "movement"));
  const mt = n50(ab(s, "mental"));
  return [
    {
      id: "power", label: "정면승부한다", leans: "구속 · 멘탈",
      desc: "가장 빠른 공으로 윽박지른다. 삼진으로 끝내면 최고지만, 맞으면 크게 맞는다.",
      odds: clamp(0.24 + ve * 0.30 + mt * 0.10 + (cond - 0.7) * 0.15, 0.10, 0.60),
    },
    {
      id: "corner", label: "코너를 노린다", leans: "제구",
      desc: "스트라이크존 구석만 찌른다. 볼넷 위험을 안고 가지만 정타를 내주지 않는다.",
      odds: clamp(0.38 + co * 0.30 + (cond - 0.7) * 0.12, 0.18, 0.74),
    },
    {
      id: "ground", label: "병살을 유도한다", leans: "무브먼트", safe: true,
      desc: "낮게 떨어뜨려 땅볼을 만든다. 한 번에 두 개를 잡을 수도, 한 점을 내줄 수도 있다.",
      odds: clamp(0.42 + mv * 0.28, 0.24, 0.76),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 결과 — 선택마다 나올 수 있는 것들                                    */
/* ------------------------------------------------------------------ */

const HIT_POOL: Record<string, ClutchOutcome[]> = {
  swing: [
    { id: "walkoff", good: true, title: "끝내기 만루홈런", body: "받아친 타구가 담장을 넘어갔습니다. 더그아웃이 쏟아져 나옵니다.", tone: "epic",
      stat: { hr: 1, rbi: 4, h: 1, r: 1 }, fame: 14, trust: 8, condition: 10 },
    { id: "hr", good: true, title: "역전 투런", body: "가운데 담장을 넘겼습니다. 경기가 뒤집혔습니다.", tone: "epic",
      stat: { hr: 1, rbi: 2, h: 1, r: 1 }, fame: 10, trust: 6, condition: 8 },
    { id: "swing_k", good: false, title: "헛스윙 삼진", body: "크게 돌린 방망이가 허공을 갈랐습니다.", tone: "bad",
      stat: { so: 1 }, fame: -2, trust: -4, condition: -8 },
    { id: "swing_fly", good: false, title: "큼직한 뜬공", body: "잘 맞았지만 담장 앞에서 잡혔습니다.", tone: "bad",
      stat: {}, fame: 0, trust: -1, condition: -4 },
  ],
  contact: [
    { id: "clutch2", good: true, title: "싹쓸이 2루타", body: "우중간을 가르는 타구, 주자가 모두 들어왔습니다.", tone: "epic",
      stat: { b2: 1, h: 1, rbi: 3 }, fame: 8, trust: 7, condition: 8 },
    { id: "single", good: true, title: "결승 적시타", body: "중전 안타로 주자를 불러들였습니다.", tone: "good",
      stat: { h: 1, rbi: 2 }, fame: 5, trust: 5, condition: 6 },
    { id: "gidp", good: false, title: "병살타", body: "잘 맞은 타구가 유격수 정면으로 향했습니다.", tone: "bad",
      stat: {}, fame: -2, trust: -4, condition: -7 },
    { id: "contact_out", good: false, title: "빗맞은 내야 땅볼", body: "배트 끝에 맞아 힘없이 굴러갔습니다.", tone: "bad",
      stat: {}, fame: -1, trust: -2, condition: -3 },
  ],
  patient: [
    { id: "bb_win", good: true, title: "밀어내기 볼넷", body: "끝까지 골라 결승점을 밀어냈습니다. 화려하진 않지만 이겼습니다.", tone: "good",
      stat: { bb: 1, rbi: 1 }, fame: 5, trust: 6, condition: 5 },
    { id: "bb", good: true, title: "볼넷 출루", body: "승부를 피하는 공에 손대지 않았습니다. 다음 타자에게 넘깁니다.", tone: "neutral",
      stat: { bb: 1 }, fame: 2, trust: 3, condition: 2 },
    { id: "look", good: false, title: "루킹 삼진", body: "마지막 공이 존을 스쳤습니다. 심판의 손이 올라갔습니다.", tone: "bad",
      stat: { so: 1 }, fame: -3, trust: -4, condition: -6 },
    { id: "patient_out", good: false, title: "파울 끝에 범타", body: "끈질기게 버텼지만 결국 잡혔습니다.", tone: "bad",
      stat: {}, fame: 0, trust: -1, condition: -3 },
  ],
};

const PIT_POOL: Record<string, ClutchOutcome[]> = {
  power: [
    { id: "k3", good: true, title: "3구 삼진", body: "몸쪽 높은 직구. 방망이가 나오지 못했습니다.", tone: "epic",
      stat: { so: 1 }, fame: 12, trust: 8, condition: 9 },
    { id: "pw_k", good: true, title: "삼진으로 위기 탈출", body: "결국 헛스윙을 끌어냈습니다.", tone: "good",
      stat: { so: 1 }, fame: 7, trust: 6, condition: 7 },
    { id: "hr_allow", good: false, title: "역전 피홈런", body: "가운데로 몰린 공이 그대로 넘어갔습니다.", tone: "bad",
      stat: { hrAllowed: 1, er: 3, h: 1 }, fame: -4, trust: -7, condition: -10 },
    { id: "pw_hit", good: false, title: "적시타 허용", body: "빠른 공에 타이밍이 맞았습니다.", tone: "bad",
      stat: { h: 1, er: 1 }, fame: -1, trust: -4, condition: -6 },
  ],
  corner: [
    { id: "kk", good: true, title: "연속 삼진", body: "구석만 찔러 두 타자를 연달아 돌려세웠습니다.", tone: "epic",
      stat: { so: 2 }, fame: 8, trust: 8, condition: 8 },
    { id: "fly_out", good: true, title: "얕은 뜬공 처리", body: "배트 끝에 맞은 타구가 내야를 넘지 못했습니다.", tone: "good",
      stat: {}, fame: 4, trust: 5, condition: 5 },
    { id: "bb_allow", good: false, title: "밀어내기 볼넷", body: "끝내 존에 넣지 못했습니다. 한 점을 내줍니다.", tone: "bad",
      stat: { bb: 1, er: 1 }, fame: -3, trust: -5, condition: -7 },
    { id: "corner_hit", good: false, title: "구석을 노리다 맞았다", body: "가운데로 몰린 공을 놓치지 않았습니다.", tone: "bad",
      stat: { h: 1, er: 1 }, fame: -1, trust: -3, condition: -4 },
  ],
  ground: [
    { id: "dp", good: true, title: "병살타 유도", body: "낮게 떨어진 공, 유격수-2루-1루로 이어졌습니다.", tone: "epic",
      stat: {}, fame: 7, trust: 8, condition: 8 },
    { id: "ground_out", good: true, title: "땅볼로 한 점", body: "아웃은 잡았지만 3루 주자가 홈을 밟았습니다.", tone: "neutral",
      stat: { er: 1 }, fame: 2, trust: 2, condition: 1 },
    { id: "through", good: false, title: "내야 안타", body: "빗맞은 타구가 하필 빈 곳으로 굴러갔습니다.", tone: "bad",
      stat: { h: 1, er: 1 }, fame: -2, trust: -4, condition: -6 },
    { id: "ground_bb", good: false, title: "유인구가 빠졌다", body: "낮게만 던지다 볼넷을 내줬습니다.", tone: "bad",
      stat: { bb: 1 }, fame: -1, trust: -3, condition: -4 },
  ],
};

/* ------------------------------------------------------------------ */

/** 큰 무대의 승부처 — 무대마다 장면이 다르다 */
const STAGE_SCENES: Record<string, { eyebrow: string; title: string; body: string }[]> = {
  AS: [
    { eyebrow: "올스타전 8회", title: "별들 사이에서", body: "만원 관중과 전국 중계. 이 한 타석이 하이라이트에 남습니다." },
    { eyebrow: "올스타전 9회 2사", title: "마지막 순간", body: "한 점 차. 오늘의 MVP가 여기서 갈립니다." },
  ],
  INTL: [
    { eyebrow: "국제대회 결승 8회", title: "태극마크의 무게", body: "온 나라가 지켜보고 있습니다. 여기서 물러설 수 없습니다." },
    { eyebrow: "숙적과의 맞대결", title: "질 수 없는 경기", body: "상대는 늘 우리를 괴롭혀 온 팀입니다." },
  ],
  PS: [
    { eyebrow: "한국시리즈 9회말", title: "가을의 주인공", body: "이 한 타석으로 시리즈의 흐름이 정해집니다." },
    { eyebrow: "가을야구 연장 10회", title: "끝내지 못하면 끝난다", body: "더그아웃의 모두가 일어서 있습니다." },
  ],
};

/**
 * 큰 무대에 걸리는 승부처.
 * 리그 경기보다 인지도가 크게 움직인다 — 보는 눈이 다르다.
 */
export function rollStageClutch(
  stage: "AS" | "INTL" | "PS", s: GameState, rng: RNG, label: string,
): Clutch {
  const hitter = s.player.kind === "HITTER";
  const scene = rng.pick(STAGE_SCENES[stage]);
  return {
    monthIndex: -1,
    monthLabel: label,
    eyebrow: scene.eyebrow,
    title: scene.title,
    body: scene.body,
    opponent: stage === "INTL" ? rng.pick(["일본", "대만", "미국", "도미니카", "쿠바"]) : "",
    options: hitter ? hitterOptions(s) : pitcherOptions(s),
  };
}

/** 이번 반기에 승부처가 생기는가 — 1군에서 뛸 때만 */
export function rollClutch(
  s: GameState, rng: RNG, months: readonly { key: string; label: string }[],
): Clutch | null {
  if (s.seasonLevel !== "KBO" || !s.contract) return null;
  const hitter = s.player.kind === "HITTER";
  const scenes = hitter
    ? HIT_SCENES
    : isRotationRole(s.seasonRole ?? "") ? PIT_SCENES_SP : PIT_SCENES_RP;
  const scene = rng.pick(scenes);
  const mi = rng.int(0, months.length - 1);
  return {
    monthIndex: mi,
    monthLabel: months[mi].label,
    eyebrow: scene.eyebrow,
    title: scene.title,
    body: scene.body,
    opponent: rng.pick(["대구 라이온즈", "광주 타이거즈", "서울 트윈스", "부산 자이언츠", "인천 랜더스", "창원 다이노스"]),
    options: hitter ? hitterOptions(s) : pitcherOptions(s),
  };
}

/** 고른 대로 승부한다 */
export function resolveClutch(c: Clutch, optionId: string, s: GameState, rng: RNG): ClutchResult {
  const opt = c.options.find((o) => o.id === optionId) ?? c.options[0];
  const pool = (s.player.kind === "HITTER" ? HIT_POOL : PIT_POOL)[opt.id];
  const good = pool.filter((o) => o.good);
  const bad = pool.filter((o) => !o.good);
  const success = rng.chance(opt.odds);
  const side = success ? good : bad;
  // 같은 성공이라도 능력이 높을수록 더 극적인 쪽이 나온다
  const edge = clamp((overall(s.player) - 74) / 30, 0, 1);
  const outcome = side.length === 1
    ? side[0]
    : rng.chance(0.30 + edge * 0.35) ? side[0] : side[side.length - 1];
  return {
    monthIndex: c.monthIndex, monthLabel: c.monthLabel,
    optionId: opt.id, optionLabel: opt.label,
    pool, outcome, success,
  };
}

/** 결과를 그 달 기록에 더한다 */
export function applyClutchToLine(line: StatLine, r: ClutchResult): StatLine {
  const out = { ...line } as StatLine & Record<string, number>;
  for (const [k, v] of Object.entries(r.outcome.stat)) {
    if (typeof out[k] === "number") out[k] += v as number;
  }
  if ((line as HitterLine).pa !== undefined) {
    const h = out as unknown as HitterLine;
    // 타석·타수도 한 번 늘어난다 (볼넷은 타수에 들어가지 않는다)
    h.pa += 1;
    if (!r.outcome.stat.bb) h.ab += 1;
    h.avg = h.ab ? Math.round((h.h / h.ab) * 1000) / 1000 : 0;
    const tb = h.h + h.b2 + h.b3 * 2 + h.hr * 3;
    h.slg = h.ab ? Math.round((tb / h.ab) * 1000) / 1000 : 0;
    h.obp = h.pa ? Math.round(((h.h + h.bb + h.hbp) / h.pa) * 1000) / 1000 : 0;
    h.ops = Math.round((h.obp + h.slg) * 1000) / 1000;
  } else {
    const p = out as unknown as PitcherLine;
    p.ip = Math.round((p.ip + 0.3) * 10) / 10;
    p.era = p.ip ? Math.round(((p.er * 9) / p.ip) * 100) / 100 : 0;
    p.whip = p.ip ? Math.round(((p.h + p.bb) / p.ip) * 100) / 100 : 0;
    p.k9 = p.ip ? Math.round(((p.so / p.ip) * 9) * 100) / 100 : 0;
  }
  return out;
}
