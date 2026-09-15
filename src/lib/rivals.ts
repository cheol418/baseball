import { RNG, clamp } from "./rng";
import {
  abilityKeys, grow, makeTrainingOptions, overall, rollCandidate, STYLES,
  HITTER_POSITIONS, PITCHER_POSITIONS, type CreateOptions,
} from "./player";
import { isHitterLine, judgeAwards, type LeagueLeaders, MAJOR_TITLES, mergeLines, simHitter, simPitcher } from "./sim";
import { TEAMS } from "./teams";
import type { HitterLine, Kind, PitcherLine, Player, Position, StatLine } from "./types";

/* ------------------------------------------------------------------ */
/* 동기 — 같은 해에 지명받아 같이 늙어가는 선수들                          */
/* ------------------------------------------------------------------ */

/**
 * 왜 필요한가.
 *
 * 리그에 나 말고 아무도 없으면, 타이틀은 "난수 기준선을 넘었다"가 되고
 * 역대 10걸은 이름 없는 숫자 표가 된다. 기록에 무게가 실리려면
 * **"내가 누구를 제쳤는가"**가 있어야 한다.
 *
 * 그래서 드래프트 동기 여섯 명에게 이름을 주고, 플레이어와 같은 해에
 * 데뷔시켜 같이 나이 먹게 한다. 이들은 타이틀을 가져가고, 통산 순위에서
 * 앞서거나 밀리고, 먼저 은퇴하고, 명예의 전당에서 다시 만난다.
 *
 * 비용은 싸게 잡는다 — 플레이어와 같은 시뮬레이션을 쓰되 한 시즌에
 * 한 번만 부른다(월별로 쪼개지 않는다). 커리어 전체로도 백 번 남짓이다.
 */
export interface Rival {
  id: string;
  name: string;
  teamId: string;
  kind: Kind;
  position: Position;
  /** 지명 순위 (1~50) */
  pick: number;
  player: Player;
  /** 1군 통산 */
  total: StatLine | null;
  seasons: number;
  war: number;
  titles: number;
  mvp: number;
  best: { year: number; war: number } | null;
  /** 올해 받은 상 — 리그 소식에 그대로 쓴다 */
  lastAwards: string[];
  /** 연속으로 2군에 머문 해 */
  minorYears?: number;
  /** 올해 기록 — 타이틀을 리그 단위로 가릴 때 쓴다 */
  lastLine?: StatLine | null;
  retiredYear: number | null;
  /** 은퇴 시점 통산 요약 — 은퇴 뒤에는 이 문장으로만 기억된다 */
  epitaph: string | null;
}

const SURNAMES = [
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
  "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍",
  "전", "고", "문", "손", "배", "백", "허", "남", "심", "노",
];
const GIVEN = [
  "지완", "성현", "태호", "우빈", "다온", "현성", "민규", "재호", "승현", "찬우",
  "예성", "도훈", "시윤", "한결", "정원", "기범", "상우", "영재", "준서", "민혁",
  "세훈", "동주", "형우", "라온", "태준", "지호", "연우", "성찬", "우현", "재민",
];

/** 동기 몇 명을 만들 것인가 — 너무 많으면 이름이 흐려지고, 적으면 리그가 비어 보인다 */
export const RIVAL_COUNT = 6;

/**
 * 재능의 층. 실제 한 드래프트 클래스도 대부분 사라지고 한둘만 남는다.
 * 전부 특급이면 플레이어가 늘 초라해지고, 전부 평범하면 경쟁이 없다.
 */
const TIERS: { bias: number; talent: number; pick: [number, number] }[] = [
  { bias: 1, talent: 1.5, pick: [1, 3] },     // 한 세대에 한 명 — 끝까지 붙어 다닌다
  { bias: 0, talent: 1.24, pick: [1, 8] },
  { bias: -1, talent: 1.02, pick: [4, 18] },
  { bias: 0, talent: 0.9, pick: [10, 30] },
  { bias: 1, talent: 0.82, pick: [20, 45] },  // 늦게 피거나 사라지거나
  { bias: -1, talent: 0.74, pick: [25, 50] },
];

export function makeRivals(rng: RNG, playerTeamId: string, debutAge: number, myKind?: Kind): Rival[] {
  const names = new Set<string>();
  const pickName = () => {
    for (let i = 0; i < 40; i++) {
      const n = SURNAMES[rng.int(0, SURNAMES.length - 1)] + GIVEN[rng.int(0, GIVEN.length - 1)];
      if (!names.has(n)) { names.add(n); return n; }
    }
    return SURNAMES[rng.int(0, SURNAMES.length - 1)] + GIVEN[rng.int(0, GIVEN.length - 1)];
  };
  const teams = TEAMS.filter((t) => t.id !== playerTeamId);

  return TIERS.map((t, i) => {
    // 최상위 동기만은 플레이어와 같은 구분으로 만든다 —
    // 타자와 투수는 다투는 부문이 겹치지 않아, 전부 엇갈리면 "라이벌"이 없다
    const kind: Kind = i === 0 && myKind ? myKind : rng.chance(0.58) ? "HITTER" : "PITCHER";
    const pool = STYLES.filter((x) => x.kind === kind);
    const style = pool[rng.int(0, pool.length - 1)];
    const spots = kind === "HITTER" ? HITTER_POSITIONS : PITCHER_POSITIONS;
    const position = spots[rng.int(0, spots.length - 1)].id;
    const opts: CreateOptions = {
      name: pickName(), number: rng.int(1, 99), kind, position,
      bats: rng.chance(0.3) ? "L" : "R", throws: rng.chance(0.24) ? "L" : "R",
      styleId: style.id, bias: t.bias,
      armSlot: kind === "PITCHER" ? "THREE_QUARTER" : undefined,
    };
    const p = rollCandidate(opts, rng);
    p.age = debutAge;
    p.talent = clamp(p.talent * t.talent, 0.4, 1.6);
    // 재능만큼 잠재력도 같이 움직여야 층이 실제로 갈린다
    for (const k of abilityKeys(kind)) {
      const cur = (p.potential as unknown as Record<string, number>)[k];
      (p.potential as unknown as Record<string, number>)[k] = clamp(Math.round(cur * (0.82 + t.talent * 0.18)), 20, 120);
    }
    return {
      id: `r${i}`, name: opts.name, teamId: teams[rng.int(0, teams.length - 1)].id,
      kind, position, pick: rng.int(t.pick[0], t.pick[1]),
      player: p, total: null, seasons: 0, war: 0, titles: 0, mvp: 0,
      best: null, lastAwards: [], retiredYear: null, epitaph: null,
    };
  }).sort((a, b) => a.pick - b.pick);
}

/** 기량에 맞는 자리 — 플레이어의 `assignRole`을 흉내 내되 훨씬 단순하게 */
function roleOf(r: Rival, ovr: number): string {
  if (r.kind === "PITCHER") {
    if (r.position === "SP") return ovr >= 84 ? "에이스" : ovr >= 74 ? "선발" : "불펜";
    if (r.position === "CP") return ovr >= 76 ? "마무리" : "필승조";
    return ovr >= 78 ? "필승조" : "불펜";
  }
  return ovr >= 86 ? "간판타자" : ovr >= 78 ? "핵심타자" : ovr >= 71 ? "주전" : ovr >= 64 ? "준주전" : "백업";
}

/**
 * 동기들의 한 시즌.
 *
 * 플레이어와 같은 시뮬레이션을 쓴다 — 여기서만 다른 공식을 쓰면
 * "쟤는 왜 저런 성적이 나오지?"가 되고, 밸런스를 두 벌 잡아야 한다.
 */
export function advanceRivals(rivals: Rival[], rng: RNG, year: number, lead: LeagueLeaders): Rival[] {
  return rivals.map((r) => {
    if (r.retiredYear) return r;
    const ovr = overall(r.player);
    /**
     * 1군에 붙었는가.
     *
     * 한 번 올라오면 영원히 남는 게 아니다 — 기량이 떨어지면 다시 내려간다.
     * 실제 드래프트 클래스는 대부분 1군에 자리를 못 잡고 사라진다.
     */
    const inKbo = ovr >= (r.seasons > 0 ? 64 : 69);
    if (inKbo) {
      const team = TEAMS.find((t) => t.id === r.teamId);
      const role = roleOf(r, ovr);
      const inp = {
        player: r.player, level: "KBO" as const, role,
        teamPower: team?.power ?? 62, park: team?.park,
        availability: rng.float(0.78, 1), rng, share: 1,
      };
      const line: StatLine = r.kind === "HITTER" ? simHitter(inp) : simPitcher(inp);
      r.lastLine = line;
      r.total = r.total ? mergeLines([r.total, line]) : line;
      r.seasons += 1;
      r.war = Math.round((r.war + line.war) * 10) / 10;
      if (!r.best || line.war > r.best.war) r.best = { year, war: line.war };
      // 상도 플레이어와 **같은 판정**을 쓴다 — 여기서만 다른 기준을 쓰면
      // "쟤는 왜 저걸 받았지?"가 되고 밸런스를 두 벌 잡아야 한다
      r.lastAwards = judgeAwards(r.player, line, "KBO", r.seasons === 1, rng, lead);
      // 타이틀 확정은 리그 단위로 한 번에 가린다(`settleTitles`) — 여기선 후보까지만
    } else {
      r.lastAwards = [];
      r.lastLine = null;
    }
    /**
     * 성장·노쇠는 플레이어와 같은 곡선을 쓴다.
     *
     * **동기도 겨울마다 훈련한다.** 이걸 빼먹으면 플레이어만 매년
     * 집중 훈련과 한계 돌파를 받고 동기는 제자리라, 열 시즌이면
     * 상대가 안 된다. (실제로 겪음: 동기 통산 WAR 중앙 2.2, 내가 1위인
     * 커리어가 89%였다 — 라이벌이 아니라 들러리였다)
     */
    r.player.age += 1;
    const opts = makeTrainingOptions(r.player, rng);
    const focus = opts.length ? opts[rng.int(0, opts.length - 1)] : null;
    // 잘 크는 유망주일수록 좋은 환경에서 자란다 — 지명 순위가 대리 지표다
    const devRate = clamp(1.16 - r.pick * 0.006, 0.9, 1.16);
    grow(r.player, rng, focus, devRate, 1, { breakMul: 1.1 });

    // 2군에서만 해를 보내면 방출된다 — 스물여섯까지 못 올라오면 끝이다
    if (!inKbo) r.minorYears = (r.minorYears ?? 0) + 1;
    else r.minorYears = 0;
    if ((r.minorYears ?? 0) >= 3 && r.seasons === 0 && r.player.age >= 25) {
      r.retiredYear = year;
      r.epitaph = epitaphOf(r);
      return r;
    }

    // 은퇴 — 기량이 떨어지면 자리가 없어진다
    const next = overall(r.player);
    const bar = r.player.age >= 40 ? 82 : r.player.age >= 38 ? 79 : r.player.age >= 36 ? 75
      : r.player.age >= 34 ? 71 : r.player.age >= 32 ? 66 : 0;
    if (bar && next < bar) {
      r.retiredYear = year;
      r.epitaph = epitaphOf(r);
    }
    return r;
  });
}

function epitaphOf(r: Rival): string {
  if (!r.total || r.seasons === 0) return "1군 기록을 남기지 못하고 유니폼을 벗었습니다.";
  const t = r.total;
  const body = isHitterLine(t)
    ? `통산 ${t.h}안타 ${t.hr}홈런 ${t.rbi}타점`
    : `통산 ${(t as PitcherLine).w}승 ${(t as PitcherLine).sv}세이브 ${(t as PitcherLine).so}탈삼진`;
  return `${r.seasons}시즌 · ${body} · WAR ${r.war.toFixed(1)}`;
}

/** 지금 리그에서 가장 잘하는 동기 (은퇴자는 뺀다) */
export const topRival = (rivals: Rival[]): Rival | null =>
  rivals.filter((r) => !r.retiredYear && r.total)
    .sort((a, b) => (b.best?.war ?? 0) - (a.best?.war ?? 0))[0] ?? null;

/**
 * 내가 못 받은 타이틀은 **누가 가져갔는가**.
 * 그 부문에서 가장 나은 동기를 고른다. 아무도 못 미치면 리그의 다른
 * 누군가가 가져간 것으로 둔다(이름을 지어내지 않는다).
 */
export function titleTakenBy(rivals: Rival[], stat: string): Rival | null {
  const live = rivals.filter((r) => !r.retiredYear && r.total);
  if (!live.length) return null;
  const val = (r: Rival) => {
    const t = r.total as unknown as Record<string, number>;
    const v = t[stat] ?? 0;
    return stat === "era" ? -v : v;
  };
  const best = live.slice().sort((a, b) => val(b) - val(a))[0];
  return val(best) > 0 ? best : null;
}

/** 통산 WAR 기준 동기 순위에서 내 자리 (1-based, 나 포함) */
export function myRankAmong(rivals: Rival[], myWar: number): number {
  return rivals.filter((r) => r.war > myWar).length + 1;
}


/**
 * 한 해의 타이틀을 **리그 단위로** 가린다.
 *
 * 각자 따로 판정하면 같은 해에 홈런왕이 여럿 나온다 — 부문 1위는 한 명이다.
 * 기준선(`leagueLeaders`)은 화면 밖 리그 전체를 대신하므로 그대로 두고,
 * 그 선을 넘은 사람들 중 **가장 나은 한 명만** 가져가게 한다.
 * 이게 있어야 "내가 허지호를 제치고 홈런왕"이 성립한다.
 *
 * @returns 플레이어가 최종적으로 받은 상
 */
export function settleTitles(
  myAwards: string[], myLine: StatLine, rivals: Rival[],
  titleStat: Record<string, string>,
): { mine: string[]; lost: { title: string; to: Rival }[] } {
  const lost: { title: string; to: Rival }[] = [];
  const dropped = new Set<string>();
  const valOf = (line: StatLine, stat: string) => {
    const v = (line as unknown as Record<string, number>)[stat] ?? 0;
    return stat === "era" ? -v : v;   // 평균자책점만 작을수록 좋다
  };

  const all = new Set([...myAwards, ...rivals.flatMap((r) => r.lastAwards)]);
  for (const title of all) {
    // MVP는 WAR로, 부문 타이틀은 그 기록으로 가린다.
    // 골든글러브·신인왕은 자리가 여럿이라 다투지 않는다.
    const stat = title === "정규시즌 MVP" ? "war" : titleStat[title];
    if (!stat) continue;

    const holders = rivals.filter((r) => r.lastAwards.includes(title) && r.lastLine);
    const mineHas = myAwards.includes(title);
    if (holders.length + (mineHas ? 1 : 0) <= 1) continue;

    const bestRival = holders.slice()
      .sort((a, b) => valOf(b.lastLine!, stat) - valOf(a.lastLine!, stat))[0];
    const iWin = mineHas && (!bestRival || valOf(myLine, stat) >= valOf(bestRival.lastLine!, stat));

    // 이긴 한 명만 남기고 전부 지운다
    for (const r of holders) {
      if (!iWin && r === bestRival) continue;
      r.lastAwards = r.lastAwards.filter((a) => a !== title);
    }
    if (mineHas && !iWin) { dropped.add(title); lost.push({ title, to: bestRival }); }
  }

  // 정산이 끝난 뒤에 세어 담는다
  for (const r of rivals) {
    r.titles += r.lastAwards.filter((a) => MAJOR_TITLES.includes(a) && a !== "정규시즌 MVP").length;
    r.mvp += r.lastAwards.filter((a) => a === "정규시즌 MVP").length;
  }
  return { mine: myAwards.filter((a) => !dropped.has(a)), lost };
}