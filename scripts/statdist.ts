/** 1군 주전/선발 시즌의 실제 기록 분포 — 목표 기준선을 데이터로 잡기 위한 측정 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { isHitterLine } from "../src/lib/sim";
import type { HitterLine, PitcherLine } from "../src/lib/types";

const pct = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};
const show = (name: string, a: number[], d = 0) => {
  if (!a.length) return console.log(`  ${name.padEnd(12)} 표본 없음`);
  console.log(
    `  ${name.padEnd(12)} n=${String(a.length).padStart(4)}`
    + `  하위25% ${pct(a, 0.25).toFixed(d)}  중앙 ${pct(a, 0.5).toFixed(d)}`
    + `  상위25% ${pct(a, 0.75).toFixed(d)}  상위10% ${pct(a, 0.9).toFixed(d)}  최대 ${Math.max(...a).toFixed(d)}`,
  );
};

for (const [label, kind, pos, style, roles] of [
  ["타자 주전", "HITTER", "CF", "toolsy", ["주전"]],
  ["타자 준주전", "HITTER", "CF", "toolsy", ["준주전"]],
  ["거포 주전", "HITTER", "1B", "slugger", ["주전"]],
  ["선발투수", "PITCHER", "SP", "power_p", ["1선발", "선발", "5선발"]],
  ["마무리", "PITCHER", "CP", "power_p", ["마무리"]],
  ["불펜", "PITCHER", "RP", "finesse_p", ["불펜", "추격조"]],
] as [string, "HITTER" | "PITCHER", string, string, string[]][]) {
  const bag: Record<string, number[]> = {};
  const put = (k: string, v: number) => (bag[k] = bag[k] ?? []).push(v);

  for (let i = 0; i < 40; i++) {
    const rng = new RNG(4000 + i * 37);
    const p = rollCandidate({ name: "샘플", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style }, rng);
    const g = autoPlay(newGame(p, "DAG", rng.int(1, 2 ** 30)));
    for (const s of g.seasons) {
      if (s.level !== "KBO" || !roles.includes(s.role)) continue;
      const l = s.line;
      if (isHitterLine(l)) {
        const h = l as HitterLine;
        if (h.pa < 300) continue;
        put("PA", h.pa); put("AVG", h.avg); put("OPS", h.ops); put("SLG", h.slg);
        put("OBP", h.obp); put("HR", h.hr); put("RBI", h.rbi); put("SB", h.sb);
        put("H", h.h); put("WAR", h.war);
      } else {
        const q = l as PitcherLine;
        if (q.ip < 20) continue;
        put("IP", q.ip); put("W", q.w); put("ERA", q.era); put("WHIP", q.whip);
        put("SO", q.so); put("K9", q.k9); put("BB", q.bb); put("SV", q.sv);
        put("HLD", q.hld); put("WAR", q.war);
      }
    }
  }
  console.log(`\n■ ${label}`);
  for (const [k, v] of Object.entries(bag)) show(k, v, ["AVG", "OPS", "SLG", "OBP", "ERA", "WHIP"].includes(k) ? 3 : ["K9", "WAR", "IP"].includes(k) ? 1 : 0);
}
