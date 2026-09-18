import { RNG, clamp } from "./rng";
import { roleTier } from "./roles";
import { ABILITY_LABEL, ABILITY_MAX, abilityKeys, getAb, overall, setAb } from "./player";
import { HITTER_POSITIONS, POSITION_LABEL } from "./player";
import type { ChainPrompt, GameState, LogEntry, Position } from "./types";

type Push = (e: Omit<LogEntry, "year">) => void;

export interface ChainDef {
  key: string;
  /** 한 커리어에 한 번만 */
  once?: boolean;
  weight: number;
  when: (s: GameState) => boolean;
  prompt: (s: GameState) => ChainPrompt;
  /** 선택 직후 효과 */
  apply: (s: GameState, choice: string, rng: RNG, log: Push) => void;
  /** 결과가 나오기까지 걸리는 시즌 수 */
  dueIn: number;
  /** 결과 처리 */
  resolve: (s: GameState, choice: string, rng: RNG, log: Push) => void;
}

const lastKbo = (s: GameState) => [...s.seasons].reverse().find((r) => r.level === "KBO");
const bump = (s: GameState, k: string, v: number) =>
  setAb(s.player.abilities, k as never, clamp(getAb(s.player.abilities, k as never) + v, 10, ABILITY_MAX));

/* ------------------------------------------------------------------ */
/* 1. 첫 1군 콜업 — 어떤 자세로 자리를 잡을 것인가                       */
/* ------------------------------------------------------------------ */

const firstCallup: ChainDef = {
  key: "FIRST_CALLUP", once: true, weight: 100, dueIn: 1,
  when: (s) => s.seasons.filter((r) => r.level === "KBO").length === 1,
  prompt: (s) => ({
    key: "FIRST_CALLUP", icon: "🚪",
    title: "첫 1군 시즌을 마치고",
    body: `${s.player.name} 선수가 처음으로 1군 무대를 밟았습니다. 다음 시즌을 어떻게 준비할지 정하세요.`,
    options: [
      { id: "aggressive", label: "주전 자리를 노린다", desc: "경쟁에 정면으로 부딪힌다. 성공하면 단숨에 자리를 잡지만, 밀리면 2군으로 내려간다.", risky: true },
      { id: "steady", label: "차분히 배운다", desc: "선배들을 보며 기본기를 다진다. 극적이진 않아도 흔들리지 않는다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "aggressive") {
      s.trust = clamp(s.trust + 4, 0, 100);
      s.player.condition = clamp(s.player.condition - 8, 25, 100);
      log({ icon: "🔥", title: "주전 경쟁 선언", tone: "neutral", body: "코칭스태프에게 자리를 달라고 요구했습니다. 이제 결과로 보여줘야 합니다." });
    } else {
      s.teammate = clamp(s.teammate + 6, 0, 100);
      bump(s, "mental", rng.int(2, 5));
      log({ icon: "📘", title: "배우는 자세", tone: "good", body: "선배들에게 묻고 배우며 한 시즌을 준비합니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    const rec = lastKbo(s);
    const war = rec?.line.war ?? 0;
    const ok = choice === "aggressive" ? war >= 1.5 : war >= 0.8;
    if (choice === "aggressive") {
      if (ok) {
        s.trust = clamp(s.trust + 10, 0, 100);
        for (const k of abilityKeys(s.player.kind).slice(0, 2)) bump(s, k, rng.int(2, 5));
        log({ icon: "🏅", title: "첫 콜업 체인 정착", tone: "epic", body: "요구한 자리를 실제 출장으로 증명했습니다. 팀 안에서 입지가 단단해졌습니다." });
      } else {
        s.trust = clamp(s.trust - 12, 0, 100);
        s.player.condition = clamp(s.player.condition - 10, 25, 100);
        log({ icon: "🪫", title: "첫 콜업 체인 재도전", tone: "bad", body: "큰소리를 쳤지만 결과가 따라오지 않았습니다. 다시 기회를 기다립니다." });
      }
    } else {
      if (ok) {
        bump(s, "mental", rng.int(3, 6));
        s.teammate = clamp(s.teammate + 6, 0, 100);
        log({ icon: "📗", title: "차분한 정착", tone: "good", body: "튀지는 않았지만 확실하게 1군에 뿌리를 내렸습니다." });
      } else {
        log({ icon: "⏳", title: "아직은 준비 기간", tone: "neutral", body: "조급해하지 않고 한 시즌 더 준비합니다." });
      }
    }
  },
};

/* ------------------------------------------------------------------ */
/* 2. 부상 복귀 계획                                                    */
/* ------------------------------------------------------------------ */

const injuryReturn: ChainDef = {
  key: "INJURY_RETURN", weight: 90, dueIn: 1,
  when: (s) => {
    const rec = s.seasons[s.seasons.length - 1];
    return !!rec?.note?.includes("심각") || (s.seasonAvailability <= 0.62 && !!rec?.note);
  },
  prompt: (s) => ({
    key: "INJURY_RETURN", icon: "🏥",
    title: "재활 계획",
    body: `큰 부상으로 시즌 상당 기간을 날렸습니다. ${s.player.name} 선수의 복귀 방식을 정하세요.`,
    options: [
      { id: "rush", label: "개막에 맞춰 복귀한다", desc: "재활을 앞당겨 개막전부터 뛴다. 몸이 덜 회복된 채로 시즌을 시작한다.", risky: true },
      { id: "full", label: "완전히 회복하고 돌아온다", desc: "시즌 초반을 포기하더라도 몸을 확실히 만든다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "rush") {
      s.nextSeasonAvailability = 1;
      bump(s, "durability", -rng.int(2, 5));
      log({ icon: "⏩", title: "조기 복귀", tone: "neutral", body: "재활을 앞당겼습니다. 개막부터 뛰지만 몸에 무리가 남아 있습니다." });
    } else {
      s.nextSeasonAvailability = 0.75;
      bump(s, "durability", rng.int(2, 5));
      s.player.condition = clamp(s.player.condition + 15, 25, 100);
      log({ icon: "🧘", title: "완전 회복 우선", tone: "good", body: "시즌 초반을 재활에 쓰기로 했습니다. 대신 몸 상태는 확실해집니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "rush") {
      if (rng.chance(0.45)) {
        bump(s, "durability", -rng.int(3, 7));
        s.player.condition = clamp(s.player.condition - 18, 25, 100);
        log({ icon: "💢", title: "부상 재발", tone: "bad", body: "무리한 복귀의 대가를 치렀습니다. 같은 부위가 다시 말썽입니다." });
      } else {
        log({ icon: "💪", title: "복귀 성공", tone: "good", body: "조기 복귀가 통했습니다. 잃어버린 시간을 되찾았습니다." });
      }
    } else {
      bump(s, "durability", rng.int(2, 6));
      log({ icon: "🩹", title: "몸을 되찾다", tone: "good", body: "서두르지 않은 덕에 몸이 예전으로 돌아왔습니다." });
    }
    s.nextSeasonAvailability = 1;
  },
};

/* ------------------------------------------------------------------ */
/* 3. 포지션 전환                                                       */
/* ------------------------------------------------------------------ */

/** 수비 부담이 가벼워지는 순서 */
/**
 * 수비 스펙트럼 — 부담이 큰 자리에서 작은 자리로 한 칸씩 내려간다.
 * 실제 순서는 C → SS → 2B·3B·CF → LF·RF → 1B → DH다.
 *
 * **포수는 넣지 않는다.** 안방은 아무나 볼 수 없어서, 수비가 떨어져도
 * 방망이가 되는 한 계속 마스크를 쓴다 — 실제로도 포수는 웬만해선 안 옮긴다.
 */
const HITTER_SHIFT: Partial<Record<Position, Position | Position[]>> = {
  SS: "3B", "2B": "1B", "3B": "1B", CF: ["LF", "RF"], LF: "DH", RF: "DH", "1B": "DH",
};
const shiftTo = (pos: Position, rng: RNG): Position | null => {
  const to = HITTER_SHIFT[pos];
  if (!to) return null;
  return Array.isArray(to) ? rng.pick(to) : to;
};

const positionChange: ChainDef = {
  key: "POSITION_CHANGE", weight: 85, dueIn: 1,
  when: (s) => {
    const p = s.player;
    if (p.kind === "PITCHER") return p.position === "SP" && p.age >= 31 && overall(p) < 78;
    if (!HITTER_SHIFT[p.position]) return false;
    const def = getAb(p.abilities, "defense" as never);
    const spd = getAb(p.abilities, "speed" as never);
    return p.age >= 30 && (def < 70 || spd < 65);
  },
  prompt: (s) => {
    const p = s.player;
    const nextPos = p.kind === "HITTER" ? shiftTo(p.position, new RNG(s.seed + p.age)) : null;
    const to = p.kind === "PITCHER" ? (closerFit(p) ? "마무리" : "불펜") : POSITION_LABEL[nextPos!];
    const from = p.kind === "PITCHER" ? "선발" : POSITION_LABEL[p.position];
    return {
      key: "POSITION_CHANGE", icon: "🔄",
      title: `${from} → ${to} 전환 제안`,
      body: p.kind === "PITCHER"
        ? `구단이 선발 대신 ${to}(으)로 뛰는 안을 제시했습니다. 이닝은 줄지만 몸에 무리가 덜합니다.`
        : `수비 범위가 예전 같지 않습니다. 구단이 ${to}(으)로 옮기는 안을 제시했습니다.`,
      options: [
        { id: "accept", label: `${to}(으)로 옮긴다`, desc: "수비 부담이 줄어 방망이·구위에 집중할 수 있습니다. 대신 포지션 가치는 낮아집니다." },
        { id: "refuse", label: `${from} 자리를 지킨다`, desc: "익숙한 자리를 고수합니다. 수비가 버텨준다면 더 높은 평가를 받습니다.", risky: true },
      ],
    };
  },
  apply: (s, choice, rng, log) => {
    const p = s.player;
    if (choice === "accept") {
      if (p.kind === "PITCHER") {
        // 구위가 남아 있으면 뒷문으로 간다 — 긴 이닝이 안 될 뿐 한 이닝은 여전히 세다
        const toCp = closerFit(p);
        p.position = toCp ? "CP" : "RP";
        log({
          icon: "🔄", title: toCp ? "마무리 전환" : "불펜 전환", tone: "neutral",
          body: toCp
            ? "선발 로테이션을 떠나 9회를 맡습니다. 한 이닝이면 아직 누구보다 셉니다."
            : "선발 로테이션을 떠나 불펜으로 자리를 옮깁니다.",
        });
      } else {
        const to = shiftTo(p.position, rng) ?? p.position;
        p.position = to;
        log({ icon: "🔄", title: "포지션 전환", tone: "neutral", body: `${POSITION_LABEL[to]}(으)로 자리를 옮깁니다. 수비 부담이 줄었습니다.` });
      }
      s.player.condition = clamp(s.player.condition + 8, 25, 100);
      s.trust = clamp(s.trust + 5, 0, 100);
    } else {
      s.trust = clamp(s.trust - 6, 0, 100);
      log({ icon: "🛡️", title: "자리를 지키다", tone: "neutral", body: "익숙한 포지션을 고수하기로 했습니다. 이제 수비로 증명해야 합니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "accept") {
      for (const k of (s.player.kind === "HITTER" ? ["contact", "power"] : ["velocity", "breaking"])) {
        bump(s, k, rng.int(2, 5));
      }
      log({ icon: "✅", title: "새 자리 적응 완료", tone: "good", body: "수비 부담을 덜자 공격에 집중할 여유가 생겼습니다." });
    } else {
      const def = getAb(s.player.abilities, (s.player.kind === "HITTER" ? "defense" : "stamina") as never);
      if (def >= 72 && rng.chance(0.55)) {
        s.trust = clamp(s.trust + 10, 0, 100);
        log({ icon: "🧱", title: "끝까지 버티다", tone: "good", body: "우려를 잠재우고 자리를 지켜냈습니다." });
      } else {
        bump(s, s.player.kind === "HITTER" ? "defense" : "stamina", -rng.int(3, 6));
        s.trust = clamp(s.trust - 8, 0, 100);
        log({ icon: "📉", title: "결국 밀려나다", tone: "bad", body: "수비에서 문제가 반복됐습니다. 다음엔 선택의 여지가 없을지도 모릅니다." });
      }
    }
  },
};

/* ------------------------------------------------------------------ */
/* 4. 커리어 전환점 — 두 시즌 연속 부진                                  */
/* ------------------------------------------------------------------ */

const turningPoint: ChainDef = {
  key: "TURNING_POINT", weight: 70, dueIn: 1,
  when: (s) => {
    const kbo = s.seasons.filter((r) => r.level === "KBO").slice(-2);
    return kbo.length === 2 && kbo.every((r) => r.line.war < 0.8) && s.player.age >= 26;
  },
  prompt: () => ({
    key: "TURNING_POINT", icon: "🌫️",
    title: "커리어의 전환점",
    body: "두 시즌 연속 기대에 못 미쳤습니다. 무언가 바꿔야 할 시점입니다.",
    options: [
      { id: "rebuild", label: "타격폼/투구폼을 뜯어고친다", desc: "익숙한 것을 버리고 처음부터 다시 만든다. 성공하면 완전히 달라진다.", risky: true },
      { id: "trust", label: "하던 대로 밀고 간다", desc: "흔들리지 않고 해오던 것을 반복한다. 큰 변화는 없다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "rebuild") {
      const keys = abilityKeys(s.player.kind).slice(0, 3);
      for (const k of keys) bump(s, k, -rng.int(2, 5));
      log({ icon: "🔨", title: "폼 개조 착수", tone: "neutral", body: "익숙한 감각을 버렸습니다. 당장은 더 나빠질 수도 있습니다." });
    } else {
      bump(s, "mental", rng.int(2, 4));
      log({ icon: "🧭", title: "하던 대로", tone: "neutral", body: "흔들리지 않고 자기 야구를 이어갑니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "rebuild") {
      if (rng.chance(0.5)) {
        const keys = abilityKeys(s.player.kind).slice(0, 3);
        for (const k of keys) {
          bump(s, k, rng.int(5, 10));
          setAb(s.player.potential, k as never, clamp(getAb(s.player.potential, k as never) + rng.int(2, 6), 0, ABILITY_MAX));
        }
        s.player.fame = clamp(s.player.fame + 8, 0, 100);
        log({ icon: "🦋", title: "개조 성공", tone: "epic", body: "완전히 다른 선수가 됐습니다. 잃었던 것을 되찾고 그 이상을 얻었습니다." });
      } else {
        log({ icon: "🌀", title: "개조 실패", tone: "bad", body: "결국 원래 감각도, 새 감각도 잡지 못했습니다." });
      }
    } else {
      const rec = lastKbo(s);
      if ((rec?.line.war ?? 0) >= 1.5) {
        log({ icon: "🌤️", title: "반등", tone: "good", body: "묵묵히 버틴 끝에 다시 올라왔습니다." });
        s.trust = clamp(s.trust + 8, 0, 100);
      } else {
        log({ icon: "🌫️", title: "긴 터널", tone: "bad", body: "부진이 이어집니다. 시간이 많지 않습니다." });
      }
    }
  },
};



/** 이번 오프시즌에 발생할 이벤트를 고른다 */
export function pickChain(s: GameState, rng: RNG): ChainDef | null {
  const pool = CHAINS.filter((c) => {
    if (c.once && s.seenEvents.includes(c.key)) return false;
    if (s.chains.some((p) => p.key === c.key)) return false;
    return c.when(s);
  });
  if (!pool.length) return null;
  return rng.weighted(pool, pool.map((c) => c.weight));
}

export { HITTER_POSITIONS, ABILITY_LABEL };

/* ------------------------------------------------------------------ */
/* 5~11. 커리어 중반에 한 번씩 찾아오는 갈림길                           */
/* ------------------------------------------------------------------ */

/**
 * 이벤트를 늘리는 이유.
 *
 * 체인이 넷뿐이라 열여섯 시즌을 치러도 서로 다른 이벤트를 세 종류밖에
 * 보지 못했다. 같은 장면이 반복되면 "이번엔 또 뭐가 나올까"가 사라진다.
 * 새 체인은 전부 **지금 이 선수에게만 걸리는 조건**을 가진다 —
 * 아무에게나 뜨면 그것도 결국 배경이 된다.
 */

/** 5. 새 구종 — 투수만, 성장기에 */
const newPitch: ChainDef = {
  key: "NEW_PITCH", once: true, weight: 70, dueIn: 1,
  when: (s) => s.player.kind === "PITCHER" && s.player.age >= 23 && s.player.age <= 30
    && s.seasons.filter((r) => r.level === "KBO").length >= 2,
  prompt: () => ({
    key: "NEW_PITCH", icon: "🌀",
    title: "새 구종을 배울 것인가",
    body: "투수코치가 새 변화구를 권합니다. 손에 붙기까지 한 시즌은 헤맬 각오를 해야 합니다.",
    options: [
      { id: "learn", label: "새 구종을 익힌다", desc: "당장은 제구가 흔들리지만, 붙으면 상대가 노리기 어려워진다.", risky: true },
      { id: "sharpen", label: "쓰던 공을 벼린다", desc: "가진 무기를 더 날카롭게. 확실하지만 한계도 분명하다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "learn") {
      bump(s, "control", -rng.int(2, 5));
      log({ icon: "🌀", title: "새 구종 연습", tone: "neutral", body: "캠프 내내 새 그립을 잡았습니다. 아직 원하는 곳에 가지 않습니다." });
    } else {
      bump(s, "control", rng.int(1, 3));
      log({ icon: "🎯", title: "주무기를 벼린다", tone: "good", body: "쓰던 공의 완성도를 끌어올렸습니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "learn") {
      if (rng.chance(0.62)) {
        bump(s, "breaking", rng.int(4, 9));
        bump(s, "movement", rng.int(2, 5));
        log({ icon: "✨", title: "새 구종이 손에 붙었다", tone: "epic", body: "타자들이 아직 이 공을 보지 못했습니다. 무기가 하나 늘었습니다." });
      } else {
        bump(s, "breaking", rng.int(1, 3));
        log({ icon: "🌫️", title: "끝내 손에 붙지 않았다", tone: "bad", body: "한 시즌을 썼지만 결국 경기에서 쓰지 못했습니다." });
      }
    } else {
      bump(s, "velocity", rng.int(1, 4));
      bump(s, "control", rng.int(2, 4));
      log({ icon: "🎯", title: "무기가 더 날카로워졌다", tone: "good", body: "같은 공인데 타자들이 더 어려워합니다." });
    }
  },
};

/** 6. 타격폼 수정 — 타자만, 부진한 시즌 뒤 */
const swingChange: ChainDef = {
  key: "SWING_CHANGE", once: true, weight: 70, dueIn: 1,
  when: (s) => {
    const rec = lastKbo(s);
    return s.player.kind === "HITTER" && !!rec && rec.line.war < 1.5
      && s.player.age >= 24 && s.player.age <= 33;
  },
  prompt: () => ({
    key: "SWING_CHANGE", icon: "🪓",
    title: "타격폼을 손볼 것인가",
    body: "부진한 한 해였습니다. 타격코치가 폼 수정을 제안합니다 — 몸에 익기까지는 시간이 걸립니다.",
    options: [
      { id: "rebuild", label: "폼을 갈아엎는다", desc: "감각을 처음부터 다시 만든다. 자리를 잡으면 한 단계 올라선다.", risky: true },
      { id: "trust", label: "하던 대로 간다", desc: "슬럼프는 지나간다. 흔들리지 않는 것도 실력이다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "rebuild") {
      bump(s, "contact", -rng.int(2, 6));
      s.player.condition = clamp(s.player.condition - 5, 25, 100);
      log({ icon: "🪓", title: "타격폼 재조정", tone: "neutral", body: "익숙한 감각을 버렸습니다. 당분간은 헛스윙이 늘어납니다." });
    } else {
      bump(s, "mental", rng.int(2, 4));
      log({ icon: "🧘", title: "하던 대로", tone: "neutral", body: "폼을 건드리지 않고 반복에 기댔습니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "rebuild") {
      if (rng.chance(0.58)) {
        bump(s, "power", rng.int(3, 8));
        bump(s, "contact", rng.int(3, 7));
        log({ icon: "💥", title: "새 폼이 자리 잡았다", tone: "epic", body: "타구질이 달라졌습니다. 고생한 한 해가 값을 했습니다." });
      } else {
        bump(s, "contact", -rng.int(1, 3));
        log({ icon: "🌫️", title: "예전 감각을 잃었다", tone: "bad", body: "새 폼도, 옛 폼도 아닌 채로 한 해가 갔습니다." });
      }
    } else {
      bump(s, "mental", rng.int(2, 5));
      log({ icon: "🧘", title: "흔들리지 않았다", tone: "good", body: "폼을 지킨 채 감각이 돌아왔습니다." });
    }
  },
};

/** 7. 주장 완장 — 자리를 잡은 베테랑에게 */
const captaincy: ChainDef = {
  key: "CAPTAINCY", once: true, weight: 75, dueIn: 1,
  when: (s) => s.player.age >= 29 && s.trust >= 55 && roleTierOf(s) >= 3
    && s.seasons.filter((r) => r.level === "KBO").length >= 5,
  prompt: () => ({
    key: "CAPTAINCY", icon: "🅲",
    title: "주장을 맡아달라고 한다",
    body: "구단이 주장 완장을 제안했습니다. 팀을 짊어지는 자리이자, 내 기록을 내줄 수도 있는 자리입니다.",
    options: [
      { id: "accept", label: "완장을 찬다", desc: "라커룸을 챙기고 구단의 신뢰를 얻는다. 대신 내 준비에 쓸 시간이 줄어든다." },
      { id: "decline", label: "정중히 사양한다", desc: "내 몫에 집중한다. 성적으로 말하는 것도 한 방법이다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "accept") {
      s.trust = clamp(s.trust + 12, 0, 100);
      s.teammate = clamp(s.teammate + 12, 0, 100);
      s.player.condition = clamp(s.player.condition - 6, 25, 100);
      log({ icon: "🅲", title: "주장 선임", tone: "good", body: "올 시즌부터 완장을 찹니다. 라커룸이 내 책임이 되었습니다." });
    } else {
      s.trust = clamp(s.trust - 4, 0, 100);
      bump(s, "mental", rng.int(1, 3));
      log({ icon: "🙇", title: "주장직 고사", tone: "neutral", body: "완장 대신 내 기록으로 보여주기로 했습니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "accept") {
      bump(s, "mental", rng.int(3, 7));
      s.teammate = clamp(s.teammate + 6, 0, 100);
      const rec = lastKbo(s);
      if ((rec?.line.war ?? 0) >= 2.5) {
        s.trust = clamp(s.trust + 8, 0, 100);
        log({ icon: "👑", title: "완장이 무겁지 않았다", tone: "epic", body: "팀도 챙기고 성적도 지켰습니다. 구단 안에서 위치가 달라졌습니다." });
      } else {
        log({ icon: "🫱", title: "팀을 먼저 챙긴 한 해", tone: "neutral", body: "내 기록은 줄었지만 라커룸은 단단해졌습니다." });
      }
    } else {
      log({ icon: "📈", title: "내 몫에 집중했다", tone: "neutral", body: "완장 없이 한 시즌을 보냈습니다." });
    }
  },
};

/** 8. 광고 제안 — 이름이 알려진 선수에게 */
const endorsement: ChainDef = {
  key: "ENDORSEMENT", once: true, weight: 60, dueIn: 1,
  when: (s) => s.player.fame >= 68 && s.player.age <= 34
    && s.seasons.filter((r) => r.level === "KBO").length >= 3,
  prompt: () => ({
    key: "ENDORSEMENT", icon: "📺",
    title: "광고 촬영 제안",
    body: "전국 방송 광고 제안이 들어왔습니다. 비시즌 일정이 빡빡해집니다.",
    options: [
      { id: "take", label: "찍는다", desc: "이름이 크게 알려진다. 다만 겨울 훈련 시간을 내줘야 한다." },
      { id: "skip", label: "야구에만 집중한다", desc: "카메라 앞 대신 훈련장에 남는다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "take") {
      s.player.fame = clamp(s.player.fame + rng.int(6, 12), 0, 100);
      s.player.condition = clamp(s.player.condition - 7, 25, 100);
      log({ icon: "📺", title: "광고 촬영", tone: "good", body: "전국에 얼굴이 걸렸습니다. 겨울이 짧아졌습니다." });
    } else {
      log({ icon: "🏋️", title: "제안 고사", tone: "neutral", body: "카메라 대신 훈련장을 택했습니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "take") {
      const rec = lastKbo(s);
      if ((rec?.line.war ?? 0) < 1.5) {
        s.player.fame = clamp(s.player.fame - rng.int(4, 9), 0, 100);
        log({ icon: "📉", title: "\"광고만 찍는다\"", tone: "bad", body: "성적이 따라주지 않자 시선이 싸늘해졌습니다." });
      } else {
        log({ icon: "🌟", title: "얼굴이 된 선수", tone: "good", body: "성적도 지켰습니다. 리그의 간판으로 불립니다." });
      }
    } else {
      for (const k of abilityKeys(s.player.kind).slice(0, 2)) bump(s, k, rng.int(1, 4));
      log({ icon: "🏋️", title: "겨울을 통째로 썼다", tone: "good", body: "조용한 비시즌이 몸에 남았습니다." });
    }
  },
};

/** 9. 후배 지도 — 노장에게 */
const mentoring: ChainDef = {
  key: "MENTORING", once: true, weight: 65, dueIn: 1,
  when: (s) => s.player.age >= 33 && s.seasons.filter((r) => r.level === "KBO").length >= 8,
  prompt: () => ({
    key: "MENTORING", icon: "🧑‍🏫",
    title: "신인이 따라다닌다",
    body: "구단이 지명한 신인이 계속 묻습니다. 내 준비 시간을 나눠 써야 합니다.",
    options: [
      { id: "teach", label: "데리고 다닌다", desc: "가진 걸 전부 알려준다. 은퇴 뒤의 길이 열릴지도 모른다." },
      { id: "focus", label: "내 준비가 먼저다", desc: "한 시즌이라도 더 뛰려면 지금은 나부터다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "teach") {
      s.teammate = clamp(s.teammate + 14, 0, 100);
      s.trust = clamp(s.trust + 6, 0, 100);
      log({ icon: "🧑‍🏫", title: "후배를 맡다", tone: "good", body: "훈련이 끝나도 한참을 남아 설명했습니다." });
    } else {
      bump(s, "durability", rng.int(1, 3));
      log({ icon: "⏱️", title: "내 준비가 먼저", tone: "neutral", body: "남는 시간을 전부 몸에 썼습니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "teach") {
      bump(s, "mental", rng.int(2, 5));
      s.player.fame = clamp(s.player.fame + rng.int(2, 5), 0, 100);
      log({ icon: "🌱", title: "그 신인이 자리를 잡았다", tone: "good", body: "1군에 정착했습니다. 구단이 내 몫으로 쳐줍니다." });
    } else {
      bump(s, "durability", rng.int(1, 3));
      log({ icon: "🦾", title: "한 해를 더 벌었다", tone: "good", body: "몸에 쓴 시간이 그대로 남았습니다." });
    }
  },
};

/** 10. 슬럼프 — 잘하던 선수가 갑자기 */
const slumpTalk: ChainDef = {
  key: "SLUMP_TALK", weight: 80, dueIn: 1,
  when: (s) => {
    const kbo = s.seasons.filter((r) => r.level === "KBO");
    if (kbo.length < 4) return false;
    const last = kbo[kbo.length - 1], prev = kbo[kbo.length - 2];
    return last.line.war < prev.line.war - 2.2 && last.line.war < 1.2;
  },
  prompt: () => ({
    key: "SLUMP_TALK", icon: "🌧️",
    title: "무너진 한 해",
    body: "작년과 같은 선수가 아니라는 말이 나옵니다. 스스로도 이유를 모르겠습니다.",
    options: [
      { id: "data", label: "데이터를 뜯어본다", desc: "영상과 수치로 원인을 찾는다. 시간이 걸리지만 근거가 남는다." },
      { id: "rest", label: "야구를 잠시 놓는다", desc: "머리를 비운다. 돌아왔을 때 몸이 가벼울 수도, 감각이 사라질 수도 있다.", risky: true },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "data") {
      bump(s, "mental", rng.int(1, 3));
      log({ icon: "📊", title: "원인을 찾는다", tone: "neutral", body: "겨울 내내 영상을 돌려봤습니다." });
    } else {
      s.player.condition = clamp(s.player.condition + 14, 25, 100);
      log({ icon: "🌴", title: "잠시 내려놓다", tone: "neutral", body: "배트를 두 달 잡지 않았습니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "data") {
      if (rng.chance(0.66)) {
        for (const k of abilityKeys(s.player.kind).slice(0, 2)) bump(s, k, rng.int(2, 5));
        log({ icon: "💡", title: "원인을 찾았다", tone: "good", body: "무엇이 어긋났는지 알아냈습니다. 고치는 데는 오래 걸리지 않았습니다." });
      } else {
        log({ icon: "🌫️", title: "끝내 답을 못 찾았다", tone: "bad", body: "숫자를 아무리 봐도 답이 나오지 않았습니다." });
      }
    } else {
      if (rng.chance(0.5)) {
        s.player.condition = clamp(s.player.condition + 8, 25, 100);
        bump(s, "mental", rng.int(3, 6));
        log({ icon: "🌤️", title: "머리가 맑아졌다", tone: "good", body: "쉬고 나니 공이 다시 보이기 시작했습니다." });
      } else {
        for (const k of abilityKeys(s.player.kind).slice(0, 1)) bump(s, k, -rng.int(2, 5));
        log({ icon: "🌧️", title: "감각이 돌아오지 않았다", tone: "bad", body: "쉬는 동안 손에서 감이 빠져나갔습니다." });
      }
    }
  },
};

/** 11. 해외 진출 타진 — 전성기의 간판에게 */
const overseasLook: ChainDef = {
  key: "OVERSEAS_LOOK", once: true, weight: 55, dueIn: 1,
  when: (s) => {
    const rec = lastKbo(s);
    return !!rec && rec.line.war >= 4.5 && s.player.age >= 26 && s.player.age <= 31;
  },
  prompt: () => ({
    key: "OVERSEAS_LOOK", icon: "✈️",
    title: "해외 구단의 눈",
    body: "해외 구단 스카우트가 경기를 보러 왔습니다. 당장 갈 수 있는 건 아니지만, 보는 눈이 늘었습니다.",
    options: [
      { id: "aim", label: "보여주겠다고 마음먹는다", desc: "더 크게 휘두르고 더 세게 던진다. 눈에 띄지만 몸에 무리가 간다.", risky: true },
      { id: "ignore", label: "여기에 집중한다", desc: "지금 팀에서 할 일이 남았다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice === "aim") {
      s.player.fame = clamp(s.player.fame + rng.int(4, 8), 0, 100);
      s.player.condition = clamp(s.player.condition - 9, 25, 100);
      log({ icon: "✈️", title: "쇼케이스", tone: "neutral", body: "한 경기 한 경기가 시험이 되었습니다." });
    } else {
      s.trust = clamp(s.trust + 8, 0, 100);
      log({ icon: "🏠", title: "여기에 집중", tone: "good", body: "구단이 그 태도를 반겼습니다." });
    }
  },
  resolve: (s, choice, rng, log) => {
    if (choice === "aim") {
      const rec = lastKbo(s);
      if ((rec?.line.war ?? 0) >= 4) {
        s.player.fame = clamp(s.player.fame + rng.int(6, 12), 0, 100);
        log({ icon: "🌏", title: "이름이 바다를 건넜다", tone: "epic", body: "해외 매체에 이름이 실렸습니다. 몸값이 달라집니다." });
      } else {
        bump(s, "durability", -rng.int(2, 5));
        log({ icon: "🥀", title: "무리가 남았다", tone: "bad", body: "보여주려다 몸만 상했습니다." });
      }
    } else {
      bump(s, "mental", rng.int(2, 4));
      log({ icon: "🏠", title: "흔들리지 않았다", tone: "good", body: "한눈팔지 않고 한 시즌을 마쳤습니다." });
    }
  },
};

/** 보직 티어 — roles.ts의 단일 소스를 쓴다 (문자열 비교 금지) */
function roleTierOf(s: GameState): number {
  const rec = [...s.seasons].reverse().find((r) => r.level === "KBO");
  return roleTier(rec?.role ?? "");
}

/**
 * 12. 발을 살리는 전환 — 수비 스펙트럼을 거슬러 올라간다
 *
 * 수비 부담은 보통 줄어드는 쪽으로만 간다. 하지만 **발이 빠른 젊은 선수**는
 * 반대로 올라간다 — 1루나 코너 외야에 묶어두기 아까운 주력이면
 * 구단이 중견수를 맡긴다. 포지션 가치가 올라가 같은 방망이로 더 쳐준다.
 *
 * 이게 없으면 자리는 한 방향으로만 흘러 커리어 내내 내려가기만 한다.
 */
const speedShift: ChainDef = {
  key: "SPEED_SHIFT", weight: 80, dueIn: 1,
  when: (s) => {
    const p = s.player;
    if (p.kind !== "HITTER" || p.age > 28) return false;
    if (!["1B", "DH", "LF", "RF"].includes(p.position)) return false;
    const spd = getAb(p.abilities, "speed" as never);
    const def = getAb(p.abilities, "defense" as never);
    return spd >= 78 && def >= 70 && !!lastKbo(s);
  },
  prompt: (s) => ({
    key: "SPEED_SHIFT", icon: "⚡",
    title: `${POSITION_LABEL[s.player.position]} → 중견수 전환 제안`,
    body: "코너에 묶어두기 아까운 발입니다. 구단이 중견수를 맡기려 합니다.",
    options: [
      { id: "accept", label: "중견수를 맡는다", desc: "수비 부담이 커지는 만큼 같은 방망이로 더 높게 평가받습니다." },
      { id: "refuse", label: "지금 자리를 지킨다", desc: "수비에 힘을 덜 쓰고 방망이에 집중합니다." },
    ],
  }),
  apply: (s, choice, rng, log) => {
    if (choice !== "accept") return;
    s.player.position = "CF";
    s.trust = clamp(s.trust + 4, 0, 100);
    log({ icon: "⚡", title: "중견수 전환", tone: "good", body: "가장 넓은 자리를 맡았습니다. 발이 쓰이는 자리입니다." });
  },
  resolve: (s, choice, rng, log) => {
    if (choice !== "accept") return;
    for (const k of ["defense", "speed"]) bump(s, k, rng.int(2, 5));
    log({ icon: "⚡", title: "외야가 넓어졌다", tone: "good", body: "한 해를 중견수로 보내며 타구 판단이 빨라졌습니다." });
  },
};

/**
 * 12. 보직 전환 — 중간계투에서 위로 올라가는 길
 *
 * 실제 KBO에서 불펜은 **머무는 자리가 아니다.** 긴 이닝을 견디는 몸이면
 * 선발로 돌리고, 짧게 윽박지르는 구위면 뒷문을 맡긴다.
 * 이 길이 없으면 중간계투로 시작한 선수는 평생 중간계투로 끝난다 —
 * 같은 기량인데 통산 WAR이 선발의 절반에 묶인다.
 *
 * 무엇으로 불릴지는 **몸이 정한다** — 유형 이름이 아니라 능력치를 본다
 * (유형은 능력치에서 나오므로 돌아가는 길일 뿐이다).
 */
const roleSwitch: ChainDef = {
  key: "ROLE_SWITCH", weight: 95, dueIn: 1,
  when: (s) => {
    const p = s.player;
    if (p.kind !== "PITCHER" || p.position !== "RP") return false;
    if (p.age > 30 || overall(p) < 68) return false;
    const rec = lastKbo(s);
    if (!rec) return false;
    return starterFit(p) || closerFit(p);
  },
  prompt: (s) => {
    const p = s.player;
    const toSP = starterFit(p) && (!closerFit(p) || getAb(p.abilities, "stamina" as never) >= getAb(p.abilities, "velocity" as never));
    return toSP
      ? {
          key: "ROLE_SWITCH", icon: "🔄",
          title: "선발 전환 제안",
          body: "긴 이닝을 견디는 몸입니다. 구단이 로테이션 한 자리를 제안했습니다.",
          options: [
            { id: "accept", label: "선발로 간다", desc: "이닝이 세 배로 늘고 승수와 평가가 따라옵니다. 대신 한 경기의 무게가 무겁습니다." },
            { id: "refuse", label: "불펜에 남는다", desc: "익숙한 자리를 지킵니다. 짧게 나가는 만큼 몸에 무리가 덜합니다." },
          ],
        }
      : {
          key: "ROLE_SWITCH", icon: "🔒",
          title: "마무리 전환 제안",
          body: "짧게 윽박지르는 구위입니다. 구단이 뒷문을 맡기려 합니다.",
          options: [
            { id: "accept", label: "뒷문을 맡는다", desc: "세이브가 쌓이고 이름이 알려집니다. 대신 한 번 무너지면 그날이 전부 무너집니다." },
            { id: "refuse", label: "지금 자리를 지킨다", desc: "승부처는 앞에서도 옵니다. 부담이 덜한 대신 눈에 덜 띕니다." },
          ],
        };
  },
  apply: (s, choice, rng, log) => {
    const p = s.player;
    if (choice !== "accept") {
      s.trust = clamp(s.trust - 3, 0, 100);
      log({ icon: "🛡️", title: "지금 자리를 지키다", tone: "neutral", body: "익숙한 자리에서 한 해를 더 보내기로 했습니다." });
      return;
    }
    const toSP = starterFit(p) && (!closerFit(p) || getAb(p.abilities, "stamina" as never) >= getAb(p.abilities, "velocity" as never));
    p.position = toSP ? "SP" : "CP";
    s.trust = clamp(s.trust + 4, 0, 100);
    log({
      icon: toSP ? "🔄" : "🔒",
      title: toSP ? "선발 전환" : "마무리 전환",
      tone: "good",
      body: toSP
        ? "불펜을 떠나 로테이션에 들어갑니다. 스프링캠프부터 선발 준비를 합니다."
        : "9회를 맡습니다. 팀이 이기고 있을 때 마운드에 오릅니다.",
    });
  },
  resolve: (s, choice, rng, log) => {
    if (choice !== "accept") return;
    const sp = s.player.position === "SP";
    // 자리를 옮기면 그 자리에 필요한 것이 는다 — 선발은 버티는 힘, 마무리는 담력
    for (const k of sp ? ["stamina", "control"] : ["velocity", "mental"]) bump(s, k, rng.int(2, 5));
    log({
      icon: sp ? "🔄" : "🔒",
      title: sp ? "선발이 몸에 붙었다" : "9회가 몸에 붙었다",
      tone: "good",
      body: sp
        ? "한 해를 로테이션에서 보내며 이닝을 버티는 몸이 됐습니다."
        : "뒷문을 지키는 일에 익숙해졌습니다. 마지막 아웃의 무게를 압니다.",
    });
  },
};

/** 긴 이닝을 견디는 몸인가 */
function starterFit(p: { abilities: unknown }): boolean {
  const ab = (k: string) => getAb((p as { abilities: never }).abilities, k as never);
  return ab("stamina") >= 72 && ab("control") >= 68;
}
/** 짧게 윽박지르는 구위인가 */
function closerFit(p: { abilities: unknown }): boolean {
  const ab = (k: string) => getAb((p as { abilities: never }).abilities, k as never);
  return ab("velocity") >= 78 && ab("mental") >= 70;
}

export const CHAINS: ChainDef[] = [
  firstCallup, injuryReturn, positionChange, roleSwitch, speedShift, turningPoint,
  newPitch, swingChange, captaincy, endorsement, mentoring, slumpTalk, overseasLook,
];
export const chainByKey = (k: string) => CHAINS.find((c) => c.key === k);
