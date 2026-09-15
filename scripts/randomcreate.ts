/** 랜덤 생성 — 어울리지 않는 조합이 나오지 않는가 */
import { RNG } from "../src/lib/rng";
import { randomCreateOptions, rollCandidate, overall } from "../src/lib/player";
const bad: string[] = [];
const kindCnt: Record<string, number> = {};
const posCnt: Record<string, number> = {};
const handCnt: Record<string, number> = {};
const ovr: number[] = [];
const names = new Set<string>();
for (let i = 0; i < 4000; i++) {
  const rng = new RNG(4000 + i);
  const o = randomCreateOptions(rng);
  names.add(o.name);
  kindCnt[o.kind] = (kindCnt[o.kind] ?? 0) + 1;
  posCnt[o.position] = (posCnt[o.position] ?? 0) + 1;
  handCnt[`${o.bats}타 ${o.throws}투`] = (handCnt[`${o.bats}타 ${o.throws}투`] ?? 0) + 1;
  // 야구에 없는 조합
  if (o.throws === "L" && ["C", "2B", "3B", "SS"].includes(o.position)) bad.push(`좌투 ${o.position}`);
  if (o.throws === "S") bad.push("스위치 투수");
  if (o.kind === "PITCHER" && !o.armSlot) bad.push("투구폼 없는 투수");
  if (o.kind === "HITTER" && o.armSlot) bad.push("투구폼 있는 야수");
  if (o.number < 1 || o.number > 99) bad.push(`등번호 ${o.number}`);
  if (!o.name || !o.school) bad.push("빈 이름/학교");
  ovr.push(overall(rollCandidate(o, new RNG(i))));
}
console.log(`■ 4000회 — 있을 수 없는 조합 ${bad.length}건 ${bad.length ? `(${[...new Set(bad)].join(", ")})` : ""}`);
console.log(`  야수/투수 ${kindCnt.HITTER} / ${kindCnt.PITCHER}`);
console.log(`  이름 가짓수 ${names.size} (중복은 900개 조합이라 자연스럽다)`);
console.log(`  포지션 ${Object.entries(posCnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`  타/투 ${Object.entries(handCnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 40).toFixed(0)}%`).join(" · ")}`);
console.log(`  생성 OVR 평균 ${(ovr.reduce((a, b) => a + b, 0) / ovr.length).toFixed(1)} (직접 고를 때와 같아야 한다)`);
