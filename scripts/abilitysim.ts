/**
 * 특수능력 드라이런 — 구현 전에 획득 조건만 대입해 본다.
 *
 * 실제 코드를 건드리지 않고, 지금 나오는 커리어에 설계안의 조건을 얹어
 * "커리어당 몇 개가 붙는가"를 본다. 목표는 금특 5~8 · 파란특 1~2다.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate, getAb } from "../src/lib/player";
import { newGame, careerTotals } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import { MAJOR_TITLES } from "../src/lib/sim";
import type { GameState, HitterLine, PitcherLine, SeasonRecord } from "../src/lib/types";

/** 장면 문구에서 태그를 유추한다 (구현 땐 장면에 tags를 단다) */
function tagsOf(eyebrow: string, title: string, body: string, walkoff: boolean): string[] {
  const t = `${eyebrow} ${title} ${body}`;
  const out: string[] = [];
  if (t.includes("만루")) out.push("만루");
  if (walkoff) out.push("끝내기");
  if (t.includes("원정") || t.includes("야유") || t.includes("적지")) out.push("원정");
  if (/[1･·1-3]루|주자|위기|승계|무사 |1사 |2사 /.test(t)) out.push("위기");
  if (t.includes("세이브") || t.includes("9회 1점") || t.includes("뒷문")) out.push("세이브");
  if (t.includes("노히트") || t.includes("완봉") || t.includes("완투")) out.push("대기록");
  return out;
}

interface Tally { win: number; lose: number }
const bump = (m: Map<string, Tally>, k: string, win: boolean) => {
  const t = m.get(k) ?? { win: 0, lose: 0 };
  if (win) t.win++; else t.lose++;
  m.set(k, t);
};

/**
 * 표본을 고르게 잡는다.
 * 자동 플레이는 승부처에서 **늘 같은 선택지**를 고르므로(clutchPick 고정),
 * 그대로 재면 1번 선택지에 걸린 능력만 50%가 되고 나머지는 0이 된다.
 * 보직도 섞어야 세이브·수비 계열이 제대로 읽힌다. (실제로 겪음)
 */
const ARCH = [
  ["HITTER", "CF", "toolsy"], ["HITTER", "1B", "slugger"], ["HITTER", "2B", "contact"],
  ["PITCHER", "SP", "power_p"], ["PITCHER", "SP", "control_p"], ["PITCHER", "CP", "power_p"],
] as const;

const N = 180;
const gained: Record<string, number> = {};
const perCareer: { gold: number; blue: number }[] = [];
const stackPeak: number[] = [];
/** 한 장면에 실제로 겹쳐 붙는 보정 (상한을 걸기 전 원값) */
const sceneStack: number[] = [];
const CLUTCH_BONUS: Record<string, number> = {
  만루: 12, 끝내기: 10, 위기: 10, 원정: 8, 무대: 10, swing: 8, patient: 8,
};

for (let i = 0; i < N; i++) {
  const rng = new RNG(1200 + i * 17);
  const [kind, pos, style] = ARCH[i % ARCH.length];
  const p = rollCandidate({ name: "s", number: 1, kind, position: pos as never, bats: "R", throws: "R", styleId: style, armSlot: kind === "PITCHER" ? "OVER" : undefined }, rng);

  const byTag = new Map<string, Tally>();     // 태그별 승부처 성패
  const byOpt = new Map<string, Tally>();     // 선택지별 승부처 성패
  const stageT: Tally = { win: 0, lose: 0 };  // 무대(올스타·국대·가을)
  const seen = new Set<string>();
  const scenes: { tags: string[]; opt: string }[] = [];

  const g: GameState = autoPlay(newGame(p, "DAG", i * 23), {
    clutchPick: i % 3,
    onStep: (x: GameState) => {
      const take = (c: { eyebrow: string; title: string; body: string; walkoff?: boolean; options: { id: string }[] } | undefined,
                    r: { optionId: string; outcome: { good: boolean } } | undefined, key: string, stage: boolean) => {
        if (!c || !r || seen.has(key)) return;
        seen.add(key);
        const good = r.outcome.good;
        for (const tg of tagsOf(c.eyebrow, c.title, c.body, !!c.walkoff)) bump(byTag, tg, good);
        bump(byOpt, r.optionId, good);
        if (stage) { if (good) stageT.win++; else stageT.lose++; }
        scenes.push({ tags: [...tagsOf(c.eyebrow, c.title, c.body, !!c.walkoff), ...(stage ? ["무대"] : [])], opt: r.optionId });
      };
      (x.monthLines ?? []).forEach((m, mi) => take(m.clutchSituation, m.clutch, `${x.year}-${x.liveHalf}-${mi}`, false));
      take(x.allStarGame?.clutchSituation, x.allStarGame?.clutch, `AS${x.year}`, true);
      take(x.postseason?.clutchSituation, x.postseason?.clutch, `PS${x.year}`, true);
      for (const r of x.intlResults) take(r.clutchSituation, r.clutch, `IN${r.year}`, true);
    },
  });

  const kbo = g.seasons.filter((s) => s.level === "KBO");
  const tot = careerTotals(g.seasons, kind, "KBO") as Record<string, number>;
  const aw = (n: string) => kbo.filter((s) => s.awards.includes(n)).length;
  const seasonsWith = (f: (s: SeasonRecord) => boolean) => kbo.filter(f).length;
  const tg = (k: string) => byTag.get(k) ?? { win: 0, lose: 0 };
  const op = (k: string) => byOpt.get(k) ?? { win: 0, lose: 0 };
  const rate = (t: Tally) => (t.win + t.lose ? t.win / (t.win + t.lose) : 0);
  const ab = (k: string) => getAb(g.player.abilities, k as never);

  const got: [string, boolean, boolean][] = [   // [이름, 조건, 파란특인가]
    ["만루의 사나이", tg("만루").win >= 3 && rate(tg("만루")) >= 0.6, false],
    ["끝내기 사나이", tg("끝내기").win >= 4, false],
    ["큰 경기에 강하다", stageT.win >= 6, false],
    ["원정 불패", tg("원정").win >= 4, false],
    ["초구 노림수", op("swing").win >= 6, false],
    ["선구안의 대가", op("patient").win >= 5 || aw("출루율 1위") > 0, false],
    ["위기 관리", tg("위기").win >= 5 && kind === "PITCHER", false],
    ["뒷문의 주인", aw("세이브왕") > 0 || aw("홀드왕") > 0 || tg("세이브").win >= 3, false],
    ["새가슴", tg("끝내기").lose >= 5 && tg("끝내기").win <= 2, true],
    ["볼넷 남발", op("corner").lose >= 5, true],

    ["한 방이 있다", seasonsWith((s) => (s.line as HitterLine).hr >= 30) >= 2 || aw("홈런왕") > 0, false],
    ["안타 제조기", seasonsWith((s) => (s.line as HitterLine).h >= 170) >= 2 || aw("타격왕") > 0, false],
    ["대도", seasonsWith((s) => (s.line as HitterLine).sb >= 30) >= 1, false],
    ["철벽 수비", aw("골든글러브") >= 2 && kind === "HITTER", false],
    ["탈삼진 머신", aw("탈삼진왕") > 0 || seasonsWith((s) => (s.line as PitcherLine).so >= 180) >= 2, false],
    ["이닝이터", aw("최다이닝") > 0 || seasonsWith((s) => (s.line as PitcherLine).ip >= 180) >= 2, false],
    ["피홈런 체질", seasonsWith((s) => (s.line as PitcherLine).hrAllowed >= 25) >= 2, true],
    ["삼진 늘어남", seasonsWith((s) => (s.line as HitterLine).so >= 155) >= 3, true],

    ["팀의 얼굴", (() => { const c: Record<string, number> = {}; for (const s of kbo) c[s.teamId] = (c[s.teamId] ?? 0) + 1; return Math.max(0, ...Object.values(c)) >= 15; })(), false],
    ["언론 친화", g.player.fame >= 80, false],
    ["늦게 피는 꽃", (() => { let best = 0; for (const s of kbo) { if (s.age >= 30 && s.line.war > best) return true; best = Math.max(best, s.line.war); } return false; })(), false],
    ["부상 체질", kbo.filter((s) => (s.note ?? "").includes("심각")).length >= 2, true],
    ["노쇠 가속", (() => { for (let j = 2; j < kbo.length; j++) if (kbo[j].age >= 33 && kbo[j].line.war < kbo[j - 1].line.war && kbo[j - 1].line.war < kbo[j - 2].line.war && kbo[j].line.war < kbo[j - 2].line.war * 0.25) return true; return false; })(), true],
    ["회복력", kbo.some((s) => (s.note ?? "").includes("심각")) && kbo.some((s) => s.line.war >= 3), false],
  ];

  let gold = 0, blue = 0;
  for (const [name, hit, isBlue] of got) {
    if (!hit) continue;
    gained[name] = (gained[name] ?? 0) + 1;
    if (isBlue) blue++; else gold++;
  }
  perCareer.push({ gold, blue });

  // 커리어가 들고 있는 승부처 능력이 **각 장면에서** 실제로 몇 %p가 되는가
  const has = (n: string) => !!got.find(([g2]) => g2 === n)?.[1];
  const ownTag = new Set<string>();
  if (has("만루의 사나이")) ownTag.add("만루");
  if (has("끝내기 사나이")) ownTag.add("끝내기");
  if (has("위기 관리")) ownTag.add("위기");
  if (has("원정 불패")) ownTag.add("원정");
  if (has("큰 경기에 강하다")) ownTag.add("무대");
  const ownOpt = new Set<string>();
  if (has("초구 노림수")) ownOpt.add("swing");
  if (has("선구안의 대가")) ownOpt.add("patient");
  let peak = 0;
  for (const sc of scenes) {
    let v = 0;
    for (const t of sc.tags) if (ownTag.has(t)) v += CLUTCH_BONUS[t] ?? 0;
    if (ownOpt.has(sc.opt)) v += CLUTCH_BONUS[sc.opt] ?? 0;
    sceneStack.push(v);
    peak = Math.max(peak, v);
  }
  stackPeak.push(peak);
  void tot; void ab;
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const q = (a: number[], x: number) => [...a].sort((m, n) => m - n)[Math.floor(a.length * x)];
console.log(`■ 커리어당 획득 (n=${N})`);
console.log(`  금특  평균 ${avg(perCareer.map((c) => c.gold)).toFixed(1)} · 중앙 ${q(perCareer.map((c) => c.gold), .5)} · 최대 ${Math.max(...perCareer.map((c) => c.gold))}   (목표 5~8)`);
console.log(`  파란특 평균 ${avg(perCareer.map((c) => c.blue)).toFixed(1)} · 중앙 ${q(perCareer.map((c) => c.blue), .5)} · 최대 ${Math.max(...perCareer.map((c) => c.blue))}   (목표 1~2)`);
console.log(`  하나도 못 얻은 커리어 ${perCareer.filter((c) => c.gold === 0).length}건`);
console.log(`\n■ 능력별 획득률`);
for (const [k, v] of Object.entries(gained).sort((a, b) => b[1] - a[1])) {
  const bar = "█".repeat(Math.round(v / N * 30));
  console.log(`  ${k.padEnd(14)} ${String(Math.round(v / N * 100)).padStart(3)}%  ${bar}`);
}
console.log(`\n■ 승부처 중첩 — **한 장면에** 실제로 붙는 보정 (n=${sceneStack.length}장면)`);
const nz = sceneStack.filter((v) => v > 0);
console.log(`  보정이 붙은 장면 ${(nz.length / sceneStack.length * 100).toFixed(0)}%`);
console.log(`  붙었을 때  중앙 +${q(nz, .5)}%p · 상위10% +${q(nz, .9)}%p · 최대 +${Math.max(...nz)}%p`);
console.log(`  상한 +20%p에 걸리는 장면 ${(sceneStack.filter((v) => v > 20).length / sceneStack.length * 100).toFixed(1)}%  (전체 대비)`);
console.log(`  커리어별 최고 보정  중앙 +${q(stackPeak, .5)}%p · 최대 +${Math.max(...stackPeak)}%p`);
