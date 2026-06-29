# 운동 타입 사양서 — 보조(어시스트) 무게 운동 + 유산소

작성: designer 에이전트 / 대상: 개발자(바로 구현 가능 수준) / 코드 작성 금지·git 금지

---

## 0. 배경 & 문제 정의

고형석이 주로 하는 운동 중 기존 `weight × reps` 볼륨 모델에 안 맞는 두 종류가 있다.

1. **어시스트(보조) 무게 운동** — 어시스트 풀업(등), 어시스트 딥스(가슴).
   - 머신이 체중을 *보조*하므로 입력 무게는 "들어올린 무게"가 아니라 "빼준 무게"다.
   - 즉 `40kg 입력 = 실제로는 -40kg(보조 40kg)`. 보조량이 **적을수록 강해진 것(성장)**.
   - 따라서 일반 운동과 정반대: **무게가 낮을수록 좋은 기록**, 볼륨에 그대로 넣으면 의미가 깨진다(보조량이 많은 약한 날이 "볼륨 높음"으로 잡힘).

2. **유산소(천국의계단 = 스텝밀/스테어클라이머)** — `weight × reps` 자체가 없음. 시간 기록이 자연스럽다.

핵심 결정 사항: 데이터 모델에 **타입 플래그**를 두고, 볼륨·PR·1RM·인사이트·코치 패널이 모두 이 플래그로 분기한다.

---

## 1. 데이터 모델

### 1.1 타입 플래그를 어디에 둘까 — **운동 마스터(`exDB`/`EX_SEED`) 기준** (결정)

운동의 성격(보조형인지, 유산소인지)은 **종목 고유 속성**이지 그날그날 바뀌지 않는다. 따라서:

- 마스터 운동 객체(`{id, name, part, fav}`)에 선택적 플래그를 추가한다.
  - `assist:true` — 보조형(입력 무게 = 보조량, 낮을수록 좋음)
  - `cardio:true` — 유산소(시간 기록형, 볼륨/PR 제외)
- 플래그가 없으면(기존 운동 전부) **일반 근력 운동**으로 동작 — 100% 하위호환.

대안(종목 인스턴스 `DB.workouts[date][i]`에 플래그 저장)은 채택하지 않음. 이유: 같은 종목을 매번 같은 타입으로 쓰므로 인스턴스마다 저장하면 중복·불일치 위험. 단, **인스턴스에도 캐시로 복사**해 둔다(아래 1.3) — 마스터가 나중에 바뀌어도 과거 기록 해석이 흔들리지 않게.

### 1.2 시드 추가 (`EX_SEED`)

기존 시드 배열에 항목을 추가한다. 시드는 `[part, [names...]]` → flatMap 구조라, **플래그가 있는 종목은 시드 빌더를 확장**해야 한다. 권장: 시드 정의를 객체 허용 형태로 바꾼다(이름 문자열 또는 `{name, assist?, cardio?}`).

추가할 종목:

| 이름 | 부위 | 플래그 |
|---|---|---|
| 어시스트 풀업 | 등 | `assist:true` |
| 어시스트 딥스 | 가슴 | `assist:true` |
| 천국의계단 | 유산소 | `cardio:true` |

> 참고: 기존 유산소 시드(러닝/사이클/로잉/인터벌)에도 `cardio:true`를 부여하는 것을 권장(현재는 부위만 '유산소'고 플래그 없음). 이렇게 하면 유산소 처리가 부위 문자열 비교가 아니라 플래그 기반으로 일관됨. **단 이건 선택**(2번 PR로 미뤄도 됨) — 최소 변경은 천국의계단만.

### 1.3 인스턴스 캐시 — `quickEx`/`addExToRoutine`에서 플래그 복사

현재 `quickEx(name,part)`는 인스턴스에 `name, part, sets`만 저장한다. 여기에 마스터의 플래그를 복사한다.

```
DB.workouts[cur].push({
  name,
  part: part||partOf(name),
  assist: exAssist(name) || undefined,   // true일 때만 필드 존재(백업 슬림 유지)
  cardio: exCardio(name) || undefined,
  sets: [...]
});
```

- 새 헬퍼: `exAssist(name)`, `exCardio(name)` — `allEx().find(...)`로 마스터 플래그 조회(폴백 false). `partOf`와 동일 패턴.
- **`undefined`면 JSON.stringify 시 필드가 빠진다** → 일반 운동 기록은 바이트·구조 변화 없음(백업 호환).
- 루틴 항목(`routine.items`)에도 같은 방식으로 플래그를 담아 불러올 때 보존.

### 1.4 백업 호환 체크리스트

- 기존 백업 import 시: 플래그 없는 운동 = 일반 운동(정상). 깨짐 없음.
- 모든 신규 헬퍼는 "플래그 없으면 false" 폴백.
- `assist`/`cardio` 필드는 **true일 때만** 저장(falsy면 생략).

---

## 2. 입력 / 표시

### 2.1 저장 형식 — **양수 저장 + `assist` 플래그** (결정, 음수 저장 안 함)

입력칸엔 사용자가 보는 그대로 **양수(보조량) 그대로 저장**한다. `s.weight = 40` (= 보조 40kg).

근거(음수 저장 대비 장점):
- 입력 UX가 자연스럽다(머신 표시값 그대로 = 40 입력).
- 음수 저장은 `+s.weight||0`, placeholder, 정렬, 기존 PR 계산 등 곳곳에서 부호 사고가 난다.
- 백업에 음수가 들어가면 외부에서 데이터 볼 때 혼란. 양수+플래그가 자기설명적.
- "낮을수록 좋다"는 **계산 분기**로 처리하면 되지, 저장값을 뒤집을 필요 없음.

### 2.2 입력 UI (운동 탭 세트라인)

assist 운동의 세트라인 무게 입력은 시각적으로 "보조"임을 명확히 한다.

- 컬럼 헤더: 일반은 `무게(kg)`, **assist는 `보조(kg)`** 로 라벨 변경.
- 입력값 옆/아래에 보조 표기: 사용자가 `40` 입력 시 **`-40kg (보조)`** 로 보조 의미 표시.
  - 구현 권장: 세트 고스트 라인(`.set-ghost` 재사용 패턴) 또는 입력 우측 작은 `set-unit`에 `보조` 고정 + 종목 헤드에 안내.
  - 최소안: 종목 헤드 배지 옆에 `🅰 보조` 칩 하나 + 무게 헤더 라벨 `보조(kg)`. 이것만으로 충분히 명확.
- 종목 헤드 `🏆best` 표기: assist는 **🏆 최저 보조 = best**로 의미가 바뀜(3·4절). 표기를 `🏆 보조 28kg (최저)` 식으로.

cardio 운동(천국의계단)의 세트라인은 무게/횟수 대신 **시간(분)** 한 칸(5절).

### 2.3 표시 규칙 요약

| 컨텍스트 | 일반 | assist | cardio |
|---|---|---|---|
| 무게 컬럼 라벨 | 무게(kg) | 보조(kg) | (숨김) |
| 값 표시 | `40kg` | `-40kg (보조)` 또는 `보조 40kg` | `25분` |
| best 배지 | 🏆 최고 무게 | 🏆 최저 보조 | (없음) |

---

## 3. 볼륨 계산

### 3.1 결정 — assist·cardio 세트는 **총 볼륨에서 제외** (별도 집계는 분석에서 선택)

`workoutVolume(list)`가 핵심. 현재:

```
v += (+s.weight||0) * (+s.reps||0)
```

assist를 그대로 넣으면 "보조 많이 받은 날 = 볼륨 큼" 역설이 생기고, cardio는 reps가 0이라 어차피 0. 따라서:

- **`workoutVolume`에서 `ex.assist`이거나 `ex.cardio`인 종목은 스킵**한다.
  - 판정: 인스턴스 플래그 우선, 없으면 `exAssist(ex.name)/exCardio(ex.name)` 폴백(과거 기록 보호).
- 결과: 홈/운동 탭 상단 "볼륨 N kg"은 순수 근력 볼륨만 → 의미 일관.

### 3.2 인사이트 부위별 볼륨 (`sessionPartStats`, `partVolume`)

- 두 함수의 누적 루프에서도 **assist/cardio 종목 스킵**(볼륨에 0 기여).
  - `sessionPartStats`: `out[key].volume` 누적 시 assist/cardio 제외. `out[key].sets`는 **세트 수는 세도 됨**(운동을 안 한 건 아니므로) — 단, 부위 피로도 맵(`fatigueIntensity`)은 volume 기반이라 assist 부위가 0으로 잡힘. 허용 가능(보조 운동은 볼륨 지표로 안 잡는 게 맞음). 더 정확히 하려면 4.3의 "보조 운동 별도 집계"를 인사이트에 노출.
  - `partVolume(weeks)`: 동일하게 assist/cardio 제외.
- **권장 추가(선택, 2번 PR)**: 인사이트에 "보조 운동 진행" 별도 줄 — assist 종목은 볼륨 대신 **"최저 보조량 갱신 여부"**로 한 줄 표시(예: `어시스트 풀업 보조 -2kg ↓ 성장!`).

### 3.3 estimateCalories

`estimateCalories(durationSec, volume)`는 volume 기반이라 assist/cardio 볼륨이 0이면 시간분만 반영됨 → 큰 문제 없음(유산소·보조는 시간으로 칼로리 잡힘). 변경 불필요.

---

## 4. 개인기록(PR) / 1RM

### 4.1 assist: "최저 보조량 = 최고기록" (min), Epley 미적용

assist는 무게가 낮을수록 강함. 따라서:

- **PR 정의 = 그 종목 전체 세트 중 무게(보조량)의 최솟값**(단, `weight>0`인 세트만; 0/빈값 제외).
- Epley 1RM 적용 안 함(보조량의 1RM은 무의미).

### 4.2 함수별 분기

| 함수 | 일반 동작 | assist 분기 | cardio 분기 |
|---|---|---|---|
| `exerciseMaxWeight(name,skip)` | max(weight) | **min(weight)** (>0) | 0 반환(무게 개념 없음) |
| `allPRs()` | name→max weight | name→**min weight**(>0), 표기 라벨 다름 | **제외**(목록에 안 넣음) |
| `est1RM(name)` | Epley max | **0 반환**(미적용) | 0 |
| `bigThree()` | 변화 없음 | 해당 없음(3대엔 assist 종목 없음) | 변화 없음 |
| `sessionPRHits(sid)` | weight 갱신=상회 | **보조량이 과거 최저보다 낮으면** 신기록 | 제외 |

구현 패턴(권장): 종목 타입 판정 헬퍼 하나로 분기.

```
function exKind(name){            // 'assist' | 'cardio' | 'normal'
  const e = allEx().find(x=>x.name===name);
  if(e&&e.cardio) return 'cardio';
  if(e&&e.assist) return 'assist';
  return 'normal';
}
```

- `exerciseMaxWeight`: cardio면 0; assist면 `min(weight where weight>0)`(없으면 0); 그 외 기존 max.
  - 주의: 현재 `viewWorkout`에서 `best>0`일 때만 🏆 표기 → assist도 min>0이면 표기되니 호환. 단 라벨을 "최저 보조"로(2.2).
- `setVal`의 신기록 토스트: assist면 `w < 현재최저` 일 때 `🏆 보조 줄임! Nkg`. cardio면 토스트 없음.
- `allPRs`: assist 항목은 `{name, assist:true, weight:min, reps, date}` 로 담고, 렌더에서 `보조 28kg (최저)` 표기. cardio는 스킵.

### 4.3 보조 운동 성장 표현(권장)

assist의 "성장"은 보조량 **감소**다. 인사이트/PR 토스트의 화살표·색을 일반과 반대로:

- 일반: 무게 ▲ = 좋음(`--good`).
- assist: 보조 ▼ = 좋음(`--good`), ▲ = 나쁨(`--danger`). (현재 체중 delta 로직처럼 부호 반전.)

---

## 5. 유산소(천국의계단) 처리

### 5.1 결정 — 세트 대신 **시간(분) 1칸 기록**, 볼륨/PR/1RM 전부 제외

cardio 종목의 세트 데이터는 `{min, done, sid}` 형태로 단순화. (기존 `weight/reps` 칸을 시간 칸으로 대체.)

- 저장: `s.min`(분, 숫자). `weight/reps`는 저장 안 함(또는 빈값) → 볼륨 0, PR 제외라 안전.
- 입력 UI: cardio 종목 세트라인은 **`시간(분)` 입력 1칸 + 완료 체크**. 무게/횟수 칸 숨김.
  - `.setline` 그리드(`26px 1fr 1fr 36px auto`)를 cardio용으로 변형(시간 1칸 넓게). 최소 변경: 무게칸=분, 횟수칸 숨김/비활성.
- 표시: `천국의계단 25분`.

### 5.2 인사이트/볼륨/기록에서의 위치

- 볼륨: 제외(3절).
- PR/1RM: 제외(4절).
- 부위별: '유산소'로 분류되되 volume 0 → 피로도 맵엔 약하게/안 잡힘(허용).
- **권장**: 인사이트·세션 요약에 "유산소 N분" 별도 줄(시간 합산). assist와 함께 "근력 외 활동" 섹션으로 묶으면 깔끔.
- 천국의계단은 인터벌 타이머(기존 `iv-bar`)와 자연스럽게 연계 — 별도 작업 불필요, 안내만.

### 5.3 추정 칼로리

cardio durationSec(=분×60)을 세션 시간에 이미 포함되면 `estimateCalories`의 byTime에 반영됨. 별도 cardio 칼로리식은 과설계 — 추가 안 함.

---

## 6. 코치 패널 연계

`assist`/`cardio` 플래그가 **데이터(인스턴스·마스터)에 영구적으로 남으므로**, 코치 에이전트(특히 `coach-strength`)가 운동 데이터를 읽을 때 정확히 해석할 수 있다. 코치 패널이 알아야 할 규칙을 데이터·문서로 보장:

1. **assist 종목**: 무게 = 보조량(양수 저장). 코치는 "보조량 **감소** = 점진적 과부하(성장)"으로 해석해야 한다. 무게 증가를 후퇴로 읽어야 함. → 보조량 추세는 **반대 방향**으로 평가.
2. **cardio 종목**: 볼륨/1RM 지표에서 제외. 시간(분) 추세로만 평가(유산소 지속시간↑ = 개선).
3. **부위 균형 분석**: assist 풀업(등)/딥스(가슴)은 볼륨이 0으로 집계되므로, 코치가 "등/가슴 볼륨 부족"으로 **오진하지 않도록** 보조 운동 수행을 별도 신호로 인지해야 한다(세트 수·보조량 추세 참조).
4. **데이터 스키마 문서화**: `docs/coach-panel.md`(또는 coach-strength.md)에 본 사양의 플래그 의미 요약을 한 줄 추가 권장 — "운동 인스턴스에 `assist`/`cardio` 플래그가 있으면 무게 해석/지표 포함 규칙이 다름(이 문서 참조)."

> 추가 코드 변경 없음. 플래그가 데이터에 남는 것만으로 코치가 읽을 수 있음. 단 코치 프롬프트(.md)에 해석 규칙 한 줄 추가가 정확도에 결정적.

---

## 7. 구현 PR 분할안 + 검증

헤드리스 스모크 테스트 한계: `let DB`/`cur`는 vm 밖 노출 안 됨 → 상태는 `localStorage` 재읽기 또는 DOM으로 관찰. `function` 선언만 호출 가능(`workoutVolume`, `exerciseMaxWeight`, `allPRs`, `est1RM`, `quickEx`, `partOf` 등은 호출 가능). 시각 미리보기(preview)는 timeout → 의존 금지.

### PR #1 — 데이터 모델 + 계산 분기 (핵심, 비-UI 위주)

범위:
- `EX_SEED` 확장(어시스트 풀업/딥스/천국의계단 + 플래그). 시드 빌더를 `{name,assist,cardio}` 허용으로.
- 헬퍼 추가: `exAssist`/`exCardio`/`exKind`.
- `quickEx`/루틴 담기에서 플래그 인스턴스 복사.
- `workoutVolume`, `partVolume`, `sessionPartStats`에서 assist/cardio 볼륨 제외.
- `exerciseMaxWeight`(assist=min, cardio=0), `allPRs`(assist=min·표기, cardio 제외), `est1RM`(assist/cardio=0), `sessionPRHits`(assist=보조 감소, cardio 제외).

검증(스모크, 전부 통과 후 PR):
- `quickEx('어시스트 풀업','등')` 호출 → `localStorage`의 인스턴스에 `assist:true` 존재.
- `workoutVolume([{name:'어시스트 풀업',assist:true,sets:[{weight:40,reps:8}]}])` === 0.
- `workoutVolume`이 일반+assist 혼합에서 일반분만 합산.
- `exerciseMaxWeight('어시스트 풀업')` = 입력 중 **최솟값**(여러 날 40/35/45 입력 시 35).
- `est1RM('어시스트 풀업')` === 0.
- `allPRs()`에 cardio 종목 미포함, assist 종목은 min weight로 등장.
- 기존 일반 운동 회귀: `workoutVolume`/`exerciseMaxWeight`/`allPRs` 기존 값 불변(플래그 없는 데이터).
- 백업 호환: 플래그 없는 기존 JSON load 후 위 함수들 정상.

### PR #2 — 입력/표시 UI + 인사이트 표현 (시각, 스모크는 DOM 관찰)

범위:
- 세트라인 라벨/표시: assist=`보조(kg)`·`-Nkg (보조)`·🏆 최저 보조; cardio=`시간(분)` 1칸.
- assist 성장 화살표 부호 반전(보조 ▼=good), `setVal` 토스트 분기.
- 인사이트/세션 요약에 "보조 운동·유산소" 별도 줄(시간 합산, 보조량 추세).
- (선택) 기존 유산소 시드에 `cardio:true` 일괄 부여.
- (선택) 코치 .md에 플래그 해석 규칙 한 줄.

검증(스모크는 한계 → DOM·textContent로 관찰):
- `viewWorkout()` 결과 HTML에 assist 종목일 때 `보조` 문자열·cardio일 때 `분` 칸 존재 확인(문자열 단언).
- `setVal` 분기는 토스트 호출 여부를 DOM(`#toast` textContent)로 관찰.
- 시각 정렬·레이아웃은 헤드리스로 확인 불가 → **수동 확인 항목**으로 PR 본문에 명시(폰 실기기/브라우저).

> 현실적으로 PR #1만으로도 "보조·유산소가 지표를 오염시키지 않음"이라는 핵심 가치가 달성됨. PR #2는 UX 완성도. 둘로 나누면 #1의 순수 함수 회귀를 깨끗이 검증 가능.

---

## 8. 라이트/모바일/한국어 UI 메모

- 신규 칩/배지는 기존 토큰 사용: `--part-등`(#3B82F6)·`--part-가슴`(#EF4444)·`--part-유산소`(#EC4899), 성장 good=`#22C55E`, 후퇴 danger=`#EF4444`.
- 보조 칩: `🅰 보조` — `.pill`/`.chip` 스타일 재사용, 배경 `color-mix(--part-{part} 14% white)` (기존 `partBadge` 패턴).
- 카피(격려 톤): "보조 줄였어요! 💪", "보조 -2kg, 성장 중", "천국의계단 25분 완주 🔥".
- 한 손 입력 유지: cardio 시간칸은 `inputmode="numeric"`, assist 보조칸은 `inputmode="decimal"`.
