"use client";

import { useSyncExternalStore } from "react";
import { buildBackup, mergeSaves, type MergeMode, type MergePlan } from "./backup";
import { migrateSave } from "./migrate";
import type { GameState } from "./types";

const KEY = "slb:games";
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
