import type { Clutch, ClutchResult } from "./clutch";
// 게임 전역 타입 정의

export type Hand = "R" | "L" | "S"; // 우/좌/양
export type Kind = "HITTER" | "PITCHER";

/** 투구폼 (투수 전용) */
export type ArmSlot = "OVER" | "THREE_QUARTER" | "SIDE" | "UNDER";

export type HitterPos = "C" | "1B" | "2B" | "3B" | "SS" | "LF" | "CF" | "RF" | "DH";
export type PitcherPos = "SP" | "RP" | "CP";
export type Position = HitterPos | PitcherPos;

/** 타자 능력치 (0~99) */
export interface HitterAbilities {
  contact: number; // 컨택
  power: number; // 파워
  eye: number; // 선구
  speed: number; // 주력
  defense: number; // 수비
  arm: number; // 송구
}

/** 투수 능력치 (0~99) */
export interface PitcherAbilities {
  velocity: number; // 구속
  control: number; // 제구
  movement: number; // 무브먼트
  breaking: number; // 변화구
  stamina: number; // 스태미나
  fielding: number; // 투수 수비
}

/** 공통 능력치 */
export interface CommonAbilities {
  durability: number; // 내구성
  mental: number; // 멘탈
}

export type Abilities = (HitterAbilities | PitcherAbilities) & CommonAbilities;

export type AbilityKey =
  | keyof HitterAbilities
  | keyof PitcherAbilities
  | keyof CommonAbilities;

/** 한 시즌 타자 성적 */
export interface HitterLine {
  g: number; pa: number; ab: number; h: number; b2: number; b3: number; hr: number;
  rbi: number; r: number; bb: number; so: number; sb: number; cs: number; hbp: number;
  avg: number; obp: number; slg: number; ops: number; war: number;
}

/** 한 시즌 투수 성적 */
export interface PitcherLine {
  g: number; gs: number; ip: number; w: number; l: number; sv: number; hld: number;
  h: number; hrAllowed: number; bb: number; so: number; er: number;
  era: number; whip: number; k9: number; war: number;
}

export type StatLine = HitterLine | PitcherLine;

export type LevelTag = "HS" | "COLLEGE" | "MINOR" | "KBO" | "ARMY";

/** 시즌 내 구간 */
export type SeasonPart = "H1" | "H2" | "PS";

/** 고교 전국대회 한 경기 */
export interface HsRound {
  name: string;
  opponent: string;
  won: boolean;
  score: string;
}

/* ------------------------------------------------------------------ */
/* 이벤트 체인 — 선택이 한두 시즌 뒤 결과로 돌아온다                     */
/* ------------------------------------------------------------------ */

export interface ChainOption {
  id: string;
  label: string;
  desc: string;
  /** 위험한 선택임을 표시 */
  risky?: boolean;
}

/** 지금 선택해야 하는 이벤트 */
export interface ChainPrompt {
  key: string;
  icon: string;
  title: string;
  body: string;
  options: ChainOption[];
}

/** 결과를 기다리는 선택 */
export interface PendingChain {
  key: string;
  choice: string;
  /** 이 해 시즌이 끝나면 결과가 나온다 */
  dueYear: number;
}

/** 구단이 시즌 시작 전에 제시하는 목표 */
export interface SeasonGoal {
  id: string;
  label: string;
  desc: string;
  /** 달성 시 구단 신뢰 변화 */
  reward: number;
  penalty: number;
}

/** 아마추어(고교·대학) 전국대회 결과 */
export interface AmateurTournament {
  id: string;
  name: string;
  month: number;
  /** 16강 탈락 / 8강 / 4강 / 준우승 / 우승 */
  placement: string;
  rounds: HsRound[];
  line: StatLine;
  award: string | null;
}

/** 월 단위 성적 — 시즌 중계 연출에 쓰인다 */
export interface MonthLine {
  key: string;
  label: string;
  line: StatLine;
  /** 그 달을 어디서 보냈는지 */
  level: LevelTag;
  role: string;
  /** 그 달이 끝난 뒤 일어난 엔트리 이동 (ROLE = 같은 레벨 안에서 자리만 바뀜) */
  move?: { type: "UP" | "DOWN" | "ROLE"; role: string; salary?: number };
  /** 그 달 이달의 선수(월간 MVP)로 뽑혔는가 */
  potm?: boolean;
  /** 그 달에 걸린 승부처 상황 (아직 안 골랐으면 결과가 없다) */
  clutchSituation?: Clutch;
  /** 그 달에 치른 승부처 결과 */
  clutch?: ClutchResult;
}

/** 시즌 1건의 기록 */
export interface SeasonRecord {
  year: number;
  age: number;
  level: LevelTag;
  teamId: string;
  teamName: string;
  position: Position;
  role: string; // 주전 / 백업 / 선발 / 불펜 / 마무리 ...
  salary: number; // 만원 단위
  line: StatLine;
  awards: string[];
  teamRank?: number;
  champion?: boolean;
  note?: string;
  /** 전반기 성적 (프로 시즌만) */
  half?: StatLine;
  /**
   * 한 시즌에 1군·2군을 오갔다면 각각의 기록.
   * `line`은 둘을 합친 값이라, 통산 기록을 낼 때는 이쪽을 쓴다.
   */
  byLevel?: { KBO?: StatLine; MINOR?: StatLine };
  /** 아마추어 전국대회 (고교·대학 시즌만) */
  tournaments?: AmateurTournament[];
  /** 가을야구 결과 */
  ps?: PostseasonResult;
  /** 그해 세운 대기록 */
  feats?: string[];
  /** 통산 기록 이정표 */
  milestones?: string[];
  /** 구단 목표 달성 여부 */
  goal?: { label: string; met: boolean; reason?: string };
  allStar?: boolean;
  allStarGame?: AllStarGame;
  /** 그해 이달의 선수를 받은 달 ("4월", "7월" …) */
  potm?: string[];
  /** 아마추어 시즌의 승부처 */
  clutchSituation?: Clutch;
  clutch?: ClutchResult;
}

/** 홈구장 — 같은 성적도 어느 구장에서 뛰느냐에 따라 달라진다 */
export interface Park {
  name: string;
  /** 홈런 보정 (1 기준, 높을수록 타자친화) */
  hr: number;
  /** 인플레이 타구 보정 */
  hit: number;
  label: string;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  city: string;
  color: string;
  accent: string;
  park: Park;
  /** 구단 기본 전력 (0~100) */
  power: number;
  /** 육성 성향: 신인에게 기회를 많이 주는가 */
  youth: number;
  /** 자금력 */
  money: number;
}

export type Phase =
  | "HS_SEASON"
  | "PATH_CHOICE"
  | "COLLEGE_SEASON"
  | "DRAFT"
  /** 스프링캠프 — 훈련 선택 */
  | "SPRING_CAMP"
  /** 전반기 진행 */
  | "FIRST_HALF"
  /**
   * 반기 계산이 끝나고 중계를 보는 중.
   * 올스타·순위 판정은 중계가 끝난 뒤(FINISH_HALF)에 한다 —
   * 중계 도중 승부처로 기록이 한 번 더 바뀌기 때문이다.
   */
  | "HALF_REVIEW"
  /** 올스타 브레이크 — 전반기 성적·올스타 선정 확인 후 후반기로 */
  | "ALL_STAR"
  /** 가을야구 */
  | "POSTSEASON"
  /** 시즌 총평 — 수상·팀 성적·능력치 변화 */
  | "SEASON_END"
  /** 국제대회 */
  | "INTERNATIONAL"
  /** 병역 선택 */
  | "MILITARY_CHOICE"
  /** 복무 시즌 */
  | "MILITARY_SEASON"
  /** 연봉 협상 */
  /** 커리어 갈림길 — 선택이 나중에 결과로 돌아온다 */
  | "EVENT"
  | "NEGOTIATION"
  /** 스토브리그 — 이적 신청 / 잔류 */
  | "STOVE"
  | "FA"
  | "RETIRE_CHOICE"
  /** 은퇴 후 진로 선택 */
  | "SECOND_LIFE"
  | "RETIRED";

export interface Player {
  name: string;
  number: number;
  kind: Kind;
  position: Position;
  bats: Hand;
  throws: Hand;
  /** 투수만 사용 */
  armSlot?: ArmSlot;
  age: number;
  abilities: Abilities;
  /** 능력치별 성장 한계 */
  potential: Abilities;
  /** 재능 등급 0.7 ~ 1.4 */
  talent: number;
  fame: number; // 인지도 0~100
  condition: number; // 컨디션 0~100
  injury: number; // 남은 부상 정도 0~100 (0이면 건강)
  trait: string; // 특성
  traitDesc: string;
  /** 완성도와 성장 여지를 모두 갖춘 특급 유망주로 태어났는가 */
  gifted?: boolean;
}

export interface Contract {
  teamId: string;
  salary: number; // 보장 연봉 (만원)
  years: number; // 총 계약 연수
  remaining: number; // 남은 연수
  role: string;
  /** FA 계약금 (만원) */
  signingBonus?: number;
  /** 매 시즌 달성 시 받는 옵션 (만원) */
  incentivePerYear?: number;
}

export interface LogEntry {
  year: number;
  icon: string;
  title: string;
  body: string;
  tone: "good" | "bad" | "neutral" | "epic";
}

/* ------------------------------------------------------------------ */
/* 은퇴 이후                                                            */
/* ------------------------------------------------------------------ */

/** 명예의 전당 헌액 투표 한 해분 */
export interface HofBallot {
  year: number;
  /** 몇 번째 투표인가 */
  ballot: number;
  /** 득표율 (%) */
  share: number;
}

export interface HofVote {
  /** 첫 투표가 열리는 해 (은퇴 5년 뒤) */
  firstYear: number;
  ballots: HofBallot[];
  inducted: boolean;
  /** 헌액되었거나 후보 자격을 잃어 더 볼 것이 없는가 */
  closed: boolean;
  /** 투표의 근거가 되는 통산 점수 */
  score: number;
}

export type SecondLifeId =
  | "COACH" | "MANAGER" | "COMMENTATOR" | "SCOUT" | "FRONT" | "ACADEMY" | "AWAY";

/** 은퇴 후 걸어간 길 */
export interface SecondLife {
  id: SecondLifeId;
  name: string;
  icon: string;
  /** 그 길에서 성공했는가 */
  success: boolean;
  story: string;
}

/**
 * 유저에게 반드시 보여줘야 하는 통보.
 *
 * 콜업·이적·발탁처럼 커리어가 실제로 꺾이는 사건이 로그 한 줄로만 지나가면
 * 유저는 무슨 일이 있었는지 모른 채 다음 화면으로 넘어간다.
 */
export interface Notice {
  id: string;
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  tone: "good" | "bad" | "epic" | "neutral";
  /** 무엇이 무엇으로 바뀌었는지 (팀 이동·보직 변경·연봉 조정) */
  change?: { label: string; from: string; to: string }[];
  /** 강조 색 (주로 팀 컬러) */
  accent?: string;
}

export interface GameState {
  id: string;
  seed: number;
  createdAt: number;
  year: number;
  phase: Phase;
  player: Player;
  contract: Contract | null;
  seasons: SeasonRecord[];
  logs: LogEntry[];
  serviceYears: number; // 1군 등록 시즌 수 (FA 자격용)
  faUsed: number;
  draftPick: { round: number; overall: number; teamId: string } | null;
  /** 드래프트에서 한 번 미지명됐는가 — 같은 해 재신청을 막는다 */
  draftMissed: boolean;
  wishTeamId: string;
  /** 출신 고교 이름 — 전력이 여기서 나온다 */
  schoolName?: string;
  /** 이번 오프시즌에 고를 수 있는 훈련 후보 */
  pendingTraining: TrainingOption[] | null;
  pendingOffers: Offer[] | null;
  lastSeasonIndex: number | null;
  retireReason?: string;
  /** 은퇴가 강제인가(방출) 권고인가 — 권고면 거부하고 더 뛸 수 있다 */
  retireForced?: boolean;
  /** 은퇴 후 명예의 전당 헌액 투표 */
  hofVote?: HofVote | null;
  /** 은퇴 후 걸어간 길 */
  secondLife?: SecondLife | null;
  /** 아직 유저에게 보여주지 않은 통보 (앞에서부터 하나씩 확인) */
  notices?: Notice[];
  /** 올해 상무에 지원했는가 — 한 해에 한 번만 지원할 수 있다 */
  sangmuApplied?: boolean;
  /** 커리어 통산 상무 지원 횟수 */
  sangmuTries?: number;
  /** 커리어에서 지옥 훈련을 쓴 횟수 */
  hellUsed?: number;
  hofScore?: number;

  /* --- 시즌 진행 --- */
  /** 직전에 치른 반기의 월별 성적 (중계 재생용) */
  monthLines: MonthLine[] | null;
  /** 이번 반기에 걸어둔 승부처 — 해당 월 중계에서 선택을 받는다 */
  pendingClutch: Clutch | null;
  /** 중계 중인 반기 */
  liveHalf: "H1" | "H2" | null;
  /** 은퇴 권고를 뿌리친 해 — 그해 협상에서 구단의 태도가 달라진다 */
  retireRefusedYear: number | null;
  /** 고른 결과 — 중계가 그 달에 닿으면 공개된다 */
  clutchResult: ClutchResult | null;
  /** 그해 이달의 선수를 받은 달 — 시즌이 끝나면 SeasonRecord로 옮겨진다 */
  potmMonths: string[] | null;
  /** 전반기 성적 (후반기 진행 전까지 보관) */
  halfLine: StatLine | null;
  /** 정규시즌 누적 성적 (후반기 종료 후) */
  seasonLine: StatLine | null;
  /** 이번 시즌 1군·2군에서 각각 남긴 기록 (오간 시즌을 나눠 보여주기 위해) */
  seasonByLevel?: { KBO: StatLine | null; MINOR: StatLine | null };
  /** 이번 시즌 소속 레벨·보직 (스프링캠프에서 확정) */
  seasonLevel: LevelTag | null;
  seasonRole: string | null;
  /** 이번 시즌 출장 가능 비율 (부상 반영) */
  seasonAvailability: number;
  /** 이번 시즌 올스타 선정 여부 */
  allStar: boolean;
  /** 올스타전 경기 결과 */
  allStarGame: AllStarGame | null;
  /** 이번 시즌 구단이 제시한 목표 */
  seasonGoal: SeasonGoal | null;
  /** 트레이드 데드라인 제안 (올스타 브레이크에 결정) */
  pendingTrade: { teamId: string; role: string; note: string } | null;
  /** 이번 시즌 1군에서 보낸 비율 (월별 콜업·강등 누적) */
  kboShare: number;
  /** 이번 시즌에 콜업 인상을 이미 받았는가 */
  calledUpThisSeason: boolean;
  /** 전반기 부상 메모 */
  seasonNote: string | null;
  /** 시즌 시작 시점 OVR (변화량 표시용) */
  ovrAtSeasonStart: number;
  /** 팀 정규시즌 순위 */
  teamRank: number | null;
  postseason: PostseasonResult | null;

  /* --- 관계 --- */
  /** 구단 신뢰 0~100 */
  trust: number;
  /** 동료 관계 0~100 */
  teammate: number;

  /* --- 병역 --- */
  military: MilitaryStatus;
  /** 남은 복무 시즌 수 */
  militaryLeft: number;
  /** 국제대회 전적 */
  intlResults: IntlResult[];

  /* --- 대기 중인 선택지 --- */
  pendingNegotiation: Negotiation | null;
  pendingTransfers: TransferTarget[] | null;
  pendingTournament: TournamentId | null;
  /** 대표팀 합류를 수락했는가 — 대회는 시즌 중(전반기 뒤)에 치른다 */
  intlJoined: boolean;
  /** 지금 선택해야 하는 이벤트 */
  pendingEvent: ChainPrompt | null;
  /** 결과를 기다리는 선택들 */
  chains: PendingChain[];
  /** 이미 한 번 겪은 이벤트 (중복 방지) */
  seenEvents: string[];
  /** 다음 시즌 출전에 적용될 보정 (재활·적응 등) */
  nextSeasonAvailability: number;
  /** 이번 스토브리그에 이적 요청을 이미 썼는가 */
  transferRequested: boolean;
}

export interface TrainingOption {
  id: string;
  name: string;
  desc: string;
  icon?: string;
  /** 오르는 능력 전체 (주력 + 곁가지) */
  targets: AbilityKey[];
  /** 주력으로 오르는 능력 — 곁가지보다 크게 오른다 */
  main?: AbilityKey[];
  gain: number;
  risk: number; // 부상 위험 0~1
  conditionCost: number;
  /** 대상 능력의 남은 성장 여지 (잠재력 − 현재). 0이면 더 오르지 않는다 */
  room?: number;
}

export interface Offer {
  teamId: string;
  /** 보장 연봉 (만원/년) */
  salary: number;
  years: number;
  role: string;
  note: string;
  /** 계약금 */
  signingBonus: number;
  /** 옵션 총액 */
  incentive: number;
  /** 보장 총액 = 계약금 + 연봉×연수 */
  guaranteed: number;
  /** 총액 = 보장 + 옵션 */
  total: number;
  /** 옵션 달성 조건 설명 */
  incentiveNote: string;
}


/* ------------------------------------------------------------------ */
/* 병역                                                                */
/* ------------------------------------------------------------------ */

export type MilitaryStatus =
  /** 미필 */
  | "PENDING"
  /** 국제대회 성적으로 면제 */
  | "EXEMPT"
  /** 상무(국군체육부대) 복무 중 — 퓨처스리그에서 계속 뛴다 */
  | "SANGMU"
  /** 현역 복무 중 — 야구를 쉰다 */
  | "ACTIVE"
  /** 복무 완료 */
  | "DONE";

export const MILITARY_LABEL: Record<MilitaryStatus, string> = {
  PENDING: "미필",
  EXEMPT: "병역 면제",
  SANGMU: "상무 복무 중",
  ACTIVE: "현역 복무 중",
  DONE: "병역필",
};

/* ------------------------------------------------------------------ */
/* 국제대회                                                            */
/* ------------------------------------------------------------------ */

export type TournamentId = "WBC" | "PREMIER12" | "OLYMPIC" | "ASIAN_GAMES";

export interface Tournament {
  id: TournamentId;
  name: string;
  short: string;
  month: string;
  /** 병역 혜택 조건 설명. 없으면 혜택 없음 */
  exemption: string | null;
  /** 대표팀 선발 기준 OVR */
  bar: number;
  icon: string;
  /** 시즌 어느 시점에 열리는가 — 실제 개최 월과 맞춘다 */
  slot: TournamentSlot;
}

/** PRE 개막 전(3월) · MID 올스타 브레이크(7월) · LATE 후반기 중(9월) · POST 시즌 종료 후(11월) */
export type TournamentSlot = "PRE" | "MID" | "LATE" | "POST";

/** 국제대회 한 경기 */
export interface IntlGame {
  round: string;
  /** 조별리그인가 녹아웃인가 — 중계에서 대회 현황을 그리는 데 쓴다 */
  stage?: "GROUP" | "SUPER" | "KNOCKOUT" | "FINAL";
  opponent: string;
  won: boolean;
  score: string;
  line: StatLine;
  /** 그 경기에 나갔는가 (투수는 등판하지 않는 경기가 있다) */
  appeared: boolean;
}

/** 올스타전 */
export interface AllStarGame {
  side: string;
  opponent: string;
  won: boolean;
  score: string;
  line: StatLine;
  mvp: boolean;
  /** 큰 무대의 승부처 */
  clutchSituation?: Clutch;
  clutch?: ClutchResult;
}

export interface IntlResult {
  year: number;
  tournamentId: TournamentId;
  tournamentName: string;
  /** 최종 순위 (1=우승) */
  rank: number;
  medal: "금" | "은" | "동" | null;
  line: StatLine;
  games: IntlGame[];
  exempted: boolean;
  note: string;
  /** 큰 무대의 승부처 */
  clutchSituation?: Clutch;
  clutch?: ClutchResult;
}

/* ------------------------------------------------------------------ */
/* 연봉 협상                                                           */
/* ------------------------------------------------------------------ */

export interface NegotiationOption {
  id: "accept" | "push" | "arbitration";
  label: string;
  desc: string;
  /** 성공 확률 (0~1). accept는 1 */
  odds: number;
  /** 성공했을 때 받는 금액 (만원) */
  onSuccess: number;
  /** 실패했을 때 받는 금액 (만원) — 요구가 셀수록 직전 연봉보다 크게 깎인다 */
  onFail: number;
  trustOnSuccess: number;
  trustOnFail: number;
}

export interface Negotiation {
  /** 구단 제시액 */
  offer: number;
  /** 직전 연봉 */
  previous: number;
  options: NegotiationOption[];
}

/* ------------------------------------------------------------------ */
/* 이적 신청                                                           */
/* ------------------------------------------------------------------ */

export interface TransferTarget {
  teamId: string;
  /** 영입 관심도 0~100 */
  interest: number;
  /** 성사 확률 0~1 */
  odds: number;
  /** 예상 보직 */
  role: string;
  note: string;
  /** 구단 전력 (0~100) */
  power: number;
  /** 전력 기준 예상 순위 1~10 */
  projRank: number;
  /** 우승 도전권 / 중위권 / 리빌딩 */
  outlook: string;
}

/* ------------------------------------------------------------------ */
/* 포스트시즌                                                          */
/* ------------------------------------------------------------------ */

export interface PostseasonRound {
  name: string;
  opponent: string;
  win: boolean;
  score: string;
  /** 해당 시리즈에서의 개인 기록 */
  line: StatLine;
}

export interface PostseasonResult {
  seed: number;
  rounds: PostseasonRound[];
  champion: boolean;
  line: StatLine;
  /** 큰 무대의 승부처 */
  clutchSituation?: Clutch;
  clutch?: ClutchResult;
}
