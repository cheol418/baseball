import { RNG, clamp } from "./rng";
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
const HITTER_SHIFT: Partial<Record<Position, Position>> = {
  C: "1B", SS: "3B", "2B": "1B", "3B": "1B", CF: "LF", LF: "DH", RF: "DH", "1B": "DH",
};

const positionChange: ChainDef = {
  key: "POSITION_CHANGE", weight: 85, dueIn: 1,
  when: (s) => {
    const p = s.player;
    if (p.kind === "PITCHER") return p.position === "SP" && p.age >= 31 && overall(p) < 78;
    const nextPos = HITTER_SHIFT[p.position];
    if (!nextPos) return false;
    const def = getAb(p.abilities, "defense" as never);
    const spd = getAb(p.abilities, "speed" as never);
    return p.age >= 30 && (def < 70 || spd < 65);
  },
  prompt: (s) => {
    const p = s.player;
    const to = p.kind === "PITCHER" ? "불펜" : POSITION_LABEL[HITTER_SHIFT[p.position]!];
    const from = p.kind === "PITCHER" ? "선발" : POSITION_LABEL[p.position];
    return {
      key: "POSITION_CHANGE", icon: "🔄",
      title: `${from} → ${to} 전환 제안`,
      body: p.kind === "PITCHER"
        ? "구단이 선발 대신 불펜으로 뛰는 안을 제시했습니다. 이닝은 줄지만 몸에 무리가 덜합니다."
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
        p.position = "RP";
        log({ icon: "🔄", title: "불펜 전환", tone: "neutral", body: "선발 로테이션을 떠나 불펜으로 자리를 옮깁니다." });
      } else {
        const to = HITTER_SHIFT[p.position]!;
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

export const CHAINS: ChainDef[] = [firstCallup, injuryReturn, positionChange, turningPoint];
export const chainByKey = (k: string) => CHAINS.find((c) => c.key === k);

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
