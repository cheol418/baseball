/** 프로 연차 ↔ 1군 등록(서비스타임) ↔ FA 도달 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame, FA_SERVICE } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const rows: { pro: number; kbo: number; svc: number; fa: boolean; faAge: number }[] = [];
const CFG = [["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"], ["PITCHER", "SP", "power_p"]] as const;
for (const [kind, pos, style] of CFG) {
  for (let i = 0; i < 110; i++) {
    const rng = new RNG(61000 + i * 29);
    const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);
    const g = autoPlay(newGame(p, "DAG", i * 43), {});
    const pro = g.seasons.filter((s) => s.level === "KBO" || s.level === "MINOR" || s.level === "ARMY").length;
    const kbo = g.seasons.filter((s) => s.level === "KBO").length;
    // 첫 FA를 몇 살에 갔는가 (계약이 바뀐 첫 시즌으로 근사)
    let faAge = 0;
    let acc = 0;
    for (const s2 of g.seasons) {
      if (s2.level !== "KBO") continue;
      acc += 1;
      if (acc >= FA_SERVICE) { faAge = s2.age; break; }
    }
    rows.push({ pro, kbo, svc: g.serviceYears, fa: g.faUsed > 0, faAge });
  }
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const long = rows.filter((r) => r.kbo >= 10);
console.log(`■ 커리어 ${rows.length}개 · FA 기준 ${FA_SERVICE}년`);
console.log(`  전체        프로 ${avg(rows.map((r) => r.pro)).toFixed(1)}시즌 · 1군 ${avg(rows.map((r) => r.kbo)).toFixed(1)}시즌 → 서비스타임 ${avg(rows.map((r) => r.svc)).toFixed(1)}년`);
console.log(`  1군 10시즌+ 프로 ${avg(long.map((r) => r.pro)).toFixed(1)}시즌 · 1군 ${avg(long.map((r) => r.kbo)).toFixed(1)}시즌 → 서비스타임 ${avg(long.map((r) => r.svc)).toFixed(1)}년`);
console.log(`              1군 시즌당 쌓이는 서비스타임 ${(avg(long.map((r) => r.svc)) / avg(long.map((r) => r.kbo))).toFixed(3)}년 (실제 KBO는 1.0)`);
console.log(`  FA 한 번이라도 행사  ${rows.filter((r) => r.fa).length}/${rows.length} (${Math.round(rows.filter((r) => r.fa).length / rows.length * 100)}%)`);
console.log(`  1군 10시즌+ 중 FA   ${long.filter((r) => r.fa).length}/${long.length} (${Math.round(long.filter((r) => r.fa).length / long.length * 100)}%)`);
const aged = rows.filter((r) => r.faAge > 0).map((r) => r.faAge);
const pct = (q: number) => [...aged].sort((x, y) => x - y)[Math.floor(aged.length * q)];
console.log(`  FA 자격 도달 나이  중앙 ${pct(0.5)}세 (하위25% ${pct(0.25)}세 · 상위25% ${pct(0.75)}세)  실제 KBO 고졸 27~28세 · 대졸 29~30세`);
const never = long.filter((r) => !r.fa);
if (never.length) console.log(`  ↳ 1군 10시즌 넘게 뛰고도 FA 못 간 ${never.length}명 — 평균 1군 ${avg(never.map((r) => r.kbo)).toFixed(1)}시즌 · 서비스타임 ${avg(never.map((r) => r.svc)).toFixed(1)}년`);
