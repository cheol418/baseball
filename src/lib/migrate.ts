import { makeTrainingOptions, overall } from "./player";
import { RNG } from "./rng";
import { emptyLine } from "./sim";
import { TEAM_ID_ALIAS } from "./teams";
import type { GameState, Phase } from "./types";

/**
 * 예전 버전에서 저장된 세이브를 현재 구조로 끌어올린다.
 *
 * 시즌 구조(전반기·후반기·가을야구)와 국제대회·병역·관계 스탯이 추가되면서
 * 필드가 늘었기 때문에, 저장소에서 읽을 때 한 번 통과시켜 빠진 값을 채운다.
 */

/** 사라진 예전 단계를 현재 단계로 대응시킨다 */
const PHASE_ALIAS: Record<string, Phase> = {
  // 예전엔 "훈련 선택"이 오프시즌이었다 → 지금은 스프링캠프
  OFFSEASON: "SPRING_CAMP",
  // 예전엔 시즌 전체를 한 번에 치렀다 → 지금은 스프링캠프부터 다시 시작
  SEASON: "SPRING_CAMP",
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export function migrateSave(raw: unknown): GameState | null {
  if (!isObject(raw) || !isObject(raw.player) || !Array.isArray(raw.seasons)) return null;
  const g = raw as unknown as GameState & Record<string, unknown>;

  const def = <K extends keyof GameState>(key: K, value: GameState[K]) => {
    if (g[key] === undefined) (g as Record<string, unknown>)[key as string] = value;
  };

  // 시즌 진행
  def("monthLines", null);
  def("halfLine", null);
  def("seasonLine", null);
  def("seasonLevel", null);
  def("seasonRole", null);
  def("seasonAvailability", 1);
  def("allStar", false);
  def("allStarGame", null);
  def("seasonGoal", null);
  def("pendingTrade", null);
  if (typeof g.kboShare !== "number") g.kboShare = 0;
  if (typeof g.calledUpThisSeason !== "boolean") g.calledUpThisSeason = false;
  def("seasonNote", null);
  def("teamRank", null);
  def("postseason", null);
  if (typeof g.ovrAtSeasonStart !== "number") g.ovrAtSeasonStart = overall(g.player);

  // 투구폼 (예전 세이브의 투수는 스리쿼터로 본다)
  if (g.player.kind === "PITCHER" && !g.player.armSlot) g.player.armSlot = "THREE_QUARTER";

  // 관계
  if (typeof g.trust !== "number") g.trust = 55;
  if (typeof g.teammate !== "number") g.teammate = 55;

  // 병역 · 국제대회
  if (typeof g.military !== "string") g.military = "PENDING";
  if (typeof g.militaryLeft !== "number") g.militaryLeft = 0;
  if (!Array.isArray(g.intlResults)) g.intlResults = [];

  // 대기 중인 선택지
  def("pendingNegotiation", null);
  def("pendingTransfers", null);
  def("pendingTournament", null);
  if (typeof g.intlJoined !== "boolean") g.intlJoined = false;
  if (typeof g.draftMissed !== "boolean") g.draftMissed = false;
  def("pendingEvent", null);
  if (!Array.isArray(g.chains)) g.chains = [];
  if (!Array.isArray(g.seenEvents)) g.seenEvents = [];
  if (typeof g.nextSeasonAvailability !== "number") g.nextSeasonAvailability = 1;
  if (typeof g.transferRequested !== "boolean") g.transferRequested = false;
  // 예전 세이브의 은퇴 안내는 모두 강제 은퇴였다
  if (typeof g.retireForced !== "boolean") g.retireForced = true;
  if (!Array.isArray(g.notices)) g.notices = [];
  if (typeof g.sangmuApplied !== "boolean") g.sangmuApplied = false;
  if (typeof g.sangmuTries !== "number") g.sangmuTries = 0;
  if (typeof g.hellUsed !== "number") g.hellUsed = 0;
  def("pendingTraining", null);
  def("pendingOffers", null);
  if (g.lastSeasonIndex === undefined) {
    g.lastSeasonIndex = g.seasons.length ? g.seasons.length - 1 : null;
  }

  // 구단 재편 — 고양 드래곤즈 → 고척 히어로즈, 전주 블레이즈 → 잠실 베어스
  const team = (id: unknown) => (typeof id === "string" ? TEAM_ID_ALIAS[id] ?? id : id);
  if (g.contract) g.contract.teamId = team(g.contract.teamId) as string;
  if (g.draftPick) g.draftPick.teamId = team(g.draftPick.teamId) as string;
  g.wishTeamId = team(g.wishTeamId) as string;
  for (const rec of g.seasons) {
    rec.teamId = team(rec.teamId) as string;
    if (rec.ps) for (const r of rec.ps.rounds) void r;
  }
  if (Array.isArray(g.pendingTransfers)) {
    for (const t of g.pendingTransfers) t.teamId = team(t.teamId) as string;
  }
  if (Array.isArray(g.pendingOffers)) {
    for (const o of g.pendingOffers) o.teamId = team(o.teamId) as string;
  }
  if (g.pendingTrade) g.pendingTrade.teamId = team(g.pendingTrade.teamId) as string;

  // 아마추어 대회 필드명 변경 흡수
  for (const rec of g.seasons as unknown as Record<string, unknown>[]) {
    if (rec.hsTournaments && !rec.tournaments) rec.tournaments = rec.hsTournaments;

    // 예전 세이브의 가을야구에는 시리즈별 개인 기록이 없다
    const ps = rec.ps as Record<string, unknown> | undefined;
    if (isObject(ps) && Array.isArray(ps.rounds)) {
      for (const r of ps.rounds as Record<string, unknown>[]) {
        if (!isObject(r.line)) r.line = emptyLine(g.player.kind);
      }
    }
  }
  if (isObject(g.postseason) && Array.isArray(g.postseason.rounds)) {
    for (const r of g.postseason.rounds as unknown as Record<string, unknown>[]) {
      if (!isObject(r.line)) r.line = emptyLine(g.player.kind);
    }
  }

  // 단계 이름 변경 반영
  const mapped = PHASE_ALIAS[g.phase as string];
  if (mapped) {
    g.phase = mapped;
    // 스프링캠프로 돌아왔는데 훈련 후보가 없으면 새로 뽑는다
    if (mapped === "SPRING_CAMP" && !g.pendingTraining?.length) {
      g.pendingTraining = makeTrainingOptions(g.player, new RNG(g.seed || 1));
    }
  }

  return g;
}
