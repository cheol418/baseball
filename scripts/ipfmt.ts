/** 이닝 표기가 야구 표기(3분의 1 단위)인가 */
import { fmtIP } from "../src/lib/sim";
const bad: string[] = [];
for (let i = 0; i < 20000; i++) {
  const v = Math.round(Math.random() * 2200) / 10;
  const out = fmtIP(v);
  const frac = out.split(".")[1];
  if (!["0", "1", "2"].includes(frac)) bad.push(`${v} → ${out}`);
  if (Math.abs(Number(out.split(".")[0]) + Number(frac) / 3 - v) > 0.34) bad.push(`${v} → ${out} (값이 멀다)`);
}
console.log(`■ 20000개 — 야구 표기가 아닌 결과 ${bad.length}건 ${bad.slice(0, 3).join(", ")}`);
console.log("  예시:", [0, 0.33, 0.67, 1, 5.5, 161.7, 161.9, 199.99].map((v) => `${v}→${fmtIP(v)}`).join(" · "));
