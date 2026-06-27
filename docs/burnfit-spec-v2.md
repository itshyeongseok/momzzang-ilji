# BULCUP(벌컵) 2단계 이후 통합 기능 사양서 — v2

> 디자이너 에이전트 산출물. 사용자(고형석) 피드백 반영본.
> 1단계(라이트 테마 + 번핏 골격)는 이미 `app/index.html`에 반영됨 — 4탭(투데이/운동/분석/프로필), 주간 날짜 스트립, 휴식 타이머, 체중 차트, 식단·습관 카드, PR 계산(`allPRs`/`exerciseMaxWeight`)이 동작 중.
> 본 문서는 **2단계부터** 개발자가 순차 PR로 바로 구현할 수 있도록 화면·동작·데이터 모델·구현순서를 구체화한다.
>
> **제약(유지):** 의존성 0 / 빌드 0 (순수 HTML·CSS·JS). 라이트 단일 테마. 모바일(갤럭시 S25, 폭 360~412dp) 한 손 조작. 한국어 UI, 격려 톤.
> **호환:** 기존 `DB`(`KEY='momzzang_v1'`)와 백업 JSON 호환 절대 유지. 새 키는 `load()`의 `Object.assign(structuredClone(DEFAULT), r)` 폴백으로 추가. 기존 필드 형태는 깨지 않고 **옵셔널 추가**만.

---

## 0. 사용자 피드백 요약 (이번 v2가 푸는 문제)

| # | 피드백 | 현재 문제 | v2 해결 |
|---|---|---|---|
| A | "운동 시작/종료가 있었으면" | 날짜에 그냥 세트가 쌓일 뿐, 한 번의 운동(세션) 개념이 없음 | **운동 세션** 객체(시작·종료시각·종목) 도입 |
| B | "신기록 토스트가 아무 때나 뜬다" | `setVal()`이 **무게 입력 즉시** PR 비교 → 과거 기록 수정만 해도 신기록 토스트가 뜸 | PR 토스트는 **세션 활성 중에만(또는 종료 시 정산)** |
| C | "전체 운동 시간을 보고 싶다(번핏처럼)" | 세션·시간 개념 없음 | 세션 시작 시 **경과시간 누적 표시**, 종료 시 소요시간 확정 |
| D | "첫 화면에 월 달력 — 채우는 재미" | 주간 스트립만 있음 | 투데이에 **월 달력**(기록한 날 점/색) |
| E | "운동을 부위별로" | 운동은 자유 텍스트 이름뿐 | **운동 카테고리**(가슴/등/어깨/팔/하체/복근/유산소) + 운동 마스터 `exDB` |
| F | "식단 사진 업로드" | 사진 저장 없음 | 촬영·갤러리 → 압축 → **IndexedDB** 저장 + 시간정보 |
| G | "체중 매일 + 인바디 사진 주 1회" | 체중 수기 입력만 | 체중은 기존 유지 + **인바디 결과 사진**(IndexedDB) |
| H | "추천 기능들" | — | 이전 기록 흐리게 표시 / 세션 요약 카드 / 추정 1RM / 주간 목표 |

> **설계 큰 그림:** 텍스트/숫자 데이터는 계속 `localStorage(DB)`. **이미지(식단·인바디 사진)만 IndexedDB**로 분리(용량 한계 회피). 백업 JSON(`exportData`)은 `DB`만 담으므로 **사진은 별도 백업 흐름**(부록 C). 향후 Supabase Storage 이전 시 IndexedDB 추상화 레이어만 교체.

---

## 1. 운동 세션 (시작 / 종료) — 피드백 A·B·C

### 1-1. 개념 모델

하루(`cur` 날짜)에 **0개 이상의 세션**이 있을 수 있다. 한 세션 = "운동 시작" 눌러 시작해 "운동 종료"로 끝낸 한 번의 운동. 종목·세트는 **세션에 속한다**. 동시에 활성 세션은 **최대 1개**(전역 상태).

> **하위호환 핵심:** 기존 `workouts[date] = [ {name, sets:[...]} ]`(종목 배열)을 깨지 않는다. 세션은 **별도 키 `sessions`** 로 둔다. 운동 기록 화면은 "활성 세션이 있으면 세션의 종목을, 없으면 그날의 종목 배열(레거시/세션 종료분)"을 보여주는 식으로 통합한다. (자세한 통합 규칙은 1-4.)

### 1-2. 화면 / 컴포넌트 (운동 탭 `#workout`)

운동 탭 하단에 **고정 액션바**(번핏식 2-state). `#view` 바깥 고정 레이어(재렌더 생존, CLAUDE.md 준수) — 휴식 타이머 오버레이와 같은 층.

- **시작 전 상태**(활성 세션 없음):
  - 본문: 그날 이미 끝난 세션 요약 카드들(있으면) + 빈/요약.
  - 하단 액션바: `[ + 운동 추가 ]`(sec) `[ 운동 시작 ]`(primary, 풀폭 우선).
  - `운동 시작` 탭 → 새 세션 생성(`startedAt=now`), 화면이 진행 중 상태로 전환.
- **진행 중 상태**(활성 세션 있음):
  - 상단에 **경과시간 바**: `⏱ 운동 시간 12:34`(1초마다 갱신, 번핏식). `#view` 바깥 고정(재렌더 생존).
  - 본문: 세션의 종목 카드들 + 세트 테이블(기존 `.ex`/`.setline` 재사용) + `+ 운동 추가`(점선).
  - 하단 액션바: `[ 휴식 타이머 mm:ss ]`(휴식 중일 때만, 기존 rest-bar와 통합) `[ 운동 종료 ]`(primary).
  - `운동 종료` 탭 → 확인 → `endedAt=now`, **세션 요약 카드 모달**(1-3, 추천 b) 표시 → 활성 세션 해제.

> 경과시간 바는 휴식 타이머 rest-bar와 화면에서 겹치지 않게: 휴식 바는 화면 하단 중앙(기존), 경과시간은 **헤더 아래 sticky 한 줄** 또는 액션바 내부 좌측. 권장: **액션바 좌측에 `운동 시간 12:34` 텍스트**(번핏 동일 레이아웃), 진행 중에만 노출.

### 1-3. 동작 흐름

```
[시작 전] 운동 시작 클릭
  → 새 세션 push: {id, startedAt:Date.now(), endedAt:null, items:[]}
  → activeSessionId = 세션.id (전역 + 저장)
  → 경과시간 타이머 시작(setInterval 1s, #view 밖 텍스트만 갱신)
[진행 중] 종목/세트 입력 → 세션.items 에 기록
  → 무게 입력 시 PR 비교 ON (1-5 참조)
[진행 중] 운동 종료 클릭
  → confirm("운동을 종료할까요?")
  → 세션.endedAt = Date.now(); durationSec = round((endedAt-startedAt)/1000)
  → 종료 정산: 이 세션에서 깬 PR 집계 → 세션 요약 카드 모달(추천 b)
  → activeSessionId = null; 타이머 정지; save(); renderAll()
```

- **앱 재시작/탭 전환 시 활성 세션 복원:** `activeSessionId`는 `DB.settings.activeSessionId`로 저장. 로드 시 해당 세션의 `startedAt` 기준으로 경과시간 이어서 표시(브라우저 종료해도 "시작 시각"으로부터 계산). 단, 너무 오래(예: 8시간) 지난 활성 세션은 로드 시 "운동이 켜진 채로 남아있어요. 종료할까요?" 안내(자동 종료 강요 안 함, 사용자 선택).
- **시작 안 하고 입력하는 경우(레거시 호환):** 사용자가 `운동 시작` 없이 종목을 추가할 수도 있게 허용하되, 그 경우 **암묵 세션 없이 그날 종목 배열에 직접 기록**(= 기존 동작). 이때는 PR 토스트 안 뜸(B 해결). "운동 시작을 누르면 시간이 측정되고 신기록이 표시돼요" 힌트 1줄.

### 1-4. 데이터 모델 (`DB` 변경/추가)

```js
// 신규 키
sessions: {
  'YYYY-MM-DD': [
    {
      id: 's'+ts,            // 고유 id
      startedAt: 1719500000000,  // ms epoch
      endedAt: 1719503600000,    // ms epoch | null(진행 중)
      durationSec: 3600,         // 종료 시 확정(파생값 저장)
      items: [                   // 종목들 (기존 workouts 종목과 동일 형태 + part)
        { name:'벤치프레스', part:'가슴', exId:'ex_bench', memo:'',
          sets:[ {weight:60, reps:10, done:false} ] }
      ],
      prHits: [ {name, kind:'weight'|'volume'|'1rm', value} ]  // 종료 정산 결과(요약카드용)
    }
  ]
}

// settings 추가(폴백 기본값 필수)
settings.activeSessionId : null            // 진행 중 세션 id (없으면 null)
settings.activeSessionDate: null           // 진행 중 세션이 속한 날짜키
```

**기존 `workouts`와의 관계 (마이그레이션·통합 규칙):**
- `workouts[date]`(기존 종목 배열)는 **그대로 둔다**. 신규 데이터는 `sessions`에 쌓이고, 운동 탭/볼륨 집계는 **`sessions[date]`의 모든 종목 + `workouts[date]`(레거시)** 를 합쳐서 본다.
- 헬퍼 `dayExercises(date)` 신설: `[...(workouts[date]||[]), ...flatten(sessions[date]?.map(s=>s.items))]` → 모든 집계(`workoutVolume`, `dayLogged`, PR 계산)는 이 헬퍼를 통해 읽도록 변경. 이렇게 하면 기존 백업(=`workouts`만 있는 JSON)도 그대로 보임.
- `sets[]`에 `done?:bool` 추가(번핏 완료 체크). 없으면 `false` 취급(안전).

**`sets[].weight/reps` 타입 주의:** 현재 코드는 빈 문자열/문자열로도 저장(`{weight:'',reps:''}`). 집계는 모두 `+s.weight||0`로 처리 중이므로 그대로 유지. 신규 코드도 동일 관용 유지.

### 1-5. PR 토스트 문제 해결 (피드백 B — 핵심)

현재 `setVal()`은 무게 입력 즉시 `exerciseMaxWeight` 비교 후 토스트 → **과거 날짜·과거 세트를 수정만 해도** 신기록이 뜸. 수정:

1. **세션 활성 중에만 즉시 토스트.** `setVal()`에서 PR 비교·토스트는 `isSessionActive() && 입력 대상이 활성 세션의 세트일 때만` 실행.
   ```js
   function setVal(...){
     ... 값 저장 ...
     if(isActiveSessionSet(i,j) && +v>0 && +v>exerciseMaxWeight(name, skipSelf)){
       toast('🏆 '+name+' 신기록 '+v+'kg!'); vibrate();
     }
   }
   ```
2. **종료 시 정산(보조).** 세션 종료 시 그 세션 종목들을 과거 전체와 비교해 깬 PR을 모아 **요약 카드에 "🎉 신기록 N개"** 로 표기(추천 b). 즉시 토스트를 못 본 경우의 안전망.
3. 과거 날짜로 이동해 옛 기록을 고치는 경우엔 **세션이 활성이 아니므로 토스트 안 뜸** → 피드백 B 해결.

### 1-6. 라이트 팔레트 적용
- 경과시간 바/액션바: `--surface` 배경 + `--line` 보더, 텍스트 `--text-strong`, 숫자 `tabular-nums`. 진행 중 강조는 `운동 종료` primary 버튼(`--grad-accent`).
- `운동 시작`/`운동 종료` primary = 기존 `.btn`(파랑 그라데이션). `+ 운동 추가` = `.btn.sec`.
- 신기록 토스트는 기존 `.toast`(다크 알약) 재사용.

---

## 2. 전체 운동 시간 (경과시간) — 피드백 C

세션 1-1~1-3에서 다룬 **경과시간 표시**의 세부.

### 2-1. 화면 / 컴포넌트
- 진행 중일 때 액션바 좌측(또는 헤더 하단 sticky)에 `⏱ 운동 시간 {mm:ss}` (1시간 넘으면 `h:mm:ss`).
- `#view` **바깥** 고정 요소의 텍스트만 1초마다 갱신(전체 재렌더 금지 — 휴식 타이머 `showRestBar` 패턴 그대로).

### 2-2. 동작
- 시작: `startedAt` 기록 + `setInterval(updateElapsed, 1000)`.
- 표시값 = `now - startedAt`(저장값 기반 계산이므로 백그라운드 갔다 와도 정확).
- 종료: `durationSec` 확정 저장, 타이머 정지, 요약 카드에 `소요시간 {h:mm:ss}` 표기.
- 휴식 타이머와 독립(휴식은 세트 사이 카운트다운, 경과시간은 세션 전체 누적).

### 2-3. 데이터
- 1-4의 `sessions[].startedAt/endedAt/durationSec` 사용. **추가 키 없음.**

### 2-4. 팔레트
- 시간 텍스트 `--text-strong`, 라벨 `--muted`. 1시간 돌파 등 강조 불필요(담백하게).

---

## 3. 투데이 월 달력 — 피드백 D

### 3-1. 화면 / 컴포넌트 (투데이 `#home`)
주간 스트립(`weekStrip`) **위 또는 대체**로 **월 달력 카드** 추가. 권장: 주간 스트립을 **월 달력으로 승격**(둘 다 두면 중복).

- 카드 헤더: `‹  2026년 6월  ›` (좌우 화살표로 월 이동) + 우측 작게 `오늘` 버튼(이번 달로 복귀).
- 요일 헤더: `일 월 화 수 목 금 토`(일=`--danger` 살짝, 토=`--accent` 살짝, 선택).
- 6주 × 7일 그리드. 각 셀:
  - 날짜 숫자.
  - **기록 표시 점/색**: 운동 기록 있으면 파란 점(`--accent`), 식단 기록 있으면 주황 점(`--warn`), 둘 다면 점 2개 또는 셀 배경 옅은 채움(`--accent-soft`).
  - 오늘 = 파란 원 채움(`--accent`/`--on-accent`). 선택일(`cur`) = 파란 테두리(`box-shadow inset`).
  - 다른 달 날짜(앞뒤 채움)는 `--faint` 흐리게.
- 셀 탭 → `cur` 변경 + `renderAll()`(그날 투데이로). (기존 `goDate(k)` 재사용.)

### 3-2. 동작 / 동기부여
- 월 이동: `homeMonth` 상태(YYYY-MM)로 보는 달 관리. 좌우 화살표로 ±1달. 미래 달도 이동 가능(계획 보기).
- "채우는 재미": 이번 달 **기록한 날 수 / 전체 일수**를 카드 하단에 `이번 달 12일 기록 · 채움률 40%`처럼. 연속일(`streakLabel`)과 함께.
- 점 색 규칙은 `dayLogged` 확장: 운동/식단/습관 각각 판정해 점 색 결정.

### 3-3. 데이터
- **추가 키 없음.** `sessions`+`workouts`(운동), `meals`(식단), `habits`(습관)로 셀 상태 계산.
- `homeMonth`는 UI 상태(저장 불필요, 진입 시 이번 달).

### 3-4. 팔레트
- 셀 그리드: `--surface` 카드 안. 점은 `--accent`(운동)/`--warn`(식단). 오늘 `--accent` 채움. 선택 `inset 0 0 0 2px var(--accent)`. 다른 달 `--faint`. 일요일 숫자 `--danger`.

---

## 4. 운동 카테고리 (부위별 분류 + 운동 마스터) — 피드백 E

### 4-1. 부위 표준값
`가슴 | 등 | 어깨 | 팔 | 하체 | 복근 | 유산소` (번핏 칩과 동일, 순서는 사용 빈도). 칩 색은 부위별 고정 색 매핑(아래 4-5).

### 4-2. 운동 마스터 `exDB`
```js
exDB: [
  { id:'ex_bench', name:'벤치프레스', part:'가슴', unit:'kg', fav:false },
  ...
]
```
- **시드 데이터**(부위별 대표 8~10개, 총 40~60개) 코드에 상수로. 사용자 추가분만 `DB.exDB`에 누적(시드는 코드 상수 + 사용자분 병합).
- 권장 시드 예시:
  - **가슴**: 벤치프레스, 인클라인 벤치프레스, 덤벨 프레스, 체스트 플라이, 딥스, 푸시업
  - **등**: 데드리프트, 랫풀다운, 바벨로우, 시티드로우, 풀업, 티바로우
  - **어깨**: 오버헤드프레스, 사이드 레터럴 레이즈, 페이스풀, 리어델트 플라이, 아놀드 프레스
  - **팔**: 바벨컬, 덤벨컬, 해머컬, 케이블 푸시다운, 라잉 익스텐션, 프리처컬
  - **하체**: 스쿼트, 레그프레스, 레그 익스텐션, 레그 컬, 루마니안 데드리프트, 런지, 카프레이즈
  - **복근**: 크런치, 행잉 레그레이즈, 플랭크, 케이블 크런치
  - **유산소**: 러닝, 사이클, 로잉, 인터벌

### 4-3. 화면 / 컴포넌트

**(a) 운동 추가 흐름 개편** (현재 자유 텍스트 + 흔한 운동 칩 → 부위 기반 선택기):
- `+ 운동 추가` → **운동 선택 시트**(하단 시트, 기존 `openSheet` 재사용):
  - 상단 **부위 필터 칩 가로 스크롤**: `전체 | 가슴 | 등 | 어깨 | 팔 | 하체 | 복근 | 유산소 | ⭐즐겨찾기`.
  - **검색 인풋**(이름 부분일치).
  - 리스트: `{부위 색 원}  {운동명}   ⭐`(즐겨찾기 토글). 탭 → 세션/그날에 종목 추가.
  - 하단 `+ 직접 추가` → 이름 입력 + 부위 선택(드롭다운/칩) → `exDB`에 등록 후 추가.
- 종목 카드 헤더에 **부위 배지**: `{부위} · {운동명}`(번핏 `1 하체 | 레그 컬` 패턴).

**(b) 운동 이름 → 부위 매핑 폴백:** 레거시 `workouts`의 종목은 `part`가 없다. `partOf(name)` 헬퍼: `exDB`에서 이름 매칭 → 있으면 그 `part`, 없으면 `'기타'`. 표시/필터에 사용.

### 4-4. 데이터 모델
```js
exDB: [ {id, name, part, unit:'kg', fav?:bool} ]   // 신규(시드 상수 + 사용자분)
// 종목 객체에 part, exId 추가(옵셔널)
items[]/workouts종목: { name, part?, exId?, memo?, sets:[...] }
```
- 폴백: `part` 없으면 `partOf(name)`으로 추론, 그래도 없으면 `'기타'`. 기존 백업 안전.

### 4-5. 팔레트 (부위 색 매핑)
부위별 점/배지 색(라이트 톤, 채도 낮게):
```css
--part-가슴:#EF4444; --part-등:#3B82F6; --part-어깨:#F59E0B;
--part-팔:#8B5CF6;   --part-하체:#22C55E; --part-복근:#06B6D4; --part-유산소:#EC4899;
```
- 배지는 해당 색 12% 틴트 배경 + 진한 텍스트. 필터칩 선택 시 기존 `.chip.on`(파랑) 또는 부위색 채움 중 택1(권장: 통일감 위해 `.chip.on` 파랑).

---

## 5. 식단 사진 업로드 — 피드백 F

### 5-1. 화면 / 컴포넌트 (식단 카드, 투데이/식단)
- 식단 추가 영역에 **사진 첨부 버튼** 2개: `📷 촬영`(`<input type=file accept="image/*" capture="environment">`) / `🖼 갤러리`(`accept="image/*"`).
- 끼니(아침/점심/저녁/간식) 선택 + 메모 + (선택)칼로리/단백질 + **사진** 한 장(또는 여러 장, MVP는 1장).
- 저장된 식단 항목에 **썸네일** 표시. 탭 → 큰 이미지 + 메모 + 시간.
- 끼니별로 **촬영 시간**(`shotAt`) 표시(`12:30 점심`).

### 5-2. 동작 (촬영 → 압축 → 저장)
```
파일 선택(input change)
  → FileReader / createImageBitmap 로 이미지 로드
  → <canvas> 리사이즈: 최대 변 ~1000px(비율 유지)
  → canvas.toBlob('image/jpeg', 0.7~0.8) → 압축 Blob (목표 ~100~300KB)
  → IndexedDB(store 'photos')에 put: {id, blob, ts, kind:'meal', meta:{date, mealType}}
  → DB.meals[cur][n].photoId = id (참조만 localStorage에)
  → 썸네일은 URL.createObjectURL(blob)로 표시(렌더 시 IndexedDB에서 로드, 캐시)
```
- **압축 파라미터**: 최대 변 1000px, JPEG 품질 0.78. 1000px 초과만 다운스케일(작은 사진은 그대로 재인코딩만).
- **여러 장 확장 여지**: `photoIds:[...]`로 둘 수 있으나 MVP는 단일 `photoId`.
- 삭제 시 IndexedDB 레코드도 삭제(고아 방지).

### 5-3. IndexedDB 설계 (공통 — 식단·인바디 둘 다 사용)
```js
// DB 이름: 'bulcup_media', 버전 1
// objectStore: 'photos', keyPath:'id'
// 인덱스: 'kind', 'ts'
photo = {
  id:    'p'+ts+rand,
  blob:  Blob,            // 압축 JPEG
  ts:    1719500000000,   // 촬영/업로드 시각(ms)
  kind:  'meal'|'inbody', // 용도
  meta:  { date:'YYYY-MM-DD', mealType?:'점심' }  // 분석용 부가정보
}
```
- 얇은 래퍼 `mediaDB`: `putPhoto(obj)`, `getPhoto(id)`, `delPhoto(id)`, `listByKind(kind)`, `objectUrl(id)`(캐시).
- **주간 AI 분석 대비 구조**: `photo.meta`에 `date`/`mealType`, `meals` 항목에 `memo`·`kcal`·`protein`. 향후 주간 분석은 **`meals`(메모/수치) + `photos`(사진 Blob, 끼니/시간)** 를 한 주 단위로 묶어 양·칼로리를 유추 가능. 사진 자체는 Blob이라 분석기에 그대로 전달 가능.

### 5-4. 데이터 모델
```js
// meals 항목에 옵셔널 추가
meals[date][n] = { type, memo, kcal, protein, photoId?, shotAt? }
// 사진 실데이터는 IndexedDB 'photos' store
```
- 폴백: `photoId` 없으면 사진 없는 기존 항목(완전 호환). `shotAt` 없으면 표시 안 함.

### 5-5. 팔레트
- 썸네일 라운드 `--r-field`(12px), 보더 `--line`. 사진 버튼은 `.btn.sec`. 끼니 시간은 `--muted` 12px.

---

## 6. 신체 — 체중 매일 + 인바디 사진 주 1회 — 피드백 G

### 6-1. 화면 / 컴포넌트 (신체/프로필)
- **체중**: 기존 `body[{date,weight,muscle,fat}]` + 입력 폼 + 추이 차트 **그대로 유지**(매일 기록 권장 카피 추가: "매일 같은 시간에 재면 추이가 정확해요").
- **인바디 결과 사진**: 신체 카드 하단에 별도 섹션 `📋 인바디 결과`:
  - `📷 인바디 사진 추가`(촬영/갤러리, 5-2와 동일 압축·IndexedDB 흐름, `kind:'inbody'`).
  - 업로드한 인바디 사진을 **날짜순 썸네일 가로 스크롤**(탭 → 확대). "주 1회" 권장이지만 강제 안 함.
  - 가장 최근 인바디 사진을 신체 카드 상단에 1장 미리보기(선택).

### 6-2. 동작
- 5-2의 압축·저장 파이프라인 재사용(`kind:'inbody'`, `meta:{date}`).
- 인바디 사진 참조는 `DB.body` 항목에 붙이거나(권장) 독립 리스트:
  - 권장: `body` 항목에 `inbodyPhotoId?` 추가 → 그날 체중과 함께 묶임. 체중 없이 사진만이면 `body`에 `{date, inbodyPhotoId}` 항목 생성(weight 등 null 허용 — 기존 `metricBox`가 null 처리함).

### 6-3. 데이터 모델
```js
body[i] = { date, weight, muscle, fat, inbodyPhotoId? }   // 옵셔널 추가
// 사진 실데이터는 IndexedDB(kind:'inbody')
```
- 폴백: `inbodyPhotoId` 없으면 사진 없는 기존 체중 기록(완전 호환).

### 6-4. 팔레트
- 인바디 썸네일 `--r-card` 라운드. 섹션 제목 H2. 추이 차트는 기존 `drawChart` 그대로(체중 파랑/체지방 주황).

---

## 7. 추천 기능 — 피드백 H

### 7-a. 세트 입력 시 '이전 기록' 흐리게 표시 (점진적 과부하)

**화면:** 세트행에서 무게/횟수 인풋의 **placeholder 또는 우측 고스트 텍스트**로 "지난 기록"을 흐리게(`--faint`). 예: 인풋 placeholder가 빈 칸이면 `60`(지난 무게), 그 옆에 작게 `지난주 60kg×10`.

**동작:** 같은 운동(`name`/`exId`)의 **직전 세션(또는 직전 날짜)** 같은 세트 번호 기록을 찾아 표시. 입력 시작하면 고스트 사라짐. 값 미입력 후 완료 체크하면 고스트값을 채워 넣을지(선택) — MVP는 표시만.

**데이터:** 추가 없음. `lastWorkoutBefore`/세션 역탐색으로 계산. 헬퍼 `prevSetFor(name, setIndex)`.

**팔레트:** 고스트 `--faint`, 12px.

### 7-b. 운동 종료 시 세션 요약 카드

**화면:** `운동 종료` → 모달/시트로 **요약 카드**:
- `오늘의 운동 💪`
- `N종목 · 총 M세트`
- `총 볼륨 {kg} kg ({톤}t)`
- `소요시간 {h:mm:ss}`
- `🎉 신기록 K개`(있으면 종목명 나열, 1-5의 `prHits`)
- 부위별 미니 분포(있으면): `가슴 40% · 등 35% · ...`
- 버튼: `[ 확인 ]`(닫기) / `[ 공유용 캡처 ]`(선택, 후순위).

**동작:** 세션 종료 정산에서 계산. 닫으면 시작 전 상태로.

**데이터:** `sessions[].durationSec`, `prHits`, items로 계산. 추가 키 없음.

**팔레트:** 카드 `--surface`, 신기록 `--warn`/🎉, 볼륨 큰 숫자 Display, 부위 분포는 부위색.

### 7-c. 추정 1RM (Epley) — 종목별

**공식:** `1RM ≈ weight × (1 + reps/30)` (Epley). reps=1이면 weight 그대로.

**화면:**
- 프로필 **3대 중량(1RM)** 카드(번핏): `TOTAL {합} kg` + 스쿼트/벤치/데드 각 추정 1RM. `ⓘ` 탭 시 "기록 기반 추정치(Epley)" 설명.
- 종목 카드/개인 최고기록 옆에 `est 1RM {값}kg` 작게(선택).

**동작:** 각 종목의 모든 세트에서 `epley(weight,reps)` 최댓값. 3대는 이름 매칭(스쿼트/벤치프레스/데드리프트, 부분일치). 헬퍼 `est1RM(name)`, `bigThree()`.

**데이터:** 추가 없음. `workouts`/`sessions` 계산.

**팔레트:** TOTAL Display 굵게, 보조 `--muted`.

### 7-d. 주간 목표 횟수 + 달력 연계

**화면:**
- 설정(프로필/메뉴 시트)에서 **주간 목표 N회**(기본 4) 설정.
- 투데이 월 달력 카드 또는 별도 미니 카드: `이번 주 목표 4회 중 3회` + 진행 바(3/4) + 남은 횟수 격려("한 번만 더!").
- 달력에서 이번 주 7칸을 묶어 진행 강조(선택).

**동작:** 이번 주(일~토) 운동한 날 수 / 목표. 달성 시 🎉 토스트·배지.

**데이터:**
```js
settings.goalPerWeek : 4   // 폴백 기본 4
```

**팔레트:** 진행 바 `--accent`, 트랙 `--surface3`. 달성 `--good`.

---

## 8. 데이터 모델 — v2 통합 요약

### 8-1. 변경/추가 한눈에 (전부 옵셔널·폴백 보장)

```js
const DEFAULT = {
  workouts:{}, meals:{}, habits:{}, body:[], habitDefs:[...], settings:{},
  // ── v2 신규 ──
  sessions:{},                 // {date:[{id,startedAt,endedAt,durationSec,items,prHits}]}
  exDB:[],                     // 사용자 추가 운동(시드는 코드 상수와 병합)
};
// settings 신규 키(폴백 기본값)
settings.activeSessionId   = null;   // 진행 중 세션
settings.activeSessionDate = null;
settings.goalPerWeek       = 4;      // 주간 목표
// 기존 항목 옵셔널 확장
sets[]:  { weight, reps, done?:false }
items[]/workouts종목: { name, part?, exId?, memo?, sets:[...] }
meals[]: { type, memo, kcal, protein, photoId?, shotAt? }
body[]:  { date, weight, muscle, fat, inbodyPhotoId? }
```

### 8-2. IndexedDB (이미지 전용, `DB` 밖)
```
DB명 'bulcup_media' v1 / store 'photos'(keyPath id, index kind·ts)
photo = { id, blob(JPEG), ts, kind:'meal'|'inbody', meta:{date, mealType?} }
```

### 8-3. 호환·마이그레이션 원칙 (CLAUDE.md 준수)
- `load()`의 `Object.assign(structuredClone(DEFAULT), r)`로 새 키 자동 폴백 → **기존 백업 JSON 그대로 동작.**
- 모든 집계는 `dayExercises(date)`(=`workouts` + `sessions`)를 통해 읽어 레거시·신규 동시 지원.
- `done`/`part`/`photoId`/`inbodyPhotoId`/`shotAt`는 없으면 기본 취급(미완료/추론/사진없음).
- `exportData`는 `DB`(JSON)만 백업 → **사진은 IndexedDB라 미포함.** 부록 C의 사진 백업 흐름을 별도 제공(또는 "사진은 폰 교체 시 사라질 수 있어요" 명시).
- **수정 주의(회귀):** 현재 `setVal()`의 즉시 PR 토스트는 1-5대로 "세션 활성 + 활성 세트"로 게이팅. 이게 v2의 첫 PR에서 반드시 반영돼야 피드백 B가 풀림.

---

## 9. 구현 우선순위 — 순차 PR 분할 (2단계부터)

> 원칙: 각 PR은 독립 배포 가능 + 스모크 테스트 추가(CLAUDE.md). 사진/IndexedDB는 인프라가 무거우니 **한 묶음**으로. 세션은 PR B의 토스트 문제를 같이 푸므로 가장 먼저.

| PR | 제목 | 범위 | 의존 | 검증(스모크) |
|---|---|---|---|---|
| **PR2** | 운동 세션 + 경과시간 + PR 토스트 게이팅 | `sessions` 모델, `운동 시작/종료` 액션바 2-state, 경과시간 표시(#view 밖), `dayExercises` 통합 헬퍼, **PR 토스트를 세션 활성 시에만**(피드백 B 해결) | — | 세션 생성→종목추가→종료로 durationSec 확정; 과거 세트 수정 시 토스트 안 뜸; 활성 중 신무게 입력 시 토스트 뜸 |
| **PR3** | 운동 종료 요약 카드 + 추정 1RM | 종료 정산(prHits·볼륨·시간·부위분포) 요약 모달(추천 b), `est1RM`/`bigThree`(추천 c), 프로필 3대중량 카드 | PR2 | 종료 시 요약값 정확; Epley 계산 단언; 3대 합 표시 |
| **PR4** | 운동 카테고리 + 운동 마스터 라이브러리 | `exDB` 시드, 운동 선택 시트(부위칩·검색·즐겨찾기·직접추가), 종목 부위 배지, `partOf` 폴백, '이전 기록' 고스트(추천 a) | PR2 | 부위 필터·검색 동작; 레거시 종목 part 추론; 고스트값 직전기록과 일치 |
| **PR5** | 투데이 월 달력 + 주간 목표 | 월 달력 카드(점/색·월이동·채움률), 주간 목표 `goalPerWeek` 진행(추천 d), 주간 스트립→달력 승격 | PR2(세션날짜 점) | 기록일 점 표시; 월 이동; 목표 진행률 3/4 단언 |
| **PR6** | 이미지 인프라(IndexedDB) + 식단 사진 | `mediaDB` 래퍼(put/get/del/objectUrl), canvas 압축(≤1000px·JPEG .78), 식단 사진 첨부·썸네일·시간(피드백 F) | —(독립 인프라) | 압축 후 크기 감소; put→get 라운드트립; meals.photoId 참조·삭제 시 고아 제거 |
| **PR7** | 인바디 사진 + 신체 보강 | 인바디 사진 업로드(`kind:'inbody'`), 썸네일 추이, `body.inbodyPhotoId`, 매일 체중 카피 | PR6 | inbody 사진 저장·표시; body 항목 연결 |
| **PR8**(선택) | 사진 포함 백업/복원 + 다듬기 | 사진까지 내보내기/가져오기(부록 C), 부위별 볼륨 분석 보강, 캘린더-분석 연계 | PR3·6 | 사진 백업 왕복; 분석 집계 |

**현실적 묶음 근거:**
- **세션·토스트·시간(PR2)**: 피드백 B가 가장 거슬리는 버그라 최우선. 시간·세션은 한 덩어리(분리 시 어정쩡).
- **요약·1RM(PR3)**: 세션 종료 직후 보여줄 가치 + 추정치는 같은 집계 기반 → 묶음.
- **카테고리·라이브러리·고스트(PR4)**: `exDB`가 부위·이전기록·라이브러리의 공통 기반 → 한 PR.
- **달력·주간목표(PR5)**: 동기부여 묶음. 둘 다 "기록일 집계"가 데이터원이라 함께.
- **IndexedDB·식단사진(PR6)**: 이미지 인프라가 무거워 독립. 식단 사진까지 한 PR로(인프라만 따로 빼면 검증할 화면이 없음).
- **인바디(PR7)**: PR6 인프라 재사용이라 얇음.
- **사진 백업(PR8)**: 선택. 데이터 유실 방지 가치 있으나 후순위.

---

## 부록 A — 핵심 헬퍼 시그니처(개발 참고)
```js
dayExercises(date)        // workouts[date] + sessions[date].items 평탄화
isSessionActive()         // settings.activeSessionId != null
activeSession()           // 현재 활성 세션 객체 | null
startSession() / endSession()
elapsedSec()              // now - activeSession.startedAt
partOf(name)              // exDB 매칭 → part | '기타'
prevSetFor(name, idx)     // 직전 세션 같은 세트 {weight,reps} | null
epley(w,r) => w*(1+r/30); est1RM(name); bigThree()
sessionSummary(session)   // {nEx,nSets,volume,durationSec,prHits,partDist}
goalProgress()            // {goal, done}  (이번 주)
// mediaDB
mediaDB.putPhoto / getPhoto / delPhoto / listByKind / objectUrl
compressImage(file, max=1000, q=0.78) => Promise<Blob>
```

## 부록 B — 번핏 대비 의도적 차이(철학 유지)
- 계정/서버/커뮤니티/실시간 AI 없음. "주간 AI 분석"은 **데이터 구조만 미리 설계**(사진+메모+시간) — 실제 호출은 향후 백엔드.
- 텍스트=localStorage, 이미지=IndexedDB, 향후 Supabase Storage 이전 시 `mediaDB`만 교체.
- 라이트 단일 테마 유지.

## 부록 C — 사진 백업 메모(PR8 후순위)
- `exportData`는 `DB`만 → 사진 별도. 옵션: (1) IndexedDB 전체를 Blob→base64로 직렬화해 별도 `.json`/`.zip`(용량 큼, 경고), (2) "사진은 백업 안 됨" 명시 + 향후 Supabase 이전 권장. MVP는 (2) 안내 + PR8에서 (1) 선택 제공.
