/** 능력치별 에이징 커브 확인 */
import { RNG } from "../src/lib/rng";
import { ABILITY_LABEL, abilityKeys, ageFactor, getAb, grow, overall, rollCandidate } from "../src/lib/player";
import type { Kind, Player } from "../src/lib/types";

function track(kind: Kind, styleId: string, pos: string, seed: number) {
  const rng = new RNG(seed);
  const p: Player = rollCandidate(
    { name: "표본", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId }, rng,
  );
  const keys = abilityKeys(kind);
  const rows: Record<number, Record<string, number>> = {};
  for (let age = 18; age <= 40; age++) {
    p.age = age;
    rows[age] = Object.fromEntries(keys.map((k) => [k, getAb(p.abilities, k)]));
    rows[age].OVR = overall(p);
    grow(p, rng, null); // 훈련 없이 순수 나이 효과만
  }
  const ages = [20, 23, 26, 28, 30, 32, 34, 36, 38, 40];
  const head = ["능력", ...ages.map((a) => `${a}세`)];
  const body = [...keys, "OVR"].map((k) => [
    k === "OVR" ? "OVR" : ABILITY_LABEL[k], ...ages.map((a) => String(rows[a][k])),
  ]);
  const w = head.map((_, i) => Math.max(...[head, ...body].map((r) => [...r[i]].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 2 : 1), 0))));
  const pad = (str: string, i: number) => {
    const len = [...str].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 2 : 1), 0);
    return str + " ".repeat(Math.max(0, w[i] - len));
  };
  console.log(head.map(pad).join("  "));
  console.log(w.map((n) => "-".repeat(n)).join("  "));
  for (const r of body) console.log(r.map(pad).join("  "));
}

console.log("\n■ 타자 (호타준족 중견수) — 훈련 없이 나이 효과만\n");
track("HITTER", "toolsy", "CF", 20260912);
console.log("\n■ 투수 (파워피처 선발) — 훈련 없이 나이 효과만\n");
track("PITCHER", "power_p", "SP", 20260912);

console.log("\n■ 능력치별 피크 나이 (성장 계수가 0 아래로 내려가는 시점)\n");
for (const k of [...abilityKeys("HITTER"), ...abilityKeys("PITCHER")].filter((v, i, a) => a.indexOf(v) === i)) {
  let last = 0;
  for (let age = 18; age <= 42; age++) if (ageFactor(age, "normal", k) > 0) last = age;
  console.log(`  ${ABILITY_LABEL[k].padEnd(6)} 하락 시작 ${last + 1}세`);
}
