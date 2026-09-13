import { clamp } from "./rng";
import type { LevelTag } from "./types";

/**
 * 출신 학교.
 *
 * 이름만 받아놓고 아무것도 하지 않으면 입력받는 의미가 없다.
 * 그래서 **이름에서 전력을 뽑아낸다** — 같은 이름은 언제나 같은 전력이라
 * "그 학교로 다시 시작"이 가능하다.
 *
 * 전력이 높으면 전국대회 성적이 좋지만 **주전 경쟁이 치열하다.**
 * 약팀에서 혼자 다 하느냐, 강팀에서 자리를 다투느냐의 맞바꿈이다.
 */
export interface School {
  name: string;
  /** 팀 전력 0~100 (평범한 학교가 55 안팎) */
  power: number;
  /** 실제 야구 명문 */
  elite: boolean;
  /** 화면에 보여줄 한 줄 */
  note: string;
}

/**
 * 실제로 프로 선수를 많이 배출한 학교들.
 * 이름을 그대로 적으면 알아본다 — 숨겨둔 재미.
 */
const ELITE_HS: Record<string, number> = {
  덕수고: 92, 경남고: 91, 광주일고: 90, 북일고: 89, 천안북일고: 89,
  경북고: 88, 부산고: 88, 충암고: 87, 휘문고: 87, 장충고: 86,
  신일고: 86, 대구고: 85, 동산고: 85, 군산상고: 85, 마산용마고: 84,
  유신고: 84, 야탑고: 83, 세광고: 83, 개성고: 83, 진흥고: 82,
  서울고: 82, 인천고: 82, 청주고: 81, 공주고: 81, 전주고: 81,
  성남고: 80, 배재고: 80, 제물포고: 80, 강릉고: 79, 원주고: 79,
  동성고: 79, 광주동성고: 79, 상원고: 85, 대전고: 80, 순천효천고: 78,
};

const ELITE_COLLEGE: Record<string, number> = {
  고려대: 90, 연세대: 89, 동국대: 87, 단국대: 86, 한양대: 86,
  중앙대: 85, 성균관대: 84, 인하대: 84, 경희대: 83, 원광대: 82,
  홍익대: 80, 강릉영동대: 79,
};

/** 이름에서 전력을 뽑는다 — 같은 이름이면 언제나 같은 값 */
function hashPower(name: string, lo: number, hi: number): number {
  let h = 2166136261;
  for (const ch of name) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return lo + (h % 1000) / 1000 * (hi - lo);
}

/** 입력한 이름에서 공백·'야구부' 같은 군더더기를 뗀다 */
const normalize = (raw: string) =>
  raw.trim().replace(/\s+/g, "").replace(/(야구부|학교)$/, "");

export function schoolOf(raw: string, level: LevelTag = "HS"): School {
  const name = normalize(raw);
  const table = level === "COLLEGE" ? ELITE_COLLEGE : ELITE_HS;
  const fallback = level === "COLLEGE" ? "OO대학교" : "OO고등학교";

  if (!name) {
    return { name: fallback, power: 55, elite: false, note: "평범한 학교" };
  }

  const elitePower = table[name];
  if (elitePower !== undefined) {
    return {
      name,
      power: elitePower,
      elite: true,
      note: elitePower >= 88 ? "전국 최강 — 프로 지명자를 매년 배출한다"
        : elitePower >= 84 ? "전통의 강호 — 4강은 기본이다"
          : "이름난 야구 명문",
    };
  }

  const power = Math.round(hashPower(name, 38, 74));
  return {
    name,
    power,
    elite: false,
    note: power >= 68 ? "지역 강호"
      : power >= 58 ? "해볼 만한 전력"
        : power >= 48 ? "평범한 학교" : "야구부가 작다",
  };
}

/**
 * 그 학교에서 얼마나 나갈 수 있는가 (0.3~1).
 * 강팀일수록 주전 자리를 얻기 어렵다 — 명문고의 대가다.
 */
export function playingShare(schoolPower: number, ovr: number): number {
  return clamp(0.62 + (ovr - schoolPower * 0.58) * 0.03, 0.45, 1);
}

/** 명문고 목록 — 화면 안내용 */
export const ELITE_HINT = "덕수고 · 경남고 · 광주일고 · 북일고 · 경북고 …";
