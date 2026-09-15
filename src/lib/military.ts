import { RNG, clamp } from "./rng";
import type { GameState, MilitaryStatus } from "./types";

/* ------------------------------------------------------------------ */
/* 복무 — 야구 밖의 1년 6개월                                            */
/* ------------------------------------------------------------------ */

/**
 * 왜 필요한가.
 *
 * 복무는 [복무 진행] 버튼 하나였다. 중계도, 선택도, 사건도 없이
 * 커리어의 한가운데에서 두 해가 통째로 비었다.
 * 그런데 이 시기는 실제로 선수 인생에서 가장 말이 많은 구간이다 —
 * 누구는 몸을 키워 돌아오고, 누구는 감각을 잃고 돌아오지 못한다.
 *
 * 그래서 **복무에도 방침을 고르게** 하고, **부대에서 사건이 일어나게** 한다.
 * 상무와 현역은 보내는 하루가 다르므로 고를 수 있는 것도 다르다.
 */
export interface ServiceOption {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 무엇을 팔아 무엇을 사는가 */
  trade: string;
  /** 능력치 전반에 곱하는 변화 배수 (현역의 하락폭 / 상무의 성장폭) */
  drill: number;
  /** 성적 보정 (상무만 — 현역은 경기가 없다) */
  adj: number;
  /** 전역 시 구단 신뢰 */
  trust: number;
  /** 멘탈·내구성에 직접 더한다 */
  mental: number;
  durability: number;
}

export const SANGMU_OPTIONS: ServiceOption[] = [
  {
    id: "game", name: "실전에 집중한다", icon: "⚾",
    desc: "퓨처스 경기에 전부 나간다. 감각을 잃지 않는 게 최우선이다.",
    trade: "성적 ↑↑ · 성장 보통",
    drill: 1.0, adj: 3.5, trust: 2, mental: 0, durability: 0,
  },
  {
    id: "body", name: "몸을 키운다", icon: "🏋️",
    desc: "경기보다 웨이트장에 오래 있는다. 전역할 때 다른 몸으로 나간다.",
    trade: "성적 ↓ · 성장 ↑↑ · 내구성 ↑",
    drill: 1.7, adj: -3.0, trust: 0, mental: 0, durability: 3,
  },
  {
    id: "duty", name: "부대 생활에 충실한다", icon: "🎖️",
    desc: "야구 말고도 해야 할 일이 있다. 버티는 법을 배운다.",
    trade: "성적·성장 ↓ · 멘탈 ↑↑ · 전역 후 신뢰 ↑",
    drill: 0.7, adj: -1.5, trust: 9, mental: 5, durability: 1,
  },
];

export const ACTIVE_OPTIONS: ServiceOption[] = [
  {
    id: "keep", name: "틈나는 대로 몸을 만든다", icon: "🏃",
    desc: "연병장 구석에서라도 던지고 달린다. 떨어지는 속도를 늦춘다.",
    trade: "기량 하락 ↓↓ · 멘탈 소폭 ↓",
    drill: 0.55, adj: 0, trust: 0, mental: -1, durability: 2,
  },
  {
    id: "duty", name: "복무에 충실한다", icon: "🎖️",
    desc: "군인으로서 할 일을 한다. 야구는 전역하고 생각한다.",
    trade: "기량 하락 그대로 · 멘탈 ↑↑ · 전역 후 신뢰 ↑",
    drill: 1.0, adj: 0, trust: 11, mental: 6, durability: 0,
  },
  {
    id: "unit", name: "부대 야구부에 들어간다", icon: "🥎",
    desc: "군 대회를 노린다. 수준은 낮지만 공을 만질 수 있다.",
    trade: "기량 하락 ↓ · 부상 위험 ↑",
    drill: 0.72, adj: 0, trust: 3, mental: 2, durability: -2,
  },
];

export const serviceOptions = (m: MilitaryStatus | null | undefined): ServiceOption[] =>
  m === "SANGMU" ? SANGMU_OPTIONS : ACTIVE_OPTIONS;

export const serviceOptionById = (m: MilitaryStatus | null | undefined, id: string | undefined) =>
  serviceOptions(m).find((o) => o.id === id) ?? serviceOptions(m)[0];

/* ------------------------------------------------------------------ */
/* 부대 소식                                                            */
/* ------------------------------------------------------------------ */

export interface Barracks {
  icon: string;
  title: string;
  body: string;
  tone: "epic" | "good" | "neutral" | "bad";
  /** 능력치 변화 */
  bump?: Partial<Record<string, number>>;
  fame?: number;
  trust?: number;
  condition?: number;
}

const SANGMU_NEWS: Barracks[] = [
  { icon: "🏆", title: "퓨처스리그 월간 MVP", tone: "epic", fame: 4, trust: 3, condition: 4,
    body: "부대 소속으로 한 달을 지배했습니다. 1군 스카우트 리포트에 이름이 올랐습니다." },
  { icon: "🪖", title: "혹한기 훈련", tone: "neutral", bump: { durability: 2, mental: 2 }, condition: -8,
    body: "영하의 야전에서 닷새를 보냈습니다. 몸은 축났지만 버티는 법을 배웠습니다." },
  { icon: "🤝", title: "1군 출신 선임", tone: "good", bump: { mental: 3 }, condition: 2,
    body: "먼저 온 선임이 프로에서 겪은 것들을 들려줬습니다. 돌아가서 뭘 해야 할지 보입니다." },
  { icon: "🏟️", title: "홈경기 응원단 방문", tone: "good", fame: 3, condition: 5,
    body: "원소속팀 팬들이 부대 구장을 찾았습니다. 잊히지 않았다는 걸 알았습니다." },
  { icon: "📞", title: "구단의 안부 전화", tone: "good", trust: 5,
    body: "단장이 직접 전화를 걸어 몸 상태를 물었습니다. 자리를 비워 두겠다고 했습니다." },
  { icon: "🩹", title: "훈련 중 접질림", tone: "bad", bump: { durability: -2 }, condition: -10,
    body: "행군 중 발목을 접질렸습니다. 큰 부상은 아니지만 한동안 절뚝였습니다." },
  { icon: "🥇", title: "군 체육대회 우승", tone: "good", bump: { mental: 2 }, fame: 2, condition: 3,
    body: "부대 대표로 나가 우승을 따냈습니다. 표창과 함께 짧은 휴가를 받았습니다." },
];

const ACTIVE_NEWS: Barracks[] = [
  { icon: "🌙", title: "불 꺼진 생활관", tone: "neutral", bump: { mental: 2 },
    body: "소등 후 천장을 보며 복귀할 날을 셌습니다. 야구가 없는 하루가 길었습니다." },
  { icon: "🥎", title: "부대 야구대회", tone: "good", bump: { mental: 2 }, condition: 4, fame: 1,
    body: "연대 대항전에서 홀로 다른 수준을 보여줬습니다. 오랜만에 공을 잡았습니다." },
  { icon: "🪖", title: "혹한기 훈련", tone: "neutral", bump: { durability: 2, mental: 2 }, condition: -8,
    body: "영하의 야전에서 닷새를 보냈습니다. 야구와는 다른 종류의 인내였습니다." },
  { icon: "👨‍👩‍👦", title: "면회", tone: "good", condition: 8, bump: { mental: 2 },
    body: "가족이 찾아왔습니다. 몇 시간이 너무 빨리 지나갔습니다." },
  { icon: "📺", title: "TV로 본 옛 동료", tone: "bad", condition: -6,
    body: "생활관 TV에 함께 뛰던 동료가 나왔습니다. 채널을 돌렸습니다." },
  { icon: "🩹", title: "작업 중 부상", tone: "bad", bump: { durability: -3 }, condition: -10,
    body: "작업 중 손목을 다쳤습니다. 야구와 상관없는 곳에서 몸이 상했습니다." },
  { icon: "🎽", title: "체력 특급 전사", tone: "good", bump: { durability: 3, mental: 1 }, condition: 3,
    body: "체력검정 전 종목 특급을 받았습니다. 운동 능력만은 녹슬지 않았습니다." },
  { icon: "✉️", title: "구단에서 온 편지", tone: "good", trust: 6,
    body: "감독이 손으로 쓴 편지가 왔습니다. 돌아올 자리를 비워 두겠다고 적혀 있었습니다." },
];

/**
 * 그 시즌의 부대 소식 하나.
 * 상무와 현역은 보내는 하루가 다르므로 일어나는 일도 다르다.
 */
export function rollBarracks(m: MilitaryStatus | null | undefined, rng: RNG): Barracks {
  const pool = m === "SANGMU" ? SANGMU_NEWS : ACTIVE_NEWS;
  return pool[rng.int(0, pool.length - 1)];
}

/** 전역까지 남은 개월 수 — 화면에 시즌이 아니라 개월로 보여준다 */
export const monthsLeft = (s: GameState) => Math.max(0, Math.round(s.militaryLeft * 12));
