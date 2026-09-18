import { getAb, overall } from "./player";
import { clamp, n50, RNG } from "./rng";
import { isRotationRole } from "./roles";
import type { GameState, HitterLine, PitcherLine, StatLine } from "./types";

/**
 * 승부처.
 *
 * 시즌이 "버튼을 누르고 지켜보는 것"만으로 끝나면 심심하다는 말을 들었다.
 * 월별 중계 자체에 끼어들려면 시뮬레이션을 중간에 멈췄다 재개해야 하는데,
 * 그건 한 반기를 한 번에 계산하는 구조를 뒤집는 일이다.
 *
 * 그래서 **반기가 시작될 때 고르고, 결과는 중계가 그 달에 닿았을 때 공개**한다.
 * 선택은 진짜로 기록을 바꾸고, 무엇이 나올지는 중계를 볼 때까지 모른다.
 */

export interface ClutchOption {
  id: string;
  label: string;
  desc: string;
  /** 이 선택이 기대는 능력치 (화면에 근거로 보여준다) */
  leans: string;
  /** 성공 확률 0~1 */
  odds: number;
  /** 실패해도 얻는 것이 있는가 */
  safe?: boolean;
}

export interface ClutchOutcome {
  id: string;
  /** 결과 제목 */
  title: string;
  /** 한 줄 묘사 */
  body: string;
  tone: "epic" | "good" | "neutral" | "bad";
  /**
   * 승부를 이겼는가.
   * 성공 여부를 id 목록으로 따로 관리했더니 타자의 "헛스윙 삼진"과
   * 투수의 "삼진으로 위기 탈출"이 같은 id를 써서 뒤엉켰다. 결과 자체에 적는다.
   */
  good: boolean;
  /**
   * 경기를 끝낼 수 있는 자리가 아닐 때 쓰는 말.
   * 7회 1사 만루에서 "끝내기 만루홈런"이 뜨면 장면과 결과가 따로 논다.
   */
  notWalkoff?: { title: string; body: string };
  /**
   * 팀이 그 경기를 졌을 때 쓰는 말.
   * 올스타·국대·가을야구는 **결과 카드가 바로 옆에** 붙는다 —
   * "끝내기 만루홈런" 밑에 "패배 3-7"이 찍히면 화면이 자기 말을 뒤집는다.
   * (실제로 겪음)
   */
  inLoss?: { title: string; body: string };
  /** 팀이 그 경기를 이겼을 때 쓰는 말 (내가 내주고도 팀이 이긴 경우) */
  inWin?: { title: string; body: string };
  /** 그 달 기록에 더해지는 값 */
  stat: Partial<Record<string, number>>;
  fame: number;
  trust: number;
  condition: number;
}

export interface Clutch {
  /** 어느 달의 경기인가 (H1_MONTHS / H2_MONTHS의 인덱스) */
  monthIndex: number;
  monthLabel: string;
  eyebrow: string;
  title: string;
  body: string;
  opponent: string;
  /** 여기서 터지면 경기가 끝나는 자리인가 (우리 팀의 마지막 공격) */
  walkoff?: boolean;
  /**
   * 이 승부처가 걸린 경기의 결과.
   * 결과 카드가 붙는 무대(올스타·국대·가을야구)에서만 정해진다 —
   * 월별 중계에는 경기 결과 카드가 없으므로 undefined다.
   */
  teamWon?: boolean;
  options: ClutchOption[];
}

export interface ClutchResult {
  monthIndex: number;
  monthLabel: string;
  /** 무엇을 골랐는가 */
  optionId: string;
  optionLabel: string;
  /** 그 선택에서 나올 수 있었던 결과 전부 (뽑기 연출용) */
  pool: ClutchOutcome[];
  /** 실제로 나온 결과 */
  outcome: ClutchOutcome;
  success: boolean;
}

/* ------------------------------------------------------------------ */
/* 상황                                                               */
/* ------------------------------------------------------------------ */

/**
 * 장면 하나.
 * `walkoff`는 **여기서 터지면 경기가 끝나는 자리**라는 뜻이다 —
 * 이 표시가 있어야 결과에 "끝내기"라고 쓸 수 있다.
 */
interface Scene {
  eyebrow: string;
  title: string;
  body: string;
  walkoff?: boolean;
  /**
   * 그 달에만 말이 되는 장면.
   * "개막전 첫 타석"이 9월에 뜨거나 "시즌 최종전"이 4월에 뜨면 안 된다.
   */
  when?: "OPENER" | "FINALE";
  /**
   * 선수의 지난 일을 전제로 하는 장면.
   * 1군에 올라간 적 없는 신인에게 "강등 첫 경기 — 어제까지 1군이었습니다"가
   * 뜨면 없던 과거를 만들어낸다. (실제로 겪음)
   */
  requires?: (c: SceneContext) => boolean;
}

/** 장면이 말이 되는지 따지는 데 필요한 것들 */
export interface SceneContext {
  /** 1군에서 뛰어본 적이 있는가 (이번 시즌 포함) */
  hasKbo: boolean;
  /** 지금 팀이 아닌 팀에서 뛰어본 적이 있는가 */
  hasFormerTeam: boolean;
  /** 올해 다쳤는가 */
  injured: boolean;
}

export function sceneContext(s: GameState): SceneContext {
  const pro = s.seasons.filter((r) => r.level === "KBO" || r.level === "MINOR");
  return {
    hasKbo: !!s.seasonByLevel?.KBO || s.seasons.some((r) => r.level === "KBO"),
    hasFormerTeam: !!s.contract && pro.some((r) => r.teamId !== s.contract!.teamId),
    injured: !!s.seasonNote || s.seasonAvailability < 0.95,
  };
}

const HIT_SCENES: Scene[] = [
  { eyebrow: "9회말 2사 만루", title: "한 방이면 끝난다", body: "1점 차로 뒤진 9회말 2사 만루. 구장 전체가 일어섰습니다.", walkoff: true },
  { eyebrow: "연장 10회 1사 3루", title: "외야 뜬공이면 끝난다", body: "동점으로 맞선 연장 10회. 3루 주자가 홈을 노리고 있습니다.", walkoff: true },
  { eyebrow: "8회 2사 2·3루", title: "역전의 기회", body: "두 점 차 추격. 여기서 한 방이면 경기를 뒤집습니다." },
  { eyebrow: "개막전 첫 타석", title: "한 해의 첫 스윙", body: "만원 관중 앞에서 맞는 올 시즌 첫 타석입니다.", when: "OPENER" },
  { eyebrow: "라이벌전 9회초", title: "적지에서의 한 타석", body: "야유가 쏟아지는 원정 구장, 동점 주자가 2루에 있습니다." },
  { eyebrow: "7회 1사 만루", title: "병살만은 안 된다", body: "한 점만 나면 흐름이 넘어옵니다. 내야는 전진 수비입니다." },
  { eyebrow: "더블헤더 2차전 9회", title: "긴 하루의 끝", body: "다리가 무겁습니다. 그래도 타석은 돌아왔습니다." },
  { eyebrow: "4타수 무안타 · 9회", title: "오늘을 지우는 한 번", body: "오늘 네 번 모두 침묵했습니다. 마지막 기회입니다." },
  { eyebrow: "20경기 연속 안타 도전", title: "기록이 걸린 타석", body: "오늘 안타가 없습니다. 이번이 마지막 타석입니다." },
  { eyebrow: "홈런 1개 차 · 시즌 최종전", title: "타이틀이 걸렸다", body: "홈런왕 경쟁자와 한 개 차이. 오늘이 마지막 경기입니다.", when: "FINALE" },
  { eyebrow: "친정팀 상대 첫 타석", title: "떠나온 자리에서", body: "지난해까지 입던 유니폼을 상대로 섭니다. 3루 관중석이 조용합니다.", requires: (c) => c.hasFormerTeam },
  { eyebrow: "우천 중단 뒤 재개 · 8회", title: "두 시간을 기다린 타석", body: "몸이 식었습니다. 그래도 상황은 그대로 남아 있습니다." },
  { eyebrow: "빈볼 직후 타석", title: "맞고 나서 다시 선다", body: "앞 타석에서 등에 공을 맞았습니다. 더그아웃이 날이 서 있습니다." },
  { eyebrow: "은사 은퇴 경기 · 9회", title: "보내드리는 한 타석", body: "오늘로 유니폼을 벗는 노장이 더그아웃에서 보고 있습니다." },
  { eyebrow: "1위 팀과 3연전 마지막", title: "승차를 줄일 기회", body: "여기서 이기면 1경기 차, 지면 3경기 차입니다." },
  { eyebrow: "9회말 1사 1·2루", title: "한 점만 따라가면 동점", body: "두 점 차 9회말. 여기서 지면 오늘은 끝입니다.", walkoff: true },
  { eyebrow: "연장 12회말 2사", title: "더 이상 던질 투수가 없다", body: "양 팀 불펜이 모두 비었습니다. 이 이닝이 마지막입니다.", walkoff: true },
  { eyebrow: "3연전 싹쓸이 앞둔 9회말", title: "쓸어담을 기회", body: "두 경기를 먼저 가져왔습니다. 오늘까지면 완벽한 주말입니다.", walkoff: true },
  { eyebrow: "연장 11회말 1사 만루", title: "여기서 끝내지 못하면", body: "벤치에 남은 야수가 없습니다. 더 끌 수 없습니다.", walkoff: true },
  { eyebrow: "1점 차 9회말 선두타자", title: "출루가 먼저다", body: "내가 동점 주자가 되어야 합니다. 뒤에 4번이 있습니다.", walkoff: true },
  { eyebrow: "6회 무사 1루", title: "흐름을 이어야 한다", body: "앞 타자가 걸어 나갔습니다. 벤치는 강공을 지시했습니다." },
  { eyebrow: "상대 에이스와 세 번째 승부", title: "오늘 두 번 당했다", body: "앞선 두 번 모두 잡혔습니다. 이제 패턴이 보이기 시작합니다." },
  { eyebrow: "무더위 속 낮경기", title: "땀이 눈에 들어온다", body: "체감 35도. 다리가 무겁습니다." },
  { eyebrow: "타순이 3번으로 바뀐 날", title: "새로 받은 자리", body: "감독이 타순을 바꿨습니다. 왜 그랬는지 보여줘야 합니다." },
  { eyebrow: "2사 후 연속 출루 뒤", title: "이어받은 자리", body: "두 명이 연달아 나갔습니다. 여기서 끊기면 아쉽습니다." },
  { eyebrow: "시즌 100번째 경기", title: "긴 여름의 한가운데", body: "몸도 마음도 반쯤 지쳤습니다. 순위 싸움은 지금부터입니다." },
  { eyebrow: "올해 마지막 홈경기", title: "홈 팬 앞의 인사", body: "우리 구장에서 치르는 마지막 경기입니다. 스탠드가 가득 찼습니다." },
  { eyebrow: "5회 2사 주자 없음", title: "혼자 만들어야 한다", body: "누구도 도와줄 수 없는 상황입니다." },
  { eyebrow: "감독 퇴장 직후", title: "어수선한 더그아웃", body: "판정에 항의하던 감독이 나갔습니다. 분위기가 날카롭습니다." },
  { eyebrow: "상대 투수 교체 직후", title: "바뀐 상대", body: "불펜이 급하게 올라왔습니다. 아직 몸이 덜 풀렸습니다." },
  { eyebrow: "홈런 친 다음 이닝", title: "한 번 더", body: "방금 담장을 넘겼습니다. 상대 벤치가 움직이기 시작합니다." },
  { eyebrow: "만원 관중 주말 경기", title: "가득 찬 스탠드", body: "3루 쪽까지 빈자리가 없습니다." },
];

const PIT_SCENES_SP: Scene[] = [
  { eyebrow: "7회 무사 1·2루", title: "여기서 끊어야 한다", body: "1점 차 리드. 투구수 95개, 불펜은 아직 몸을 풀고 있습니다." },
  { eyebrow: "8회 2사 만루", title: "한 타자만 더", body: "완봉이 눈앞입니다. 상대는 이번 시즌 타율 3할의 4번 타자." },
  { eyebrow: "노히트 진행 중 · 8회", title: "아무도 말을 걸지 않는다", body: "더그아웃이 조용합니다. 8회를 무사히 넘기면 역사가 됩니다." },
  { eyebrow: "개막전 선발", title: "한 해의 첫 공", body: "만원 관중 앞에서 던지는 올 시즌 첫 이닝입니다.", when: "OPENER" },
  { eyebrow: "1회 무사 만루", title: "시작부터 흔들린다", body: "아직 아웃 카운트가 하나도 없습니다. 여기서 무너지면 조기 강판입니다." },
  { eyebrow: "투구수 118개 · 9회", title: "내 손으로 끝낸다", body: "감독이 마운드를 보고 있습니다. 아웃 하나면 완투입니다." },
  { eyebrow: "20승 도전 등판", title: "한 해의 마지막 등판", body: "오늘 이기면 20승입니다. 다음 등판은 없습니다.", when: "FINALE" },
  { eyebrow: "상대 에이스와 맞대결", title: "0의 행진", body: "7회까지 양 팀 무득점. 한 점이면 갈립니다." },
  { eyebrow: "부상 복귀 첫 등판", title: "다시 마운드 위에서", body: "재활에만 반년이 걸렸습니다. 첫 타자를 상대합니다.", requires: (c) => c.injured },
  { eyebrow: "친정팀 상대 선발", title: "떠나온 자리에서", body: "지난해까지 함께 뛰던 타자들이 타석에 들어섭니다.", requires: (c) => c.hasFormerTeam },
  { eyebrow: "3연패 끊기 등판", title: "흐름을 바꿔야 한다", body: "팀이 세 경기를 내리 졌습니다. 오늘은 길게 끌어줘야 합니다." },
  { eyebrow: "만원 관중 · 라이벌전", title: "야유 속의 한 구", body: "원정 구장이 가득 찼습니다. 주자는 득점권에 있습니다." },
  { eyebrow: "퍼펙트 진행 중 · 6회", title: "아직 아무도 내보내지 않았다", body: "열여덟 명을 연달아 잡았습니다. 손끝이 떨립니다." },
  { eyebrow: "1회 선두타자 출루", title: "시작이 꼬였다", body: "첫 타자를 내보냈습니다. 여기서 흔들리면 길어집니다." },
  { eyebrow: "6회 2사 주자 없음", title: "한 이닝만 더", body: "투구수 88개. 감독이 불펜 쪽을 봅니다." },
  { eyebrow: "상대 4번과 세 번째 대결", title: "오늘 두 번 맞았다", body: "앞선 두 번 모두 안타를 내줬습니다." },
  { eyebrow: "무더위 속 낮경기 등판", title: "유니폼이 젖었다", body: "체감 35도. 손에 땀이 말랐다 젖었다 합니다." },
  { eyebrow: "5회 1사 1·3루", title: "한 점은 줘도 된다", body: "병살이면 한 점을 내주고 이닝이 끝납니다." },
  { eyebrow: "타선이 10점을 낸 날", title: "편하게 던져도 된다", body: "점수는 넉넉합니다. 이닝만 먹어주면 됩니다." },
  { eyebrow: "가랑비 내리는 마운드", title: "공이 미끄럽다", body: "비가 그치지 않습니다. 심판은 경기를 이어가기로 했습니다." },
  { eyebrow: "구위가 떨어진 7회", title: "감으로 던진다", body: "구속이 3킬로 떨어졌습니다. 남은 건 경험뿐입니다." },
  { eyebrow: "0의 행진 · 연장 직전", title: "여기까지 왔다", body: "양 팀 다 점수가 없습니다. 이번 이닝이 마지막입니다." },
];

const MINOR_SCENES: Scene[] = [
  { eyebrow: "퓨처스 9회말 2사", title: "1군이 보고 있다", body: "스카우트와 코칭스태프가 관중석에 앉아 있습니다. 여기서 보여줘야 합니다.", walkoff: true },
  { eyebrow: "콜업을 앞둔 한 경기", title: "마지막 시험대", body: "이 경기 결과로 1군 등록이 갈릴 수 있습니다." },
  { eyebrow: "재활 경기 마지막 날", title: "몸은 다 만들었다", body: "오늘만 무사히 넘기면 1군으로 올라갑니다.", requires: (c) => c.injured },
  { eyebrow: "관중 200명 앞에서", title: "아무도 보지 않아도", body: "빈 스탠드입니다. 그래도 기록은 남습니다." },
  { eyebrow: "강등 첫 경기", title: "내려온 자리에서", body: "어제까지 1군이었습니다. 다시 올라가려면 여기서 시작해야 합니다.", requires: (c) => c.hasKbo },
  { eyebrow: "퓨처스 올스타 선발", title: "2군의 간판", body: "이 무대에서 잘하면 1군 코칭스태프의 눈에 듭니다." },
  { eyebrow: "퓨처스 9회말 동점", title: "끝내면 집에 간다", body: "긴 원정의 마지막 경기입니다.", walkoff: true },
  { eyebrow: "1군에서 내려온 선수와 같은 타순", title: "나란히 선 자리", body: "어제까지 1군에 있던 선수가 앞에 섭니다." },
  { eyebrow: "퓨처스 시즌 마지막 경기", title: "올해 마지막 기회", body: "이 경기가 끝나면 마무리캠프 명단이 나옵니다." },
  { eyebrow: "비 오는 평일 낮경기", title: "우산 든 관중 서른 명", body: "그래도 기록원은 자리를 지키고 있습니다." },
  { eyebrow: "상무 팀과의 경기", title: "군복을 입은 옛 동료", body: "같이 뛰던 선수가 상대 유니폼을 입고 있습니다." },
  { eyebrow: "2군 감독이 지켜보는 자리", title: "보고서에 적힌다", body: "코치가 뒤에서 수첩을 들고 있습니다." },
];

const HS_SCENES: Scene[] = [
  { eyebrow: "전국대회 8강 9회말", title: "고교 시절의 한 타석", body: "스탠드에 프로 스카우트들이 앉아 있습니다. 이 한 번이 드래프트를 바꿉니다." },
  { eyebrow: "결승 연장 승부", title: "3학년의 마지막 여름", body: "지면 여기서 끝입니다. 더 이상 다음이 없습니다." },
  { eyebrow: "지역 예선 결승", title: "전국으로 가는 문", body: "여기서 지면 전국대회 무대를 밟지 못합니다." },
  { eyebrow: "부모님이 보러 온 날", title: "스탠드의 두 사람", body: "처음으로 경기장에 오셨습니다. 3루 쪽 스탠드에 앉아 계십니다." },
  { eyebrow: "라이벌 학교와 맞대결", title: "3년을 벼른 한 번", body: "중학교 때부터 져 온 상대입니다. 마지막 기회입니다." },
  { eyebrow: "1점 차 9회말 2사", title: "마지막 공격", body: "끝내지 못하면 우리 여름이 끝납니다.", walkoff: true },
  { eyebrow: "지역 라이벌 정기전", title: "학교의 자존심", body: "전교생이 스탠드를 채웠습니다." },
  { eyebrow: "8강이 걸린 경기", title: "여기서 지면 집에 간다", body: "한 번만 더 이기면 전국 8강입니다." },
  { eyebrow: "폭염 경보 속 결승", title: "쓰러지지만 않으면 된다", body: "체감 38도. 물을 들이켜고 다시 들어섭니다." },
  { eyebrow: "3학년 마지막 홈경기", title: "3년을 보낸 운동장", body: "이 그라운드를 밟는 건 오늘이 마지막입니다." },
];

const COLLEGE_SCENES: Scene[] = [
  { eyebrow: "대학 선수권 준결승", title: "다시 증명할 차례", body: "고교 때 받지 못한 평가를 뒤집을 기회입니다." },
  { eyebrow: "프로 스카우트 앞에서", title: "보고 있는 눈이 많다", body: "이 경기 하나로 지명 순위가 달라집니다." },
  { eyebrow: "4학년 마지막 대회", title: "이번이 아니면 없다", body: "여기서 못 보여주면 지명을 못 받을 수도 있습니다." },
  { eyebrow: "고교 동기와 맞대결", title: "먼저 프로로 간 친구", body: "같이 뛰던 동기는 이미 1군에 있습니다. 오늘 상대는 그 학교입니다." },
  { eyebrow: "전국대회 개막전", title: "긴 시즌의 첫 경기", body: "지난해 우승팀과 맞붙습니다." },
  { eyebrow: "준결승 9회말 2사", title: "마지막 공격", body: "지면 4강에서 끝납니다.", walkoff: true },
  { eyebrow: "지명 앞둔 마지막 대회", title: "이름을 남겨야 한다", body: "이 대회 성적이 보고서의 마지막 줄이 됩니다." },
  { eyebrow: "대학 리그 라이벌전", title: "매년 지는 상대", body: "3년 동안 한 번도 이겨보지 못했습니다." },
  { eyebrow: "사흘 밀린 경기", title: "기다리다 지쳤다", body: "비 때문에 사흘을 숙소에서 보냈습니다. 감이 걱정입니다." },
  { eyebrow: "대학 대표팀 선발전", title: "태극마크가 걸렸다", body: "여기서 잘하면 대학 대표로 뽑힙니다." },
];

const PIT_SCENES_RP: Scene[] = [
  { eyebrow: "9회 1점 차 등판", title: "세이브 상황", body: "선두 타자가 출루하면 동점 주자가 나갑니다." },
  { eyebrow: "8회 무사 만루 승계", title: "불을 꺼야 한다", body: "앞선 투수가 만들어 놓은 위기. 실점 없이 막으면 팀이 이깁니다." },
  { eyebrow: "연장 11회 등판", title: "지면 끝난다", body: "양 팀 불펜이 모두 소진됐습니다. 이 이닝을 막아야 합니다." },
  { eyebrow: "3일 연투 · 9회", title: "팔이 무겁다", body: "사흘 연속 등판입니다. 그래도 문을 닫을 사람은 나뿐입니다." },
  { eyebrow: "블론 다음 날 등판", title: "어제를 지운다", body: "어제 다 잡은 경기를 날렸습니다. 같은 상황이 또 왔습니다." },
  { eyebrow: "40세이브 도전", title: "한 개가 남았다", body: "시즌 39세이브. 기록이 걸린 9회입니다.", when: "FINALE" },
  { eyebrow: "동점 9회말 무사 2루", title: "끝내기를 막아라", body: "한 점도 줄 수 없습니다. 내야는 전진합니다." },
  { eyebrow: "4점 차 9회 등판", title: "세이브가 아닌 이닝", body: "기록은 안 붙지만, 오늘 불펜이 바닥났습니다." },
  { eyebrow: "7회 1사 1·2루 승계", title: "남이 만든 불", body: "앞 투수가 주자를 두고 내려갔습니다." },
  { eyebrow: "동점 8회 등판", title: "내주면 끝이다", body: "여기서 무너지면 그대로 역전당합니다." },
  { eyebrow: "이틀 쉬고 9회", title: "팔이 가볍다", body: "오랜만에 충분히 쉬었습니다." },
  { eyebrow: "2점 차 9회 2사 1·2루", title: "마지막 한 명", body: "동점 주자가 2루에 있습니다. 하나만 더 잡으면 끝납니다." },
  { eyebrow: "선발 조기 강판 직후", title: "길게 먹어야 한다", body: "2회에 불이 났습니다. 오래 버텨줘야 합니다." },
  { eyebrow: "라이벌전 8회 등판", title: "야유 속에서", body: "원정 관중이 일어나 소리를 지릅니다." },
  { eyebrow: "처음 받은 세이브 기회", title: "처음 맡는 9회", body: "마무리 자리를 오늘 처음 받았습니다. 벤치가 지켜봅니다." },
  { eyebrow: "1사 만루 구원 등판", title: "아웃 카운트는 둘", body: "실점 없이 막으면 오늘의 주인공이 됩니다." },
  { eyebrow: "더블헤더 2차전 8회", title: "긴 하루의 끝", body: "오늘만 두 번째 경기입니다. 몸이 무겁습니다." },
  { eyebrow: "우천 중단 뒤 재개 · 9회", title: "두 시간을 기다렸다", body: "몸이 식었습니다. 다시 풀 시간은 없습니다." },
];

/* ------------------------------------------------------------------ */
/* 선택지                                                             */
/* ------------------------------------------------------------------ */

const ab = (s: GameState, k: string) => getAb(s.player.abilities, k as never);

function hitterOptions(s: GameState): ClutchOption[] {
  const cond = s.player.condition / 100;
  const pw = n50(ab(s, "power"));
  const ct = n50(ab(s, "contact"));
  const ey = n50(ab(s, "eye"));
  const mt = n50(ab(s, "mental"));
  return [
    {
      id: "swing", label: "초구부터 노린다", leans: "파워 · 멘탈",
      desc: "가장 좋은 공 하나를 노려 크게 휘두른다. 성공하면 경기를 끝내지만, 빗나가면 허무하게 끝난다.",
      odds: clamp(0.20 + pw * 0.30 + mt * 0.10 + (cond - 0.7) * 0.15, 0.08, 0.55),
    },
    {
      id: "contact", label: "맞혀서 내보낸다", leans: "컨택",
      desc: "크게 노리지 않고 정확히 맞힌다. 극적이진 않아도 주자를 불러들일 수 있다.",
      odds: clamp(0.36 + ct * 0.30 + (cond - 0.7) * 0.12, 0.18, 0.72),
    },
    {
      id: "patient", label: "끝까지 골라낸다", leans: "선구", safe: true,
      desc: "승부를 피하는 공에 손대지 않는다. 화려하진 않지만 다음 타자에게 기회를 넘긴다.",
      odds: clamp(0.46 + ey * 0.30, 0.28, 0.78),
    },
  ];
}

function pitcherOptions(s: GameState): ClutchOption[] {
  const cond = s.player.condition / 100;
  const ve = n50(ab(s, "velocity"));
  const co = n50(ab(s, "control"));
  const mv = n50(ab(s, "movement"));
  const mt = n50(ab(s, "mental"));
  return [
    {
      id: "power", label: "정면승부한다", leans: "구속 · 멘탈",
      desc: "가장 빠른 공으로 윽박지른다. 삼진으로 끝내면 최고지만, 맞으면 크게 맞는다.",
      odds: clamp(0.24 + ve * 0.30 + mt * 0.10 + (cond - 0.7) * 0.15, 0.10, 0.60),
    },
    {
      id: "corner", label: "코너를 노린다", leans: "제구",
      desc: "스트라이크존 구석만 찌른다. 볼넷 위험을 안고 가지만 정타를 내주지 않는다.",
      odds: clamp(0.38 + co * 0.30 + (cond - 0.7) * 0.12, 0.18, 0.74),
    },
    {
      id: "ground", label: "병살을 유도한다", leans: "무브먼트", safe: true,
      desc: "낮게 떨어뜨려 땅볼을 만든다. 한 번에 두 개를 잡을 수도, 한 점을 내줄 수도 있다.",
      odds: clamp(0.42 + mv * 0.28, 0.24, 0.76),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 결과 — 선택마다 나올 수 있는 것들                                    */
/* ------------------------------------------------------------------ */

const HIT_POOL: Record<string, ClutchOutcome[]> = {
  swing: [
    { id: "walkoff", good: true, title: "끝내기 만루홈런", body: "받아친 타구가 담장을 넘어갔습니다. 더그아웃이 쏟아져 나옵니다.", tone: "epic",
      notWalkoff: { title: "만루홈런", body: "받아친 타구가 그대로 담장을 넘어갔습니다. 주자 셋이 모두 홈을 밟았습니다." },
      inLoss: { title: "만루홈런", body: "넉 점짜리 한 방으로 따라붙었습니다. 팀은 끝내 고개를 숙였지만, 이 타구는 남습니다." },
      stat: { hr: 1, rbi: 4, h: 1, r: 1 }, fame: 14, trust: 8, condition: 10 },
    { id: "hr", good: true, title: "역전 투런", body: "가운데 담장을 넘겼습니다. 경기가 뒤집혔습니다.", tone: "epic",
      inLoss: { title: "추격의 투런", body: "가운데 담장을 넘겼습니다. 두 점을 따라붙었지만 거기서 멈췄습니다." },
      stat: { hr: 1, rbi: 2, h: 1, r: 1 }, fame: 10, trust: 6, condition: 8 },
    { id: "swing_k", good: false, title: "헛스윙 삼진", body: "크게 돌린 방망이가 허공을 갈랐습니다.", tone: "bad",
      stat: { so: 1 }, fame: -2, trust: -4, condition: -8 },
    { id: "swing_fly", good: false, title: "큼직한 뜬공", body: "잘 맞았지만 담장 앞에서 잡혔습니다.", tone: "bad",
      stat: {}, fame: 0, trust: -1, condition: -4 },
  ],
  contact: [
    { id: "clutch2", good: true, title: "싹쓸이 2루타", body: "우중간을 가르는 타구, 주자가 모두 들어왔습니다.", tone: "epic",
      inLoss: { title: "싹쓸이 2루타", body: "우중간을 가르는 타구로 세 점을 따라붙었습니다. 그래도 모자랐습니다." },
      stat: { b2: 1, h: 1, rbi: 3 }, fame: 8, trust: 7, condition: 8 },
    { id: "single", good: true, title: "결승 적시타", body: "중전 안타로 주자를 불러들였습니다.", tone: "good",
      inLoss: { title: "동점 적시타", body: "중전 안타로 주자를 불러들여 균형을 맞췄습니다." },
      stat: { h: 1, rbi: 2 }, fame: 5, trust: 5, condition: 6 },
    { id: "gidp", good: false, title: "병살타", body: "잘 맞은 타구가 유격수 정면으로 향했습니다.", tone: "bad",
      stat: {}, fame: -2, trust: -4, condition: -7 },
    { id: "contact_out", good: false, title: "빗맞은 내야 땅볼", body: "배트 끝에 맞아 힘없이 굴러갔습니다.", tone: "bad",
      stat: {}, fame: -1, trust: -2, condition: -3 },
  ],
  patient: [
    { id: "bb_win", good: true, title: "밀어내기 볼넷", body: "끝까지 골라 결승점을 밀어냈습니다. 화려하진 않지만 이겼습니다.", tone: "good",
      inLoss: { title: "밀어내기 볼넷", body: "끝까지 골라 한 점을 밀어냈습니다. 화려하진 않지만 할 일은 했습니다." },
      stat: { bb: 1, rbi: 1 }, fame: 5, trust: 6, condition: 5 },
    { id: "bb", good: true, title: "볼넷 출루", body: "승부를 피하는 공에 손대지 않았습니다. 다음 타자에게 넘깁니다.", tone: "neutral",
      stat: { bb: 1 }, fame: 2, trust: 3, condition: 2 },
    { id: "look", good: false, title: "루킹 삼진", body: "마지막 공이 존을 스쳤습니다. 심판의 손이 올라갔습니다.", tone: "bad",
      stat: { so: 1 }, fame: -3, trust: -4, condition: -6 },
    { id: "patient_out", good: false, title: "파울 끝에 범타", body: "끈질기게 버텼지만 결국 잡혔습니다.", tone: "bad",
      stat: {}, fame: 0, trust: -1, condition: -3 },
  ],
};

const PIT_POOL: Record<string, ClutchOutcome[]> = {
  power: [
    { id: "k3", good: true, title: "3구 삼진", body: "몸쪽 높은 직구. 방망이가 나오지 못했습니다.", tone: "epic",
      stat: { so: 1 }, fame: 12, trust: 8, condition: 9 },
    { id: "pw_k", good: true, title: "삼진으로 위기 탈출", body: "결국 헛스윙을 끌어냈습니다.", tone: "good",
      stat: { so: 1 }, fame: 7, trust: 6, condition: 7 },
    { id: "hr_allow", good: false, title: "역전 피홈런", body: "가운데로 몰린 공이 그대로 넘어갔습니다.", tone: "bad",
      inWin: { title: "석 점 피홈런", body: "가운데로 몰린 공이 그대로 넘어갔습니다. 타선이 뒤에서 지워줬습니다." },
      stat: { hrAllowed: 1, er: 3, h: 1 }, fame: -4, trust: -7, condition: -10 },
    { id: "pw_hit", good: false, title: "적시타 허용", body: "빠른 공에 타이밍이 맞았습니다.", tone: "bad",
      stat: { h: 1, er: 1 }, fame: -1, trust: -4, condition: -6 },
  ],
  corner: [
    { id: "kk", good: true, title: "연속 삼진", body: "구석만 찔러 두 타자를 연달아 돌려세웠습니다.", tone: "epic",
      stat: { so: 2 }, fame: 8, trust: 8, condition: 8 },
    { id: "fly_out", good: true, title: "얕은 뜬공 처리", body: "배트 끝에 맞은 타구가 내야를 넘지 못했습니다.", tone: "good",
      stat: {}, fame: 4, trust: 5, condition: 5 },
    { id: "bb_allow", good: false, title: "밀어내기 볼넷", body: "끝내 존에 넣지 못했습니다. 한 점을 내줍니다.", tone: "bad",
      stat: { bb: 1, er: 1 }, fame: -3, trust: -5, condition: -7 },
    { id: "corner_hit", good: false, title: "구석을 노리다 맞았다", body: "가운데로 몰린 공을 놓치지 않았습니다.", tone: "bad",
      stat: { h: 1, er: 1 }, fame: -1, trust: -3, condition: -4 },
  ],
  ground: [
    { id: "dp", good: true, title: "병살타 유도", body: "낮게 떨어진 공, 유격수-2루-1루로 이어졌습니다.", tone: "epic",
      stat: {}, fame: 7, trust: 8, condition: 8 },
    { id: "ground_out", good: true, title: "땅볼로 한 점", body: "아웃은 잡았지만 3루 주자가 홈을 밟았습니다.", tone: "neutral",
      stat: { er: 1 }, fame: 2, trust: 2, condition: 1 },
    { id: "through", good: false, title: "내야 안타", body: "빗맞은 타구가 하필 빈 곳으로 굴러갔습니다.", tone: "bad",
      stat: { h: 1, er: 1 }, fame: -2, trust: -4, condition: -6 },
    { id: "ground_bb", good: false, title: "유인구가 빠졌다", body: "낮게만 던지다 볼넷을 내줬습니다.", tone: "bad",
      stat: { bb: 1 }, fame: -1, trust: -3, condition: -4 },
  ],
};

/* ------------------------------------------------------------------ */

/** 큰 무대의 승부처 — 무대마다 장면이 다르다 */
const STAGE_SCENES: Record<string, Scene[]> = {
  AS: [
    { eyebrow: "올스타전 8회", title: "별들 사이에서", body: "만원 관중과 전국 중계. 이 한 타석이 하이라이트에 남습니다." },
    { eyebrow: "올스타전 9회초 2사", title: "마지막 순간", body: "승부가 팽팽합니다. 오늘의 MVP가 여기서 갈립니다." },
    { eyebrow: "홈런 더비 다음 날", title: "손바닥이 얼얼하다", body: "어제 스무 번을 넘게 휘둘렀습니다. 그래도 타석은 돌아옵니다." },
    { eyebrow: "올스타전 첫 타석", title: "이름을 불러주는 곳", body: "전광판에 내 이름이 크게 떴습니다. 스탠드가 들썩입니다." },
    { eyebrow: "올스타전 대타", title: "이름이 불렸다", body: "감독이 갑자기 호명했습니다. 준비할 시간이 없었습니다." },
    { eyebrow: "팬 투표 1위", title: "뽑아준 사람들 앞에서", body: "최다 득표로 선발 출전합니다." },
    { eyebrow: "올스타전 중반", title: "축제의 한복판", body: "카메라가 계속 돌아갑니다. 관중은 홈런을 기다립니다." },
  ],
  INTL: [
    { eyebrow: "국제대회 결승 8회", title: "태극마크의 무게", body: "온 나라가 지켜보고 있습니다. 여기서 물러설 수 없습니다." },
    { eyebrow: "숙적과의 맞대결", title: "질 수 없는 경기", body: "상대는 늘 우리를 괴롭혀 온 팀입니다." },
    { eyebrow: "조별리그 최종전 6회", title: "이겨야 올라간다", body: "득실차까지 계산이 서 있습니다. 한 점이 아쉽습니다." },
    { eyebrow: "원정 관중 4만 명", title: "야유를 등지고", body: "우리 편은 3루 쪽 한 귀퉁이뿐입니다." },
    { eyebrow: "시차 적응 실패", title: "몸이 아직 한국에 있다", body: "새벽 세 시에 눈이 떠졌습니다. 그래도 경기는 열립니다." },
    { eyebrow: "메이저리거가 즐비한 상대", title: "TV에서 보던 이름들", body: "상대 라인업에 낯익은 이름이 줄지어 있습니다." },
    { eyebrow: "낯선 구장, 낯선 흙", title: "모든 게 조금씩 다르다", body: "발밑의 흙마저 익숙하지 않습니다." },
  ],
  PS: [
    { eyebrow: "한국시리즈 7차전 8회", title: "가을의 주인공", body: "이 한 타석으로 시리즈의 흐름이 정해집니다." },
    { eyebrow: "가을야구 연장 10회초", title: "끝내지 못하면 끝난다", body: "더그아웃의 모두가 일어서 있습니다." },
    { eyebrow: "벼랑 끝 · 2패 뒤 3차전", title: "지면 겨울이다", body: "여기서 지면 올해 가을은 여기서 끝납니다." },
    { eyebrow: "가을야구 첫 타석", title: "10월의 공기", body: "정규시즌과 관중 소리가 다릅니다. 숨이 가쁩니다." },
    { eyebrow: "가을야구 홈경기", title: "우리 구장, 우리 관중", body: "경기 시작 두 시간 전부터 스탠드가 찼습니다." },
    { eyebrow: "길어진 시리즈", title: "양 팀 모두 지쳤다", body: "여러 경기를 치렀습니다. 남은 건 버티는 힘입니다." },
    { eyebrow: "10월의 추운 밤", title: "손이 곱는다", body: "기온이 5도까지 떨어졌습니다." },
  ],
};


/**
 * 투수용 장면.
 *
 * 무대 장면(고교·대학·2군·올스타·국대·가을)을 타자와 투수가 함께 쓰면,
 * 투수에게 "고교 시절의 **한 타석**"이 뜨고 선택지는 "병살을 유도한다"가
 * 된다 — 장면과 선택이 따로 논다. (실제로 겪음)
 * 같은 무대라도 서 있는 자리가 다르므로 문장을 따로 쓴다.
 */
const HS_SCENES_P: Scene[] = [
  { eyebrow: "전국대회 8강 9회말", title: "고교 시절의 마지막 한 구", body: "스탠드에 프로 스카우트들이 앉아 있습니다. 이 한 구가 드래프트를 바꿉니다." },
  { eyebrow: "결승 연장 마운드", title: "3학년의 마지막 여름", body: "지면 여기서 끝입니다. 더 이상 다음이 없습니다." },
  { eyebrow: "지역 예선 결승 등판", title: "전국으로 가는 문", body: "여기서 지면 전국대회 마운드를 밟지 못합니다." },
  { eyebrow: "부모님이 보러 온 날", title: "스탠드의 두 사람", body: "처음으로 경기장에 오셨습니다. 3루 쪽 스탠드에 앉아 계십니다." },
  { eyebrow: "라이벌 학교 4번 타자", title: "3년을 벼른 승부", body: "중학교 때부터 이 타자에게 당해 왔습니다. 마지막 기회입니다." },
  { eyebrow: "지역 라이벌 정기전 선발", title: "학교의 자존심", body: "전교생이 스탠드를 채웠습니다." },
  { eyebrow: "8강이 걸린 마운드", title: "여기서 지면 집에 간다", body: "한 번만 더 이기면 전국 8강입니다." },
  { eyebrow: "폭염 경보 속 결승", title: "쓰러지지만 않으면 된다", body: "체감 38도. 유니폼이 소금으로 하얗습니다." },
  { eyebrow: "이틀 연속 완투 뒤 등판", title: "고교 야구의 여름", body: "어깨가 무겁습니다. 대신 나갈 사람이 없습니다." },
  { eyebrow: "3학년 마지막 홈경기 선발", title: "3년을 보낸 운동장", body: "이 마운드에 서는 건 오늘이 마지막입니다." },
];

const COLLEGE_SCENES_P: Scene[] = [
  { eyebrow: "대학 선수권 준결승", title: "다시 증명할 차례", body: "고교 때 받지 못한 평가를 뒤집을 기회입니다." },
  { eyebrow: "프로 스카우트 앞에서", title: "스피드건이 켜져 있다", body: "이 한 구의 구속으로 지명 순위가 달라집니다." },
  { eyebrow: "4학년 마지막 대회", title: "이번이 아니면 없다", body: "여기서 못 보여주면 지명을 못 받을 수도 있습니다." },
  { eyebrow: "고교 동기와 맞대결", title: "먼저 프로로 간 친구", body: "같이 뛰던 동기는 이미 1군에 있습니다. 오늘 상대는 그 학교입니다." },
  { eyebrow: "전국대회 개막 선발", title: "긴 시즌의 첫 마운드", body: "지난해 우승팀과 맞붙습니다." },
  { eyebrow: "지명 앞둔 마지막 등판", title: "이름을 남겨야 한다", body: "이 대회 성적이 보고서의 마지막 줄이 됩니다." },
  { eyebrow: "대학 리그 라이벌전 선발", title: "매년 지는 상대", body: "3년 동안 한 번도 이겨보지 못했습니다." },
  { eyebrow: "사흘 밀린 경기", title: "기다리다 지쳤다", body: "비 때문에 사흘을 숙소에서 보냈습니다. 감이 걱정입니다." },
  { eyebrow: "대학 대표팀 선발전 마운드", title: "태극마크가 걸렸다", body: "여기서 잘하면 대학 대표로 뽑힙니다." },
  { eyebrow: "연투 뒤 준결승 등판", title: "팔이 남아 있지 않다", body: "사흘 전에도 던졌습니다. 그래도 나가야 합니다." },
];

const MINOR_SCENES_P: Scene[] = [
  { eyebrow: "퓨처스 9회 1점 차", title: "1군이 보고 있다", body: "스카우트와 코칭스태프가 관중석에 앉아 있습니다. 여기서 보여줘야 합니다." },
  { eyebrow: "콜업을 앞둔 등판", title: "마지막 시험대", body: "이 등판 결과로 1군 등록이 갈릴 수 있습니다." },
  { eyebrow: "재활 등판 마지막 날", title: "팔은 다 만들었다", body: "오늘만 무사히 넘기면 1군으로 올라갑니다.", requires: (c) => c.injured },
  { eyebrow: "관중 200명 앞에서", title: "아무도 보지 않아도", body: "빈 스탠드입니다. 그래도 기록은 남습니다." },
  { eyebrow: "강등 첫 등판", title: "내려온 자리에서", body: "어제까지 1군이었습니다. 다시 올라가려면 여기서 시작해야 합니다.", requires: (c) => c.hasKbo },
  { eyebrow: "퓨처스 올스타 선발", title: "2군의 에이스", body: "이 무대에서 잘하면 1군 코칭스태프의 눈에 듭니다." },
  { eyebrow: "퓨처스 연장 10회 마운드", title: "끊어야 집에 간다", body: "긴 원정의 마지막 경기입니다." },
  { eyebrow: "1군에서 내려온 투수와 같은 불펜", title: "나란히 앉은 자리", body: "어제까지 1군에 있던 투수가 옆에 앉아 있습니다." },
  { eyebrow: "퓨처스 시즌 마지막 등판", title: "올해 마지막 기회", body: "이 경기가 끝나면 마무리캠프 명단이 나옵니다." },
  { eyebrow: "비 오는 평일 낮경기", title: "우산 든 관중 서른 명", body: "그래도 기록원은 자리를 지키고 있습니다." },
  { eyebrow: "상무 팀 상대 등판", title: "군복을 입은 옛 동료", body: "같이 뛰던 선수가 상대 타순에 있습니다." },
  { eyebrow: "2군 투수코치 앞에서", title: "보고서에 적힌다", body: "코치가 뒤에서 수첩을 들고 있습니다." },
];

const STAGE_SCENES_P: Record<string, Scene[]> = {
  AS: [
    { eyebrow: "올스타전 8회 등판", title: "별들 사이에서", body: "만원 관중과 전국 중계. 이 한 이닝이 하이라이트에 남습니다." },
    { eyebrow: "올스타전 6회 등판", title: "마운드 위의 축제", body: "타자도 나도 웃고 있습니다. 그래도 승부는 승부입니다." },
    { eyebrow: "상대 홈런왕과 맞대결", title: "피하지 않는다", body: "관중이 원하는 그림입니다. 도망가면 야유가 쏟아집니다." },
    { eyebrow: "올스타전 첫 등판", title: "이름을 불러주는 곳", body: "전광판에 구속이 그대로 뜹니다. 스탠드가 들썩입니다." },
    { eyebrow: "올스타전 갑작스런 호출", title: "이름이 불렸다", body: "불펜 전화가 울렸습니다. 준비할 시간이 없었습니다." },
    { eyebrow: "팬 투표 1위", title: "뽑아준 사람들 앞에서", body: "최다 득표로 마운드에 오릅니다." },
    { eyebrow: "올스타전 중반", title: "축제의 한복판", body: "카메라가 계속 돌아갑니다. 관중은 홈런을 기다립니다." },
  ],
  INTL: [
    { eyebrow: "국제대회 결승 8회", title: "태극마크의 무게", body: "온 나라가 지켜보고 있습니다. 여기서 물러설 수 없습니다." },
    { eyebrow: "숙적의 4번 타자", title: "질 수 없는 승부", body: "상대는 늘 우리를 괴롭혀 온 타자입니다." },
    { eyebrow: "조별리그 최종전 6회", title: "이겨야 올라간다", body: "득실차까지 계산이 서 있습니다. 한 점도 아깝습니다." },
    { eyebrow: "원정 관중 4만 명", title: "야유를 등지고", body: "우리 편은 3루 쪽 한 귀퉁이뿐입니다." },
    { eyebrow: "시차 적응 실패", title: "몸이 아직 한국에 있다", body: "새벽 세 시에 눈이 떠졌습니다. 그래도 경기는 열립니다." },
    { eyebrow: "메이저리거가 즐비한 타선", title: "TV에서 보던 이름들", body: "상대 라인업에 낯익은 이름이 줄지어 있습니다." },
    { eyebrow: "국제 공인구", title: "손에 감기지 않는다", body: "공인구가 다릅니다. 실밥이 낯섭니다." },
  ],
  PS: [
    { eyebrow: "한국시리즈 7차전 8회 마운드", title: "가을의 주인공", body: "이 한 구로 시리즈의 흐름이 정해집니다." },
    { eyebrow: "가을야구 연장 10회초", title: "막지 못하면 끝난다", body: "더그아웃의 모두가 일어서 있습니다." },
    { eyebrow: "벼랑 끝 · 2패 뒤 3차전", title: "지면 겨울이다", body: "여기서 지면 올해 가을은 여기서 끝납니다." },
    { eyebrow: "가을야구 첫 등판", title: "10월의 공기", body: "정규시즌과 관중 소리가 다릅니다. 손끝이 차갑습니다." },
    { eyebrow: "가을야구 홈경기 등판", title: "우리 구장, 우리 관중", body: "경기 시작 두 시간 전부터 스탠드가 찼습니다." },
    { eyebrow: "길어진 시리즈", title: "양 팀 모두 지쳤다", body: "여러 경기를 치렀습니다. 남은 건 버티는 힘입니다." },
    { eyebrow: "10월의 추운 밤", title: "손끝이 곱는다", body: "기온이 5도까지 떨어졌습니다." },
  ],
};

/**
 * 큰 무대에 걸리는 승부처.
 * 리그 경기보다 인지도가 크게 움직인다 — 보는 눈이 다르다.
 */
export function rollStageClutch(
  stage: "AS" | "INTL" | "PS" | "HS" | "COLLEGE", s: GameState, rng: RNG, label: string,
  /** 이 승부처가 걸린 경기의 결과 — 결과 카드가 바로 옆에 붙는 무대에서만 넘긴다 */
  teamWon?: boolean,
): Clutch {
  const hitter = s.player.kind === "HITTER";
  const scene = rng.pick(
    stage === "HS" ? (hitter ? HS_SCENES : HS_SCENES_P)
      : stage === "COLLEGE" ? (hitter ? COLLEGE_SCENES : COLLEGE_SCENES_P)
        : (hitter ? STAGE_SCENES : STAGE_SCENES_P)[stage],
  );
  return {
    monthIndex: -1,
    monthLabel: label,
    eyebrow: scene.eyebrow,
    title: scene.title,
    body: scene.body,
    opponent: stage === "INTL" ? rng.pick(["일본", "대만", "미국", "도미니카", "쿠바"]) : "",
    // 무대 장면은 경기를 끝내는 자리가 아니다 — 승패는 옆 카드가 말한다
    walkoff: false,
    teamWon,
    options: hitter ? hitterOptions(s) : pitcherOptions(s),
  };
}

/**
 * 이번 반기의 승부처.
 * 2군에도 건다 — 콜업이 걸린 경기는 1군 못지않게 무겁다.
 * 다만 무대가 작아 인지도는 덜 움직인다(applyStageScale 참고).
 */
/** 그 달에 이 장면을 써도 되는가 */
function sceneFits(sc: Scene, ctx: SceneContext, when: "OPENER" | "FINALE" | null): boolean {
  if (sc.when && sc.when !== when) return false;
  return !sc.requires || sc.requires(ctx);
}

/**
 * 그 자리에 맞는 장면 하나 — 1군인가 2군인가, 선발인가 불펜인가,
 * 개막인가 최종전인가, 그리고 **그 선수가 실제로 겪은 일인가**.
 * 조건을 다 만족하는 장면이 하나도 없으면 조건 없는 장면 중에서 고른다.
 */
function pickScene(
  hitter: boolean, level: "KBO" | "MINOR", role: string, rng: RNG,
  ctx: SceneContext, when: "OPENER" | "FINALE" | null,
): Scene {
  const pool = level === "MINOR"
    ? (hitter ? MINOR_SCENES : MINOR_SCENES_P)
    : hitter
      ? HIT_SCENES
      : isRotationRole(role) ? PIT_SCENES_SP : PIT_SCENES_RP;
  const fit = pool.filter((sc) => sceneFits(sc, ctx, when));
  return rng.pick(fit.length ? fit : pool.filter((sc) => !sc.when && !sc.requires));
}

/**
 * 장면을 **그 달의 자리에** 다시 맞춘다.
 *
 * 승부처는 반기가 시작될 때 걸어두지만, 그 사이에 콜업·말소·보직 변경이 일어난다.
 * 8월에 1군으로 올라간 선수에게 10월 승부처로 "퓨처스 올스타 선발 · 2군의 간판"이
 * 뜨면, 그 달 기록은 1군인데 장면만 2군에 남아 있는 꼴이 된다. (실제로 겪음)
 * 선발↔불펜도 같다 — 불펜으로 내려온 뒤에 "투구수 118개 · 9회"가 뜨면 안 된다.
 */
export function fitClutchScene(
  c: Clutch, s: GameState, rng: RNG, level: "KBO" | "MINOR", role: string,
  /** 시즌의 첫 달인가 마지막 달인가 — 개막전·최종전 장면은 여기서만 쓴다 */
  when: "OPENER" | "FINALE" | null = null,
): Clutch {
  const scene = pickScene(s.player.kind === "HITTER", level, role, rng, sceneContext(s), when);
  return {
    ...c,
    eyebrow: scene.eyebrow, title: scene.title, body: scene.body,
    walkoff: scene.walkoff ?? false,
  };
}

export function rollClutch(
  s: GameState, rng: RNG, months: readonly { key: string; label: string }[],
  /** `monthAvail`(12개월)에서 이 반기가 시작하는 자리 — 전반기 0, 후반기 5 */
  availOffset = 0,
): Clutch | null {
  if (!s.contract || (s.seasonLevel !== "KBO" && s.seasonLevel !== "MINOR")) return null;
  const hitter = s.player.kind === "HITTER";
  // 장면은 걸어둘 때 한 번 고르고, 심을 때 그 달의 자리로 다시 맞춘다(fitClutchScene)
  const scene = pickScene(hitter, s.seasonLevel, s.seasonRole ?? "", rng, sceneContext(s), null);
  /**
   * **뛰는 달에만 건다.**
   * 달을 먼저 정하고 그 달은 나중에 시뮬레이션되므로, 부상으로 통째로 비는 달을
   * 고르면 "5월 9회말 2사 만루"가 뜨고 5월 출장은 0경기로 찍힌다. (실제로 겪음)
   * 반기가 통째로 비면 이번 반기엔 승부처가 없다.
   */
  const live = months.map((_, i) => i).filter((i) => (s.monthAvail?.[availOffset + i] ?? 1) > 0);
  if (!live.length) return null;
  const mi = rng.pick(live);
  return {
    monthIndex: mi,
    monthLabel: months[mi].label,
    eyebrow: scene.eyebrow,
    title: scene.title,
    body: scene.body,
    opponent: rng.pick(["대구 라이온즈", "광주 타이거즈", "서울 트윈스", "부산 자이언츠", "인천 랜더스", "창원 다이노스"]),
    // 월별 중계에는 경기 결과 카드가 없다 — 장면이 허락하면 끝내기라고 말해도 된다
    walkoff: scene.walkoff ?? false,
    options: hitter ? hitterOptions(s) : pitcherOptions(s),
  };
}

/** 고른 대로 승부한다 */
export function resolveClutch(c: Clutch, optionId: string, s: GameState, rng: RNG): ClutchResult {
  const opt = c.options.find((o) => o.id === optionId) ?? c.options[0];
  const pool = (s.player.kind === "HITTER" ? HIT_POOL : PIT_POOL)[opt.id];
  const good = pool.filter((o) => o.good);
  const bad = pool.filter((o) => !o.good);
  const success = rng.chance(opt.odds);
  const side = success ? good : bad;
  // 같은 성공이라도 능력이 높을수록 더 극적인 쪽이 나온다
  const edge = clamp((overall(s.player) - 74) / 30, 0, 1);
  const outcome = side.length === 1
    ? side[0]
    : rng.chance(0.30 + edge * 0.35) ? side[0] : side[side.length - 1];
  return {
    monthIndex: c.monthIndex, monthLabel: c.monthLabel,
    optionId: opt.id, optionLabel: opt.label,
    // 나오지 않은 결과까지 흐리게 깔아두므로(DrawReveal) 풀도 같이 맞춘다 —
    // 한쪽만 바꾸면 "끝내기 만루홈런"이 목록에만 남는다
    pool: pool.map((o) => fitOutcome(o, c)),
    outcome: fitOutcome(outcome, c),
    success,
  };
}

/**
 * 결과 문구를 그 자리에 맞춘다.
 *
 * 승부처의 결과는 주사위로 뽑지만, **경기의 승패는 이미 정해져 있다**.
 * 둘을 따로 두면 "끝내기 만루홈런" 바로 밑에 "패배 3-7"이 찍힌다. (실제로 겪음)
 * 기록(stat)은 건드리지 않는다 — 바뀌는 건 말뿐이므로 밸런스는 그대로다.
 */
function fitOutcome(o: ClutchOutcome, c: Clutch): ClutchOutcome {
  const alt = c.teamWon === false ? o.inLoss
    : c.teamWon === true ? o.inWin
      : undefined;
  // 경기를 끝낼 수 있는 자리가 아니면 "끝내기"라고 쓰지 않는다
  const fit = alt ?? (c.walkoff ? undefined : o.notWalkoff);
  return fit ? { ...o, title: fit.title, body: fit.body } : o;
}

/** 결과를 그 달 기록에 더한다 */
export function applyClutchToLine(line: StatLine, r: ClutchResult): StatLine {
  const out = { ...line } as StatLine & Record<string, number>;
  for (const [k, v] of Object.entries(r.outcome.stat)) {
    if (typeof out[k] === "number") out[k] += v as number;
  }
  if ((line as HitterLine).pa !== undefined) {
    const h = out as unknown as HitterLine;
    // 타석·타수도 한 번 늘어난다 (볼넷은 타수에 들어가지 않는다)
    h.pa += 1;
    if (!r.outcome.stat.bb) h.ab += 1;
    h.avg = h.ab ? Math.round((h.h / h.ab) * 1000) / 1000 : 0;
    const tb = h.h + h.b2 + h.b3 * 2 + h.hr * 3;
    h.slg = h.ab ? Math.round((tb / h.ab) * 1000) / 1000 : 0;
    h.obp = h.pa ? Math.round(((h.h + h.bb + h.hbp) / h.pa) * 1000) / 1000 : 0;
    h.ops = Math.round((h.obp + h.slg) * 1000) / 1000;
  } else {
    const p = out as unknown as PitcherLine;
    p.ip = Math.round((p.ip + 0.3) * 10) / 10;
    // 자책은 내보낸 주자 수를 넘지 못한다 — "역전 피홈런(3자책)"이 한 경기짜리
    // 줄에 얹히면 주자 없이 3점을 준 기록이 된다 (sim.ts와 같은 규칙)
    p.er = Math.min(p.er, p.h + p.bb);
    p.era = p.ip ? Math.round(((p.er * 9) / p.ip) * 100) / 100 : 0;
    p.whip = p.ip ? Math.round(((p.h + p.bb) / p.ip) * 100) / 100 : 0;
    p.k9 = p.ip ? Math.round(((p.so / p.ip) * 9) * 100) / 100 : 0;
  }
  return out;
}
