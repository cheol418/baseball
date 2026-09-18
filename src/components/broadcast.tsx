"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt2, fmt3, fmtIP } from "./stats";
import { isHitterLine, mergeLines } from "@/lib/sim";
import { TOURNAMENTS, clutchGameIndex } from "@/lib/national";
import { formatMoney } from "@/lib/career";
import { roleTier } from "@/lib/roles";
import { RNG } from "@/lib/rng";
import type { Clutch, ClutchResult } from "@/lib/clutch";
import { ClutchCard, ClutchReveal } from "@/components/clutch";
import { FORM_STYLE, formNote, judgeMonthForm, type MonthForm } from "@/lib/form";
import { teamById } from "@/lib/teams";
import type {
  AmateurTournament, GameState, HitterLine, IntlGame, MonthLine, PitcherLine, StatLine, TournamentSlot,
} from "@/lib/types";

export type BroadcastKind = "H1" | "H2" | "PS" | "HS" | "INTL";

type Step =
  /** `level`·`role`은 **그 달의 자리**다 — 반기가 끝난 시점의 소속으로 적으면,
      8월에 내려간 선수의 5월 카드에까지 "2군"이 붙는다 */
  | {
      kind: "month"; label: string; line: StatLine; cume: StatLine; form: MonthForm; note: string;
      potm?: boolean; level?: MonthLine["level"]; role?: string;
    }
  /** 승부처 — 중계가 그 달에 닿으면 멈춰서 선택을 받고, 그 자리에서 결과가 열린다 */
  | {
      kind: "clutch"; situation: Clutch; r?: ClutchResult; where?: "AS" | "INTL" | "PS" | "AM";
      level?: MonthLine["level"]; role?: string;
    }
  | { kind: "card"; icon: string; title: string; body: string; tone: "good" | "bad" | "epic" | "neutral" }
  | { kind: "round"; name: string; opponent: string; win: boolean; score: string }
  | { kind: "hs"; t: AmateurTournament }
  /** 엔트리 이동 통보 — 콜업·말소는 커리어가 꺾이는 순간이라 따로 보여준다 */
  | {
      kind: "move"; move: NonNullable<MonthLine["move"]>; month: string; teamName: string;
      fromRole: string; fromLabel: string; toLabel: string;
    }
  /** 올스타전 · 국제대회 한 경기 */
  | { kind: "game"; tag: string; round: string; opponent: string; won: boolean; score: string; line: StatLine; mvp?: boolean; appeared?: boolean };



const MONTH_MS = 1500;
const CARD_MS = 2000;

/* ------------------------------------------------------------------ */

/** 한 달 성적을 3칸으로 요약 */
function cells(line: StatLine): { k: string; v: string }[] {
  if (isHitterLine(line)) {
    return [
      { k: "AVG", v: line.ab ? fmt3(line.avg) : "-" },
      { k: "HR", v: String(line.hr) },
      { k: "RBI", v: String(line.rbi) },
      { k: "OPS", v: line.ab ? fmt3(line.ops) : "-" },
    ];
  }
  const p = line as PitcherLine;
  return [
    { k: "ERA", v: p.ip ? fmt2(p.era) : "-" },
    { k: "IP", v: fmtIP(p.ip) },
    { k: p.sv > p.hld ? "SV" : p.hld > 0 ? "HLD" : "W-L", v: p.sv > p.hld ? String(p.sv) : p.hld > 0 ? String(p.hld) : `${p.w}-${p.l}` },
    { k: "SO", v: String(p.so) },
  ];
}

/** 그해 국제대회를 경기 단위로 펼친다 — 해당 시점에 열리는 대회만 */
function intlSteps(g: GameState, slot: TournamentSlot): Step[] {
  const intl = g.intlResults.find((r) => r.year === g.year);
  if (!intl) return [];
  const t = TOURNAMENTS[intl.tournamentId];
  if (t.slot !== slot) return [];

  const steps: Step[] = intl.games.map((gm) => ({
    kind: "game" as const, tag: `${t.icon} ${t.name}`, round: gm.round,
    opponent: gm.opponent, won: gm.won, score: gm.score, line: gm.line,
    appeared: gm.appeared,
  }));
  // 승부처는 **실제로 나간 마지막 경기** 직전에 온다 — 기록을 얹는 자리와 같은 경기다
  const ci = clutchGameIndex(intl.games);
  if (intl.clutchSituation && ci >= 0) {
    steps.splice(ci, 0, {
      kind: "clutch", situation: intl.clutchSituation, r: intl.clutch, where: "INTL",
    });
  }
  steps.push({
    kind: "card",
    icon: intl.medal === "금" ? "🥇" : intl.medal === "은" ? "🥈" : intl.medal === "동" ? "🥉" : t.icon,
    title: `${t.name} ${intl.medal ? `${intl.medal}메달` : `${intl.rank}위`}`,
    body: intl.exempted ? `${intl.note} — 병역 면제 대상이 되었습니다!` : intl.note,
    tone: intl.exempted ? "epic" : intl.medal ? "good" : "neutral",
  });
  return steps;
}

function buildSteps(g: GameState, kind: BroadcastKind): Step[] {
  // 태극마크는 리그 일정과 분리해 따로 보여준다
  if (kind === "INTL") {
    const intl = g.intlResults.find((r) => r.year === g.year);
    if (!intl) return [];
    const t = TOURNAMENTS[intl.tournamentId];
    return [
      {
        kind: "card", icon: t.icon, title: `${t.name} 개막`, tone: "epic",
        body: `${g.year}년 ${t.month}. 태극마크를 달고 ${intl.games.length}개국과 맞섭니다.`
          + (t.exemption ? ` ${t.exemption}.` : ""),
      },
      ...intlSteps(g, t.slot),
    ];
  }

  if (kind === "HS") {
    const rec = g.lastSeasonIndex !== null ? g.seasons[g.lastSeasonIndex] : null;
    const list = rec?.tournaments ?? [];
    const steps: Step[] = list.map((t) => ({ kind: "hs" as const, t }));
    // 아마추어 승부처는 대회들을 다 치른 뒤, 총평 직전에 온다
    if (rec?.clutchSituation) {
      steps.push({ kind: "clutch", situation: rec.clutchSituation, r: rec.clutch, where: "AM" });
    }
    const best = list.reduce((a, b) => (RANK[b.placement] > RANK[a.placement] ? b : a), list[0]);
    if (best) {
      const total = list.reduce((a, t) => a + RANK[t.placement], 0);
      steps.push({
        kind: "card",
        icon: total >= 9 ? "🏆" : total >= 5 ? "⚾" : "🌧️",
        title: best.placement === "우승" ? "전국 제패" : `최고 성적 ${best.placement}`,
        body: total >= 9 ? "스카우트들이 주목하는 시즌이었습니다."
          : total >= 5 ? "전국 무대에서 이름을 알렸습니다."
          : "아쉬움이 남는 고교 마지막 시즌이었습니다.",
        tone: total >= 9 ? "epic" : total >= 5 ? "good" : "neutral",
      });
    }
    return steps;
  }
  if (kind === "PS") {
    const ps = g.postseason;
    if (!ps) return [];
    const steps: Step[] = [{
      kind: "card", icon: "🍁", title: "가을야구 개막", tone: "epic",
      body: `정규시즌 ${ps.seed}위. ${teamById(g.contract?.teamId ?? "").name}의 가을이 시작됩니다.`,
    }];
    steps.push(...ps.rounds.map((r) => ({
      kind: "round" as const, name: r.name, opponent: r.opponent, win: r.win, score: r.score,
    })));
    if (ps.clutchSituation) {
      steps.splice(Math.max(1, steps.length - 1), 0, {
        kind: "clutch", situation: ps.clutchSituation, r: ps.clutch, where: "PS",
      });
    }
    steps.push(ps.champion
      ? { kind: "card", icon: "🏆", title: "한국시리즈 우승", body: `${teamById(g.contract?.teamId ?? "").name}가 정상에 올랐습니다!`, tone: "epic" }
      : { kind: "card", icon: "🍁", title: "가을야구 종료", body: "다음을 기약합니다.", tone: "neutral" });
    return steps;
  }

  const months = g.monthLines ?? [];
  const base: StatLine[] = kind === "H2" && g.halfLine ? [g.halfLine] : [];
  // 3월에 열리는 대회(WBC)는 개막 전이므로 월별 기록보다 앞에 온다
  const steps: Step[] = [];
  const teamName = g.contract ? teamById(g.contract.teamId).name : "";
  steps.push({
    kind: "card",
    icon: kind === "H1" ? "⚾" : "🔥",
    title: kind === "H1" ? `${g.year} 시즌 개막` : "후반기 시작",
    tone: "good",
    body: kind === "H1"
      ? `${teamName} · ${g.seasonLevel === "KBO" ? "1군" : "2군"} ${g.seasonRole}(으)로 한 해를 시작합니다.`
      : "짧은 휴식을 마치고 순위 싸움에 들어갑니다.",
  });
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const form = judgeMonthForm(m.line, m.level);
    // 승부처는 그 달 기록을 만든 사건이므로 월 카드보다 먼저 온다
    if (m.clutchSituation) {
      steps.push({ kind: "clutch", situation: m.clutchSituation, r: m.clutch, level: m.level, role: m.role });
    }
    steps.push({
      kind: "month",
      label: m.label,
      line: m.line,
      cume: mergeLines([...base, ...months.slice(0, i + 1).map((x) => x.line)]),
      form,
      note: formNote(m.line, form, g.seed + i),
      potm: m.potm,
      level: m.level,
      role: m.role,
    });
    // 그 달이 끝나고 엔트리가 바뀌었다면 바로 이어서 통보한다
    if (m.move) {
      const next = months[i + 1];
      steps.push({
        kind: "move", move: m.move, month: m.label, teamName,
        fromRole: m.role,
        fromLabel: `${m.level === "KBO" ? "1군" : "2군"} ${m.role}`,
        toLabel: `${(next?.level ?? m.level) === "KBO" ? "1군" : "2군"} ${m.move.role}`,
      });
    }
  }

  if (kind === "H1") {
    /**
     * 올스타 선정 발표는 여기서 하지 않는다.
     *
     * 이 중계는 `HALF_REVIEW`에서 그려지는데, 올스타 판정은 그 다음 단계인
     * `FINISH_HALF`에서 난다 — 전반기 승부처 결과까지 반영해서 뽑아야 하기 때문이다.
     * 여기서 `g.allStar`를 읽으면 **아직 판정 전의 false**를 읽어,
     * 뽑힌 선수에게도 늘 "불발"이라고 말한 뒤 올스타전으로 내보내게 된다.
     * (실제로 겪음: 전반기 중계 2000회 전부 "불발" 표시, 그중 15%가 실제 선정)
     * 선정 발표와 올스타전은 `ALL_STAR` 화면이 맡는다.
     */
    steps.push({
      kind: "card", icon: "🛋️", title: "전반기 종료",
      body: "전반기가 끝났습니다. 올스타 브레이크로 넘어갑니다.", tone: "neutral",
    });
  } else {
    const rank = g.teamRank;
    steps.push(rank
      ? {
          kind: "card", icon: rank <= 5 ? "🍁" : "🏁",
          title: `정규시즌 ${rank}위`,
          body: rank <= 5 ? "가을야구 진출!" : "시즌이 끝났습니다.",
          tone: rank <= 5 ? "good" : "neutral",
        }
      : { kind: "card", icon: "🏁", title: "시즌 종료", body: "한 해가 마무리되었습니다.", tone: "neutral" });
  }
  return steps;
}

/* ------------------------------------------------------------------ */

/**
 * 중계 시작 전 로딩 화면.
 *
 * 계산은 즉시 끝나지만, 결과가 툭 튀어나오면 한 해가 없었던 일처럼 느껴진다.
 * 그 자리에 일정표를 채워 넣어 **기다림 자체를 콘텐츠로** 만든다.
 */
function LoadingPanel({ title, subtitle, rows, tail }: {
  title: string; subtitle: string; rows: { when: string; what: string }[]; tail: string;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= rows.length) return;
    const t = setTimeout(() => setN((v) => v + 1), 260);
    return () => clearTimeout(t);
  }, [n, rows.length]);
  return (
    <div className="pop text-center">
      <div className="text-[10px] font-black uppercase tracking-[0.24em] opacity-55">{subtitle}</div>
      <div className="mt-1 text-[22px] font-black">{title}</div>
      <div className="mt-4 flex flex-col gap-1.5 text-left">
        {rows.map((r, i) => (
          <div
            key={r.when + r.what}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 transition-opacity duration-300 ${
              i < n ? "bg-white/12 opacity-100" : "bg-white/5 opacity-30"
            }`}
          >
            <span className="w-10 shrink-0 text-[10.5px] font-black opacity-60">{r.when}</span>
            <span className="text-[12.5px] font-extrabold">{r.what}</span>
            {i < n && <span className="ml-auto text-[11px] opacity-70">✓</span>}
          </div>
        ))}
      </div>
      <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-white/70 transition-[width] duration-300 ease-out"
          style={{ width: `${(n / Math.max(1, rows.length)) * 100}%` }}
        />
      </div>
      <p className="mt-3 text-[11.5px] opacity-70">{tail}</p>
    </div>
  );
}

/**
 * 대회 현황판.
 *
 * 경기 카드만 넘어가면 "지금 몇 라운드인지, 올라가고 있는지"가 안 보인다.
 * 조별리그는 전적으로, 녹아웃은 대진으로 진행 상황을 계속 띄워둔다.
 */
/**
 * `done`은 **결과가 이미 공개된 경기 수**, `current`는 지금 카드에 떠 있는 경기다.
 * 둘을 합쳐 세면 현황판이 아래 카드보다 먼저 승패를 말한다 —
 * "1승 0패"를 읽고 나서 그 1차전 카드를 보게 된다. (실제로 겪음)
 */
function TourneyBoard({ games, done, current }: { games: IntlGame[]; done: number; current: number }) {
  const group = games.filter((x) => x.stage === "GROUP" || x.stage === "SUPER");
  const knock = games.filter((x) => x.stage === "KNOCKOUT" || x.stage === "FINAL");
  const gW = group.filter((x) => games.indexOf(x) < done && x.won).length;
  const gL = group.filter((x) => games.indexOf(x) < done && !x.won).length;
  // 조별리그를 다 치렀고 녹아웃이 있으면 그때부터 "통과" — 결과를 미리 말하는 게 아니다
  const groupDone = done >= group.length && knock.length > 0;

  return (
    <div className="mb-3 rounded-xl bg-black/25 px-3 py-2.5">
      {group.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] opacity-55">
            {group[0].stage === "SUPER" ? "슈퍼라운드" : "조별리그"}
          </span>
          <span className="tabular text-[11.5px] font-extrabold">
            {gW}승 {gL}패
          </span>
          <span className="ml-auto flex gap-1">
            {group.map((x) => {
              const idx = games.indexOf(x);
              return (
                <span
                  key={x.round}
                  // 지금 치르는 경기는 흰 점 — 아직 결과를 말하지 않는다
                  className={`h-2 w-2 rounded-full ${idx === current ? "animate-pulse" : ""}`}
                  style={{
                    background: idx === current ? "rgba(255,255,255,0.85)"
                      : idx >= done ? "rgba(255,255,255,0.18)"
                        : x.won ? "#8cc79a" : "#cf8d7f",
                  }}
                />
              );
            })}
          </span>
          {groupDone && <span className="ml-1 text-[10px] font-bold opacity-70">통과</span>}
        </div>
      )}
      {knock.length > 0 && (
        <div className="mt-2 flex items-center gap-1">
          {knock.map((x) => {
            const idx = games.indexOf(x);
            const shown = idx < done;
            const now = idx === current;
            return (
              <span key={x.round} className="flex flex-1 items-center gap-1">
                <span
                  className={`flex-1 truncate rounded-md px-1.5 py-1 text-center text-[9.5px] font-extrabold transition ${
                    now ? "bg-white/25"
                      : shown ? (x.won ? "bg-[#8cc79a]/25" : "bg-[#cf8d7f]/25")
                        : "bg-white/8 opacity-45"
                  }`}
                >
                  {x.round}
                </span>
                {x !== knock[knock.length - 1] && <span className="opacity-35">›</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 달마다 걸리는 일정 문구.
 *
 * KBO는 **3연전 단위**로 돌고 월요일은 쉰다 — 홈 연전은 세 시리즈를 붙여도
 * 9경기가 최대다. "홈 10연전"은 있을 수 없는 일정이다. (실제로 겪음)
 * 고정 문구 네 줄만 두면 매 시즌 같은 화면이 뜨므로, 그해 시드로 골라 쓴다.
 * 실제 달력에 있는 것만 적는다 — 어린이날·광복절 3연전, 장마철 더블헤더,
 * 7월 31일 트레이드 마감, 9월 1일 확대 엔트리.
 */
const SCHEDULE: Record<string, string[]> = {
  "4": ["개막 시리즈", "개막전 홈 3연전", "시즌 첫 원정 3연전", "4월 마지막 주중 3연전", "쌀쌀한 저녁 경기"],
  "5": ["어린이날 홈 3연전", "홈 9연전", "원정 6연전", "주말 라이벌 3연전", "5월 첫 주중 3연전"],
  "6": ["장마철 원정", "우천 취소 · 더블헤더", "전반기 순위 굳히기", "6월 홈 6연전", "무더위 시작"],
  "7": ["올스타 브레이크 직전", "트레이드 마감 직전", "전반기 마지막 3연전", "폭염 속 원정 3연전"],
  "8": ["폭염 속 연전", "광복절 홈 3연전", "8월 원정 9연전", "우천 순연 · 더블헤더", "8월 막바지 주말 3연전"],
  "9": ["순위 싸움", "확대 엔트리", "9월 맞대결 3연전", "가을야구 매직넘버", "잔여 경기 편성"],
  "10": ["시즌 마지막 경기", "정규시즌 최종전", "잔여 경기 소화", "10월 첫 주 홈 3연전"],
};
/** 2군은 일정이 다르다 — 1군 콜업을 기다리는 달들이다 */
const SCHEDULE_MINOR: Record<string, string[]> = {
  "4": ["퓨처스리그 개막", "퓨처스 홈 3연전", "북부리그 원정"],
  "5": ["퓨처스 홈 6연전", "1군 콜업 대기", "상무와 3연전"],
  "6": ["장마철 순연", "퓨처스 원정 3연전", "1군 코칭스태프 방문"],
  "7": ["퓨처스 올스타 브레이크", "한여름 낮경기", "콜업 경쟁"],
  "8": ["퓨처스 홈 6연전", "폭염 속 낮경기", "1군 엔트리 변동"],
  "9": ["확대 엔트리 · 콜업", "퓨처스 순위 싸움", "시즌 막바지"],
  "10": ["퓨처스리그 폐막", "마무리캠프 명단", "시즌 마지막 경기"],
};
const TAIL_H1 = [
  "경기 일정과 선수 기록을 계산하고 있습니다.",
  "개막까지 얼마 남지 않았습니다.",
  "긴 시즌의 첫 넉 달입니다.",
  "라인업과 로테이션을 맞추는 중입니다.",
];
const TAIL_H2 = [
  "가을야구가 걸린 두 달입니다.",
  "여기서부터는 한 경기가 순위를 바꿉니다.",
  "남은 경기가 얼마 없습니다.",
  "확대 엔트리로 벤치가 두꺼워집니다.",
];

/** 그해 일정 — 같은 시즌이면 늘 같게, 시즌이 바뀌면 다르게 */
function scheduleRows(g: GameState, months: string[]): { when: string; what: string }[] {
  const rng = new RNG(g.seed + g.year * 977);
  const pool = g.seasonLevel === "MINOR" ? SCHEDULE_MINOR : SCHEDULE;
  return months.map((m) => ({ when: `${m}월`, what: rng.pick(pool[m] ?? ["경기"]) }));
}

/** 중계 종류별 로딩 화면 내용 */
function loadingOf(g: GameState, kind: BroadcastKind): { title: string; subtitle: string; rows: { when: string; what: string }[]; tail: string } | null {
  if (kind === "H1") {
    return {
      subtitle: `${g.year} · ${g.seasonLevel === "MINOR" ? "퓨처스리그" : "정규시즌"}`,
      title: "전반기 일정을 짭니다",
      rows: scheduleRows(g, ["4", "5", "6", "7"]),
      tail: new RNG(g.seed + g.year * 31).pick(TAIL_H1),
    };
  }
  if (kind === "H2") {
    return {
      subtitle: `${g.year} · ${g.seasonLevel === "MINOR" ? "퓨처스리그" : "순위 싸움"}`,
      title: "후반기가 시작됩니다",
      rows: scheduleRows(g, ["8", "9", "10"]),
      tail: new RNG(g.seed + g.year * 53).pick(TAIL_H2),
    };
  }
  if (kind === "PS") {
    return {
      subtitle: `${g.year} · 포스트시즌`,
      title: "가을야구가 열립니다",
      rows: (g.postseason?.rounds ?? []).map((r) => ({ when: "", what: `${r.name} vs ${r.opponent}` })),
      tail: "한 경기에 한 해가 걸려 있습니다.",
    };
  }
  if (kind === "INTL") {
    const intl = g.intlResults.find((r) => r.year === g.year);
    if (!intl) return null;
    const t = TOURNAMENTS[intl.tournamentId];
    const seen = new Set<string>();
    const rows: { when: string; what: string }[] = [];
    for (const gm of intl.games) {
      const label = gm.stage === "GROUP" ? "조별리그"
        : gm.stage === "SUPER" ? "슈퍼라운드"
          : gm.stage === "KNOCKOUT" ? "녹아웃" : "결승";
      if (seen.has(label)) continue;
      seen.add(label);
      rows.push({ when: "", what: label });
    }
    return {
      subtitle: `${g.year} · 국가대표`,
      title: `${t.name} 대진이 나왔습니다`,
      rows,
      tail: `${t.month} 개최 · 태극마크를 달고 나섭니다.`,
    };
  }
  if (kind === "HS") {
    const rec = g.lastSeasonIndex !== null ? g.seasons[g.lastSeasonIndex] : null;
    return {
      subtitle: `${g.year} · ${rec?.level === "COLLEGE" ? "대학" : "고교"}`,
      title: "전국대회가 시작됩니다",
      rows: (rec?.tournaments ?? []).map((t) => ({ when: "", what: t.name })),
      tail: "스탠드에 프로 스카우트들이 앉아 있습니다.",
    };
  }
  return null;
}

export function Broadcast({ g, kind, onDone, onAction, busy = false }: {
  g: GameState; kind: BroadcastKind; onDone: () => void;
  /** 중계 도중 상태를 바꿔야 할 때 (승부처) */
  onAction?: (a: { type: "RESOLVE_CLUTCH"; choice: string; where?: "AS" | "INTL" | "PS" | "AM" }) => void;
  busy?: boolean;
}) {
  const steps = useMemo(() => buildSteps(g, kind), [g, kind]);
  const [i, setI] = useState(0);
  const loading = useMemo(() => loadingOf(g, kind), [g, kind]);
  // 로딩 화면을 먼저 보여주고 중계로 넘어간다
  const [warmup, setWarmup] = useState(() => !!loading);
  useEffect(() => {
    if (!warmup) return;
    const t = setTimeout(() => setWarmup(false), 1500);
    return () => clearTimeout(t);
  }, [warmup]);
  const team = g.contract ? teamById(g.contract.teamId) : null;
  const accent = team?.color ?? "#0e2a4d";

  useEffect(() => {
    if (warmup) return;
    if (i >= steps.length) {
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
    // 엔트리 이동은 그 달이 끝난 자리에서 확인을 받는다 —
    // 중계가 다 끝난 뒤에 알려주면 "언제 바뀐 건지" 알 수 없다
    // 승부처는 유저가 직접 고른 결과다 — 지나가버리면 고른 의미가 없다
    if (steps[i].kind === "move" || steps[i].kind === "clutch") return;
    const dur = steps[i].kind === "month" ? MONTH_MS : CARD_MS;
    const t = setTimeout(() => setI((v) => v + 1), dur);
    return () => clearTimeout(t);
  }, [i, steps, onDone, warmup]);

  const amateurLabel = (g.lastSeasonIndex !== null && g.seasons[g.lastSeasonIndex]?.level === "COLLEGE") ? "대학" : "고교";
  const intlOfYear = g.intlResults.find((r) => r.year === g.year);
  const title = kind === "HS" ? `${g.year} ${amateurLabel} 전국대회`
    : kind === "PS" ? `${g.year} 가을야구`
    : kind === "INTL" ? `${g.year} ${intlOfYear ? TOURNAMENTS[intlOfYear.tournamentId].name : "국가대표"}`
    : kind === "H1" ? `${g.year} 전반기` : `${g.year} 후반기`;
  /**
   * 뱃지는 **지금 보고 있는 달의 자리**를 말한다.
   *
   * `g.seasonLevel`은 반기가 다 끝난 뒤의 소속이다. 그걸 그대로 쓰면
   * 8월에 1군으로 올라간 선수의 5월 카드에도 "1군 주전"이 붙고,
   * 반대로 10월에 내려간 선수는 중계 내내 "2군"으로 찍힌다. (실제로 겪음)
   * 자리를 모르는 단계(총평 카드 등)는 **직전에 지나온 달**을 그대로 쓴다.
   */
  const seat = (() => {
    for (let k = Math.min(i, steps.length - 1); k >= 0; k--) {
      const st = steps[k];
      if ((st.kind === "month" || st.kind === "clutch") && st.level) {
        return { level: st.level, role: st.role };
      }
    }
    return { level: g.seasonLevel, role: g.seasonRole ?? undefined };
  })();
  const levelText = kind === "INTL" ? "국가대표"
    : seat.level === "KBO" ? "1군" : seat.level === "MINOR" ? "2군" : null;
  /**
   * 화면에 그리는 인덱스는 따로 둔다.
   *
   * `i`는 마지막 단계를 지나 `steps.length`까지 한 칸 더 올라간다(정리하는 중).
   * 그 값을 그대로 key에 쓰면 **마지막 카드가 다시 마운트돼 등장 연출을 한 번 더
   * 재생한다** — 같은 장면이 두 번 뜬 것처럼 보인다. (실제로 겪음)
   */
  const cur = Math.min(i, steps.length - 1);
  /** 결과가 이미 공개된 경기 수 — 현황판은 지금 카드보다 앞서 가면 안 된다 */
  const gamesShown = steps.slice(0, cur).filter((x) => x.kind === "game").length;
  const flushing = i >= steps.length;
  const step = steps[cur];
  if (!step) return null;
  const stepMs = step.kind === "month" ? MONTH_MS : CARD_MS;

  return (
    <div className="flex min-h-[62vh] flex-col justify-center px-4 py-6">
      <div className="ballpark relative overflow-hidden rounded-2xl text-white shadow-lg"
        style={{ background: `linear-gradient(150deg, ${accent}, ${accent}dd 60%, #06182c)` }}>
        {/* 헤더 */}
        <div className="relative flex items-center justify-between px-4 pt-4">
          <div className="min-w-0">
            <div className="text-[9.5px] font-black uppercase tracking-[0.18em] opacity-60">Live</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-black">{title}</span>
              {levelText && (
                <span className="shrink-0 rounded bg-white/20 px-1.5 py-[1px] text-[9.5px] font-black">
                  {levelText}{kind !== "INTL" && seat.role ? ` ${seat.role}` : ""}
                </span>
              )}
            </div>
          </div>
          <button onClick={onDone} className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold hover:bg-white/25">
            건너뛰기
          </button>
        </div>

        {/* 진행 표시 — 국제대회는 남은 경기 수가 결과를 알려주므로 칸을 나누지 않는다 */}
        <div className="mt-3 flex gap-1 px-4">
          {(kind === "INTL" ? [0] : steps).map((_, idx) => {
            // 로딩 화면이 떠 있는 동안에는 채우지 않는다. 여기서 애니메이션을
            // 걸어두면 첫 칸만 로딩 시간(1.5초)까지 얹혀 혼자 느리게 찬다.
            const active = !warmup && idx === cur && !flushing;
            return (
              <span key={idx} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
                <span
                  // 그 칸이 차례가 될 때만 다시 마운트한다 — `i`를 섞으면 매 단계마다
                  // 모든 칸의 애니메이션이 처음부터 다시 돈다
                  key={`${idx}-${active ? "on" : "off"}`}
                  className="block h-full rounded-full bg-white"
                  style={
                    idx < cur || flushing ? { width: "100%", opacity: 0.55 }
                    : active && step.kind !== "move" && step.kind !== "clutch"
                      ? { animation: `fillBar ${stepMs}ms linear forwards` }
                    : active ? { width: "100%" }
                    : { width: 0 }
                  }
                />
              </span>
            );
          })}
        </div>

        <div className="relative px-4 pb-5 pt-4">
          {/* 국제대회는 대회 현황을 계속 띄워둔다 — 어디까지 왔는지가 보여야 한다 */}
          {!warmup && kind === "INTL" && intlOfYear && (
            <TourneyBoard
              games={intlOfYear.games}
              // 지금 카드 **앞까지** 센다 — 현황판이 카드보다 먼저 결과를 말하면 안 된다
              done={gamesShown}
              // 승부처는 그 경기 안에서 일어난다 — 그 경기를 '지금'으로 표시한다
              current={step.kind === "game" || step.kind === "clutch" ? gamesShown : -1}
            />
          )}
          {warmup && loading && <LoadingPanel key="warm" {...loading} />}
          {!warmup && step.kind === "month" && <MonthPanel key={`m${cur}`} step={step} />}
          {!warmup && step.kind === "card" && <CardPanel key={`c${cur}`} step={step} />}
          {!warmup && step.kind === "round" && <RoundPanel key={`r${cur}`} step={step} />}
          {!warmup && step.kind === "hs" && <HsPanel key={`h${cur}`} step={step} />}
          {!warmup && step.kind === "game" && <GamePanel key={`g${cur}`} step={step} />}
          {!warmup && step.kind === "clutch" && (
            <div key={`k${cur}`}>
              {step.r ? (
                <>
                  <ClutchReveal r={step.r} />
                  <button
                    onClick={() => setI((v) => v + 1)}
                    className="mt-4 w-full rounded-xl bg-white/90 py-2.5 text-[13px] font-extrabold text-[#0e2a4d] transition hover:bg-white">
                    확인
                  </button>
                </>
              ) : (
                <ClutchCard
                  clutch={step.situation}
                  busy={busy}
                  dark
                  onPick={(id) => onAction?.({ type: "RESOLVE_CLUTCH", choice: id, where: step.where })}
                />
              )}
            </div>
          )}
          {!warmup && step.kind === "move" && (
            <div key={`v${cur}`}>
              <MovePanel step={step} />
              <button
                onClick={() => setI((v) => v + 1)}
                className="mt-4 w-full rounded-xl bg-white/90 py-2.5 text-[13px] font-extrabold text-[#0e2a4d] transition hover:bg-white">
                확인
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-[var(--ink-3)]">
        {i >= steps.length ? "정리하는 중…" : "시즌이 진행 중입니다"}
      </p>
    </div>
  );
}

/** 1군 콜업 · 2군 말소 통보 */
function MovePanel({ step }: { step: Extract<Step, { kind: "move" }> }) {
  const t = step.move.type;
  const promoted = t === "UP" || (t === "ROLE" && roleTier(step.move.role) > roleTier(step.fromRole));
  const title = t === "UP" ? "1군 엔트리 등록"
    : t === "DOWN" ? "1군 엔트리 말소"
      : promoted ? "보직 상승" : "보직 하락";
  return (
    <div className="pop text-center">
      <div className="text-[40px] leading-none">
        {t === "UP" ? "⬆️" : t === "DOWN" ? "⬇️" : promoted ? "📈" : "📉"}
      </div>
      <div className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
        {step.teamName} · {step.month} 종료
      </div>
      <div className="mt-1 text-[24px] font-black" style={{ color: promoted ? "#e3c07a" : "#dba498" }}>
        {title}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed opacity-85">
        {t === "UP" ? `${step.move.role}(으)로 1군에 올라갑니다.`
          : t === "DOWN" ? "2군에서 다시 준비합니다."
            : promoted ? "한 달 활약을 인정받았습니다." : "자리를 지키지 못했습니다."}
      </p>
      <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/12 px-3.5 py-2 text-[12px] font-extrabold">
        <span className="opacity-70">{step.fromLabel}</span>
        <span className="opacity-50">→</span>
        <span>{step.toLabel}</span>
      </div>
      {step.move.salary !== undefined && (
        <div className="mt-2 text-[12px] font-bold" style={{ color: "#e3c07a" }}>
          1군 등록으로 연봉 조정 · {formatMoney(step.move.salary)}
        </div>
      )}
    </div>
  );
}

function MonthPanel({ step }: { step: Extract<Step, { kind: "month" }> }) {
  const m = FORM_STYLE[step.form];
  return (
    <div className="pop">
      <div className="flex items-baseline gap-2">
        <span className="text-[34px] font-black leading-none">{step.label}</span>
        <span className="text-[11px] font-bold" style={{ color: m.color }}>{m.badge}</span>
      </div>
      <div className="mt-1 text-[12px] opacity-80">{step.note}</div>

      {/* 이달의 선수는 그 달의 하이라이트다 — 배지보다 크게 보여준다 */}
      {step.potm && (
        <div
          className="mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "rgba(255,194,51,0.18)", boxShadow: "inset 0 0 0 1px rgba(255,194,51,0.45)" }}
        >
          <span className="text-[20px] leading-none">🏆</span>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: "#d9ab55" }}>
              Player of the Month
            </div>
            <div className="text-[13px] font-black" style={{ color: "#d9ab55" }}>
              {step.label} 이달의 선수 선정
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {cells(step.line).map((c) => (
          <div key={c.k} className="rounded-xl bg-white/12 px-1 py-2 text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider opacity-65">{c.k}</div>
            <div className="tabular text-[15px] font-extrabold">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-black/20 px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-55">누적</div>
        <div className="tabular mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] font-bold">
          {cells(step.cume).map((c) => (
            <span key={c.k}><span className="opacity-60">{c.k}</span> {c.v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const RANK: Record<string, number> = {
  "16강 탈락": 0, "8강": 1, "4강": 2, "준우승": 3, "우승": 4,
};

function HsPanel({ step }: { step: Extract<Step, { kind: "hs" }> }) {
  const { t } = step;
  const good = RANK[t.placement] >= 3;
  return (
    <div className="pop">
      <div className="flex items-baseline gap-2">
        <span className="text-[26px] font-black leading-none">{t.month}월</span>
        <span className="text-[15px] font-extrabold">{t.name}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="rounded-lg px-2.5 py-1 text-[16px] font-black"
          style={{ background: good ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.28)", color: good ? "#0e2a4d" : "#fff" }}>
          {t.placement}
        </span>
        {t.award && <span className="text-[11.5px] font-bold" style={{ color: "#e3c07a" }}>🏅 {t.award}</span>}
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {t.rounds.map((r, i) => (
          <li key={i} className="tabular flex items-center gap-2 text-[11.5px]">
            <span className="w-[34px] shrink-0 opacity-60">{r.name}</span>
            <span className="min-w-0 flex-1 truncate">vs {r.opponent}</span>
            <span className={`font-extrabold ${r.won ? "" : "opacity-60"}`}>{r.won ? "승" : "패"} {r.score}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-xl bg-black/20 px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-55">대회 성적</div>
        <div className="tabular mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] font-bold">
          {cells(t.line).map((c) => (
            <span key={c.k}><span className="opacity-60">{c.k}</span> {c.v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 올스타전 · 국제대회 단일 경기 */
function GamePanel({ step }: { step: Extract<Step, { kind: "game" }> }) {
  return (
    <div className="pop">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-60">{step.tag}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-[17px] font-black">{step.round}</span>
        {step.mvp && <span className="text-[11px] font-black" style={{ color: "#e3c07a" }}>🌟 MVP</span>}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">vs {step.opponent}</span>
        <span className={`tabular rounded-lg px-2.5 py-1 text-[15px] font-black ${
          step.won ? "bg-white text-[#0e2a4d]" : "bg-black/35"
        }`}>
          {step.won ? "승" : "패"} {step.score}
        </span>
      </div>

      <div className="mt-3 rounded-xl bg-black/20 px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-[0.16em] opacity-55">개인 기록</div>
        {step.appeared === false ? (
          <div className="mt-0.5 text-[11.5px] font-bold opacity-60">등판 없음 (벤치 대기)</div>
        ) : (
          <div className="tabular mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] font-bold">
            {cells(step.line).map((c) => (
              <span key={c.k}><span className="opacity-60">{c.k}</span> {c.v}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CardPanel({ step }: { step: Extract<Step, { kind: "card" }> }) {
  return (
    <div className="pop py-3 text-center">
      <div className="text-[40px] leading-none">{step.icon}</div>
      <div className="mt-2 text-[19px] font-black">{step.title}</div>
      <div className="mt-1 text-[12.5px] opacity-80">{step.body}</div>
    </div>
  );
}

function RoundPanel({ step }: { step: Extract<Step, { kind: "round" }> }) {
  return (
    <div className="pop py-2">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] opacity-60">{step.name}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">vs {step.opponent}</span>
        <span className={`rounded-lg px-2.5 py-1 text-[15px] font-black ${step.win ? "bg-white text-[#0e2a4d]" : "bg-black/35"}`}>
          {step.win ? "승리" : "패배"}
        </span>
      </div>
      <div className="tabular mt-1.5 text-[12.5px] opacity-80">시리즈 전적 {step.score}</div>
    </div>
  );
}

export type { HitterLine };
