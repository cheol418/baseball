import { RNG, clamp } from "./rng";
import { TEAMS, teamById } from "./teams";
import type { GameState } from "./types";

/* ------------------------------------------------------------------ */
/* 리그 — 해마다 판도가 바뀐다                                            */
/* ------------------------------------------------------------------ */

/**
 * 왜 필요한가.
 *
 * `TEAMS`는 상수였다. 서울 트윈스는 열다섯 해 내내 전력 82였고, 창원은 내내
 * 68이었다. 그래서 FM의 핵심 판단이 성립하지 않았다 —
 * **"우승 도전 팀에 남을까, 리빌딩 팀에서 주전으로 뛸까"**가 계산 한 번으로
 * 끝나는 고정 문제였다. 순위가 흔들려야 이적과 FA가 도박이 된다.
 *
 * **리그 평균은 움직이지 않는다.** 전력은 팀끼리 주고받는 것이지 다 같이
 * 오르내리는 게 아니다. 평균이 밀리면 성적·입지·순위가 통째로 인플레된다
 * (리그 기록 기준선을 전부 다시 잡아야 한다 — 규칙 2).
 */

export interface League {
  /** 올해 팀별 전력 */
  power: Record<string, number>;
  /** 직전 변화량 — 이걸 이어받아야 "몇 해에 걸친 추락·반등"이 생긴다 */
  momentum: Record<string, number>;
  /** 이 값이 어느 해의 것인가 */
  year: number;
}

/** 구단이 원래 서 있던 자리 — 여기로 천천히 되돌아간다 */
const BASE: Record<string, number> = Object.fromEntries(TEAMS.map((t) => [t.id, t.power]));
const BASE_MEAN = TEAMS.reduce((a, t) => a + t.power, 0) / TEAMS.length;

export const POWER_MIN = 52;
export const POWER_MAX = 90;

export function newLeague(year: number): League {
  return {
    power: { ...BASE },
    momentum: Object.fromEntries(TEAMS.map((t) => [t.id, 0])),
    year,
  };
}

/**
 * 한 해를 넘긴다.
 *
 * 관성(0.45)이 있어야 **한 번 무너진 팀이 몇 해 바닥에 머물다 올라온다.**
 * 관성 없이 잡음만 주면 해마다 제멋대로 튀어 "리빌딩"이라는 말이 안 생긴다.
 * 평균 회귀(0.22)는 어느 팀도 영영 최하위로 굳지 않게 한다.
 */
export function advanceLeague(prev: League, rng: RNG, year: number): League {
  const power: Record<string, number> = {};
  const momentum: Record<string, number> = {};

  for (const t of TEAMS) {
    const cur = prev.power[t.id] ?? BASE[t.id];
    const mo = prev.momentum[t.id] ?? 0;
    const delta = mo * 0.62 + (BASE[t.id] - cur) * 0.055 + rng.normal() * 4.0;
    const next = clamp(cur + delta, POWER_MIN, POWER_MAX);
    power[t.id] = next;
    momentum[t.id] = next - cur;
  }

  // 평균을 제자리로 — 전력은 주고받는 것이지 다 같이 오르는 게 아니다
  const mean = TEAMS.reduce((a, t) => a + power[t.id], 0) / TEAMS.length;
  const shift = BASE_MEAN - mean;
  for (const t of TEAMS) power[t.id] = Math.round(clamp(power[t.id] + shift, POWER_MIN, POWER_MAX) * 10) / 10;

  return { power, momentum, year };
}

/**
 * 지금 그 팀의 전력.
 * **`team.power`를 직접 읽지 않는다** — 상수라서 해마다 바뀌는 값을 놓친다.
 */
export function powerOf(s: GameState, teamId: string): number {
  return s.league?.power?.[teamId] ?? teamById(teamId).power;
}

/** 전력 순으로 매긴 올해 예상 순위 */
export function projectedRanks(s: GameState): { id: string; power: number; rank: number }[] {
  return TEAMS
    .map((t) => ({ id: t.id, power: powerOf(s, t.id) }))
    .sort((a, b) => b.power - a.power)
    .map((x, i) => ({ ...x, rank: i + 1 }));
}

export const rankOf = (s: GameState, teamId: string) =>
  projectedRanks(s).find((x) => x.id === teamId)?.rank ?? 5;

/** 지난해 대비 얼마나 올랐나 — 화면에 ▲▼로 낸다 */
export function powerTrend(s: GameState, teamId: string): number {
  return Math.round((s.league?.momentum?.[teamId] ?? 0) * 10) / 10;
}

/** 팀이 지금 어느 국면인가 — 이적 판단의 한 줄 */
export function teamPhase(s: GameState, teamId: string): string {
  const p = powerOf(s, teamId);
  const m = powerTrend(s, teamId);
  if (p >= 76) return m >= 1 ? "전성기" : "우승 도전";
  if (p >= 68) return m >= 1.5 ? "상승세" : m <= -1.5 ? "하락세" : "중위권";
  return m >= 1.5 ? "반등 중" : "리빌딩";
}
