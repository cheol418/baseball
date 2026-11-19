"use client";

/**
 * 은퇴 성적표 공유 — **기기 안에서 끝난다.**
 *
 * 서버가 없으므로(`output: "export"`) 이미지를 올려두고 링크를 주는 길은 없다.
 * `<canvas>`로 한 장 그려서 **파일 그대로** 공유 시트에 넘긴다 —
 * 웹에서도 앱(Capacitor 웹뷰)에서도 같은 코드가 돈다.
 *
 * 외부 라이브러리를 쓰지 않는다(html2canvas 류). 정적 번들을 가볍게 두려는
 * 이유도 있지만, **글꼴이 한 번 어긋나면 한글이 통째로 깨지기** 때문이다 —
 * 여기서는 그릴 글꼴을 직접 집어 든다.
 */

import { useEffect, useRef, useState } from "react";
import { cardText, SITE, type ShareCard } from "@/lib/card";

const W = 1080, H = 1350;

/** 숫자용 콘덴스드 서체 — **한글 글리프가 없으므로 본문 서체를 뒤에 깐다** */
function fonts() {
  if (typeof window === "undefined") return { num: "sans-serif", body: "sans-serif" };
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-scoreboard").trim();
  const body = `"Pretendard", -apple-system, "Apple SD Gothic Neo", sans-serif`;
  return { num: v ? `${v}, ${body}` : body, body };
}

const rounded = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

/** 색을 어둡게 — 구단 색은 이미 눌러 담은 값이라 더 눌러야 흰 글씨가 산다 */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export function drawCard(cv: HTMLCanvasElement, c: ShareCard) {
  const g = cv.getContext("2d");
  if (!g) return;
  cv.width = W; cv.height = H;
  const F = fonts();

  // ── 바탕 — 구단 색에서 아래로 어두워진다
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, shade(c.color, 1.05));
  bg.addColorStop(1, shade(c.color, 0.42));
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // 유니폼 핀스트라이프
  g.fillStyle = "rgba(255,255,255,0.045)";
  for (let x = 0; x < W; x += 34) g.fillRect(x, 0, 3, H);

  // 등번호 — 뒤에 크게 깔아둔다
  g.save();
  g.globalAlpha = 0.08;
  g.fillStyle = "#fff";
  g.font = `900 460px ${F.num}`;
  g.textAlign = "right";
  g.textBaseline = "alphabetic";
  g.fillText(String(c.number), W - 40, 480);
  g.restore();

  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  // ── 머리말
  g.fillStyle = "rgba(255,255,255,0.62)";
  g.font = `700 28px ${F.body}`;
  g.fillText("야구는 9회말 2아웃부터", W / 2, 96);

  // 실밥 한 줄
  g.strokeStyle = "rgba(255,255,255,0.3)";
  g.lineWidth = 3;
  g.setLineDash([14, 12]);
  g.beginPath(); g.moveTo(W / 2 - 150, 128); g.lineTo(W / 2 + 150, 128); g.stroke();
  g.setLineDash([]);

  // ── 이름
  g.fillStyle = "#fff";
  g.font = `900 112px ${F.body}`;
  g.fillText(c.name, W / 2, 262);

  g.fillStyle = "rgba(255,255,255,0.78)";
  g.font = `700 32px ${F.body}`;
  g.fillText(`${c.teamShort} · ${c.position} · ${c.from}–${c.to}`, W / 2, 316);

  let y = 384;
  if (c.nickname) {
    g.font = `800 34px ${F.body}`;
    const w = g.measureText(c.nickname).width + 56;
    g.fillStyle = "rgba(255,255,255,0.16)";
    rounded(g, (W - w) / 2, y - 40, w, 58, 29);
    g.fill();
    g.fillStyle = "#ffd978";
    g.fillText(c.nickname, W / 2, y);
    y += 92;
  } else {
    y += 34;
  }

  // ── 전광판 — 통산 기록 여섯 칸
  const PH = 300;
  g.fillStyle = "rgba(10,12,18,0.58)";
  rounded(g, 56, y, W - 112, PH, 28);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.12)";
  g.lineWidth = 2;
  rounded(g, 56, y, W - 112, PH, 28);
  g.stroke();

  const cw = (W - 112) / 3;
  c.stats.forEach((s, i) => {
    const cx = 56 + cw * (i % 3) + cw / 2;
    const cy = y + 58 + Math.floor(i / 3) * 142;
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.font = `700 26px ${F.body}`;
    g.fillText(s.label, cx, cy);
    g.fillStyle = "#fff";
    g.font = `700 62px ${F.num}`;
    g.fillText(s.value, cx, cy + 66);
  });
  y += PH + 46;

  /*
   * ── 훈장.
   *
   * 아래 점수판은 **바닥에 고정**이라, 훈장을 전광판 바로 밑에 붙이면
   * 훈장이 한 줄인 카드(흔하다)에 빈 땅이 크게 남는다.
   * 남는 자리를 위아래로 나눠 **가운데 세운다** — 훈장이 없는 카드도 성립한다.
   */
  const BH = 168;
  const by = H - 150 - BH;

  if (c.badges.length) {
    g.font = `800 28px ${F.body}`;
    const pads = c.badges.map((b) => ({ t: b, w: g.measureText(b).width + 44 }));
    const rows: typeof pads[] = [[]];
    let used = 0;
    for (const p of pads) {
      if (used + p.w + 14 > W - 120 && rows[rows.length - 1].length) { rows.push([]); used = 0; }
      rows[rows.length - 1].push(p); used += p.w + 14;
    }
    /*
     * **두 줄까지만 그린다.** 긴 훈장(🎽 트윈스 영구결번)이 여섯 개 붙으면
     * 세 줄이 되어 아래 점수판을 덮는다. 훈장은 이미 중요한 순서라
     * 넘치는 쪽을 버리면 가장 덜 중요한 것이 빠진다.
     */
    const show = rows.slice(0, 2);
    const free = by - 24 - y;
    y += Math.max(0, (free - show.length * 68) / 2);

    for (const row of show) {
      const total = row.reduce((a, b) => a + b.w + 14, 0) - 14;
      let x = (W - total) / 2;
      for (const p of row) {
        g.fillStyle = "rgba(255,255,255,0.14)";
        rounded(g, x, y, p.w, 54, 27);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.95)";
        g.textAlign = "center";
        g.fillText(p.t, x + p.w / 2, y + 36);
        x += p.w + 14;
      }
      y += 68;
    }
    y += 10;
  }

  // ── 명예의 전당 점수
  g.fillStyle = "rgba(255,255,255,0.1)";
  rounded(g, 56, by, W - 112, BH, 28);
  g.fill();

  g.textAlign = "left";
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.font = `700 25px ${F.body}`;
  g.fillText("명예의 전당 점수", 100, by + 56);
  g.fillStyle = "#ffd978";
  g.font = `700 72px ${F.num}`;
  g.fillText(String(c.score), 100, by + 128);

  g.textAlign = "right";
  g.fillStyle = "#fff";
  g.font = `900 40px ${F.body}`;
  g.fillText(c.tier, W - 100, by + 70);
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.font = `700 26px ${F.body}`;
  g.fillText(`1군 ${c.seasons}시즌 · ${c.age}세 은퇴`, W - 100, by + 114);

  // ── 바닥 — 주소가 정해지기 전에는 비워 둔다 (틀린 주소를 내보내지 않는다)
  if (SITE) {
    g.textAlign = "center";
    g.fillStyle = "rgba(255,255,255,0.42)";
    g.font = `700 24px ${F.body}`;
    g.fillText(SITE.replace(/^https?:\/\//, ""), W / 2, H - 66);
  }
}

/**
 * 끝난 뒤에 할 말.
 *
 * **실패를 하나로 묶으면 엉뚱한 안내가 나간다** — 글을 복사하다 실패했는데
 * "이미지를 길게 눌러 저장해 보세요"가 떴다 (실제로 겪음).
 */
type Done = "" | "copied" | "saved" | "copyFail" | "saveFail";

export function ShareCardBox({ card }: { card: ShareCard }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<Done>("");

  /*
   * **글꼴이 올라온 뒤에 그린다** — `document.fonts.ready`를 안 기다리면
   * Oswald가 아직 없어 숫자가 기본 서체로 찍히고, 다시 그릴 일이 없으니
   * 그대로 저장된다.
   */
  useEffect(() => {
    let alive = true;
    const paint = () => { if (alive && ref.current) { drawCard(ref.current, card); setReady(true); } };
    const f = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (f?.ready) f.ready.then(paint).catch(paint);
    else paint();
    return () => { alive = false; };
  }, [card]);

  const blob = () => new Promise<Blob | null>((res) => {
    if (!ref.current) return res(null);
    ref.current.toBlob((b) => res(b), "image/png");
  });

  const fileName = `${card.name}_은퇴성적표.png`;

  const share = async () => {
    const b = await blob();
    if (!b) return setDone("saveFail");
    const file = new File([b], fileName, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    // 공유 시트가 파일을 받는 기기에서만 — 아니면 조용히 저장으로 내려간다
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${card.name} 은퇴 성적표` });
        return;
      } catch {
        return; // 사용자가 취소한 것도 여기로 온다 — 실패로 적지 않는다
      }
    }
    download(b);
  };

  const download = (b: Blob) => {
    const url = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDone("saved");
  };

  const save = async () => {
    const b = await blob();
    if (b) download(b); else setDone("saveFail");
  };

  /*
   * 복사 — **`navigator.clipboard`가 없는 자리가 있다.** 앱 웹뷰나
   * https가 아닌 곳에서는 통째로 비어 있으므로 옛 방식을 뒤에 깔아둔다.
   */
  const copy = async () => {
    const text = cardText(card, SITE);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return setDone("copied");
      }
      throw new Error("no clipboard");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        setDone(ok ? "copied" : "copyFail");
      } catch { setDone("copyFail"); }
    }
  };

  return (
    <div className="mt-4">
      <div className="overflow-hidden rounded-2xl" style={{ boxShadow: "0 8px 28px rgba(0,0,0,.28)" }}>
        <canvas ref={ref} className="block h-auto w-full"
          style={{ aspectRatio: `${W} / ${H}`, opacity: ready ? 1 : 0, transition: "opacity .3s" }} />
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <button type="button" onClick={share} disabled={!ready}
          className="btn btn-primary py-2.5 text-[12.5px] disabled:opacity-50">
          공유하기
        </button>
        <button type="button" onClick={save} disabled={!ready}
          className="rounded-xl py-2.5 text-[12.5px] font-extrabold disabled:opacity-50"
          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
          이미지 저장
        </button>
        <button type="button" onClick={copy}
          className="rounded-xl py-2.5 text-[12.5px] font-extrabold"
          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
          기록 복사
        </button>
      </div>

      {/*
        복사가 막히면 **글을 실제로 꺼내 보여준다** — 안 그러면 안내문이
        "아래 기록을 긁어 복사하라"고 해놓고 아래에 아무것도 없다.
      */}
      {done === "copyFail" && (
        <textarea readOnly value={cardText(card, SITE)} rows={8}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full resize-none rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }} />
      )}

      <p className="mt-1.5 text-center text-[10.5px] leading-relaxed text-[var(--ink-3)]">
        {done === "copied" ? "기록을 복사했습니다 — 어디든 붙여넣으세요."
          : done === "saved" ? "이미지를 저장했습니다."
          : done === "copyFail" ? "복사하지 못했습니다. 아래 기록을 직접 긁어 복사해 주세요."
          : done === "saveFail" ? "저장하지 못했습니다. 이미지를 길게 눌러 저장해 보세요."
          : "이미지를 길게 눌러도 저장할 수 있습니다."}
      </p>
    </div>
  );
}
