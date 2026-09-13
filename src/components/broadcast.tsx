"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt2, fmt3 } from "./stats";
import { isHitterLine, mergeLines } from "@/lib/sim";
import { TOURNAMENTS } from "@/lib/national";
import { formatMoney } from "@/lib/career";
import { roleTier } from "@/lib/roles";
import { teamById } from "@/lib/teams";
import type {
  AmateurTournament, GameState, HitterLine, MonthLine, PitcherLine, StatLine, TournamentSlot,
} from "@/lib/types";

export type BroadcastKind = "H1" | "H2" | "PS" | "HS" | "INTL";

type Step =
  | { kind: "month"; label: string; line: StatLine; cume: StatLine; mood: Mood; note: string }
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

type Mood = "hot" | "cold" | "normal" | "out";

const MONTH_MS = 1500;
const CARD_MS = 2000;
/** 엔트리 이동은 놓치면 안 되는 통보라 조금 더 오래 둔다 */
const MOVE_MS = 2600;

/* ------------------------------------------------------------------ */

/**
 * 한 달(약 24경기) 성적의 체감.
 * 리그 평균 OPS는 .730 안팎 — 타율만 보면 거포의 한 달을 과소평가하게 된다.
 * 그래서 장타(홈런·타점)와 투수의 탈삼진도 함께 본다.
 */
function moodOf(line: StatLine): Mood {
  if (isHitterLine(line)) {
    const h = line;
    if (h.pa < 8) return "out";
    // 월 6홈런이면 30홈런 페이스 — 타율이 낮아도 상승세다
    if (h.ops >= 0.850 || h.hr >= 6 || (h.hr >= 4 && h.slg >= 0.520) || h.rbi >= 24) return "hot";
    if (h.ops <= 0.660 && h.hr <= 2) return "cold";
    return "normal";
  }
  const p = line as PitcherLine;
  if (p.ip < 3) return "out";
  if (p.era <= 2.90 || (p.era <= 3.60 && p.k9 >= 10)) return "hot";
  if (p.era >= 5.50) return "cold";
  return "normal";
}

const HOT_H = ["미친 타격감", "이 달의 선수급", "손대는 족족 안타", "타선을 이끌었다"];
/** 타율은 평범해도 담장을 넘긴 달 */
const HOT_POWER = ["담장을 계속 넘겼다", "한 방이 터진 달", "중심타선의 위력", "아치를 그려냈다"];
const COLD_H = ["방망이가 식었다", "타격 슬럼프", "잔루만 쌓였다", "배트에 공이 안 맞는다"];
const NORM_H = ["제 몫은 했다", "꾸준했던 한 달", "기복 속에 버텼다"];
const HOT_P = ["압도적인 구위", "무실점 행진", "마운드를 지배했다", "이 달의 투수급"];
const COLD_P = ["난타당한 한 달", "제구가 흔들렸다", "조기 강판이 잦았다", "실점이 쌓였다"];
const NORM_P = ["제 몫은 했다", "꾸준히 로테이션을 지켰다", "기복 속에 버텼다"];

function noteOf(line: StatLine, mood: Mood, seed: number): string {
  if (mood === "out") return "부상·2군 — 출장 없음";
  const hitter = isHitterLine(line);
  const power = hitter && (line as HitterLine).hr >= 4 && (line as HitterLine).avg < 0.285;
  const pool = mood === "hot" ? (hitter ? (power ? HOT_POWER : HOT_H) : HOT_P)
    : mood === "cold" ? (hitter ? COLD_H : COLD_P)
    : (hitter ? NORM_H : NORM_P);
  return pool[seed % pool.length];
}

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
    { k: "IP", v: p.ip.toFixed(1) },
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
    const mood = moodOf(m.line);
    steps.push({
      kind: "month",
      label: m.label,
      line: m.line,
      cume: mergeLines([...base, ...months.slice(0, i + 1).map((x) => x.line)]),
      mood,
      note: noteOf(m.line, mood, g.seed + i),
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
    // 올스타 브레이크 — 선정 발표가 먼저, 경기는 그 다음이다
    steps.push(g.allStar
      ? { kind: "card", icon: "⭐", title: "올스타 선정", body: "전반기 활약을 인정받아 올스타전에 출전합니다.", tone: "epic" }
      : { kind: "card", icon: "🛋️", title: "올스타 브레이크", body: "올스타 선정은 불발. 짧은 휴식 뒤 후반기를 준비합니다.", tone: "neutral" });
    if (g.allStarGame) {
      const ag = g.allStarGame;
      const futures = g.seasonLevel === "MINOR";
      steps.push({
        kind: "card", icon: "🎪",
        title: `${futures ? "퓨처스 올스타전" : "올스타전"} 개막`, tone: "good",
        body: `${ag.side} 소속으로 ${ag.opponent}와 맞붙습니다.`,
      });
      steps.push({
        kind: "game", tag: futures ? "퓨처스 올스타전" : "올스타전", round: ag.side, opponent: ag.opponent,
        won: ag.won, score: ag.score, line: ag.line, mvp: ag.mvp,
      });
    }
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

export function Broadcast({ g, kind, onDone }: {
  g: GameState; kind: BroadcastKind; onDone: () => void;
}) {
  const steps = useMemo(() => buildSteps(g, kind), [g, kind]);
  const [i, setI] = useState(0);
  const team = g.contract ? teamById(g.contract.teamId) : null;
  const accent = team?.color ?? "#0e2a4d";

  useEffect(() => {
    if (i >= steps.length) {
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
    const dur = steps[i].kind === "month" ? MONTH_MS : steps[i].kind === "move" ? MOVE_MS : CARD_MS;
    const t = setTimeout(() => setI((v) => v + 1), dur);
    return () => clearTimeout(t);
  }, [i, steps, onDone]);

  const amateurLabel = (g.lastSeasonIndex !== null && g.seasons[g.lastSeasonIndex]?.level === "COLLEGE") ? "대학" : "고교";
  const intlOfYear = g.intlResults.find((r) => r.year === g.year);
  const title = kind === "HS" ? `${g.year} ${amateurLabel} 전국대회`
    : kind === "PS" ? `${g.year} 가을야구`
    : kind === "INTL" ? `${g.year} ${intlOfYear ? TOURNAMENTS[intlOfYear.tournamentId].name : "국가대표"}`
    : kind === "H1" ? `${g.year} 전반기` : `${g.year} 후반기`;
  const levelText = kind === "INTL" ? "국가대표"
    : g.seasonLevel === "KBO" ? "1군" : g.seasonLevel === "MINOR" ? "2군" : null;
  const step = steps[Math.min(i, steps.length - 1)];
  if (!step) return null;
  const stepMs = step.kind === "month" ? MONTH_MS : step.kind === "move" ? MOVE_MS : CARD_MS;

  return (
    <div className="flex min-h-[62vh] flex-col justify-center px-4 py-6">
      <div className="overflow-hidden rounded-2xl text-white shadow-lg"
        style={{ background: `linear-gradient(150deg, ${accent}, ${accent}dd 60%, #06182c)` }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="min-w-0">
            <div className="text-[9.5px] font-black uppercase tracking-[0.18em] opacity-60">Live</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-black">{title}</span>
              {levelText && (
                <span className="shrink-0 rounded bg-white/20 px-1.5 py-[1px] text-[9.5px] font-black">
                  {levelText}{kind !== "INTL" && g.seasonRole ? ` ${g.seasonRole}` : ""}
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
          {(kind === "INTL" ? [0] : steps).map((_, idx) => (
            <span key={idx} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
              <span
                key={`${idx}-${i}`}
                className="block h-full rounded-full bg-white"
                style={
                  idx < i ? { width: "100%", opacity: 0.55 }
                  : idx === i ? { animation: `fillBar ${stepMs}ms linear forwards` }
                  : { width: 0 }
                }
              />
            </span>
          ))}
        </div>

        <div className="px-4 pb-5 pt-4">
          {step.kind === "month" && <MonthPanel key={`m${i}`} step={step} />}
          {step.kind === "card" && <CardPanel key={`c${i}`} step={step} />}
          {step.kind === "round" && <RoundPanel key={`r${i}`} step={step} />}
          {step.kind === "hs" && <HsPanel key={`h${i}`} step={step} />}
          {step.kind === "game" && <GamePanel key={`g${i}`} step={step} />}
          {step.kind === "move" && <MovePanel key={`v${i}`} step={step} />}
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-[var(--ink-3)]">
        {i >= steps.length ? "정리하는 중…" : "시즌이 진행 중입니다"}
      </p>
    </div>
  );
}

const MOOD_STYLE: Record<Mood, { badge: string; color: string }> = {
  hot: { badge: "🔥 상승세", color: "#ffd166" },
  cold: { badge: "🧊 부진", color: "#9fc7ff" },
  normal: { badge: "— 평범", color: "rgba(255,255,255,0.75)" },
  out: { badge: "🏥 결장", color: "#ffb4a2" },
};

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
      <div className="mt-1 text-[24px] font-black" style={{ color: promoted ? "#ffd166" : "#ffb4a2" }}>
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
        <div className="mt-2 text-[12px] font-bold" style={{ color: "#ffd166" }}>
          1군 등록으로 연봉 조정 · {formatMoney(step.move.salary)}
        </div>
      )}
    </div>
  );
}

function MonthPanel({ step }: { step: Extract<Step, { kind: "month" }> }) {
  const m = MOOD_STYLE[step.mood];
  return (
    <div className="pop">
      <div className="flex items-baseline gap-2">
        <span className="text-[34px] font-black leading-none">{step.label}</span>
        <span className="text-[11px] font-bold" style={{ color: m.color }}>{m.badge}</span>
      </div>
      <div className="mt-1 text-[12px] opacity-80">{step.note}</div>

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
        {t.award && <span className="text-[11.5px] font-bold" style={{ color: "#ffd166" }}>🏅 {t.award}</span>}
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
        {step.mvp && <span className="text-[11px] font-black" style={{ color: "#ffd166" }}>🌟 MVP</span>}
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
