"use client";

import Link from "next/link";
import { AppBar, Column, Empty, Pill, Section } from "@/components/ui";
import { computeHof, MILITARY_DEADLINE } from "@/lib/career";
import { gradeOf, overall, POSITION_LABEL } from "@/lib/player";
import { deleteGame, useGames } from "@/lib/storage";
import { teamById } from "@/lib/teams";
import { Emblem } from "@/components/emblem";

const PHASE_LABEL: Record<string, string> = {
  HS_SEASON: "고교 3학년", PATH_CHOICE: "진로 선택", COLLEGE_SEASON: "대학 시절",
  DRAFT: "드래프트", SPRING_CAMP: "스프링캠프", FIRST_HALF: "전반기",
  ALL_STAR: "올스타 브레이크", POSTSEASON: "가을야구", SEASON_END: "시즌 종료",
  INTERNATIONAL: "국가대표", MILITARY_CHOICE: "입영 통지", MILITARY_SEASON: "군 복무",
  EVENT: "커리어 갈림길", NEGOTIATION: "연봉 협상", STOVE: "스토브리그",
  FA: "FA 협상", RETIRE_CHOICE: "기로", RETIRED: "은퇴",
};

export default function Home() {
  const { games, hydrated } = useGames();

  const active = games.filter((g) => g.phase !== "RETIRED");
  const retired = games
    .filter((g) => g.phase === "RETIRED")
    .sort((a, b) => (b.hofScore ?? 0) - (a.hofScore ?? 0));

  const remove = (id: string) => {
    if (!confirm("이 선수 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    deleteGame(id);
  };

  return (
    <main className="pb-16">
      <AppBar title="야구는 9회말 2아웃부터" />

      {/* 첫 화면은 조명이 켜진 밤 경기장이다 */}
      <div className="ballpark pinstripe relative px-4 pb-7 pt-8 text-white"
        style={{ background: "linear-gradient(160deg, #123258, #0e2a4d 55%, #071528)" }}>
        <Column>
        <div className="relative">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/40">
            Bottom of the 9th · 2 Outs
          </div>
          {/* 카운트 표시 — 구장 전광판에서 늘 보던 그것 */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">Out</span>
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
              <span className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-white/30" />
            </span>
          </div>
          <h2 className="mt-3 text-[27px] font-black leading-tight tracking-tight">
            아직 한 타석 남았습니다
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            고교 3학년부터 드래프트, 프로 시즌, FA와 은퇴까지.
            <br />9회말 2아웃에서도 커리어는 뒤집힙니다.
          </p>
          <Link href="/create"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-[15px] font-extrabold text-[var(--brand)] transition hover:bg-white/90">
            ⚾ 새로운 인생 시작 <span aria-hidden>→</span>
          </Link>
        </div>
        </Column>
      </div>
      <div className="seam-line" />
      <Column>

      <Section eyebrow="My Lives" title="나의 선수단">
        {!hydrated ? (
          <Empty>불러오는 중…</Empty>
        ) : active.length === 0 ? (
          <Empty>아직 키우는 선수가 없습니다.<br />새 인생을 시작해보세요.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((g) => {
              const team = g.contract ? teamById(g.contract.teamId) : null;
              const ovr = overall(g.player);
              return (
                <li key={g.id} className="card flex items-center gap-3 px-3.5 py-3">
                  <div className="relative shrink-0">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-[13px] font-black text-white"
                      style={{ background: team?.color ?? "var(--brand)" }}
                    >
                      {g.player.number}
                    </div>
                    {team && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--surface)] p-[1.5px]">
                        <Emblem teamId={team.id} size={17} />
                      </span>
                    )}
                  </div>
                  <Link href={`/play/${g.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-extrabold">{g.player.name}</span>
                      <Pill tone="brand">{gradeOf(ovr)} · {ovr}</Pill>
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-[var(--ink-3)]">
                      {g.year}년 · {g.player.age}세 · {POSITION_LABEL[g.player.position]} ·{" "}
                      {team?.short ?? "아마추어"} · {PHASE_LABEL[g.phase] ?? g.phase}
                    </div>
                  </Link>
                  <button onClick={() => remove(g.id)} aria-label="삭제"
                    className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-[var(--ink-3)] hover:text-[var(--danger)]">
                    삭제
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section eyebrow="Legends" title="명예의 전당">
        {retired.length === 0 ? (
          <Empty>은퇴한 선수가 없습니다.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {retired.map((g, i) => {
              const hof = computeHof(g);
              return (
                <li key={g.id}>
                  <Link href={`/play/${g.id}`} className="card flex items-center gap-3 px-3.5 py-3">
                    <span className="w-6 text-center text-[14px] font-black text-[var(--gold)]">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-extrabold">{g.player.name}</span>
                        <Pill tone="gold">{hof.tier}</Pill>
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">
                        {hof.seasons}시즌 · WAR {hof.war} · 수상 {hof.awards}회
                        {hof.rings > 0 && ` · 우승 ${hof.rings}회`}
                      </div>
                    </div>
                    <span className="tabular text-[13px] font-black">{hof.score}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section eyebrow="How to play" title="게임 방법">
        <ol className="card flex flex-col gap-2.5 px-4 py-4 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          <li><b className="text-[var(--ink)]">1. 선수 생성</b> — 이름·등번호·투타·포지션과 유형을 정하고, 세 명의 후보 중 하나를 고릅니다.</li>
          <li><b className="text-[var(--ink)]">2. 고교 시즌</b> — 마지막 고교 시즌 성적이 드래프트 순위를 좌우합니다.</li>
          <li><b className="text-[var(--ink)]">3. 진로 선택</b> — 바로 드래프트에 도전하거나, 대학에서 두 시즌 더 뛰고 재도전합니다.</li>
          <li><b className="text-[var(--ink)]">4. 시즌</b> — 스프링캠프(훈련) → 전반기 → 올스타 → 후반기 → 가을야구 순으로 한 해를 치릅니다. 월말마다 1군 콜업·2군 말소가 갈립니다.</li>
          <li><b className="text-[var(--ink)]">5. 스토브리그</b> — 연봉 협상을 직접 하고, 원하면 다른 구단에 이적을 신청합니다.</li>
          <li><b className="text-[var(--ink)]">6. 국가대표와 병역</b> — 아시안게임 금메달·올림픽 메달이면 병역이 면제됩니다. 상무는 지원해서 뽑혀야 가고, {MILITARY_DEADLINE}세까지 못 풀면 현역으로 18개월을 복무합니다.</li>
          <li><b className="text-[var(--ink)]">7. FA와 은퇴</b> — 1군 8시즌을 채우면 FA 자격을 얻습니다. 은퇴 후에는 진로를 고르고, 5년 뒤 명예의 전당 투표를 받습니다.</li>
        </ol>
        <p className="mt-3 text-center text-[11px] text-[var(--ink-3)]">
          모든 기록은 브라우저에만 저장됩니다 (localStorage).
        </p>
      </Section>
      </Column>
    </main>
  );
}
