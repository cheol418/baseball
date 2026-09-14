/** FA가 왜 안 뜨는가 — 등록일수와 계약 잔여 중 무엇이 막고 있나 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, FA_SERVICE, advance } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

let both = 0, blockedByContract = 0, blockedByService = 0, faReached = 0, careers = 0;
const gaps: number[] = [];
const CFG = [["HITTER", "1B", "slugger"], ["PITCHER", "SP", "power_p"]] as const;
for (const [kind, pos, style] of CFG) {
  for (let i = 0; i < 90; i++) {
    const rng = new RNG(91000 + i * 31);
    const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    let g: GameState = newGame(p, "DAG", i * 53);
    careers++;
    let sawFa = false;
    // 오프시즌마다 두 조건을 들여다본다
    for (let n = 0; n < 40; n++) {
      g = autoPlay(g, { stopAt: (c) => (c.phase === "NEGOTIATION" || c.phase === "FA") && c !== g });
      if (g.phase !== "NEGOTIATION" && g.phase !== "FA") break;
      const svcOk = g.serviceYears >= FA_SERVICE + g.faUsed * 4;
      const conOk = (g.contract?.remaining ?? 0) <= 0;
      if (g.phase === "FA") { faReached++; sawFa = true; }
      else if (svcOk && !conOk) blockedByContract++;
      else if (!svcOk && conOk) blockedByService++;
      else if (!svcOk && !conOk) both++;
      g = autoPlay(g, { stopAt: (c) => c.phase !== "NEGOTIATION" && c.phase !== "FA" });
      if (g.phase === "RETIRED") break;
    }
    if (!sawFa) gaps.push(g.seasons.filter((s) => s.level === "KBO").length);
  }
}
console.log(`■ 오프시즌 판정 (커리어 ${careers}개)`);
console.log(`  FA 진입             ${faReached}회`);
console.log(`  연봉협상 — 등록일수 부족   ${blockedByService}회`);
console.log(`  연봉협상 — 계약이 남음     ${blockedByContract}회  ← "자격은 되는데 FA가 안 뜬다"`);
console.log(`  연봉협상 — 둘 다 부족      ${both}회`);
console.log(`  FA를 한 번도 못 간 커리어 ${gaps.length}개` + (gaps.length ? ` (평균 1군 ${(gaps.reduce((a,b)=>a+b,0)/gaps.length).toFixed(1)}시즌)` : ""));
