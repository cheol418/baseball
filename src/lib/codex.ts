/**
 * 도감 — **커리어가 끝나도 남는 것.**
 *
 * 지금까지는 은퇴하면 명예의 전당 점수 하나가 나오고 끝이었다.
 * 한 판이 끝나면 아무것도 쌓이지 않으니 다시 시작할 이유가 세이브마다 따로 놀았다.
 *
 * **새로 세는 것은 없다** — 전부 세이브에 이미 남아 있는 것에서 뽑는다
 * (특수능력 조건과 같은 원칙이다). 다만 세이브는 서른 개쯤이 한도라
 * 지우게 되므로, 도감은 **지운 뒤에도 남아야 한다** — 저장은 `storage.ts`가
 * 맡고 여기서는 "이 커리어가 무엇을 채웠는가"만 순수하게 계산한다.
 */
import { ABILITIES } from "./ability";
import { HAS_BRONZE_GAME, TOURNAMENTS } from "./national";
import { nickname } from "./records";
import { MAJOR_TITLES } from "./sim";
import type { GameState, Kind, SeasonRecord } from "./types";

export interface CodexEntry {
  id: string;
  name: string;
  /** 아직 못 채웠을 때 보여줄 한 줄 — 가려두면 모을 이유가 안 생긴다 */
  hint: string;
  icon?: string;
  /** 투수/타자 한쪽에만 있는 항목 */
  kind?: Kind;
}

export interface CodexSection {
  id: string;
  title: string;
  /** 왜 모으는가 */
  lead: string;
  entries: CodexEntry[];
}

/* ------------------------------------------------------------------ */
/* 카탈로그                                                             */
/* ------------------------------------------------------------------ */

/** 통산 이정표 — `records.ts`의 `HIT_MARKS`·`PIT_MARKS`와 **같은 말을 해야 한다** */
const HIT_MARKS: [string, number[]][] = [
  ["안타", [500, 1000, 1500, 2000, 2500, 3000]],
  ["홈런", [100, 200, 300, 400, 500, 600]],
  ["타점", [500, 1000, 1500, 2000]],
  ["도루", [100, 200, 300, 400]],
];
const PIT_MARKS: [string, number[]][] = [
  ["승", [50, 100, 150, 200, 250]],
  ["탈삼진", [500, 1000, 1500, 2000, 2500]],
  ["세이브", [100, 200, 300, 400]],
  ["홀드", [100, 150, 200]],
  ["이닝", [1000, 1500, 2000, 2500, 3000]],
];

/** 대기록 문구는 `records.ts`가 만든 문자열과 글자까지 같아야 맞춰진다 */
export const markLabel = (label: string, n: number) => `통산 ${n.toLocaleString()}${label} 달성`;

/** 별명 — `records.ts`의 `nickname()`이 돌려줄 수 있는 전부 */
const NICKNAMES: [string, string, Kind | undefined][] = [
  ["리그의 지배자", "MVP를 두 번 받는다", undefined],
  ["우승 청부사", "한국시리즈 우승 반지 세 개", undefined],
  ["홈런 군주", "통산 450홈런", "HITTER"],
  ["거포", "통산 300홈런", "HITTER"],
  ["안타 제조기", "통산 2,400안타", "HITTER"],
  ["대도", "통산 350도루", "HITTER"],
  ["국민 타자", "국제대회 금메달", "HITTER"],
  ["꾸준함의 대명사", "통산 1,500안타", "HITTER"],
  ["안방마님", "포수로 세 시즌", "HITTER"],
  ["대투수", "통산 180승", "PITCHER"],
  ["수호신", "통산 280세이브", "PITCHER"],
  ["닥터 K", "통산 2,000탈삼진", "PITCHER"],
  ["잠수함", "언더핸드로 세 시즌", "PITCHER"],
  ["옆구리 마당쇠", "사이드암으로 세이브+홀드 150", "PITCHER"],
  ["국민 투수", "국제대회 금메달", "PITCHER"],
  ["좌완 파이어볼러", "좌완으로 통산 1,200탈삼진", "PITCHER"],
  ["이닝이터", "통산 2,000이닝", "PITCHER"],
];

const SECOND_LIVES: [string, string, string][] = [
  ["COACH", "🧢", "코치"], ["MANAGER", "📋", "감독"], ["COMMENTATOR", "🎤", "해설위원"],
  ["SCOUT", "🔍", "스카우트"], ["FRONT", "💼", "프런트"], ["ACADEMY", "⚾", "야구교실"],
  ["AWAY", "🌊", "야구를 떠난다"],
];

const MEDALS = ["금", "은", "동"] as const;

export const SECTIONS: CodexSection[] = [
  {
    id: "perk", title: "특수능력", lead: "커리어 중에 얻고 잃는 27종.",
    entries: ABILITIES.map((a) => ({
      id: `perk:${a.id}`, name: a.name, hint: a.how, icon: a.icon, kind: a.kind,
    })),
  },
  {
    id: "award", title: "수상", lead: "한 시즌을 최고로 보낸 증거.",
    entries: [
      ...MAJOR_TITLES.map((t) => ({ id: `award:${t}`, name: t, hint: "그 부문 1위", icon: "🏆" })),
      { id: "award:신인왕", name: "신인왕", hint: "데뷔 시즌에 자리를 잡는다", icon: "🌱" },
      { id: "award:골든글러브", name: "골든글러브", hint: "그 자리 최고의 한 해", icon: "🧤" },
      { id: "award:올스타", name: "올스타", hint: "전반기를 잘 보내고 뽑힌다", icon: "⭐" },
    ],
  },
  {
    id: "mark", title: "통산 이정표", lead: "한 해로는 닿을 수 없는 숫자들.",
    entries: [
      ...HIT_MARKS.flatMap(([l, steps]) => steps.map((n) => ({
        id: `mark:${l}:${n}`, name: `${n.toLocaleString()}${l}`,
        hint: `통산 ${l} ${n.toLocaleString()}`, icon: "📜", kind: "HITTER" as Kind,
      }))),
      ...PIT_MARKS.flatMap(([l, steps]) => steps.map((n) => ({
        id: `mark:${l}:${n}`, name: `${n.toLocaleString()}${l}`,
        hint: `통산 ${l} ${n.toLocaleString()}`, icon: "📜", kind: "PITCHER" as Kind,
      }))),
    ],
  },
  {
    id: "nick", title: "별명", lead: "사람들이 나를 뭐라고 불렀는가.",
    entries: NICKNAMES.map(([name, hint, kind]) => ({ id: `nick:${name}`, name, hint, icon: "🗣️", kind })),
  },
  {
    id: "medal", title: "국제대회", lead: "태극마크를 달고 선 자리.",
    /*
     * **WBC 동메달 칸을 두면 안 된다** — 3·4위전이 2023년에 폐지돼
     * 동메달 자체가 없다. 영영 못 채우는 칸은 도감을 거짓말로 만든다.
     * 어느 대회가 동메달을 주는지는 `national.ts`가 단일 소스다 (실제로 겪음).
     */
    entries: Object.values(TOURNAMENTS).flatMap((t) =>
      MEDALS.filter((m) => m !== "동" || HAS_BRONZE_GAME[t.id]).map((m) => ({
        id: `medal:${t.id}:${m}`, name: `${t.short} ${m}메달`,
        hint: `${t.name}에서 ${m}메달`, icon: t.icon,
      }))),
  },
  {
    id: "life", title: "은퇴 후", lead: "유니폼을 벗고 고른 길.",
    entries: SECOND_LIVES.map(([id, icon, name]) => ({
      id: `life:${id}`, name, hint: "은퇴하고 이 길을 고른다", icon,
    })),
  },
  {
    id: "honor", title: "명예", lead: "리그가 오래 기억하는 자리.",
    entries: [
      { id: "honor:hof", name: "명예의 전당", hint: "은퇴 5년 뒤 투표에서 헌액된다", icon: "🏛️" },
      { id: "honor:ring", name: "우승 반지", hint: "한국시리즈 우승", icon: "💍" },
      { id: "honor:mom", name: "이달의 선수", hint: "한 달을 지배한다", icon: "🗓️" },
      { id: "honor:onefranchise", name: "원클럽맨", hint: "한 팀에서만 열 시즌 이상", icon: "🏠" },
    ],
  },
];

export const ALL_ENTRIES = SECTIONS.flatMap((s) => s.entries);
const KNOWN = new Set(ALL_ENTRIES.map((e) => e.id));

/** 그 선수에게 보이는 칸만 — 투수에게 '홈런 군주'를 띄워 두면 영영 못 채울 칸이 된다 */
export const entriesFor = (kind: Kind | null) =>
  ALL_ENTRIES.filter((e) => !e.kind || !kind || e.kind === kind);

/* ------------------------------------------------------------------ */
/* 채워진 칸 — 세이브 하나에서 뽑는다                                     */
/* ------------------------------------------------------------------ */

const kboOf = (s: GameState) => s.seasons.filter((r: SeasonRecord) => r.level === "KBO");

/**
 * 이 커리어가 채운 칸.
 *
 * **얻었다 잃은 능력도 센다** — 도감은 지금 가진 것이 아니라 겪은 것의 기록이다
 * (`철벽 수비`는 24%가 얻고 13%만 들고 은퇴한다).
 */
export function earnedFrom(s: GameState): string[] {
  const got = new Set<string>();
  const add = (id: string) => { if (KNOWN.has(id)) got.add(id); };

  // 특수능력 — 지금 가진 것 + 한 번이라도 얻은 것
  for (const id of s.perks ?? []) add(`perk:${id}`);
  for (const a of ABILITIES) {
    if (s.logs?.some((l) => l.title === `특수능력 획득 — ${a.name}`)) add(`perk:${a.id}`);
  }

  const kbo = kboOf(s);
  let rings = 0;
  const teams: Record<string, number> = {};
  for (const r of kbo) {
    for (const w of r.awards ?? []) add(`award:${w}`);
    for (const m of r.milestones ?? []) {
      // 문구를 그대로 쓰므로 카탈로그와 글자가 같아야 맞는다
      const hit = ALL_ENTRIES.find((e) => e.id.startsWith("mark:") && markLabel(e.id.split(":")[1], Number(e.id.split(":")[2])) === m);
      if (hit) add(hit.id);
    }
    if (r.champion) rings++;
    if (r.potm?.length) add("honor:mom");
    teams[r.teamId] = (teams[r.teamId] ?? 0) + 1;
  }
  if (rings > 0) add("honor:ring");
  if (Math.max(0, ...Object.values(teams)) >= 10) add("honor:onefranchise");

  for (const r of s.intlResults ?? []) if (r.medal) add(`medal:${r.tournamentId}:${r.medal}`);
  const nick = nickname(s);
  if (nick) add(`nick:${nick}`);
  if (s.secondLife) add(`life:${s.secondLife.id}`);
  if (s.hofVote?.inducted) add("honor:hof");

  return [...got];
}

/** 은퇴한 선수 한 줄 — 도감의 "내 역대 선수" */
export interface CareerStamp {
  id: string; name: string; position: string; kind: Kind;
  from: number; to: number; seasons: number; war: number;
  teamId: string; nickname: string | null; hof: boolean;
}
