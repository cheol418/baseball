/** 복무 방침이 전역 후를 바꾸는가 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, overall } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay, type AutoOptions } from "./autoplay";
import { ACTIVE_OPTIONS, SANGMU_OPTIONS } from "../src/lib/military";
import type { GameState } from "../src/lib/types";

for (const [label, mil, opts] of [["상무", "SANGMU", SANGMU_OPTIONS], ["현역", "ACTIVE", ACTIVE_OPTIONS]] as const) {
  console.log(`\n■ ${label} — 방침별 전역 직후 (같은 선수·같은 시드, n=70)`);
  console.log("  방침                      전역 시 OVR   구단 신뢰   멘탈   내구성   복무 중 기록");
  for (const o of opts) {
    const ovrs: number[] = [], trusts: number[] = [], mts: number[] = [], durs: number[] = [], lines: number[] = [];
    for (let i = 0; i < 70; i++) {
      const rng = new RNG(2400 + i * 13);
      const p = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "gap" }, rng);
      let caught = false;
      const cfg: AutoOptions = {
        military: mil as "SANGMU" | "ACTIVE", serviceOption: o.id,
        stopAt: (g: GameState) => {
          if (caught || g.military !== "DONE") return false;
          caught = true;
          ovrs.push(overall(g.player)); trusts.push(g.trust);
          mts.push((g.player.abilities as unknown as Record<string, number>).mental ?? 0);
          durs.push((g.player.abilities as unknown as Record<string, number>).durability ?? 0);
          lines.push(g.seasons.filter((x) => x.level === "ARMY").reduce((a, x) => a + x.line.war, 0));
          return true;
        },
      };
      autoPlay(newGame(p, "DAG", i * 31), cfg);
    }
    const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    console.log(`  ${o.name.padEnd(22)} ${avg(ovrs).toFixed(1).padStart(8)}  ${avg(trusts).toFixed(0).padStart(8)}  ${avg(mts).toFixed(0).padStart(5)}  ${avg(durs).toFixed(0).padStart(6)}   WAR ${avg(lines).toFixed(1)}  (n=${ovrs.length})`);
  }
}

/* 상무가 현역보다 나은가 — 같은 선수를 두 갈래로 보낸다 */
console.log("\n■ 상무 vs 현역 (같은 선수·같은 시드, 방침은 둘 다 '충실' 계열)");
for (const [label, mil, oid] of [["상무", "SANGMU", "duty"], ["현역", "ACTIVE", "duty"], ["현역(몸만들기)", "ACTIVE", "keep"]] as const) {
  const before: number[] = [], after: number[] = [];
  for (let i = 0; i < 90; i++) {
    const rng = new RNG(770 + i * 17);
    const p = rollCandidate({ name: "s", number: 1, kind: "HITTER", position: "CF", bats: "R", throws: "R", styleId: "gap" }, rng);
    let pre = 0, caught = false;
    autoPlay(newGame(p, "DAG", i * 23), {
      military: mil as "SANGMU" | "ACTIVE", serviceOption: oid,
      stopAt: (g: GameState) => {
        // 입대 직전 기량을 기억해 두고, 전역 직후와 비교한다
        if (g.phase === "MILITARY_SEASON" && !pre) pre = overall(g.player);
        if (caught || !pre || g.military !== "DONE") return false;
        caught = true; before.push(pre); after.push(overall(g.player));
        return true;
      },
    });
  }
  const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  // 상무 지원이 떨어지면 현역으로 가므로, 실제 복무 형태가 섞일 수 있다
  console.log(`  ${label.padEnd(14)} 입대 전 ${avg(before).toFixed(1)} → 전역 직후 ${avg(after).toFixed(1)}  (${(avg(after) - avg(before) >= 0 ? "+" : "") + (avg(after) - avg(before)).toFixed(1)})  n=${after.length}`);
}
