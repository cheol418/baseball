/** 테스트용 자동 플레이 — 새 상태 머신 전 구간을 통과시킨다 */
import { advance, canVolunteer, legacyContext, secondLifeOptions, type Action } from "../src/lib/career";
import { HELL_LIMIT } from "../src/lib/player";
import type { GameState } from "../src/lib/types";

export interface AutoOptions {
  /** 대학 진학 여부 */
  college?: boolean;
  /** 대표팀 발탁 시 참가 */
  joinNational?: boolean;
  /** 병역 선택 */
  military?: "SANGMU" | "ACTIVE";
  /** 연봉 협상 전략 */
  nego?: "accept" | "push" | "arbitration";
  /** 이적을 신청할 확률 */
  transferChance?: number;
  /** 은퇴 후 고를 진로 (후보 목록에서의 순번) */
  secondLife?: number;
  /** true를 반환하면 그 시점에서 멈춘다 */
  stopAt?: (g: GameState) => boolean;
  onStep?: (g: GameState) => void;
  /** 승부처에서 몇 번째 선택지를 고를 것인가 */
  clutchPick?: number;
  /** 올해의 각오 (기본: 팀에 맞춘다) */
  resolve?: string;
}


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

export function autoPlay(start: GameState, opt: AutoOptions = {}): GameState {
  const {
    college = false, joinNational = true, military = "SANGMU",
    nego = "push", transferChance = 0, secondLife = 0, clutchPick = 0,
  } = opt;
  let g = start;
  let guard = 0;

  const act = (a: Action) => { g = advance(g, a); };

  let refusedRetirement = false;
  while (g.phase !== "RETIRED" && guard++ < 600) {
    if (opt.stopAt?.(g)) return g;
    opt.onStep?.(g);
    switch (g.phase) {
      case "HS_SEASON":
      case "COLLEGE_SEASON": act({ type: "SIM_AMATEUR" }); break;
      case "PATH_CHOICE": {
        // 아마추어 시즌의 승부처를 먼저 처리한다 (규칙 3)
        const rec = g.seasons[g.lastSeasonIndex ?? -1];
        if (rec?.clutchSituation && !rec.clutch) {
          const os = rec.clutchSituation.options;
          act({ type: "RESOLVE_CLUTCH", choice: os[Math.min(clutchPick, os.length - 1)].id, where: "AM" });
          break;
        }
        act({ type: "CHOOSE_PATH", path: college && g.seasons.filter((x) => x.level === "COLLEGE").length < 2 ? "COLLEGE" : "DRAFT" });
        break;
      }
      case "DRAFT": act({ type: "DO_DRAFT" }); break;
      case "SPRING_CAMP": {
        const opts = g.pendingTraining ?? [];
        // 지옥 훈련은 커리어 2회 — 쓸 수 있으면 쓴다 (두 경로를 모두 거치게)
        act({
          type: "TRAIN",
          optionId: opts[Math.floor(Math.random() * opts.length)]?.id ?? opts[0].id,
          hell: (g.hellUsed ?? 0) < HELL_LIMIT,
          resolveId: opt.resolve ?? "team",
        });
        break;
      }
      case "FIRST_HALF": act({ type: "PLAY_FIRST_HALF" }); break;
      case "ALL_STAR": {
        // 올스타전 승부처는 이 화면에서 받는다
        const as = g.allStarGame;
        if (as?.clutchSituation && !as.clutch) {
          const os = as.clutchSituation.options;
          act({ type: "RESOLVE_CLUTCH", choice: os[Math.min(clutchPick, os.length - 1)].id, where: "AS" });
          break;
        }
        if (g.pendingTrade) act({ type: "TRADE_DECIDE", accept: Math.random() < 0.5 });
        else act({ type: "PLAY_SECOND_HALF" });
        break;
      }
      /**
       * 반기 계산이 끝난 뒤 중계를 보는 단계.
       * 심어둔 승부처를 고르고 나서야 반기 판정(올스타·순위)이 돈다.
       * 여기를 안 가르치면 default: RETIRE로 빠져 측정값이 전부 거짓이 된다. (규칙 3)
       */
      case "HALF_REVIEW": {
        const c = pickClutch(g, clutchPick);
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
          act({ type: "RESOLVE_CLUTCH", choice: os[Math.min(clutchPick, os.length - 1)].id, where: "PS" });
          break;
        }
        const it = g.intlResults.find((x) => x.clutchSituation && !x.clutch);
        if (it?.clutchSituation) {
          const os = it.clutchSituation.options;
          act({ type: "RESOLVE_CLUTCH", choice: os[Math.min(clutchPick, os.length - 1)].id, where: "INTL" });
          break;
        }
        act({ type: "FINISH_SEASON" });
        break;
      }
      case "INTERNATIONAL": act({ type: "JOIN_NATIONAL", join: joinNational }); break;
      case "MILITARY_CHOICE":
        act({ type: "ENLIST", option: canVolunteer(g) ? military : "ACTIVE" });
        break;
      case "MILITARY_SEASON": act({ type: "SERVE" }); break;
      case "EVENT": {
        const o = g.pendingEvent?.options ?? [];
        if (o.length) act({ type: "CHOOSE_EVENT", optionId: o[Math.floor(Math.random() * o.length)].id });
        else act({ type: "RETIRE" });
        break;
      }
      case "NEGOTIATION": act({ type: "NEGOTIATE", optionId: nego }); break;
      case "STOVE": {
        // 상무는 지원 → 선발이다. 병역 미해결이면 해마다 지원한다
        if (military === "SANGMU" && canVolunteer(g) && !g.sangmuApplied) {
          act({ type: "APPLY_SANGMU" });
          break;
        }
        const targets = g.pendingTransfers ?? [];
        if (!g.transferRequested && targets.length && Math.random() < transferChance) {
          act({ type: "REQUEST_TRANSFER", teamId: targets[0].teamId });
        } else act({ type: "SKIP_STOVE" });
        break;
      }
      case "FA": act({ type: "ACCEPT_OFFER", teamId: g.pendingOffers![0].teamId }); break;
      // 은퇴 권고(강제 아님)는 한 번까지 뿌리치고 더 뛴다 — 두 경로를 모두 거치게 한다
      case "RETIRE_CHOICE":
        if (g.retireForced === false && !refusedRetirement) {
          refusedRetirement = true;
          act({ type: "KEEP_PLAYING" });
        } else act({ type: "RETIRE" });
        break;
      // 은퇴 후 — 진로를 고르고 명예의 전당 투표를 끝까지 돌린다
      case "SECOND_LIFE": {
        const opts = secondLifeOptions(legacyContext(g, g.hofScore ?? 0));
        act({ type: "CHOOSE_SECOND_LIFE", pathId: opts[secondLife % opts.length].id });
        break;
      }
      default: act({ type: "RETIRE" }); break;
    }
  }
  if (g.phase !== "RETIRED" && !opt.stopAt) g = advance(g, { type: "RETIRE" });
  // 명예의 전당 투표는 결론이 날 때까지 (헌액 또는 후보 탈락)
  if (!opt.stopAt) {
    let n = 0;
    while (g.hofVote && !g.hofVote.closed && n++ < 12) g = advance(g, { type: "HOF_BALLOT" });
  }
  return g;
}
