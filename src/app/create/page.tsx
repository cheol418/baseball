"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AbilityBar, AppBar, Column, Pill, Section } from "@/components/ui";
import { newGame } from "@/lib/career";
import {
  abilityKeys, ARM_SLOTS, gradeOf, HAND_LABEL, HITTER_POSITIONS, overall,
  CANDIDATE_KINDS, PITCHER_POSITIONS, platoonProfile, RECOMMENDED_POSITIONS, rollCandidate,
  scoutedOverall, scoutedPotential, STYLES, traitById, type CreateOptions,
} from "@/lib/player";
import { RNG } from "@/lib/rng";
import { schoolOf } from "@/lib/school";
import { saveGame } from "@/lib/storage";
import { TEAMS } from "@/lib/teams";
import { Emblem } from "@/components/emblem";
import type { ArmSlot, Hand, Kind, Position } from "@/lib/types";

const HANDS: Hand[] = ["R", "L", "S"];

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const schoolInfo = useMemo(() => schoolOf(school), [school]);
  const [number, setNumber] = useState(7);
  const [kind, setKind] = useState<Kind>("HITTER");
  const [position, setPosition] = useState<Position>("CF");
  const [bats, setBats] = useState<Hand>("R");
  const [throwsH, setThrows] = useState<Hand>("R");
  const [styleId, setStyleId] = useState("toolsy");
  const [armSlot, setArmSlot] = useState<ArmSlot>("THREE_QUARTER");
  const [wishTeam, setWishTeam] = useState(TEAMS[0].id);
  const [baseSeed, setBaseSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [picked, setPicked] = useState<number | null>(null);

  const styles = STYLES.filter((s) => s.kind === kind);
  const positions = kind === "HITTER" ? HITTER_POSITIONS : PITCHER_POSITIONS;

  const opts: CreateOptions = {
    name: name.trim() || "이름없음",
    number, kind, position, bats, throws: throwsH, styleId,
    armSlot: kind === "PITCHER" ? armSlot : undefined,
  };

  const candidates = useMemo(
    () => CANDIDATE_KINDS.map((c, i) => {
      const seed = baseSeed + i * 7919 + 1;
      return { seed, kind: c, player: rollCandidate({ ...opts, bias: c.bias }, new RNG(seed)) };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseSeed, name, number, kind, position, bats, throwsH, styleId, armSlot],
  );

  const switchKind = (k: Kind) => {
    setKind(k);
    setPosition(k === "HITTER" ? "CF" : "SP");
    setStyleId(k === "HITTER" ? "toolsy" : "power_p");
    if (k === "PITCHER") setArmSlot("THREE_QUARTER");
  };

  const start = () => {
    if (picked === null) return;
    const c = candidates[picked];
    const g = newGame(c.player, wishTeam, new RNG(c.seed).int(1, 2 ** 30), school);
    saveGame(g);
    router.push(`/play/${g.id}`);
  };

  return (
    <main className="pb-28">
      <AppBar title="선수 생성" back="/" right={<span className="text-[11px] opacity-70">{step + 1}/4</span>} />

      <div className="h-1 w-full bg-[var(--line)]">
        <div className="h-full bg-[var(--danger)] transition-all" style={{ width: `${((step + 1) / 4) * 100}%` }} />
      </div>
      <Column>

      {step === 0 && (
        <Section eyebrow="Step 1" title="기본 정보">
          <div className="card flex flex-col gap-4 px-4 py-4">
            <Field label="이름">
              <input
                value={name} onChange={(e) => setName(e.target.value.slice(0, 8))}
                placeholder="선수 이름 (최대 8자)" maxLength={8}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--brand)]"
              />
            </Field>

            <Field label="출신 고교">
              <input
                value={school} onChange={(e) => setSchool(e.target.value.slice(0, 12))}
                placeholder="예: 백호고 (비워두면 평범한 학교)" maxLength={12}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--brand)]"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Pill tone={schoolInfo.elite ? "gold" : schoolInfo.power >= 65 ? "brand" : "neutral"}>
                  {schoolInfo.elite && "★ "}팀 전력 {schoolInfo.power}
                </Pill>
                <span className="text-[11px] text-[var(--ink-3)]">{schoolInfo.note}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-3)]">
                강팀일수록 전국대회 성적이 좋지만 <b>주전 자리를 얻기 어렵습니다.</b>
              </p>
            </Field>

            <Field label="등번호">
              <div className="flex items-center gap-2">
                <input
                  type="range" min={0} max={99} value={number}
                  onChange={(e) => setNumber(Number(e.target.value))}
                  className="h-1.5 flex-1 accent-[var(--brand)]"
                />
                <span className="tabular w-10 rounded-lg bg-[var(--brand)] py-1 text-center text-[13px] font-black text-white">
                  {number}
                </span>
              </div>
            </Field>

            <Field label="선수 구분">
              <Choice
                items={[{ id: "HITTER", label: "야수" }, { id: "PITCHER", label: "투수" }]}
                value={kind} onChange={(v) => switchKind(v as Kind)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="타석">
                <Choice items={HANDS.map((h) => ({ id: h, label: HAND_LABEL[h] }))} value={bats} onChange={(v) => setBats(v as Hand)} />
              </Field>
              <Field label="투구">
                <Choice items={HANDS.filter((h) => h !== "S").map((h) => ({ id: h, label: HAND_LABEL[h] }))} value={throwsH} onChange={(v) => setThrows(v as Hand)} />
              </Field>
            </div>

            {kind === "PITCHER" && (() => {
              const sel = ARM_SLOTS.find((a) => a.id === armSlot)!;
              const pl = platoonProfile({ throws: throwsH, armSlot } as never);
              return (
                <Field label="투구폼">
                  <Choice
                    items={ARM_SLOTS.map((a) => ({ id: a.id, label: a.name }))}
                    value={armSlot} onChange={(v) => setArmSlot(v as ArmSlot)} wrap
                  />
                  <div className="mt-2 rounded-lg bg-[var(--surface-2)] px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-extrabold">{sel.name}</span>
                      <Pill tone={pl.severity >= 0.6 ? "danger" : pl.severity >= 0.3 ? "gold" : "neutral"}>
                        좌우 편차 {Math.round(pl.gap * 100)}%
                      </Pill>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--ink-2)]">{sel.desc}</p>
                    <div className="mt-1.5 text-[11px] font-bold">
                      <span className="text-[var(--brand-2)]">{pl.strongSide} 상대 강함</span>
                      <span className="mx-1.5 text-[var(--ink-3)]">·</span>
                      <span className="text-[var(--danger)]">{pl.weakSide} 상대 약함</span>
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-[var(--ink-3)]">
                      팔이 내려갈수록 탈삼진은 줄지만 땅볼을 유도해 피홈런이 적습니다.
                      편차가 큰 폼은 선발로 불리하고, 매치업을 골라 쓰는 불펜에서 강합니다.
                    </p>
                  </div>
                </Field>
              );
            })()}
          </div>
        </Section>
      )}

      {step === 1 && (
        <Section eyebrow="Step 2" title="선수 유형">
          <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
            어떤 선수로 자라고 싶은지 정합니다. 시작 능력치 배분이 달라지며, 이후 훈련에 따라 유형은 바뀔 수 있습니다.
          </p>
          <div className="flex flex-col gap-2">
            {styles.map((s) => (
              <button key={s.id} onClick={() => setStyleId(s.id)}
                className={`card px-4 py-3 text-left transition ${styleId === s.id ? "!border-[var(--brand)] ring-2 ring-[var(--brand)]/20" : ""}`}>
                <div className="text-[14px] font-extrabold">{s.name}</div>
                <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{s.desc}</div>
              </button>
            ))}
          </div>

        </Section>
      )}

      {step === 2 && (
        <Section eyebrow="Step 3" title="포지션과 희망 구단">
          <div className="eyebrow mb-2">포지션</div>
          <div className="flex flex-wrap gap-1.5">
            {positions.map((pos) => {
              const rec = (RECOMMENDED_POSITIONS[styleId] ?? []).includes(pos.id);
              return (
                <button key={pos.id} type="button" onClick={() => setPosition(pos.id)}
                  className={`btn relative px-3 py-2 text-[12.5px] ${position === pos.id ? "btn-primary" : "btn-ghost"}`}>
                  {pos.label}
                  {rec && position !== pos.id && (
                    <span className="ml-1 text-[9.5px] font-black text-[var(--brand-2)]">추천</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
            포지션은 수비 부담에 따라 평가가 달라집니다. 포수·유격수는 같은 성적이라도 더 높게,
            1루수·지명타자는 더 낮게 쳐줍니다.
          </p>
          <div className="mt-5">
            <div className="eyebrow mb-2">희망 구단</div>
            <div className="grid grid-cols-2 gap-2">
              {TEAMS.map((t) => (
                <button key={t.id} onClick={() => setWishTeam(t.id)}
                  className={`card flex items-center gap-2 px-3 py-2.5 text-left transition ${wishTeam === t.id ? "!border-[var(--brand)] ring-2 ring-[var(--brand)]/20" : ""}`}>
                  <Emblem teamId={t.id} size={24} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-bold">{t.short}</span>
                    <span className="block text-[10px] text-[var(--ink-3)]">{t.city} · 전력 {t.power}</span>
                    <span className="block truncate text-[9.5px] text-[var(--ink-3)]">
                      {t.park.hr >= 1.1 ? "🔥" : t.park.hr <= 0.92 ? "🧊" : "▪️"} {t.park.name}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
              희망 구단에 반드시 지명되는 것은 아닙니다. 육성 성향이 높은 팀일수록 기회를 많이 줍니다.
              🔥는 타자친화, 🧊는 투수친화 구장입니다 — 같은 기량도 구장에 따라 성적이 달라집니다.
            </p>
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section eyebrow="Step 4" title="후보 선수 선택"
          action={
            <button onClick={() => { setBaseSeed(Math.floor(Math.random() * 1e9)); setPicked(null); }}
              className="btn btn-ghost px-3 py-1.5 text-[12px]">🎲 다시 뽑기</button>
          }>
          <div className="flex flex-col gap-3">
            {candidates.map((c, i) => {
              const ovr = overall(c.player);
              const scout = scoutedOverall(c.player, 0, c.seed);
              const trait = traitById(c.player.trait);
              return (
                <button key={i} onClick={() => setPicked(i)}
                  className={`card px-4 py-3.5 text-left transition ${
                    picked === i ? "!border-[var(--brand)] ring-2 ring-[var(--brand)]/20"
                      : c.player.gifted ? "!border-[var(--gold)]" : ""
                  }`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-extrabold">
                      {c.player.gifted && "★ "}{c.kind.name}
                    </span>
                    {c.player.gifted && <Pill tone="gold">특급 유망주</Pill>}
                    <Pill tone="brand">{gradeOf(ovr)} · OVR {ovr}</Pill>
                    <Pill tone="gold">잠재 {scout.lo}~{scout.hi}</Pill>
                    <span className="ml-auto text-[11px] font-bold text-[var(--ink-3)]">
                      재능 {(c.player.talent * 100).toFixed(0)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">
                    {c.player.gifted
                      ? "완성도와 성장 여지를 모두 갖췄습니다. 좀처럼 나오지 않습니다."
                      : c.kind.desc}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Pill>{trait.name}</Pill>
                    <span className="text-[11px] text-[var(--ink-3)]">{trait.desc}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {abilityKeys(kind).map((k) => {
                      const sc = scoutedPotential(c.player, k, 0, c.seed);
                      return (
                        <AbilityBar key={k} k={k}
                          value={(c.player.abilities as unknown as Record<string, number>)[k]}
                          potential={sc.lo} potentialHi={sc.hi} known={sc.known} />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-3)]">
            잠재력은 <b>스카우트의 추정치</b>라 정확하지 않습니다. 프로에서 시즌을 보낼수록 범위가 좁혀지고,
            결국 진짜 한계가 드러납니다. 같은 출발점이라도 어떤 강점을 고르느냐에 따라 커리어가 달라집니다.
          </p>
        </Section>
      )}

      </Column>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[460px] gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="btn btn-ghost flex-1 py-3 text-[14px]">이전</button>
        )}
        {step < 3 ? (
          <button onClick={() => setStep(step + 1)} disabled={step === 0 && !name.trim()}
            className="btn btn-primary flex-[2] py-3 text-[14px]">
            다음 <span aria-hidden>→</span>
          </button>
        ) : (
          <button onClick={start} disabled={picked === null} className="btn btn-primary flex-[2] py-3 text-[14px]">
            이 선수로 시작하기
          </button>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function Choice({ items, value, onChange, wrap }: {
  items: { id: string; label: string }[]; value: string; onChange: (v: string) => void; wrap?: boolean;
}) {
  return (
    <div className={`flex gap-1.5 ${wrap ? "flex-wrap" : ""}`}>
      {items.map((it) => (
        <button key={it.id} type="button" onClick={() => onChange(it.id)}
          className={`btn px-3 py-2 text-[12.5px] ${value === it.id ? "btn-primary" : "btn-ghost"} ${wrap ? "" : "flex-1"}`}>
          {it.label}
        </button>
      ))}
    </div>
  );
}
