"use client";

import { teamById } from "@/lib/teams";

/**
 * 구단 엠블럼.
 *
 * 실제 KBO 구단 로고는 상표라 그대로 쓸 수 없다. 대신 우리 구단 설정
 * (연고지 + 마스코트 + 그 팀의 색)에 맞춰 **직접 그린 크레스트**를 둔다.
 * 구단명이 이미 "어느 팀인지 떠오르게" 지어져 있어서 같은 역할을 한다.
 *
 * 모두 같은 방패 틀 위에 마스코트 실루엣만 갈아 끼우는 구조다 —
 * 한 화면에 여러 팀이 나와도 한 리그처럼 보인다.
 */

/** 마스코트 실루엣 — 24×24 좌표계에 그린다 */
const MARK: Record<string, React.ReactNode> = {
  // 쌍둥이 — 머리 둘, 어깨 하나로 이어진 실루엣
  SEO: (
    <g>
      <circle cx="8.3" cy="7.6" r="3" />
      <circle cx="15.7" cy="7.6" r="3" />
      <path d="M2.9 19.6c0-3.4 2.4-5.9 5.4-5.9 1.5 0 2.7.6 3.7 1.6 1-1 2.2-1.6 3.7-1.6 3 0 5.4 2.5 5.4 5.9z" />
      <path d="M11.3 15.3h1.4v4.3h-1.4z" fill="currentColor" opacity="0.3" />
    </g>
  ),
  // 곰 — 둥근 귀와 주둥이
  JAM: (
    <g>
      <circle cx="6.9" cy="7.2" r="2.6" />
      <circle cx="17.1" cy="7.2" r="2.6" />
      <ellipse cx="12" cy="13.6" rx="6.5" ry="6" />
      <ellipse cx="12" cy="16" rx="2.6" ry="2" fill="var(--surface)" opacity="0.9" />
      <circle cx="12" cy="14.7" r="1" fill="currentColor" />
    </g>
  ),
  // 영웅 — 별과 망토
  KHO: (
    <g>
      <path d="M12 2.8l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z" />
      <path d="M4.8 21c1.5-2.6 4.1-4.1 7.2-4.1s5.7 1.5 7.2 4.1z" />
    </g>
  ),
  // 상륙 — 닻
  INC: (
    <g>
      <circle cx="12" cy="5" r="2.1" />
      <path d="M11 7.4h2V21h-2z" />
      <path d="M7 10h10v2H7z" />
      <path d="M4.4 13.6c0 4.2 3.4 7.2 7.6 7.5v-2.1c-3-.3-5.4-2.4-5.4-5.4z" />
      <path d="M19.6 13.6c0 4.2-3.4 7.2-7.6 7.5v-2.1c3-.3 5.4-2.4 5.4-5.4z" />
    </g>
  ),
  // 마법사 — 고깔모자와 챙
  SUW: (
    <g>
      <path d="M12 2.4l5.6 13.2H6.4z" />
      <path d="M4.8 16.4h14.4v2.4H4.8z" />
      <path d="M12 7.4l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="var(--surface)" opacity="0.85" />
    </g>
  ),
  // 독수리 — 펼친 날개 (방패 안에 들어오도록 폭을 줄였다)
  DAJ: (
    <g>
      <path d="M12 5.8c1.1 0 2 .9 2 2 0 .7-.4 1.3-1 1.7l.5 1.4h-3l.5-1.4c-.6-.4-1-1-1-1.7 0-1.1.9-2 2-2z" />
      <path d="M12.8 11.6l6.9-3.2c.3 4.3-2.3 7.9-6.9 9.9z" />
      <path d="M11.2 11.6L4.3 8.4c-.3 4.3 2.3 7.9 6.9 9.9z" />
      <path d="M10.7 18.1h2.6L12 21.2z" />
    </g>
  ),
  // 사자 — 갈기 링과 또렷한 얼굴
  DAG: (
    <g>
      <path d="M12 1.9l2.2 2.6 3.3-1.1.4 3.4 3.4.5-1.3 3.2 2.5 2.3-2.5 2.3 1.3 3.2-3.4.5-.4 3.4-3.3-1.1L12 24.6l-2.2-2.6-3.3 1.1-.4-3.4-3.4-.5 1.3-3.2L1.5 13.6l2.5-2.3-1.3-3.2 3.4-.5.4-3.4 3.3 1.1z" />
      <circle cx="12" cy="12.9" r="5.4" fill="var(--surface)" />
      <circle cx="9.9" cy="11.6" r="1.05" fill="currentColor" />
      <circle cx="14.1" cy="11.6" r="1.05" fill="currentColor" />
      <path d="M10.3 15.1h3.4L12 17.3z" fill="currentColor" />
      <path d="M8.1 16.6c1 1.2 2.3 1.8 3.9 1.8s2.9-.6 3.9-1.8" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  ),
  // 갈매기 — 구단 설정 그대로 '부산 갈매기' (거인 실루엣은 작게 줄이면 안 읽힌다)
  BUS: (
    <g>
      <path d="M12 8.4c1.5 0 2.7 1 3.1 2.4l6.9-3.6c-1.1 4.2-3.9 7.4-7.5 8.9l.5 4.6-3-1.9-3 1.9.5-4.6c-3.6-1.5-6.4-4.7-7.5-8.9l6.9 3.6c.4-1.4 1.6-2.4 3.1-2.4z" />
      <circle cx="12" cy="11.4" r="1.1" fill="var(--surface)" />
    </g>
  ),
  // 호랑이 — 뾰족한 귀와 이마 줄무늬
  GWJ: (
    <g>
      <path d="M4.4 3.6l4.3 3.1h6.6l4.3-3.1-.3 5.3c1.1 1.4 1.7 3.1 1.7 4.9 0 4.4-3.9 7.8-8.9 7.8S3.2 18.2 3.2 13.8c0-1.8.6-3.5 1.7-4.9z" />
      <path d="M10.7 8.4l1.3-2.3 1.3 2.3-1.3.9z" fill="var(--surface)" opacity="0.5" />
      <circle cx="9.1" cy="12.4" r="1.35" fill="var(--surface)" />
      <circle cx="14.9" cy="12.4" r="1.35" fill="var(--surface)" />
      <path d="M10.2 15.6h3.6L12 18z" fill="var(--surface)" />
      <path d="M6.1 9.9l2.4 1.1-2.4 1zM17.9 9.9l-2.4 1.1 2.4 1z" fill="var(--surface)" />
      <path d="M4.6 15.2l2.6.6-2.6.7zM19.4 15.2l-2.6.6 2.6.7z" fill="var(--surface)" opacity="0.8" />
    </g>
  ),
  // 공룡 — 오른쪽을 보는 티라노 머리, 긴 주둥이와 이빨
  CHW: (
    <g>
      {/* 뒤통수에서 주둥이 끝까지 한 덩어리 */}
      <path d="M3.4 12.2c0-3.6 2.3-6.4 5.6-6.4 1.9 0 3.4.9 4.4 2.3l7.4 1.5c.6.1 1 .6 1 1.2s-.4 1.1-1 1.2l-2.3.5v1.3H8.2z" />
      {/* 눈썹 능선 */}
      <path d="M6.4 7.4c1.6-1.3 3.8-1.5 5.6-.5l-1 1.6c-1.2-.7-2.7-.6-3.8.3z" fill="var(--surface)" opacity="0.5" />
      {/* 아래턱 */}
      <path d="M5.6 14.8h12.2l-.6 1.9-9.3.6z" />
      {/* 이빨 */}
      <path d="M7.4 13.8l.7 1.9M10.2 13.8l.7 2M13 13.8l.7 2M15.8 13.8l.7 1.9" stroke="var(--surface)" strokeWidth="1" strokeLinecap="round" fill="none" />
      {/* 목 */}
      <path d="M3.4 12.2c0 3.4 1.6 6.3 4.2 8l-1.4 2C2.9 20 1.4 16.4 1.4 12.2z" />
      <circle cx="8" cy="10" r="1.25" fill="var(--surface)" />
      <circle cx="8" cy="10" r="0.55" fill="currentColor" />
    </g>
  ),
};

/**
 * 크레스트 한 개.
 * `size`는 픽셀. 색은 구단 색을 그대로 쓴다.
 */
export function Emblem({ teamId, size = 28, className = "" }: {
  teamId: string; size?: number; className?: string;
}) {
  const t = teamById(teamId);
  const mark = MARK[t.id] ?? MARK.SEO;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-label={`${t.name} 엠블럼`}
      title={t.name}
    >
      <svg viewBox="0 0 24 28" width={size} height={size} role="img">
        {/* 방패 — 모든 구단이 같은 틀을 쓴다 */}
        <path
          d="M12 .8l10.4 3.1v10.5c0 6.2-4.2 10.8-10.4 12.8C5.8 25.2 1.6 20.6 1.6 14.4V3.9z"
          fill={t.color}
        />
        <path
          d="M12 2.6l8.7 2.6v9.2c0 5.2-3.5 9.1-8.7 10.9-5.2-1.8-8.7-5.7-8.7-10.9V5.2z"
          fill="none"
          stroke={t.accent}
          strokeWidth="0.9"
          opacity="0.75"
        />
        <g transform="translate(0,1.6)" fill={t.accent}>{mark}</g>
      </svg>
    </span>
  );
}

/** 엠블럼 + 구단명 한 줄 */
export function TeamTag({ teamId, size = 20, className = "", short = false }: {
  teamId: string; size?: number; className?: string; short?: boolean;
}) {
  const t = teamById(teamId);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Emblem teamId={teamId} size={size} />
      <span className="font-extrabold">{short ? t.short : t.name}</span>
    </span>
  );
}
