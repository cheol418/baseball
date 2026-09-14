"use client";

import { useEffect, useState } from "react";

/**
 * 도입 연출.
 *
 * 「새로운 인생 시작」을 누르면 곧바로 입력 폼이 나오던 자리에,
 * **왜 이 인생을 사는지**를 먼저 보여준다. 세 줄이면 충분하다.
 * 두 번째부터는 성가시므로 언제든 건너뛸 수 있게 둔다.
 */
const LINES = [
  "9회말 2아웃. 모두가 자리에서 일어나던 순간,",
  "파울 타구에 맞아 눈을 떠보니 고3 야구선수였다.",
  "여기서부터 다시 시작한다면, 어디까지 갈 수 있을까.",
];

/** 한 글자에 걸리는 시간 */
const CHAR_MS = 42;
/** 줄과 줄 사이 */
const LINE_GAP = 420;

export function Intro({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState<string[]>([]);
  const [typing, setTyping] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = async () => {
      for (const line of LINES) {
        for (let i = 1; i <= line.length; i++) {
          if (cancelled) return;
          setTyping(line.slice(0, i));
          await new Promise<void>((r) => timers.push(setTimeout(r, CHAR_MS)));
        }
        if (cancelled) return;
        setShown((v) => [...v, line]);
        setTyping("");
        await new Promise<void>((r) => timers.push(setTimeout(r, LINE_GAP)));
      }
      if (!cancelled) {
        await new Promise<void>((r) => timers.push(setTimeout(r, 900)));
        if (!cancelled) onDone();
      }
    };
    void run();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [onDone]);

  return (
    <button
      onClick={onDone}
      aria-label="건너뛰기"
      className="fixed inset-0 z-50 flex w-full flex-col justify-center px-7 text-left"
      style={{ background: "linear-gradient(165deg, #0a1a2e, #06182c 55%, #030d18)" }}
    >
      <div className="mx-auto w-full max-w-[460px]">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/35">
          Bottom of the 9th · 2 Outs
        </div>
        <div className="mt-5 min-h-[168px] space-y-2.5">
          {shown.map((l) => (
            <p key={l} className="rise text-[17px] font-bold leading-relaxed text-white/90">{l}</p>
          ))}
          {typing && (
            <p className="text-[17px] font-bold leading-relaxed text-white/90">
              {typing}
              <span className="ml-0.5 inline-block h-[17px] w-[2px] translate-y-[2px] animate-pulse bg-white/80" />
            </p>
          )}
        </div>
        <div className="mt-8 text-[11px] font-bold text-white/40">화면을 누르면 건너뜁니다</div>
      </div>
    </button>
  );
}
