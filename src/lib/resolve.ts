import type { GameState } from "./types";

/* ------------------------------------------------------------------ */
/* 올해의 각오                                                          */
/* ------------------------------------------------------------------ */

/**
 * 한 시즌을 어떤 마음으로 치를 것인가.
 *
 * 승부처는 그 순간만 바꾸고 사라진다. 이 게임에 모자랐던 건 **여러 시즌에
 * 걸쳐 복리로 쌓이는 축**이었다 — 훈련 방향 하나뿐이었다.
 * 각오는 한 해 내내 성적·부상·성장·신뢰에 동시에 걸리고, 그 결과가
 * 다음 해의 몸 상태와 입지로 넘어간다. 그래서 16시즌을 지나면
 * 같은 재능이라도 전혀 다른 선수가 된다.
 *
 * 균형의 원칙 — **어느 하나도 항상 옳지 않다.**
 *  · 타이틀은 지금을 벌고 몸과 내일을 판다
 *  · 몸만들기는 올해를 버리고 전성기를 산다
 *  · 헌신은 기록을 내주고 자리를 지킨다
 *  · 관리는 아무것도 벌지 않지만 오래 남는다
 */
export interface ResolveDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 무엇을 팔아 무엇을 사는가 — 화면에 그대로 보여준다 */
  trade: string;
  /** 성적 보정 (시뮬레이션 extraAdj) */
  adj: number;
  /** 부상 위험 배수 */
  injury: number;
  /** 오프시즌 성장 배수 */
  growth: number;
  /** 시즌 종료 시 팀 신뢰 변화 */
  trust: number;
  /** 출장 기회 배수 */
  playing: number;
  /** 한계 돌파 확률 배수 — 잠재력 천장을 미는 힘 */
  breakMul: number;
  /** 노쇠 낙폭 배수 (1보다 작으면 천천히 늙는다) */
  declineGuard: number;
}

export const RESOLVES: ResolveDef[] = [
  {
    id: "title", name: "타이틀에 도전한다", icon: "🏆",
    desc: "기록을 노리고 한 해를 전부 쏟아붓는다.",
    trade: "성적 ↑↑ · 부상 위험 ↑↑ · 성장 ↓",
    adj: 5.5, injury: 1.5, growth: 0.86, trust: -3, playing: 1.0, breakMul: 0.8, declineGuard: 1.12,
  },
  {
    id: "build", name: "몸을 만든다", icon: "🏋️",
    desc: "올해 기록을 접고 다음 몇 해를 산다. 구단은 좋아하지 않는다.",
    trade: "성적·출장·신뢰 ↓ · 성장·한계 돌파 ↑↑",
    adj: -5.0, injury: 0.72, growth: 1.5, trust: -4, playing: 0.97, breakMul: 1.9, declineGuard: 0.93,
  },
  {
    id: "team", name: "팀에 맞춘다", icon: "🤝",
    desc: "개인 기록보다 팀이 이기는 쪽을 고른다.",
    trade: "성적 ↓ · 출장 ↑ · 신뢰 ↑↑",
    adj: -1.2, injury: 0.9, growth: 1.0, trust: 7, playing: 1.09, breakMul: 1.0, declineGuard: 1.0,
  },
  {
    id: "manage", name: "무리하지 않는다", icon: "🛡️",
    desc: "다치지 않는 것이 제일 중요하다.",
    trade: "부상 위험 ↓↓ · 노쇠 ↓↓ · 성적 조금 ↓",
    adj: -0.5, injury: 0.45, growth: 0.94, trust: 1, playing: 0.96, breakMul: 1.0, declineGuard: 0.62,
  },
];

export const resolveById = (id: string | null | undefined): ResolveDef | null =>
  RESOLVES.find((r) => r.id === id) ?? null;

/** 지금 걸려 있는 각오 (없으면 null — 보정도 없다) */
export const currentResolve = (s: GameState): ResolveDef | null => resolveById(s.seasonResolve);

/** 각오가 없을 때 쓰는 중립값 — 분기마다 null 검사를 흩뿌리지 않으려고 둔다 */
export const NEUTRAL: Omit<ResolveDef, "id" | "name" | "icon" | "desc" | "trade"> = {
  adj: 0, injury: 1, growth: 1, trust: 0, playing: 1, breakMul: 1, declineGuard: 1,
};

export const resolveEffect = (s: GameState) => currentResolve(s) ?? NEUTRAL;
