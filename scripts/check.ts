/** 대학 대회 + OVR 변화 표기 검증 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame, advance, draftForecast } from "../src/lib/career";
import { placementScore } from "../src/lib/amateur";
import type { GameState } from "../src/lib/types";

// 1) 고교 → 대학 → 드래프트 흐름에서 대회가 다 생기는지
const rng = new RNG(20260913);
const p = rollCandidate(
  { name: "검증", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "toolsy" }, rng,
);
let g: GameState = newGame(p, "DAJ", rng.int(1, 2 ** 30));
g = advance(g, { type: "SIM_AMATEUR" });                       // 고교
console.log("■ 아마추어 전국대회\n");
const show = (label: string) => {
  const rec = g.seasons[g.seasons.length - 1];
  console.log(`  ${label} (${rec.year}, ${rec.age}세) OVR ${overall(g.player)}`);
  for (const t of rec.tournaments ?? []) {
    console.log(`    ${String(t.month).padStart(2)}월 ${t.name.padEnd(12)} ${t.placement.padEnd(7)}` +
      `${t.award ? ` 🏅${t.award}` : ""}  (${t.rounds.map((r) => `${r.name} ${r.won ? "승" : "패"} ${r.score}`).join(" / ")})`);
  }
  console.log(`    → 대회점수 ${(rec.tournaments ?? []).reduce((a, t) => a + placementScore(t.placement), 0)}/12 · 지명확률 ${Math.round(draftForecast(g).odds * 100)}%\n`);
};
show("고교 3학년");
g = advance(g, { type: "CHOOSE_PATH", path: "COLLEGE" });
g = advance(g, { type: "SIM_AMATEUR" });                       // 대학 1~2학년
show("대학 1~2학년");
g = advance(g, { type: "SIM_AMATEUR" });                       // 대학 3~4학년
show("대학 3~4학년");

// 2) OVR 변화가 "지난 시즌 → 올해"로 잡히는지
console.log("■ OVR 변화 표기 (프로 3시즌)\n");
g = advance(g, { type: "DO_DRAFT" });
for (let i = 0; i < 3 && g.phase !== "RETIRED"; i++) {
  let guard = 0;
  while (g.phase !== "SEASON_END" && guard++ < 20) {
    switch (g.phase) {
      case "SPRING_CAMP": g = advance(g, { type: "TRAIN", optionId: g.pendingTraining![0].id }); break;
      case "INTERNATIONAL": g = advance(g, { type: "JOIN_NATIONAL", join: true }); break;
      case "FIRST_HALF": g = advance(g, { type: "PLAY_FIRST_HALF" }); break;
      case "ALL_STAR": g = advance(g, { type: "PLAY_SECOND_HALF" }); break;
      case "POSTSEASON": g = advance(g, { type: "PLAY_POSTSEASON" }); break;
      default: guard = 99;
    }
  }
  if (g.phase !== "SEASON_END") break;
  console.log(`  ${g.year}시즌  OVR 변화 표기: ${g.ovrAtSeasonStart} → ${overall(g.player)}  (차이 ${overall(g.player) - g.ovrAtSeasonStart >= 0 ? "+" : ""}${overall(g.player) - g.ovrAtSeasonStart})`);
  g = advance(g, { type: "FINISH_SEASON" });
  let guard2 = 0;
  while (g.phase !== "SPRING_CAMP" && guard2++ < 20) {
    switch (g.phase) {
      case "NEGOTIATION": g = advance(g, { type: "NEGOTIATE", optionId: "accept" }); break;
      case "STOVE": g = advance(g, { type: "SKIP_STOVE" }); break;
      case "FA": g = advance(g, { type: "ACCEPT_OFFER", teamId: g.pendingOffers![0].teamId }); break;
      case "MILITARY_CHOICE": g = advance(g, { type: "ENLIST", option: "SANGMU" }); break;
      case "MILITARY_SEASON": g = advance(g, { type: "SERVE" }); break;
      default: guard2 = 99;
    }
  }
}
