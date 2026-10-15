import { RNG, clamp } from "./rng";
import { getAb, overall } from "./player";
import { isRotationRole } from "./roles";
import type { GameState, Player, SeasonRecord } from "./types";

/* ------------------------------------------------------------------ */
/* 감독 — 나를 보는 눈                                                   */
/* ------------------------------------------------------------------ */

/**
 * 왜 필요한가.
 *
 * 감독은 승부처 문구에만 있었다 — "감독이 타순을 바꿨습니다". 엔티티가 없으니
 * **`trust`가 커리어 내내 한 번도 재평가되지 않았다.** 열다섯 시즌을 같은
 * 눈으로 평가받는 셈이다.
 *
 * 실제 선수 커리어를 가장 크게 뒤집는 사건은 감독 교체다. 나를 아끼던 감독이
 * 떠나고 나를 안 쓰는 감독이 오면, 쌓아 둔 신뢰가 한 번에 흔들린다.
 *
 * **균형의 원칙 — 성향 보정은 인구 평균이 0이어야 한다.**
 * 그래서 성향을 **반대되는 짝**으로 둔다(육성 ↔ 노장, 공격 ↔ 수비).
 * 한쪽만 있으면 입지 분포가 통째로 밀린다 (스쿼드에서 겪은 것과 같은 함정).
 */

export type ManagerStyleId = "youth" | "veteran" | "result" | "defense" | "stubborn";

export interface ManagerStyle {
  id: ManagerStyleId;
  name: string;
  desc: string;
  /** 나를 어떻게 보는가 — **±3 안**, 평균 0이 되도록 짝지어 둔다 */
  fit: (p: Player, c: ManagerContext) => number;
  /** 신뢰가 움직이는 속도 (뚝심형은 느리다) */
  trustSpeed: number;
}

export interface ManagerContext {
  /** 최근 1군 시즌들 (최대 3개) */
  recent: SeasonRecord[];
  recentWar: number;
}

const ab = (p: Player, k: string) => getAb(p.abilities, k as never);

export const MANAGER_STYLES: ManagerStyle[] = [
  {
    id: "youth", name: "육성형", desc: "어린 선수에게 기회를 준다",
    // 짝이 되는 성향과 **같은 나이를 축으로** 삼아야 인구 평균이 0이 된다.
    // 26과 28로 어긋나게 뒀더니 육성형 −0.99 · 노장형 +0.64로 상쇄가 덜 됐다.
    fit: (p) => clamp((28 - p.age) * 0.5, -3, 3),
    trustSpeed: 1,
  },
  {
    id: "veteran", name: "노장 중용", desc: "경험을 믿는다",
    fit: (p) => clamp((p.age - 28) * 0.5, -3, 3),
    trustSpeed: 1,
  },
  {
    id: "result", name: "성적 지상주의", desc: "최근 성적만 본다",
    // 축은 **우리 리그의 실제 평균**이어야 한다 (2.2로 뒀더니 평균 −0.55)
    fit: (_p, c) => clamp((c.recentWar - 1.75) * 1.1, -3, 3),
    trustSpeed: 1.3,
  },
  {
    id: "defense", name: "지키는 야구", desc: "수비와 제구를 먼저 본다",
    fit: (p) => p.kind === "HITTER"
      ? clamp((ab(p, "defense") - 73) * 0.13, -3, 3)
      : clamp((ab(p, "control") - 73) * 0.13, -3, 3),
    trustSpeed: 1,
  },
  {
    id: "stubborn", name: "뚝심형", desc: "한번 믿으면 끝까지 쓴다",
    // 선호가 없다 — 대신 신뢰가 잘 안 흔들린다
    fit: () => 0,
    trustSpeed: 0.55,
  },
];

export const managerStyle = (id: string) =>
  MANAGER_STYLES.find((s) => s.id === id) ?? MANAGER_STYLES[MANAGER_STYLES.length - 1];

export interface Manager {
  name: string;
  styleId: ManagerStyleId;
  teamId: string;
  /** 부임한 해 */
  since: number;
  /** 이 감독 아래에서 치른 시즌 수 */
  seasons: number;
}

const SURNAMES = [
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
  "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍",
];
/** 감독은 윗세대다 — 선수들과 다른 이름 결을 쓴다 */
const GIVEN = [
  "성한", "태석", "병규", "재훈", "길동", "원섭", "학수", "정길", "만호", "경수",
  "동렬", "용철", "인식", "기태", "선우", "종범", "상일", "현배", "광현", "준혁",
];

export function makeManager(rng: RNG, teamId: string, year: number): Manager {
  const style = MANAGER_STYLES[rng.int(0, MANAGER_STYLES.length - 1)];
  return {
    name: SURNAMES[rng.int(0, SURNAMES.length - 1)] + GIVEN[rng.int(0, GIVEN.length - 1)],
    styleId: style.id, teamId, since: year, seasons: 0,
  };
}

/**
 * 감독이 나를 어떻게 보는가.
 * `assignRole`에 얹는 값이라 **±3을 넘기지 않는다** — 성적이 아닌 것으로
 * 자리가 바뀌는 폭은 자리 한 칸의 절반을 넘지 말아야 한다.
 */
export function managerFit(m: Manager | null | undefined, s: GameState): number {
  if (!m) return 0;
  const recent = s.seasons.filter((r) => r.level === "KBO").slice(-3);
  const recentWar = recent.length ? recent.reduce((a, r) => a + r.line.war, 0) / recent.length : 0;
  return clamp(managerStyle(m.styleId).fit(s.player, { recent, recentWar }), -3, 3);
}

/**
 * 감독이 바뀔 때인가.
 *
 * 실제 KBO 감독 평균 재임은 3년 안팎이다. 계약은 보통 3년이고, 성적이
 * 나쁘면 그 전에 잘린다. 2년 차까지는 거의 안 바꾼다.
 */
export function shouldReplace(m: Manager, s: GameState, rng: RNG): boolean {
  if (m.seasons < 2) return false;
  const ranks = s.seasons
    .filter((r) => r.level === "KBO" && r.year >= m.since && r.teamRank)
    .map((r) => r.teamRank!);
  const avg = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 5.5;
  // 하위권이면 빨리, 상위권이면 오래 간다
  // 실제 KBO 감독 계약은 3년이고 그 전에 잘리는 일이 흔하다 —
  // 0.16/0.3/0.55로 뒀더니 평균 재임이 5.1시즌이 됐다
  const base = m.seasons >= 5 ? 0.6 : m.seasons >= 3 ? 0.38 : 0.25;
  return rng.chance(clamp(base + (avg - 5.5) * 0.07, 0.05, 0.85));
}

/**
 * 감독이 바뀌면 신뢰가 흔들린다.
 *
 * 완전히 지우지는 않는다 — 평판은 따라오니까. 중립(55) 쪽으로 당기되,
 * 성적으로 증명한 선수일수록 덜 흔들린다.
 */
export function trustOnChange(trust: number, s: GameState): number {
  const recent = s.seasons.filter((r) => r.level === "KBO").slice(-2);
  const war = recent.length ? recent.reduce((a, r) => a + r.line.war, 0) / recent.length : 0;
  const hold = clamp(0.35 + war * 0.09, 0.35, 0.8);   // 지켜내는 비율
  return Math.round(55 + (trust - 55) * hold);
}

/** 감독이 나를 뭐라고 보는지 한 줄로 — 화면에 그대로 낸다 */
export function managerView(m: Manager | null | undefined, s: GameState): string {
  if (!m) return "";
  const f = managerFit(m, s);
  const ovr = overall(s.player);
  void ovr;
  if (f >= 2) return "나를 눈여겨보고 있다";
  if (f >= 0.8) return "나쁘지 않게 본다";
  if (f <= -2) return "나와 맞지 않는다";
  if (f <= -0.8) return "미덥지 않아 한다";
  return "특별히 가리지 않는다";
}

/** 투수 보직군이 바뀌면 감독의 눈도 달라진다 — roles.ts를 통해 본다 */
export const viewsRotation = (role: string) => isRotationRole(role);
