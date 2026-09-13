import { RNG, clamp } from "./rng";
import { overall } from "./player";
import { isHitterLine, mergeLines, simHitter, simPitcher } from "./sim";
import type { AmateurTournament, HsRound, LevelTag, Player, StatLine } from "./types";

/** 고교 3대 전국대회 */
export const HS_TOURNAMENTS = [
  { id: "golden", name: "황금사자기", month: 5 },
  { id: "blue", name: "청룡기", month: 7 },
  { id: "phoenix", name: "봉황대기", month: 8 },
] as const;

/** 대학 3대 전국대회 */
export const COLLEGE_TOURNAMENTS = [
  { id: "president", name: "대통령기", month: 5 },
  { id: "champ", name: "전국대학야구선수권", month: 7 },
  { id: "chairman", name: "협회장기", month: 9 },
] as const;

const HS_OPPONENTS = [
  "백호고", "청람고", "한올고", "동진고", "서라벌고",
  "금성고", "태평고", "무학고", "덕산고", "운암고",
];

const COLLEGE_OPPONENTS = [
  "한서대", "청운대", "백산대", "동해대", "금호대",
  "서라벌대", "태산대", "무진대", "덕성대", "운암대",
];

/** 레벨별 대회 구성 */
export const tournamentsOf = (level: LevelTag) =>
  level === "COLLEGE" ? COLLEGE_TOURNAMENTS : HS_TOURNAMENTS;

/** 그 무대의 평균 기량 — 이 기준을 넘어야 상위 라운드에 간다 */
const FIELD_LEVEL: Partial<Record<LevelTag, number>> = { HS: 47, COLLEGE: 60 };

/** 대회에서 오를 수 있는 단계 */
const LADDER = ["16강", "8강", "4강", "결승"] as const;
const PLACEMENTS = ["16강 탈락", "8강", "4강", "준우승", "우승"] as const;

/** 성적이 좋을수록 높은 점수 — 성장·드래프트 보정에 쓰인다 */
export const placementScore = (p: string) => PLACEMENTS.indexOf(p as typeof PLACEMENTS[number]);

/** 고교 시즌 한 대회를 치른다 */
export function simAmateurTournament(
  player: Player, tourney: { id: string; name: string; month: number },
  level: LevelTag, rng: RNG,
): AmateurTournament {
  // 에이스 한 명이 팀을 끌고 가는 게 아마추어 야구다 — 기량이 성적에 크게 반영된다
  const roll = rng.next()
    + (overall(player) - (FIELD_LEVEL[level] ?? 46)) * 0.035
    + rng.normal() * 0.035;
  const placeIdx =
    roll >= 0.84 ? 4 : roll >= 0.65 ? 3 : roll >= 0.4 ? 2 : roll >= 0.16 ? 1 : 0;
  const placement = PLACEMENTS[placeIdx];

  // 8강에 올랐다면 16강을 이기고 8강에서 진 것 — 진출 라운드 수만큼 경기를 치른다
  // 16강 탈락 1경기 / 8강 2 / 4강 3 / 준우승·우승 4
  const games = placeIdx === 0 ? 1 : Math.min(placeIdx + 1, 4);
  const pool = rng.shuffle(level === "COLLEGE" ? COLLEGE_OPPONENTS : HS_OPPONENTS);
  const rounds: HsRound[] = [];
  for (let i = 0; i < games; i++) {
    const won = placeIdx === 4 ? true : i < games - 1;
    const lose = rng.int(0, 4);
    const win = lose + 1 + rng.int(0, 4);
    rounds.push({
      name: LADDER[Math.min(i, LADDER.length - 1)],
      opponent: pool[i % pool.length],
      won,
      score: won ? `${win}-${lose}` : `${lose}-${win}`,
    });
  }

  // 개인 성적 — 그 레벨의 한 시즌 경기 수 중 이 대회 몫
  const seasonGames = level === "COLLEGE" ? 38 : 24;
  const share = rounds.length / seasonGames;
  const base = {
    player, level, teamPower: 62, availability: 1, rng, share,
    // 전국대회는 상대가 강하다
    extraAdj: -3,
  };
  const line: StatLine = player.kind === "HITTER"
    ? simHitter({ ...base, role: "주전" })
    : simPitcher({ ...base, role: player.position === "CP" ? "마무리" : "선발" });

  // 개인상은 결승까지 간 팀에서만 나온다
  let award: string | null = null;
  if (placeIdx >= 3) {
    const great = isHitterLine(line)
      ? line.h >= rounds.length * 1.5 || line.hr >= 1
      : (line.era > 0 && line.era <= 2.5);
    if (great && rng.chance(placeIdx === 4 ? 0.55 : 0.25)) {
      award = placeIdx === 4 ? "최우수선수상" : "우수선수상";
    }
  }

  return { id: tourney.id, name: tourney.name, month: tourney.month, placement, rounds, line, award };
}

export interface AmateurSeasonResult {
  tournaments: AmateurTournament[];
  /** 대회 + 주말리그 합산 */
  line: StatLine;
  /** 0(전패) ~ 12(3개 대회 전관왕) */
  totalScore: number;
  /** 성장 배수 */
  devBonus: number;
  /** 인지도 상승분 */
  fameGain: number;
  /** 드래프트 평가 가산점 */
  draftBonus: number;
  awards: string[];
}

/** 아마추어 한 시즌 — 전국대회 3개 + 리그전 */
export function simAmateurSeason(
  player: Player, rng: RNG, availability: number, level: LevelTag = "HS",
): AmateurSeasonResult {
  const tournaments = tournamentsOf(level).map((t) => simAmateurTournament(player, t, level, rng));
  const usedGames = tournaments.reduce((a, t) => a + t.rounds.length, 0);
  const seasonGames = level === "COLLEGE" ? 38 : 24;

  // 남은 경기는 리그전
  const leagueShare = Math.max(0, (seasonGames - usedGames) / seasonGames) * availability;
  const base = {
    player, level, teamPower: 62, availability: 1, rng, share: leagueShare,
  };
  const league: StatLine = player.kind === "HITTER"
    ? simHitter({ ...base, role: "주전" })
    : simPitcher({ ...base, role: player.position === "CP" ? "마무리" : "선발" });

  const totalScore = tournaments.reduce((a, t) => a + placementScore(t.placement), 0);
  const awards = tournaments.filter((t) => t.award).map((t) => `${t.name} ${t.award}`);

  return {
    tournaments,
    line: mergeLines([...tournaments.map((t) => t.line), league]),
    totalScore,
    // 전국대회에서 큰 경기를 치를수록 빨리 큰다 (평균 6점 기준)
    devBonus: clamp(1 + (totalScore - 6) * 0.045, 0.76, 1.32),
    fameGain: Math.round(totalScore * 1.6 + awards.length * 5),
    draftBonus: totalScore * 0.9 + awards.length * 3,
    awards,
  };
}
