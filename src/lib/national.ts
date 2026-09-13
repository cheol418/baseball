import { RNG, clamp } from "./rng";
import { overall } from "./player";
import { emptyLine, isHitterLine, mergeLines, oneGameShare, simHitter, simPitcher } from "./sim";
import type {
  GameState, IntlGame, IntlResult, MilitaryStatus, PitcherLine, Player, StatLine,
  Tournament, TournamentId,
} from "./types";

/* ------------------------------------------------------------------ */
/* 국제대회                                                            */
/* ------------------------------------------------------------------ */

export const TOURNAMENTS: Record<TournamentId, Tournament> = {
  ASIAN_GAMES: {
    id: "ASIAN_GAMES", name: "아시안게임", short: "AG", month: "9월", icon: "🥇",
    exemption: "금메달 시 병역 면제", bar: 76, slot: "LATE",
  },
  PREMIER12: {
    id: "PREMIER12", name: "프리미어12", short: "P12", month: "11월", icon: "🏅",
    exemption: null, bar: 80, slot: "POST",
  },
  OLYMPIC: {
    id: "OLYMPIC", name: "올림픽", short: "OLY", month: "7월", icon: "🔥",
    exemption: "동메달 이상 시 병역 면제", bar: 81, slot: "MID",
  },
  WBC: {
    id: "WBC", name: "월드베이스볼클래식", short: "WBC", month: "3월", icon: "🌏",
    exemption: null, bar: 84, slot: "PRE",
  },
};

/**
 * 연도별 국제대회 (4년 주기).
 * 2026 아시안게임 · 2027 프리미어12 · 2028 올림픽 · 2029 WBC · 2030 아시안게임 …
 * 병역 혜택이 걸린 대회(아시안게임·올림픽)는 4년에 두 번 돌아온다.
 */
export function tournamentOf(year: number): Tournament | null {
  const m = ((year % 4) + 4) % 4;
  if (m === 2) return TOURNAMENTS.ASIAN_GAMES;
  if (m === 3) return TOURNAMENTS.PREMIER12;
  if (m === 0) return TOURNAMENTS.OLYMPIC;
  return TOURNAMENTS.WBC;
}

/** 대표팀 발탁 여부 */
export function isCalledUp(s: GameState, t: Tournament, rng: RNG): boolean {
  const p = s.player;
  if (s.military === "SANGMU" || s.military === "ACTIVE") return false;
  const kbo = s.seasons.filter((x) => x.level === "KBO");
  if (!kbo.length) return false;

  const last = kbo[kbo.length - 1];
  const ovr = overall(p);
  let score = (ovr - t.bar) * 1.1 + last.line.war * 2.2 + p.fame * 0.06;
  // 아시안게임은 병역 미필 유망주를 대거 뽑는다 (실제 대표팀 구성과 같은 이유)
  if (t.id === "ASIAN_GAMES" && s.military === "PENDING" && p.age <= 27) score += 8;
  if (t.id === "ASIAN_GAMES" && p.age >= 30) score -= 6;
  if (last.awards.length) score += last.awards.length * 3;
  // 2군에 머문 시즌 뒤에는 뽑히지 않는다
  if (last.level !== "KBO") return false;

  return rng.next() < clamp(0.03 + score * 0.026, 0.01, 0.75);
}

/** 대회별 일정 — 라운드 이름과 상대 후보 */
const SCHEDULE: Record<TournamentId, string[]> = {
  ASIAN_GAMES: ["예선 1차전", "예선 2차전", "준결승", "결승"],
  PREMIER12: ["조별리그 1차전", "조별리그 2차전", "조별리그 3차전", "슈퍼라운드", "결승"],
  OLYMPIC: ["조별리그 1차전", "조별리그 2차전", "녹아웃 스테이지", "준결승", "결승"],
  WBC: ["1라운드 1차전", "1라운드 2차전", "1라운드 3차전", "8강", "준결승", "결승"],
};

const RIVALS: Record<TournamentId, string[]> = {
  ASIAN_GAMES: ["대만", "일본", "중국", "홍콩", "태국", "필리핀"],
  PREMIER12: ["일본", "대만", "베네수엘라", "멕시코", "네덜란드", "미국", "도미니카"],
  OLYMPIC: ["일본", "미국", "도미니카", "이스라엘", "멕시코", "네덜란드"],
  WBC: ["일본", "미국", "도미니카", "쿠바", "베네수엘라", "푸에르토리코", "호주", "체코"],
};

/** 대회 진행 — 경기를 하나씩 치른다 */
export function simTournament(
  s: GameState, t: Tournament, rng: RNG,
): IntlResult {
  const p = s.player;
  // 대표팀 전력 = 선수 기량 + 난수. 아시안게임은 상대가 약하다
  const fieldStrength = t.id === "ASIAN_GAMES" ? 0.72 : t.id === "PREMIER12" ? 0.5 : 0.38;
  const roll = rng.next() * 0.75 + fieldStrength * 0.25 + (overall(p) - 78) * 0.004;

  let rank: number;
  if (roll >= 0.78) rank = 1;
  else if (roll >= 0.64) rank = 2;
  else if (roll >= 0.52) rank = 3;
  else if (roll >= 0.36) rank = 4;
  else rank = rng.int(5, 8);

  const medal = rank === 1 ? "금" : rank === 2 ? "은" : rank === 3 ? "동" : null;

  // 순위에 맞춰 대진을 구성한다
  const full = SCHEDULE[t.id];
  const beforeFinal = full.slice(0, full.length - 1);   // 결승 전까지
  const finalName = full[full.length - 1];

  /** [라운드 이름, 이겼는가] */
  let bracket: [string, boolean][];
  if (rank === 1) {
    bracket = [...beforeFinal.map((r, i) => [r, i < 2 ? rng.chance(0.72) : true] as [string, boolean]), [finalName, true]];
  } else if (rank === 2) {
    bracket = [...beforeFinal.map((r, i) => [r, i < 2 ? rng.chance(0.7) : true] as [string, boolean]), [finalName, false]];
  } else if (rank === 3) {
    // 준결승에서 지고 3·4위전에서 이긴다
    bracket = [
      ...beforeFinal.map((r, i) => [r, i < beforeFinal.length - 1 ? rng.chance(0.7) : false] as [string, boolean]),
      ["3·4위전", true],
    ];
  } else if (rank === 4) {
    bracket = [
      ...beforeFinal.map((r, i) => [r, i < beforeFinal.length - 1 ? rng.chance(0.65) : false] as [string, boolean]),
      ["3·4위전", false],
    ];
  } else {
    // 조별리그에서 탈락
    const group = beforeFinal.slice(0, Math.max(2, beforeFinal.length - 2));
    bracket = group.map((r) => [r, rng.chance(0.38)] as [string, boolean]);
  }

  const pool = rng.shuffle(RIVALS[t.id]);
  const extraAdj = t.id === "ASIAN_GAMES" ? 2 : -8;
  const games: IntlGame[] = [];
  const lines: StatLine[] = [];

  // 투수는 모든 경기에 나가지 않는다 — 선발은 2~3경기 중 한 번, 불펜은 대부분 등판
  const isSP = p.kind === "PITCHER" && p.position === "SP";
  const appearEvery = p.kind === "HITTER" ? 1 : isSP ? 3 : 1;
  const reliefSkip = p.kind === "PITCHER" && !isSP ? 0.25 : 0;

  for (let i = 0; i < bracket.length; i++) {
    const [round, won] = bracket[i];
    const appeared = p.kind === "HITTER"
      ? true
      : (i % appearEvery === 0) && !rng.chance(reliefSkip);

    const base = {
      player: p, level: "KBO" as const, teamPower: 80,
      availability: 1, rng, share: oneGameShare(p), extraAdj, minGames: 1,
    };
    const line: StatLine = !appeared
      ? emptyLine(p.kind)
      : p.kind === "HITTER"
        ? simHitter({ ...base, role: "주전" })
        : simPitcher({ ...base, role: p.position === "SP" ? "선발" : p.position === "CP" ? "마무리" : "불펜" });

    if (appeared) lines.push(line);

    // 내가 내준 점수보다 상대 득점이 적을 수는 없다
    const myEr = appeared && !isHitterLine(line) ? (line as PitcherLine).er : 0;
    const lo = rng.int(myEr, myEr + 4);
    const hi = lo + rng.int(1, 5);

    games.push({
      round, opponent: pool[i % pool.length], won,
      score: won ? `${hi}-${lo}` : `${lo}-${hi}`,
      line, appeared,
    });
  }

  const total = lines.length ? mergeLines(lines) : emptyLine(p.kind);
  const exempted =
    (t.id === "ASIAN_GAMES" && medal === "금") ||
    (t.id === "OLYMPIC" && medal !== null);

  const perf = isHitterLine(total)
    ? `${total.g}경기 타율 ${total.avg.toFixed(3).replace(/^0/, "")} ${total.hr}홈런`
    : `${total.g}경기 ${(total as PitcherLine).ip.toFixed(1)}이닝 평균자책 ${(total as PitcherLine).era.toFixed(2)}`;

  return {
    year: s.year,
    tournamentId: t.id,
    tournamentName: t.name,
    rank, medal, line: total, games, exempted,
    note: medal ? `${medal}메달 · ${perf}` : `${rank}위 · ${perf}`,
  };
}

/* ------------------------------------------------------------------ */
/* 병역                                                                */
/* ------------------------------------------------------------------ */

/** 병역을 해결해야 하는 마지노선 나이 */
export const MILITARY_DEADLINE = 28;

export interface MilitaryOption {
  id: "SANGMU" | "ACTIVE";
  name: string;
  desc: string;
  seasons: number;
  effect: string;
}

export const MILITARY_OPTIONS: MilitaryOption[] = [
  {
    id: "SANGMU",
    name: "상무 야구단 입대",
    desc: "국군체육부대에서 퓨처스리그 경기를 계속 뛴다. 실전 감각을 유지할 수 있다.",
    seasons: 1.5,
    effect: "18개월(1.5시즌) 퓨처스 · 능력치 소폭 성장",
  },
  {
    id: "ACTIVE",
    name: "현역 입대",
    desc: "야구를 완전히 떠나 1년 6개월을 복무한다. 돌아왔을 때 몸이 예전 같지 않다.",
    seasons: 1.5,
    effect: "18개월(1.5시즌) 결장 · 능력치 하락 · 이듬해 후반기 복귀",
  },
];

export const isServing = (m: MilitaryStatus) => m === "SANGMU" || m === "ACTIVE";

/** 상무 지원 가능 여부 (마지노선 전 자발적 입대) */
/** 상무 지원은 커리어에서 두 번까지 — 모집 시기가 정해져 있어 무한정 두드릴 수 없다 */
export const SANGMU_MAX_TRIES = 2;

export function canVolunteer(s: GameState): boolean {
  return s.military === "PENDING"
    && s.player.age >= 22 && s.player.age < MILITARY_DEADLINE
    && (s.sangmuTries ?? 0) < SANGMU_MAX_TRIES;
}

/**
 * 상무 야구단 선발 확률.
 *
 * 상무는 지원한다고 다 가는 곳이 아니다 — 해마다 정원이 있고 경쟁이 붙는다.
 * 1군에서 검증된 선수가 유리하고, 나이가 많으면 뽑을 이유가 줄어든다.
 */
export function sangmuOdds(s: GameState, ovr: number): number {
  const kbo = s.seasons.filter((r) => r.level === "KBO");
  const last = kbo[kbo.length - 1];
  const war = last?.line.war ?? 0;
  // 1군 경력이 없으면 서류에서 밀린다
  const proven = kbo.length >= 2 ? 0.12 : kbo.length === 1 ? 0.05 : 0;
  const age = s.player.age <= 24 ? 0.07 : s.player.age <= 26 ? 0.03 : -0.06;
  return clamp(0.06 + (ovr - 72) * 0.013 + war * 0.03 + proven + age, 0.04, 0.48);
}

/** 현역 복무로 인한 능력치 손실 */
export function applyActiveServiceDecay(p: Player, rng: RNG, keys: string[], set: (k: string, v: number) => void, get: (k: string) => number) {
  for (const k of keys) {
    const loss = k === "durability" || k === "mental" ? rng.float(0, 1.5) : rng.float(1.5, 4.5);
    set(k, clamp(Math.round(get(k) - loss), 15, 120));
  }
}
