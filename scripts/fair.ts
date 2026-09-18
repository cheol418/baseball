/**
 * 같은 능력치를 주고 자리만 바꿨을 때, 결과가 얼마나 갈리는가.
 *
 * "선발투수가 중간계투보다 같은 능력치면 언제나 기록도 연봉도 좋은가"를 잰다.
 * **같은 선수를 복제해 자리만 바꾼다** — 능력치 생성까지 자리에 맡기면
 * 자리 탓인지 능력치 탓인지 구분할 수 없다.
 */
import { RNG } from "../src/lib/rng";
import { overall, rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { autoPlay } from "./autoplay";
import type { GameState, Player, Position, SeasonRecord } from "../src/lib/types";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type Out = { war: number; peakPay: number; titles: number; allStar: number; seasons: number; hof: number; fame: number; intl: number };
const blank = (): Out => ({ war: 0, peakPay: 0, titles: 0, allStar: 0, seasons: 0, hof: 0, fame: 0, intl: 0 });

function run(base: Player, pos: Position, seed: number): Out {
  const p = clone(base);
  p.position = pos;
  const g: GameState = autoPlay(newGame(p, "DAG", seed));
  const o = blank();
  for (const rec of g.seasons as SeasonRecord[]) {
    if (rec.level !== "KBO") continue;
    o.seasons++; o.war += rec.line.war;
    o.peakPay = Math.max(o.peakPay, rec.salary);
    o.titles += rec.awards.filter((a) => a.endsWith("왕") || a.includes("MVP")).length;
    if (rec.allStar) o.allStar++;
  }
  o.hof = g.hofScore ?? 0;
  o.fame = g.player.fame;
  o.intl = g.intlResults.length;
  return o;
}

function table(label: string, kind: "HITTER" | "PITCHER", positions: Position[], styleId: string) {
  const acc = new Map<string, Out[]>();
  for (let i = 0; i < 40; i++) {
    const rng = new RNG(6100 + i * 23);
    const base = rollCandidate({
      name: "표본", number: 1, kind, position: positions[0],
      bats: "R", throws: "R", styleId, armSlot: kind === "PITCHER" ? "OVER" : undefined,
    }, rng);
    for (const pos of positions) {
      acc.set(pos, [...(acc.get(pos) ?? []), run(base, pos, 4400 + i * 37)]);
    }
  }
  console.log(`\n■ ${label} — 같은 능력치(생성 OVR 평균 ${"—"})를 자리만 바꿔 40번씩`);
  console.log("  자리      1군시즌   통산WAR   최고연봉   타이틀   올스타   국대   인지도   명전점수");
  for (const pos of positions) {
    const rows = acc.get(pos)!;
    const avg = (f: (o: Out) => number) => rows.reduce((a, o) => a + f(o), 0) / rows.length;
    console.log(
      `  ${pos.padEnd(7)} ${avg((o) => o.seasons).toFixed(1).padStart(7)}`
      + `  ${avg((o) => o.war).toFixed(1).padStart(8)}`
      + `  ${(avg((o) => o.peakPay) / 10000).toFixed(1).padStart(8)}억`
      + `  ${avg((o) => o.titles).toFixed(1).padStart(6)}`
      + `  ${avg((o) => o.allStar).toFixed(1).padStart(6)}`
      + `  ${avg((o) => o.intl).toFixed(1).padStart(5)}`
      + `  ${avg((o) => o.fame).toFixed(0).padStart(6)}`
      + `  ${avg((o) => o.hof).toFixed(0).padStart(8)}`,
    );
  }
}

/**
 * 실제로 플레이할 때의 격차.
 * 위 표는 능력치를 고정해 **자리 탓만** 뽑아낸 것이고, 이쪽은 자리에 맞는
 * 능력치를 그대로 받은 경우다 — 생성이 자리를 보정해 준다면 격차가 줄어든다.
 */
function natural(label: string, kind: "HITTER" | "PITCHER", positions: Position[], styleId: string) {
  console.log(`\n■ ${label} — 자리에 맞게 그냥 생성했을 때 (각 40명)`);
  console.log("  자리      생성OVR   1군시즌   통산WAR   최고연봉   타이틀   명전점수");
  for (const pos of positions) {
    const rows: Out[] = [];
    let ovrSum = 0;
    for (let i = 0; i < 40; i++) {
      const rng = new RNG(7700 + i * 29);
      const p = rollCandidate({
        name: "표본", number: 1, kind, position: pos,
        bats: "R", throws: "R", styleId, armSlot: kind === "PITCHER" ? "OVER" : undefined,
      }, rng);
      ovrSum += overall(p);
      rows.push(run(p, pos, 5200 + i * 41));
    }
    const avg = (f: (o: Out) => number) => rows.reduce((a, o) => a + f(o), 0) / rows.length;
    console.log(
      `  ${pos.padEnd(7)} ${(ovrSum / 40).toFixed(1).padStart(7)}`
      + `  ${avg((o) => o.seasons).toFixed(1).padStart(7)}`
      + `  ${avg((o) => o.war).toFixed(1).padStart(8)}`
      + `  ${(avg((o) => o.peakPay) / 10000).toFixed(1).padStart(8)}억`
      + `  ${avg((o) => o.titles).toFixed(1).padStart(6)}`
      + `  ${avg((o) => o.hof).toFixed(0).padStart(8)}`,
    );
  }
}

table("투수 — 보직", "PITCHER", ["SP", "RP", "CP"], "power_p");
natural("투수 — 보직", "PITCHER", ["SP", "RP", "CP"], "power_p");
table("타자 — 포지션", "HITTER", ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"], "gap");
natural("타자 — 포지션", "HITTER", ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"], "gap");
