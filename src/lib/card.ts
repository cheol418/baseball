/**
 * 은퇴 성적표 — **밖으로 나가는 한 장.**
 *
 * 도감이 "내 안에 쌓이는 것"이라면 이쪽은 "남에게 보여줄 수 있는 것"이다.
 * 한 커리어를 열다섯 시즌 걸어놓고 보여줄 게 스크린샷뿐이면 아깝다.
 *
 * **서버가 없다** — 정적 번들로 앱을 싸야 하므로(`output: "export"`)
 * 공유는 전부 기기 안에서 끝난다. 여기서는 React도 canvas도 모르는
 * **순수한 모델**만 만들고, 그리는 일과 내보내는 일은 `components/share.tsx`가 맡는다.
 *
 * 그래서 이 파일은 스크립트에서도 그대로 부를 수 있다 (`scripts/cardcheck.ts`).
 */
import { careerTotals, computeHof, formatMoney, retirementHonors } from "./career";
import { nickname } from "./records";
import { fmtIP, MAJOR_TITLES } from "./sim";
import { POSITION_LABEL } from "./player";
import { teamById } from "./teams";
import type { GameState } from "./types";

/**
 * 공유 카드에 찍히는 주소 — **한 곳에서만 적는다.**
 * 이미지 바닥과 복사 텍스트 두 군데에 들어가므로 따로 두면 금방 갈라진다.
 * 도메인이 정해지면 여기만 고친다.
 */
export const SITE = "https://baseball-nine.vercel.app";

export interface CardStat { label: string; value: string }

export interface ShareCard {
  name: string;
  number: number;
  /** 마지막 소속이 아니라 **가장 오래 몸담은 팀** — 한 장으로 기억되는 색이다 */
  teamId: string;
  teamShort: string;
  color: string;
  position: string;
  nickname: string | null;
  tier: string;
  from: number;
  to: number;
  age: number;
  seasons: number;
  stats: CardStat[];
  badges: string[];
  score: number;
  earned: string;
}

/**
 * `careerTotals`는 `kind`로 갈라지는 두 모양을 **합집합으로** 돌려준다
 * (오버로드가 아니다). 호출부에서 어느 쪽인지 알고 있으므로 여기서 좁힌다.
 */
type Totals = ReturnType<typeof careerTotals>;
type HitTotals = Extract<Totals, { avg: number }>;
type PitTotals = Extract<Totals, { era: number }>;

const comma = (n: number) => Math.round(n).toLocaleString();
const fmt3 = (v: number) => (v === 0 ? ".000" : v.toFixed(3).replace(/^0/, ""));

/**
 * 커리어 한 장.
 *
 * **1군 기록만 센다** — `careerTotals(.., "KBO")`가 2군을 오간 시즌도
 * `byLevel`로 갈라서 더한다. 성적표에 2군 홈런이 섞이면 숫자가 거짓이 된다.
 */
export function shareCard(s: GameState): ShareCard {
  const p = s.player;
  const hof = computeHof(s);
  const kbo = s.seasons.filter((r) => r.level === "KBO" || r.byLevel?.KBO);

  /*
   * 팀은 **가장 오래 있었던 곳**이다. 마지막 소속을 쓰면 서른일곱에 한 해
   * 얹혀 간 팀의 색으로 열다섯 해가 칠해진다. `retirementHonors`도 같은 기준이다.
   */
  const byTeam = new Map<string, number>();
  for (const r of kbo) byTeam.set(r.teamId, (byTeam.get(r.teamId) ?? 0) + 1);
  const teamId = [...byTeam.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? s.contract?.teamId ?? "SEO";
  const team = teamById(teamId);

  const stats: CardStat[] = [];
  if (p.kind === "HITTER") {
    const t = careerTotals(s.seasons, "HITTER", "KBO") as HitTotals;
    stats.push(
      { label: "타율", value: fmt3(t.avg) },
      { label: "안타", value: comma(t.h) },
      { label: "홈런", value: comma(t.hr) },
      { label: "타점", value: comma(t.rbi) },
      { label: "도루", value: comma(t.sb) },
      { label: "WAR", value: t.war.toFixed(1) },
    );
  } else {
    const t = careerTotals(s.seasons, "PITCHER", "KBO") as PitTotals;
    /*
     * 여섯째 칸은 **그 투수가 한 일**을 적는다.
     *
     * 세이브로 고정해 두면 서른 홀드를 한 필승조가 "세이브 0"으로 찍혀
     * 카드가 제 값을 깎는다 (실제로 겪음). 선발은 둘 다 0이라 자리가
     * 통째로 비므로 WHIP을 대신 넣는다.
     */
    const relief = t.sv + t.hld;
    const sixth: CardStat = relief >= 30
      ? (t.sv >= t.hld
        ? { label: "세이브", value: comma(t.sv) }
        : { label: "홀드", value: comma(t.hld) })
      : { label: "WHIP", value: t.whip.toFixed(2) };
    stats.push(
      { label: "승-패", value: `${t.w}-${t.l}` },
      { label: "ERA", value: t.era.toFixed(2) },
      { label: "탈삼진", value: comma(t.so) },
      sixth,
      { label: "이닝", value: fmtIP(t.ip) },
      { label: "WAR", value: t.war.toFixed(1) },
    );
  }

  // ── 훈장 — 흔한 것(올스타)은 빼고, 커리어를 가르는 것만 위에서부터
  const tally: Record<string, number> = {};
  for (const r of kbo) for (const a of r.awards ?? []) tally[a] = (tally[a] ?? 0) + 1;
  const titles = MAJOR_TITLES.filter((t) => t !== "정규시즌 MVP")
    .reduce((a, t) => a + (tally[t] ?? 0), 0);
  const golds = (s.intlResults ?? []).filter((r) => r.medal === "금").length;
  const honor = retirementHonors(s);

  const badges: string[] = [];
  const put = (ok: unknown, text: string) => { if (ok) badges.push(text); };
  put(s.hofVote?.inducted, "🏛️ 명예의 전당");
  put(honor, honor ? `${honor.kind === "영구결번" ? "🎽" : "🎤"} ${teamById(honor.teamId).short} ${honor.kind}` : "");
  put(tally["정규시즌 MVP"], `🏅 MVP ${tally["정규시즌 MVP"]}회`);
  put(tally["골든글러브"], `🧤 골든글러브 ${tally["골든글러브"]}회`);
  put(tally["신인왕"], "🌱 신인왕");
  put(hof.rings, `💍 우승 ${hof.rings}회`);
  put(golds, `🥇 금메달 ${golds}회`);
  put(titles, `👑 타이틀 ${titles}개`);

  return {
    name: p.name,
    number: p.number,
    teamId, teamShort: team.short, color: team.color,
    position: POSITION_LABEL[p.position] ?? p.position,
    nickname: nickname(s),
    tier: hof.tier,
    from: kbo[0]?.year ?? s.seasons[0]?.year ?? s.year,
    to: kbo[kbo.length - 1]?.year ?? s.year,
    age: p.age,
    seasons: hof.seasons,
    stats,
    badges: badges.slice(0, 6),
    score: hof.score,
    earned: formatMoney(hof.earned),
  };
}

/**
 * 붙여넣을 수 있는 한 덩어리.
 *
 * 이미지를 못 받는 자리(디스코드 텍스트 채널·커뮤니티 댓글)가 있고,
 * 그림 한 장보다 **숫자를 그대로 읽는 쪽**이 반가운 사람도 있다.
 */
export function cardText(c: ShareCard, url: string): string {
  const head = `⚾ ${c.name} · ${c.teamShort} ${c.position}${c.nickname ? ` · ${c.nickname}` : ""}`;
  const span = `${c.from}–${c.to} · 1군 ${c.seasons}시즌 · ${c.age}세 은퇴`;
  const line = c.stats.map((x) => `${x.label} ${x.value}`).join(" · ");
  const rows = [head, span, line];
  if (c.badges.length) rows.push(c.badges.join(" · "));
  rows.push(`명예의 전당 점수 ${c.score} — ${c.tier}`);
  // 그림에는 안 넣는다 — 한 장에 다 담으면 빽빽해진다. 글에는 자리가 있다
  rows.push(`통산 연봉 ${c.earned}`);
  rows.push(`\n야구는 9회말 2아웃부터\n${url}`);
  return rows.join("\n");
}
