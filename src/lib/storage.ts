"use client";

import { useSyncExternalStore } from "react";
import { buildBackup, mergeSaves, type MergeMode, type MergePlan } from "./backup";
import { type CareerStamp, earnedFrom } from "./codex";
import { careerTotals, seasonsAtLevel } from "./career";
import { nickname } from "./records";
import { migrateSave } from "./migrate";
import type { GameState } from "./types";

const KEY = "slb:games";
/*
 * 도감은 **세이브와 따로 산다.**
 * 저장소 한도가 서른 개쯤이라 지우게 되는데, 지웠다고 모은 것이
 * 사라지면 모을 이유가 없어진다. 채운 칸만 모아두고 되돌리지 않는다.
 */
const CODEX_KEY = "slb:codex";
const EMPTY: GameState[] = [];

const listeners = new Set<() => void>();
let cachedRaw = "";
let cachedList: GameState[] = EMPTY;

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** localStorage 내용을 캐시된 배열로 반환 (참조 안정성 보장) */
export function getSnapshot(): GameState[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(KEY) ?? "{}";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const all = JSON.parse(raw) as Record<string, unknown>;
      // 예전 버전 세이브도 여기서 현재 구조로 맞춘다
      cachedList = Object.values(all)
        .map(migrateSave)
        .filter((g): g is GameState => g !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      cachedList = EMPTY;
    }
  }
  return cachedList;
}

const getServerSnapshot = () => EMPTY;

function writeAll(list: GameState[]) {
  const all: Record<string, GameState> = {};
  for (const g of list) all[g.id] = g;
  localStorage.setItem(KEY, JSON.stringify(all));
  emit();
}

export function saveGame(s: GameState) {
  const list = getSnapshot().filter((g) => g.id !== s.id);
  // 저장할 때마다 시각을 찍는다 — 기기 간 최신 판정의 기준
  writeAll([{ ...s, savedAt: Date.now() }, ...list]);
  recordCodex(s);
}

/* ------------------------------------------------------------------ */
/* 도감 — 세이브를 지워도 남는다                                         */
/* ------------------------------------------------------------------ */

export interface Codex { ids: string[]; careers: CareerStamp[] }
const EMPTY_CODEX: Codex = { ids: [], careers: [] };
let codexRaw = "";
let codexCache: Codex = EMPTY_CODEX;

export function readCodex(): Codex {
  if (typeof window === "undefined") return EMPTY_CODEX;
  try {
    const raw = localStorage.getItem(CODEX_KEY) ?? "";
    if (raw === codexRaw) return codexCache;
    codexRaw = raw;
    const v = raw ? JSON.parse(raw) : null;
    codexCache = {
      ids: Array.isArray(v?.ids) ? v.ids : [],
      careers: Array.isArray(v?.careers) ? v.careers : [],
    };
  } catch {
    codexCache = EMPTY_CODEX;
  }
  return codexCache;
}

const stampOf = (s: GameState): CareerStamp => {
  const kbo = seasonsAtLevel(s.seasons, "KBO");
  const t = careerTotals(s.seasons, s.player.kind, "KBO") as unknown as Record<string, number>;
  return {
    id: s.id, name: s.player.name, position: s.player.position, kind: s.player.kind,
    from: kbo[0]?.year ?? s.year, to: kbo[kbo.length - 1]?.year ?? s.year,
    seasons: kbo.length, war: Math.round((t.war ?? 0) * 10) / 10,
    teamId: s.contract?.teamId ?? kbo[kbo.length - 1]?.teamId ?? "",
    nickname: nickname(s), hof: !!s.hofVote?.inducted,
  };
};

/** 채운 칸을 보탠다 — **빼지 않는다** */
function recordCodex(s: GameState) {
  if (typeof window === "undefined") return;
  const cur = readCodex();
  const ids = new Set(cur.ids);
  const before = ids.size;
  for (const id of earnedFrom(s)) ids.add(id);

  // 은퇴한 선수만 명부에 올린다 — 뛰는 중에는 성적이 계속 바뀐다
  const careers = cur.careers.filter((c) => c.id !== s.id);
  const retired = s.phase === "RETIRED";
  if (retired) careers.unshift(stampOf(s));
  const changed = ids.size !== before || careers.length !== cur.careers.length
    || (retired && JSON.stringify(careers[0]) !== JSON.stringify(cur.careers.find((c) => c.id === s.id)));
  if (!changed) return;
  try {
    localStorage.setItem(CODEX_KEY, JSON.stringify({ ids: [...ids], careers }));
  } catch { /* 저장소가 가득 차도 게임은 계속된다 */ }
  emit();
}

export function useCodex(): Codex {
  return useSyncExternalStore(subscribe, readCodex, () => EMPTY_CODEX);
}

export function deleteGame(id: string) {
  writeAll(getSnapshot().filter((g) => g.id !== id));
}

/** 지금 가진 것 전부를 백업 파일 모양으로 */
export function exportGames() {
  return buildBackup(getSnapshot());
}

/**
 * 들여온 세이브를 합쳐 저장한다.
 * 합치는 규칙 자체는 `backup.ts`에 있다 — 클라우드도 같은 규칙을 쓴다.
 */
export function importGames(incoming: GameState[], mode: MergeMode = "newer"): MergePlan {
  const plan = mergeSaves(getSnapshot(), incoming, mode);
  writeAll(plan.result);
  return plan;
}

/** 저장된 모든 선수. 첫 렌더(서버/하이드레이션)에는 빈 배열. */
export function useGames(): { games: GameState[]; hydrated: boolean } {
  const games = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return { games, hydrated };
}

export function useGame(id: string): { game: GameState | null; hydrated: boolean } {
  const { games, hydrated } = useGames();
  return { game: games.find((g) => g.id === id) ?? null, hydrated };
}
