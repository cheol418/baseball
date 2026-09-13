# 이번 생은 야구다 (SLB) — 프로젝트 컨텍스트

KBO 배경의 **야구선수 커리어 시뮬레이션** 웹게임. 고교 3학년부터 드래프트·프로·FA·은퇴까지.
참고 사이트 `slbcareer.com`에서 출발했지만 시뮬레이션 깊이는 그쪽보다 훨씬 앞서 있다.

```bash
npm run dev     # http://localhost:3000
npm run build   # 타입체크 포함
npm run lint
```

## 작업할 때 반드시 지킬 것

### 1. 밸런스를 바꾸면 반드시 측정한다
숫자를 눈대중으로 고치지 않는다. `scripts/`에 검증 스크립트가 갖춰져 있다.

```bash
npx tsx scripts/audit.ts      # ★ 288개 커리어 전 경로 스트레스 테스트 (필수)
npx tsx scripts/balance.ts    # 유형별 커리어 분포·나이별 OVR
npx tsx scripts/debut.ts      # 고졸/대졸 1군 데뷔·주전 정착 나이
npx tsx scripts/features.ts   # 이벤트 체인·목표·대기록 발생률
npx tsx scripts/war.ts        # WAR가 세이버메트릭스 표준식과 맞는지
npx tsx scripts/training.ts   # 훈련 선택지별 성장량 비교
npx tsx scripts/hellcheck.ts  # 지옥 훈련이 항상 최고인지 (1500건 전수)
```

**`audit.ts`는 어떤 변경 후에도 돌린다.** 예외 0 · 무한정지 0 · 이상값 0 · 전 단계 도달이 기준선이다.

### 2. 스케일을 건드리면 기준선을 전부 같이 옮긴다
능력치는 **0~120** 스케일이고 리그 평균은 `LEAGUE_AVG_ABILITY = 70.5` (`rng.ts`).
능력치 분포를 바꾸면 아래를 **함께** 옮겨야 리그 성적이 인플레되지 않는다.

- `rng.ts` — `LEAGUE_AVG_ABILITY`, `n50()`
- `player.ts` — `gradeOf()` 등급 문턱
- `career.ts` — `assignRole()`의 `bar`, `shouldForceRetire()`의 `releaseBar`, `marketValue()`, `makeTransferTargets()`
- `national.ts` — 대회별 `bar`
- `sim.ts` — `LEVEL_ADJ`
- `amateur.ts` — `FIELD_LEVEL`

과거에 이걸 빠뜨려서 리그 타율이 .293까지 뛰고 대표팀이 한 번도 안 뽑히는 버그가 각각 있었다.

### 3. 새 phase·action을 만들면 스크립트도 가르친다
`scripts/autoplay.ts`와 `scripts/audit.ts`의 switch에 추가하지 않으면
자동 플레이가 `default: RETIRE`로 빠져 **측정값이 전부 거짓이 된다.** (실제로 겪음)

### 4. 세이브 마이그레이션
`GameState`에 필드를 추가하면 **반드시** `src/lib/migrate.ts`에 기본값을 넣는다.
저장소 경계(`storage.ts`)에서 한 번 통과시키므로 여기만 지키면 구버전 세이브가 산다.

### 5. UI 스케일
능력치 막대는 `ABILITY_MAX(120)` 기준으로 그린다. 0~100 기준으로 그리면
98이 꽉 찬 것처럼 보여 "상한이 99인가?"라는 오해가 생긴다. (실제로 겪음)

## 구조

게임 로직(`src/lib/`)은 React에 의존하지 않는 순수 TypeScript다.

| 파일 | 역할 |
|---|---|
| `types.ts` | 전역 타입. `GameState`가 세이브 한 덩어리 |
| `rng.ts` | 시드 난수(mulberry32) + `LEAGUE_AVG_ABILITY` |
| `player.ts` | 생성·유형·특성·투구폼·에이징·성장·훈련·스카우팅 |
| `sim.ts` | 시즌 시뮬레이션(타자/투수), 올스타전, 수상 판정 |
| `career.ts` | **상태 머신** `advance(state, action)` — 가장 큰 파일 |
| `events.ts` | 이벤트 체인 (선택 → 1~2시즌 뒤 결과) |
| `records.ts` | 구단 목표·대기록·통산 이정표·역대 순위·별명 |
| `amateur.ts` | 고교·대학 전국대회 |
| `national.ts` | 국제대회·대표팀·병역 |
| `postseason.ts` | 가을야구 |
| `flavor.ts` | 시즌 총평 헤드라인, 팬 반응 |
| `migrate.ts` | 구버전 세이브 → 현재 구조 |
| `storage.ts` | localStorage + `useSyncExternalStore` |

UI는 `src/app/page.tsx`(홈) · `create/page.tsx`(4단계 생성) · `play/[id]/page.tsx`(본편 4탭) ·
`components/broadcast.tsx`(월별 중계 연출).

## 시즌 흐름

```
고교 3학년 → 진로(드래프트/대학 2년×2) → 신인 드래프트
  ┌─────────────────── 매 시즌 ───────────────────┐
  [입영 통지] → 스프링캠프(훈련) → [대표팀 발탁]
    → 전반기(월별) → 올스타 브레이크 [+올스타전 +국제대회 +트레이드]
    → 후반기(월별) → 가을야구 → 시즌 총평
    → [커리어 갈림길] → 연봉협상 or FA → 스토브리그(이적 신청)
  └───────────────────────────────────────────────┘
                    → 은퇴 → 명예의 전당
```

전반기·후반기는 **월 단위로 따로 시뮬레이션**하고, 월말마다 콜업·강등을 판정한다.

## 현재 밸런스 기준선 (2026-09-13)

| 항목 | 값 |
|---|---|
| 드래프트 OVR | 고졸 47 / 대졸 58 |
| 1군 데뷔 | 고졸 20.5~21.7세 (2군 1.6~2.7시즌) / 대졸 22.3세 |
| 주전 정착 | 22~25세 |
| 전성기 OVR | 79~82 (27~29세) |
| 은퇴 | 평균 36~37세, 1군 14~15시즌 |
| 리그 타율 | .270~.310 |
| 커리어당 | 올스타 4회 · 국가대표 3.6회 · 대기록 0.7회 · 통산 이정표 7.8회 |
| 병역 | 국제대회 면제 33~43% / 나머지 복무 |
| 최고 연봉 | 평균 13억 (비FA 상한 15억 / 리그 상한 30억) |

## 문서

- `README.md` — 게임 시스템 설명 (플레이어·개발자용)
- `docs/HISTORY.md` — 개발 이력, 결정 이유, 발견한 버그
