"use client";

/**
 * 도감 — 커리어가 끝나도 남는 화면.
 *
 * 세이브를 지워도 남는다(`storage.ts`의 `slb:codex`).
 * 못 채운 칸은 **가리지 않고 조건을 적는다** — 가려두면 모을 이유가 안 생긴다.
 */

import { useState } from "react";
import { AppBar, Column, Container, Empty, Section } from "@/components/ui";
import { Emblem } from "@/components/emblem";
import { SECTIONS, type CodexEntry } from "@/lib/codex";
import { POSITION_LABEL } from "@/lib/player";
import { useCodex } from "@/lib/storage";

type Filter = "ALL" | "HITTER" | "PITCHER";

export default function CodexPage() {
  const { ids, careers } = useCodex();
  const [filter, setFilter] = useState<Filter>("ALL");
  const got = new Set(ids);

  const visible = (e: CodexEntry) => filter === "ALL" || !e.kind || e.kind === filter;
  const shown = SECTIONS.map((s) => ({ ...s, entries: s.entries.filter(visible) }));
  const total = shown.reduce((a, s) => a + s.entries.length, 0);
  const filled = shown.reduce((a, s) => a + s.entries.filter((e) => got.has(e.id)).length, 0);
  const pct = total ? Math.round((filled / total) * 100) : 0;

  return (
    <Container>
      <AppBar title="도감" back="/" />
      <Column>
        <div className="scoreboard mt-3 rounded-2xl px-4 py-4">
          <div className="flex items-end justify-between">
            <span className="text-[12px] font-bold text-white/70">모은 것</span>
            <span className="text-white">
              <b className="num scoreboard-num text-[26px]">{filled}</b>
              <span className="num text-[14px] text-white/60"> / {total}</span>
            </span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-500"
              style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/60">
            선수를 지워도 도감은 남습니다. 못 채운 칸에는 채우는 방법이 적혀 있습니다.
          </p>
        </div>

        <div className="mt-3 flex gap-1.5">
          {([["ALL", "전체"], ["HITTER", "야수"], ["PITCHER", "투수"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              className="flex-1 rounded-lg py-2 text-[12px] font-extrabold transition"
              style={filter === k
                ? { background: "var(--brand)", color: "#fff" }
                : { background: "var(--surface-2)", color: "var(--ink-3)" }}>
              {label}
            </button>
          ))}
        </div>

        {shown.map((s) => {
          const n = s.entries.filter((e) => got.has(e.id)).length;
          return (
            <Section key={s.id} eyebrow={`${n} / ${s.entries.length}`} title={s.title}>
              <p className="-mt-1 mb-2 text-[11.5px] leading-relaxed text-[var(--ink-3)]">{s.lead}</p>
              <div className="flex flex-col gap-1.5">
                {s.entries.map((e) => {
                  const have = got.has(e.id);
                  return (
                    <div key={e.id} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2"
                      style={{
                        background: have ? "color-mix(in srgb, var(--gold) 10%, transparent)" : "var(--surface-2)",
                        boxShadow: have ? "inset 0 0 0 1px color-mix(in srgb, var(--gold) 45%, transparent)" : undefined,
                      }}>
                      <span className="text-[15px] leading-none" style={{ opacity: have ? 1 : 0.3 }}>
                        {e.icon ?? "•"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-[12.5px]"
                          style={{ color: have ? "var(--gold)" : "var(--ink-3)" }}>
                          {e.name}
                        </b>
                        <span className="block text-[10px] leading-relaxed text-[var(--ink-3)]">
                          {have ? "달성" : e.hint}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        })}

        <Section eyebrow="Hall of Lives" title={`내 역대 선수 ${careers.length}명`}>
          {careers.length === 0 ? (
            <Empty>아직 은퇴한 선수가 없습니다.<br />한 커리어를 끝까지 걸으면 여기 남습니다.</Empty>
          ) : (
            <div className="flex flex-col gap-1.5">
              {careers.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                  style={{ background: "var(--surface-2)" }}>
                  <Emblem teamId={c.teamId} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b className="text-[12.5px]">{c.name}</b>
                      {c.hof && (
                        <span className="rounded-full px-1.5 py-[1px] text-[9px] font-black"
                          style={{ background: "color-mix(in srgb, var(--gold) 16%, transparent)", color: "var(--gold)" }}>
                          명예의 전당
                        </span>
                      )}
                    </span>
                    <span className="block text-[9.5px] text-[var(--ink-3)]">
                      {POSITION_LABEL[c.position] ?? c.position}
                      {c.nickname ? ` · ${c.nickname}` : ""}
                      {" · "}
                      <span className="num">{c.from}</span>–<span className="num">{c.to}</span>
                      {" · 1군 "}<span className="num">{c.seasons}</span>시즌
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block text-[13px] font-black">{c.war.toFixed(1)}</span>
                    <span className="block text-[9px] text-[var(--ink-3)]">WAR</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </Column>
    </Container>
  );
}
