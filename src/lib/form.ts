import { clamp } from "./rng";
import { isHitterLine } from "./sim";
import type { HitterLine, LevelTag, PitcherLine, StatLine } from "./types";

/**
 * 한 달(약 24경기)의 체감.
 *
 * 상승세·평범·부진 셋뿐이면 한 시즌이 밋밋하다 — 40홈런 페이스로 달린 달과
 * 그냥 잘한 달이 같은 배지를 달고, 커리어 최악의 달도 '부진' 한 단어로 끝난다.
 * 그래서 위아래로 한 칸씩 더 두고, 못 뛴 이유(부상 / 2군)도 갈랐다.
 *
 * 판정을 여기 한 곳에 모아둔다. 중계·시즌 요약·엔트리 판정이 같은 값을 보게
 * 하려면 기준이 흩어져 있으면 안 된다.
 */
export type MonthForm =
  /** 리그를 지배한 달 — 월간 MVP 후보 */
  | "peak"
  /** 상승세 */
  | "hot"
  /** 평범 */
  | "normal"
  /** 부진 */
  | "cold"
  /** 손쓸 수 없었던 달 */
  | "slump"
  /** 1군에 있었지만 못 뛴 달 — 부상 */
  | "injured"
  /** 2군에서 보낸 달 등, 출장 자체가 없던 달 */
  | "out";

/** 표본이 이보다 적으면 성적으로 판단하지 않는다 */
const MIN_PA = 8;
const MIN_IP = 3;

/**
 * 그 달이 어땠는가.
 *
 * 리그 평균 OPS는 .730 안팎이라 타율만 보면 거포의 한 달을 과소평가한다.
 * 그래서 장타(홈런·타점)와 투수의 탈삼진도 함께 본다.
 */
export function judgeMonthForm(line: StatLine, level: LevelTag = "KBO"): MonthForm {
  if (isHitterLine(line)) {
    const h = line as HitterLine;
    if (h.pa < MIN_PA) return level === "KBO" ? "injured" : "out";
    // 월 8홈런이면 40홈런 페이스 — 타율이 낮아도 리그를 지배한 달이다
    if (h.ops >= 1.020 || h.hr >= 8 || (h.hr >= 6 && h.ops >= 0.930) || h.rbi >= 30) return "peak";
    if (h.ops >= 0.850 || h.hr >= 6 || (h.hr >= 4 && h.slg >= 0.520) || h.rbi >= 24) return "hot";
    if (h.ops <= 0.560 && h.hr <= 1) return "slump";
    if (h.ops <= 0.660 && h.hr <= 2) return "cold";
    return "normal";
  }
  const p = line as PitcherLine;
  if (p.ip < MIN_IP) return level === "KBO" ? "injured" : "out";
  if (p.era <= 1.80 || (p.era <= 2.40 && p.k9 >= 11)) return "peak";
  if (p.era <= 2.90 || (p.era <= 3.60 && p.k9 >= 10)) return "hot";
  if (p.era >= 7.00) return "slump";
  if (p.era >= 5.50) return "cold";
  return "normal";
}

/** 화면 표기 — 배지와 색 */
export const FORM_STYLE: Record<MonthForm, { badge: string; color: string; rank: number }> = {
  peak: { badge: "🏆 이달의 선수급", color: "#ffc233", rank: 3 },
  hot: { badge: "🔥 상승세", color: "#ffd166", rank: 2 },
  normal: { badge: "— 평범", color: "rgba(255,255,255,0.75)", rank: 1 },
  cold: { badge: "🧊 부진", color: "#9fc7ff", rank: 0 },
  slump: { badge: "💀 깊은 슬럼프", color: "#7fa8e8", rank: -1 },
  injured: { badge: "🏥 부상 결장", color: "#ffb4a2", rank: -1 },
  out: { badge: "🔻 출장 없음", color: "#c3ccd8", rank: -1 },
};

const NOTE: Record<MonthForm, { hitter: string[]; pitcher: string[] }> = {
  peak: {
    hitter: ["리그를 씹어먹은 달", "상대 배터리가 승부를 피했다", "月間 MVP가 유력하다", "매 경기 중계 화면에 잡혔다"],
    pitcher: ["누구도 공략하지 못했다", "이 달의 마운드는 그의 것이었다", "月間 MVP가 유력하다", "타자들이 방망이를 헛돌렸다"],
  },
  hot: {
    hitter: ["미친 타격감", "손대는 족족 안타", "타선을 이끌었다", "담장을 계속 넘겼다"],
    pitcher: ["압도적인 구위", "무실점 행진", "마운드를 지배했다", "로테이션의 기둥이었다"],
  },
  normal: {
    hitter: ["제 몫은 했다", "꾸준했던 한 달", "기복 속에 버텼다"],
    pitcher: ["제 몫은 했다", "꾸준히 로테이션을 지켰다", "기복 속에 버텼다"],
  },
  cold: {
    hitter: ["방망이가 식었다", "타격 슬럼프", "잔루만 쌓였다", "배트에 공이 안 맞는다"],
    pitcher: ["난타당한 한 달", "제구가 흔들렸다", "조기 강판이 잦았다", "실점이 쌓였다"],
  },
  slump: {
    hitter: ["타순이 계속 내려갔다", "벤치에 앉는 날이 늘었다", "스윙에 자신이 없어 보였다", "코칭스태프가 지켜보고 있다"],
    pitcher: ["등판마다 무너졌다", "보직을 지키기 어려워 보인다", "스트라이크를 넣지 못했다", "코칭스태프가 지켜보고 있다"],
  },
  injured: {
    hitter: ["재활에 매달린 한 달", "트레이닝룸에서 보냈다"],
    pitcher: ["재활에 매달린 한 달", "트레이닝룸에서 보냈다"],
  },
  out: {
    hitter: ["출장 기회가 없었다", "2군에서 몸을 만들었다"],
    pitcher: ["등판 기회가 없었다", "2군에서 몸을 만들었다"],
  },
};

/** 그 달을 한 줄로 */
export function formNote(line: StatLine, form: MonthForm, seed: number): string {
  const pool = isHitterLine(line) ? NOTE[form].hitter : NOTE[form].pitcher;
  return pool[Math.abs(seed) % pool.length];
}

/**
 * 이달의 선수(월간 MVP) 확률.
 *
 * 실제 KBO는 **한 달에 리그 전체에서 한 명**이다. 압도적인 달을 보냈어도
 * 그달 다른 팀 누군가가 더 잘했으면 못 받는다. 그래서 `peak`을 찍었다고
 * 곧바로 주지 않고, 얼마나 압도적이었는지로 확률을 나눈다.
 * (고정 확률 0.45로 두었더니 한 커리어에 53회까지 나왔다.)
 */
export function potmOdds(
  line: StatLine, form: MonthForm, level: LevelTag,
  /** 그 시즌에 이미 몇 번 받았는가 — 한 선수가 매달 가져가지는 못한다 */
  wonThisSeason = 0,
): number {
  if (form !== "peak" || level !== "KBO") return 0;
  // 같은 해에 거듭 받기는 어렵다 (실제로도 한 시즌 2~3회가 최대치다)
  const repeat = wonThisSeason === 0 ? 1 : wonThisSeason === 1 ? 0.42 : 0.12;
  if (isHitterLine(line)) {
    const h = line as HitterLine;
    // 기준선을 얼마나 넘었는가 — 월 10홈런이나 OPS 1.200은 아무도 못 막는다
    const edge = Math.max((h.hr - 8) / 4, (h.ops - 1.020) / 0.26, (h.rbi - 30) / 14);
    return clamp(0.16 + edge * 0.45, 0.12, 0.72) * repeat;
  }
  const p = line as PitcherLine;
  const edge = Math.max((1.80 - p.era) / 1.4, (p.k9 - 11) / 4);
  return clamp(0.16 + edge * 0.45, 0.12, 0.72) * repeat;
}
