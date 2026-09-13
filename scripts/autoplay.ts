/** 테스트용 자동 플레이 — 새 상태 머신 전 구간을 통과시킨다 */
import { advance, type Action } from "../src/lib/career";
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
  /** true를 반환하면 그 시점에서 멈춘다 */
  stopAt?: (g: GameState) => boolean;
  onStep?: (g: GameState) => void;
}

export function autoPlay(start: GameState, opt: AutoOptions = {}): GameState {
  const {
    college = false, joinNational = true, military = "SANGMU",
    nego = "push", transferChance = 0,
  } = opt;
  let g = start;
  let guard = 0;

  const act = (a: Action) => { g = advance(g, a); };

  while (g.phase !== "RETIRED" && guard++ < 600) {
    if (opt.stopAt?.(g)) return g;
    opt.onStep?.(g);
    switch (g.phase) {
      case "HS_SEASON":
      case "COLLEGE_SEASON": act({ type: "SIM_AMATEUR" }); break;
      case "PATH_CHOICE":
        act({ type: "CHOOSE_PATH", path: college && g.seasons.filter((x) => x.level === "COLLEGE").length < 2 ? "COLLEGE" : "DRAFT" });
        break;
      case "DRAFT": act({ type: "DO_DRAFT" }); break;
      case "SPRING_CAMP": {
        const opts = g.pendingTraining ?? [];
        act({ type: "TRAIN", optionId: opts[Math.floor(Math.random() * opts.length)]?.id ?? "balance" });
        break;
      }
      case "FIRST_HALF": act({ type: "PLAY_FIRST_HALF" }); break;
      case "ALL_STAR":
        if (g.pendingTrade) act({ type: "TRADE_DECIDE", accept: Math.random() < 0.5 });
        else act({ type: "PLAY_SECOND_HALF" });
        break;
      case "POSTSEASON": act({ type: "PLAY_POSTSEASON" }); break;
      case "SEASON_END": act({ type: "FINISH_SEASON" }); break;
      case "INTERNATIONAL": act({ type: "JOIN_NATIONAL", join: joinNational }); break;
      case "MILITARY_CHOICE": act({ type: "ENLIST", option: military }); break;
      case "MILITARY_SEASON": act({ type: "SERVE" }); break;
      case "EVENT": {
        const o = g.pendingEvent?.options ?? [];
        if (o.length) act({ type: "CHOOSE_EVENT", optionId: o[Math.floor(Math.random() * o.length)].id });
        else act({ type: "RETIRE" });
        break;
      }
      case "NEGOTIATION": act({ type: "NEGOTIATE", optionId: nego }); break;
      case "STOVE": {
        const targets = g.pendingTransfers ?? [];
        if (!g.transferRequested && targets.length && Math.random() < transferChance) {
          act({ type: "REQUEST_TRANSFER", teamId: targets[0].teamId });
        } else act({ type: "SKIP_STOVE" });
        break;
      }
      case "FA": act({ type: "ACCEPT_OFFER", teamId: g.pendingOffers![0].teamId }); break;
      case "RETIRE_CHOICE": act({ type: "RETIRE" }); break;
      default: act({ type: "RETIRE" }); break;
    }
  }
  if (g.phase !== "RETIRED" && !opt.stopAt) g = advance(g, { type: "RETIRE" });
  return g;
}
