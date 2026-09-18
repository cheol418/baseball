/**
 * 서로 다른 칸의 숫자가 같은 사실을 말하는가.
 *
 * 한 줄 안의 모순은 `integrity.ts`가 잡는다. 여기서는 **칸을 건너뛴 모순**을 본다 —
 * 우승했다는데 마지막 시리즈는 패, 가을야구를 했다는데 정규시즌 8위,
 * 복무한 해에 1군 기록, 은퇴한 동기가 이듬해 타이틀 같은 것들.
 */
import { RNG } from "../src/lib/rng";
import { rollCandidate } from "../src/lib/player";
import { newGame } from "../src/lib/career";
import { PS_CUT } from "../src/lib/postseason";
import { TOURNAMENTS } from "../src/lib/national";
import { autoPlay } from "./autoplay";
import type { GameState } from "../src/lib/types";

type Bad = { rule: string; detail: string };
const bad: Bad[] = [];
const fail = (rule: string, detail: string) => bad.push({ rule, detail });
let careers = 0;

for (let i = 0; i < 100; i++) {
  const rng = new RNG(6600 + i * 23);
  const kind = i % 2 ? "HITTER" : "PITCHER";
  const pos = i % 2 ? "CF" : (i % 4 === 0 ? "SP" : "CP");
  const p = rollCandidate({ name: "표본", number: 1, kind, position: pos, bats: "R", throws: "R", styleId: i % 2 ? "gap" : "power_p", armSlot: i % 2 ? undefined : "OVER" }, rng);
  // 상무는 퓨처스리그에서 실제로 뛴다 — 기록이 없어야 하는 쪽은 현역이다
  const service = i % 2 ? "SANGMU" : "ACTIVE";
  const g: GameState = autoPlay(newGame(p, "DAG", i * 47), {
    nego: (["push", "accept", "arbitration"] as const)[i % 3],
    military: service,
  });
  careers++;

  /* 시즌 */
  let proSeasons = 0;
  for (const rec of g.seasons) {
    const tag = `${rec.year}(${rec.level})`;
    if (rec.level === "KBO" || rec.level === "MINOR") proSeasons++;
    // 현역으로 복무한 해에는 경기가 없다 (상무는 퓨처스리그에서 뛴다)
    if (rec.level === "ARMY" && service === "ACTIVE" && (rec.line as { g: number }).g > 0) {
      fail("현역 복무 시즌에 경기 기록", `${tag} ${(rec.line as { g: number }).g}경기`);
    }
    const ps = rec.ps;
    if (ps) {
      // 가을야구는 정규시즌 상위 팀만 간다
      if (rec.teamRank !== undefined && rec.teamRank > PS_CUT) {
        fail("가을야구 ↔ 정규시즌 순위", `${tag} ${rec.teamRank}위인데 가을야구`);
      }
      const last = ps.rounds[ps.rounds.length - 1];
      // 우승은 마지막 시리즈를 이겨야 한다
      if (ps.champion && last && !last.win) fail("우승 ↔ 마지막 시리즈", `${tag} ${last.name} 패인데 우승`);
      if (!ps.champion && last?.win && last.name.includes("한국시리즈")) {
        fail("한국시리즈 승 ↔ 우승", `${tag} ${last.name} 승인데 우승 아님`);
      }
      if (rec.champion !== undefined && rec.champion !== ps.champion) {
        fail("시즌 우승 표기 ↔ 가을야구", `${tag} ${rec.champion} vs ${ps.champion}`);
      }
    }
    // 올스타전을 치렀으면 올스타로 뽑힌 것이다
    if (rec.allStarGame && rec.allStar === false) fail("올스타전 ↔ 선정", tag);
  }
  if (g.serviceYears > proSeasons) {
    fail("서비스타임 ≤ 프로 시즌 수", `${g.serviceYears} > ${proSeasons}`);
  }

  /* 국제대회 */
  for (const r of g.intlResults) {
    const t = TOURNAMENTS[r.tournamentId];
    const tag = `${r.year} ${t.name}`;
    const want = r.rank === 1 ? "금" : r.rank === 2 ? "은" : null;
    if (want && r.medal !== want) fail("순위 ↔ 메달", `${tag} ${r.rank}위인데 ${r.medal ?? "메달 없음"}`);
    if (r.medal === "금" && r.rank !== 1) fail("금메달 ↔ 1위", `${tag} ${r.rank}위`);
    // 3·4위전이 없는 대회(WBC)는 동메달을 주지 않는다
    if (r.medal === "동" && !r.games.some((x) => x.round.includes("3·4위"))) {
      fail("동메달 ↔ 3·4위전", `${tag} 3·4위전 없이 동메달`);
    }
    // 결승에 갔으면 마지막 경기는 결승이다
    const fin = r.games[r.games.length - 1];
    if (r.rank === 1 && fin && !fin.won) fail("우승 ↔ 마지막 경기", `${tag} 마지막 경기 패`);
    if (!r.games.length) fail("대회에 경기가 없다", tag);
  }

  /* 동기 */
  for (const r of g.rivals ?? []) {
    if (r.retiredYear && r.seasons > 30) fail("동기 시즌 수", `${r.player.name} ${r.seasons}시즌`);
    if (r.titles < 0 || r.mvp < 0) fail("동기 수상 음수", `${r.player.name}`);
    if (r.mvp > r.titles + r.seasons) fail("동기 MVP ≤ 커리어", `${r.player.name} MVP ${r.mvp}`);
  }

  /* 은퇴 */
  if (g.phase === "SECOND_LIFE" || g.hofVote) {
    const lastYear = g.seasons[g.seasons.length - 1]?.year ?? 0;
    if (lastYear > g.year) fail("은퇴 후 시즌", `${lastYear} > ${g.year}`);
  }
}

const byRule = new Map<string, Bad[]>();
for (const b of bad) byRule.set(b.rule, [...(byRule.get(b.rule) ?? []), b]);
console.log(`■ 커리어 ${careers}개 — 칸을 건너뛴 모순 ${bad.length}건 (0이어야 한다)`);
Array.from(byRule).sort((a, b) => b[1].length - a[1].length).forEach(([rule, list]) => {
  console.log(`  ${rule.padEnd(24)} ${String(list.length).padStart(5)}건   예: ${list[0].detail}`);
});
