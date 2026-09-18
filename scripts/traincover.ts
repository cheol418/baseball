/**
 * 훈련 방향이 모든 능력을 덮는가.
 *
 * 어떤 방향의 주력도 곁가지도 아닌 능력은 **평생 한 칸도 오르지 않는다** —
 * 화면에는 "성장 여지 27"이라고 떠 있는데 갈 수 있는 길이 없다.
 */
import { abilityKeys, ABILITY_LABEL, TRAINING_PATHS } from "../src/lib/player";

for (const kind of ["HITTER", "PITCHER"] as const) {
  const keys = abilityKeys(kind);
  const menu = TRAINING_PATHS.filter((m) => m.kind === kind);
  console.log(`\n■ ${kind === "HITTER" ? "타자" : "투수"} — 훈련 방향 ${menu.length}종 · 능력 ${keys.length}개`);
  for (const k of keys) {
    const asMain = menu.filter((m) => m.main.includes(k)).map((m) => m.name);
    const asSub = menu.filter((m) => m.sub.includes(k)).map((m) => m.name);
    const tag = asMain.length ? "주력" : asSub.length ? "곁가지만" : "★ 아무 방향도 안 건드림";
    console.log(`  ${(ABILITY_LABEL[k] ?? k).padEnd(7)} ${tag.padEnd(18)} ${[...asMain, ...asSub].join(" · ") || "—"}`);
  }
}
