/**
 * 화면에 나가는 문구에 null/undefined/NaN이 박히는지 전수 검사.
 *
 * 부상 통보에 "null 1군 엔트리에서 말소되고…"가 나간 적이 있다.
 * 템플릿 문자열은 nullable을 조용히 찍어버려서 타입체커로는 안 잡힌다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";

const BAD = /\b(null|undefined|NaN)\b|\(\)|—\s*$|\s{2,}/;
const HARD = /\b(null|undefined|NaN)\b/;
let checked = 0;
const hits = new Map<string, { n: number; hard: boolean }>();
const CFG = [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "CP", "power_p"],
] as const;

for (const [kind, pos, style] of CFG) {
  for (let i = 0; i < 120; i++) {
    const rng = new RNG(50000 + i * 19);
    const p = rollCandidate({
      name: "홍길동", number: 7, kind, position: pos as never,
      bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined,
    }, rng);
    const g = autoPlay(newGame(p, "SEO", i * 37), {});
    const texts: string[] = [];
    for (const n of g.notices ?? []) {
      texts.push(n.title, n.body, ...(n.change ?? []).flatMap((c) => [c.label, String(c.from), String(c.to)]));
    }
    for (const s of g.seasons) {
      texts.push(s.note ?? "", ...(s.awards ?? []), ...(s.feats ?? []), ...(s.milestones ?? []),
        s.goal?.label ?? "", s.goal?.reason ?? "");
    }
    texts.push(g.secondLife?.story ?? "", ...g.logs.flatMap((l) => [l.title, l.body]));
    for (const t of texts) {
      if (!t) continue;
      checked++;
      if (BAD.test(t)) {
        const k = t.slice(0, 90);
        const cur = hits.get(k);
        hits.set(k, { n: (cur?.n ?? 0) + 1, hard: HARD.test(t) });
      }
    }
  }
}

const hard = [...hits].filter(([, v]) => v.hard);
console.log(`■ 문구 ${checked.toLocaleString()}건 검사 (커리어 480개)`);
console.log(`  null/undefined/NaN ${hard.length}종 · 기타 의심(빈괄호·중복공백) ${hits.size - hard.length}종`);
for (const [t, v] of [...hits].sort((a, b) => Number(b[1].hard) - Number(a[1].hard) || b[1].n - a[1].n).slice(0, 15)) {
  console.log(`  ${v.hard ? "✗" : "·"} ${String(v.n).padStart(4)}회  ${t}`);
}
if (hard.length) process.exitCode = 1;
