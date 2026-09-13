import { isEverydayRole } from "./roles";
import { RNG } from "./rng";
import { isHitterLine } from "./sim";
import type { SeasonRecord, StatLine } from "./types";



/** 그 시즌이 어느 정도였는지 — 보직까지 감안해서 판정한다 */
type Tier = "star" | "good" | "solid" | "fringe" | "bad";

function tierOf(rec: SeasonRecord): Tier {
  const l = rec.line;
  const war = l.war;
  const starter = isEverydayRole(rec.role);
  if (rec.level !== "KBO") return "fringe";
  if (rec.champion || rec.awards.some((a) => a.includes("MVP")) || war >= 4.5) return "star";
  if (war >= 2.2) return "good";
  if (starter && war >= 1.0) return "solid";
  if (!starter) return "fringe";
  return "bad";
}

/** 시즌 총평 한 줄 */
export function seasonHeadline(rec: SeasonRecord): string {
  const l = rec.line;
  if (rec.champion) return "우승 반지를 낀 시즌";
  if (rec.awards.some((a) => a.includes("MVP"))) return "리그를 지배한 시즌";
  if (rec.level === "MINOR") return "1군 콜업을 준비한 시즌";
  if (rec.level === "ARMY") return rec.role === "복무" ? "야구를 잠시 떠난 시즌" : "실전 감각을 지킨 시즌";
  if (rec.note && l.war < 2) return "부상과 싸운 시즌";

  if (isHitterLine(l)) {
    if (l.pa < 150) return "기회를 기다린 시즌";
    if (rec.note) return "부상을 딛고 버틴 시즌";
    if (l.ops >= 0.95) return "타선의 중심에 선 시즌";
    if (l.hr >= 25) return "한 방으로 말한 시즌";
    if (l.avg >= 0.31) return "꾸준함이 빛난 시즌";
    if (l.war >= 3) return "팀에 꼭 필요했던 시즌";
    if (l.ops < 0.68) return "고전한 시즌";
    return "제 몫을 해낸 시즌";
  }
  if (l.ip < 40 && l.sv + l.hld < 10) return "등판 기회가 적었던 시즌";
  if (rec.note) return "부상을 딛고 버틴 시즌";
  if (l.era <= 2.8) return "마운드를 지배한 시즌";
  if (l.sv >= 30) return "뒷문을 걸어 잠근 시즌";
  if (l.w >= 15) return "승수를 쌓아 올린 시즌";
  if (l.war >= 3) return "팀 마운드의 기둥이 된 시즌";
  if (l.era >= 5.2) return "난타당한 시즌";
  return "제 몫을 해낸 시즌";
}

/** 팬 반응 — 타자/투수와 보직에 맞는 말만 나오게 한다 */
const FEED: Record<Tier, { hit: string[]; pit: string[] }> = {
  star: {
    hit: [
      "이런 타자가 우리 팀에 있다는 게 든든하다.",
      "타석에 들어설 때마다 뭔가 일어날 것 같다.",
      "리그 최고 타자 이야기에 이 이름이 빠지면 안 된다.",
      "올해는 진짜 다른 레벨이었다.",
    ],
    pit: [
      "이 선수 등판일만 기다려진다.",
      "에이스라는 말이 아깝지 않은 시즌.",
      "마운드에 올라오면 경기가 안정된다.",
      "상대 타자들이 손도 못 댔다.",
    ],
  },
  good: {
    hit: [
      "중심 타선을 든든하게 지켰다.",
      "해줘야 할 때 해주는 타자다.",
      "이 정도면 확실한 주전이다.",
      "내년에도 이 페이스면 더 바랄 게 없다.",
    ],
    pit: [
      "로테이션을 든든하게 지켰다.",
      "계산이 서는 투수라는 게 크다.",
      "이 정도 이닝을 먹어주는 것만으로 값어치를 한다.",
      "큰 경기에서도 흔들리지 않았다.",
    ],
  },
  solid: {
    hit: [
      "기복은 있었지만 자리는 지켰다.",
      "한 방만 더해지면 완성형인데.",
      "출루라도 꾸준히 해준 게 어디냐.",
      "무난했던 한 해였다.",
    ],
    pit: [
      "기복은 있었지만 제 차례는 지켰다.",
      "제구만 더 다듬으면 한 단계 올라선다.",
      "이닝은 먹어줬으니 내용은 내년에.",
      "무난했던 한 해였다.",
    ],
  },
  fringe: {
    hit: [
      "기회를 더 받았으면 좋겠다.",
      "1군에서 제대로 증명할 차례다.",
      "타석이 적어 평가하기 이르다.",
      "다음 시즌엔 풀타임을 소화해줬으면.",
    ],
    pit: [
      "등판 기회를 더 받았으면 좋겠다.",
      "1군에서 제대로 증명할 차례다.",
      "이닝이 적어 평가하기 이르다.",
      "다음 시즌엔 로테이션에 자리 잡았으면.",
    ],
  },
  bad: {
    hit: [
      "올해는 아쉬웠다. 다음을 기대한다.",
      "방망이가 끝내 살아나지 않았다.",
      "기대가 컸던 만큼 실망도 컸다.",
      "몸 상태부터 추스르는 게 먼저다.",
    ],
    pit: [
      "올해는 아쉬웠다. 다음을 기대한다.",
      "맞아나가는 장면이 너무 많았다.",
      "기대가 컸던 만큼 실망도 컸다.",
      "몸 상태부터 추스르는 게 먼저다.",
    ],
  },
};

export function fanFeed(rec: SeasonRecord, seed: number, count = 4): string[] {
  const rng = new RNG(seed);
  const tier = tierOf(rec);
  const l: StatLine = rec.line;
  const pool = [...(isHitterLine(l) ? FEED[tier].hit : FEED[tier].pit)];

  // 상황에 맞는 한 줄을 앞에 얹는다
  const extra: string[] = [];
  if (rec.champion) extra.push("우승 순간을 함께해줘서 고맙다.");
  if (rec.allStar) extra.push("올스타에서 보니 확실히 급이 다르더라.");
  if (rec.note) extra.push("부상만 없었으면 숫자가 더 좋았을 텐데.");
  if (rec.teamRank && rec.teamRank <= 3 && tier !== "bad") extra.push("팀 순위가 이만큼 오른 데는 이 선수 지분이 크다.");

  return [...rng.shuffle(extra).slice(0, 1), ...rng.shuffle(pool)].slice(0, count);
}
