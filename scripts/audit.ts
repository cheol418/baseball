/** 전체 경로 스트레스 테스트 — 예외·정지·이상값 탐지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall, STYLES, HITTER_POSITIONS, PITCHER_POSITIONS, ARM_SLOTS } from "../src/lib/player";
import {
  newGame, advance, computeHof, careerTotals, formatMoney,
  legacyContext, secondLifeOptions, canVolunteer, type Action,
} from "../src/lib/career";
import { isHitterLine } from "../src/lib/sim";
import { RESOLVES } from "../src/lib/resolve";
import { serviceOptions } from "../src/lib/military";
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
  let refused = false;

  while (g.phase !== "RETIRED" && guard++ < 800) {
    phaseSeen.add(g.phase);
    const before = `${g.phase}:${g.year}:${g.player.age}`;
    try {
      switch (g.phase) {
        case "HS_SEASON": case "COLLEGE_SEASON": act({ type: "SIM_AMATEUR" }); break;
        case "PATH_CHOICE": {
          // 아마추어 시즌의 승부처를 먼저 처리한다 (규칙 3)
          const rec = g.seasons[g.lastSeasonIndex ?? -1];
          if (rec?.clutchSituation && !rec.clutch) {
            const os = rec.clutchSituation.options;
            act({ type: "RESOLVE_CLUTCH", choice: os[rng.int(0, os.length - 1)].id, where: "AM" });
            break;
          }
          act({ type: "CHOOSE_PATH", path: opt.college && g.seasons.filter((x) => x.level === "COLLEGE").length < 2 ? "COLLEGE" : "DRAFT" });
          break;
        }
        case "DRAFT": act({ type: "DO_DRAFT" }); break;
        case "SPRING_CAMP": {
          const o = g.pendingTraining;
          if (!o?.length) { add("훈련 후보 없음", before); act({ type: "RETIRE" }); break; }
          act({ type: "TRAIN", optionId: o[rng.int(0, o.length - 1)].id, hell: rng.chance(0.4), resolveId: RESOLVES[rng.int(0, RESOLVES.length - 1)].id });
          break;
        }
        case "FIRST_HALF": act({ type: "PLAY_FIRST_HALF" }); break;
        case "ALL_STAR":
          if (g.pendingTrade) act({ type: "TRADE_DECIDE", accept: rng.chance(0.5) });
          else act({ type: "PLAY_SECOND_HALF" });
          break;
        /**
       * 반기 계산이 끝난 뒤 중계를 보는 단계.
       * 심어둔 승부처를 고르고 나서야 반기 판정(올스타·순위)이 돈다.
       * 여기를 안 가르치면 default: RETIRE로 빠져 측정값이 전부 거짓이 된다. (규칙 3)
       */
      case "HALF_REVIEW": {
        const c = pickClutch(g, 0);
        if (c) act({ type: "RESOLVE_CLUTCH", choice: c });
        else act({ type: "FINISH_HALF" });
        break;
      }
      case "POSTSEASON": act({ type: "PLAY_POSTSEASON" }); break;
        case "SEASON_END": {
        // 가을야구·국제대회 승부처는 중계에서 받으므로 여기서 처리한다 (규칙 3)
        const ps = g.postseason;
        if (ps?.clutchSituation && !ps.clutch) {
          const os = ps.clutchSituation.options;
          act({ type: "RESOLVE_CLUTCH", choice: os[rng.int(0, os.length - 1)].id, where: "PS" });
          break;
        }
        const it = g.intlResults.find((x) => x.clutchSituation && !x.clutch);
        if (it?.clutchSituation) {
          const os = it.clutchSituation.options;
          act({ type: "RESOLVE_CLUTCH", choice: os[rng.int(0, os.length - 1)].id, where: "INTL" });
          break;
        }
        act({ type: "FINISH_SEASON" });
        break;
      }
        case "INTERNATIONAL": act({ type: "JOIN_NATIONAL", join: opt.joinNat }); break;
        // 상무는 미리 지원해서 붙어야 간다 — 입영 통지 시점엔 대개 현역만 남는다
        case "MILITARY_CHOICE":
          act({ type: "ENLIST", option: canVolunteer(g) ? opt.military : "ACTIVE" });
          break;
        case "MILITARY_SEASON": act({ type: "SERVE", optionId: serviceOptions(g.military)[rng.int(0, 2)]?.id }); break;
        case "EVENT": {
          const o = g.pendingEvent!.options;
          act({ type: "CHOOSE_EVENT", optionId: o[rng.int(0, o.length - 1)].id });
          break;
        }
        case "NEGOTIATION": act({ type: "NEGOTIATE", optionId: opt.nego }); break;
        case "STOVE": {
          // 상무는 지원해서 뽑혀야 간다 — 병역 미해결이면 해마다 지원해 본다
          if (opt.military === "SANGMU" && canVolunteer(g) && !g.sangmuApplied) {
            act({ type: "APPLY_SANGMU" });
            break;
          }
          const t = g.pendingTransfers;
          if (!g.transferRequested && t?.length && rng.next() < opt.transfer) act({ type: "REQUEST_TRANSFER", teamId: t[rng.int(0, t.length - 1)].teamId });
          else act({ type: "SKIP_STOVE" });
          break;
        }
        case "FA":
          if (opt.deferFa && !deferred) { deferred = true; act({ type: "DEFER_FA" }); }
          else act({ type: "ACCEPT_OFFER", teamId: g.pendingOffers![rng.int(0, g.pendingOffers!.length - 1)].teamId });
          break;
        case "RETIRE_CHOICE":
          // 권고는 한 번 뿌리쳐 보고, 그 다음엔 받아들인다
          if (g.retireForced === false && !refused) { refused = true; act({ type: "KEEP_PLAYING" }); }
          else act({ type: "RETIRE" });
          break;
        case "SECOND_LIFE": {
          const opts = secondLifeOptions(legacyContext(g, g.hofScore ?? 0));
          act({ type: "CHOOSE_SECOND_LIFE", pathId: opts[rng.int(0, opts.length - 1)].id });
          break;
        }
        default: add("알 수 없는 단계", g.phase); act({ type: "RETIRE" });
      }
    } catch (e) { crashes++; add("예외", `${before} → ${(e as Error).message}`); return g; }
    // 같은 단계에 머무는 게 정상인 곳들.
    // HALF_REVIEW는 승부처를 고른 뒤(RESOLVE_CLUTCH) 판정(FINISH_HALF)으로 넘어가므로
    // 한 단계에서 액션이 두 번 필요하다.
    // PATH_CHOICE·ALL_STAR·HALF_REVIEW는 승부처를 고른 뒤 본 액션이 오므로
    // 한 단계에서 액션이 두 번 필요하다.
    const STAY_OK = ["STOVE", "ALL_STAR", "HALF_REVIEW", "PATH_CHOICE", "SEASON_END"];
    if (`${g.phase}:${g.year}:${g.player.age}` === before && !STAY_OK.includes(g.phase)) {
      stuck++; add("무한루프", before); return g;
    }
  }
  if (guard >= 800) { stuck++; add("가드 초과", `${g.year} ${g.phase}`); }
  // 명예의 전당 투표를 결론까지 진행한다
  let ballots = 0;
  while (g.hofVote && !g.hofVote.closed && ballots++ < 12) {
    try { g = advance(g, { type: "HOF_BALLOT" }); actionSeen.add("HOF_BALLOT"); }
    catch (e) { crashes++; add("예외", `HOF_BALLOT → ${(e as Error).message}`); break; }
  }

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
      // 부분 출장 시즌은 월별 추첨이 겹쳐 편차가 크다 — 규정타석 근처에서만 본다
      if (l.pa >= 350 && l.avg > 0.42) add("타율 이상", `${s.year} ${l.avg} (${l.pa}타석)`);
      if (l.pa >= 20 && l.avg > 0.55) add("타율 이상(소표본)", `${s.year} ${l.avg} (${l.pa}타석)`);
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

const allPhases = ["EVENT","HS_SEASON","PATH_CHOICE","COLLEGE_SEASON","DRAFT","SPRING_CAMP","FIRST_HALF","ALL_STAR","POSTSEASON","SEASON_END","INTERNATIONAL","MILITARY_CHOICE","MILITARY_SEASON","NEGOTIATION","STOVE","FA","RETIRE_CHOICE","SECOND_LIFE","RETIRED"];

/**
 * 승부처 선택.
 * 반기를 시작할 때 고르지 않으면 그 승부처는 없던 일이 되어,
 * 자동 플레이가 실제 플레이보다 심심한 기록을 남긴다. (규칙 3)
 */
function pickClutch(g: GameState, which = 0): string | undefined {
  const m = g.monthLines?.find((x) => x.clutchSituation && !x.clutch);
  if (!m?.clutchSituation) return undefined;
  const os = m.clutchSituation.options;
  return os[Math.min(which, os.length - 1)].id;
}

const allActions = ["TRADE_DECIDE","CHOOSE_EVENT","SIM_AMATEUR","CHOOSE_PATH","DO_DRAFT","TRAIN","PLAY_FIRST_HALF","PLAY_SECOND_HALF","FINISH_HALF","RESOLVE_CLUTCH","PLAY_POSTSEASON","FINISH_SEASON","JOIN_NATIONAL","ENLIST","SERVE","NEGOTIATE","REQUEST_TRANSFER","APPLY_SANGMU","SKIP_STOVE","ACCEPT_OFFER","DEFER_FA","RETIRE","KEEP_PLAYING","CHOOSE_SECOND_LIFE","HOF_BALLOT"];

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
