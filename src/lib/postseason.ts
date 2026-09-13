import { RNG, clamp } from "./rng";
import { emptyLine, mergeLines, simHitter, simPitcher } from "./sim";
import { TEAMS, teamById } from "./teams";
import type { Player, PostseasonResult, PostseasonRound, StatLine } from "./types";

/** 시드별로 치러야 하는 라운드 (KBO 방식) */
const LADDER: Record<number, string[]> = {
  1: ["한국시리즈"],
  2: ["플레이오프", "한국시리즈"],
  3: ["준플레이오프", "플레이오프", "한국시리즈"],
  4: ["와일드카드", "준플레이오프", "플레이오프", "한국시리즈"],
  5: ["와일드카드", "준플레이오프", "플레이오프", "한국시리즈"],
};

/** 라운드별 최대 경기 수 */
const ROUND_GAMES: Record<string, number> = {
  와일드카드: 2, 준플레이오프: 5, 플레이오프: 5, 한국시리즈: 7,
};

/** 가을야구 진출 커트라인 */
export const PS_CUT = 5;

export function simPostseason(
  p: Player, teamId: string, seed: number, availability: number, rng: RNG,
): PostseasonResult {
  const myTeam = teamById(teamId);
  const rounds: PostseasonRound[] = [];
  const lines: StatLine[] = [];
  let alive = true;
  let champion = false;

  const ladder = LADDER[clamp(seed, 1, 5)] ?? [];
  // 상대는 상위 시드일수록 강하다
  const pool = TEAMS.filter((t) => t.id !== teamId).sort((a, b) => b.power - a.power);

  for (let i = 0; i < ladder.length && alive; i++) {
    const name = ladder[i];
    const opp = pool[Math.min(i, pool.length - 1)];
    const maxG = ROUND_GAMES[name];
    const need = name === "와일드카드" ? 1 : Math.ceil(maxG / 2);

    // 와일드카드는 4위가 1승 어드밴티지를 안고 시작한다
    let myWins = name === "와일드카드" && seed === 4 ? 1 : 0;
    let oppWins = 0;
    const edge = clamp(0.5 + (myTeam.power - opp.power) * 0.011, 0.22, 0.78);
    while (myWins < need && oppWins < need) {
      if (rng.chance(edge)) myWins++;
      else oppWins++;
    }
    const win = myWins >= need;
    rounds.push({ name, opponent: opp.name, win, score: `${myWins}승 ${oppWins}패` });

    // 선수 성적 — 시리즈 경기 수만큼만
    const games = myWins + oppWins;
    const share = games / 144;
    const inp = {
      player: p, level: "KBO" as const, role: "", teamPower: myTeam.power,
      park: myTeam.park,
      availability, rng, share, extraAdj: -5, // 가을에는 상대가 더 강하다
    };
    lines.push(
      p.kind === "HITTER"
        ? simHitter({ ...inp, role: "주전" })
        : simPitcher({ ...inp, role: p.position === "SP" ? "선발" : p.position === "CP" ? "마무리" : "불펜" }),
    );

    if (!win) alive = false;
    else if (name === "한국시리즈") champion = true;
  }

  return {
    seed, rounds, champion,
    line: lines.length ? mergeLines(lines) : emptyLine(p.kind),
  };
}
