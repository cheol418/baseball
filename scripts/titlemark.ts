/** 타이틀↔스탯 대응이 실제 수상 문자열과 맞는지 (오타 한 글자면 조용히 안 붙는다) */
import { MAJOR_TITLES, TITLE_STAT, titleOfStat } from "../src/lib/sim";

const unmapped = MAJOR_TITLES.filter((t) => !TITLE_STAT[t]);
const orphan = Object.keys(TITLE_STAT).filter((t) => !MAJOR_TITLES.includes(t));
console.log("■ 타이틀 ↔ 기록 대응");
for (const t of MAJOR_TITLES) console.log(`  ${t.padEnd(12)} → ${TITLE_STAT[t] ?? "(기록 없음 — 종합상)"}`);
console.log(`\n  대응 없는 타이틀 ${unmapped.length}종: ${unmapped.join(", ") || "없음"}`);
console.log(`  MAJOR_TITLES에 없는 키 ${orphan.length}종: ${orphan.join(", ") || "없음"}`);
const sample = ["홈런왕", "타점왕", "골든글러브"];
console.log(`\n  예시 awards=[${sample.join(", ")}]`);
for (const k of ["hr", "rbi", "avg", "war"]) console.log(`    ${k.padEnd(4)} → ${titleOfStat(sample, k) ?? "표시 없음"}`);
if (orphan.length) process.exitCode = 1;
