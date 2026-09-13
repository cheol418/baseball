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
}

export function autoPlay(start: GameState, opt: AutoOptions = {}): GameState {
  const {
    college = false, joinNational = true, military = "SANGMU",
    nego = "push", transferChance = 0, secondLife = 0,
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
      case "PATH_CHOICE":
        act({ type: "CHOOSE_PATH", path: college && g.seasons.filter((x) => x.level === "COLLEGE").length < 2 ? "COLLEGE" : "DRAFT" });
        break;
      case "DRAFT": act({ type: "DO_DRAFT" }); break;
      case "SPRING_CAMP": {
        const opts = g.pendingTraining ?? [];
        // 지옥 훈련은 커리어 2회 — 쓸 수 있으면 쓴다 (두 경로를 모두 거치게)
        act({
          type: "TRAIN",
          optionId: opts[Math.floor(Math.random() * opts.length)]?.id ?? opts[0].id,
          hell: (g.hellUsed ?? 0) < HELL_LIMIT,
        });
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
