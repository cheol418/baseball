import { migrateSave } from "./migrate";
import type { GameState } from "./types";

/* ------------------------------------------------------------------ */
/* 세이브 내보내기 · 가져오기                                            */
/* ------------------------------------------------------------------ */

/**
 * 왜 여기가 순수 로직인가.
 *
 * 기록은 브라우저에만 있어서 다른 PC로 옮길 방법이 없었다.
 * 파일로 내보내고 들여오는 길을 먼저 낸다.
 *
 * **이 파일은 나중에 클라우드 동기화가 그대로 쓴다.** 계정이 붙어도
 * 필요한 것은 같다 — 세이브를 직렬화하고, 들어오는 것을 검증해
 * `migrateSave`를 통과시키고, 같은 세이브가 양쪽에 있을 때 어느 쪽이
 * 최신인지 가린다(`savedAt`). 클라우드가 새로 얹는 것은
 * 계정·자동 업로드·전송뿐이다. 그래서 React도 localStorage도 안 쓴다.
 */

/** 파일 맨 앞에 박는 표식 — 엉뚱한 JSON을 넣었을 때 바로 걸러낸다 */
export const BACKUP_FORMAT = "yagu-9th-save";
/** 형식이 바뀌면 올린다. 읽는 쪽은 자기보다 높은 버전을 거절한다 */
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: string;
  version: number;
  exportedAt: number;
  /** 사람이 열어봤을 때 무엇인지 알게 */
  app: string;
  games: GameState[];
}

export function buildBackup(games: GameState[]): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    app: "야구는 9회말 2아웃부터",
    games,
  };
}

/** 내려받을 파일 이름 — 날짜가 들어가야 여러 번 받아도 안 덮인다 */
export function backupFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `야구세이브-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
}

export type ImportError =
  | "NOT_JSON"
  | "NOT_BACKUP"
  | "TOO_NEW"
  | "EMPTY";

export const IMPORT_MESSAGE: Record<ImportError, string> = {
  NOT_JSON: "JSON 파일이 아닙니다.",
  NOT_BACKUP: "이 게임의 세이브 파일이 아닙니다.",
  TOO_NEW: "더 새로운 버전에서 내보낸 파일입니다. 앱을 최신으로 올린 뒤 다시 시도하세요.",
  EMPTY: "파일 안에 선수가 없습니다.",
};

/** 들어오는 파일을 읽는다 — 여기서 걸러야 뒤가 깨지지 않는다 */
export function parseBackup(text: string): { ok: true; games: GameState[] } | { ok: false; error: ImportError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "NOT_JSON" };
  }
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "NOT_BACKUP" };
  const f = raw as Partial<BackupFile>;
  if (f.format !== BACKUP_FORMAT || !Array.isArray(f.games)) return { ok: false, error: "NOT_BACKUP" };
  if (typeof f.version === "number" && f.version > BACKUP_VERSION) return { ok: false, error: "TOO_NEW" };

  // 저장소 경계와 **같은 길**을 통과시킨다 — 구버전 세이브도 여기서 올라온다
  const games = f.games
    .map(migrateSave)
    .filter((g): g is GameState => g !== null);
  if (!games.length) return { ok: false, error: "EMPTY" };
  return { ok: true, games };
}

export type MergeMode = "newer" | "replace" | "keep" | "both";

export interface MergePlan {
  /** 최종적으로 저장할 목록 */
  result: GameState[];
  /** 새로 들어오는 선수 */
  added: GameState[];
  /** 같은 선수가 양쪽에 있어 들어온 쪽으로 바뀌는 것 */
  updated: GameState[];
  /** 같은 선수가 있지만 지금 것을 지키는 것 */
  kept: GameState[];
}

const stamp = (g: GameState) => g.savedAt ?? g.createdAt ?? 0;

/**
 * 지금 가진 것과 들어온 것을 합친다.
 *
 * 기본은 `newer` — **저장 시각이 늦은 쪽을 남긴다.** 다른 PC에서 더 진행한
 * 세이브를 들여올 때 뒤로 되돌아가지 않게 하는 것이 목적이고,
 * 클라우드 동기화도 같은 규칙을 쓴다.
 * `both`는 같은 선수를 **둘 다 남긴다** — 들어온 쪽에 새 id를 준다.
 */
export function mergeSaves(
  current: GameState[], incoming: GameState[], mode: MergeMode = "newer",
  newId: (g: GameState) => string = (g) => `${g.id}-i${Date.now().toString(36)}`,
): MergePlan {
  const byId = new Map(current.map((g) => [g.id, g]));
  const added: GameState[] = [], updated: GameState[] = [], kept: GameState[] = [];

  for (const g of incoming) {
    const mine = byId.get(g.id);
    if (!mine) { byId.set(g.id, g); added.push(g); continue; }
    if (mode === "keep") { kept.push(mine); continue; }
    if (mode === "both") {
      const copy = { ...g, id: newId(g) };
      byId.set(copy.id, copy); added.push(copy); continue;
    }
    if (mode === "replace" || stamp(g) > stamp(mine)) {
      byId.set(g.id, g); updated.push(g);
    } else {
      kept.push(mine);
    }
  }
  const result = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  return { result, added, updated, kept };
}
