/** 선수 유형 — 유형마다 실제로 다른 커리어가 나오는지 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, STYLES, deriveStyle } from "../src/lib/player";
import { newGame, careerTotals } from "../src/lib/career";
import { autoPlay } from "./autoplay";

for (const kind of ["HITTER", "PITCHER"] as const) {
  console.log(`\n■ ${kind === "HITTER" ? "타자" : "투수"} 유형 (각 n=20 · 통산 평균)`);
  console.log(kind === "HITTER"
    ? "    유형            AVG    HR   RBI    SB   OPS    WAR   유형유지"
    : "    유형             IP     W    SO   ERA  WHIP    WAR   유형유지");
  for (const st of STYLES.filter((s) => s.kind === kind)) {
    const pos = kind === "HITTER" ? "CF" : st.id === "rubber_p" ? "RP" : "SP";
    const rows: Record<string, number>[] = [];
    let kept = 0;
    for (let i = 0; i < 20; i++) {
      const rng = new RNG(11000 + i * 43);
      const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: st.id }, rng);
      const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));
      rows.push(careerTotals(g.seasons, kind, "KBO") as Record<string, number>);
      if (deriveStyle(g.player).id === st.id) kept++;
    }
    const m = (k: string) => rows.reduce((a, r) => a + (r[k] ?? 0), 0) / rows.length;
    const line = kind === "HITTER"
      ? `${m("avg").toFixed(3).slice(1).padStart(5)} ${String(Math.round(m("hr"))).padStart(5)} ${String(Math.round(m("rbi"))).padStart(5)} ${String(Math.round(m("sb"))).padStart(5)} ${m("ops").toFixed(3).slice(1).padStart(5)} ${m("war").toFixed(1).padStart(6)}`
      : `${String(Math.round(m("ip"))).padStart(6)} ${String(Math.round(m("w"))).padStart(5)} ${String(Math.round(m("so"))).padStart(5)} ${m("era").toFixed(2).padStart(5)} ${m("whip").toFixed(2).padStart(5)} ${m("war").toFixed(1).padStart(6)}`;
    console.log(`    ${st.name.padEnd(11)} ${line}   ${String(Math.round((kept / 20) * 100)).padStart(3)}%`);
  }
}
