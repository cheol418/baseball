/** 전체 경로 스트레스 테스트 — 예외·정지·이상값 탐지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, STYLES, HITTER_POSITIONS, PITCHER_POSITIONS, ARM_SLOTS } from "../src/lib/player";
import { newGame, advance, computeHof, careerTotals, formatMoney, type Action } from "../src/lib/career";
import { isHitterLine } from "../src/lib/sim";
import type { GameState, Hand, Kind } from "../src/lib/types";

interface Issue { kind: string; detail: string }
const issues: Issue[] = [];
const add = (kind: string, detail: string) => {
  if (issues.filter((i) => i.kind === kind).length < 3) issues.push({ kind, detail });
};

const phaseSeen = new Set<string>();
const actionSeen = new Set<string>();
let crashes = 0, stuck = 0;

function play(seed: number, opt: { college: boolean; military: "SANGMU" | "ACTIVE"; nego: "accept" | "push" | "arbitration"; transfer: number; deferFa: boolean; joinNat: boolean }) {
  const rng = new RNG(seed);
  const kind: Kind = seed % 2 ? "HITTER" : "PITCHER";
  const styles = STYLES.filter((s) => s.kind === kind);
  const positions = kind === "HITTER" ? HITTER_POSITIONS : PITCHER_POSITIONS;
  const p = rollCandidate({
    name: "감사", number: rng.int(0, 99), kind,
    position: rng.pick(positions).id, bats: rng.pick(["R", "L", "S"] as Hand[]),
    throws: rng.pick(["R", "L"] as Hand[]), styleId: rng.pick(styles).id,
    armSlot: kind === "PITCHER" ? rng.pick(ARM_SLOTS).id : undefined,
  }, rng);

  let g: GameState = newGame(p, "DAJ", rng.int(1, 2 ** 30));
  let guard = 0;
  const act = (a: Action) => { actionSeen.add(a.type); g = advance(g, a); };
  let deferred = false;

  while (g.phase !== "RETIRED" && guard++ < 800) {
    phaseSeen.add(g.phase);
    const before = `${g.phase}:${g.year}:${g.player.age}`;
    try {
      switch (g.phase) {
        case "HS_SEASON": case "COLLEGE_SEASON": act({ type: "SIM_AMATEUR" }); break;
        case "PATH_CHOICE":
          act({ type: "CHOOSE_PATH", path: opt.college && g.seasons.filter((x) => x.level === "COLLEGE").length < 2 ? "COLLEGE" : "DRAFT" });
          break;
        case "DRAFT": act({ type: "DO_DRAFT" }); break;
        case "SPRING_CAMP": {
          const o = g.pendingTraining;
          if (!o?.length) { add("훈련 후보 없음", before); act({ type: "RETIRE" }); break; }
          act({ type: "TRAIN", optionId: o[rng.int(0, o.length - 1)].id });
          break;
        }
        case "FIRST_HALF": act({ type: "PLAY_FIRST_HALF" }); break;
        case "ALL_STAR":
          if (g.pendingTrade) act({ type: "TRADE_DECIDE", accept: rng.chance(0.5) });
          else act({ type: "PLAY_SECOND_HALF" });
          break;
        case "POSTSEASON": act({ type: "PLAY_POSTSEASON" }); break;
        case "SEASON_END": act({ type: "FINISH_SEASON" }); break;
        case "INTERNATIONAL": act({ type: "JOIN_NATIONAL", join: opt.joinNat }); break;
        case "MILITARY_CHOICE": act({ type: "ENLIST", option: opt.military }); break;
        case "MILITARY_SEASON": act({ type: "SERVE" }); break;
        case "EVENT": {
          const o = g.pendingEvent!.options;
          act({ type: "CHOOSE_EVENT", optionId: o[rng.int(0, o.length - 1)].id });
          break;
        }
        case "NEGOTIATION": act({ type: "NEGOTIATE", optionId: opt.nego }); break;
        case "STOVE": {
          const t = g.pendingTransfers;
          if (!g.transferRequested && t?.length && rng.next() < opt.transfer) act({ type: "REQUEST_TRANSFER", teamId: t[rng.int(0, t.length - 1)].teamId });
          else act({ type: "SKIP_STOVE" });
          break;
        }
        case "FA":
          if (opt.deferFa && !deferred) { deferred = true; act({ type: "DEFER_FA" }); }
          else act({ type: "ACCEPT_OFFER", teamId: g.pendingOffers![rng.int(0, g.pendingOffers!.length - 1)].teamId });
          break;
        case "RETIRE_CHOICE": act({ type: "RETIRE" }); break;
        default: add("알 수 없는 단계", g.phase); act({ type: "RETIRE" });
      }
    } catch (e) { crashes++; add("예외", `${before} → ${(e as Error).message}`); return g; }
    // 이적 신청은 같은 단계에 머무는 게 정상이다
    if (`${g.phase}:${g.year}:${g.player.age}` === before && g.phase !== "STOVE" && g.phase !== "ALL_STAR") {
      stuck++; add("무한루프", before); return g;
    }
  }
  if (guard >= 800) { stuck++; add("가드 초과", `${g.year} ${g.phase}`); }

  return g;
}

const finals: GameState[] = [];
let i = 0;
for (const college of [false, true])
  for (const military of ["SANGMU", "ACTIVE"] as const)
    for (const nego of ["accept", "push", "arbitration"] as const)
      for (const transfer of [0, 0.4])
        for (const deferFa of [false, true])
          for (const joinNat of [true, false])
            for (let k = 0; k < 3; k++) finals.push(play(5000 + (i++) * 137, { college, military, nego, transfer, deferFa, joinNat }));

// ── 이상값 검사 ──────────────────────────────────────────────
for (const g of finals) {
  const kbo = g.seasons.filter((s) => s.level === "KBO");
  const t = careerTotals(g.seasons, g.player.kind, "KBO") as Record<string, number>;
  if (g.player.age > 45) add("은퇴 나이 과다", `${g.player.age}세`);
  if (kbo.length > 25) add("1군 시즌 과다", `${kbo.length}시즌`);
  const maxSal = Math.max(0, ...g.seasons.map((s) => s.salary));
  if (maxSal > 300000) add("연봉 상한 초과", formatMoney(maxSal));
  for (const s of g.seasons) {
    const l = s.line;
    if (isHitterLine(l)) {
      if (l.avg > 0.45) add("타율 이상", `${s.year} ${l.avg}`);
      if (l.pa > 720) add("타석 과다", `${s.year} ${l.pa}`);
      if (l.h > l.ab) add("안타>타수", `${s.year}`);
    } else {
      if (l.era < 0 || l.era > 15) add("ERA 이상", `${s.year} ${l.era}`);
      if (l.ip > 230) add("이닝 과다", `${s.year} ${l.ip}`);
      if (l.w + l.l > l.g + 2) add("승패>경기", `${s.year}`);
    }
    if (s.salary < 0) add("음수 연봉", `${s.year}`);
  }
  for (const k of ["velocity", "contact", "power", "control"]) {
    const v = (g.player.abilities as unknown as Record<string, number>)[k];
    if (v !== undefined && (v < 0 || v > 120)) add("능력치 범위 이탈", `${k}=${v}`);
  }
  if (overall(g.player) > 120) add("OVR 범위 이탈", String(overall(g.player)));
  if (g.serviceYears < 0) add("음수 서비스타임", String(g.serviceYears));
  void t;
}

const allPhases = ["EVENT","HS_SEASON","PATH_CHOICE","COLLEGE_SEASON","DRAFT","SPRING_CAMP","FIRST_HALF","ALL_STAR","POSTSEASON","SEASON_END","INTERNATIONAL","MILITARY_CHOICE","MILITARY_SEASON","NEGOTIATION","STOVE","FA","RETIRE_CHOICE","RETIRED"];
const allActions = ["TRADE_DECIDE","CHOOSE_EVENT","SIM_AMATEUR","CHOOSE_PATH","DO_DRAFT","TRAIN","PLAY_FIRST_HALF","PLAY_SECOND_HALF","PLAY_POSTSEASON","FINISH_SEASON","JOIN_NATIONAL","ENLIST","SERVE","NEGOTIATE","REQUEST_TRANSFER","VOLUNTEER_ARMY","SKIP_STOVE","ACCEPT_OFFER","DEFER_FA","RETIRE"];

console.log(`■ 스트레스 테스트 — 커리어 ${finals.length}개, 예외 ${crashes}, 정지 ${stuck}\n`);
console.log(`  거치지 않은 단계: ${allPhases.filter((p) => !phaseSeen.has(p) && p !== "RETIRED").join(", ") || "없음"}`);
console.log(`  호출되지 않은 액션: ${allActions.filter((a) => !actionSeen.has(a)).join(", ") || "없음"}`);

const hof = finals.map((g) => computeHof(g));
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`\n  은퇴 나이 ${avg(finals.map((g) => g.player.age))} · 1군 ${avg(hof.map((h) => h.seasons))}시즌 · HOF ${avg(hof.map((h) => h.score))}점`);
console.log(`  미지명 ${finals.filter((g) => g.draftPick?.overall === 0).length}건 · 은퇴사유 없음 ${finals.filter((g) => !g.retireReason).length}건`);

console.log(`\n■ 발견된 문제 (${issues.length}종)\n`);
if (!issues.length) console.log("  없음");
for (const g of Object.entries(issues.reduce<Record<string, string[]>>((a, x) => ({ ...a, [x.kind]: [...(a[x.kind] ?? []), x.detail] }), {}))) {
  console.log(`  · ${g[0]}: ${g[1].slice(0, 3).join(" | ")}`);
}
