import type { Team } from "./types";

/** 가상의 10개 구단 */
export const TEAMS: Team[] = [
  { id: "SEO", name: "서울 나이츠", short: "나이츠", city: "서울", color: "#1e3a8a", accent: "#93c5fd", park: { name: "한강 스타디움", hr: 0.88, hit: 0.98, label: "극단적 투수친화 · 가장 넓은 외야" }, power: 82, youth: 42, money: 95 },
  { id: "INC", name: "인천 세이버스", short: "세이버스", city: "인천", color: "#7f1d1d", accent: "#fca5a5", park: { name: "송도 파크", hr: 1.14, hit: 1.02, label: "타자친화 · 짧은 좌우 펜스" }, power: 74, youth: 58, money: 78 },
  { id: "SUW", name: "수원 타이탄스", short: "타이탄스", city: "수원", color: "#111827", accent: "#e5e7eb", park: { name: "수원 돔", hr: 1.0, hit: 0.99, label: "중립 · 실내 구장" }, power: 69, youth: 61, money: 70 },
  { id: "DAJ", name: "대전 코메츠", short: "코메츠", city: "대전", color: "#c2410c", accent: "#fed7aa", park: { name: "한밭 필드", hr: 1.06, hit: 1.01, label: "약한 타자친화" }, power: 55, youth: 84, money: 52 },
  { id: "DAG", name: "대구 라이언하츠", short: "라이언하츠", city: "대구", color: "#1d4ed8", accent: "#bfdbfe", park: { name: "팔공 파크", hr: 1.18, hit: 1.03, label: "홈런 공장 · 리그에서 가장 좁다" }, power: 77, youth: 49, money: 88 },
  { id: "BUS", name: "부산 시걸스", short: "시걸스", city: "부산", color: "#991b1b", accent: "#fecaca", park: { name: "해운대 볼파크", hr: 0.92, hit: 1.0, label: "투수친화 · 바닷바람" }, power: 61, youth: 72, money: 74 },
  { id: "GWJ", name: "광주 썬더스", short: "썬더스", city: "광주", color: "#b91c1c", accent: "#fee2e2", park: { name: "무등 스타디움", hr: 1.08, hit: 1.02, label: "약한 타자친화" }, power: 71, youth: 55, money: 66 },
  { id: "CHW", name: "창원 마린스", short: "마린스", city: "창원", color: "#0e7490", accent: "#a5f3fc", park: { name: "마산만 파크", hr: 0.98, hit: 0.99, label: "중립" }, power: 64, youth: 66, money: 58 },
  { id: "GOY", name: "고양 드래곤즈", short: "드래곤즈", city: "고양", color: "#065f46", accent: "#a7f3d0", park: { name: "일산 돔", hr: 0.9, hit: 0.97, label: "투수친화 · 넓고 습하다" }, power: 58, youth: 78, money: 61 },
  { id: "JEO", name: "전주 블레이즈", short: "블레이즈", city: "전주", color: "#6d28d9", accent: "#ddd6fe", park: { name: "덕진 파크", hr: 1.02, hit: 1.0, label: "중립" }, power: 67, youth: 63, money: 69 },
];

export const teamById = (id: string): Team =>
  TEAMS.find((t) => t.id === id) ?? TEAMS[0];
