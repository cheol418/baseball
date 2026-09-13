"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AbilityBar, AppBar, Column, Container, Empty, Pill, Section } from "@/components/ui";
import { Broadcast, type BroadcastKind } from "@/components/broadcast";
import { KeyStats, SeasonTable, fmt2, fmt3 } from "@/components/stats";
import {
  FA_SERVICE, MAX_SALARY, MILITARY_DEADLINE, MILITARY_OPTIONS, advance,
  canVolunteer, careerTotals, computeHof, draftForecast, formatMoney,
  retirementHonors, type Action,
} from "@/lib/career";
import { fanFeed, seasonHeadline } from "@/lib/flavor";
import { HOF_CUT, HOF_WAIT, legacyContext, secondLifeOptions } from "@/lib/legacy";
import { allTimeRanks, nickname } from "@/lib/records";
import { TOURNAMENTS } from "@/lib/national";
import {
  abilityKeys, armSlotById, deriveStyle, DEV_RATE_LABEL, developmentRate, gradeOf,
  HAND_LABEL, overall, platoonProfile, POSITION_LABEL, scoutedOverall,
  scoutedPotential, traitById,
} from "@/lib/player";
import { isHitterLine, subtractLine } from "@/lib/sim";
import { saveGame, useGame } from "@/lib/storage";
import { isFranchiseRole } from "@/lib/roles";
import { teamById } from "@/lib/teams";
import {
  MILITARY_LABEL, type GameState, type HitterLine, type HofVote, type IntlResult, type PitcherLine,
  type SeasonRecord, type StatLine,
} from "@/lib/types";

type Tab = "season" | "career" | "player" | "log";

const CHAIN_LABEL: Record<string, string> = {
  FIRST_CALLUP: "첫 콜업 적응",
  INJURY_RETURN: "재활 계획",
  POSITION_CHANGE: "포지션 전환",
  TURNING_POINT: "커리어 전환점",
};

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const { game: g, hydrated } = useGame(id);
  const [tab, setTab] = useState<Tab>("season");
  const [busy, setBusy] = useState(false);
  /**
   * 재생할 중계 큐. 국제대회는 리그 일정과 섞지 않고 뒤에 따로 붙인다 —
   * 같은 진행 바에 넣으면 남은 칸 수가 예선 탈락인지 결승인지를 미리 알려준다.
   */
  const [animQueue, setAnimQueue] = useState<BroadcastKind[]>([]);
  const anim = animQueue[0] ?? null;

  const run = (action: Action) => {
    if (busy || !g) return;
    setBusy(true);
    const current = g;
    setTimeout(() => {
      const next = advance(current, action);
      saveGame(next);
      setBusy(false);
      const kind: BroadcastKind | null =
        action.type === "PLAY_FIRST_HALF" ? "H1"
        : action.type === "PLAY_SECOND_HALF" ? "H2"
        : action.type === "PLAY_POSTSEASON" ? "PS"
        : action.type === "SIM_AMATEUR" ? "HS" : null;

      // 이번 구간에 국제대회가 치러졌다면 리그 중계 뒤에 이어 붙인다
      const intl = next.intlResults.find((r) => r.year === next.year);
      const played = intl && !current.intlResults.some(
        (r) => r.year === intl.year && r.tournamentId === intl.tournamentId);
      const queue: BroadcastKind[] = [];
      if (kind) queue.push(kind);
      if (played) {
        // 개막 전에 열리는 대회(WBC)는 전반기보다 앞에 온다
        if (TOURNAMENTS[intl.tournamentId].slot === "PRE") queue.unshift("INTL");
        else queue.push("INTL");
      }
      setAnimQueue(queue);
      window.scrollTo({ top: 0, behavior: queue.length ? "auto" : "smooth" });
    }, 340);
  };

  if (!hydrated) return <main className="p-8 text-center text-[13px] text-[var(--ink-3)]">불러오는 중…</main>;
  if (!g) {
    return (
      <main>
        <AppBar title="선수를 찾을 수 없음" back="/" />
        <Section><Empty>저장된 기록이 없습니다.<br /><Link href="/" className="underline">홈으로 돌아가기</Link></Empty></Section>
      </main>
    );
  }

  const p = g.player;
  const last = g.lastSeasonIndex !== null ? g.seasons[g.lastSeasonIndex] : null;
  const headerTeamId = g.phase === "RETIRED" ? last?.teamId : g.contract?.teamId;
  const team = headerTeamId && headerTeamId !== "-" ? teamById(headerTeamId) : null;
  const ovr = overall(p);
  // 지금 어디 소속인지 — 시즌이 확정됐으면 올 시즌, 아니면 직전 시즌 기준
  const nick = nickname(g);
  const levelNow = g.seasonLevel ?? last?.level ?? null;
  const roleNow = g.seasonRole ?? last?.role ?? g.contract?.role ?? null;
  // 프로 연차 — 1군·2군을 가리지 않고 프로에서 보낸 시즌 수 (진행 중인 시즌 포함)
  const proSeasons = g.seasons.filter((r) => r.level === "KBO" || r.level === "MINOR" || r.level === "ARMY").length;
  const proYears = g.contract ? proSeasons + (g.seasonLevel ? 1 : 0) : 0;

  return (
    <main className="pb-10">
      <AppBar
        title={`${p.name} · ${g.year}년`}
        back="/"
        right={<span className="rounded-full bg-white/15 px-2 py-[3px] text-[10px] font-black">{gradeOf(ovr)} {ovr}</span>}
      />

      <div style={{ background: team ? `linear-gradient(135deg, ${team.color}, ${team.color}cc)` : "var(--brand)" }}>
        <Container className="px-4 py-4 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:px-6">
        <div className="flex items-center gap-3 text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-[20px] font-black">{p.number}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[18px] font-black">{p.name}</span>
              {nick && (
                <span className="shrink-0 rounded bg-white/20 px-1.5 py-[2px] text-[10px] font-extrabold">
                  {nick}
                </span>
              )}
              {levelNow && <LevelBadge level={levelNow} role={roleNow} />}
              {(g.military === "SANGMU" || g.military === "ACTIVE") && (
                <span className="rounded bg-white/20 px-1.5 py-[1px] text-[9.5px] font-bold">
                  🪖 {g.military === "SANGMU" ? "상무" : "현역"} 복무중
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11.5px] opacity-85">
              {team ? team.name : g.phase === "COLLEGE_SEASON" ? "대학 야구부" : g.military === "SANGMU" || g.military === "ACTIVE" ? "군 복무" : "고교 야구부"} ·{" "}
              {POSITION_LABEL[p.position]} · {deriveStyle(p).name} · {p.age}세 ·{" "}
              {HAND_LABEL[p.throws]}투{HAND_LABEL[p.bats]}타
              {proYears > 0 && <> · 프로 {proYears}년차</>}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-white lg:mt-0 lg:w-[460px] lg:shrink-0">
          <MiniStat label="연봉" value={g.contract ? formatMoney(g.contract.salary) : "—"} />
          <MiniStat label="OVR" value={`${gradeOf(ovr)} ${ovr}`} />
          <MiniStat label="구단 신뢰" value={`${Math.round(g.trust)}`} />
          {g.military === "PENDING" ? (
            <MiniStat label="병역" value={`D-${Math.max(0, MILITARY_DEADLINE - p.age)}년`} alert />
          ) : g.military === "EXEMPT" ? (
            <MiniStat label="병역" value="면제" />
          ) : g.military === "DONE" ? (
            <MiniStat label="인지도" value={`${Math.round(p.fame)}`} />
          ) : (
            <MiniStat label="병역" value={g.military === "SANGMU" ? "상무" : "현역"} alert />
          )}
        </div>
        </Container>
      </div>

      {!anim && (
      <nav className="sticky top-[49px] z-20 border-b border-[var(--line)] bg-[var(--surface)]">
        <Container className="flex px-2 lg:px-6">
          {([["season", "시즌"], ["career", "커리어"], ["player", "선수"], ["log", "기록"]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 border-b-2 py-2.5 text-[13px] font-bold transition lg:max-w-[160px] lg:flex-none lg:px-8 ${
                tab === k ? "border-[var(--danger)] text-[var(--brand)]" : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink-2)]"
              }`}>{label}</button>
          ))}
        </Container>
      </nav>
      )}

      <Container className="lg:px-2">
        {tab === "season" && (
          anim ? (
            <Broadcast key={anim} g={g} kind={anim} onDone={() => setAnimQueue((q) => q.slice(1))} />
          ) : (
            <div key={g.phase} className="stage lg:grid lg:grid-cols-[minmax(0,620px)_340px] lg:items-start lg:justify-center lg:gap-4">
              <div className="min-w-0">
                {(g.phase === "SEASON_END" || g.phase === "PATH_CHOICE" || g.phase === "DRAFT") && <SeasonReview g={g} />}
                <ActionCard g={g} busy={busy} run={run} />
              </div>
              <aside className="min-w-0 lg:sticky lg:top-[104px]">
                <Section eyebrow="Recent" title="최근 소식">
                  <LogList logs={g.logs.slice(0, 5)} />
                </Section>
              </aside>
            </div>
          )
        )}
        {tab === "career" && <CareerTab g={g} />}
        {tab === "player" && <Column><PlayerTab g={g} /></Column>}
        {tab === "log" && <Column><TimelineTab g={g} /></Column>}
      </Container>
    </main>
  );
}

export const LEVEL_SHORT: Record<string, string> = {
  KBO: "1군", MINOR: "2군", ARMY: "군", COLLEGE: "대학", HS: "고교",
};

/** 지금 1군인지 2군인지 — 가장 자주 확인하게 되는 정보라 이름 옆에 붙인다 */
function LevelBadge({ level, role }: { level: string; role: string | null }) {
  const short = LEVEL_SHORT[level] ?? level;
  const first = level === "KBO";
  // 팀의 간판은 금색으로 따로 보인다
  const franchise = first && isFranchiseRole(role);
  return (
    <span
      className="shrink-0 rounded px-1.5 py-[2px] text-[9.5px] font-black"
      style={{
        background: franchise ? "var(--gold)" : first ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.28)",
        color: first ? "#0e2a4d" : "rgba(255,255,255,0.92)",
      }}
    >
      {franchise ? "★ " : ""}{short}{role && level !== "ARMY" ? ` ${role}` : ""}
    </span>
  );
}

function MiniStat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-lg px-1.5 py-1.5 text-center ${alert ? "bg-white/30 ring-1 ring-white/50" : "bg-white/12"}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</div>
      <div className="tabular text-[12px] font-extrabold">{value}</div>
    </div>
  );
}

/* ================================================================== */
/* 상단 결과 패널 — 성적이 항상 액션보다 위에 온다                        */
/* ================================================================== */

function SeasonReview({ g }: { g: GameState }) {
  const last = g.lastSeasonIndex !== null ? g.seasons[g.lastSeasonIndex] : null;
  if (!last) return null;
  const ovrNow = overall(g.player);
  const delta = ovrNow - g.ovrAtSeasonStart;

  return (
    <Section eyebrow="Season Review" title={`${last.year} 시즌 결과`}>
      <div className="card px-4 py-4">
        <div className="text-[15px] font-black">{seasonHeadline(last)}</div>
        <div className="mt-2 mb-3 flex flex-wrap items-center gap-1.5">
          <Pill tone="brand">{last.teamName}</Pill>
          <Pill>{last.role}</Pill>
          {last.level === "MINOR" && <Pill>2군</Pill>}
          {last.level === "ARMY" && <Pill tone="danger">🪖 복무</Pill>}
          {last.allStar && <Pill tone="gold">⭐ 올스타</Pill>}
          {last.teamRank && <Pill tone={last.teamRank <= 3 ? "gold" : "neutral"}>정규시즌 {last.teamRank}위</Pill>}
          {last.champion && <Pill tone="gold">🏆 한국시리즈 우승</Pill>}
        </div>

        <KeyStats line={last.line} />

        {last.awards.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {last.awards.map((a) => <Pill key={a} tone="gold">🏅 {a}</Pill>)}
          </div>
        )}
        {last.goal && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-[11.5px] font-semibold ${
            last.goal.met ? "bg-[var(--brand)]/8 text-[var(--brand)]" : "bg-[var(--danger)]/8 text-[var(--danger)]"
          }`}>
            🎯 구단 목표 «{last.goal.label}» {last.goal.met ? "달성" : "미달"}
            {!last.goal.met && last.goal.reason && (
              <span className="ml-1 font-semibold opacity-75">— {last.goal.reason}</span>
            )}
          </div>
        )}
        {((last.feats?.length ?? 0) + (last.milestones?.length ?? 0)) > 0 && (
          <div className="mt-3 rounded-xl bg-[var(--gold)]/10 px-3 py-2.5">
            <div className="eyebrow mb-1.5" style={{ color: "var(--gold)" }}>대기록</div>
            <ul className="flex flex-col gap-1">
              {last.milestones?.map((m) => (
                <li key={m} className="text-[12px] font-extrabold text-[var(--gold)]">🗿 {m}</li>
              ))}
              {last.feats?.map((f) => (
                <li key={f} className="text-[12px] font-extrabold text-[var(--gold)]">✨ {f}</li>
              ))}
            </ul>
          </div>
        )}
        {last.note && (
          <p className="mt-3 rounded-lg bg-[var(--danger)]/8 px-3 py-2 text-[11.5px] text-[var(--danger)]">{last.note}</p>
        )}

        {last.tournaments && last.tournaments.length > 0 && (
          <div className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
            <div className="eyebrow mb-2">{last.level === "COLLEGE" ? "대학" : "고교"} 전국대회</div>
            <ul className="flex flex-col gap-1.5">
              {last.tournaments.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-[12px]">
                  <span className="tabular w-[26px] shrink-0 text-[var(--ink-3)]">{t.month}월</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{t.name}</span>
                  {t.award && <Pill tone="gold">🏅 {t.award}</Pill>}
                  <span className={`shrink-0 font-extrabold ${
                    t.placement === "우승" ? "text-[var(--gold)]"
                    : t.placement === "준우승" ? "text-[var(--brand)]" : "text-[var(--ink-2)]"
                  }`}>{t.placement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {last.half && <SplitBox rec={last} />}
        {last.ps && <PostseasonBox rec={last} />}
        {last.allStarGame && (
          <div className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
            <div className="eyebrow mb-1.5">올스타전</div>
            <div className="flex items-center gap-2">
              <span className="text-[20px]">{last.allStarGame.mvp ? "🌟" : "🎪"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-extrabold">
                    {last.allStarGame.side} {last.allStarGame.won ? "승리" : "패배"} {last.allStarGame.score}
                  </span>
                  {last.allStarGame.mvp && <Pill tone="gold">MVP</Pill>}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">vs {last.allStarGame.opponent}</div>
              </div>
            </div>
          </div>
        )}
        {g.intlResults.filter((r) => r.year === last.year).map((r) => (
          <IntlBox key={r.tournamentId} res={r} />
        ))}

        <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
          <span className="eyebrow">OVR 변화</span>
          <span className="tabular text-[14px] font-extrabold">
            {g.ovrAtSeasonStart} <span className="text-[var(--ink-3)]">→</span>{" "}
            <span style={{ color: delta > 0 ? "var(--brand-2)" : delta < 0 ? "var(--danger)" : "inherit" }}>
              {ovrNow}{delta !== 0 && ` (${delta > 0 ? "+" : ""}${delta})`}
            </span>
          </span>
        </div>

        <div className="mt-3 border-t border-[var(--line)] pt-3"><DetailLine line={last.line} /></div>

        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <div className="eyebrow mb-2">Fan Feed · 팬 반응</div>
          <ul className="flex flex-col gap-1.5">
            {fanFeed(last, g.seed).map((c, i) => (
              <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-[var(--ink-2)]">
                <span className="text-[var(--danger)]">♥</span>{c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/** 전반기 / 후반기 비교 */
function SplitBox({ rec }: { rec: SeasonRecord }) {
  const h1 = rec.half!;
  const full = rec.line;
  const row = (l: StatLine) => isHitterLine(l)
    ? [fmt3(l.avg), String(l.hr), String(l.rbi), fmt3(l.ops)]
    : [fmt2((l as PitcherLine).era), (l as PitcherLine).ip.toFixed(1),
       String((l as PitcherLine).so), fmt2((l as PitcherLine).whip)];
  const head = isHitterLine(full) ? ["AVG", "HR", "RBI", "OPS"] : ["ERA", "IP", "SO", "WHIP"];
  // 후반기 = 시즌 전체 − 전반기
  const h2 = subtractLine(full, h1);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
      <table className="tabular w-full text-[11.5px]">
        <thead>
          <tr className="bg-[var(--surface-2)] text-[9.5px] text-[var(--ink-3)]">
            <th className="px-2.5 py-1.5 text-left font-bold">구간</th>
            {head.map((h) => <th key={h} className="px-2 py-1.5 text-right font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-[var(--line)]">
            <th className="px-2.5 py-1.5 text-left font-bold">전반기</th>
            {row(h1).map((v, i) => <td key={i} className="px-2 py-1.5 text-right">{v}</td>)}
          </tr>
          <tr className="border-t border-[var(--line)]">
            <th className="px-2.5 py-1.5 text-left font-bold">후반기</th>
            {row(h2).map((v, i) => <td key={i} className="px-2 py-1.5 text-right">{v}</td>)}
          </tr>
          <tr className="border-t border-[var(--line)] bg-[var(--surface-2)] font-extrabold">
            <th className="px-2.5 py-1.5 text-left">시즌 전체</th>
            {row(full).map((v, i) => <td key={i} className="px-2 py-1.5 text-right">{v}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PostseasonBox({ rec }: { rec: SeasonRecord }) {
  const ps = rec.ps!;
  const hitter = isHitterLine(ps.line);
  const head = hitter ? ["G", "AVG", "HR", "RBI", "OPS"] : ["G", "IP", "ERA", "SO", "WHIP"];
  const row = (l: StatLine) => hitter
    ? [String(l.g), fmt3((l as HitterLine).avg), String((l as HitterLine).hr),
       String((l as HitterLine).rbi), fmt3((l as HitterLine).ops)]
    : [String(l.g), (l as PitcherLine).ip.toFixed(1), fmt2((l as PitcherLine).era),
       String((l as PitcherLine).so), fmt2((l as PitcherLine).whip)];

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
      <div className="flex items-center justify-between bg-[var(--surface-2)] px-3 py-2">
        <span className="eyebrow">가을야구 · {ps.seed}위 진출</span>
        {ps.champion && <span className="text-[11.5px] font-black text-[var(--gold)]">🏆 한국시리즈 우승</span>}
      </div>
      <table className="tabular w-full text-[11.5px]">
        <thead>
          <tr className="border-y border-[var(--line)] text-[9.5px] text-[var(--ink-3)]">
            <th className="px-2.5 py-1.5 text-left font-bold">시리즈</th>
            <th className="px-2 py-1.5 text-left font-bold">상대</th>
            <th className="px-2 py-1.5 text-right font-bold">결과</th>
            {head.map((h) => <th key={h} className="px-2 py-1.5 text-right font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {ps.rounds.map((r, i) => (
            <tr key={i} className="border-b border-[var(--line)] last:border-0">
              <td className={`px-2.5 py-1.5 font-bold ${r.win ? "text-[var(--brand)]" : "text-[var(--ink-3)]"}`}>{r.name}</td>
              <td className="px-2 py-1.5 text-[var(--ink-2)]">{r.opponent}</td>
              <td className={`px-2 py-1.5 text-right font-extrabold ${r.win ? "text-[var(--brand)]" : "text-[var(--danger)]"}`}>
                {r.win ? "승" : "패"} {r.score}
              </td>
              {row(r.line ?? ps.line).map((v, j) => <td key={j} className="px-2 py-1.5 text-right text-[var(--ink-2)]">{v}</td>)}
            </tr>
          ))}
          <tr className="bg-[var(--surface-2)] font-extrabold">
            <td className="px-2.5 py-1.5" colSpan={3}>가을야구 통산</td>
            {row(ps.line).map((v, j) => <td key={j} className="px-2 py-1.5 text-right">{v}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================== */
/* 다음 행동                                                           */
/* ================================================================== */

function Wrap({ eyebrow, title, desc, children }: {
  eyebrow: string; title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <Section eyebrow={eyebrow} title={title}>
      {desc && <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{desc}</p>}
      {children}
    </Section>
  );
}

function Primary({ onClick, busy, children, label }: {
  onClick: () => void; busy: boolean; children: React.ReactNode; label?: string;
}) {
  return (
    <button onClick={onClick} disabled={busy} className="btn btn-primary w-full py-3.5 text-[15px]">
      {busy ? (label ?? "진행 중…") : children}
    </button>
  );
}

function ActionCard({ g, busy, run }: { g: GameState; busy: boolean; run: (a: Action) => void }) {
  const p = g.player;
  const team = g.contract ? teamById(g.contract.teamId) : null;

  switch (g.phase) {
    case "HS_SEASON":
      return (
        <Wrap eyebrow="Next" title="고교 3학년 시즌" desc="마지막 고교 시즌입니다. 여기서의 성적이 드래프트 평가를 좌우합니다.">
          <Primary onClick={() => run({ type: "SIM_AMATEUR" })} busy={busy} label="시즌 진행 중…">시즌 치르기 ⚾</Primary>
        </Wrap>
      );

    case "PATH_CHOICE": {
      const f = draftForecast(g);
      const collegeDone = g.seasons.filter((s) => s.level === "COLLEGE").length;
      return (
        <Wrap eyebrow="Career Path" title="졸업 후 진로">
          <div className="flex flex-col gap-2">
            <button onClick={() => run({ type: "CHOOSE_PATH", path: "DRAFT" })} disabled={busy}
              className="card px-4 py-3.5 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
              {g.draftMissed ? (
                <>
                  <div className="text-[14px] font-extrabold">🪶 육성선수로 입단</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-3)]">
                    지명은 받지 못했지만 신고선수로 프로에 들어갑니다. 등록조차 되지 않은 바닥에서 시작하지만,
                    2군에서 실력을 증명하면 길이 열립니다.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[14px] font-extrabold">🏟️ 프로 드래프트 참가</div>
                  <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">현재 성적과 능력치로 신인 드래프트에 도전합니다.</div>
                  <div className="mt-2.5 flex gap-2">
                    <Mini label="지명 확률" value={`${Math.round(f.odds * 100)}%`} />
                    <Mini label="예상 지명" value={f.round} />
                  </div>
                </>
              )}
            </button>
            {collegeDone < 2 && (
              <button onClick={() => run({ type: "CHOOSE_PATH", path: "COLLEGE" })} disabled={busy}
                className="card px-4 py-3.5 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                <div className="text-[14px] font-extrabold">🎓 대학 진학</div>
                <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">두 시즌 더 성장한 뒤 더 높은 평가로 재도전합니다.</div>
                <div className="mt-2.5 flex gap-2">
                  <Mini label="성장 기간" value="2년" />
                  <Mini label="남은 기회" value={`${2 - collegeDone}회`} />
                </div>
              </button>
            )}
          </div>
        </Wrap>
      );
    }

    case "COLLEGE_SEASON": {
      const n = g.seasons.filter((s) => s.level === "COLLEGE").length;
      return (
        <Wrap eyebrow="College" title={`대학 ${n === 0 ? "1~2" : "3~4"}학년`} desc="두 시즌을 치르며 기량을 끌어올립니다.">
          <Primary onClick={() => run({ type: "SIM_AMATEUR" })} busy={busy} label="시즌 진행 중…">두 시즌 치르기 ⚾</Primary>
        </Wrap>
      );
    }

    case "DRAFT": {
      const f = draftForecast(g);
      return (
        <Wrap eyebrow="Rookie Draft" title="신인 드래프트"
          desc={`희망 구단: ${teamById(g.wishTeamId).name}`}>
          <div className="card mb-3 flex gap-2 px-4 py-3">
            <Mini label="지명 확률" value={`${Math.round(f.odds * 100)}%`} />
            <Mini label="예상 지명" value={f.round} />
          </div>
          <Primary onClick={() => run({ type: "DO_DRAFT" })} busy={busy} label="호명을 기다리는 중…">드래프트 참가하기 📋</Primary>
        </Wrap>
      );
    }

    case "SPRING_CAMP": {
      const prev = g.seasons[g.seasons.length - 1];
      const rate = developmentRate(prev?.level ?? null, prev?.role ?? null, prev?.age ?? p.age);
      const where = prev
        ? prev.level === "MINOR" ? "2군 풀타임"
          : prev.level === "COLLEGE" ? "대학"
          : prev.level === "HS" ? "고교"
          : prev.level === "ARMY" ? (prev.role === "복무" ? "현역 복무" : "상무")
          : `1군 ${prev.role}`
        : null;
      return (
        <Wrap eyebrow="Spring Camp" title={`${g.year} 스프링캠프`}
          desc="시즌을 앞두고 훈련 방향을 정합니다. 선택에 따라 성장 폭과 부상 위험이 달라집니다.">
          {where && (
            <div className="card mb-3 flex items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <div className="eyebrow">지난 시즌 출전 환경</div>
                <div className="text-[13px] font-extrabold">{where}</div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-3)]">
                  {rate >= 1.25
                    ? "매일 실전을 치르며 가장 빠르게 성장하는 시기입니다."
                    : rate >= 1.08 ? "출전 기회가 충분해 성장에 유리합니다."
                    : rate >= 0.95 ? "성장 속도는 평범합니다."
                    : "출전이 적어 성장이 더딥니다."}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="eyebrow">성장 속도</div>
                <div className="text-[13px] font-black"
                  style={{ color: rate >= 1.08 ? "var(--brand-2)" : rate >= 0.95 ? "var(--ink)" : "var(--danger)" }}>
                  {DEV_RATE_LABEL(rate)}
                </div>
                <div className="tabular text-[10px] text-[var(--ink-3)]">×{rate.toFixed(2)}</div>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {g.pendingTraining?.map((o) => (
              <button key={o.id} onClick={() => run({ type: "TRAIN", optionId: o.id })} disabled={busy}
                className="card px-4 py-3 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[14px] font-extrabold">{o.name}</span>
                  {o.risk >= 0.2 && <Pill tone="danger">부상 위험 높음</Pill>}
                  {o.conditionCost < 0 && <Pill tone="brand">컨디션 회복</Pill>}
                  {o.room !== undefined && (
                    <Pill tone={o.room >= 8 ? "brand" : o.room >= 3 ? "neutral" : "danger"}>
                      성장 여지 {o.room}
                    </Pill>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{o.desc}</div>
              </button>
            ))}
          </div>
          <RetireLink run={run} busy={busy} />
        </Wrap>
      );
    }

    case "FIRST_HALF":
      return (
        <Wrap eyebrow="First Half" title={`${g.year} 전반기`}
          desc={`${team?.name ?? ""} · ${g.seasonLevel === "KBO" ? "1군" : "2군"} ${g.seasonRole}(으)로 시즌을 시작합니다.`}>
          {g.seasonGoal && <GoalCard g={g} />}
          <Primary onClick={() => run({ type: "PLAY_FIRST_HALF" })} busy={busy} label="전반기 진행 중…">전반기 시작 ⚾</Primary>
        </Wrap>
      );

    case "ALL_STAR":
      return (
        <Wrap eyebrow="All-Star Break" title="올스타 브레이크"
          desc={g.allStar ? "올스타전을 마치고 후반기에 들어갑니다." : "짧은 휴식을 마치고 후반기에 들어갑니다."}>
          {g.seasonGoal && <GoalCard g={g} />}
          {g.halfLine && <Strip label="전반기 성적" line={g.halfLine} level={g.seasonLevel} role={g.seasonRole} />}
          {g.pendingTrade ? (
            <div className="card mb-3 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">📞</span>
                <span className="text-[14px] font-extrabold">트레이드 데드라인</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-2)]">{g.pendingTrade.note}</p>
              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2">
                <span className="h-7 w-7 shrink-0 rounded-md" style={{ background: teamById(g.pendingTrade.teamId).color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-extrabold">{teamById(g.pendingTrade.teamId).name}</span>
                  <span className="block text-[10.5px] text-[var(--ink-3)]">
                    전력 {teamById(g.pendingTrade.teamId).power} · 예상 보직 {g.pendingTrade.role} · {teamById(g.pendingTrade.teamId).park.name}
                  </span>
                </span>
              </div>
              <div className="mt-2.5 flex gap-2">
                <button onClick={() => run({ type: "TRADE_DECIDE", accept: true })} disabled={busy}
                  className="btn btn-primary flex-1 py-2.5 text-[13px]">이적 수락</button>
                <button onClick={() => run({ type: "TRADE_DECIDE", accept: false })} disabled={busy}
                  className="btn btn-ghost flex-1 py-2.5 text-[13px]">팀에 남는다</button>
              </div>
            </div>
          ) : (
            <Primary onClick={() => run({ type: "PLAY_SECOND_HALF" })} busy={busy} label="후반기 진행 중…">후반기 시작 ⚾</Primary>
          )}
        </Wrap>
      );

    case "POSTSEASON":
      return (
        <Wrap eyebrow="October" title="가을야구"
          desc={`정규시즌 ${g.teamRank}위로 포스트시즌에 진출했습니다.`}>
          {g.seasonLine && <Strip label="정규시즌 최종" line={g.seasonLine} level={g.seasonLevel} role={g.seasonRole} />}
          <Primary onClick={() => run({ type: "PLAY_POSTSEASON" })} busy={busy} label="가을야구 진행 중…">가을야구 시작 🍁</Primary>
        </Wrap>
      );

    case "EVENT": {
      const ev = g.pendingEvent;
      if (!ev) return null;
      return (
        <Wrap eyebrow="Turning Point" title={`${ev.icon} ${ev.title}`} desc={ev.body}>
          <div className="flex flex-col gap-2">
            {ev.options.map((o) => (
              <button key={o.id} onClick={() => run({ type: "CHOOSE_EVENT", optionId: o.id })} disabled={busy}
                className="card px-4 py-3.5 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[14px] font-extrabold">{o.label}</span>
                  {o.risky && <Pill tone="danger">위험</Pill>}
                </div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-3)]">{o.desc}</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-3)]">
            이 선택의 결과는 다음 시즌이 끝날 때 드러납니다.
          </p>
        </Wrap>
      );
    }

    case "SEASON_END":
      return (
        <Wrap eyebrow="Next" title="시즌 종료">
          <Primary onClick={() => run({ type: "FINISH_SEASON" })} busy={busy}>다음 →</Primary>
        </Wrap>
      );

    case "INTERNATIONAL": {
      const t = g.pendingTournament ? TOURNAMENTS[g.pendingTournament] : null;
      if (!t) return null;
      return (
        <Wrap eyebrow="National Team" title={`${t.icon} ${t.name} 대표팀 발탁`}
          desc={`개막을 앞두고 국가대표 예비 명단에 이름을 올렸습니다. 대회는 ${g.year}년 ${t.month}, 시즌 중에 치러집니다.`}>
          <div className="card mb-3 px-4 py-3">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-[var(--ink-3)]">병역 혜택</span>
              <span className="font-bold">{t.exemption ?? "없음"}</span>
            </div>
            {t.exemption && g.military === "PENDING" && (
              <p className="mt-2 rounded-lg bg-[var(--gold)]/12 px-3 py-2 text-[11.5px] font-semibold text-[var(--gold)]">
                🪖 아직 병역 미필입니다. 이번이 기회입니다.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Primary onClick={() => run({ type: "JOIN_NATIONAL", join: true })} busy={busy}>
              태극마크를 단다 {t.icon}
            </Primary>
            <button onClick={() => run({ type: "JOIN_NATIONAL", join: false })} disabled={busy}
              className="btn btn-ghost w-full py-3 text-[13px]">고사하고 소속팀에 전념</button>
          </div>
        </Wrap>
      );
    }

    case "MILITARY_CHOICE":
      return (
        <Wrap eyebrow="Military Service" title="입영 통지"
          desc={`${MILITARY_DEADLINE}세가 되어 더 이상 병역을 미룰 수 없습니다. 복무 형태를 선택하세요.`}>
          <div className="flex flex-col gap-2">
            {MILITARY_OPTIONS.map((o) => (
              <button key={o.id} onClick={() => run({ type: "ENLIST", option: o.id })} disabled={busy}
                className="card px-4 py-3.5 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-extrabold">{o.id === "SANGMU" ? "🎽" : "🪖"} {o.name}</span>
                  {o.id === "ACTIVE" && <Pill tone="danger">능력치 하락</Pill>}
                </div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-3)]">{o.desc}</div>
                <div className="mt-2 text-[11px] font-bold text-[var(--brand)]">{o.effect}</div>
              </button>
            ))}
          </div>
        </Wrap>
      );

    case "MILITARY_SEASON":
      return (
        <Wrap eyebrow="Service" title={g.military === "SANGMU" ? "상무 복무" : "현역 복무"}
          desc={g.military === "SANGMU"
            ? "퓨처스리그에서 경기를 이어갑니다. 남은 복무 시즌을 진행하세요."
            : "야구를 떠나 있는 기간입니다. 남은 복무 시즌을 진행하세요."}>
          <div className="card mb-3 flex gap-2 px-4 py-3">
            <Mini label="복무 형태" value={g.military === "SANGMU" ? "상무" : "현역"} />
            <Mini label="남은 시즌" value={`${g.militaryLeft}시즌`} />
          </div>
          <Primary onClick={() => run({ type: "SERVE" })} busy={busy} label="복무 중…">
            {g.year}년 복무 진행
          </Primary>
        </Wrap>
      );

    case "NEGOTIATION": {
      const n = g.pendingNegotiation;
      if (!n) return null;
      const diff = n.offer - n.previous;
      return (
        <Wrap eyebrow="Contract" title="연봉 협상"
          desc={`${team?.name ?? "구단"}이 내년 연봉을 제시했습니다.`}>
          <div className="card mb-3 px-4 py-4 text-center">
            <div className="eyebrow">구단 제시액</div>
            <div className="tabular text-[26px] font-black">{formatMoney(n.offer)}</div>
            <div className="tabular mt-0.5 text-[12px] text-[var(--ink-3)]">
              지난해 {formatMoney(n.previous)}{" "}
              <span style={{ color: diff >= 0 ? "var(--brand-2)" : "var(--danger)" }}>
                ({diff >= 0 ? "+" : "−"}{formatMoney(Math.abs(diff))})
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {n.options.map((o) => (
              <button key={o.id} onClick={() => run({ type: "NEGOTIATE", optionId: o.id })} disabled={busy}
                className="card px-4 py-3 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-extrabold">{o.label}</span>
                  {o.id !== "accept" && (
                    <Pill tone={o.odds >= 0.5 ? "brand" : "danger"}>성공 {Math.round(o.odds * 100)}%</Pill>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{o.desc}</div>
                {o.id !== "accept" && (() => {
                  const cap = g.faUsed === 0 ? Math.min(150000, MAX_SALARY) : MAX_SALARY;
                  const at = (m: number) => Math.min(cap, Math.round(n.offer * m));
                  return (
                    <div className="tabular mt-1.5 text-[11px] font-bold">
                      <span className="text-[var(--brand-2)]">성공 {formatMoney(at(o.upside))}</span>
                      <span className="mx-1.5 text-[var(--ink-3)]">/</span>
                      <span className="text-[var(--danger)]">실패 {formatMoney(at(o.downside))}</span>
                    </div>
                  );
                })()}
              </button>
            ))}
          </div>
        </Wrap>
      );
    }

    case "STOVE":
      return (
        <Wrap eyebrow="Stove League" title={`${g.year} 스토브리그`}
          desc={g.transferRequested
            ? "이적 신청 결과를 확인했습니다. 다음 시즌을 준비하세요."
            : "다른 구단으로 이적을 신청하거나, 팀에 남아 다음 시즌을 준비합니다."}>
          {!g.transferRequested && (
            <>
              <div className="eyebrow mb-2">이적 신청 · 구단별 영입 관심도</div>
              <p className="mb-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
                구단을 골라 신청하면 성사 여부가 결정됩니다. 실패하면 구단 신뢰가 떨어지고, 신청은 스토브리그마다 한 번만 할 수 있습니다.
              </p>
              <div className="mb-3 flex flex-col gap-2">
                {g.pendingTransfers?.map((t) => {
                  const tm = teamById(t.teamId);
                  return (
                    <button key={t.teamId} onClick={() => run({ type: "REQUEST_TRANSFER", teamId: t.teamId })} disabled={busy}
                      className="card flex items-center gap-3 px-3.5 py-2.5 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                      <span className="h-8 w-8 shrink-0 rounded-lg" style={{ background: tm.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-extrabold">{tm.name}</span>
                        <span className="block truncate text-[10.5px] text-[var(--ink-3)]">{t.note} · 예상 보직 {t.role}</span>
                        <span className="mt-1 block h-[4px] w-full overflow-hidden rounded-full bg-[var(--line)]">
                          <span className="block h-full rounded-full bg-[var(--brand-2)]" style={{ width: `${t.interest}%` }} />
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tabular block text-[12px] font-black">{t.interest}</span>
                        <span className="tabular block text-[10px] text-[var(--ink-3)]">성사 {Math.round(t.odds * 100)}%</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {canVolunteer(g) && !g.transferRequested && (
            <button onClick={() => run({ type: "VOLUNTEER_ARMY" })} disabled={busy}
              className="btn btn-ghost mb-2 w-full py-3 text-[13px]">🎽 상무 야구단 자원입대</button>
          )}
          <Primary onClick={() => run({ type: "SKIP_STOVE" })} busy={busy}>
            {g.year + 1} 스프링캠프로 →
          </Primary>
          <RetireLink run={run} busy={busy} />
        </Wrap>
      );

    case "FA":
      return (
        <Wrap eyebrow="Free Agent" title="FA 협상"
          desc="구단 제안을 비교해 다음 행선지를 정합니다. 지금 계약이 마음에 들지 않으면 1년 미룰 수도 있습니다.">
          <div className="flex flex-col gap-2">
            {g.pendingOffers?.map((o) => {
              const t = teamById(o.teamId);
              return (
                <button key={o.teamId} onClick={() => run({ type: "ACCEPT_OFFER", teamId: o.teamId })} disabled={busy}
                  className="card px-4 py-3.5 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: t.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-extrabold">{t.name}</span>
                      <span className="block truncate text-[11px] text-[var(--ink-3)]">{o.note} · 전력 {t.power}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block text-[12px] font-bold text-[var(--ink-3)]">{o.years}년</span>
                      <span className="tabular block text-[15px] font-black">{formatMoney(o.total)}</span>
                    </span>
                  </div>

                  <div className="mt-2.5 border-t border-[var(--line)] pt-2.5">
                    <div className="tabular flex items-baseline gap-2 text-[11.5px]">
                      <span className="w-[34px] shrink-0 font-extrabold text-[var(--brand)]">보장</span>
                      <span className="font-extrabold">{formatMoney(o.guaranteed)}</span>
                      <span className="text-[var(--ink-3)]">
                        계약금 {formatMoney(o.signingBonus)} · 연봉 {formatMoney(o.salary)}/년
                      </span>
                    </div>
                    <div className="tabular mt-1 flex items-baseline gap-2 text-[11.5px]">
                      <span className="w-[34px] shrink-0 font-extrabold text-[var(--gold)]">옵션</span>
                      <span className="font-extrabold">{formatMoney(o.incentive)}</span>
                      <span className="truncate text-[var(--ink-3)]">{o.incentiveNote}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button onClick={() => run({ type: "DEFER_FA" })} disabled={busy}
            className="card mt-3 w-full px-4 py-3 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
            <div className="text-[13.5px] font-extrabold">⏳ FA 신청 보류 (1년 연기)</div>
            <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
              올해는 권리를 행사하지 않고 팀에 남습니다. 한 시즌 더 뛰고 내년에 다시 자격을 얻습니다 —
              성적을 끌어올리면 더 좋은 제안을 받을 수 있지만, 나이가 한 살 더 들고 부상 위험도 함께 갑니다.
            </div>
          </button>
        </Wrap>
      );

    case "RETIRE_CHOICE": {
      // 방출은 되돌릴 수 없지만, 권고는 뿌리칠 수 있다
      const forced = g.retireForced !== false;
      return (
        <Wrap
          eyebrow="The End"
          title={forced ? "커리어의 끝" : "은퇴 권고"}
          desc={g.retireReason}>
          {forced ? (
            <Primary onClick={() => run({ type: "RETIRE" })} busy={busy}>유니폼을 벗는다 🎖️</Primary>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                className="card px-4 py-3 text-left transition hover:border-[var(--brand)]"
                disabled={busy}
                onClick={() => run({ type: "KEEP_PLAYING" })}>
                <div className="text-[14px] font-extrabold">🔥 한 시즌 더 뛴다</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">
                  구단 신뢰와 인지도가 떨어지고, 자리를 지키기 어려워집니다.
                </div>
              </button>
              <button
                className="card px-4 py-3 text-left transition hover:border-[var(--brand)]"
                disabled={busy}
                onClick={() => run({ type: "RETIRE" })}>
                <div className="text-[14px] font-extrabold">🎖️ 유니폼을 벗는다</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">
                  박수받을 때 떠납니다. 통산 기록이 그대로 남습니다.
                </div>
              </button>
            </div>
          )}
        </Wrap>
      );
    }

    case "SECOND_LIFE": {
      const ctx = legacyContext(g, g.hofScore ?? 0);
      const opts = secondLifeOptions(ctx);
      return (
        <Wrap
          eyebrow="Second Life"
          title="유니폼을 벗고"
          desc={`${p.name} 선수의 현역 생활이 끝났습니다. 이제 무엇을 하며 살아갈지 고릅니다.`}>
          <div className="flex flex-col gap-2">
            {opts.map((o) => (
              <button
                key={o.id}
                className="card px-4 py-3 text-left transition hover:border-[var(--brand)]"
                disabled={busy}
                onClick={() => run({ type: "CHOOSE_SECOND_LIFE", pathId: o.id })}>
                <div className="text-[14px] font-extrabold">{o.icon} {o.name}</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{o.desc}</div>
              </button>
            ))}
          </div>
        </Wrap>
      );
    }

    default: {
      const hof = computeHof(g);
      const vote = g.hofVote;
      const life = g.secondLife;
      return (
        <Section eyebrow="Career Summary" title="은퇴">
          <div className="card px-4 py-5 text-center">
            <div className="text-[32px]">🎖️</div>
            <div className="mt-1 text-[18px] font-black">{hof.tier}</div>
            {(() => {
              const honor = retirementHonors(g);
              if (!honor) return null;
              const t = teamById(honor.teamId);
              return (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold"
                  style={{ background: `${t.color}18`, color: t.color }}>
                  {honor.kind === "영구결번" ? "🎽" : "🎤"} {t.short} {honor.kind}
                  {honor.kind === "영구결번" && ` · ${p.number}번`}
                </div>
              );
            })()}
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              {p.name} 선수는 {p.age}세에 은퇴했습니다.<br />{g.retireReason}
            </p>
            <div className="mt-4 grid grid-cols-6 gap-1.5">
              <SumCell label="시즌" value={hof.seasons} />
              <SumCell label="WAR" value={hof.war} />
              <SumCell label="수상" value={hof.awards} />
              <SumCell label="우승" value={hof.rings} />
              <SumCell label="메달" value={hof.medals} />
              <SumCell label="대기록" value={hof.feats} />
            </div>
            {allTimeRanks(g.seasons, p.kind).slice(0, 3).length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {allTimeRanks(g.seasons, p.kind).slice(0, 3).map((r) => (
                  <Pill key={r.label} tone={r.rank <= 3 ? "gold" : "neutral"}>
                    {r.label} 역대 {r.rank}위
                  </Pill>
                ))}
              </div>
            )}
            <div className="mt-4 rounded-xl bg-[var(--brand)]/8 px-3 py-2.5">
              <span className="eyebrow">명예의 전당 점수</span>
              <div className="tabular text-[24px] font-black text-[var(--brand)]">{hof.score}</div>
            </div>

            {life && (
              <div className="mt-3 rounded-xl border border-[var(--line)] px-3.5 py-3 text-left">
                <div className="eyebrow mb-1">은퇴 후</div>
                <div className="text-[13.5px] font-extrabold">
                  {life.icon} {life.name}
                  {life.success && <span className="ml-1.5 text-[11px] text-[var(--gold)]">성공</span>}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-2)]">{life.story}</p>
              </div>
            )}

            {vote && <HofVoteBox g={g} vote={vote} busy={busy} run={run} />}

            <Link href="/create" className="btn btn-primary mt-4 w-full py-3 text-[14px]">새로운 인생 시작하기</Link>
          </div>
        </Section>
      );
    }
  }
}

/** 그해 국제대회 — 경기별 기록과 대회 통산 */
function IntlBox({ res }: { res: IntlResult }) {
  const hitter = isHitterLine(res.line);
  const head = hitter ? ["G", "AVG", "HR", "RBI", "OPS"] : ["G", "IP", "ERA", "SO", "WHIP"];
  const row = (l: StatLine) => hitter
    ? [String(l.g), fmt3((l as HitterLine).avg), String((l as HitterLine).hr),
       String((l as HitterLine).rbi), fmt3((l as HitterLine).ops)]
    : [String(l.g), (l as PitcherLine).ip.toFixed(1), fmt2((l as PitcherLine).era),
       String((l as PitcherLine).so), fmt2((l as PitcherLine).whip)];
  const icon = res.medal === "금" ? "🥇" : res.medal === "은" ? "🥈" : res.medal === "동" ? "🥉"
    : TOURNAMENTS[res.tournamentId].icon;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
      <div className="flex items-center justify-between bg-[var(--surface-2)] px-3 py-2">
        <span className="eyebrow">국가대표 · {res.tournamentName}</span>
        <span className="flex items-center gap-1.5 text-[11.5px] font-extrabold">
          {icon} {res.medal ? `${res.medal}메달` : `${res.rank}위`}
          {res.exempted && <Pill tone="gold">🎖️ 병역 면제</Pill>}
        </span>
      </div>
      <table className="tabular w-full text-[11.5px]">
        <thead>
          <tr className="border-y border-[var(--line)] text-[9.5px] text-[var(--ink-3)]">
            <th className="px-2.5 py-1.5 text-left font-bold">라운드</th>
            <th className="px-2 py-1.5 text-left font-bold">상대</th>
            <th className="px-2 py-1.5 text-right font-bold">결과</th>
            {head.map((h) => <th key={h} className="px-2 py-1.5 text-right font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {res.games.map((gm, i) => (
            <tr key={i} className="border-b border-[var(--line)] last:border-0">
              <td className={`px-2.5 py-1.5 font-bold ${gm.won ? "text-[var(--brand)]" : "text-[var(--ink-3)]"}`}>{gm.round}</td>
              <td className="px-2 py-1.5 text-[var(--ink-2)]">{gm.opponent}</td>
              <td className={`px-2 py-1.5 text-right font-extrabold ${gm.won ? "text-[var(--brand)]" : "text-[var(--danger)]"}`}>
                {gm.won ? "승" : "패"} {gm.score}
              </td>
              {gm.appeared === false
                ? <td className="px-2 py-1.5 text-right text-[var(--ink-3)]" colSpan={head.length}>결장</td>
                : row(gm.line).map((v, j) => <td key={j} className="px-2 py-1.5 text-right text-[var(--ink-2)]">{v}</td>)}
            </tr>
          ))}
          <tr className="bg-[var(--surface-2)] font-extrabold">
            <td className="px-2.5 py-1.5" colSpan={3}>대회 통산</td>
            {row(res.line).map((v, j) => <td key={j} className="px-2 py-1.5 text-right">{v}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** 은퇴 5년 뒤부터 열리는 명예의 전당 헌액 투표 */
function HofVoteBox({ g, vote, busy, run }: {
  g: GameState; vote: HofVote; busy: boolean; run: (a: Action) => void;
}) {
  const next = vote.firstYear + vote.ballots.length;
  return (
    <div className="mt-3 rounded-xl border border-[var(--line)] px-3.5 py-3 text-left">
      <div className="eyebrow mb-1.5">명예의 전당 헌액 투표</div>

      {vote.ballots.length === 0 && !vote.closed && (
        <p className="text-[12px] leading-relaxed text-[var(--ink-2)]">
          은퇴 {HOF_WAIT}년 뒤인 <b>{vote.firstYear}년</b>부터 후보에 오릅니다.
          기자단 투표에서 {HOF_CUT}% 이상을 얻어야 헌액됩니다.
        </p>
      )}

      {vote.ballots.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {vote.ballots.map((b) => (
            <li key={b.ballot} className="flex items-center gap-2">
              <span className="w-[62px] shrink-0 text-[11px] font-bold text-[var(--ink-3)]">
                {b.year} {b.ballot}차
              </span>
              <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${b.share}%`,
                    background: b.share >= HOF_CUT ? "var(--gold)" : "var(--brand)",
                  }}
                />
              </span>
              <span className="tabular w-[42px] shrink-0 text-right text-[11.5px] font-extrabold">
                {b.share}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {vote.inducted && (
        <div className="mt-2.5 rounded-lg bg-[var(--gold)]/15 px-3 py-2 text-center text-[12.5px] font-black text-[var(--gold)]">
          🏛️ 명예의 전당 헌액 · {g.player.name}
        </div>
      )}
      {vote.closed && !vote.inducted && (
        <p className="mt-2.5 text-[11.5px] text-[var(--ink-3)]">
          후보 자격을 잃었습니다. 기록은 남지만 전당에는 오르지 못했습니다.
        </p>
      )}
      {!vote.closed && (
        <button
          className="btn btn-ghost mt-2.5 w-full py-2 text-[12.5px]"
          disabled={busy}
          onClick={() => run({ type: "HOF_BALLOT" })}>
          {next}년 투표 결과 확인 🗳️
        </button>
      )}
    </div>
  );
}

/** 접힌 형태의 성적 요약 한 줄 */
function Strip({ label, line, level, role }: {
  label: string; line: StatLine; level?: string | null; role?: string | null;
}) {
  const cells = isHitterLine(line)
    ? [["AVG", fmt3(line.avg)], ["HR", String(line.hr)], ["RBI", String(line.rbi)],
       ["OPS", fmt3(line.ops)], ["WAR", line.war.toFixed(1)]]
    : [["ERA", fmt2((line as PitcherLine).era)], ["IP", (line as PitcherLine).ip.toFixed(1)],
       ["SO", String((line as PitcherLine).so)],
       ["WHIP", fmt2((line as PitcherLine).whip)], ["WAR", line.war.toFixed(1)]];
  return (
    <div className="card mb-3 px-3.5 py-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="eyebrow">{label}</span>
        {level && (
          <Pill tone={level === "KBO" ? "brand" : "neutral"}>
            {LEVEL_SHORT[level] ?? level}{role ? ` · ${role}` : ""}
          </Pill>
        )}
      </div>
      <div className="tabular grid grid-cols-5 gap-1">
        {cells.map(([k, v]) => (
          <div key={k} className="text-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink-3)]">{k}</div>
            <div className="text-[14px] font-extrabold">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 구단이 제시한 시즌 목표 */
function GoalCard({ g }: { g: GameState }) {
  const goal = g.seasonGoal!;
  return (
    <div className="card mb-3 flex items-start gap-3 px-3.5 py-3">
      <span className="text-[18px] leading-none">🎯</span>
      <div className="min-w-0 flex-1">
        <div className="eyebrow">구단이 제시한 목표</div>
        <div className="text-[13.5px] font-extrabold">{goal.label}</div>
        <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">{goal.desc}</div>
      </div>
      <span className="tabular shrink-0 text-right text-[10.5px] font-bold">
        <span className="block text-[var(--brand-2)]">달성 +{goal.reward}</span>
        <span className="block text-[var(--danger)]">실패 {goal.penalty}</span>
      </span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg bg-[var(--surface-2)] px-2 py-1.5 text-center">
      <div className="eyebrow">{label}</div>
      <div className="tabular text-[12.5px] font-extrabold">{value}</div>
    </div>
  );
}

function SumCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] px-1 py-2">
      <div className="eyebrow">{label}</div>
      <div className="tabular text-[15px] font-extrabold">{value}</div>
    </div>
  );
}

function RetireLink({ run, busy }: { run: (a: Action) => void; busy: boolean }) {
  return (
    <button
      onClick={() => { if (confirm("정말 은퇴하시겠습니까? 되돌릴 수 없습니다.")) run({ type: "RETIRE" }); }}
      disabled={busy}
      className="mt-4 w-full text-center text-[11.5px] text-[var(--ink-3)] underline underline-offset-2 hover:text-[var(--danger)]"
    >은퇴 선언하기</button>
  );
}

/* ================================================================== */

function DetailLine({ line }: { line: StatLine }) {
  const items: [string, string | number][] = isHitterLine(line)
    ? [["G", line.g], ["PA", line.pa], ["H", line.h], ["2B", line.b2], ["3B", line.b3],
       ["R", line.r], ["BB", line.bb], ["SO", line.so], ["SB", line.sb],
       ["OBP", fmt3(line.obp)], ["SLG", fmt3(line.slg)]]
    : [["G", line.g], ["GS", (line as PitcherLine).gs], ["IP", (line as PitcherLine).ip.toFixed(1)],
       ["H", line.h], ["BB", line.bb], ["SO", line.so], ["HR", (line as PitcherLine).hrAllowed],
       ["WHIP", fmt2((line as PitcherLine).whip)], ["K/9", fmt2((line as PitcherLine).k9)]];
  return (
    <div className="tabular grid grid-cols-4 gap-y-2 text-[11.5px]">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--ink-3)]">{k}</span>
          <span className="font-bold">{v}</span>
        </div>
      ))}
    </div>
  );
}

function CareerTab({ g }: { g: GameState }) {
  const kbo = g.seasons.filter((s) => s.level === "KBO");
  const other = g.seasons.filter((s) => s.level !== "KBO");
  const totals = careerTotals(g.seasons, g.player.kind, "KBO");
  const counted = g.seasons.flatMap((s) => s.awards)
    .reduce<Record<string, number>>((a, x) => ({ ...a, [x]: (a[x] ?? 0) + 1 }), {});

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <Section eyebrow="KBO" title="프로 통산 기록">
        {kbo.length === 0
          ? <Empty>아직 1군 기록이 없습니다.</Empty>
          : <SeasonTable seasons={kbo} kind={g.player.kind} totals={totals as unknown as Record<string, number>} />}
      </Section>

      {allTimeRanks(g.seasons, g.player.kind).length > 0 && (
        <Section eyebrow="All-Time" title="KBO 역대 순위">
          <div className="card flex flex-wrap gap-2 px-4 py-3.5">
            {allTimeRanks(g.seasons, g.player.kind).map((r) => (
              <span key={r.label}
                className="tabular rounded-lg px-2.5 py-1.5 text-[11.5px] font-extrabold"
                style={{
                  background: r.rank <= 3 ? "var(--gold)" : "var(--surface-2)",
                  color: r.rank <= 3 ? "#fff" : "var(--ink)",
                }}>
                통산 {r.label} {r.value.toLocaleString()} · 역대 {r.rank}위
              </span>
            ))}
          </div>
        </Section>
      )}

      {g.intlResults.length > 0 && (
        <Section eyebrow="National Team" title="국가대표 전적">
          <ul className="flex flex-col gap-2">
            {g.intlResults.map((r, i) => (
              <li key={i} className="card flex items-center gap-3 px-3.5 py-3">
                <span className="text-[18px]">{TOURNAMENTS[r.tournamentId].icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-extrabold">{r.year} {r.tournamentName}</span>
                    {r.medal && <Pill tone="gold">{r.medal}메달</Pill>}
                    {r.exempted && <Pill tone="brand">병역 면제</Pill>}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{r.note}</div>
                  {r.games.length > 0 && (
                    <ul className="tabular mt-1.5 flex flex-col gap-0.5">
                      {r.games.map((gm, j) => (
                        <li key={j} className="flex items-center gap-2 text-[11px]">
                          <span className="w-[78px] shrink-0 text-[var(--ink-3)]">{gm.round}</span>
                          <span className="min-w-0 flex-1 truncate">vs {gm.opponent}</span>
                          <span className={`font-extrabold ${gm.won ? "text-[var(--brand)]" : "text-[var(--danger)]"}`}>
                            {gm.won ? "승" : "패"} {gm.score}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Object.keys(counted).length > 0 && (
        <Section eyebrow="Awards" title="수상 내역">
          <div className="card flex flex-wrap gap-1.5 px-4 py-3.5">
            {Object.entries(counted).sort((a, b) => b[1] - a[1])
              .map(([k, v]) => <Pill key={k} tone="gold">🏅 {k}{v > 1 ? ` ×${v}` : ""}</Pill>)}
          </div>
        </Section>
      )}

      {other.length > 0 && (
        <Section eyebrow="Amateur / Minor / Army" title="아마추어 · 2군 · 군 복무">
          <SeasonTable seasons={other} kind={g.player.kind} />
        </Section>
      )}
    </div>
  );
}

function PlayerTab({ g }: { g: GameState }) {
  const p = g.player;
  const ovr = overall(p);
  const proYears = g.seasons.filter((r) => r.level === "KBO" || r.level === "MINOR").length;
  const scout = scoutedOverall(p, proYears, g.createdAt);
  const trait = traitById(p.trait);
  const style = deriveStyle(p);
  const nick2 = nickname(g);
  const team = g.contract ? teamById(g.contract.teamId) : null;
  const ab = p.abilities as unknown as Record<string, number>;

  return (
    <>
      <Section eyebrow="Ability" title="능력치"
        action={
          <div className="flex gap-1.5">
            <Pill tone="brand">OVR {ovr}</Pill>
            <Pill tone="gold">잠재 {scout.known ? scout.lo : `${scout.lo}~${scout.hi}`}</Pill>
          </div>
        }>
        <div className="card grid gap-2.5 px-4 py-4 sm:grid-cols-2 sm:gap-x-8">
          {abilityKeys(p.kind).map((k) => {
            const sc = scoutedPotential(p, k, proYears, g.createdAt);
            return (
              <AbilityBar key={k} k={k} value={ab[k]}
                potential={sc.lo} potentialHi={sc.hi} known={sc.known} />
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
          {scout.known
            ? "프로에서 충분히 뛰어 잠재력이 확정되었습니다."
            : `잠재력은 스카우트의 추정치입니다. 프로 시즌을 보낼수록 범위가 좁혀집니다 (현재 ${proYears}시즌).`}
        </p>
      </Section>

      <Section eyebrow="Status" title="상태">
        <div className="grid grid-cols-2 gap-2">
          <Gauge label="컨디션" value={p.condition} />
          <Gauge label="인지도" value={p.fame} />
          <Gauge label="구단 신뢰" value={g.trust} />
          <Gauge label="동료 관계" value={g.teammate} />
        </div>
      </Section>

      <Section eyebrow="Profile" title="선수 정보">
        <dl className="card divide-y divide-[var(--line)] px-4 text-[12.5px]">
          <Row k="선수 유형" v={<><b>{style.name}</b> <span className="text-[var(--ink-3)]">— {style.desc}</span></>} />
          <Row k="특성" v={<><b>{trait.name}</b> <span className="text-[var(--ink-3)]">— {trait.desc}</span></>} />
          <Row k="소속" v={team ? `${team.name} (${g.contract?.role})` : "아마추어"} />
          {team && (
            <Row k="홈구장" v={<><b>{team.park.name}</b> <span className="text-[var(--ink-3)]">— {team.park.label}</span></>} />
          )}
          {nick2 && <Row k="별명" v={<b>{nick2}</b>} />}
          <Row k="연봉" v={g.contract ? `${formatMoney(g.contract.salary)} · 계약 ${g.contract.remaining}/${g.contract.years}년` : "—"} />
          <Row k="병역" v={
            <span className={g.military === "PENDING" ? "text-[var(--danger)]" : undefined}>
              {MILITARY_LABEL[g.military]}
              {g.military === "PENDING" && ` (${Math.max(0, MILITARY_DEADLINE - p.age)}년 남음)`}
            </span>
          } />
          <Row k="드래프트" v={g.draftPick
            ? (g.draftPick.overall === 0 ? "미지명 (육성선수)" : `${g.draftPick.round}라운드 전체 ${g.draftPick.overall}순위 · ${teamById(g.draftPick.teamId).short}`)
            : "미정"} />
          <Row k="1군 등록" v={`${g.serviceYears.toFixed(1)}년 (FA까지 ${Math.max(0, FA_SERVICE + g.faUsed * 4 - g.serviceYears).toFixed(1)}년)`} />
          <Row k="투/타" v={`${HAND_LABEL[p.throws]}투 ${HAND_LABEL[p.bats]}타`} />
          {g.chains.length > 0 && (
            <Row k="진행 중" v={
              <span className="text-[var(--brand)]">
                {g.chains.map((c) => CHAIN_LABEL[c.key] ?? c.key).join(", ")} — {g.chains[0].dueYear}년 결과
              </span>
            } />
          )}
          {p.kind === "PITCHER" && (() => {
            const slot = armSlotById(p.armSlot);
            const pl = platoonProfile(p);
            return (
              <>
                <Row k="투구폼" v={<><b>{slot.name}</b> <span className="text-[var(--ink-3)]">— {slot.desc}</span></>} />
                <Row k="좌우 상대" v={
                  <span>
                    <span className="text-[var(--brand-2)]">{pl.strongSide} 강함</span>
                    <span className="mx-1 text-[var(--ink-3)]">/</span>
                    <span className="text-[var(--danger)]">{pl.weakSide} 약함</span>
                    <span className="ml-1.5 text-[var(--ink-3)]">(편차 {Math.round(pl.gap * 100)}%)</span>
                  </span>
                } />
              </>
            );
          })()}
          {p.kind === "HITTER" && p.bats !== "R" && (
            <Row k="타석 이점" v={
              <span className="text-[var(--brand-2)]">
                {p.bats === "S" ? "스위치 — 항상 유리한 쪽에서 친다" : "좌타 — 우완 상대가 많아 유리"}
              </span>
            } />
          )}
        </dl>
      </Section>
    </>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  const v = Math.round(value);
  const tone = v >= 70 ? "var(--brand-2)" : v >= 45 ? "var(--gold)" : "var(--danger)";
  return (
    <div className="card px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="tabular text-[14px] font-extrabold">{v}</span>
      </div>
      <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--line)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: tone }} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <dt className="w-[72px] shrink-0 text-[var(--ink-3)]">{k}</dt>
      <dd className="min-w-0 flex-1 text-right font-semibold">{v}</dd>
    </div>
  );
}

/** 커리어 기록 — 연도별로 묶는다 */
function TimelineTab({ g }: { g: GameState }) {
  const byYear = new Map<number, GameState["logs"]>();
  for (const l of g.logs) {
    const arr = byYear.get(l.year);
    if (arr) arr.push(l); else byYear.set(l.year, [l]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  if (!years.length) return <Section eyebrow="Timeline" title="커리어 기록"><Empty>아직 기록이 없습니다.</Empty></Section>;

  return (
    <Section eyebrow="Timeline" title="커리어 기록">
      <div className="flex flex-col gap-4">
        {years.map((year) => {
          const rec = g.seasons.find((s) => s.year === year);
          return (
            <div key={year}>
              <div className="mb-2 flex items-center gap-2">
                <span className="tabular text-[15px] font-black">{year}</span>
                {rec && (
                  <>
                    <span className="text-[11px] font-bold text-[var(--ink-3)]">
                      {rec.age}세 · {rec.teamName}
                    </span>
                    <Pill tone={rec.level === "KBO" ? "brand" : "neutral"}>
                      {LEVEL_SHORT[rec.level] ?? rec.level}{rec.level !== "ARMY" ? ` ${rec.role}` : ""}
                    </Pill>
                  </>
                )}
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>
              <LogList logs={byYear.get(year)!} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function LogList({ logs }: { logs: GameState["logs"] }) {
  if (!logs.length) return <Empty>아직 기록이 없습니다.</Empty>;
  const tone = { good: "var(--brand-2)", bad: "var(--danger)", epic: "var(--gold)", neutral: "var(--ink-3)" };
  return (
    <ul className="flex flex-col gap-2">
      {logs.map((l, i) => (
        <li key={i} className="card flex gap-3 px-3.5 py-3">
          <span className="text-[18px] leading-none">{l.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-extrabold" style={{ color: tone[l.tone] }}>{l.title}</span>
              <span className="tabular text-[10.5px] text-[var(--ink-3)]">{l.year}</span>
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-2)]">{l.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
