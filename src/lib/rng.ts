/** 시드 기반 난수 (저장/재현 가능) */
export class RNG {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  get seed() {
    return this.s;
  }
  next(): number {
    // mulberry32
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** min 이상 max 이하 정수 */
  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  float(min: number, max: number) {
    return this.next() * (max - min) + min;
  }
  /** 평균 0, 표준편차 1 정규분포 근사 */
  normal(): number {
    return (this.next() + this.next() + this.next() + this.next() + this.next() + this.next() - 3) / 1;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** 가중치 선택 */
  weighted<T>(arr: readonly T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }
  chance(p: number) {
    return this.next() < p;
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/**
 * 리그 평균 기량을 0으로 보는 정규화 (-1 ~ 1).
 *
 * 선수 능력치 분포(데뷔 47 · 전성기 63)의 한가운데를 리그 평균으로 잡는다.
 * 이 값을 올리면 같은 능력치로도 성적이 나빠지므로, 능력치 스케일을 바꿀 때
 * 반드시 함께 맞춰야 리그 전체가 타고투저로 기울지 않는다.
 */
export const LEAGUE_AVG_ABILITY = 70.5;
export const n50 = (v: number) => (v - LEAGUE_AVG_ABILITY) / 55;
