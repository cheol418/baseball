"use client";

import { useState } from "react";
import type { Clutch, ClutchOutcome, ClutchResult } from "@/lib/clutch";

/**
 * 승부처 선택 카드.
 *
 * 반기를 시작할 때 고르고, 무엇이 나왔는지는 중계가 그 달에 닿아야 안다.
 * 버튼 하나 누르고 지켜보기만 하던 자리에 판단을 하나 끼워 넣는다.
 */
export function ClutchCard({ clutch, onPick, busy }: {
  clutch: Clutch; onPick: (id: string) => void; busy: boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="card mb-3 overflow-hidden">
      <div className="bg-[var(--brand)] px-4 py-3 text-white">
        <div className="text-[9.5px] font-black uppercase tracking-[0.18em] opacity-70">
          Clutch · {clutch.monthLabel} · vs {clutch.opponent}
        </div>
        <div className="mt-1 text-[11px] font-bold opacity-85">{clutch.eyebrow}</div>
        <div className="text-[18px] font-black">{clutch.title}</div>
        <p className="mt-1 text-[11.5px] leading-relaxed opacity-80">{clutch.body}</p>
      </div>

      <div className="px-3.5 py-3">
        <div className="eyebrow mb-2">어떻게 승부할 것인가</div>
        <div className="flex flex-col gap-2">
          {clutch.options.map((o) => {
            const on = sel === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setSel(o.id)}
                disabled={busy}
                className={`rounded-xl border px-3.5 py-2.5 text-left transition disabled:opacity-50 ${
                  on ? "border-[var(--brand)] bg-[var(--brand)]/6" : "border-[var(--line)] hover:border-[var(--brand-2)]"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[13px] font-extrabold">{o.label}</span>
                  <span className="tabular rounded-full bg-[var(--surface-2)] px-1.5 py-[1px] text-[10px] font-black text-[var(--ink-3)]">
                    성공 {Math.round(o.odds * 100)}%
                  </span>
                  <span className="ml-auto text-[9.5px] font-bold text-[var(--ink-3)]">{o.leans}</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--ink-3)]">{o.desc}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--ink-3)]">
          결과는 {clutch.monthLabel} 중계에서 공개됩니다. 기록에 그대로 반영됩니다.
        </p>
        <button
          onClick={() => sel && onPick(sel)}
          disabled={busy || !sel}
          className="btn btn-primary mt-2.5 w-full py-3 text-[14px]"
        >
          {sel ? "이대로 승부한다 ⚾" : "승부 방법을 고르세요"}
        </button>
      </div>
    </div>
  );
}

/**
 * 뽑기 결과 공개.
 *
 * 나온 것만 보여주면 주사위가 굴러갔다는 게 느껴지지 않는다.
 * **나오지 않은 결과까지 함께** 흐리게 깔아두면 무엇을 피했는지가 보인다.
 */
export function DrawReveal({ pool, hit, title }: {
  pool: ClutchOutcome[]; hit: string; title?: string;
}) {
  return (
    <div className="rounded-xl bg-black/25 p-2.5">
      <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] opacity-55">
        {title ?? "Draw Complete"}
      </div>
      <div className="flex flex-col gap-1">
        {pool.map((o) => {
          const on = o.id === hit;
          return (
            <div
              key={o.id}
              className={`rounded-lg px-2.5 py-1.5 transition ${on ? "bg-white/18" : "opacity-35"}`}
            >
              <div className={`text-[12px] font-extrabold ${on ? "" : "line-through decoration-white/30"}`}>
                {o.title}
              </div>
              {on && <div className="mt-0.5 text-[11px] leading-relaxed opacity-85">{o.body}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 중계 안에서 승부처 결과를 펼친다 */
export function ClutchReveal({ r }: { r: ClutchResult }) {
  const tone = r.success ? "#ffd166" : "#ffb4a2";
  return (
    <div className="pop">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
        Clutch · {r.monthLabel}
      </div>
      <div className="mt-1 text-[13px] font-bold opacity-80">{r.optionLabel}</div>
      <div className="mt-0.5 text-[24px] font-black leading-tight" style={{ color: tone }}>
        {r.outcome.title}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed opacity-85">{r.outcome.body}</p>
      <div className="mt-3">
        <DrawReveal pool={r.pool} hit={r.outcome.id} />
      </div>
    </div>
  );
}
