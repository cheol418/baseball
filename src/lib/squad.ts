import { RNG, clamp } from "./rng";
import {
  abilityKeys, grow, makeTrainingOptions, overall, rollCandidate, STYLES,
  HITTER_POSITIONS, PITCHER_POSITIONS, type CreateOptions,
} from "./player";
import { isRotationRole } from "./roles";
import type { Kind, Player, Position } from "./types";

/* ------------------------------------------------------------------ */
/* 우리 팀 — 이름 있는 동료들                                            */
/* ------------------------------------------------------------------ */

/**
 * 왜 필요한가.
 *
 * `teammate`는 0~100 숫자 하나였다. 한 팀에서 열다섯 시즌을 뛰어도
 * **이름 아는 동료가 0명**이었고, 주전 경쟁은 고정된 숫자 문턱(`bar`) 넘기였다.
 * 밀어내야 할 사람이 없으니 자리를 따내도 서사가 없었다.
 *
 * 동기(`rivals.ts`)와 다른 점은 **스쿼드는 해마다 바뀐다**는 것이다 —
 * 베테랑이 은퇴하고, 경쟁자가 FA로 떠나고, 신인이 들어온다.
 * 그래서 "삼 년 뒤면 저 선배가 은퇴하니 그때까지 버틴다"가 생긴다.
 * 내가 이적하면 스쿼드는 통째로 새로 만들어진다.
 */

export type SquadSlot = "rival" | "star" | "veteran" | "peer" | "rookie";

export const SLOT_LABEL: Record<SquadSlot, string> = {
  rival: "자리 경쟁", star: "팀의 간판", veteran: "베테랑", peer: "또래", rookie: "신인",
};

export interface Mate {
  id: string;
  name: string;
  kind: Kind;
  position: Position;
  slot: SquadSlot;
  player: Player;
  /** 합류한 해 */
  since: number;
  /** 떠난 해와 사유 (떠난 뒤에는 목록에서 빠지므로 로그용) */
  gone?: { year: number; why: string };
}

const SURNAMES = [
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
  "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍",
  "전", "고", "문", "손", "배", "백", "허", "남", "심", "노",
];
const GIVEN = [
  "현도", "준영", "시후", "은우", "지후", "유준", "선우", "민성", "하진", "도윤",
  "재혁", "태윤", "경민", "수호", "진우", "성호", "영빈", "강민", "지환", "현석",
  "동하", "병찬", "희수", "종현", "창민", "규현", "성준", "원재", "찬호", "민우",
];

/** 자리마다 몇 살에 들어오고 어느 정도 재능인가 */
const SLOTS: { slot: SquadSlot; age: [number, number]; talent: number; bias: -1 | 0 | 1 }[] = [
  { slot: "rival", age: [24, 31], talent: 1.0, bias: 0 },     // 내 자리를 지키고 있는 사람
  { slot: "rival", age: [21, 26], talent: 0.82, bias: 1 },    // 뒤에서 올라오는 사람
  { slot: "star", age: [26, 32], talent: 1.35, bias: -1 },
  { slot: "veteran", age: [33, 37], talent: 1.0, bias: -1 },
  { slot: "peer", age: [23, 28], talent: 0.95, bias: 0 },
  { slot: "peer", age: [23, 29], talent: 0.88, bias: 0 },
  { slot: "rookie", age: [19, 22], talent: 0.92, bias: 1 },
  { slot: "rookie", age: [19, 21], talent: 0.8, bias: 1 },
];

export const SQUAD_SIZE = SLOTS.length;

function makeName(rng: RNG, used: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const n = SURNAMES[rng.int(0, SURNAMES.length - 1)] + GIVEN[rng.int(0, GIVEN.length - 1)];
    if (!used.has(n)) { used.add(n); return n; }
  }
  return SURNAMES[rng.int(0, SURNAMES.length - 1)] + GIVEN[rng.int(0, GIVEN.length - 1)];
}

/**
 * 내 자리를 두고 다투는 사람인가.
 *
 * 타자는 **같은 포지션**, 투수는 **같은 보직군**(선발 ↔ 불펜)이 경쟁이다.
 * 포수와 중견수는 서로의 자리를 뺏지 않는다.
 */
export function competesWith(me: { kind: Kind; position: Position }, m: Mate): boolean {
  if (m.kind !== me.kind) return false;
  if (me.kind === "HITTER") return m.position === me.position;
  const mineSP = me.position === "SP", theirsSP = m.position === "SP";
  return mineSP === theirsSP;
}

function born(
  rng: RNG, used: Set<string>, slot: SquadSlot, age: number, talent: number,
  bias: -1 | 0 | 1, kind: Kind, position: Position, year: number, idx: number,
): Mate {
  const pool = STYLES.filter((x) => x.kind === kind);
  const style = pool[rng.int(0, pool.length - 1)];
  const opts: CreateOptions = {
    name: makeName(rng, used), number: rng.int(1, 99), kind, position,
    bats: rng.chance(0.3) ? "L" : "R", throws: rng.chance(0.24) ? "L" : "R",
    styleId: style.id, bias,
    armSlot: kind === "PITCHER" ? "THREE_QUARTER" : undefined,
  };
  const p = rollCandidate(opts, rng);
  p.talent = clamp(p.talent * talent, 0.4, 1.6);
  for (const k of abilityKeys(kind)) {
    const cur = (p.potential as unknown as Record<string, number>)[k];
    (p.potential as unknown as Record<string, number>)[k] = clamp(Math.round(cur * (0.82 + talent * 0.18)), 20, 120);
  }
  // 생성은 열여덟 기준이므로, 들어오는 나이까지 키워 놓는다
  p.age = 18;
  const opt = makeTrainingOptions(p, rng);
  for (let a = 18; a < age; a++) {
    p.age += 1;
    grow(p, rng, opt[rng.int(0, opt.length - 1)] ?? null, 1.05);
  }
  /**
   * id는 **해와 순번만으로 만들면 겹친다.**
   * 복무로 밀린 해를 따라잡을 때 `advanceSquad`가 같은 해에 여러 번 돌고,
   * 그때마다 순번이 0부터 다시 센다 (실제로 겪음: id 중복 714건).
   * 난수를 섞어 한 번에 끝낸다.
   */
  const tag = rng.int(0, 46655).toString(36).padStart(3, "0");
  return { id: `m${year}-${idx}-${tag}`, name: opts.name, kind, position, slot, player: p, since: year };
}

/** 내 자리와 겹치게 둘지, 흩뿌릴지 */
function spotFor(rng: RNG, slot: SquadSlot, me: { kind: Kind; position: Position }): { kind: Kind; position: Position } {
  // 경쟁자는 반드시 내 자리를 본다 — 그래야 밀어내는 이야기가 생긴다
  if (slot === "rival") return { kind: me.kind, position: me.position };
  const kind: Kind = rng.chance(0.58) ? "HITTER" : "PITCHER";
  const spots = kind === "HITTER" ? HITTER_POSITIONS : PITCHER_POSITIONS;
  return { kind, position: spots[rng.int(0, spots.length - 1)].id };
}

export function makeSquad(rng: RNG, me: { kind: Kind; position: Position }, year: number): Mate[] {
  const used = new Set<string>();
  return SLOTS.map((s, i) => {
    const spot = spotFor(rng, s.slot, me);
    return born(rng, used, s.slot, rng.int(s.age[0], s.age[1]), s.talent, s.bias, spot.kind, spot.position, year, i);
  });
}

/**
 * 내 자리를 막고 있는 사람의 기량.
 * 여럿이면 가장 센 사람 하나만 본다 — 자리는 하나니까.
 */
export function blockerOf(squad: Mate[] | undefined, me: { kind: Kind; position: Position }): Mate | null {
  const rivals = (squad ?? []).filter((m) => competesWith(me, m));
  if (!rivals.length) return null;
  return rivals.slice().sort((a, b) => overall(b.player) - overall(a.player))[0];
}

/**
 * 자리 경쟁 보정.
 *
 * **`assignRole`의 `bar`가 이미 "평균적인 경쟁"을 품고 있다.**
 * 그래서 내 기량과 경쟁자 기량의 **절대 차이**를 얹으면 같은 것을 두 번 세게 되고,
 * 분포가 통째로 내려간다 (실제로 겪음: 2군 +5.5%p · 보정 평균 −2.1).
 *
 * 재야 할 것은 **"내 경쟁자가 이 팀의 보통 경쟁자보다 센가"** 하나뿐이다.
 * 그러면 평균이 0 근처로 남아 기준선이 지켜지고, 대신 **해마다 달라진다** —
 * 간판이 버티고 있는 해는 밀리고, 그가 FA로 떠난 해는 자리가 난다.
 *
 * `typical`은 `assignRole`의 `bar`와 같은 식이어야 한다. 한쪽만 바꾸면
 * 보정의 중심이 조용히 틀어진다.
 */
export function typicalRival(teamPower: number): number {
  /**
   * `assignRole`의 `bar`는 **1군에 붙는 선**이지 자리를 지키고 있는 사람의
   * 기량이 아니다. 주전은 `bar + 5`, 핵심은 `bar + 11`이다.
   * 실측(`squadsim.ts`) — 내 자리 경쟁자의 OVR 중앙은 80, 하위25% 78.
   * 기준점을 `bar`로 두면 93%의 해가 "보통보다 센 경쟁자"가 되어
   * 보정이 늘 마이너스로 쏠린다 (실제로 겪음: 평균 −2.4).
   */
  return 73 + (teamPower - 65) * 0.2 + 6.2;
}

export function competeAdjust(blockerOvr: number, teamPower: number): number {
  // 경쟁자가 보통보다 세면 −, 약하면 + (자리가 하나뿐이라 밀릴 때가 조금 더 아프다)
  return clamp((typicalRival(teamPower) - blockerOvr) * 0.35, -7, 5);
}

/** 한 해를 먹는다 — 성장·노쇠·은퇴·이탈 */
export function advanceSquad(
  squad: Mate[], rng: RNG, year: number, me: { kind: Kind; position: Position },
): { squad: Mate[]; left: Mate[] } {
  const used = new Set(squad.map((m) => m.name));
  const left: Mate[] = [];
  const kept: Mate[] = [];

  for (const m of squad) {
    m.player.age += 1;
    const opt = makeTrainingOptions(m.player, rng);
    grow(m.player, rng, opt[rng.int(0, opt.length - 1)] ?? null, 1.0);

    const ovr = overall(m.player);
    const age = m.player.age;
    // 은퇴 — 플레이어와 같은 기준선을 쓴다
    const bar = age >= 40 ? 82 : age >= 38 ? 79 : age >= 36 ? 75 : age >= 34 ? 71 : age >= 32 ? 66 : 0;
    if (bar && ovr < bar) { m.gone = { year, why: "은퇴" }; left.push(m); continue; }
    // FA·트레이드로 떠난다 — 잘하는 선수일수록 시장이 부른다
    if (age >= 29 && rng.chance(clamp((ovr - 72) * 0.012, 0.02, 0.16))) {
      m.gone = { year, why: ovr >= 80 ? "FA 이적" : "트레이드" };
      left.push(m); continue;
    }
    kept.push(m);
  }

  /**
   * 빈자리를 채운다 — **안에서 먼저 올린다.**
   *
   * 떠난 자리와 같은 성격으로 새로 만들면, 서른여섯 베테랑이 은퇴할 때마다
   * 또 다른 서른여섯이 어디선가 나타난다. 2년마다 같은 일이 반복되는
   * 러닝머신이 된다 (실제로 겪음: 커리어당 동료 은퇴 14명).
   * 실제 팀은 안에 있던 선수가 그 자리로 **자라 올라간다**.
   */
  let idx = 0;
  for (const g of left) {
    /**
     * 안에서 올린다 — **나이로 막지 않는다.**
     *
     * "스물여섯이 베테랑으로 찍힌다"를 고치려고 여기에 나이 문턱
     * (`veteran` 31세 등)을 걸었더니, 올릴 사람이 없는 해에 승격이
     * 통째로 실패해 **바깥에서 서른다섯이 새로 들어왔다** — 막으려던
     * 러닝머신이 그대로 돌아왔다 (실제로 겪음: 커리어당 은퇴 6.1 → 10.8명).
     *
     * 화면에 찍히는 이름은 `slot`이 아니라 `mateLabel()`이 **나이에서**
     * 끌어오므로, 스물여섯이 `veteran` 자리를 물려받아도 "또래"로 보인다.
     * `slot`은 **자리를 잇는 꼬리표**일 뿐이니 여기서는 나이를 보지 않는다.
     */
    const promote = (from: SquadSlot, to: SquadSlot) => {
      const c = kept.filter((m) => m.slot === from).sort((a, b) => b.player.age - a.player.age)[0];
      if (!c) return false;
      c.slot = to;
      return true;
    };
    // 베테랑 ← 또래 ← 신인 순으로 한 칸씩 당긴다. 바닥(신인)만 밖에서 들어온다
    let need: SquadSlot = g.slot;
    if (need === "veteran" && promote("peer", "veteran")) need = "peer";
    if (need === "peer" && promote("rookie", "peer")) need = "rookie";
    if (need === "star" && promote("peer", "star")) need = "peer";

    const def = SLOTS.find((s) => s.slot === need) ?? SLOTS[SLOTS.length - 1];
    const spot = spotFor(rng, need, me);
    kept.push(born(rng, used, need, rng.int(def.age[0], def.age[1]), def.talent, def.bias, spot.kind, spot.position, year, idx++));
  }
  return { squad: kept, left };
}

/**
 * 화면에 쓸 자리 이름.
 *
 * `slot`은 **만들 때·채울 때 쓰는 꼬리표**지 지금의 모습이 아니다.
 * 신인 자리에 들어온 스무 살이 열 해를 눌러앉으면 서른이 되는데도
 * "신인"으로 찍혔다 (실제로 겪음: 신인 31세). 나이로 보는 셋은 나이에서 끌어온다.
 * 경쟁자·간판은 나이가 아니라 **역할**이라 그대로 둔다.
 */
export function mateLabel(m: Mate): SquadSlot {
  if (m.slot === "rival" || m.slot === "star") return m.slot;
  return m.player.age >= 31 ? "veteran" : m.player.age <= 23 ? "rookie" : "peer";
}

/** 화면에 쓸 한 줄 — 지금 그 선수의 자리 */
export function mateRole(m: Mate): string {
  const ovr = overall(m.player);
  if (m.kind === "PITCHER") {
    if (m.position === "SP") return ovr >= 84 ? "에이스" : ovr >= 76 ? "선발" : ovr >= 68 ? "5선발" : "2군";
    if (m.position === "CP") return ovr >= 76 ? "마무리" : ovr >= 68 ? "필승조" : "2군";
    return ovr >= 78 ? "필승조" : ovr >= 68 ? "불펜" : "2군";
  }
  return ovr >= 86 ? "간판타자" : ovr >= 78 ? "핵심타자" : ovr >= 71 ? "주전" : ovr >= 63 ? "준주전" : "2군";
}

/** 투수 보직군이 바뀌면 경쟁 상대도 바뀐다 — roles.ts를 통해 본다 */
export const sameRoleGroup = (a: string, b: string) => isRotationRole(a) === isRotationRole(b);
