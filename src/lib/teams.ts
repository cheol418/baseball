import type { Team } from "./types";

/**
 * 10개 구단.
 *
 * 실제 KBO 구단을 그대로 쓰지는 않되, **어느 팀인지 바로 떠오르도록**
 * 연고지 + 그 팀의 별명(마스코트·응원 구호)으로 이름을 짓고
 * 유니폼 색과 홈구장 성격을 실제와 맞췄다.
 *
 * 전력·육성·자금 수치는 밸런스 검증을 거친 값이라 그대로 둔다.
 */
export const TEAMS: Team[] = [
  {
    // 잠실을 쓰는 서울 인기구단 — 파랑/빨강, 리그에서 가장 넓은 구장
    id: "SEO", name: "서울 트윈스", short: "트윈스", city: "서울",
    color: "#c30452", accent: "#ffd3e2",
    park: { name: "잠실 베이스볼파크", hr: 0.84, hit: 0.97, label: "극단적 투수친화 · 리그에서 가장 넓다" },
    power: 82, youth: 42, money: 95,
  },
  {
    // 잠실을 함께 쓰는 또 하나의 서울 구단 — 곰, 육성 명가
    id: "JAM", name: "잠실 베어스", short: "베어스", city: "서울",
    color: "#131230", accent: "#c9cbe8",
    park: { name: "잠실 베이스볼파크", hr: 0.86, hit: 0.97, label: "투수친화 · 넓은 외야를 함께 쓴다" },
    power: 67, youth: 63, money: 69,
  },
  {
    // 돔구장을 쓰는 서울 구단 — 버건디, 영웅
    id: "KHO", name: "고척 히어로즈", short: "히어로즈", city: "서울",
    color: "#570514", accent: "#e8c4cb",
    park: { name: "고척 스카이돔", hr: 0.95, hit: 0.99, label: "중립 · 날씨의 영향이 없는 실내 구장" },
    power: 58, youth: 78, money: 61,
  },
  {
    // 인천 바닷가 구단 — 빨강, 홈런이 잘 나오는 구장
    id: "INC", name: "인천 랜더스", short: "랜더스", city: "인천",
    color: "#ce0e2d", accent: "#ffd0d6",
    park: { name: "문학 랜더스필드", hr: 1.15, hit: 1.02, label: "타자친화 · 짧은 좌우 펜스" },
    power: 74, youth: 58, money: 78,
  },
  {
    // 수원 신생 구단 — 검정/빨강, 마법사
    id: "SUW", name: "수원 위즈", short: "위즈", city: "수원",
    color: "#0b0b0d", accent: "#f0b6b8",
    park: { name: "수원 위즈파크", hr: 1.08, hit: 1.01, label: "약한 타자친화" },
    power: 69, youth: 61, money: 70,
  },
  {
    // 대전 독수리 — 주황, 젊은 선수에게 기회를 많이 준다
    id: "DAJ", name: "대전 이글스", short: "이글스", city: "대전",
    color: "#fc4e00", accent: "#ffdcc7",
    park: { name: "한화생명 볼파크", hr: 1.02, hit: 1.00, label: "중립 · 새로 지은 구장" },
    power: 55, youth: 84, money: 52,
  },
  {
    // 대구 사자 — 파랑, 홈런 공장으로 악명 높은 구장
    id: "DAG", name: "대구 라이온즈", short: "라이온즈", city: "대구",
    color: "#074ca1", accent: "#c4dcf7",
    park: { name: "대구 라이온즈파크", hr: 1.18, hit: 1.03, label: "홈런 공장 · 리그에서 가장 좁다" },
    power: 77, youth: 49, money: 88,
  },
  {
    // 부산 갈매기 — 남색/빨강, 바닷바람이 타구를 잡는다
    id: "BUS", name: "부산 자이언츠", short: "자이언츠", city: "부산",
    color: "#041e42", accent: "#c7d2e3",
    park: { name: "사직 야구장", hr: 0.93, hit: 1.00, label: "투수친화 · 바닷바람" },
    power: 61, youth: 72, money: 74,
  },
  {
    // 광주 호랑이 — 빨강/검정, 우승 횟수가 가장 많은 전통의 강팀
    id: "GWJ", name: "광주 타이거즈", short: "타이거즈", city: "광주",
    color: "#ea0029", accent: "#ffd2d8",
    park: { name: "광주 챔피언스필드", hr: 1.06, hit: 1.01, label: "약한 타자친화" },
    power: 71, youth: 55, money: 66,
  },
  {
    // 창원 공룡 — 남색/금색, 데이터로 팀을 만든 신생 구단
    id: "CHW", name: "창원 다이노스", short: "다이노스", city: "창원",
    color: "#315288", accent: "#cfdcef",
    park: { name: "창원 다이노스파크", hr: 1.00, hit: 0.99, label: "중립" },
    power: 64, youth: 66, money: 58,
  },
];

/**
 * 예전 세이브가 쓰던 구단 id.
 * 고양 드래곤즈 → 고척 히어로즈, 전주 블레이즈 → 잠실 베어스로 자리를 옮겼다.
 */
export const TEAM_ID_ALIAS: Record<string, string> = {
  GOY: "KHO",
  JEO: "JAM",
};

export const teamById = (id: string): Team =>
  TEAMS.find((t) => t.id === (TEAM_ID_ALIAS[id] ?? id)) ?? TEAMS[0];
