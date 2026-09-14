import { RNG, clamp, n50 } from "./rng";
import { TEAMS, teamById } from "./teams";
import {
  ABILITY_LABEL, ABILITY_MAX, abilityKeys, deriveStyle, developmentRate, getAb,
  grow, HELL_LIMIT, hellOdds, injuryRiskMultiplier, makeTrainingOptions, overall,
  potentialOverall, setAb,
} from "./player";
import {
  emptyLine, HALF_SHARE, isHitterLine, judgeAllStar, judgeAwards, MAJOR_TITLES, mergeLines,
  simAllStarGame, simHitter, simPitcher,
} from "./sim";
import {
  HOF_CUT, advanceHofVote, legacyContext, newHofVote, resolveSecondLife,
} from "./legacy";
import { judgeMonthForm, potmOdds } from "./form";
import { PS_CUT, simPostseason } from "./postseason";
import {
  defaultRoleOf, isEverydayRole, isFranchiseRole, isRotationRole, minorRoleOf, roleTier,
} from "./roles";
import { placementScore, simAmateurSeason } from "./amateur";
import { schoolOf } from "./school";
import { chainByKey, pickChain } from "./events";
import { judgeSeasonGoal, makeSeasonGoal, newMilestones, rollFeats } from "./records";
import {
  MILITARY_DEADLINE, MILITARY_OPTIONS, TOURNAMENTS, canVolunteer, isCalledUp,
  isServing, sangmuOdds, SANGMU_MAX_TRIES, simTournament, tournamentOf,
} from "./national";
import type {
  AmateurTournament, GameState, HitterLine, LevelTag, LogEntry, MonthLine, Negotiation,
  NegotiationOption, Offer, PitcherLine, Player, SeasonRecord, StatLine, Team,
  Notice, SecondLifeId, TournamentSlot, TransferTarget, TrainingOption,
} from "./types";

export const START_YEAR = 2026;
export const MIN_SALARY = 3000; // 만원
export const MAX_SALARY = 300000; // 30억 (리그 상한)
/**
 * 리그 연봉 상한. FA 이전에 따로 걸던 상한(10억)은 없앴다 —
 * 벽에 부딪혀 "협상해도 안 오른다"가 되는 대신, 인상 폭 자체를 눌러 억제한다.
 */
export const FA_SERVICE = 8;

export const formatMoney = (man: number) => {
  if (man >= 10000) {
    const eok = man / 10000;
    return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억원`;
  }
  return `${Math.round(man).toLocaleString()}만원`;
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** 유저가 반드시 확인하고 넘어가야 하는 통보를 큐에 쌓는다 */
function notify(s: GameState, n: Omit<Notice, "id">) {
  s.notices = [...(s.notices ?? []), { id: `${s.year}-${(s.notices?.length ?? 0)}-${n.title}`, ...n }];
}

function log(s: GameState, e: Omit<LogEntry, "year">) {
  s.logs.unshift({ year: s.year, ...e });
  if (s.logs.length > 240) s.logs.pop();
}

/* ------------------------------------------------------------------ */
/* 새 게임                                                              */
/* ------------------------------------------------------------------ */

export function newGame(player: Player, wishTeamId: string, seed: number, schoolName = ""): GameState {
  return {
    id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    seed,
    createdAt: Date.now(),
    year: START_YEAR,
    phase: "HS_SEASON",
    player,
    contract: null,
    seasons: [],
    logs: [{
      year: START_YEAR, icon: "🌱", title: "고교 3학년, 마지막 시즌", tone: "neutral",
      body: `${player.name} 선수의 야구 인생이 시작됩니다. 이번 시즌 활약이 드래프트 순위를 좌우합니다.`,
    }],
    serviceYears: 0,
    faUsed: 0,
    draftPick: null,
    draftMissed: false,
    wishTeamId,
    schoolName,
    pendingTraining: null,
    pendingOffers: null,
    lastSeasonIndex: null,

    monthLines: null,
    halfLine: null,
    seasonLine: null,
    seasonLevel: null,
    seasonRole: null,
    seasonAvailability: 1,
    allStar: false,
    allStarGame: null,
    potmMonths: null,
    seasonNote: null,
    ovrAtSeasonStart: overall(player),
    teamRank: null,
    postseason: null,

    trust: 55,
    teammate: 55,

    military: "PENDING",
    militaryLeft: 0,
    intlResults: [],

    pendingNegotiation: null,
    pendingTransfers: null,
    pendingTournament: null,
    intlJoined: false,
    pendingEvent: null,
    chains: [],
    seenEvents: [],
    nextSeasonAvailability: 1,
    seasonGoal: null,
    pendingTrade: null,
    kboShare: 0,
    calledUpThisSeason: false,
    transferRequested: false,
  };
}

/* ------------------------------------------------------------------ */
/* 부상 / 보직                                                          */
/* ------------------------------------------------------------------ */

function rollInjury(p: Player, rng: RNG): { availability: number; note: string | null } {
  let chance = clamp(0.30 - n50(getAb(p.abilities, "durability" as never)) * 0.2, 0.04, 0.55);
  if (p.trait === "glass") chance += 0.14;
  if (p.trait === "ironman") chance -= 0.12;
  chance = clamp(chance + (p.age >= 33 ? 0.08 : 0) + (p.age >= 36 ? 0.07 : 0), 0.03, 0.65);
  if (!rng.chance(chance)) return { availability: 1, note: null };

  const severity = rng.weighted(["경미", "중간", "심각"], [55, 32, 13]);
  const miss = severity === "경미" ? rng.float(0.05, 0.18)
    : severity === "중간" ? rng.float(0.2, 0.45) : rng.float(0.5, 0.85);
  const names = ["햄스트링 부상", "옆구리 통증", "손목 염좌", "어깨 염증", "무릎 통증", "피로 골절", "발목 인대 손상", "허리 디스크"];
  const inj = rng.pick(names);
  if (severity === "심각") {
    setAb(p.abilities, "durability" as never, clamp(getAb(p.abilities, "durability" as never) - rng.int(2, 6), 10, ABILITY_MAX));
  }
  return { availability: 1 - miss, note: `${inj}(${severity}) — 시즌의 약 ${Math.round(miss * 100)}%를 결장했습니다.` };
}

export function assignRole(
  p: Player, team: Team, serviceYears: number, trust: number, rng: RNG, proYears = 99,
): { level: LevelTag; role: string } {
  const ovr = overall(p);
  const bar = 73 + (team.power - 65) * 0.2 - (team.youth - 55) * 0.06;
  const bonus = (serviceYears >= 3 ? 2.5 : 0) + (trust - 55) * 0.075;

  // 구단은 검증되지 않은 신인을 바로 1군에 올리지 않는다.
  // 프로에서 한 해씩 보낼수록 이 할인이 줄어든다 — 고졸이 2군을 거치는 이유.
  const unproven = proYears <= 0 ? 8.5 : proYears === 1 ? 4.6 : proYears === 2 ? 2 : 0;
  // 나이가 어릴수록 천천히 키운다 (대졸은 이 감점이 없다)
  const youth = p.age <= 19 ? 4.4 : p.age <= 21 ? 2.5 : 0;

  const v = ovr + bonus - unproven - youth + rng.float(-2, 2);

  if (p.kind === "PITCHER") {
    if (p.position === "CP") {
      if (v >= bar + 2.5) return { level: "KBO", role: "마무리" };
      if (v >= bar - 3) return { level: "KBO", role: "필승조" };
      if (v >= bar - 8) return { level: "KBO", role: "불펜" };
      if (v >= bar - 12.5) return { level: "KBO", role: "추격조" };
      return { level: "MINOR", role: "불펜" };
    }
    if (p.position === "SP") {
      if (v >= bar + 16) return { level: "KBO", role: "에이스" };
      if (v >= bar + 9) return { level: "KBO", role: "1선발" };
      if (v >= bar) return { level: "KBO", role: "선발" };
      if (v >= bar - 6) return { level: "KBO", role: "5선발" };
      if (v >= bar - 14) return { level: "KBO", role: "불펜" };
      return { level: "MINOR", role: "선발" };
    }
    if (v >= bar + 8) return { level: "KBO", role: "필승조" };
    if (v >= bar + 2.5) return { level: "KBO", role: "불펜" };
    if (v >= bar - 10) return { level: "KBO", role: "추격조" };
    return { level: "MINOR", role: "불펜" };
  }
  if (v >= bar + 17) return { level: "KBO", role: "간판타자" };
  if (v >= bar + 11) return { level: "KBO", role: "핵심타자" };
  if (v >= bar + 5) return { level: "KBO", role: "주전" };
  if (v >= bar - 2.5) return { level: "KBO", role: "준주전" };
  if (v >= bar - 11) return { level: "KBO", role: "백업" };
  return { level: "MINOR", role: "주전" };
}

/**
 * 월별 경기 배분 (정규시즌 전체를 1로 봤을 때).
 * KBO는 3월 말 개막 ~ 10월 초 종료, 7월 중순 올스타 브레이크.
 */
export const H1_MONTHS = [
  { key: "4", label: "4월", share: 0.15 },
  { key: "5", label: "5월", share: 0.16 },
  { key: "6", label: "6월", share: 0.15 },
  { key: "7", label: "7월", share: 0.14 },
] as const;

export const H2_MONTHS = [
  { key: "8", label: "8월", share: 0.16 },
  { key: "9", label: "9월", share: 0.15 },
  { key: "10", label: "10월", share: 0.09 },
] as const;

/** 직전 아마추어 시즌의 전국대회 성적에 따른 성장 배수 */
function amateurDevBonus(s: GameState): number {
  const rec = [...s.seasons].reverse().find((r) => r.tournaments?.length);
  if (!rec?.tournaments) return 1;
  const total = rec.tournaments.reduce((a, t) => a + placementScore(t.placement), 0);
  return clamp(1 + (total - 6) * 0.045, 0.76, 1.32);
}

const defaultRole = (p: Player) =>
  defaultRoleOf(p);

/* ------------------------------------------------------------------ */
/* 커리어 이벤트 (자동 트레이드 제거 — 이적은 유저가 신청한다)            */
/* ------------------------------------------------------------------ */

interface EventDef {
  id: string; title: string; icon: string; tone: LogEntry["tone"]; weight: number;
  when: (s: GameState) => boolean;
  body: (s: GameState) => string;
  apply: (s: GameState, rng: RNG) => void;
}

const EVENTS: EventDef[] = [
  {
    id: "mentor", icon: "🧑‍🏫", title: "베테랑의 조언", tone: "good", weight: 14,
    when: (s) => s.player.age <= 27,
    body: () => "팀 베테랑에게 기술을 전수받았습니다. 약점이 조금 보완되었습니다.",
    apply: (s, rng) => {
      const keys = abilityKeys(s.player.kind);
      const weakest = keys.reduce((a, b) => (getAb(s.player.abilities, a) < getAb(s.player.abilities, b) ? a : b));
      setAb(s.player.abilities, weakest, clamp(getAb(s.player.abilities, weakest) + rng.int(2, 5), 0, ABILITY_MAX));
      s.teammate = clamp(s.teammate + rng.int(2, 5), 0, 100);
    },
  },
  {
    id: "slump", icon: "🌧️", title: "긴 슬럼프", tone: "bad", weight: 13,
    when: () => true,
    body: () => "원인을 알 수 없는 부진이 이어졌습니다. 컨디션이 크게 떨어졌습니다.",
    apply: (s, rng) => { s.player.condition = clamp(s.player.condition - rng.int(12, 25), 20, 100); },
  },
  {
    id: "breakout", icon: "⚡", title: "각성", tone: "epic", weight: 8,
    when: (s) => s.player.age <= 29,
    body: () => "무언가를 깨달았습니다. 주무기가 한 단계 진화했습니다.",
    apply: (s, rng) => {
      const keys = abilityKeys(s.player.kind);
      const best = keys.reduce((a, b) => (getAb(s.player.abilities, a) > getAb(s.player.abilities, b) ? a : b));
      setAb(s.player.abilities, best, clamp(getAb(s.player.abilities, best) + rng.int(4, 8), 0, ABILITY_MAX));
      setAb(s.player.potential, best, clamp(getAb(s.player.potential, best) + rng.int(2, 6), 0, ABILITY_MAX));
    },
  },
  {
    id: "cf", icon: "📺", title: "광고 촬영", tone: "good", weight: 10,
    when: (s) => s.player.fame >= 35,
    body: () => "대형 광고 모델로 발탁되었습니다. 인지도가 상승했습니다.",
    apply: (s, rng) => { s.player.fame = clamp(s.player.fame + rng.int(5, 12), 0, 100); },
  },
  {
    id: "scandal", icon: "🚨", title: "구설수", tone: "bad", weight: 7,
    when: (s) => s.player.fame >= 30,
    body: () => "사생활 논란으로 여론이 나빠졌습니다. 구단 신뢰가 흔들립니다.",
    apply: (s, rng) => {
      s.player.fame = clamp(s.player.fame - rng.int(8, 18), 0, 100);
      s.trust = clamp(s.trust - rng.int(6, 14), 0, 100);
    },
  },
  {
    id: "coach", icon: "🧪", title: "새 코치 부임", tone: "good", weight: 10,
    when: () => true,
    body: () => "새로 부임한 코치와 궁합이 좋습니다. 몸 상태가 올라왔습니다.",
    apply: (s, rng) => { s.player.condition = clamp(s.player.condition + rng.int(8, 16), 0, 100); },
  },
  {
    id: "clubhouse", icon: "🤝", title: "클럽하우스 리더", tone: "good", weight: 9,
    when: (s) => s.player.age >= 28 && s.serviceYears >= 4,
    body: () => "라커룸에서 후배들을 이끄는 역할을 맡았습니다.",
    apply: (s, rng) => {
      s.teammate = clamp(s.teammate + rng.int(5, 10), 0, 100);
      s.trust = clamp(s.trust + rng.int(3, 7), 0, 100);
    },
  },
];

function rollEvent(s: GameState, rng: RNG) {
  if (!rng.chance(0.45)) return;
  const pool = EVENTS.filter((e) => e.when(s));
  if (!pool.length) return;
  const ev = rng.weighted(pool, pool.map((e) => e.weight));
  const body = ev.body(s);
  ev.apply(s, rng);
  log(s, { icon: ev.icon, title: ev.title, body, tone: ev.tone });
}

/* ------------------------------------------------------------------ */
/* 드래프트                                                             */
/* ------------------------------------------------------------------ */

/** 지명 가능성 점수 */
export function draftScore(s: GameState): number {
  const ovr = overall(s.player);
  const pot = potentialOverall(s.player);
  const amateur = s.seasons.filter((x) => x.level === "HS" || x.level === "COLLEGE");
  const last = amateur[amateur.length - 1];
  // 성적. 이 항이 작으면 "타율 .261에 WAR −0.2인데 상위 지명"이 나온다 —
  // 아마추어 리그 평균(타자 OPS .70 / 투수 ERA 4.2) 대비로 폭을 넓게 잡는다.
  let perf = 0;
  if (last) {
    if (isHitterLine(last.line)) {
      perf = (last.line.ops - 0.70) * 42 + last.line.hr * 0.9 + last.line.war * 2.4;
    } else {
      const q = last.line as PitcherLine;
      perf = (4.2 - q.era) * 4.2 + q.so * 0.07 + q.war * 2.4;
    }
  }
  // 전국대회에서 큰 무대를 밟은 경험은 스카우트 평가에 직접 반영된다.
  // 가장 최근 아마추어 시즌을 본다 (대학에 갔다면 대학 성적)
  const lastTourney = [...amateur].reverse().find((x) => x.tournaments?.length);
  const tourneyBonus = lastTourney?.tournaments
    ? lastTourney.tournaments.reduce((a, t) => a + placementScore(t.placement), 0) * 0.9
      + lastTourney.awards.length * 3
    : 0;
  // 스카우트는 지금의 기량만이 아니라 나이 대비 성장 여지를 본다.
  // 같은 능력치라면 고졸이 대졸보다 훨씬 높게 평가받는다 — 실제 드래프트와 같은 이유.
  const upside = s.player.age <= 18 ? 5.5 : s.player.age <= 19 ? 4.5 : s.player.age <= 20 ? 2.5 : s.player.age <= 21 ? 1 : 0;
  // 어릴수록 잠재력의 비중이 커진다
  const potWeight = s.player.age <= 19 ? 0.28 : s.player.age <= 21 ? 0.24 : 0.2;

  return ovr * 0.55 + pot * potWeight + perf + s.player.fame * 0.12 + tourneyBonus + upside;
}

/** UI에 보여줄 지명 확률과 예상 라운드 */
export function draftForecast(s: GameState) {
  const score = draftScore(s);
  const odds = clamp((score - 54) / 34, 0.02, 0.96);
  const round =
    score >= 91 ? "1라운드 상위" : score >= 84 ? "1라운드" : score >= 78 ? "2~3라운드"
    : score >= 72 ? "4~6라운드" : score >= 66 ? "7~9라운드" : score >= 59 ? "10라운드" : "미지명 유력";
  return { odds, round };
}

function runDraft(s: GameState, rng: RNG) {
  // 어린 선수일수록 스카우트 평가가 크게 갈린다 — 대박도 쪽박도 고졸에서 나온다
  const spread = s.player.age <= 19 ? 5.5 : s.player.age <= 21 ? 4 : 3;
  const score = draftScore(s) + rng.normal() * spread;
  let overallPick: number;
  if (score >= 91) overallPick = rng.int(1, 3);
  else if (score >= 84) overallPick = rng.int(1, 10);
  else if (score >= 78) overallPick = rng.int(5, 20);
  else if (score >= 72) overallPick = rng.int(15, 40);
  else if (score >= 66) overallPick = rng.int(30, 70);
  else if (score >= 59) overallPick = rng.int(60, 100);
  else overallPick = 0;

  const collegeSeasons = s.seasons.filter((x) => x.level === "COLLEGE").length;

  if (overallPick === 0) {
    // 고교 졸업 직후 미지명이면 대학 진학으로 재도전할 수 있다.
    // 같은 해에 드래프트를 다시 신청할 수는 없다 (무한 재도전 방지).
    if (collegeSeasons === 0 && !s.draftMissed) {
      s.draftMissed = true;
      log(s, {
        icon: "💔", title: "미지명", tone: "bad",
        body: "지명을 받지 못했습니다. 대학에 진학해 다시 도전하거나, 육성선수로 입단할 수 있습니다.",
      });
      s.phase = "PATH_CHOICE";
      return;
    }
    log(s, {
      icon: "💔", title: "미지명", tone: "bad",
      body: "끝내 지명을 받지 못했습니다. 육성선수(신고선수)로 입단해 바닥부터 시작합니다.",
    });
    const team = rng.pick(TEAMS.filter((t) => t.youth >= 55));
    s.draftPick = { round: 0, overall: 0, teamId: team.id };
    s.contract = { teamId: team.id, salary: MIN_SALARY, years: 1, remaining: 1, role: "육성선수" };
    return;
  }

  const round = Math.ceil(overallPick / 10);
  const wish = teamById(s.wishTeamId);
  const wishChance = clamp(0.12 + (100 - overallPick) * 0.0018 + (wish.youth - 55) * 0.004, 0.05, 0.35);
  const team = rng.chance(wishChance) ? wish : rng.pick(TEAMS);
  const bonus = Math.round(clamp(45000 - overallPick * 430, 3000, 50000) / 500) * 500;

  s.draftPick = { round, overall: overallPick, teamId: team.id };
  s.contract = { teamId: team.id, salary: MIN_SALARY, years: 1, remaining: 1, role: "신인" };
  s.player.fame = clamp(s.player.fame + Math.max(0, 30 - overallPick), 0, 100);
  s.trust = clamp(s.trust + Math.max(0, 18 - overallPick * 0.4), 0, 100);

  log(s, {
    icon: overallPick <= 3 ? "🌟" : "🎉",
    title: `${round}라운드 전체 ${overallPick}순위 지명`,
    tone: overallPick <= 10 ? "epic" : "good",
    body: `${team.name}의 지명을 받았습니다. 계약금 ${formatMoney(bonus)}, 첫해 연봉 ${formatMoney(MIN_SALARY)}${team.id === wish.id ? " — 희망 구단 입단에 성공했습니다!" : ""}`,
  });
}

/* ------------------------------------------------------------------ */
/* 연봉 협상                                                            */
/* ------------------------------------------------------------------ */

function buildNegotiation(s: GameState, rec: SeasonRecord): Negotiation {
  const prev = s.contract?.salary ?? MIN_SALARY;
  const war = rec.line.war;
  const star = s.player.trait === "star" ? 1.1 : 1;

  // 타이틀은 크게, 올스타는 가볍게 쳐준다
  const awardWeight = rec.awards.reduce((a, x) =>
    a + (x.includes("MVP") ? 0.26 : MAJOR_TITLES.includes(x) ? 0.14
      : x === "신인왕" || x === "골든글러브" ? 0.10 : 0.035), 0);

  // 태극마크와 올스타전 활약도 몸값이다
  const intlWeight = s.intlResults
    .filter((r) => r.year === rec.year)
    .reduce((a, r) => a + (r.medal === "금" ? 0.14 : r.medal ? 0.09 : 0.035), 0);
  const asWeight = rec.allStarGame?.mvp ? 0.08 : 0;
  // 병역을 해결한 선수는 공백 위험이 없어 그만큼 값이 붙는다
  const milWeight = s.military === "EXEMPT" ? 0.07 : s.military === "DONE" ? 0.04 : 0;
  // 팀 내 입지 — 간판으로 대우받는 선수는 성적이 같아도 대접이 다르다
  const roleWeight = isFranchiseRole(rec.role) ? 0.16
    : roleTier(rec.role) >= 5 ? 0.09
      : roleTier(rec.role) >= 4 ? 0.04 : 0;

  /**
   * 눈에 보이는 성적. WAR만 보면 지명타자·1루수가 같은 활약을 하고도
   * 구조적으로 헐값이 된다 — 구단은 홈런과 타점으로도 지갑을 연다.
   */
  const l = rec.line as HitterLine & PitcherLine;
  const statWeight = l.pa !== undefined
    ? Math.max(0, l.hr - 22) * 0.007 + Math.max(0, l.rbi - 85) * 0.0016
      + Math.max(0, (l.avg - 0.305) * 1.1) + Math.max(0, (l.ops - 0.870) * 0.8)
    : Math.max(0, l.w - 11) * 0.015 + Math.max(0, l.sv - 22) * 0.008
      + Math.max(0, l.hld - 20) * 0.006 + Math.max(0, (3.70 - l.era) * 0.07)
      + Math.max(0, l.ip - 155) * 0.0008;

  // 젊을수록 앞으로가 길어 값을 더 쳐준다
  const ageWeight = s.player.age <= 25 ? 0.08 : s.player.age <= 28 ? 0.04
    : s.player.age <= 31 ? 0 : s.player.age <= 34 ? -0.05 : -0.10;

  // 가을야구에서의 활약과 우승 반지
  const ps = rec.ps;
  const psWeight = (rec.champion ? 0.06 : 0)
    + (ps ? clamp(ps.line.war * 0.05, 0, 0.08) : 0);

  // 한 시즌을 온전히 뛰었는가 — 자주 빠지면 구단이 값을 낮춘다
  const healthWeight = clamp((s.seasonAvailability - 0.82) * 0.35, -0.12, 0.04);

  // 인지도는 티켓·굿즈로 이어진다
  const fameWeight = clamp((s.player.fame - 55) * 0.0016, -0.05, 0.08);

  let mult = 0.95 + clamp(war * 0.055, -0.3, 0.45)
    + awardWeight + intlWeight + asWeight + milWeight + roleWeight
    + statWeight + ageWeight + psWeight + healthWeight + fameWeight;
  if (rec.level !== "KBO") mult = Math.min(mult, 1.05);
  if (s.serviceYears <= 2) mult = Math.min(mult, 2.4);
  // 실제 KBO 연봉 구조 — 최저연봉 근처는 조금만 잘해도 크게 오르고,
  // 고액이 될수록 같은 성적으로 올릴 수 있는 폭이 급격히 줄어든다
  if (prev < 10000) mult = 1 + (mult - 1) * 2.2;
  else if (prev < 20000) mult = 1 + (mult - 1) * 1.5;
  else if (prev < 50000) mult = 1 + (mult - 1) * 0.85;
  else if (prev < 100000) mult = 1 + (mult - 1) * 0.5;
  else if (prev < 200000) mult = 1 + (mult - 1) * 0.28;
  else mult = 1 + (mult - 1) * 0.15;
  if (s.player.age >= 34) mult = Math.min(mult, 1.15);
  mult *= 0.94 + (s.trust / 100) * 0.12;
  // 이미 고액이면 한 해 인상 폭에 제동이 걸린다
  if (prev >= 100000) mult = Math.min(mult, 1.55);
  else if (prev >= 50000) mult = Math.min(mult, 1.9);

  // FA 이전에는 구단이 값을 크게 부르지 않는다
  const cap = MAX_SALARY;

  // 인상률만으로는 연봉이 복리로 불어나 결국 상한에 붙는다.
  // 실제 구단은 "지금 이 선수의 값어치"를 기준으로 다시 계산하므로,
  // 직전 연봉에서 출발한 금액을 적정 몸값 쪽으로 끌어당긴다.
  /**
   * 적정 몸값 앵커.
   *
   * `marketValue()`는 리그 연봉 상한(30억)으로 잘려 나오므로, 여기에 0.30을
   * 곱하면 **앵커의 천장이 9억으로 고정된다.** 11억을 받는 선수는 MVP를 받아도
   * 앵커가 자기 연봉보다 낮아 끌려 내려갔다(대박 시즌의 89%가 삭감 제안).
   * 몸값 계산에는 연봉 상한을 씌우지 않는다 — 상한은 지급액의 한계이지
   * 값어치의 한계가 아니다. 최종 제시액에만 상한을 건다.
   */
  const fair = clamp(marketValue(s, MAX_SALARY * 3) * 0.30, MIN_SALARY, cap);
  const raised = prev * mult * star;
  // 연차가 쌓일수록 시장가에 가깝게 평가받는다
  const pull = clamp(0.22 + s.serviceYears * 0.035, 0.22, 0.55);
  let offer = clamp(
    Math.round((raised * (1 - pull) + fair * pull) / 100) * 100,
    MIN_SALARY, cap,
  );

  /**
   * 구단은 잘한 선수의 연봉을 깎지 않는다.
   * 실제 KBO에서 삭감은 성적이 나빴거나 거의 못 뛴 선수에게만 일어난다.
   * 계산이 어떻게 나오든 이 선은 지킨다.
   */
  const earnedRaise = rec.level === "KBO"
    && (war >= 2.5 || awardWeight >= 0.10 || rec.awards.some((x) => x.includes("MVP")));
  if (earnedRaise) offer = Math.max(offer, Math.min(prev, cap));

  // 성적이 좋을수록 재협상 성공 확률이 높다
  const leverage = clamp(
    0.32 + war * 0.07 + (awardWeight + intlWeight + asWeight) * 0.5 + (s.trust - 55) * 0.004,
    0.1, 0.85,
  );

  /** 만원 단위로 다듬고 상·하한을 지킨다 */
  const money = (v: number) => clamp(Math.round(v / 100) * 100, MIN_SALARY, cap);

  const options: NegotiationOption[] = [
    {
      id: "accept", label: "구단 제시액 수용",
      desc: "군말 없이 사인한다. 구단과의 관계가 좋아진다.",
      odds: 1, onSuccess: offer, onFail: offer, trustOnSuccess: 3, trustOnFail: 0,
    },
    {
      id: "push", label: "재협상 요구",
      desc: "성적을 근거로 인상을 요구한다. 무리하면 관계가 나빠진다.",
      odds: leverage,
      onSuccess: money(offer * 1.18),
      // 판이 깨지면 구단이 칼을 빼 든다 — 직전 연봉보다 깎인다
      onFail: money(Math.min(offer * 0.97, prev * 0.93)),
      trustOnSuccess: -2, trustOnFail: -7,
    },
    {
      id: "arbitration", label: "연봉조정 신청",
      desc: "구단과 끝까지 맞선다. 이기면 크게 오르지만 지면 타격이 크다.",
      odds: clamp(leverage * 0.55, 0.05, 0.55),
      onSuccess: money(offer * 1.62),
      onFail: money(Math.min(offer * 0.86, prev * 0.80)),
      trustOnSuccess: -8, trustOnFail: -18,
    },
  ];
  return { offer, previous: prev, options };
}

/* ------------------------------------------------------------------ */
/* FA / 이적 신청                                                       */
/* ------------------------------------------------------------------ */

function marketValue(s: GameState, ceiling = MAX_SALARY): number {
  const recent = s.seasons.filter((x) => x.level === "KBO").slice(-3);
  const recentWar = recent.reduce((a, b) => a + b.line.war, 0) / Math.max(1, recent.length);
  const ovr = overall(s.player);
  const ageP = clamp(1.25 - (s.player.age - 28) * 0.075, 0.35, 1.3);
  // 미필은 군 공백 위험이 있어 구단이 값을 낮게 부른다
  const milFactor = s.military === "PENDING" ? 0.82 : 1;
  // 태극마크 경력은 시장에서 프리미엄이 붙는다
  const medals = s.intlResults.filter((r) => r.medal).length;
  const intlFactor = 1 + Math.min(0.15, medals * 0.04);

  /**
   * 구단은 WAR로만 지갑을 열지 않는다.
   * 홈런왕·타점왕을 수비 가치가 낮다는 이유로 싸게 사지는 못하므로
   * **눈에 보이는 성적**을 따로 친다. 이게 없으면 지명타자·1루수가
   * 같은 활약을 하고도 구조적으로 헐값이 된다.
   */
  let counting = 0;
  for (const r of recent) {
    const l = r.line as HitterLine & PitcherLine;
    if (l.pa !== undefined) {
      counting += Math.max(0, l.hr - 20) * 210 + Math.max(0, l.rbi - 80) * 42
        + Math.max(0, (l.ops - 0.83) * 14000);
    } else {
      counting += Math.max(0, l.w - 10) * 480 + Math.max(0, l.sv - 20) * 260
        + Math.max(0, (3.9 - l.era) * 1600);
    }
  }
  counting /= Math.max(1, recent.length);
  // 타이틀은 몸값의 가장 확실한 근거다
  const titles = recent.reduce((a, r) =>
    a + r.awards.filter((x) => x.endsWith("왕") || x.includes("MVP")).length, 0);

  return clamp(
    (recentWar * 9000 + (ovr - 72) * 1200 + s.player.fame * 185 + counting + titles * 4200)
      * ageP * milFactor * intlFactor,
    4000, ceiling,
  );
}

function buildOffer(s: GameState, t: Team, base: number, ageP: number, rng: RNG, homeTeam: boolean): Offer {
  const fit = homeTeam ? 1.02 : 0.8 + (t.money / 100) * 0.5 + rng.float(-0.12, 0.18);
  const years = homeTeam
    ? clamp(Math.round(ageP * 4), 1, 5)
    : clamp(Math.round(ageP * 4 + rng.float(-1, 1.4)), 1, 6);

  const total = clamp(Math.round((base * years * fit) / 500) * 500, MIN_SALARY, MAX_SALARY * 6);
  /**
   * 옵션 비중 — 구단이 위험을 얼마나 나눠 지려 하는가.
   *
   * 원소속팀은 그 선수를 가장 잘 안다. 몸 상태도, 성실함도 겪어봤으니
   * 굳이 옵션으로 걸지 않고 보장으로 안긴다 — 실제 잔류 계약이 그렇다.
   * 반대로 타팀은 검증이 덜 돼 있어 옵션을 크게 건다.
   * 자금이 넉넉한 구단일수록 보장을 늘리고, 쪼들리는 구단은 옵션으로 미룬다.
   */
  const durability = getAb(s.player.abilities, "durability" as never);
  const optionRate = homeTeam
    ? clamp(0.02 + (s.player.age - 34) * 0.012 + (50 - durability) * 0.002, 0, 0.12)
    : clamp(
      0.14 + (s.player.age - 30) * 0.022 + (55 - durability) * 0.003
      + (70 - t.money) * 0.0035 + rng.float(-0.02, 0.05),
      0.05, 0.42,
    );
  const incentive = Math.round((total * optionRate) / 500) * 500;
  const signingBonus = Math.round(((total - incentive) * 0.35) / 500) * 500;
  const salary = clamp(
    Math.round((total - incentive - signingBonus) / years / 100) * 100,
    MIN_SALARY, MAX_SALARY,
  );
  const guaranteed = signingBonus + salary * years;

  return {
    teamId: t.id,
    salary, years, signingBonus, incentive,
    guaranteed, total: guaranteed + incentive,
    role: homeTeam ? (s.contract?.role ?? defaultRole(s.player)) : defaultRole(s.player),
    note: homeTeam ? "원소속팀 잔류"
      : t.power >= 72 ? "우승 도전권" : t.youth >= 70 ? "팀의 중심으로 기용" : "주전 보장",
    incentiveNote: s.player.kind === "HITTER"
      ? "시즌 400타석 + WAR 2.0 달성 시 연 지급"
      : "시즌 120이닝(또는 40경기) + WAR 1.5 달성 시 연 지급",
  };
}

function makeFaOffers(s: GameState, rng: RNG): Offer[] {
  /**
   * FA 시장은 평시 몸값보다 훨씬 높게 형성된다 — 여러 구단이 동시에 붙기 때문이다.
   * 실제 2026 KBO FA의 **연평균 ÷ 직전 연봉** 배수:
   *   강백호 3.6 · 박찬호 4.4 · 이영하 7.2 · 박해민 2.7 · 김현수 3.3
   *   반면 30대 후반은 최형우 1.3 · 김재환 1.1 · 손아섭 0.2
   * 그래서 프리미엄을 얹되 나이가 많을수록 깎는다.
   */
  const age = s.player.age;
  const faPremium = age <= 29 ? 2.6 : age <= 32 ? 2.1 : age <= 34 ? 1.6 : age <= 36 ? 1.1 : 0.8;
  const prevSalary = s.contract?.salary ?? MIN_SALARY;
  // FA를 얻고도 작년보다 못 받는 제안은 (노장이 아닌 한) 현실적이지 않다
  const floor = age >= 35 ? prevSalary * 0.85 : prevSalary * 1.15;
  const base = Math.max(marketValue(s) * faPremium, floor);
  const ageP = clamp(1.25 - (s.player.age - 28) * 0.075, 0.35, 1.3);
  const candidates = rng.shuffle(TEAMS.filter((t) => t.id !== s.contract?.teamId)).slice(0, 4);
  const offers = candidates.map((t) => buildOffer(s, t, base, ageP, rng, false));
  if (s.contract) offers.unshift(buildOffer(s, teamById(s.contract.teamId), base, ageP, rng, true));
  return offers;
}

/** 이적 신청 대상 구단 목록 — 유저가 직접 골라 신청한다 */
/**
 * 국제대회 진행 — 대회마다 실제 개최 월이 다르다.
 * WBC 3월(PRE) · 올림픽 7월(MID) · 아시안게임 9월(LATE) · 프리미어12 11월(POST).
 * 지정한 시점에 열리는 대회가 아니면 아무 일도 하지 않는다.
 */
function runTournament(s: GameState, rng: RNG, slot: TournamentSlot) {
  if (!s.intlJoined || !s.pendingTournament) return;
  const t = TOURNAMENTS[s.pendingTournament];
  if (t.slot !== slot) return;

  const res = simTournament(s, t, rng);
  s.intlResults.push(res);
  s.player.fame = clamp(s.player.fame + (res.medal ? 12 : 5), 0, 100);
  if (res.exempted && s.military === "PENDING") {
    s.military = "EXEMPT";
    log(s, {
      icon: "🎖️", title: "병역 면제", tone: "epic",
      body: `${t.name} ${res.medal}메달로 병역 특례 대상이 되었습니다. 야구에만 집중할 수 있습니다.`,
    });
  }
  log(s, {
    icon: t.icon, title: `${t.name} ${res.medal ? `${res.medal}메달` : `${res.rank}위`}`,
    tone: res.medal ? "epic" : "neutral", body: `${t.month} 개최 · ${res.note}`,
  });
  s.intlJoined = false;
  s.pendingTournament = null;
}

/**
 * 포지션별 시장 가치 — 같은 성적이라도 수비 부담이 큰 자리일수록 대체가 어렵다.
 * 지명타자·1루수는 방망이만 보고 데려오므로 기준이 훨씬 높다.
 */
const POS_MARKET: Record<string, number> = {
  C: 8, SS: 6, "2B": 3, CF: 3, "3B": 2, LF: -3, RF: -3, "1B": -6, DH: -9,
  SP: 4, CP: 1, RP: -2,
};

/**
 * 시즌 개막 준비 — 보직 확정 · 부상 판정 · 구단 목표.
 * 스프링캠프를 마쳤을 때와, 전역해 후반기에 합류할 때 모두 이 경로를 탄다.
 *
 * `availCap`을 주면 그 비율만큼만 뛸 수 있다 (후반기 합류는 0.45).
 */
function openSeason(s: GameState, rng: RNG, campInjury = 0, availCap = 1) {
  const team = s.contract ? teamById(s.contract.teamId) : null;
  if (s.contract?.role === "육성선수") {
    s.seasonLevel = "MINOR";
    s.seasonRole = defaultRole(s.player);
  } else if (team) {
    // 프로에서 보낸 해 (1군·2군 모두 포함)
    const proYears = s.seasons.filter((r) => r.level === "KBO" || r.level === "MINOR").length;
    const { level, role } = assignRole(s.player, team, s.serviceYears, s.trust, rng, proYears);
    s.seasonLevel = level;
    s.seasonRole = role;
    s.contract!.role = role;
  }
  const inj = rollInjury(s.player, rng);
  const carried = s.nextSeasonAvailability;
  s.seasonAvailability = clamp(
    inj.availability * (1 - campInjury) * carried * availCap, 0.05, 1,
  );
  s.nextSeasonAvailability = 1;
  s.seasonNote = inj.note;

  // 크게 다치면 1군 엔트리를 비워야 한다 — 실제로도 재활은 2군에서 한다
  if (s.seasonLevel === "KBO" && s.seasonAvailability < 0.6 * availCap) {
    s.seasonLevel = "MINOR";
    s.seasonRole = minorRoleOf(s.player);
    if (s.contract) s.contract.role = s.seasonRole;
    // 가동률이 떨어지는 원인은 셋이다 — 시즌 부상뿐 아니라
    // 스프링캠프에서 다쳤거나, 지난 시즌 부상의 재활이 넘어왔을 수도 있다.
    // 시즌 부상만 전제하면 문구에 빈칸(null)이 박힌다. (실제로 겪음)
    const reason = inj.note
      ?? (campInjury > 0 ? "스프링캠프에서 다친 몸이 아직 올라오지 않았습니다."
        : carried < 1 ? "지난 시즌 부상의 재활이 해를 넘겼습니다."
          : "몸 상태가 1군에서 뛸 수준에 미치지 못합니다.");
    notify(s, {
      icon: "🏥", eyebrow: "Injury", title: "부상자 명단 등재", tone: "bad",
      body: `${reason} 1군 엔트리에서 말소되고 2군에서 재활에 들어갑니다.`
        + " 몸이 올라오면 다시 콜업될 수 있습니다.",
      change: [{ label: "소속", from: "1군", to: "2군 재활" }],
    });
  }
  s.kboShare = 0;
  s.seasonByLevel = undefined;
  // 1군에서 시즌을 시작하면 콜업 인상 대상이 아니다 (강등 후 복귀는 인상 없음)
  s.calledUpThisSeason = s.seasonLevel === "KBO";
  s.seasonGoal = makeSeasonGoal(s, rng);
  if (s.seasonGoal) {
    log(s, {
      icon: "🎯", title: "구단이 제시한 목표", tone: "neutral",
      body: `${s.seasonGoal.label} — ${s.seasonGoal.desc}`,
    });
  }
}

export function makeTransferTargets(s: GameState, rng: RNG): TransferTarget[] {
  if (!s.contract) return [];
  const value = marketValue(s);
  const ovr = overall(s.player);
  const age = s.player.age;
  // 전력 순으로 매긴 예상 순위 — 어느 팀에 가야 가을야구를 하는지 보여준다
  const ranked = [...TEAMS].sort((a, b) => b.power - a.power);
  const rankOf = (id: string) => ranked.findIndex((t) => t.id === id) + 1;
  const recent = s.seasons.filter((x) => x.level === "KBO").slice(-2);
  const recentWar = recent.reduce((a, b) => a + b.line.war, 0) / Math.max(1, recent.length);

  return TEAMS.filter((t) => t.id !== s.contract!.teamId).map((t) => {
    // 기준선은 1군 주전(OVR 76) — 그 아래로는 시장이 빠르게 식는다
    const merit = (ovr - 76) * 3.4 + recentWar * 7.5;
    // 팀 성향: 육성 지향 구단은 기회를 주고, 자금력 있는 구단은 지갑을 연다
    const need = (t.youth - 55) * 0.28 + (t.money - 65) * 0.18;
    // 강팀은 확실한 전력감만 원한다 — 기량이 낮으면 오히려 관심이 식는다
    const contendFit = (ovr - 78) * (t.power - 68) * 0.045;
    // 서른을 넘기면 남은 전성기가 짧다 — 시장은 그 값을 깎는다
    const ageAdj = age <= 25 ? 5 : age <= 28 ? 1 : age === 29 ? -3 : -(age - 28) * 6;
    // 수비 가치가 없는 자리일수록 방망이 하나로만 평가받는다
    const posAdj = POS_MARKET[s.player.position] ?? 0;
    // 지금 연봉이 그 구단 지갑에 얼마나 부담인가
    const payload = -clamp((s.contract!.salary / 10000 - t.money * 0.12) * 1.6, 0, 30);
    const interest = clamp(
      Math.round(
        38 + merit + need + contendFit + ageAdj + posAdj + payload
        + s.player.fame * 0.08 + rng.float(-6, 6),
      ),
      3, 99,
    );
    // 원소속팀이 놓아주는가 — 신뢰가 낮을수록, 대체 가능한 선수일수록 쉽게 보낸다
    // 선수가 직접 이적을 요구한 상황이라 구단도 마냥 붙잡지는 못한다.
    // 다만 신뢰가 두텁고 간판으로 대우받는 선수일수록 놓아주기 싫어한다.
    const release = clamp(
      0.62 + (55 - s.trust) * 0.005 - Math.max(0, ovr - 80) * 0.013
      - (isFranchiseRole(s.contract!.role) ? 0.12 : roleTier(s.contract!.role) >= 5 ? 0.06 : 0),
      0.22, 0.9,
    );
    // 몸값을 감당할 수 있는 구단인가
    const afford = value > t.money * 2200 ? 0.68 : value > t.money * 1400 ? 0.86 : 1;
    // 관심이 확실할 때만 실제로 성사된다
    const odds = clamp(Math.pow(interest / 100, 2.1) * 1.35 * release * afford, 0.01, 0.85);
    const proYears = s.seasons.filter((r) => r.level === "KBO" || r.level === "MINOR").length;
    const { role } = assignRole(s.player, t, s.serviceYears, 55, new RNG(s.seed + t.id.charCodeAt(0)), proYears);

    const projRank = rankOf(t.id);
    return {
      teamId: t.id, interest, odds, role,
      power: t.power, projRank,
      outlook: projRank <= 3 ? "우승 도전권"
        : projRank <= 6 ? "가을야구 경쟁"
          : t.youth >= 70 ? "리빌딩 — 기회는 많다" : "중하위권",
      note: interest >= 85 ? "최우선 영입 대상으로 꼽고 있다"
        : interest >= 68 ? "적극적으로 관심을 보인다"
        : interest >= 48 ? "영입을 검토할 만하다"
        : interest >= 30 ? "지켜보는 정도다"
        : "당장은 자리가 없다",
    };
  }).sort((a, b) => b.interest - a.interest);
}

/* ------------------------------------------------------------------ */
/* 은퇴                                                                 */
/* ------------------------------------------------------------------ */

function shouldForceRetire(s: GameState): string | null {
  const p = s.player;
  const ovr = overall(p);
  if (p.age >= 43) return "마흔을 넘긴 몸이 더 이상 버텨주지 않았습니다.";

  const recent = s.seasons.slice(-2);
  const minorOnly = recent.length === 2 && recent.every((r) => r.level === "MINOR");
  if (p.age >= 29 && minorOnly) return "두 시즌 연속 1군의 부름을 받지 못하고 방출 통보를 받았습니다.";

  const releaseBar = p.age >= 38 ? 76 : p.age >= 36 ? 71 : p.age >= 34 ? 66 : p.age >= 32 ? 61 : 0;
  if (releaseBar && ovr < releaseBar) {
    return p.age >= 36 ? "재계약 대상에서 제외되었습니다." : "기량 저하가 뚜렷해져 구단에서 방출되었습니다.";
  }

  const lastTwo = s.seasons.slice(-2).filter((r) => r.level === "KBO");
  const benched = lastTwo.length === 2 && lastTwo.every((r) => roleTier(r.role) <= 2);
  if (p.age >= 35 && benched) return "주전 경쟁에서 밀려나며 은퇴를 권유받았습니다.";
  return null;
}

/**
 * 은퇴 권고 — 방출까지는 아니지만 구단이 물러날 때를 권한다.
 * 거부하고 더 뛸 수 있지만, 자리는 이미 좁아져 있다.
 */
function retirementAdvice(s: GameState): string | null {
  const p = s.player;
  if (p.age < 34) return null;
  const ovr = overall(p);
  const kbo = s.seasons.filter((r) => r.level === "KBO");
  const last = kbo[kbo.length - 1];
  if (!last) return null;

  // 전성기 대비 얼마나 내려왔는가
  const peak = Math.max(...kbo.map((r) => r.line.war), 1);
  const fallen = last.line.war < peak * 0.4;
  const bench = roleTier(last.role) <= 3;

  if (p.age >= 39) return `${p.age}세. 구단이 조심스럽게 은퇴 시기를 묻습니다.`;
  if (p.age >= 37 && (bench || fallen)) return "출장 기회가 눈에 띄게 줄었습니다. 구단이 은퇴를 권합니다.";
  if (p.age >= 35 && bench && fallen) return "성적과 입지가 함께 내려앉았습니다. 구단이 물러날 때를 이야기합니다.";
  if (p.age >= 36 && ovr < 72) return "기량 저하가 뚜렷합니다. 구단이 은퇴를 권유합니다.";
  return null;
}

/** 은퇴 시 영구결번·프랜차이즈 예우 판정 */
export function retirementHonors(s: GameState) {
  const kbo = s.seasons.filter((x) => x.level === "KBO");
  if (!kbo.length) return null;
  // 가장 오래 몸담은 팀
  const byTeam = new Map<string, number>();
  for (const r of kbo) byTeam.set(r.teamId, (byTeam.get(r.teamId) ?? 0) + 1);
  const [teamId, years] = [...byTeam.entries()].sort((a, b) => b[1] - a[1])[0];
  const hof = computeHof(s);
  const share = years / kbo.length;

  // 영구결번은 한 팀의 상징이 된 선수에게만
  if (hof.score >= 380 && years >= 10 && share >= 0.62) {
    return { teamId, years, kind: "영구결번" as const };
  }
  if (hof.score >= 260 && years >= 7 && share >= 0.45) {
    return { teamId, years, kind: "은퇴식" as const };
  }
  return null;
}

export function computeHof(s: GameState) {
  const kbo = s.seasons.filter((x) => x.level === "KBO");
  const war = kbo.reduce((a, b) => a + b.line.war, 0);
  const awards = kbo.reduce((a, b) => a + b.awards.length, 0);
  const mvp = kbo.reduce((a, b) => a + b.awards.filter((x) => x.includes("MVP")).length, 0);
  const rings = kbo.filter((x) => x.champion).length;
  let counting = 0;
  for (const r of kbo) {
    const l = r.line as PitcherLine & HitterLine;
    if (l.pa !== undefined) counting += l.hr * 0.13 + l.h * 0.015 + l.rbi * 0.012 + l.sb * 0.03;
    else counting += l.sv * 0.28 + l.hld * 0.18 + l.w * 0.12;
  }
  const medals = (s.intlResults ?? []).filter((r) => r.medal).length;
  const feats = kbo.reduce((a, r) => a + (r.feats?.length ?? 0) + (r.milestones?.length ?? 0), 0);
  const score = Math.round(
    war * 6 + awards * 8 + mvp * 25 + rings * 12 + kbo.length * 2 + counting
      + medals * 6 + feats * 5,
  );
  const tier =
    score >= 420 ? "레전드 (전설)" : score >= 300 ? "명예의 전당" : score >= 200 ? "프랜차이즈 스타"
    : score >= 120 ? "리그 주전급" : score >= 55 ? "1군 백업" : "짧은 도전";
  return { score, tier, war: Math.round(war * 10) / 10, awards, mvp, rings, seasons: kbo.length, medals, feats };
}

/* ------------------------------------------------------------------ */
/* 시즌 진행 보조                                                       */
/* ------------------------------------------------------------------ */

/** 시즌의 [from, to] 구간을 치른다 — 누적 비율로 넘겨 총 경기 수가 정확히 맞는다 */
function simPart(s: GameState, rng: RNG, from: number, to: number): StatLine {
  const p = s.player;
  const team = s.contract ? teamById(s.contract.teamId) : null;
  const level = s.seasonLevel ?? "MINOR";
  const role = s.seasonRole ?? defaultRole(p);
  const inp = {
    player: p, level, role,
    teamPower: team?.power ?? 62,
    park: team?.park,
    availability: s.seasonAvailability, rng,
    share: to - from,
    cume: [from, to] as const,
  };
  return p.kind === "HITTER" ? simHitter(inp) : simPitcher(inp);
}

/** 그 달의 활약도 (-1.2 부진 ~ +1.2 맹활약) */
function monthlyForm(line: StatLine, level: LevelTag): number {
  if (isHitterLine(line)) {
    if (line.pa < 25) return 0;
    // 2군 기록은 부풀려 나오므로 기준을 높게 잡는다
    const base = level === "KBO" ? 0.78 : 0.88;
    return clamp((line.ops - base) * 3.0, -1.2, 1.2);
  }
  const p = line as PitcherLine;
  if (p.ip < 6) return 0;
  const base = level === "KBO" ? 4.3 : 3.6;
  return clamp((base - p.era) * 0.5, -1.2, 1.2);
}

/**
 * 월말 엔트리 조정 — 2군에서 잘하면 콜업, 1군에서 부진하면 말소.
 * 기량(제자리 판정)과 그 달 성적을 함께 본다.
 */
/**
 * 월말 엔트리 점검.
 *
 * 1군↔2군만이 아니라 **1군 안에서 주전↔준주전↔백업**도 움직인다.
 * 잘하면 자리가 올라가고 못하면 밀린다 — 시즌 내내 보직이 고정이면
 * 한 달 한 달 잘하는 의미가 없다.
 */
function reviewRoster(
  s: GameState, rng: RNG, form: number,
): { type: "UP" | "DOWN" | "ROLE"; role: string } | null {
  if (!s.contract || s.seasonLevel === "ARMY") return null;
  const team = teamById(s.contract.teamId);
  const proYears = s.seasons.filter((r) => r.level === "KBO" || r.level === "MINOR").length;
  const proper = assignRole(s.player, team, s.serviceYears, s.trust, rng, proYears);

  if (s.seasonLevel === "MINOR") {
    const chance = clamp(0.06 + form * 0.42 + (proper.level === "KBO" ? 0.34 : 0), 0, 0.85);
    if (!rng.chance(chance)) return null;
    return {
      type: "UP",
      role: proper.level === "KBO" ? proper.role : s.player.kind === "HITTER" ? "백업" : "추격조",
    };
  }

  /**
   * 2군 강등.
   *
   * 기량이 1군 수준이면 한 달 부진으로 내려가지 않는다 —
   * 에이스가 6월에 얻어맞았다고 2군에 보내지는 않는다. 자리를 옮길 뿐이다.
   * 강등은 **기량 자체가 1군 기준에 못 미칠 때** 일어나고, 부진은 그걸 앞당긴다.
   */
  const tier = roleTier(s.seasonRole ?? defaultRole(s.player));
  const belowBar = proper.level === "MINOR";
  const demote = belowBar
    ? clamp(0.20 - form * 0.26, 0.04, 0.6)
    // 주전·선발급은 자리 조정으로 끝난다 (아래 ROLE 분기가 받는다)
    : tier >= 4 ? 0
      : clamp(0.03 - form * 0.06, 0, 0.08);
  if (rng.chance(demote)) return { type: "DOWN", role: minorRoleOf(s.player) };

  // 1군에 남는다면 자리는 그 달 활약에 따라 오르내린다
  const now = s.seasonRole ?? defaultRole(s.player);
  if (proper.level !== "KBO" || proper.role === now) return null;
  const up = roleTier(proper.role) > roleTier(now);
  // 올라갈 땐 잘해야 하고, 밀릴 땐 못해야 한다
  const chance = clamp((up ? 0.10 + form * 0.30 : 0.08 - form * 0.26), 0, 0.5);
  return rng.chance(chance) ? { type: "ROLE", role: proper.role } : null;
}

/** 한 반기를 월 단위로 치른다 — 매달 끝에 엔트리가 바뀔 수 있다 */
function playHalf(
  s: GameState, rng: RNG,
  months: readonly { key: string; label: string; share: number }[],
  /** 시즌 마지막 반기인가 — 마지막 달에는 엔트리를 건드리지 않는다 */
  isFinalHalf = false,
): MonthLine[] {
  const out: MonthLine[] = [];
  // 시즌 시작부터의 누적 비율 — 후반기는 전반기(0.6)에서 이어진다
  let cume = isFinalHalf ? HALF_SHARE.H1 : 0;
  for (let mi = 0; mi < months.length; mi++) {
    const m = months[mi];
    const lastMonth = isFinalHalf && mi === months.length - 1;
    const level = s.seasonLevel ?? "MINOR";
    const role = s.seasonRole ?? defaultRole(s.player);
    const from = cume;
    // 마지막 달은 반올림 오차 없이 정확히 1.0(또는 0.6)으로 닫는다
    cume = lastMonth || mi === months.length - 1
      ? (isFinalHalf ? 1 : HALF_SHARE.H1)
      : cume + m.share;
    const line = simPart(s, rng, from, cume);
    if (level === "KBO") s.kboShare += m.share;

    /**
     * 이달의 선수(월간 MVP).
     * 실제 KBO는 한 달에 리그 전체에서 한 명이라, 압도적인 달이어도 늘 받지는 않는다.
     */
    const form = judgeMonthForm(line, level);
    const potm = rng.chance(potmOdds(line, form, level, s.potmMonths?.length ?? 0));
    if (potm) s.potmMonths = [...(s.potmMonths ?? []), m.label];

    const entry: MonthLine = { key: m.key, label: m.label, line, level, role, potm };
    // 1군·2군을 오간 시즌은 나중에 따로 보여줘야 하므로 그때그때 갈라 담는다
    if (level === "KBO" || level === "MINOR") {
      const bucket = s.seasonByLevel ?? { KBO: null, MINOR: null };
      bucket[level] = bucket[level] ? mergeLines([bucket[level], line]) : line;
      s.seasonByLevel = bucket;
    }
    const move = lastMonth ? null : reviewRoster(s, rng, monthlyForm(line, level));
    if (move) {
      const fromLabel = `${level === "KBO" ? "1군" : "2군"} ${role}`;
      if (move.type !== "ROLE") s.seasonLevel = move.type === "UP" ? "KBO" : "MINOR";
      s.seasonRole = move.role;
      if (s.contract) s.contract.role = move.role;
      const toLabel = `${s.seasonLevel === "KBO" ? "1군" : "2군"} ${move.role}`;

      // 1군에 처음 등록되면 그 해 연봉이 조정된다 (시즌당 1회)
      let salary: number | undefined;
      if (move.type === "UP" && !s.calledUpThisSeason && s.contract) {
        s.calledUpThisSeason = true;
        const next = clamp(Math.round((s.contract.salary * 1.3) / 100) * 100, MIN_SALARY, MAX_SALARY);
        if (next > s.contract.salary) { salary = next; s.contract.salary = next; }
      }
      entry.move = { type: move.type, role: move.role, salary };

      const promoted = move.type === "UP" || (move.type === "ROLE" && roleTier(move.role) > roleTier(role));
      const title = move.type === "UP" ? "1군 콜업"
        : move.type === "DOWN" ? "2군 이동 통보"
          : promoted ? "보직 상승" : "보직 하락";
      const body = move.type === "UP"
        ? `${m.label}을 마치고 1군 엔트리에 등록되었습니다. ${move.role}(으)로 출발합니다.`
          + (salary ? ` 1군 등록으로 연봉이 ${formatMoney(salary)}(으)로 조정되었습니다.` : "")
        : move.type === "DOWN"
          ? `${m.label}까지의 부진으로 1군 엔트리에서 말소되었습니다.`
          : promoted
            ? `${m.label} 활약을 인정받아 ${move.role}(으)로 올라섰습니다.`
            : `${m.label} 부진으로 ${move.role}(으)로 밀렸습니다.`;

      log(s, {
        icon: move.type === "UP" ? "⬆️" : move.type === "DOWN" ? "⬇️" : promoted ? "📈" : "📉",
        title, tone: promoted ? "good" : "bad", body,
      });
      // 엔트리 이동은 중계 안에서 그 달 자리에 멈춰 확인을 받는다 (통보 큐에 또 넣지 않는다)
    }
    out.push(entry);
  }
  return out;
}

/** 아마추어 시즌은 한 번에 치른다 */
function runAmateurSeason(s: GameState, rng: RNG, level: LevelTag) {
  const p = s.player;
  const inj = rollInjury(p, rng);
  const role = defaultRole(p);

  // 아마추어 야구는 전국대회가 전부다
  const am = simAmateurSeason(p, rng, inj.availability, level, schoolOf(s.schoolName ?? "", level));
  const line: StatLine = am.line;
  const awards = am.awards;
  const tournaments: AmateurTournament[] = am.tournaments;
  p.fame = clamp(p.fame + am.fameGain, 0, 100);
  const best = am.tournaments.reduce((a, b) =>
    placementScore(b.placement) > placementScore(a.placement) ? b : a);
  log(s, {
    icon: am.totalScore >= 9 ? "🏆" : am.totalScore >= 5 ? "⚾" : "🌧️",
    title: `${level === "COLLEGE" ? "대학" : "고교"} 전국대회 결과`,
    tone: am.totalScore >= 9 ? "epic" : am.totalScore >= 5 ? "good" : "neutral",
    body: am.tournaments.map((t) => `${t.name} ${t.placement}`).join(" · ")
      + (am.awards.length ? ` — ${am.awards.join(", ")}` : "")
      + (best.placement === "우승" ? " 전국 제패!" : ""),
  });

  s.seasons.push({
    year: s.year, age: p.age, level, teamId: "-",
    teamName: level === "HS" ? "고교 야구부" : "대학 야구부",
    position: p.position, role, salary: 0, line, awards,
    note: inj.note ?? undefined,
    tournaments,
  });
  s.lastSeasonIndex = s.seasons.length - 1;
  if (inj.note) log(s, { icon: "🏥", title: "부상", tone: "bad", body: inj.note });
  p.condition = clamp(p.condition + rng.int(-8, 14), 25, 100);
}

/** 시즌 종료 — 기록 확정, 수상, 이벤트 */
function closeSeason(s: GameState, rng: RNG) {
  const p = s.player;
  const team = s.contract ? teamById(s.contract.teamId) : null;
  // 한 해 동안 1군에서 보낸 비중으로 그 시즌의 소속을 정한다
  const level: LevelTag = s.seasonLevel === "ARMY" ? "ARMY"
    : s.kboShare >= 0.35 ? "KBO" : "MINOR";
  const regular = s.seasonLine ?? mergeLines([s.halfLine]);
  const isRookie = level === "KBO" && s.serviceYears === 0;
  const awards = judgeAwards(p, regular, level, isRookie, rng);
  if (s.allStar) awards.unshift("올스타");

  const rec: SeasonRecord = {
    year: s.year, age: p.age, level,
    teamId: team?.id ?? "-", teamName: team?.name ?? "-",
    position: p.position, role: s.seasonRole ?? defaultRole(p),
    salary: s.contract?.salary ?? 0,
    line: regular,
    awards: [...new Set(awards)],
    teamRank: s.teamRank ?? undefined,
    champion: s.postseason?.champion ?? false,
    byLevel: s.seasonByLevel && s.seasonByLevel.KBO && s.seasonByLevel.MINOR
      ? { KBO: s.seasonByLevel.KBO, MINOR: s.seasonByLevel.MINOR }
      : undefined,
    note: [
      s.seasonNote ?? "",
      s.kboShare > 0 && s.kboShare < 1
        ? `시즌의 ${Math.round(s.kboShare * 100)}%를 1군에서 보냈습니다.`
        : "",
    ].filter(Boolean).join(" ") || undefined,
    half: s.halfLine ?? undefined,
    ps: s.postseason ?? undefined,
    allStar: s.allStar,
    allStarGame: s.allStarGame ?? undefined,
    potm: s.potmMonths?.length ? s.potmMonths : undefined,
  };
  // 그해의 대기록
  rec.feats = rollFeats(regular, level, rng);
  // 구단 목표
  if (s.seasonGoal) {
    const { met, reason } = judgeSeasonGoal(s.seasonGoal, regular, s.kboShare);
    rec.goal = { label: s.seasonGoal.label, met, reason };
    s.trust = clamp(s.trust + (met ? s.seasonGoal.reward : s.seasonGoal.penalty), 0, 100);
    log(s, {
      icon: met ? "🎯" : "🚧",
      title: met ? "구단 목표 달성" : "구단 목표 미달",
      tone: met ? "good" : "bad",
      body: met
        ? `${s.seasonGoal.label}을(를) 채웠습니다. 구단의 신뢰가 올랐습니다.`
        : reason,
    });
    s.seasonGoal = null;
  }

  s.seasons.push(rec);
  s.lastSeasonIndex = s.seasons.length - 1;

  // 통산 이정표 (기록을 넣은 뒤 계산한다)
  rec.milestones = newMilestones(s.seasons, p.kind);
  for (const m of rec.milestones) {
    log(s, { icon: "🗿", title: "대기록", tone: "epic", body: m });
    p.fame = clamp(p.fame + 6, 0, 100);
  }
  for (const f of rec.feats) {
    log(s, { icon: "✨", title: f, tone: "epic", body: `${p.name} 선수가 ${f}을(를) 달성했습니다!` });
    p.fame = clamp(p.fame + 8, 0, 100);
  }

  // 1군 등록 기간만 서비스타임으로 쌓인다.
  // 실제 KBO는 **등록일수**로 센다 — 부상자 명단에 올라 있어도 일수는 인정된다.
  // 여기에 가동률을 또 곱하면 이중 차감이 된다(크게 다치면 2군으로 내려가
  // 이미 kboShare가 줄어든다). 그래서 1군 시즌당 0.83년만 쌓여
  // 프로 13년차가 FA를 못 가는 일이 있었다.
  s.serviceYears += clamp(s.kboShare, 0, 1);

  if (rec.awards.length) {
    log(s, { icon: "🏆", title: "수상", tone: "epic", body: `${rec.awards.join(", ")} 수상!` });
    p.fame = clamp(p.fame + rec.awards.length * 6, 0, 100);
    s.trust = clamp(s.trust + rec.awards.length * 3, 0, 100);
  }
  if (rec.champion) {
    log(s, { icon: "🎊", title: "한국시리즈 우승", tone: "epic", body: `${team?.name ?? ""}가 정상에 올랐습니다!` });
    s.teammate = clamp(s.teammate + 8, 0, 100);
  }
  // FA 계약 옵션 달성 판정
  const inc = s.contract?.incentivePerYear ?? 0;
  if (inc > 0 && level === "KBO") {
    const hit = isHitterLine(regular);
    const met = hit
      ? regular.pa >= 400 && regular.war >= 2.0
      : ((regular as PitcherLine).ip >= 120 || regular.g >= 40) && regular.war >= 1.5;
    log(s, {
      icon: met ? "💵" : "📄",
      title: met ? "계약 옵션 달성" : "계약 옵션 미달",
      tone: met ? "good" : "neutral",
      body: met
        ? `조건을 채워 옵션 ${formatMoney(inc)}을 수령했습니다.`
        : `옵션 조건(${hit ? "400타석 + WAR 2.0" : "120이닝 + WAR 1.5"})을 채우지 못했습니다.`,
    });
  }

  // 활약에 따라 구단 신뢰가 움직인다
  s.trust = clamp(s.trust + clamp(regular.war * 2.2 - 1.5, -10, 10), 0, 100);
  p.condition = clamp(p.condition + rng.int(-10, 12) + (s.seasonNote ? -8 : 4), 25, 100);
  rollEvent(s, rng);
  return rec;
}

/** 시즌 종료 후 다음 단계 결정 */
function routeAfterSeason(s: GameState, rng: RNG) {
  // 지난 선택의 결과가 돌아온다
  const due = s.chains.filter((c) => c.dueYear <= s.year);
  for (const c of due) {
    chainByKey(c.key)?.resolve(s, c.choice, rng, (e) => log(s, e));
  }
  s.chains = s.chains.filter((c) => c.dueYear > s.year);

  const forced = shouldForceRetire(s);
  if (forced) {
    s.retireReason = forced;
    s.retireForced = true;
    s.phase = "RETIRE_CHOICE";
    log(s, { icon: "🚪", title: "커리어의 끝", tone: "bad", body: forced });
    return;
  }

  // 강제는 아니지만 구단이 은퇴를 권하는 시점 — 거부하고 더 뛸 수 있다
  const advised = retirementAdvice(s);
  if (advised) {
    s.retireReason = advised;
    s.retireForced = false;
    s.phase = "RETIRE_CHOICE";
    log(s, { icon: "🕯️", title: "은퇴 권고", tone: "bad", body: advised });
    return;
  }

  // 새 갈림길이 있으면 먼저 고르게 한다
  const next = pickChain(s, rng);
  if (next) {
    s.pendingEvent = next.prompt(s);
    s.phase = "EVENT";
    return;
  }
  // 국제대회와 병역은 이듬해 시즌 시작 전에 처리한다
  routeToOffseason(s, rng);
}

function routeToOffseason(s: GameState, rng: RNG) {
  // 3) FA 또는 연봉 협상
  const faEligible = s.serviceYears >= FA_SERVICE + s.faUsed * 4 && (s.contract?.remaining ?? 0) <= 0;
  if (faEligible) {
    s.pendingOffers = makeFaOffers(s, rng);
    s.phase = "FA";
    log(s, { icon: "💰", title: "FA 자격 취득", tone: "epic", body: "자유계약선수 자격을 얻었습니다." });
    return;
  }
  const rec = s.seasons[s.lastSeasonIndex ?? s.seasons.length - 1];
  const multiYear = (s.contract?.years ?? 1) > 1 && (s.contract?.remaining ?? 0) > 0;
  if (s.contract && !multiYear) {
    s.pendingNegotiation = buildNegotiation(s, rec);
    s.phase = "NEGOTIATION";
    return;
  }
  s.phase = "STOVE";
  s.pendingTransfers = makeTransferTargets(s, rng);
}

/** 다음 시즌 준비 — 해를 넘긴다 */
function startNextYear(s: GameState, rng: RNG) {
  s.player.age += 1;
  s.year += 1;
  if (s.contract && s.contract.remaining > 0) s.contract.remaining -= 1;
  s.pendingTransfers = null;
  s.transferRequested = false;
  s.monthLines = null;
  s.potmMonths = null;
  s.halfLine = null;
  s.seasonLine = null;
  s.postseason = null;
  s.teamRank = null;
  s.allStar = false;
  s.allStarGame = null;
  s.seasonNote = null;
  s.kboShare = 0;
  s.calledUpThisSeason = false;
  s.seasonByLevel = undefined;
  s.pendingTrade = null;
  s.sangmuApplied = false;

  // 입영은 시즌이 시작되기 전에 결정된다
  if (s.military === "PENDING" && s.player.age >= MILITARY_DEADLINE) {
    log(s, {
      icon: "🪖", title: "입영 통지", tone: "bad",
      body: `${MILITARY_DEADLINE}세가 되어 더 이상 병역을 미룰 수 없습니다. 복무 형태를 선택하세요.`,
    });
    s.phase = "MILITARY_CHOICE";
    return;
  }
  s.pendingTraining = makeTrainingOptions(s.player, rng);
  s.phase = "SPRING_CAMP";
}

/* ------------------------------------------------------------------ */
/* 메인 리듀서                                                          */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: "SIM_AMATEUR" }
  | { type: "CHOOSE_PATH"; path: "DRAFT" | "COLLEGE" }
  | { type: "DO_DRAFT" }
  | { type: "TRAIN"; optionId: string; hell?: boolean }
  | { type: "PLAY_FIRST_HALF" }
  | { type: "PLAY_SECOND_HALF" }
  | { type: "PLAY_POSTSEASON" }
  | { type: "FINISH_SEASON" }
  | { type: "JOIN_NATIONAL"; join: boolean }
  | { type: "ENLIST"; option: "SANGMU" | "ACTIVE" }
  | { type: "SERVE" }
  | { type: "NEGOTIATE"; optionId: string }
  | { type: "REQUEST_TRANSFER"; teamId: string }
  | { type: "APPLY_SANGMU" }
  | { type: "SKIP_STOVE" }
  | { type: "ACCEPT_OFFER"; teamId: string }
  | { type: "DEFER_FA" }
  | { type: "CHOOSE_EVENT"; optionId: string }
  | { type: "TRADE_DECIDE"; accept: boolean }
  | { type: "KEEP_PLAYING" }
  | { type: "RETIRE" }
  | { type: "CHOOSE_SECOND_LIFE"; pathId: SecondLifeId }
  | { type: "HOF_BALLOT" };

export function advance(prev: GameState, action: Action): GameState {
  const s = clone(prev);
  const rng = new RNG(s.seed);
  const bump = () => { s.seed = rng.int(1, 2 ** 30); };

  switch (action.type) {
    /* ---- 아마추어 ---- */
    case "SIM_AMATEUR": {
      const level: LevelTag = s.phase === "HS_SEASON" ? "HS" : "COLLEGE";
      runAmateurSeason(s, rng, level);
      if (level === "HS") s.phase = "PATH_CHOICE";
      else {
        // 대학은 2년 단위 — 2학년·4학년에 드래프트 기회
        const done = s.seasons.filter((x) => x.level === "COLLEGE").length;
        const span = done >= 2 ? 1 : 2; // 4학년을 마치면 졸업까지 한 해
        s.player.age += span;
        s.year += span;
        // 마지막 한 해분은 아래 훈련으로 대신한다 — 안 그러면 성장이 이중으로 들어가
        // 대학 경로가 프로(매년 캠프 1회)보다 일방적으로 유리해진다
        const collegeRate = developmentRate("COLLEGE", "주전", s.player.age) * amateurDevBonus(s);
        for (let i = 0; i < span - 1; i++) grow(s.player, rng, null, collegeRate);
        // 대학에도 비시즌 훈련이 있다. 이게 없으면 매년 캠프를 도는 고졸 프로에 비해
        // 대학 경로가 일방적으로 불리해진다.
        s.pendingTraining = makeTrainingOptions(s.player, rng);
        s.phase = "SPRING_CAMP";
      }
      bump();
      return s;
    }

    case "CHOOSE_PATH": {
      // 이미 미지명된 상태에서 프로행을 고르면 육성선수 입단이다
      if (action.path === "DRAFT" && s.draftMissed) {
        const team = rng.pick(TEAMS.filter((t) => t.youth >= 55));
        s.draftPick = { round: 0, overall: 0, teamId: team.id };
        s.contract = { teamId: team.id, salary: MIN_SALARY, years: 1, remaining: 1, role: "육성선수" };
        log(s, {
          icon: "🪶", title: "육성선수 입단", tone: "neutral",
          body: `${team.name}에 육성선수(신고선수)로 입단합니다. 등록조차 되지 않은 바닥에서 시작합니다.`,
        });
        s.pendingTraining = makeTrainingOptions(s.player, rng);
        s.phase = "SPRING_CAMP";
        bump();
        return s;
      }
      if (action.path === "DRAFT") {
        // 지명은 마지막 시즌을 마친 그 상태로 받는다.
        // 여기서 나이를 올리고 성장시키면 진로 화면의 지명 확률과 드래프트 화면의 확률이
        // 어긋나 보인다 (유저가 고르기만 했는데 확률이 오른다).
        s.phase = "DRAFT";
        log(s, { icon: "📋", title: "신인 드래프트 신청", tone: "neutral", body: "프로 지명을 기다립니다." });
      } else {
        // 대학 진학도 지명과 마찬가지로 나이를 여기서 올리지 않는다.
        // 입단 시점(DO_DRAFT)에 한 번만 올려야 고졸·대졸 입단 나이가 어긋나지 않는다.
        s.draftMissed = false;
        s.phase = "COLLEGE_SEASON";
        grow(s.player, rng, null, developmentRate("HS", "주전", s.player.age) * amateurDevBonus(s));
        log(s, { icon: "🎓", title: "대학 진학", tone: "neutral", body: "두 시즌을 더 뛰며 기량을 높인 뒤 드래프트에 도전합니다." });
      }
      bump();
      return s;
    }

    case "DO_DRAFT": {
      runDraft(s, rng);
      if (s.phase !== "PATH_CHOICE") {
        // 지명을 받은 뒤 한 해를 넘겨 프로 첫 캠프에 합류한다 (가을 지명 → 이듬해 봄 입단)
        s.player.age += 1;
        s.year += 1;
        grow(s.player, rng, null, developmentRate("HS", "주전", s.player.age) * amateurDevBonus(s));
        s.pendingTraining = makeTrainingOptions(s.player, rng);
        s.phase = "SPRING_CAMP";
      }
      bump();
      return s;
    }

    /* ---- 스프링캠프 ---- */
    case "TRAIN": {
      const opt: TrainingOption | undefined = s.pendingTraining?.find((o) => o.id === action.optionId);
      const styleBefore = deriveStyle(s.player);
      let campInjury = 0;
      // 캠프 훈련 "전" 값을 기록한다 — 지난 시즌 종료 시점과 같다
      s.ovrAtSeasonStart = overall(s.player);
      // 지옥 훈련 — 커리어 두 번뿐인 도박. 되면 크게 늘고 안 되면 한 해를 버린다.
      const hell = !!action.hell && (s.hellUsed ?? 0) < HELL_LIMIT;
      let hellMul = 1;
      let hellWon = false;
      if (hell) {
        s.hellUsed = (s.hellUsed ?? 0) + 1;
        hellWon = rng.chance(hellOdds(s.player));
        hellMul = hellWon ? 2.3 : 0.42;
      }
      if (opt) {
        // 부상 위험 자체는 낮다 — 지옥의 위험은 부상이 아니라 "헛수고"다
        const risk = opt.risk * (hell ? 2.2 : 1);
        if (rng.chance(clamp(risk * injuryRiskMultiplier(s.player), 0, 0.75))) {
          s.player.condition = clamp(s.player.condition - 25, 20, 100);
          setAb(s.player.abilities, "durability" as never, clamp(getAb(s.player.abilities, "durability" as never) - rng.int(2, 5), 10, ABILITY_MAX));
          // 캠프에서 다치면 시즌 출발이 늦어진다
          campInjury = rng.float(0.15, 0.45);
          log(s, {
            icon: "⚠️", title: "캠프 중 부상", tone: "bad",
            body: `${opt.name} 도중 몸에 이상이 생겼습니다. 시즌의 약 ${Math.round(campInjury * 100)}%를 재활로 보냅니다.`,
          });
        }
        // 라커룸 분위기는 몸 상태로 나타난다 — 동료 관계가 좋으면 시즌을 가볍게 시작한다
        const clubhouse = (s.teammate - 55) * 0.16;
        s.player.condition = clamp(
          s.player.condition * 0.55 + 75 * 0.45 - opt.conditionCost * (hell ? 2.4 : 1) + clubhouse,
          25, 100);
        // 직전 시즌을 어디서 뛰었는지가 성장 폭을 좌우한다
        const prev = s.seasons[s.seasons.length - 1];
        const devRate = developmentRate(prev?.level ?? null, prev?.role ?? null, prev?.age ?? s.player.age);
        const { deltas } = grow(s.player, rng, opt, devRate, hellMul);
        const ups = (Object.entries(deltas) as [string, number][]).filter(([, v]) => v > 0);
        const gainText = ups.length
          ? `능력치 상승: ${ups.map(([k, v]) => `${ABILITY_LABEL[k] ?? k} +${v}`).join(", ")}`
          : "눈에 띄는 성장은 없었습니다.";

        if (hell) {
          const left = HELL_LIMIT - (s.hellUsed ?? 0);
          log(s, {
            icon: hellWon ? "🔥" : "💤",
            title: hellWon ? "지옥 훈련 성공" : "지옥 훈련 실패",
            tone: hellWon ? "epic" : "bad",
            body: hellWon
              ? `몸이 버텨냈습니다. ${gainText}`
              : `끝까지 버티지 못하고 한 해를 흘려보냈습니다. ${gainText}`,
          });
          notify(s, {
            icon: hellWon ? "🔥" : "💤", eyebrow: "Hell Training",
            title: hellWon ? "지옥 훈련 성공" : "지옥 훈련 실패",
            tone: hellWon ? "epic" : "bad",
            body: hellWon
              ? `${opt.name} — 몸을 갈아 넣은 겨울이 결실을 맺었습니다.`
              : `${opt.name} — 몸이 따라주지 않아 훈련이 어그러졌습니다.`,
            change: [
              { label: "훈련 결과", from: "—", to: ups.length ? ups.map(([k, v]) => `${ABILITY_LABEL[k] ?? k} +${v}`).join(" · ") : "성장 없음" },
              { label: "남은 기회", from: `${left + 1}회`, to: `${left}회` },
            ],
          });
        } else {
          log(s, {
            icon: "🏋️", title: `${opt.name} 완료`, tone: ups.length ? "good" : "neutral",
            body: gainText,
          });
        }
      }
      // 훈련을 거듭하면 선수 유형 자체가 바뀐다
      const styleAfter = deriveStyle(s.player);
      if (styleAfter.id !== styleBefore.id) {
        log(s, {
          icon: "🔀", title: "유형 변화", tone: "good",
          body: `${styleBefore.name} → ${styleAfter.name}. ${styleAfter.desc}`,
        });
      }
      s.pendingTraining = null;

      // 아마추어(대학) 훈련이면 프로 시즌 셋업 없이 진로로 돌아간다
      if (!s.contract) {
        const collegeDone = s.seasons.filter((x) => x.level === "COLLEGE").length;
        s.phase = collegeDone >= 2 ? "DRAFT" : "PATH_CHOICE";
        bump();
        return s;
      }

      openSeason(s, rng, campInjury);
      // 대표팀 발탁은 시즌 개막 전에 통보된다 (대회는 시즌 중에 치른다)
      const tourney = tournamentOf(s.year);
      if (tourney && s.seasonLevel === "KBO" && isCalledUp(s, tourney, rng)) {
        s.pendingTournament = tourney.id;
        notify(s, {
          icon: tourney.icon, eyebrow: "National Team", title: `${tourney.name} 대표팀 발탁`,
          tone: "epic",
          body: `${s.year}년 ${tourney.month}에 열리는 ${tourney.name} 예비 명단에 이름을 올렸습니다.`
            + (tourney.exemption ? ` ${tourney.exemption}.` : ""),
        });
        s.phase = "INTERNATIONAL";
      } else {
        s.phase = "FIRST_HALF";
      }
      bump();
      return s;
    }

    /* ---- 전반기 ---- */
    case "PLAY_FIRST_HALF": {
      runTournament(s, rng, "PRE");
      s.monthLines = playHalf(s, rng, H1_MONTHS);
      s.halfLine = mergeLines(s.monthLines.map((m) => m.line));

      runTournament(s, rng, "MID");

      // 트레이드 데드라인 — 하위권 팀의 좋은 선수에게 우승 도전팀이 손을 내민다
      s.pendingTrade = null;
      if (s.seasonLevel === "KBO" && s.contract && (s.contract.remaining ?? 0) > 0) {
        const home = teamById(s.contract.teamId);
        const value = s.halfLine.war;
        const weak = home.power <= 66;
        const chance = clamp((weak ? 0.18 : 0.05) + value * 0.07, 0, 0.45);
        if (rng.chance(chance)) {
          const contenders = TEAMS.filter((t) => t.id !== home.id && t.power >= 70);
          if (contenders.length) {
            const to = rng.pick(contenders);
            const proYears = s.seasons.filter((r) => r.level === "KBO" || r.level === "MINOR").length;
            const { role } = assignRole(s.player, to, s.serviceYears, 55, rng, proYears);
            s.pendingTrade = {
              teamId: to.id, role,
              note: `${to.name}가 우승에 도전하기 위해 ${s.player.name} 선수를 원합니다.`,
            };
            log(s, {
              icon: "📞", title: "트레이드 제안", tone: "neutral",
              body: `${home.name} → ${to.name}. 후반기를 우승 도전팀에서 보낼 수 있습니다.`,
            });
          }
        }
      }

      s.allStar = judgeAllStar(s.halfLine, s.seasonLevel ?? "MINOR", s.player.fame, rng, s.seasonRole);
      s.allStarGame = null;
      if (s.allStar && s.contract) {
        // 2군에서 뽑히면 퓨처스 올스타다 — 무대가 작은 만큼 인지도도 덜 오른다
        const futures = s.seasonLevel === "MINOR";
        const label = futures ? "퓨처스 올스타" : "올스타";
        s.player.fame = clamp(s.player.fame + (futures ? rng.int(1, 3) : rng.int(3, 7)), 0, 100);
        log(s, {
          icon: "⭐", title: `${label} 선정`, tone: futures ? "good" : "epic",
          body: futures
            ? "퓨처스리그 전반기 활약을 인정받아 퓨처스 올스타에 선정되었습니다."
            : "전반기 활약을 인정받아 올스타에 선정되었습니다.",
        });
        s.allStarGame = simAllStarGame(s.player, s.contract.teamId, rng, futures ? "MINOR" : "KBO");
        const ag = s.allStarGame;
        if (ag.mvp) {
          s.player.fame = clamp(s.player.fame + 10, 0, 100);
          log(s, { icon: "🌟", title: "올스타전 MVP", tone: "epic", body: `${ag.side}의 ${ag.score} 승리를 이끌며 올스타전 MVP에 선정되었습니다.` });
        } else {
          log(s, {
            icon: "🎪", title: `올스타전 ${ag.won ? "승리" : "패배"}`, tone: "neutral",
            body: `${ag.side} 소속으로 ${ag.opponent}와 맞붙어 ${ag.score}로 ${ag.won ? "이겼습니다" : "졌습니다"}.`,
          });
        }
      }
      if (s.seasonNote) log(s, { icon: "🏥", title: "부상", tone: "bad", body: s.seasonNote });
      s.phase = "ALL_STAR";
      bump();
      return s;
    }

    /* ---- 후반기 ---- */
    case "PLAY_SECOND_HALF": {
      s.monthLines = playHalf(s, rng, H2_MONTHS, true);
      s.seasonLine = mergeLines([s.halfLine, ...s.monthLines.map((m) => m.line)]);
      runTournament(s, rng, "LATE");

      const team = s.contract ? teamById(s.contract.teamId) : null;
      if (s.seasonLevel === "KBO" && team) {
        const strength = team.power + s.seasonLine.war * 0.8 + rng.normal() * 8;
        s.teamRank = clamp(Math.round(11 - (strength - 50) * 0.26), 1, 10);
      } else {
        s.teamRank = null;
      }
      if (s.teamRank && s.teamRank <= PS_CUT && team) {
        s.phase = "POSTSEASON";
      } else {
        runTournament(s, rng, "POST");
        closeSeason(s, rng);
        s.phase = "SEASON_END";
      }
      bump();
      return s;
    }

    /* ---- 가을야구 ---- */
    case "PLAY_POSTSEASON": {
      const team = s.contract ? teamById(s.contract.teamId) : null;
      if (team && s.teamRank) {
        s.postseason = simPostseason(s.player, team.id, s.teamRank, s.seasonAvailability, rng);
        const last = s.postseason.rounds[s.postseason.rounds.length - 1];
        log(s, {
          icon: s.postseason.champion ? "🏆" : "🍁",
          title: s.postseason.champion ? "한국시리즈 제패" : `${last?.name ?? "가을야구"} 탈락`,
          tone: s.postseason.champion ? "epic" : "neutral",
          body: s.postseason.rounds.map((r) => `${r.name} ${r.win ? "승" : "패"}(${r.score})`).join(" · "),
        });
      }
      runTournament(s, rng, "POST");
      closeSeason(s, rng);
      s.phase = "SEASON_END";
      bump();
      return s;
    }

    /* ---- 시즌 총평 ---- */
    case "FINISH_SEASON": {
      routeAfterSeason(s, rng);
      bump();
      return s;
    }

    /* ---- 국제대회 (발탁 통보 — 대회는 전반기 뒤에 치른다) ---- */
    case "JOIN_NATIONAL": {
      const t = s.pendingTournament ? TOURNAMENTS[s.pendingTournament] : null;
      if (t && action.join) {
        s.intlJoined = true;
        log(s, {
          icon: t.icon, title: `${t.name} 대표팀 승선`, tone: "good",
          body: `${s.year}년 ${t.month}에 열리는 ${t.name}에 출전합니다. ${
            t.slot === "PRE" ? "개막 전에 대회가 열립니다."
              : t.slot === "MID" ? "올스타 브레이크 무렵에 대회가 열립니다."
                : t.slot === "LATE" ? "후반기 중에 대회가 열립니다."
                  : "시즌을 모두 마친 뒤 대회가 열립니다."}`,
        });
      } else if (t) {
        s.intlJoined = false;
        s.pendingTournament = null;
        s.player.fame = clamp(s.player.fame - 4, 0, 100);
        log(s, { icon: "🙅", title: "대표팀 고사", tone: "neutral", body: `${t.name} 발탁을 고사하고 소속팀에 전념합니다.` });
      }
      s.phase = "FIRST_HALF";
      bump();
      return s;
    }

    /* ---- 병역 ---- */
    /* ---- 상무 지원 — 지원한다고 다 가는 곳이 아니다 ---- */
    case "APPLY_SANGMU": {
      const odds = sangmuOdds(s, overall(s.player));
      s.sangmuApplied = true;
      s.sangmuTries = (s.sangmuTries ?? 0) + 1;
      if (rng.chance(odds)) {
        s.military = "SANGMU";
        s.militaryLeft = MILITARY_OPTIONS.find((o) => o.id === "SANGMU")!.seasons;
        log(s, {
          icon: "🎽", title: "상무 합격", tone: "good",
          body: "국군체육부대 야구단에 최종 합격했습니다. 다음 시즌부터 퓨처스리그에서 뜁니다.",
        });
        notify(s, {
          icon: "🎽", eyebrow: "Sangmu", title: "상무 야구단 합격", tone: "epic",
          body: "지원자 가운데 최종 선발되었습니다. 다음 시즌부터 18개월간 퓨처스리그에서 실전 감각을 유지하며 복무합니다.",
          change: [{ label: "병역", from: "미필", to: "상무 복무 예정" }],
        });
        s.player.age += 1;
        s.year += 1;
        s.monthLines = null; s.halfLine = null; s.seasonLine = null;
        s.postseason = null; s.teamRank = null; s.allStar = false; s.allStarGame = null; s.seasonNote = null;
        s.pendingTraining = null;
        s.phase = "MILITARY_SEASON";
      } else {
        log(s, {
          icon: "📪", title: "상무 불합격", tone: "bad",
          body: "경쟁에서 밀려 선발되지 못했습니다. 내년에 다시 지원할 수 있습니다.",
        });
        notify(s, {
          icon: "📪", eyebrow: "Sangmu", title: "상무 불합격", tone: "bad",
          body: `선발 경쟁에서 밀렸습니다 (선발 확률 ${Math.round(odds * 100)}%). `
            + (canVolunteer(s)
              ? `기회가 한 번 더 남았습니다. 놓치면 ${MILITARY_DEADLINE}세에 현역으로 갑니다.`
              : `더 이상 상무에 지원할 수 없습니다. ${MILITARY_DEADLINE}세가 되면 현역으로 갑니다.`),
        });
      }
      bump();
      return s;
    }

    /* ---- 병역 ---- */
    case "ENLIST": {
      const id = action.option;
      const opt = MILITARY_OPTIONS.find((o) => o.id === id)!;
      s.military = id;
      s.militaryLeft = opt.seasons;
      log(s, {
        icon: "🪖", title: opt.name, tone: id === "SANGMU" ? "neutral" : "bad",
        body: id === "SANGMU"
          ? "상무 야구단에 입대했습니다. 퓨처스리그에서 경기를 이어갑니다."
          : "현역으로 입대했습니다. 18개월 동안 야구를 떠납니다.",
      });
      s.pendingTraining = null;
      s.phase = "MILITARY_SEASON";
      bump();
      return s;
    }

    case "SERVE": {
      const p = s.player;
      const keys = abilityKeys(p.kind);
      // 병역은 18개월 — 첫 해는 통째로, 둘째 해는 반 시즌만 복무하고 후반기에 복귀한다
      const half = s.militaryLeft <= 1;
      const serveShare = half ? 0.5 : 1;
      let line: StatLine;
      if (s.military === "SANGMU") {
        const inp = {
          player: p, level: "ARMY" as LevelTag, role: defaultRole(p),
          teamPower: 60, availability: 1, rng, share: serveShare,
        };
        line = p.kind === "HITTER" ? simHitter(inp) : simPitcher(inp);
        grow(p, rng, null, developmentRate("ARMY", "주전", p.age) * serveShare);
      } else {
        line = p.kind === "HITTER"
          ? simHitter({ player: p, level: "ARMY", role: defaultRole(p), teamPower: 60, availability: 0, rng })
          : simPitcher({ player: p, level: "ARMY", role: defaultRole(p), teamPower: 60, availability: 0, rng });
        for (const k of keys) {
          const loss = (k === "mental" ? rng.float(0, 1) : rng.float(1.5, 4.5)) * serveShare;
          setAb(p.abilities, k, clamp(Math.round(getAb(p.abilities, k) - loss), 15, ABILITY_MAX));
        }
      }

      s.militaryLeft = Math.round((s.militaryLeft - serveShare) * 10) / 10;
      const discharged = s.militaryLeft <= 0;

      // 전역하는 해는 시즌 기록을 따로 남기지 않는다 —
      // 전반기는 부대에, 후반기는 팀에 있으므로 그 해는 소속팀 시즌으로 친다.
      if (!discharged) {
        s.seasons.push({
          year: s.year, age: p.age, level: "ARMY", teamId: "-",
          teamName: s.military === "SANGMU" ? "상무 야구단" : "현역 복무",
          position: p.position, role: s.military === "SANGMU" ? "주전" : "복무",
          salary: 0, line, awards: [],
          note: s.military === "SANGMU" ? undefined : "야구를 떠나 있는 동안 기량이 떨어졌습니다.",
        });
        s.lastSeasonIndex = s.seasons.length - 1;
        s.player.age += 1;
        s.year += 1;
        bump();
        return s;
      }

      /* ---- 전역 — 그 해 후반기부터 뛴다 ---- */
      const wasSangmu = s.military === "SANGMU";
      s.military = "DONE";
      s.monthLines = null; s.seasonLine = null;
      s.postseason = null; s.teamRank = null; s.allStar = false; s.allStarGame = null;
      s.pendingTraining = null;
      // 전반기는 부대에 있었으므로 기록이 없다
      s.halfLine = emptyLine(p.kind);
      // 스프링캠프를 건너뛰고 곧바로 시즌에 합류한다 (후반기만 뛸 수 있다)
      openSeason(s, rng, 0, 0.8);
      s.phase = "ALL_STAR";

      log(s, {
        icon: "🎽", title: "전역", tone: "good",
        body: `18개월 복무를 마치고 ${s.year} 시즌 후반기부터 팀에 합류합니다.`,
      });
      notify(s, {
        icon: "🎽", eyebrow: "Discharge", title: "전역 · 후반기 합류", tone: "epic",
        body: wasSangmu
          ? "상무에서 실전 감각을 유지한 채 돌아왔습니다. 올스타 브레이크에 맞춰 1군에 합류합니다."
          : "18개월을 야구와 떨어져 지냈습니다. 몸을 끌어올리며 후반기부터 뛰게 됩니다.",
        change: [
          { label: "소속", from: wasSangmu ? "상무 야구단" : "현역 복무", to: `${s.seasonLevel === "KBO" ? "1군" : "2군"} ${s.seasonRole}` },
          { label: "출전", from: "—", to: "후반기부터" },
        ],
      });
      bump();
      return s;
    }

    /* ---- 연봉 협상 ---- */
    case "NEGOTIATE": {
      const nego = s.pendingNegotiation;
      const opt = nego?.options.find((o) => o.id === action.optionId);
      if (nego && opt && s.contract) {
        const success = opt.id === "accept" || rng.chance(opt.odds);
        const trustBefore = s.trust;
        const cap = MAX_SALARY;
        const next = clamp(success ? opt.onSuccess : opt.onFail, MIN_SALARY, cap);
        s.contract.salary = next;
        s.trust = clamp(s.trust + (success ? opt.trustOnSuccess : opt.trustOnFail), 0, 100);
        const diff = next - nego.previous;
        const change = `${formatMoney(nego.previous)} → ${formatMoney(next)} (${diff >= 0 ? "+" : "−"}${formatMoney(Math.abs(diff))})`;
        // 구단이 삭감을 제시한 해에는 협상에 성공해도 작년보다 적을 수 있다.
        // "성공인데 마이너스"로 읽히지 않게 무엇이 달라졌는지 밝힌다.
        const cut = success && diff < 0;
        const title = opt.id === "accept" ? "연봉 계약 완료"
          : success ? (cut ? `${opt.label} — 삭감 폭 축소` : `${opt.label} 성공`)
            : `${opt.label} 결렬`;
        const icon = opt.id === "accept" ? "✍️" : success ? (cut ? "🩹" : "📈") : "📉";
        const body = success
          ? cut
            ? `구단이 ${formatMoney(nego.offer)}까지 깎으려 했지만 ${formatMoney(next)}으로 막았습니다.`
            : opt.id === "accept"
              ? "구단이 제시한 금액에 그대로 사인했습니다."
              : "성적을 근거로 한 요구가 받아들여졌습니다."
          : `요구가 받아들여지지 않아 제시액(${formatMoney(nego.offer)})보다 낮은 금액에 사인했습니다.`;

        log(s, {
          icon, title,
          tone: success ? (cut ? "neutral" : "good") : "bad",
          body: `${body} ${change}`,
        });
        // 협상 결과는 바로 스토브리그로 넘어가 놓치기 쉽다 — 확인을 받는다
        notify(s, {
          icon, eyebrow: "Contract", title,
          tone: success && !cut ? "epic" : cut || !success ? "bad" : "neutral",
          body,
          change: [
            { label: "연봉", from: formatMoney(nego.previous), to: formatMoney(next) },
            { label: "구단 신뢰", from: String(Math.round(trustBefore)), to: String(Math.round(s.trust)) },
          ],
        });
      }
      s.pendingNegotiation = null;
      s.pendingTransfers = makeTransferTargets(s, rng);
      s.phase = "STOVE";
      bump();
      return s;
    }

    /* ---- 이적 신청 ---- */
    case "REQUEST_TRANSFER": {
      const target = s.pendingTransfers?.find((t) => t.teamId === action.teamId);
      if (target && s.contract) {
        s.transferRequested = true;
        const before = s.trust;
        if (rng.chance(target.odds)) {
          const from = teamById(s.contract.teamId);
          s.contract.teamId = target.teamId;
          s.contract.role = target.role;
          s.trust = clamp(55 + rng.int(-5, 10), 0, 100);
          s.teammate = clamp(45 + rng.int(-5, 10), 0, 100);
          const to = teamById(target.teamId);
          log(s, {
            icon: "🔁", title: "이적 성사", tone: "good",
            body: `${from.name} → ${to.name}. 새 팀에서 ${target.role}(으)로 시작합니다.`,
          });
          notify(s, {
            icon: "🔁", eyebrow: "Transfer", title: "이적 성사", tone: "epic",
            accent: to.color,
            body: `${to.name}가 영입을 받아들였습니다. 새 유니폼을 입고 다음 시즌을 시작합니다.`,
            change: [
              { label: "소속", from: from.name, to: to.name },
              { label: "예상 보직", from: s.contract.role === target.role ? "—" : s.contract.role, to: target.role },
            ],
          });
        } else {
          s.trust = clamp(s.trust - rng.int(5, 12), 0, 100);
          const to = teamById(target.teamId);
          log(s, {
            icon: "🚫", title: "이적 무산", tone: "bad",
            body: `${to.name}와의 협상이 결렬되었습니다. 구단 신뢰가 떨어졌습니다.`,
          });
          notify(s, {
            icon: "🚫", eyebrow: "Transfer", title: "이적 무산", tone: "bad",
            body: `${to.name}가 영입을 포기했습니다. 신청 사실이 알려져 원소속팀과의 관계가 나빠졌습니다.`,
            change: [{ label: "구단 신뢰", from: String(Math.round(before)), to: String(Math.round(s.trust)) }],
          });
        }
        s.pendingTransfers = makeTransferTargets(s, rng);
      }
      bump();
      return s;
    }

    case "SKIP_STOVE": {
      startNextYear(s, rng);
      bump();
      return s;
    }

    /* ---- FA ---- */
    case "ACCEPT_OFFER": {
      const offer = s.pendingOffers?.find((o) => o.teamId === action.teamId);
      if (offer) {
        const moved = s.contract && s.contract.teamId !== offer.teamId;
        s.contract = {
          teamId: offer.teamId, salary: offer.salary, years: offer.years,
          remaining: offer.years, role: offer.role,
          signingBonus: offer.signingBonus,
          incentivePerYear: Math.round(offer.incentive / Math.max(1, offer.years)),
        };
        s.faUsed += 1;
        s.player.fame = clamp(s.player.fame + 5, 0, 100);
        if (moved) { s.trust = 55; s.teammate = clamp(s.teammate - 10, 0, 100); }
        log(s, {
          icon: "✍️", title: "FA 계약", tone: "epic",
          body: `${teamById(offer.teamId).name}와 ${offer.years}년 총액 ${formatMoney(offer.total)} 계약 체결! `
            + `(계약금 ${formatMoney(offer.signingBonus)} · 연봉 ${formatMoney(offer.salary)} · 옵션 ${formatMoney(offer.incentive)})`,
        });
      }
      s.pendingOffers = null;
      startNextYear(s, rng);
      bump();
      return s;
    }

    /* ---- 트레이드 데드라인 ---- */
    case "TRADE_DECIDE": {
      const offer = s.pendingTrade;
      if (offer && s.contract) {
        if (action.accept) {
          const from = teamById(s.contract.teamId);
          const to = teamById(offer.teamId);
          s.contract.teamId = offer.teamId;
          s.contract.role = offer.role;
          s.seasonRole = offer.role;
          s.trust = clamp(55 + rng.int(-5, 10), 0, 100);
          s.teammate = clamp(s.teammate - 12, 0, 100);
          s.player.fame = clamp(s.player.fame + 5, 0, 100);
          log(s, {
            icon: "🔁", title: "트레이드 성사", tone: "good",
            body: `${from.name} → ${to.name}. 시즌 도중 유니폼을 갈아입고 ${offer.role}(으)로 후반기를 시작합니다.`,
          });
        } else {
          s.teammate = clamp(s.teammate + 6, 0, 100);
          log(s, {
            icon: "🛑", title: "트레이드 거부", tone: "neutral",
            body: "팀에 남기로 했습니다. 동료들과의 관계가 더 단단해졌습니다.",
          });
        }
      }
      s.pendingTrade = null;
      bump();
      return s;
    }

    /* ---- 커리어 갈림길 ---- */
    case "CHOOSE_EVENT": {
      const prompt = s.pendingEvent;
      const def = prompt ? chainByKey(prompt.key) : null;
      if (prompt && def) {
        def.apply(s, action.optionId, rng, (e) => log(s, e));
        s.chains.push({ key: def.key, choice: action.optionId, dueYear: s.year + def.dueIn });
        if (!s.seenEvents.includes(def.key)) s.seenEvents.push(def.key);
      }
      s.pendingEvent = null;
      routeToOffseason(s, rng);
      bump();
      return s;
    }

    /* ---- FA 1년 연기 ---- */
    case "DEFER_FA": {
      s.pendingOffers = null;
      log(s, {
        icon: "⏳", title: "FA 신청 보류", tone: "neutral",
        body: "올해는 권리를 행사하지 않고 팀에 남습니다. 한 시즌 더 뛰고 내년에 다시 자격을 행사할 수 있습니다.",
      });
      s.trust = clamp(s.trust + 4, 0, 100);
      const rec = s.seasons[s.lastSeasonIndex ?? s.seasons.length - 1];
      if (s.contract) {
        s.pendingNegotiation = buildNegotiation(s, rec);
        s.phase = "NEGOTIATION";
      } else {
        s.pendingTransfers = makeTransferTargets(s, rng);
        s.phase = "STOVE";
      }
      bump();
      return s;
    }

    /* ---- 은퇴 권고를 뿌리치고 한 시즌 더 ---- */
    case "KEEP_PLAYING": {
      s.retireReason = undefined;
      s.retireForced = false;
      // 구단은 달가워하지 않는다 — 신뢰가 깎이고 입지가 좁아진다
      s.trust = clamp(s.trust - rng.int(8, 16), 0, 100);
      s.player.fame = clamp(s.player.fame - rng.int(2, 5), 0, 100);
      log(s, {
        icon: "🔥", title: "현역 연장", tone: "neutral",
        body: "은퇴 권고를 뿌리치고 한 시즌을 더 뛰기로 했습니다. 구단은 달가워하지 않습니다.",
      });
      routeToOffseason(s, rng);
      bump();
      return s;
    }

    case "RETIRE": {
      s.phase = "SECOND_LIFE";
      const hof = computeHof(s);
      s.hofScore = hof.score;
      const honor = retirementHonors(s);
      if (honor) {
        const t = teamById(honor.teamId);
        log(s, {
          icon: honor.kind === "영구결번" ? "🎽" : "🎤",
          title: honor.kind === "영구결번" ? `${t.name} 영구결번` : `${t.name} 은퇴식`,
          tone: "epic",
          body: honor.kind === "영구결번"
            ? `${t.name}에서 ${honor.years}시즌을 뛴 공로로 등번호 ${s.player.number}번이 영구결번으로 지정되었습니다.`
            : `${t.name}이 홈 경기에서 ${s.player.name} 선수의 은퇴식을 열었습니다.`,
        });
      }
      if (!s.retireReason) s.retireReason = "스스로 유니폼을 벗기로 결정했습니다.";
      log(s, {
        icon: "🎖️", title: "은퇴", tone: "epic",
        body: `${s.player.name} 선수가 ${s.player.age}세의 나이로 은퇴했습니다. 통산 평가: ${hof.tier}`,
      });
      // 은퇴 5년 뒤부터 명예의 전당 투표가 열린다
      s.hofVote = newHofVote(s, hof.score);
      s.secondLife = null;
      bump();
      return s;
    }

    /* ---- 은퇴 후 진로 ---- */
    case "CHOOSE_SECOND_LIFE": {
      const ctx = legacyContext(s, s.hofScore ?? computeHof(s).score);
      const life = resolveSecondLife(ctx, action.pathId, rng);
      s.secondLife = life;
      s.phase = "RETIRED";
      log(s, {
        icon: life.icon, title: `은퇴 후 — ${life.name}`,
        tone: life.success ? "epic" : "neutral", body: life.story,
      });
      bump();
      return s;
    }

    /* ---- 명예의 전당 투표 한 해 진행 ---- */
    case "HOF_BALLOT": {
      if (s.hofVote) {
        const next = advanceHofVote(s.hofVote, rng);
        if (next) {
          s.hofVote = next;
          const last = next.ballots[next.ballots.length - 1];
          log(s, {
            icon: next.inducted ? "🏛️" : next.closed ? "📪" : "🗳️",
            title: next.inducted
              ? "명예의 전당 헌액"
              : next.closed ? "명예의 전당 후보 자격 상실" : `명예의 전당 ${last.ballot}차 투표`,
            tone: next.inducted ? "epic" : next.closed ? "bad" : "neutral",
            body: next.inducted
              ? `${last.year}년 ${last.ballot}차 투표에서 득표율 ${last.share}%로 명예의 전당에 헌액되었습니다.`
              : next.closed
                ? `득표율 ${last.share}%. 더 이상 후보로 오르지 못합니다.`
                : `${last.year}년 ${last.ballot}차 투표 득표율 ${last.share}% (헌액 기준 ${HOF_CUT}%).`,
          });
        }
      }
      bump();
      return s;
    }
  }
  return s;
}

export { canVolunteer, isServing, sangmuOdds, SANGMU_MAX_TRIES, MILITARY_OPTIONS, MILITARY_DEADLINE, tournamentOf };
export { legacyContext, secondLifeOptions, HOF_CUT, HOF_WAIT } from "./legacy";

/* ------------------------------------------------------------------ */
/* 통산 기록                                                            */
/* ------------------------------------------------------------------ */

/**
 * 레벨별 시즌 기록.
 *
 * 한 시즌에 1군·2군을 오갔다면 그 시즌은 **양쪽에 나뉘어 들어간다.**
 * 안 그러면 8월에 콜업돼 한 달을 1군에서 뛴 기록이 통째로 2군 기록이 되어버린다.
 */
export function seasonsAtLevel(seasons: SeasonRecord[], level: LevelTag): SeasonRecord[] {
  const out: SeasonRecord[] = [];
  for (const s of seasons) {
    const split = s.byLevel?.[level as "KBO" | "MINOR"];
    if (split) out.push({ ...s, level, line: split });
    else if (s.level === level) out.push(s);
  }
  return out;
}

export function careerTotals(seasons: SeasonRecord[], kind: "HITTER" | "PITCHER", level?: LevelTag) {
  const rows = level ? seasonsAtLevel(seasons, level) : seasons;
  if (kind === "HITTER") {
    const t = rows.reduce((a, s) => {
      const l = s.line as HitterLine;
      a.g += l.g; a.pa += l.pa; a.ab += l.ab; a.h += l.h; a.b2 += l.b2; a.b3 += l.b3;
      a.hr += l.hr; a.rbi += l.rbi; a.r += l.r; a.bb += l.bb; a.so += l.so; a.sb += l.sb;
      a.cs += l.cs; a.hbp += l.hbp; a.war += l.war;
      return a;
    }, { g: 0, pa: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 0, sb: 0, cs: 0, hbp: 0, war: 0 });
    const singles = t.h - t.b2 - t.b3 - t.hr;
    const tb = singles + t.b2 * 2 + t.b3 * 3 + t.hr * 4;
    return {
      ...t,
      war: Math.round(t.war * 10) / 10,
      avg: t.ab ? Math.round((t.h / t.ab) * 1000) / 1000 : 0,
      obp: t.pa ? Math.round(((t.h + t.bb + t.hbp) / t.pa) * 1000) / 1000 : 0,
      slg: t.ab ? Math.round((tb / t.ab) * 1000) / 1000 : 0,
      ops: t.ab && t.pa ? Math.round((((t.h + t.bb + t.hbp) / t.pa) + tb / t.ab) * 1000) / 1000 : 0,
    };
  }
  const t = rows.reduce((a, s) => {
    const l = s.line as PitcherLine;
    a.g += l.g; a.gs += l.gs; a.ip += l.ip; a.w += l.w; a.l += l.l; a.sv += l.sv;
    a.hld += l.hld; a.h += l.h; a.bb += l.bb; a.so += l.so; a.er += l.er; a.war += l.war;
    return a;
  }, { g: 0, gs: 0, ip: 0, w: 0, l: 0, sv: 0, hld: 0, h: 0, bb: 0, so: 0, er: 0, war: 0 });
  return {
    ...t,
    ip: Math.round(t.ip * 10) / 10,
    war: Math.round(t.war * 10) / 10,
    era: t.ip ? Math.round(((t.er * 9) / t.ip) * 100) / 100 : 0,
    whip: t.ip ? Math.round(((t.h + t.bb) / t.ip) * 100) / 100 : 0,
  };
}
