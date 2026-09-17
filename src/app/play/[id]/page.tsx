"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AbilityBar, AppBar, Column, Container, Empty, Fold, Pill, Section, SeasonProgress } from "@/components/ui";
import { Broadcast, type BroadcastKind } from "@/components/broadcast";
import { KeyStats, SeasonTable, fmt2, fmt3, fmtIP } from "@/components/stats";
import {
  FA_SERVICE, MAX_SALARY, MILITARY_DEADLINE, MILITARY_OPTIONS, advance,
  canVolunteer, careerTotals, computeHof, draftForecast, formatMoney, sangmuOdds,
  seasonsAtLevel,
  retirementHonors, type Action,
  faGradeOf,
} from "@/lib/career";
import { fanFeed, seasonHeadline } from "@/lib/flavor";
import { HOF_CUT, HOF_WAIT, legacyContext, secondLifeOptions } from "@/lib/legacy";
import { allTimeRanks, nickname } from "@/lib/records";
import { isAgeEligible, TOURNAMENTS } from "@/lib/national";
import {
  abilityKeys, armSlotById, deriveStyle, DEV_RATE_LABEL, developmentRate, gradeOf,
  HELL_LIMIT, hellOdds,
  HAND_LABEL, overall, platoonProfile, POSITION_LABEL, scoutedOverall,
  scoutedPotential, traitById,
} from "@/lib/player";
import { isHitterLine, MAJOR_TITLES, subtractLine, titleOfStat } from "@/lib/sim";
import { RESOLVES } from "@/lib/resolve";
import { myRankAmong } from "@/lib/rivals";
import { monthsLeft, serviceOptions } from "@/lib/military";
import { saveGame, useGame } from "@/lib/storage";
import { isFranchiseRole } from "@/lib/roles";
import { teamById } from "@/lib/teams";
import { Emblem } from "@/components/emblem";
import { ClutchCard, ClutchReveal } from "@/components/clutch";
import {
  MILITARY_LABEL, type GameState, type HitterLine, type HofVote, type IntlResult,
  type Notice, type PitcherLine,
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
  // 중계 도중 새로고침하면 animQueue가 비지만 phase는 HALF_REVIEW로 남는다 —
  // 그 경우 중계를 다시 틀어 판정까지 이어지게 한다
  const anim: BroadcastKind | null = animQueue[0]
    ?? (g?.phase === "HALF_REVIEW" ? (g.liveHalf === "H2" ? "H2" : "H1") : null);

  const run = (action: Action) => {
    if (busy || !g) return;
    setBusy(true);
    const current = g;
    setTimeout(() => {
      const next = advance(current, action);
      saveGame(next);
      setBusy(false);
      /**
       * 중계 도중에 일어나는 액션(승부처)은 큐를 건드리면 안 된다.
       * 새로 계산하면 빈 큐가 되어 보고 있던 중계가 통째로 사라진다 —
       * 가을야구·국제대회처럼 phase로 되살릴 수 없는 중계는 결과도 못 보고 끝난다.
       */
      if (action.type === "RESOLVE_CLUTCH") {
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

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

  // 통보는 중계가 끝난 뒤에 띄운다 (중계 중에 덮으면 경기를 가린다)
  const notice = !anim ? g?.notices?.[0] ?? null : null;
  const dismissNotice = () => {
    if (!g) return;
    saveGame({ ...g, notices: (g.notices ?? []).slice(1) });
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
      {notice && <NoticeOverlay notice={notice} onClose={dismissNotice} />}
      {!anim && g.phase === "EVENT" && g.pendingEvent && (
        <EventModal ev={g.pendingEvent} busy={busy} run={run} />
      )}
      {!anim && g.rookieDeal && (
        <SignModal g={g} onSign={() => saveGame({ ...g, rookieDeal: null })} />
      )}
      <AppBar
        title={`${p.name} · ${g.year}년`}
        back="/"
        right={<span className="rounded-full bg-white/15 px-2 py-[3px] text-[10px] font-black">{gradeOf(ovr)} {ovr}</span>}
      />

      <div
        className="pinstripe relative"
        style={{ background: team ? `linear-gradient(135deg, ${team.color}, ${team.color}cc)` : "var(--brand)" }}
      >
        <Container className="px-4 py-4">
        <div className="flex items-center gap-3 text-white">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-[22px] font-black jersey">
            {p.number}
            {team && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-[2px] shadow">
                <Emblem teamId={team.id} size={20} />
              </span>
            )}
          </div>
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
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-white">
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
        <div className="seam-line" />
      </div>

      {/* 탭 바는 더그아웃 — 앉아서 그라운드를 보는 자리라 어둡다 */}
      {!anim && (
      <nav className="sticky top-[49px] z-20 bg-[var(--brand)]">
        <Container className="flex px-2">
          {([["season", "시즌"], ["career", "커리어"], ["player", "선수"], ["log", "기록"]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 border-b-[3px] py-2.5 text-[13px] font-extrabold transition ${
                tab === k
                  ? "border-[var(--danger)] text-white"
                  : "border-transparent text-white/45 hover:text-white/75"
              }`}>{label}</button>
          ))}
        </Container>
      </nav>
      )}

      <Container>
        {tab === "season" && !anim && (
          <SeasonProgress
            phase={g.phase}
            year={g.year}
            extra={g.pendingTournament && g.intlJoined
              ? `${TOURNAMENTS[g.pendingTournament].short} 대표팀`
              : g.military === "SANGMU" || g.military === "ACTIVE" ? "복무 중" : null}
          />
        )}
        {tab === "season" && (
          anim ? (
            <Broadcast
              key={anim} g={g} kind={anim} busy={busy}
              onAction={(a) => run(a)}
              onDone={() => {
                setAnimQueue((q) => q.slice(1));
                // 중계가 끝나야 반기 판정을 한다 — 승부처까지 반영된 기록으로
                if (animQueue.length <= 1 && g.phase === "HALF_REVIEW") run({ type: "FINISH_HALF" });
              }}
            />
          ) : (
            <div key={g.phase} className="stage">
              <div className="min-w-0">
                {(g.phase === "SEASON_END" || g.phase === "PATH_CHOICE" || g.phase === "DRAFT") && <SeasonReview g={g} />}
                <ActionCard g={g} busy={busy} run={run} />
              </div>
              <aside className="min-w-0 px-4 py-4">
                {/* 소식은 참고용이라 접어둔다 — 성적이 먼저 보여야 한다 */}
                <Fold title="최근 소식" count={Math.min(8, g.logs.length)} tone="card">
                  <LogList logs={g.logs.slice(0, 8)} />
                </Fold>
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
    <div className={`rounded-lg px-1.5 py-1.5 text-center ${alert ? "bg-black/30 ring-1 ring-white/35" : "bg-black/22"}`}>
      <div className="text-[8.5px] font-black uppercase tracking-[0.14em] opacity-60">{label}</div>
      <div className="scoreboard-num text-[13px] font-black">{value}</div>
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
          <Pill tone="brand"><Emblem teamId={last.teamId} size={13} className="mr-1 -ml-0.5 align-[-2px]" />{last.teamName}</Pill>
          <Pill>{last.role}</Pill>
          {last.byLevel
            ? <Pill>1군 · 2군</Pill>
            : last.level === "MINOR" && <Pill>2군</Pill>}
          {last.level === "ARMY" && <Pill tone="danger">🪖 복무</Pill>}
          {last.allStar && <Pill tone="gold">⭐ 올스타</Pill>}
          {last.teamRank && <Pill tone={last.teamRank <= 3 ? "gold" : "neutral"}>정규시즌 {last.teamRank}위</Pill>}
          {last.champion && <Pill tone="gold">🏆 한국시리즈 우승</Pill>}
        </div>

        <KeyStats line={last.line} awards={last.awards} />

        {(last.awards.length > 0 || last.potm?.length) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {last.awards.map((a) => <Pill key={a} tone="gold">🏅 {a}</Pill>)}
            {last.potm?.length ? (
              <Pill tone="gold">🏆 이달의 선수 {last.potm.length}회 ({last.potm.join(" · ")})</Pill>
            ) : null}
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

        <div className="mt-3 border-t border-[var(--line)] pt-1">
          <Fold title="상세 기록" count={isHitterLine(last.line) ? "타자" : "투수"}>
            <DetailLine line={last.line} awards={last.awards} />
          </Fold>
        </div>

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
    : [fmt2((l as PitcherLine).era), fmtIP((l as PitcherLine).ip),
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
    : [String(l.g), fmtIP((l as PitcherLine).ip), fmt2((l as PitcherLine).era),
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
  // 각오는 지난해 것을 그대로 이어가는 게 기본 — 매년 다시 고르게 하면 피로하다
  const [resolve, setResolve] = useState<string>(g.seasonResolve ?? "team");
  // 지옥 훈련은 방향과 별개로 켜고 끄는 토글이다
  const [hell, setHell] = useState(false);
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
                    <Mini label={`${f.wishName} 입단`} value={`${Math.round(f.wishOdds * 100)}%`} />
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
            <Mini label={`${f.wishName} 입단`} value={`${Math.round(f.wishOdds * 100)}%`} />
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-[var(--ink-3)]">
            지명 순위가 높을수록 희망 구단에 갈 여지가 커집니다. 못 가더라도 그 구단은
            <b> 이적·FA 시장에서 끝까지 관심을 보입니다.</b>
          </p>
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
          <div className="eyebrow mb-2 mt-1">1 · 올해의 각오</div>
          <p className="mb-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
            한 해를 어떤 마음으로 치를지 정합니다. <b>성적·부상·성장·구단 신뢰에 한 해 내내 걸립니다.</b>
            {" "}몸을 만든 해의 보상은 <b>다음 겨울</b>에 돌아옵니다.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {RESOLVES.map((r) => (
              <button key={r.id} type="button" onClick={() => setResolve(r.id)}
                className={`card px-3 py-2.5 text-left transition ${
                  resolve === r.id ? "!border-[var(--brand)] ring-2 ring-[var(--brand)]/20" : ""}`}>
                <div className="text-[12.5px] font-extrabold">{r.icon} {r.name}</div>
                <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--ink-3)]">{r.desc}</div>
                <div className="mt-1 text-[9.5px] font-bold text-[var(--brand-2)]">{r.trade}</div>
              </button>
            ))}
          </div>

          <div className="eyebrow mb-2 mt-1">2 · 훈련 강도</div>
          <HellToggle g={g} on={hell} onChange={setHell} />

          <div className="eyebrow mb-2 mt-4">3 · 훈련 방향</div>
          <p className="mb-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
            어떤 선수가 되고 싶은지 고릅니다. 어떤 능력이 오를지는 코칭스태프가 정합니다.
            {" "}같은 방향을 골라도 <b>겨울이 잘 풀린 해와 헛돈 해</b>가 갈립니다 — 멘탈과 몸 상태가 저울을 기울입니다.
            {hell && <b className="text-[var(--danger)]"> 지옥 훈련이 켜져 있습니다.</b>}
          </p>
          <div className="flex flex-col gap-2">
            {g.pendingTraining?.map((o) => (
              <button key={o.id} onClick={() => run({ type: "TRAIN", optionId: o.id, hell, resolveId: resolve })} disabled={busy}
                className="card px-4 py-3 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[14px] font-extrabold">{o.icon} {o.name}</span>
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
          {/*
            올스타전은 중계가 따로 없다. 승부처만 덩그러니 띄우면
            후반기를 시작하려는 화면에 웬 타석이 하나 박힌 꼴이 된다 —
            경기 결과와 한 덩어리로 묶어 "그 경기의 한 장면"으로 보여준다.
          */}
          {g.allStarGame && (() => {
            const asPending = !!g.allStarGame.clutchSituation && !g.allStarGame.clutch;
            return (
            <div
              className="mb-3 overflow-hidden rounded-xl text-white"
              style={{ background: "linear-gradient(150deg, var(--brand-2), var(--brand) 60%, #06182c)" }}
            >
              {/*
                승부처가 아직 열려 있으면 최종 스코어를 보여주지 않는다.
                9회 2사 상황을 고르라면서 그 위에 결과가 떠 있으면
                고를 이유가 사라진다. (실제로 겪음)
              */}
              <div className="flex items-center gap-2 px-4 pt-3.5">
                <span className="text-[18px]">{asPending ? "🎪" : g.allStarGame.mvp ? "🌟" : "🎪"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[9.5px] font-black uppercase tracking-[0.18em] opacity-55">
                    All-Star Game
                  </div>
                  <div className="text-[13.5px] font-extrabold">
                    {asPending ? (
                      <>{g.allStarGame.side} vs {g.allStarGame.opponent}<span className="ml-1.5 text-[11px] opacity-60">경기 진행 중</span></>
                    ) : (
                      <>
                        {g.allStarGame.side} {g.allStarGame.won ? "승리" : "패배"}
                        <span className="num ml-1.5">{g.allStarGame.score}</span>
                        {g.allStarGame.mvp && <span className="ml-1.5 text-[11px] text-[#e3c07a]">· MVP</span>}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4 pt-3">
                {g.allStarGame.clutchSituation && !g.allStarGame.clutch ? (
                  <ClutchCard
                    clutch={g.allStarGame.clutchSituation} busy={busy} dark
                    onPick={(id) => run({ type: "RESOLVE_CLUTCH", choice: id, where: "AS" })}
                  />
                ) : g.allStarGame.clutch ? (
                  <ClutchReveal r={g.allStarGame.clutch} />
                ) : null}
              </div>
            </div>
            );
          })()}
          {g.halfLine && <Strip label="전반기 성적" line={g.halfLine} where={whereLabel(g)} />}
          {g.pendingTrade ? (
            <div className="card mb-3 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">📞</span>
                <span className="text-[14px] font-extrabold">트레이드 데드라인</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-2)]">{g.pendingTrade.note}</p>
              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2">
                <Emblem teamId={g.pendingTrade.teamId} size={28} />
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
          {g.seasonLine && <Strip label="정규시즌 최종" line={g.seasonLine} where={whereLabel(g)} />}
          <Primary onClick={() => run({ type: "PLAY_POSTSEASON" })} busy={busy} label="가을야구 진행 중…">가을야구 시작 🍁</Primary>
        </Wrap>
      );

    case "EVENT":
      // 갈림길은 페이지 최상위에서 화면을 덮는다(EventModal).
      // 여기서 그리면 .stage의 transform 애니메이션이 만든 stacking context에
      // fixed가 갇혀, sticky 탭 바보다 아래로 깔린다. (실제로 겪음)
      return null;

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
            {t.id === "ASIAN_GAMES" && (
              <div className="mt-2 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--ink-3)]">선발 자격</span>
                <span className="font-bold">
                  {isAgeEligible(g) ? "만 25세 이하 · 4년차 이하" : "⭐ 와일드카드 (3명)"}
                </span>
              </div>
            )}
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
          desc={`${MILITARY_DEADLINE}세가 되어 더 이상 병역을 미룰 수 없습니다.`
            + (canVolunteer(g) ? " 복무 형태를 선택하세요." : " 상무 지원 기회는 모두 지나갔습니다.")}>
          <div className="flex flex-col gap-2">
            {/* 상무는 스토브리그에 지원해서 뽑혀야 간다 — 입영 통지 시점에는 대개 현역뿐이다 */}
            {MILITARY_OPTIONS.filter((o) => o.id === "ACTIVE" || canVolunteer(g)).map((o) => (
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

    case "MILITARY_SEASON": {
      const sangmu = g.military === "SANGMU";
      const left = monthsLeft(g);
      return (
        <Wrap eyebrow="Service" title={sangmu ? "상무 복무" : "현역 복무"}
          desc={sangmu
            ? "국군체육부대에서 퓨처스리그를 뜁니다. 이 한 해를 어떻게 쓸지 정하세요."
            : "야구를 떠나 있는 기간입니다. 이 한 해를 어떻게 쓸지 정하세요."}>
          {/* 전역까지 — 복무는 시즌이 아니라 개월로 센다 */}
          <div className="mb-3 overflow-hidden rounded-xl text-white"
            style={{ background: "linear-gradient(150deg, #3f4a36, #2b3327 60%, #161b13)" }}>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-[22px]">🎖️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[9.5px] font-black uppercase tracking-[0.18em] opacity-55">
                  {sangmu ? "Sangmu" : "Active Duty"}
                </div>
                <div className="text-[14px] font-extrabold">
                  {sangmu ? "국군체육부대 야구단" : "현역 복무 중"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[9.5px] font-black uppercase tracking-[0.16em] opacity-55">전역까지</div>
                <div className="num text-[20px] font-black">D-{left}<span className="ml-0.5 text-[11px] opacity-70">개월</span></div>
              </div>
            </div>
            <span className="block h-[4px] w-full bg-white/15">
              <span className="block h-full bg-white/70"
                style={{ width: `${Math.round((1 - left / 18) * 100)}%` }} />
            </span>
          </div>

          <div className="eyebrow mb-2">복무 방침</div>
          <p className="mb-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
            {sangmu
              ? "경기에 나갈지, 몸을 키울지, 부대에 충실할지 — 전역할 때 다른 선수가 되어 나옵니다."
              : "야구를 못 하는 기간이지만, 어떻게 보내느냐에 따라 떨어지는 속도가 달라집니다."}
          </p>
          <div className="flex flex-col gap-2">
            {serviceOptions(g.military).map((o) => (
              <button key={o.id} onClick={() => run({ type: "SERVE", optionId: o.id })} disabled={busy}
                className="card px-4 py-3 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                <div className="text-[13.5px] font-extrabold">{o.icon} {o.name}</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-3)]">{o.desc}</div>
                <div className="mt-1 text-[10.5px] font-bold text-[var(--brand-2)]">{o.trade}</div>
              </button>
            ))}
          </div>
        </Wrap>
      );
    }

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
                {o.id !== "accept" && (
                  <div className="tabular mt-1.5 text-[11px] font-bold">
                    <span className="text-[var(--brand-2)]">성공 {formatMoney(o.onSuccess)}</span>
                    <span className="mx-1.5 text-[var(--ink-3)]">/</span>
                    <span className="text-[var(--danger)]">
                      실패 {formatMoney(o.onFail)}
                      {o.onFail < n.previous && " ↓"}
                    </span>
                  </div>
                )}
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
                      <Emblem teamId={tm.id} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-extrabold">{tm.name}</span>
                          <Pill tone={t.projRank <= 3 ? "gold" : t.projRank <= 6 ? "brand" : "neutral"}>
                            예상 {t.projRank}위
                          </Pill>
                          <span className="tabular shrink-0 text-[10px] text-[var(--ink-3)]">전력 {t.power}</span>
                        </span>
                        <span className="block truncate text-[10.5px] text-[var(--ink-3)]">
                          {t.outlook} · {t.note} · 예상 보직 {t.role}
                        </span>
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
          {canVolunteer(g) && !g.sangmuApplied && (
            <button onClick={() => run({ type: "APPLY_SANGMU" })} disabled={busy}
              className="card mb-2 w-full px-4 py-3 text-left transition hover:border-[var(--brand)]">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-extrabold">🎽 상무 야구단 지원</span>
                <Pill tone="gold">선발 확률 {Math.round(sangmuOdds(g, overall(g.player)) * 100)}%</Pill>
              </div>
              <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">
                해마다 정원이 있어 지원해도 떨어질 수 있습니다. 합격하면 18개월간 퓨처스리그에서 뜁니다.
              </div>
            </button>
          )}
          {g.sangmuApplied && g.military === "PENDING" && (
            <div className="card mb-2 px-4 py-3 text-[11.5px] text-[var(--ink-3)]">
              🎽 올해 상무 지원에서 떨어졌습니다. 내년에 다시 지원할 수 있습니다.
            </div>
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
          {(() => {
            /* 등급이 높을수록 보상이 무거워 붙는 구단이 줄어든다 */
            const fa = faGradeOf(g.contract?.salary ?? 0);
            const tone = fa.grade === "A" ? "var(--gold)" : fa.grade === "B" ? "var(--brand-2)" : "var(--ink-3)";
            return (
              <div className="card mb-3 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[17px] font-black text-white"
                    style={{ background: tone }}
                  >
                    {fa.grade}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9.5px] font-black uppercase tracking-[0.18em] text-[var(--ink-3)]">
                      FA 등급
                    </div>
                    <div className="text-[12.5px] font-extrabold">
                      {fa.grade}등급 · 영입 구단 보상 부담 {fa.grade === "A" ? "큼" : fa.grade === "B" ? "보통" : "작음"}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
                  보상 {fa.compensation}.
                  {fa.grade === "A"
                    ? " 대우가 좋았던 만큼 데려가는 쪽 부담이 커서, 붙는 구단이 적습니다."
                    : fa.grade === "C"
                      ? " 보상 부담이 가벼워 여러 구단이 관심을 보입니다."
                      : " 적당한 보상이라 시장이 크게 좁아지지는 않습니다."}
                </p>
              </div>
            );
          })()}
          <div className="flex flex-col gap-2">
            {g.pendingOffers?.map((o) => {
              const t = teamById(o.teamId);
              return (
                <button key={o.teamId} onClick={() => run({ type: "ACCEPT_OFFER", teamId: o.teamId })} disabled={busy}
                  className="card px-4 py-3.5 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                  <div className="flex items-center gap-3">
                    <Emblem teamId={t.id} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-extrabold">{t.name}</span>
                      <span className="block truncate text-[11px] text-[var(--ink-3)]">{o.note} · 전력 {t.power}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="num block text-[12px] font-bold text-[var(--ink-3)]">{o.years}년</span>
                      <span className="num block text-[16px] font-black">{formatMoney(o.total)}</span>
                    </span>
                  </div>

                  {/* 같은 총액이라도 어떻게 짜였는지가 다르다 — 그걸 먼저 보여준다 */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <Pill tone={o.incentive === 0 ? "brand" : o.incentive / o.total >= 0.3 ? "danger" : "neutral"}>
                      {o.styleNote.split(" —")[0]}
                    </Pill>
                    <span className="num text-[10.5px] font-bold text-[var(--ink-3)]">
                      보장 {Math.round((o.guaranteed / o.total) * 100)}%
                    </span>
                  </div>

                  <div className="mt-2.5 border-t border-[var(--line)] pt-2.5">
                    <div className="num flex items-baseline gap-2 text-[11.5px]">
                      <span className="w-[34px] shrink-0 font-extrabold text-[var(--brand)]">보장</span>
                      <span className="font-extrabold">{formatMoney(o.guaranteed)}</span>
                      <span className="text-[var(--ink-3)]">
                        계약금 {formatMoney(o.signingBonus)} · 연봉 {formatMoney(o.salary)}/년
                      </span>
                    </div>
                    <div className="num mt-1 flex items-baseline gap-2 text-[11.5px]">
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
          eyebrow="After Baseball"
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

/**
 * 통보 오버레이 — 콜업·이적·발탁처럼 커리어가 꺾이는 사건은
 * 로그 한 줄로 흘려보내지 않고 확인을 받고 넘어간다.
 */
/** 지옥 훈련 — 커리어 두 번뿐인 도박 */
function HellToggle({ g, on, onChange }: {
  g: GameState; on: boolean; onChange: (v: boolean) => void;
}) {
  const left = HELL_LIMIT - (g.hellUsed ?? 0);
  const odds = Math.round(hellOdds(g.player) * 100);
  const spent = left <= 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => onChange(false)}
        className={`rounded-xl border px-3.5 py-3 text-left transition ${
          !on ? "border-[var(--brand)] bg-[var(--brand)]/6" : "border-[var(--line)] bg-[var(--surface)]"
        }`}>
        <div className="text-[13.5px] font-extrabold">🏋️ 일반 훈련</div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-3)]">
          정석대로 한 겨울을 보냅니다. 결과가 확실합니다.
        </p>
      </button>

      <button
        onClick={() => !spent && onChange(true)}
        disabled={spent}
        className={`rounded-xl border px-3.5 py-3 text-left transition ${
          spent ? "border-[var(--line)] bg-[var(--surface-2)] opacity-55"
            : on ? "border-[var(--danger)] bg-[var(--danger)]/8" : "border-[var(--line)] bg-[var(--surface)]"
        }`}>
        <div className="flex items-center gap-1.5">
          <span className="text-[13.5px] font-extrabold">🔥 지옥 훈련</span>
          {spent
            ? <Pill tone="neutral">소진</Pill>
            : <Pill tone={on ? "danger" : "gold"}>{left}회 남음</Pill>}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-3)]">
          {spent
            ? `커리어에 ${HELL_LIMIT}번뿐입니다. 남은 기회가 없습니다.`
            : <>성공 <b>{odds}%</b>. 되면 크게 늘지만, 실패하면 한 해를 버립니다.</>}
        </p>
      </button>
    </div>
  );
}

/**
 * 커리어 갈림길.
 *
 * 화면을 덮어 잠깐 멈춰 세운다. **페이지 최상위에서 그린다** —
 * 애니메이션이 걸린 컨테이너 안에서 그리면 fixed가 그 안에 갇힌다.
 */
/**
 * 입단 계약서.
 *
 * 지명 결과를 로그 한 줄로 흘려보내면 커리어가 시작된 느낌이 없다.
 * 어느 팀이, 몇 순위로, 얼마에 데려가는지를 계약서 한 장으로 보여주고
 * **직접 서명해야** 다음으로 넘어간다.
 */
function SignModal({ g, onSign }: { g: GameState; onSign: () => void }) {
  const d = g.rookieDeal!;
  const t = teamById(d.teamId);
  const [signed, setSigned] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-5 backdrop-blur-[2px]">
      <div className="pop max-h-[88dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-[var(--surface)] shadow-2xl">
        <div className="pinstripe px-5 py-4 text-white" style={{ background: t.color }}>
          <div className="flex items-center gap-2.5">
            <Emblem teamId={t.id} size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-[9.5px] font-black uppercase tracking-[0.2em] opacity-60">
                Player Contract
              </div>
              <div className="truncate text-[16px] font-black">{t.name}</div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-col gap-px overflow-hidden rounded-xl bg-[var(--line)]">
            <Row2 k="지명" v={d.overall === 0 ? "미지명 · 육성선수 계약" : `${d.round}라운드 전체 ${d.overall}순위`} />
            <Row2 k="계약금" v={d.bonus > 0 ? formatMoney(d.bonus) : "없음"} big />
            <Row2 k="첫해 연봉" v={formatMoney(d.salary)} big />
            <Row2 k="보직" v={`${d.role}`} />
            <Row2 k="구단" v={`전력 ${t.power} · ${t.park.name}`} />
          </div>
          {d.wish && (
            <p className="mt-2.5 text-center text-[11.5px] font-extrabold text-[var(--brand-2)]">
              희망하던 구단의 지명을 받았습니다.
            </p>
          )}

          <div className="mt-4">
            <div className="eyebrow mb-1.5">서명란</div>
            <button
              onClick={() => setSigned(true)}
              disabled={signed}
              className="relative flex h-[74px] w-full items-center justify-center rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--surface-2)] transition hover:border-[var(--brand-2)] disabled:border-solid disabled:border-[var(--brand)]"
            >
              {signed ? (
                <span className="sign text-[26px] font-black text-[var(--brand)]">{g.player.name}</span>
              ) : (
                <span className="text-[12px] font-bold text-[var(--ink-3)]">여기를 눌러 서명하세요</span>
              )}
            </button>
          </div>

          <button
            onClick={onSign}
            disabled={!signed}
            className="btn btn-primary mt-3 w-full py-3.5 text-[15px]"
          >
            {signed ? "계약서 제출 ✍️" : "서명이 필요합니다"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row2({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-[var(--surface)] px-3.5 py-2.5">
      <span className="w-[64px] shrink-0 text-[11px] font-bold text-[var(--ink-3)]">{k}</span>
      <span className={`num flex-1 text-right font-black ${big ? "text-[16px]" : "text-[12.5px]"}`}>{v}</span>
    </div>
  );
}

function EventModal({ ev, busy, run }: {
  ev: NonNullable<GameState["pendingEvent"]>; busy: boolean; run: (a: Action) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5 backdrop-blur-[2px]">
      <div className="pop max-h-[86dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-[var(--surface)] shadow-2xl">
        <div className="px-6 pt-6 text-center">
          <div className="text-[44px] leading-none">{ev.icon}</div>
          <div className="mt-2 text-[9.5px] font-black uppercase tracking-[0.2em] text-[var(--ink-3)]">
            Turning Point
          </div>
          <div className="text-[19px] font-black">{ev.title}</div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">{ev.body}</p>
          <div className="mt-3 flex flex-col gap-2">
            {ev.options.map((o) => (
              <button key={o.id} onClick={() => run({ type: "CHOOSE_EVENT", optionId: o.id })} disabled={busy}
                className="card px-4 py-3 text-left transition hover:!border-[var(--brand)] disabled:opacity-50">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13.5px] font-extrabold">{o.label}</span>
                  {o.risky && <Pill tone="danger">위험</Pill>}
                </div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">{o.desc}</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[10.5px] leading-relaxed text-[var(--ink-3)]">
            이 선택의 결과는 다음 시즌이 끝날 때 드러납니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function NoticeOverlay({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const accent = notice.accent
    ?? (notice.tone === "bad" ? "var(--danger)" : notice.tone === "epic" ? "var(--gold)" : "var(--brand)");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-5 backdrop-blur-[2px]"
      onClick={onClose}>
      <div
        className="pop w-full max-w-[420px] overflow-hidden rounded-2xl bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 text-center" style={{ background: `${accent}12` }}>
          <div className="text-[44px] leading-none">{notice.icon}</div>
          <div className="mt-2 text-[9.5px] font-black uppercase tracking-[0.2em] text-[var(--ink-3)]">
            {notice.eyebrow}
          </div>
          <div className="mt-0.5 pb-5 text-[20px] font-black" style={{ color: accent }}>
            {notice.title}
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">{notice.body}</p>

          {notice.change && notice.change.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {notice.change.map((c, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[12px]">
                  <span className="w-[62px] shrink-0 text-[var(--ink-3)]">{c.label}</span>
                  <span className="text-[var(--ink-3)]">{c.from}</span>
                  <span className="text-[var(--ink-3)]">→</span>
                  <span className="font-extrabold" style={{ color: accent }}>{c.to}</span>
                </li>
              ))}
            </ul>
          )}

          <button onClick={onClose} className="btn btn-primary mt-4 w-full py-2.5 text-[13px]">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

/** 그해 국제대회 — 경기별 기록과 대회 통산 */
function IntlBox({ res }: { res: IntlResult }) {
  const hitter = isHitterLine(res.line);
  const head = hitter ? ["G", "AVG", "HR", "RBI", "OPS"] : ["G", "IP", "ERA", "SO", "WHIP"];
  const row = (l: StatLine) => hitter
    ? [String(l.g), fmt3((l as HitterLine).avg), String((l as HitterLine).hr),
       String((l as HitterLine).rbi), fmt3((l as HitterLine).ops)]
    : [String(l.g), fmtIP((l as PitcherLine).ip), fmt2((l as PitcherLine).era),
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
/**
 * 이 기록을 어디서 쌓았는가.
 * 지금 소속을 그대로 쓰면, 6월까지 1군에서 뛰고 7월에 내려간 선수의
 * 전반기 기록이 통째로 "2군"으로 적힌다.
 */
function whereLabel(g: GameState): { text: string; pro: boolean } | null {
  const by = g.seasonByLevel;
  if (by?.KBO && by?.MINOR) return { text: "1군 · 2군", pro: true };
  if (by?.KBO) return { text: `1군 · ${g.seasonRole ?? ""}`, pro: true };
  if (by?.MINOR) return { text: `2군 · ${g.seasonRole ?? ""}`, pro: false };
  if (!g.seasonLevel) return null;
  return {
    text: `${LEVEL_SHORT[g.seasonLevel] ?? g.seasonLevel}${g.seasonRole ? ` · ${g.seasonRole}` : ""}`,
    pro: g.seasonLevel === "KBO",
  };
}

function Strip({ label, line, where }: {
  label: string; line: StatLine; where?: { text: string; pro: boolean } | null;
}) {
  const cells = isHitterLine(line)
    ? [["AVG", fmt3(line.avg)], ["HR", String(line.hr)], ["RBI", String(line.rbi)],
       ["OPS", fmt3(line.ops)], ["WAR", line.war.toFixed(1)]]
    : [["ERA", fmt2((line as PitcherLine).era)], ["IP", fmtIP((line as PitcherLine).ip)],
       ["SO", String((line as PitcherLine).so)],
       ["WHIP", fmt2((line as PitcherLine).whip)], ["WAR", line.war.toFixed(1)]];
  return (
    <div className="card mb-3 px-3.5 py-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="eyebrow">{label}</span>
        {where && <Pill tone={where.pro ? "brand" : "neutral"}>{where.text}</Pill>}
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

function DetailLine({ line, awards }: { line: StatLine; awards?: string[] }) {
  // [표시 이름, 값, 타이틀 대응 키] — 요약 5칸에 없는 부문(안타·득점·출루율·장타율·도루·이닝·세이브·홀드)은 이 표에만 나온다
  const items: [string, string | number, string?][] = isHitterLine(line)
    ? [["G", line.g], ["PA", line.pa], ["H", line.h, "h"], ["2B", line.b2], ["3B", line.b3],
       ["R", line.r, "r"], ["BB", line.bb], ["SO", line.so], ["SB", line.sb, "sb"],
       ["OBP", fmt3(line.obp), "obp"], ["SLG", fmt3(line.slg), "slg"]]
    : [["G", line.g], ["GS", (line as PitcherLine).gs], ["IP", fmtIP((line as PitcherLine).ip), "ip"],
       ["SV", (line as PitcherLine).sv, "sv"], ["HLD", (line as PitcherLine).hld, "hld"],
       ["H", line.h], ["BB", line.bb], ["SO", line.so, "so"], ["HR", (line as PitcherLine).hrAllowed],
       ["WHIP", fmt2((line as PitcherLine).whip)], ["K/9", fmt2((line as PitcherLine).k9)]];
  return (
    <div className="tabular grid grid-cols-4 gap-y-2 text-[11.5px]">
      {items.map(([k, v, stat]) => {
        const title = stat ? titleOfStat(awards, stat) : null;
        return (
          <div key={k} className="flex flex-col" title={title ?? undefined}>
            <span className={`text-[9.5px] font-bold uppercase tracking-wider ${
              title ? "text-[var(--gold)]" : "text-[var(--ink-3)]"
            }`}>{title ? "👑 " : ""}{k}</span>
            <span className={`font-bold ${title ? "text-[var(--gold)]" : ""}`}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 동기 보드 — 같은 해에 지명받은 선수들이 지금 어디까지 왔는가.
 * "내가 리그 1위"보다 "내가 류태호를 제쳤다"가 기록에 무게를 싣는다.
 */
function RivalBoard({ g, myWar }: { g: GameState; myWar: number }) {
  const rows = [
    ...(g.rivals ?? []).map((r) => ({
      key: r.id, name: r.name, teamId: r.teamId, pick: `${r.pick}순위`,
      pos: r.position, seasons: r.seasons, war: r.war,
      titles: r.titles, mvp: r.mvp, gone: r.retiredYear, epitaph: r.epitaph, me: false,
    })),
    {
      key: "me", name: g.player.name, teamId: g.contract?.teamId ?? "-",
      pick: g.draftPick ? (g.draftPick.overall === 0 ? "육성" : `${g.draftPick.overall}순위`) : "—",
      pos: g.player.position,
      seasons: seasonsAtLevel(g.seasons, "KBO").length, war: myWar,
      titles: g.seasons.reduce((a, s) => a + s.awards.filter((w) => MAJOR_TITLES.includes(w) && w !== "정규시즌 MVP").length, 0),
      mvp: g.seasons.reduce((a, s) => a + s.awards.filter((w) => w === "정규시즌 MVP").length, 0),
      gone: null as number | null, epitaph: null as string | null, me: true,
    },
  ].sort((a, b) => b.war - a.war);

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <div key={r.key}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2"
          style={{
            background: r.me ? "var(--brand)" : "var(--surface-2)",
            color: r.me ? "#fff" : undefined,
            opacity: r.gone ? 0.6 : 1,
          }}>
          <span className={`num w-[18px] shrink-0 text-center text-[12px] font-black ${r.me ? "" : "text-[var(--ink-3)]"}`}>{i + 1}</span>
          <Emblem teamId={r.teamId} size={20} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-extrabold">
              {r.name}{r.me && " (나)"}
            </span>
            <span className={`block text-[9.5px] ${r.me ? "opacity-70" : "text-[var(--ink-3)]"}`}>
              {r.pick} · {r.pos} · {r.seasons > 0 ? `1군 ${r.seasons}시즌` : r.gone ? "1군 기록 없음" : "2군"}{r.gone ? ` · ${r.gone} 은퇴` : ""}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="num block text-[13px] font-black">{r.war.toFixed(1)}</span>
            <span className={`block text-[9px] ${r.me ? "opacity-70" : "text-[var(--ink-3)]"}`}>
              WAR{r.mvp ? ` · MVP ${r.mvp}` : r.titles ? ` · 타이틀 ${r.titles}` : ""}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function CareerTab({ g }: { g: GameState }) {
  const kbo = seasonsAtLevel(g.seasons, "KBO");
  // 1군을 오간 시즌은 2군 표에도 그 몫만 들어간다
  const other = [
    ...g.seasons.filter((x) => x.level !== "KBO" && x.level !== "MINOR"),
    ...seasonsAtLevel(g.seasons, "MINOR"),
  ].sort((a, b) => a.year - b.year || (a.level === "MINOR" ? 1 : -1));
  const totals = careerTotals(g.seasons, g.player.kind, "KBO");
  const counted = g.seasons.flatMap((s) => s.awards)
    .reduce<Record<string, number>>((a, x) => ({ ...a, [x]: (a[x] ?? 0) + 1 }), {});
  // 이달의 선수는 시즌 수상 배열이 아니라 달 단위로 쌓이므로 따로 센다
  const potmTotal = g.seasons.reduce((a, s) => a + (s.potm?.length ?? 0), 0);
  if (potmTotal) counted["이달의 선수"] = potmTotal;

  return (
    <div className="mx-auto w-full max-w-[460px]">
      <Section eyebrow="KBO" title="프로 통산 기록">
        {kbo.length === 0
          ? <Empty>아직 1군 기록이 없습니다.</Empty>
          : <SeasonTable seasons={kbo} kind={g.player.kind} totals={totals as unknown as Record<string, number>} />}
      </Section>

      {!!g.rivals?.length && (
        <Section eyebrow="Draft Class" title={`${g.rivals.length + 1}인의 동기`}>
          <Fold title="같은 해에 지명받은 선수들"
            count={`통산 WAR ${myRankAmong(g.rivals, (totals as unknown as Record<string, number>).war)}위 / ${g.rivals.length + 1}명`}>
            <RivalBoard g={g} myWar={(totals as unknown as Record<string, number>).war} />
          </Fold>
        </Section>
      )}

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
        <div className="px-4 py-4">
          {/* 1군 기록이 먼저다 — 그 아래 기록은 찾아볼 때만 편다 */}
          <Fold title="아마추어 · 2군 · 군 복무" count={`${other.length}시즌`} tone="card">
            <SeasonTable seasons={other} kind={g.player.kind} />
          </Fold>
        </div>
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
          <Row k="연봉" v={g.contract
            ? `${formatMoney(g.contract.salary)} · ${g.contract.years}년 계약 ${
              g.contract.remaining <= 0 ? "· 마지막 해" : `· 잔여 ${g.contract.remaining + 1}년`
            }`
            : "—"} />
          <Row k="병역" v={
            <span className={g.military === "PENDING" ? "text-[var(--danger)]" : undefined}>
              {MILITARY_LABEL[g.military]}
              {g.military === "PENDING" && ` (${Math.max(0, MILITARY_DEADLINE - p.age)}년 남음)`}
            </span>
          } />
          <Row k="드래프트" v={g.draftPick
            ? (g.draftPick.overall === 0 ? "미지명 (육성선수)" : `${g.draftPick.round}라운드 전체 ${g.draftPick.overall}순위 · ${teamById(g.draftPick.teamId).short}`)
            : "미정"} />
          {/* FA를 막는 조건이 둘이다(등록일수·계약 잔여) — 지금 걸려 있는 쪽을 보여준다 */}
          <Row k="1군 등록" v={(() => {
            const need = Math.max(0, FA_SERVICE + g.faUsed * 4 - g.serviceYears);
            const svc = `${g.serviceYears.toFixed(1)}년`;
            if (need > 0) return `${svc} · FA까지 ${need.toFixed(1)}년`;
            if ((g.contract?.remaining ?? 0) > 0) return `${svc} · FA 자격 충족 (계약 ${g.contract!.remaining + 1}년 남음)`;
            return `${svc} · 이번 시즌 뒤 FA`;
          })()} />
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
