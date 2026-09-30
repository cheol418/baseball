"use client";

import { useRef, useState } from "react";
import { backupFilename, buildBackup, IMPORT_MESSAGE, parseBackup, type MergeMode } from "@/lib/backup";
import { exportGames, importGames, useGames } from "@/lib/storage";
import type { GameState } from "@/lib/types";

/**
 * 기록 옮기기.
 *
 * 세이브가 브라우저 안에만 있어서 다른 PC로 가면 아무것도 없었다.
 * 파일로 내보내고 들여오는 길을 낸다 — 계정 없이, 지금 당장.
 *
 * 들여올 때 **바로 덮어쓰지 않는다.** 무엇이 새로 들어오고 무엇이 바뀌는지
 * 먼저 보여주고 확인을 받는다 — 기록은 되돌릴 수 없다.
 */
export function BackupPanel() {
  const { games, hydrated } = useGames();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<GameState[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [mode, setMode] = useState<MergeMode>("newer");

  const download = () => {
    const blob = new Blob([JSON.stringify(exportGames(), null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFilename();
    a.click();
    URL.revokeObjectURL(url);
    setDone(`${games.length}명을 파일로 내보냈습니다.`);
    setError(null);
  };

  const onPick = async (file: File | undefined) => {
    setError(null); setDone(null);
    if (!file) return;
    const r = parseBackup(await file.text());
    if (!r.ok) { setError(IMPORT_MESSAGE[r.error]); return; }
    setPending(r.games);
  };

  // 확인 화면에 쓸 미리보기 — 실제로 합치기 전에 무엇이 바뀌는지 센다
  const preview = pending && (() => {
    const mine = new Map(games.map((g) => [g.id, g]));
    let add = 0, replace = 0, keep = 0;
    for (const g of pending) {
      const cur = mine.get(g.id);
      if (!cur) { add++; continue; }
      if (mode === "both") { add++; continue; }
      if (mode === "keep") { keep++; continue; }
      const newer = (g.savedAt ?? g.createdAt) > (cur.savedAt ?? cur.createdAt);
      if (mode === "replace" || newer) replace++; else keep++;
    }
    return { add, replace, keep };
  })();

  const confirm = () => {
    if (!pending) return;
    const p = importGames(pending, mode);
    setPending(null);
    setDone(`가져왔습니다 — 새로 ${p.added.length}명 · 교체 ${p.updated.length}명 · 유지 ${p.kept.length}명.`);
  };

  return (
    <>
      <div className="card flex flex-col gap-2.5 px-4 py-4">
        <p className="text-[11.5px] leading-relaxed text-[var(--ink-3)]">
          기록은 이 브라우저에만 저장됩니다. 파일로 내보내 두면 <b>다른 PC나 브라우저에서 이어서</b> 할 수 있습니다.
        </p>
        <div className="flex gap-2">
          <button onClick={download} disabled={!hydrated || games.length === 0}
            className="btn btn-primary flex-1 py-2.5 text-[13px] disabled:opacity-40">
            ⬇ 내보내기{hydrated && games.length > 0 ? ` (${games.length}명)` : ""}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={!hydrated}
            className="btn btn-ghost flex-1 py-2.5 text-[13px] disabled:opacity-40">
            ⬆ 가져오기
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { void onPick(e.target.files?.[0]); e.target.value = ""; }} />
        {error && <p className="text-[11.5px] font-bold text-[var(--danger)]">⚠ {error}</p>}
        {done && <p className="text-[11.5px] font-bold text-[var(--brand-2)]">{done}</p>}
      </div>

      {/* 덮어쓰기 전에 무엇이 바뀌는지 먼저 보여준다 */}
      {pending && preview && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-4 sm:items-center"
          onClick={() => setPending(null)}>
          <div className="w-full max-w-[420px] rounded-2xl bg-[var(--surface)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">Import</div>
            <h3 className="mt-0.5 text-[17px] font-black">{pending.length}명을 가져옵니다</h3>

            <div className="mt-3 flex flex-col gap-1.5">
              {([
                ["newer", "최신만 남기기", "같은 선수는 저장 시각이 늦은 쪽을 씁니다 (권장)"],
                ["both", "둘 다 남기기", "같은 선수를 복사본으로 따로 추가합니다"],
                ["replace", "파일 쪽으로 덮어쓰기", "지금 진행 상황이 사라질 수 있습니다"],
                ["keep", "지금 것 지키기", "새로운 선수만 추가합니다"],
              ] as const).map(([id, label, desc]) => (
                <button key={id} onClick={() => setMode(id)}
                  className={`card px-3.5 py-2.5 text-left transition ${
                    mode === id ? "!border-[var(--brand)] ring-2 ring-[var(--brand)]/20" : ""}`}>
                  <div className="text-[12.5px] font-extrabold">{label}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{desc}</div>
                </button>
              ))}
            </div>

            <div className="tabular mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-[12px]">
              새로 추가 <b>{preview.add}명</b> · 교체 <b style={{ color: preview.replace ? "var(--danger)" : undefined }}>{preview.replace}명</b> · 그대로 <b>{preview.keep}명</b>
            </div>

            <div className="mt-3 flex gap-2">
              <button onClick={() => setPending(null)} className="btn btn-ghost flex-1 py-2.5 text-[13px]">취소</button>
              <button onClick={confirm} className="btn btn-primary flex-1 py-2.5 text-[13px]">가져오기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { buildBackup };
