import { overall } from "./player";
import { RNG, clamp } from "./rng";
import { isFranchiseRole, roleTier } from "./roles";
import { teamById } from "./teams";
import type { GameState, HofVote, SecondLife, SecondLifeId, SeasonRecord } from "./types";

/* ------------------------------------------------------------------ */
/* 명예의 전당 헌액 투표                                                 */
/* ------------------------------------------------------------------ */

/** 은퇴 후 몇 해가 지나야 후보가 되는가 (실제 KBO 명예의 전당과 같은 5년) */
export const HOF_WAIT = 5;
/** 헌액 기준 득표율 */
export const HOF_CUT = 75;
/** 이 아래로 떨어지면 후보 자격을 잃는다 */
export const HOF_DROP = 5;
/** 최대 후보 유지 연수 */
export const HOF_MAX_BALLOTS = 10;

/**
 * 한 해의 헌액 투표.
 *
 * 실제 기자단 투표처럼 첫 해에는 표가 갈리고, 해가 갈수록 재평가가 이루어진다.
 * 확실한 레전드는 첫 턴에 들어가고, 애매한 선수는 몇 년에 걸쳐 표를 모은다.
 */
export function simHofVote(hofScore: number, ballot: number, rng: RNG): number {
  // 점수 300점 = 헌액 경계선 근처
  const base = clamp((hofScore - 205) * 0.42, 0, 108);
  // 첫 투표는 박하게, 해가 갈수록 표가 모인다 (단, 이미 낮으면 오히려 떨어진다)
  const momentum = base >= 45 ? (ballot - 1) * 5.5 : -(ballot - 1) * 2.5;
  const noise = rng.float(-7, 7);
  return clamp(Math.round(base + momentum + noise), 0, 100);
}

/** 은퇴 직후 만들어 두는 투표 상태 */
export function newHofVote(s: GameState, hofScore: number): HofVote {
  return {
    firstYear: s.year + HOF_WAIT,
    ballots: [],
    inducted: false,
    closed: false,
    score: hofScore,
  };
}

/** 다음 투표를 한 번 진행한다. 더 진행할 것이 없으면 null */
export function advanceHofVote(v: HofVote, rng: RNG): HofVote | null {
  if (v.closed) return null;
  const n = v.ballots.length + 1;
  const share = simHofVote(v.score, n, rng);
  const ballots = [...v.ballots, { year: v.firstYear + n - 1, ballot: n, share }];

  const inducted = share >= HOF_CUT;
  const dropped = share < HOF_DROP || n >= HOF_MAX_BALLOTS;
  return { ...v, ballots, inducted, closed: inducted || dropped };
}

/* ------------------------------------------------------------------ */
/* 은퇴 후 진로                                                         */
/* ------------------------------------------------------------------ */

interface PathDef {
  id: SecondLifeId;
  name: string;
  icon: string;
  desc: string;
  /** 이 길을 택할 수 있는가 */
  when: (c: LegacyContext) => boolean;
  /** 어울리는 정도 (높을수록 잘 풀린다) */
  fit: (c: LegacyContext) => number;
  /** 잘 풀렸을 때 / 평범할 때 결말 */
  good: (c: LegacyContext) => string;
  plain: (c: LegacyContext) => string;
}

export interface LegacyContext {
  hof: number;
  fame: number;
  seasons: number;
  war: number;
  mvp: number;
  rings: number;
  /** 지도자 자질로 쓰이는 멘탈 */
  mental: number;
  /** 동료·구단과의 관계 — 사람을 상대하는 자리일수록 중요하다 */
  teammate: number;
  trust: number;
  /** 마지막 소속팀 */
  teamName: string;
  /** 프랜차이즈로 대우받았는가 */
  franchise: boolean;
  name: string;
  kind: "HITTER" | "PITCHER";
}

const PATHS: PathDef[] = [
  {
    id: "COACH",
    name: "코치",
    icon: "📋",
    desc: "유니폼을 벗고 곧바로 지도자의 길로 들어선다.",
    when: (c) => c.seasons >= 5,
    fit: (c) => c.mental * 0.4 + c.teammate * 0.3 + c.seasons * 2.2 + c.war * 0.4,
    good: (c) => `${c.teamName} 1군 ${c.kind === "HITTER" ? "타격" : "투수"}코치를 거쳐 수석코치까지 올랐습니다. 젊은 선수들이 그를 찾습니다.`,
    plain: (c) => `${c.teamName} 2군에서 지도자 생활을 시작했습니다. 조용하지만 꾸준한 두 번째 커리어입니다.`,
  },
  {
    id: "MANAGER",
    name: "감독",
    icon: "🎩",
    desc: "언젠가 더그아웃의 맨 앞자리에 서는 것을 목표로 한다.",
    when: (c) => c.seasons >= 10 && (c.hof >= 200 || c.mental >= 70) && c.teammate >= 45,
    fit: (c) => c.mental * 0.5 + c.teammate * 0.35 + c.hof * 0.12 + c.rings * 10,
    good: (c) => `코치 생활을 거쳐 ${c.teamName} 감독에 취임했습니다. 부임 3년 차에 팀을 한국시리즈로 이끌었습니다.`,
    plain: () => "몇 해 동안 코치로 일한 뒤 감독대행을 맡았지만, 정식 감독까지는 닿지 못했습니다.",
  },
  {
    id: "COMMENTATOR",
    name: "해설위원",
    icon: "🎙️",
    desc: "마이크를 잡고 중계석에서 야구를 이야기한다.",
    when: (c) => c.fame >= 45,
    fit: (c) => c.fame * 0.75 + c.hof * 0.08,
    good: (c) => `${c.name} 위원의 해설은 시청자가 가장 신뢰하는 목소리가 되었습니다. 야구 예능까지 섭렵했습니다.`,
    plain: () => "케이블 중계 해설로 자리를 잡았습니다. 현장의 감각을 꾸준히 전하고 있습니다.",
  },
  {
    id: "SCOUT",
    name: "스카우트",
    icon: "🔍",
    desc: "전국의 고교·대학 구장을 돌며 다음 세대를 찾는다.",
    when: () => true,
    fit: (c) => c.mental * 0.55 + c.seasons * 1.6,
    good: (c) => `${c.teamName} 스카우트 팀장이 되어, 그가 뽑은 선수들이 줄줄이 1군 주전으로 자랐습니다.`,
    plain: () => "구단 스카우트로 일하며 전국의 야구장을 돌고 있습니다.",
  },
  {
    id: "FRONT",
    name: "프런트",
    icon: "🏢",
    desc: "구단 운영과 선수 관리를 맡는 프런트로 들어간다.",
    when: (c) => c.seasons >= 8,
    fit: (c) => c.mental * 0.45 + c.trust * 0.35 + c.hof * 0.06,
    good: (c) => `${c.teamName} 단장에 선임되어 팀을 다시 만들었습니다. 프런트 야구의 모범이라는 평가를 받습니다.`,
    plain: () => "구단 운영팀에서 일하며 현장과 사무실을 잇는 역할을 맡고 있습니다.",
  },
  {
    id: "ACADEMY",
    name: "야구 아카데미",
    icon: "🧢",
    desc: "직접 야구 교실을 열어 아이들을 가르친다.",
    when: () => true,
    fit: (c) => c.fame * 0.45 + c.mental * 0.35,
    good: (c) => `${c.name} 베이스볼 아카데미는 전국 체인이 되었습니다. 이곳 출신이 프로에 지명되기 시작했습니다.`,
    plain: () => "동네에 작은 야구 교실을 열었습니다. 주말마다 아이들의 웃음소리가 끊이지 않습니다.",
  },
  {
    id: "AWAY",
    name: "야구를 떠나다",
    icon: "🌾",
    desc: "그라운드를 완전히 떠나 다른 삶을 산다.",
    when: () => true,
    fit: (c) => 40 - c.fame * 0.2,
    good: () => "야구와 무관한 사업을 시작해 자리를 잡았습니다. 가끔 관중석에서 경기를 봅니다.",
    plain: () => "야구를 떠나 조용히 지냅니다. 야구장에는 좀처럼 가지 않습니다.",
  },
];

export function legacyContext(s: GameState, hofScore: number): LegacyContext {
  const kbo = s.seasons.filter((r) => r.level === "KBO");
  const last = kbo[kbo.length - 1] as SeasonRecord | undefined;
  const mental = overall(s.player) > 0
    ? (s.player.abilities as unknown as Record<string, number>).mental ?? 60
    : 60;
  return {
    hof: hofScore,
    fame: s.player.fame,
    seasons: kbo.length,
    war: kbo.reduce((a, b) => a + b.line.war, 0),
    mvp: kbo.reduce((a, b) => a + b.awards.filter((x) => x.includes("MVP")).length, 0),
    rings: kbo.filter((r) => r.champion).length,
    mental,
    teammate: s.teammate,
    trust: s.trust,
    teamName: last ? teamById(last.teamId).name : "고향 팀",
    franchise: kbo.some((r) => isFranchiseRole(r.role)) || kbo.filter((r) => roleTier(r.role) >= 5).length >= 5,
    name: s.player.name,
    kind: s.player.kind,
  };
}

/** 지금 고를 수 있는 은퇴 후 진로 */
export function secondLifeOptions(c: LegacyContext): { id: SecondLifeId; name: string; icon: string; desc: string }[] {
  return PATHS.filter((p) => p.when(c)).map((p) => ({ id: p.id, name: p.name, icon: p.icon, desc: p.desc }));
}

/** 고른 길이 어떻게 풀렸는지 */
export function resolveSecondLife(c: LegacyContext, id: SecondLifeId, rng: RNG): SecondLife {
  const path = PATHS.find((p) => p.id === id) ?? PATHS[PATHS.length - 1];
  const fit = path.fit(c);
  // 어울리는 길일수록 잘 풀린다
  const success = rng.next() < clamp(0.12 + fit * 0.0055, 0.1, 0.88);
  return {
    id: path.id,
    name: path.name,
    icon: path.icon,
    success,
    story: success ? path.good(c) : path.plain(c),
  };
}
