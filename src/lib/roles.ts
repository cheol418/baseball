import type { Player } from "./types";

/**
 * 1군 안에서의 입지.
 *
 * 같은 "1군 선수"라도 팀 안에서의 위치는 전혀 다르다.
 * 간판타자는 구단이 절대 내주지 않고, 추격조는 언제든 2군으로 내려간다.
 * 이 등급이 연봉 협상 · 이적 시장 · 팬 반응 · 성장 속도 전부에 쓰인다.
 *
 * tier가 높을수록 팀 내 입지가 단단하다 (0 = 2군/육성).
 */
export interface RoleDef {
  name: string;
  tier: number;
  /** 팀의 간판으로 대우받는 자리인가 */
  franchise?: boolean;
  /** 매일 나가는 자리인가 (타자) / 로테이션을 도는가 (선발) */
  everyday?: boolean;
  short: string;
}

export const ROLES: Record<string, RoleDef> = {
  /* 타자 */
  간판타자: { name: "간판타자", tier: 6, franchise: true, everyday: true, short: "간판" },
  핵심타자: { name: "핵심타자", tier: 5, everyday: true, short: "핵심" },
  주전: { name: "주전", tier: 4, everyday: true, short: "주전" },
  준주전: { name: "준주전", tier: 3, short: "준주전" },
  백업: { name: "백업", tier: 2, short: "백업" },

  /* 선발 투수 */
  에이스: { name: "에이스", tier: 6, franchise: true, everyday: true, short: "에이스" },
  "1선발": { name: "1선발", tier: 5, everyday: true, short: "1선발" },
  선발: { name: "선발", tier: 4, everyday: true, short: "선발" },
  "5선발": { name: "5선발", tier: 3, short: "5선발" },

  /* 구원 투수 */
  마무리: { name: "마무리", tier: 5, everyday: true, short: "마무리" },
  필승조: { name: "필승조", tier: 4, everyday: true, short: "필승조" },
  불펜: { name: "불펜", tier: 3, short: "불펜" },
  추격조: { name: "추격조", tier: 2, short: "추격조" },

  /* 1군 밖 */
  육성선수: { name: "육성선수", tier: 0, short: "육성" },
  복무: { name: "복무", tier: 0, short: "복무" },
};

/** 0 = 2군·육성, 6 = 팀의 간판 */
export const roleTier = (role: string | null | undefined): number =>
  ROLES[role ?? ""]?.tier ?? 0;

/** 팀의 얼굴로 대우받는 자리 */
export const isFranchiseRole = (role: string | null | undefined): boolean =>
  ROLES[role ?? ""]?.franchise === true;

/** 주전급 — 매일(혹은 로테이션대로) 나가는 자리 */
export const isEverydayRole = (role: string | null | undefined): boolean =>
  ROLES[role ?? ""]?.everyday === true;

/** 선발 로테이션을 도는 보직인가 — "에이스"에는 '선발'이라는 글자가 없다 */
export const isRotationRole = (role: string | null | undefined): boolean =>
  role === "에이스" || (role ?? "").includes("선발");

/** 그 자리를 얻지 못했을 때 돌아가는 기본 보직 */
export const defaultRoleOf = (p: Player): string =>
  p.kind === "HITTER" ? "주전" : p.position === "SP" ? "선발" : p.position === "CP" ? "마무리" : "불펜";

/** 2군으로 내려갈 때의 보직 */
export const minorRoleOf = (p: Player): string =>
  p.kind === "HITTER" ? "주전" : p.position === "SP" ? "선발" : "불펜";
