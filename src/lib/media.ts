import { clamp } from "./rng";
import { roleTier } from "./roles";
import { MAJOR_TITLES } from "./sim";
import type { GameState, SeasonRecord } from "./types";

/* ------------------------------------------------------------------ */
/* 인터뷰 — 세 숫자를 플레이어의 것으로                                   */
/* ------------------------------------------------------------------ */

/**
 * 왜 필요한가.
 *
 * `trust`(구단 신뢰) · `teammate`(동료 관계) · `fame`(인지도) 셋은
 * 성적·수상·이적의 **결과로만** 움직였다. 플레이어가 직접 건드릴 방법이
 * 없어서, 화면에 떠 있어도 읽기만 하는 숫자였다.
 *
 * 시즌이 끝나면 기자가 묻는다. 질문은 **그해에 실제로 일어난 일**에서
 * 고른다 — 우승한 해와 부상으로 날린 해에 같은 걸 묻지 않는다.
 * 대답 한 줄로 세 숫자가 갈리고, 어떤 대답은 성적이 받쳐줘야 먹힌다.
 *
 * 균형의 원칙
 *  · **공짜 정답이 없다.** 셋을 다 올리는 선택지는 두지 않는다.
 *  · 모난 대답일수록 크게 움직인다 — 팬을 얻고 라커룸을 잃는 식이다.
 *  · 근거 없는 큰소리는 역효과다(`needsWar`) — 성적이 받쳐줘야 통한다.
 */
export interface InterviewOption {
  id: string;
  label: string;
  /** 무엇을 팔아 무엇을 사는가 — 화면에 그대로 적는다 */
  desc: string;
  trust: number;
  teammate: number;
  fame: number;
  condition?: number;
  /**
   * 이 WAR 이상이어야 말이 먹힌다. 못 미치면 효과가 뒤집힌다 —
   * 0.5 WAR짜리가 "내년엔 우승한다"고 하면 비웃음만 산다.
   */
  needsWar?: number;
  /** 성적이 못 미쳤을 때 대신 일어나는 일 */
  backfire?: string;
}

export interface InterviewQ {
  id: string;
  eyebrow: string;
  question: string;
  /** 그해 사정에 맞는 질문인가 */
  when: (c: MediaContext) => boolean;
  /** 앞쪽이 먼저 걸린다 — 특별한 해일수록 위에 둔다 */
  weight: number;
  options: InterviewOption[];
}

export interface MediaContext {
  s: GameState;
  rec: SeasonRecord;
  war: number;
  titles: number;
  champion: boolean;
  injured: boolean;
  demoted: boolean;
  rookie: boolean;
  veteran: boolean;
}

export function mediaContext(s: GameState, rec: SeasonRecord): MediaContext {
  const kbo = s.seasons.filter((r) => r.level === "KBO");
  return {
    s, rec,
    war: rec.line.war,
    titles: rec.awards.filter((a) => MAJOR_TITLES.includes(a)).length,
    champion: !!rec.champion,
    injured: !!rec.note?.includes("결장") || !!rec.note?.includes("부상"),
    demoted: rec.level === "MINOR" || roleTier(rec.role) <= 1,
    rookie: kbo.length <= 1,
    veteran: rec.age >= 33,
  };
}

/* 자주 쓰는 모양 — 세 숫자를 다 올리는 선택지는 만들지 않는다 */
const HUMBLE: InterviewOption = {
  id: "humble", label: "\"팀 덕분입니다\"",
  desc: "공을 동료에게 돌린다. 라커룸이 편해지지만 이야깃거리는 안 된다.",
  trust: 3, teammate: 6, fame: -1,
};
const BOLD = (war: number): InterviewOption => ({
  id: "bold", label: "\"내년엔 더 잘할 수 있습니다\"",
  desc: "목표를 입 밖에 낸다. 팬이 반응하지만, 못 지키면 두고두고 따라다닌다.",
  trust: 1, teammate: -3, fame: 8, needsWar: war,
  backfire: "성적이 받쳐주지 않아 큰소리로만 남았습니다.",
});
const FLAT: InterviewOption = {
  id: "flat", label: "짧게 답하고 자리를 뜬다",
  desc: "말을 아낀다. 아무 일도 일어나지 않는다.",
  trust: 0, teammate: 1, fame: -2,
};

export const INTERVIEWS: InterviewQ[] = [
  {
    id: "champion", eyebrow: "우승 인터뷰", weight: 100,
    question: "우승을 차지했습니다. 지금 심정이 어떻습니까?",
    when: (c) => c.champion,
    options: [
      { id: "team", label: "\"이 우승은 팀 전체의 것입니다\"", desc: "공을 나눈다. 라커룸이 단단해진다.", trust: 5, teammate: 10, fame: 2 },
      { id: "me", label: "\"제가 해냈습니다\"", desc: "가슴을 편다. 팬은 환호하지만 더그아웃은 조용해진다.", trust: -2, teammate: -8, fame: 14 },
      { id: "next", label: "\"연패하겠습니다\"", desc: "다음을 약속한다. 구단이 반긴다 — 못 지키면 부담이 된다.", trust: 8, teammate: 2, fame: 7, needsWar: 3.5, backfire: "우승했지만 내 몫이 크지 않았다는 말이 돌았습니다." },
    ],
  },
  {
    id: "title", eyebrow: "타이틀 인터뷰", weight: 90,
    question: "개인 타이틀을 따냈습니다. 비결이 무엇입니까?",
    when: (c) => c.titles > 0,
    options: [
      { id: "coach", label: "\"코칭스태프를 믿었습니다\"", desc: "구단에 공을 돌린다.", trust: 9, teammate: 3, fame: 1 },
      { id: "work", label: "\"겨울에 흘린 땀입니다\"", desc: "훈련 이야기를 한다. 동료들이 따라 움직인다.", trust: 3, teammate: 7, fame: 3 },
      { id: "more", label: "\"아직 만족 못 합니다\"", desc: "더 높은 곳을 말한다. 팬이 좋아한다.", trust: 2, teammate: -2, fame: 11 },
    ],
  },
  {
    id: "slump", eyebrow: "부진 인터뷰", weight: 85,
    question: "기대에 못 미친 한 해였습니다. 무엇이 문제였습니까?",
    when: (c) => c.war < 1.2 && !c.injured && !c.rookie,
    options: [
      { id: "own", label: "\"전적으로 제 탓입니다\"", desc: "고개를 숙인다. 구단이 다시 기회를 준다.", trust: 8, teammate: 4, fame: -3 },
      { id: "blame", label: "\"기회가 충분치 않았습니다\"", desc: "불만을 내비친다. 팬은 편을 들지만 구단은 아니다.", trust: -12, teammate: -4, fame: 6 },
      FLAT,
    ],
  },
  {
    id: "injury", eyebrow: "부상 인터뷰", weight: 80,
    question: "부상으로 많은 경기를 놓쳤습니다. 몸 상태는 어떻습니까?",
    when: (c) => c.injured,
    options: [
      { id: "ready", label: "\"내년 개막에 맞추겠습니다\"", desc: "복귀를 약속한다. 구단이 자리를 비워 둔다.", trust: 7, teammate: 2, fame: 3, condition: -4, needsWar: 0.8, backfire: "몸이 따라주지 않아 빈말로 들렸습니다." },
      { id: "careful", label: "\"서두르지 않겠습니다\"", desc: "무리하지 않겠다고 한다. 몸이 편해진다.", trust: 1, teammate: 3, fame: -2, condition: 8 },
      { id: "thanks", label: "\"기다려준 팬들께 미안합니다\"", desc: "팬에게 말한다.", trust: 2, teammate: 1, fame: 5 },
    ],
  },
  {
    id: "demoted", eyebrow: "2군 인터뷰", weight: 82,
    question: "올해는 1군에서 자리를 잡지 못했습니다.",
    when: (c) => c.demoted && !c.rookie,
    options: [
      { id: "fight", label: "\"내년엔 반드시 올라갑니다\"", desc: "이를 악문다.", trust: 5, teammate: 2, fame: 2, condition: -5 },
      { id: "learn", label: "\"2군에서 배울 게 많았습니다\"", desc: "낮은 자세로 말한다.", trust: 6, teammate: 5, fame: -3 },
      { id: "unfair", label: "\"기회를 더 받고 싶습니다\"", desc: "속내를 드러낸다. 구단이 불편해한다.", trust: -9, teammate: -2, fame: 4 },
    ],
  },
  {
    id: "rookie", eyebrow: "신인 인터뷰", weight: 70,
    question: "첫 1군 시즌을 마쳤습니다. 어땠습니까?",
    when: (c) => c.rookie,
    options: [
      { id: "respect", label: "\"선배들께 배우겠습니다\"", desc: "고개를 숙인다. 라커룸이 받아들인다.", trust: 4, teammate: 9, fame: 0 },
      { id: "goal", label: "\"내년엔 주전이 목표입니다\"", desc: "자리를 달라고 말한다.", trust: 3, teammate: -3, fame: 7 },
      HUMBLE,
    ],
  },
  {
    id: "veteran", eyebrow: "베테랑 인터뷰", weight: 65,
    question: "적지 않은 나이입니다. 언제까지 뛰실 생각입니까?",
    when: (c) => c.veteran,
    options: [
      { id: "more", label: "\"몸이 허락하는 한 뜁니다\"", desc: "은퇴 이야기를 자른다.", trust: 3, teammate: 2, fame: 6, needsWar: 1.5, backfire: "성적이 받쳐주지 않아 미련으로 읽혔습니다." },
      { id: "young", label: "\"후배들 뒤를 받치겠습니다\"", desc: "자리를 내줄 뜻을 비친다. 구단이 고마워한다.", trust: 9, teammate: 8, fame: -4 },
      { id: "onemore", label: "\"우승 반지 하나만 더\"", desc: "목표를 남긴다. 팬이 응원한다.", trust: 2, teammate: 3, fame: 9 },
    ],
  },
  {
    id: "good", eyebrow: "시즌 결산", weight: 40,
    question: "좋은 한 해였습니다. 스스로 평가한다면?",
    when: (c) => c.war >= 3,
    options: [HUMBLE, BOLD(3), { id: "fan", label: "\"팬들 덕분에 힘이 났습니다\"", desc: "관중석을 향해 말한다.", trust: 1, teammate: 2, fame: 8 }],
  },
  {
    id: "plain", eyebrow: "시즌 결산", weight: 10,
    question: "한 시즌을 마쳤습니다. 한 말씀 부탁드립니다.",
    when: () => true,
    options: [HUMBLE, BOLD(2), FLAT],
  },
];

/** 그해에 맞는 질문 하나 */
export function pickInterview(c: MediaContext): InterviewQ {
  const fit = INTERVIEWS.filter((q) => q.when(c)).sort((a, b) => b.weight - a.weight);
  return fit[0] ?? INTERVIEWS[INTERVIEWS.length - 1];
}

/** 대답의 결과 — 성적이 못 미치면 뒤집힌다 */
export function answerOf(q: InterviewQ, optionId: string, c: MediaContext) {
  const o = q.options.find((x) => x.id === optionId) ?? q.options[0];
  const flop = o.needsWar !== undefined && c.war < o.needsWar;
  const k = flop ? -0.6 : 1;   // 큰소리가 빗나가면 반대로 돌아온다
  return {
    option: o,
    flop,
    trust: Math.round(o.trust * k),
    teammate: Math.round(o.teammate * k),
    fame: Math.round(o.fame * k),
    condition: Math.round((o.condition ?? 0) * (flop ? 1 : 1)),
    note: flop ? (o.backfire ?? "말이 앞섰습니다.") : null,
  };
}

/** 값을 실제로 얹는다 */
export function applyInterview(s: GameState, q: InterviewQ, optionId: string, c: MediaContext) {
  const r = answerOf(q, optionId, c);
  s.trust = clamp(s.trust + r.trust, 0, 100);
  s.teammate = clamp(s.teammate + r.teammate, 0, 100);
  s.player.fame = clamp(s.player.fame + r.fame, 0, 100);
  if (r.condition) s.player.condition = clamp(s.player.condition + r.condition, 25, 100);
  return r;
}
