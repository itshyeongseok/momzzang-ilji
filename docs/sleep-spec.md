# 수면 별도 관리 + 수면 이미지 분석 — 기능 사양서

> 디자이너 산출물. 대상: BULCUP(몸짱일지) PWA. 1인 사용(고형석), 갤럭시 S25(안드로이드 크롬), 라이트 테마, 순수 HTML/CSS/JS(의존성0/빌드0), 모바일 한국어.
>
> 배경: 고형석은 갤럭시 수면 앱(갤럭시 핏)에서 **총수면·렘수면·깊은수면 분석 이미지**를 얻어 구글포토로 공유함. 이걸 BULCUP에 업로드해 **주간 코치(coach-doctor 회복/피로, coach-head 종합)**가 **회복·근합성·체지방** 관점으로 분석에 쓰고 싶어함. 수면을 현재 **습관(`sleep` habitDef)에서 분리해 독립 관리**하길 원함.
>
> 핵심 결정 요약: **새 하단 탭은 만들지 않는다(4탭 유지).** 수면은 **투데이 카드(빠른 입력) + 프로필 탭의 전용 섹션(상세/목록/이미지)** 이중 배치. 데이터는 `DB.sleep` 배열 신설(백업 호환 폴백). 이미지는 **기존 사진 인프라(IndexedDB `bulcup_media` + Supabase Storage `photos` 버킷)를 `kind:'sleep'` 으로 그대로 재사용.** 기존 `sleep` habitDef는 **1회 마이그레이션으로 이관 + 폴백**으로 제거.

---

## 0. 현재 코드와의 정합(읽은 것 요약)

- 탭은 4개: `투데이(home)` / `운동(workout)` / `분석(stats)` / `프로필(me)` (`index.html` `#nav`).
- `renderAll()`이 `#view.innerHTML`를 통째로 다시 그림. 타이머 등은 `#view` 밖 고정 오버레이.
- 사진 인프라가 이미 완성돼 있음:
  - `compressImage()`(긴 변 `PHOTO_MAX=1000`px, JPEG `0.78`) → `savePhoto(kind,date,file)` → 항상 `idbPut(meta.id, blob)`(IndexedDB `bulcup_media`/store `blobs`), 로그인 시에만 `SYNC.uploadPhoto`로 Storage 업로드.
  - 표시: `hydratePhotos()`가 `img[data-photo]`를 비동기로 채움. 캐시 미스 시 `SYNC.signedUrl`로 fetch 후 캐시.
  - `viewPhoto(id,path)` 전체화면 뷰어(시트 재사용).
  - `kind`는 현재 `'meal'|'body'` 두 종류로 쓰임(신체: `pickBodyPhoto`/`addBody`/`delBody`가 레퍼런스 패턴).
  - **주의(서버 측 제약):** `docs/supabase-plan.md` 3절 `media` 테이블의 `check (kind in ('meal','body'))` 제약과, `SYNC.uploadPhoto` 경로 `<uid>/<kind>/<date>/<key>.jpg`. `kind:'sleep'`를 쓰려면 **이 CHECK 제약을 `('meal','body','sleep')`로 확장**해야 함(서버 SQL 1줄, 형석님 수동 또는 마이그레이션). 비로그인/로컬 전용에서는 IndexedDB만 쓰므로 제약과 무관하게 즉시 동작.
- 습관 현재 기본값: `{id:'sleep', name:'수면', type:'num', unit:'시간', step:0.5, icon:'😴'}` (`DEFAULT.habitDefs[0]`). `viewHabit()`이 `DB.habitDefs`를 순회해 렌더, 값은 `DB.habits[date]['sleep']`(숫자)에 저장됨.
- `load()`는 `Object.assign(structuredClone(DEFAULT), 저장값)` → **DEFAULT에 `sleep:[]`만 추가하면 기존 백업에도 자동으로 빈 배열이 생겨 폴백 안전.**

---

## 1. 배치 / UX

### 1.1 배치 원칙
- **하단 탭 추가 금지.** 수면은 회복 맥락이라 신체와 가까움 → **프로필(me) 탭에 "전용 섹션"**, 빠른 입력은 **투데이(home)에 컴팩트 카드**.
- 운동/식단/신체와 동일한 카드 톤·간격·버튼 스타일을 그대로 따른다(아래 2절 매핑, 4절 팔레트).

### 1.2 투데이(home) — "오늘 수면" 컴팩트 카드
- 위치: `viewHome()`의 `viewTodayWeight()` **바로 아래**(체중 다음 줄에 회복 지표가 자연스럽게 옴). 즉 `viewWeeklyGoal()+viewTodayWeight()+viewTodaySleep()+viewCalendar()` 순.
- 레이아웃(체중 카드와 동형, `오늘 체중` 카드 재현):
  - 제목: `😴 오늘 수면` + 기록돼 있으면 `<span class="tag">기록됨</span>`.
  - 한 줄: 총수면 시간 숫자 입력(`inputmode="decimal"`, placeholder `오늘 잔 시간 (h)`) + 우측 `저장`/`수정` 버튼.
  - 보조 문구(muted 12px): 기록 없으면 `숫자만 입력하면 오늘 수면으로 기록돼요.`, 있으면 `오늘 <b>7.5h</b> · 렘/깊은잠은 아래 '수면 분석 이미지'로 남겨요.`
  - 하단에 작은 텍스트 링크(underline, muted 13px): `수면 분석 이미지 추가 →` → **프로필 탭의 수면 섹션으로 이동**(`setTab('me')` 후 해당 섹션으로 스크롤; 스크롤은 `location.hash` 또는 `scrollIntoView`).
- 의도: 매일 총수면 시간 1초 입력(체중처럼 가볍게). 이미지/세부는 프로필에서.

### 1.3 프로필(me) — "수면" 전용 섹션
- 위치: `viewMe()`의 `🧍 최근 신체 정보` 카드 **다음**(회복 맥락 인접), `viewSleep()` 추가. 즉 프로필 = 헤더 → 신체정보 → **수면** → 3대중량 → PR → 클라우드 → 백업.
- 섹션은 3개 카드로 구성:

  **카드 A — 최근 수면 요약**
  - 제목: `😴 최근 수면 <span class="tag">최근 7일 평균</span>`
  - 기록 없으면 empty 상태: `.empty` 패턴 + 아이콘 `😴` + `수면 시간을 기록하면 회복 추세가 나타나요.`
  - 기록 있으면 `grid3`(신체정보 카드와 동일 `metricBox` 톤):
    - `총수면` 최근 7일 평균(h)
    - `렘수면` 최근 7일 평균(h, 입력된 날만 평균; 없으면 `—`)
    - `깊은잠` 최근 7일 평균(h, 동일)
  - 아래 작은 7일 막대/도트(선택, ROI 낮음 → PR-3): 날짜별 총수면 높이 막대. 초기엔 생략 가능.

  **카드 B — 수면 기록 입력**
  - 제목: `수면 기록`
  - 필드:
    - `날짜` `<input type="date" id="slDate" value="${cur}">`
    - `grid3`: `총수면(h)` / `렘(h)` / `깊은잠(h)` 모두 `type="number" inputmode="decimal"` placeholder `0` (세 칸 모두 선택 입력).
    - `메모`(선택) `<input type="text" id="slMemo" placeholder="예: 새벽에 한 번 깸">`
    - **수면 분석 이미지**(핵심): 숨김 파일 input + 버튼(1.4 참조).
    - `+ 저장` 버튼.
  - 검증: 날짜 + (총수면/렘/깊은잠/이미지 중 하나 이상) 없으면 토스트 `값이나 이미지를 하나 이상 입력해주세요`(신체 `addBody`와 동일 정책).
  - 같은 날짜 재저장 시 **갱신**(`addBody`와 동일: 기존 레코드 있으면 입력된 필드만 덮어쓰기, 이미지 있으면 교체).

  **카드 C — 수면 기록 목록**
  - 제목: `수면 기록 목록`
  - 행(최신순): `<b>날짜</b> 총수면 7.5h · 렘 1.5h · 깊은 1.2h` + 메모(있으면 회색 작게) + **썸네일**(`.thumb`, 신체와 동일, 탭하면 `viewPhoto`) + `✕` 삭제 버튼.
  - 이미지가 회복 분석의 1차 소스이므로 썸네일을 눈에 띄게(있으면 작은 `📷` 배지 또는 썸네일 자체).

### 1.4 이미지 추가 UI(투데이/프로필 공통)
- 신체 인바디(`bodyPhoto`) 패턴 재사용하되 **`capture` 속성 제거**:
  ```
  <input type="file" id="sleepPhoto" accept="image/*" style="display:none" onchange="pickSleepPhoto(this)">
  ```
- 버튼: `📷 수면 분석 이미지` + 선택됨 표시(`사진 1장 선택됨`).
- **`capture="environment"` 를 넣지 않는 게 핵심.** 갤럭시 크롬에서 `accept="image/*"`만 있으면 선택창이 **카메라 + 갤러리 + 구글포토(앱 소스)**를 모두 노출 → 구글포토로 공유받은 수면 분석 캡처를 바로 선택 가능.
  - (참고: 신체 인바디 카드는 `capture="environment"`라 카메라로 바로 감 — 그건 즉석 촬영 의도. 수면은 **갤러리/구글포토 선택이 주목적**이라 `capture` 없음이 맞음. 신체 카드는 이번 작업에서 건드리지 않음.)

---

## 2. 데이터 모델

### 2.1 신규 컬렉션 `DB.sleep`
```
sleep: [
  {
    date:  'YYYY-MM-DD',   // 키. 하루 1레코드(같은 날 재저장 시 갱신)
    hours: 7.5 | null,     // 총수면(시간, 소수 허용)
    rem:   1.5 | null,     // 렘수면(시간) — 갤럭시 이미지에서 수동 전사(선택)
    deep:  1.2 | null,     // 깊은수면(시간) — 동일(선택)
    memo:  '...' | null,   // 선택
    photo: {id, kind:'sleep', date, w, h, bytes, path?} | null  // savePhoto 가 반환하는 메타(신체 photo 필드와 동일 구조)
  },
  ...
]
```
- 단위는 **시간(h)**으로 통일(기존 습관 `sleep` unit이 '시간'이라 사용자 멘탈모델 일치). 렘/깊은잠을 분으로 입력하고 싶을 수 있으나, 단일 단위가 단순 → 시간(소수) 유지. (라벨에 `(h)` 명시.)
- 정렬·조회는 `body` 배열과 동일 패턴(`[...DB.sleep].sort(...)`, `DB.sleep.find(s=>s.date===date)`).

### 2.2 DEFAULT 추가 + 백업 폴백
- `DEFAULT`에 `sleep:[]` 한 줄 추가. `load()`의 `Object.assign(structuredClone(DEFAULT), 저장값)` 덕분에 **기존 백업(`sleep` 없는 JSON)도 자동으로 `sleep:[]`** 가짐 → 폴백 보장.
- `applyRemoteState()`도 동일 `Object.assign(DEFAULT, data)` → 클라우드 pull 시에도 안전.

### 2.3 이미지 = 기존 사진 인프라 재사용(`kind:'sleep'`)
- 저장: `await savePhoto('sleep', date, file)` — 코드 변경 없이 그대로 동작(`buildPhotoMeta(kind,...)`가 kind를 그대로 메타에 넣고, `idbPut`은 kind 무관, 경로는 `<uid>/sleep/<date>/<key>.jpg`).
- 표시: 신체와 동일하게 `<img class="thumb" data-photo="${id}" data-path="${path||''}" ...>` + `hydratePhotos()`.
- 삭제: `delSleep(i)`에서 `if(rec.photo)idbDel(rec.photo.id)` (신체 `delBody` 동일).
- **서버 측 1줄 변경 필요(로그인 사용자 한정):** `media` 테이블 CHECK를
  `kind text not null check (kind in ('meal','body','sleep'))`
  로 확장. 미적용 시 로그인 상태의 `SYNC.uploadPhoto` INSERT가 CHECK 위반으로 실패하지만 — `savePhoto`가 업로드 실패를 `try/catch`로 흡수하고 **로컬 IndexedDB 사본은 보존**하므로 앱은 안 죽음(이미지가 그 기기에서만 보일 뿐). 따라서 CHECK 확장은 "클라우드 동기화/주간 코치까지 쓰려면 필수, 로컬만이면 선택".
- Storage RLS(`<uid>/...` 폴더 단위)는 kind와 무관하게 그대로 적용됨(추가 정책 불필요).

---

## 3. 사진 가져오기(구글포토 포함)

- 안드로이드 크롬에서 `<input type="file" accept="image/*">`(capture 없음)을 탭하면 OS가 **사진 선택기**를 띄우고, 여기서 **카메라/갤러리(사진)/구글포토** 등 등록된 이미지 소스를 모두 보여준다 → 구글포토로 공유받은 갤럭시 수면 분석 캡처를 선택 가능.
- 선택된 파일은 기존 `compressImage()`를 거쳐 긴 변 1000px/JPEG 0.78로 압축됨. **수면 분석 이미지는 텍스트(시간 수치)가 작을 수 있음** → 가독성 위해 이 케이스만 **긴 변 1280px, 품질 0.82** 권장(선택 인자).
  - 구현 옵션: `savePhoto`에 압축 옵션을 넘기거나, 수면 전용으로 `compressImage(file, 1280, 0.82)`를 먼저 호출. **과설계 피하려면** 우선 기존 기본값(1000/0.78) 그대로 쓰고, 실사용에서 글자 안 보이면 그때 1280으로 올리는 것을 권장(YAGNI).
- 여러 장(총수면/렘/깊은잠이 별 이미지일 수 있음): MVP는 **1장**(가장 종합적인 한 장). 다장 첨부는 ROI 낮음 → 후순위(아래 6절 PR-3 선택).

---

## 4. 습관에서 분리(마이그레이션 + 중복 방지)

목표: `viewHabit()`/`weekHabitGrid()`에 `수면`이 더 이상 안 나오게 하되, **기존에 습관으로 기록한 수면 시간(`DB.habits[date]['sleep']`)을 잃지 않게** `DB.sleep`로 이관.

### 4.1 1회 마이그레이션(앱 시작 시, 멱등)
- 시점: 앱 초기화(`load()` 직후, 첫 `renderAll()` 전). `settings.sleepMigrated` 플래그로 1회만.
- 절차(의사 흐름, 코드는 개발자가 작성):
  1. `if(DB.settings.sleepMigrated) return;`
  2. `DB.habits`의 각 날짜에서 `habits[date].sleep`(숫자)이 있으면:
     - `DB.sleep`에 같은 날짜 레코드 없으면 `{date, hours:값, rem:null, deep:null, memo:null, photo:null}` push.
     - 같은 날짜 레코드 있으면 `hours`가 비어있을 때만 채움(이미지 먼저 저장된 경우 보호).
     - 이관 후 `delete DB.habits[date].sleep` (중복 입력 방지). 그 날짜 객체가 비면 `delete DB.habits[date]`(기존 `cleanHabit` 정책과 일치).
  3. `DB.habitDefs`에서 `id==='sleep'` 항목 제거(`splice`). → `viewHabit`/주간 그리드에서 사라짐.
  4. `DB.settings.sleepMigrated = true;` → `save();`
- **DEFAULT에서도 `sleep` habitDef 제거**: 신규 사용자/리셋 시 처음부터 수면이 습관에 없게. (`DEFAULT.habitDefs`의 첫 원소 삭제.)
- 멱등성: 플래그로 재실행 방지. 단 사용자가 마이그레이션 후 새 폰에서 **옛 백업(JSON)을 import**하면 그 백업엔 `sleepMigrated`가 없어 다시 1회 돌게 됨 → 정상(그 백업의 습관 수면도 이관됨). `importData`가 `load`/`save` 경로를 타면 동일 마이그레이션 함수를 한 번 더 호출하도록 훅.

### 4.2 중복 입력 방지
- 마이그레이션이 `habitDefs`에서 `sleep`을 제거하므로 습관 화면엔 수면 입력 UI가 없음 → 사용자가 두 곳에 못 넣음.
- 혹시 옛 백업 import 등으로 `habitDefs`에 `sleep`이 되살아나도, 마이그레이션이 import 시 다시 돌며 제거.
- 습관 편집 시트(`openHabitEditor`)에서 사용자가 수동으로 `수면`이라는 습관을 또 만들 수는 있음(자유 텍스트) — 막지 않음(과설계). 안내 문구로 충분: 수면 섹션 카드 B 하단에 muted 11px `수면은 여기서 따로 관리해요(습관 목록엔 없음).`

### 4.3 안 깨지는 것 확인
- `weekHabitGrid()`는 `DB.habitDefs.filter(type==='check')`만 그림 → 수면(num)은 원래 그리드에 없었음. 분리해도 그리드 영향 0.
- 다른 `num` 습관(물 등)은 그대로 유지.

---

## 5. 주간 코치 연계

### 5.1 데이터 통로
- **로컬/백업 경로(현재):** 수면이 `DB.sleep`에 들어가므로 **백업 JSON 내보내기(`exportData`)에 자동 포함** → 형석님이 코치 패널 돌릴 때 그대로 읽힘(추가 작업 0). 이미지는 백업 JSON엔 메타(id/path)만 들어감(바이너리는 IndexedDB/Storage).
- **Supabase 경로(자동화):**
  - 수치(`hours/rem/deep/memo`)는 `app_state.data` jsonb에 `DB.sleep`로 통째 동기화됨(2.2절 LWW). 별도 테이블 불필요.
  - 이미지는 `media`(kind='sleep') + Storage `<uid>/sleep/<date>/<key>.jpg`. 주간 루틴(service_role)이 지난 7일 `media where kind='sleep'`를 조회 → signed URL로 다운로드해 멀티모달로 코치에게 전달.

### 5.2 코치 패널이 보는 관점(이미지 + 수치)
- **coach-doctor(회복/피로):** 이미 "수면(습관 데이터)"를 회복 기반으로 본다고 명시됨 → 데이터 출처를 **`DB.sleep`(시간) + 수면 분석 이미지(렘/깊은잠 분포)**로 갱신. 부족한 깊은잠/렘, 짧은 총수면 → 과사용·회복부족 신호로 해석, 점진성/휴식 권고.
- **coach-head(종합):** 입력 데이터에 "수면(시간·렘·깊은잠·이미지)" 포함. 종합 진단/처방에 회복 축을 명시(예: "깊은잠 1h 미만 지속 → 고볼륨 하체 다음날 휴식 권장").
- **근합성/체지방 연결 서술(리포트 톤):** 수면(특히 깊은잠)은 성장호르몬·단백질 합성·식욕호르몬과 연관 → 코치가 "수면 부족 주에는 근합성·체지방 관리가 불리"라는 웰니스 가이드(진단 아님) 제공. coach-nutrition과 교차(수면 짧은 주 단백질·취침 전 식사 조정 제안).
- **안전:** coach-panel 원칙대로 의학 진단 단정 금지. 이미지에서 읽은 수치는 "사용자가 올린 갤럭시 측정치"로 취급(코치가 직접 진단하지 않음).

### 5.3 (선택) 앱 표시
- 자동화(reports) 단계에서 분석 탭의 "이번 주 코치" 섹션이 수면 관련 처방을 포함(별도 UI 변경 없음 — reports는 마크다운 통째 렌더).

---

## 6. 구현 PR 분할안(순차) + 검증

> 전제: 라이트 팔레트·기존 카드/버튼 클래스 재사용. 헤드리스 스모크는 vm + DOM/idb 스텁(CLAUDE.md). **실 네트워크·Storage·signed URL·구글포토 선택창·실제 이미지 인코딩은 헤드리스로 못 탐 → 폰 수동 검증**으로 분리(각 PR 본문 명시).

### PR-1 — 데이터 모델 + 습관 분리(마이그레이션)
- 범위: `DEFAULT.sleep=[]` 추가, `DEFAULT.habitDefs`에서 `sleep` 제거, 멱등 마이그레이션 함수(`migrateSleep()`) + `settings.sleepMigrated`, init/`importData`에서 호출.
- 검증(헤드리스 가능):
  - 스모크: `habits['2026-06-20']={sleep:8, water:2}` 세팅 후 `migrateSleep()` → `DB.sleep`에 `{date:'2026-06-20',hours:8,...}` 존재, `habits['2026-06-20'].sleep` 없음, `water` 보존, `habitDefs`에 `sleep` 없음, `settings.sleepMigrated===true`. 두 번 호출해도 결과 불변(멱등).
  - 폴백: `sleep` 없는 옛 백업 import → `DB.sleep` 빈 배열로 생성, 앱 안 깨짐.
  - 상태 관찰은 localStorage 재읽기/DOM으로(let DB 미노출 — CLAUDE.md).
- 사용자 영향: 이 PR만으로 UI 변화는 습관 화면에서 수면이 사라지는 것(데이터는 보존).

### PR-2 — 수면 입력 UI(투데이 카드 + 프로필 섹션, 이미지 제외)
- 범위: `viewTodaySleep()`(투데이), `viewSleep()`(프로필 카드 A/B/C, 이미지 자리는 비활성 placeholder), `saveTodaySleep()`, `addSleep()`, `delSleep()`, 최근 7일 평균 계산(순수 함수). `viewHome`/`viewMe`에 끼워넣기. `setTab('me')` 후 섹션 스크롤 링크.
- 검증(헤드리스 가능):
  - 순수 함수: 평균 계산(입력된 날만 평균, 없으면 null), 같은 날 갱신 로직, 검증(빈 입력 토스트).
  - DOM 스텁으로 `saveTodaySleep`→ `DB.sleep`에 레코드, `delSleep`→ 삭제 확인.
- 폰 수동: 투데이/프로필 카드 표시·간격·라이트 팔레트 육안 확인(preview_screenshot은 이 환경 timeout → 의존 금지).

### PR-3 — 수면 이미지(기존 인프라 재사용)
- 범위: `sleepPhoto` 파일 input(`accept="image/*"`, capture 없음), `pickSleepPhoto()`, `addSleep`/`saveTodaySleep`에서 `savePhoto('sleep',date,file)` 연결, 목록 썸네일 + `viewPhoto`, `delSleep`에서 `idbDel`. 압축은 기본값 유지(필요 시 1280/0.82).
- 서버(형석님 수동, 코드 아님): `media` CHECK 제약을 `('meal','body','sleep')`로 확장(미적용이면 로그인 업로드만 실패, 로컬은 정상 — PR 본문에 명시).
- 검증:
  - 헤드리스: `savePhoto`가 `kind:'sleep'` 메타 반환(idb 스텁 put 호출 확인), `delSleep`가 `idbDel` 호출. 압축 함수는 기존 스모크 재사용.
  - 폰 수동: 파일 버튼 탭 → **구글포토/갤러리 선택창 노출** 확인, 선택 → 압축·저장 → 목록 썸네일 표시 → 앱 재진입 시 IndexedDB 캐시로 즉시 표시(네트워크 0). 로그인 시 Storage 업로드 + 다른 기기 표시(서명 URL). 구글포토/네트워크 의존은 헤드리스 불가.

### PR-4(선택) — 코치/표시 보강
- 범위: coach-doctor·coach-head 에이전트 md의 "수면" 출처를 `DB.sleep`+이미지로 갱신(문서), 주간 루틴이 `media kind='sleep'`를 수집하도록 안내(문서/로컬 스크립트, public repo 밖). 앱 측은 reports 렌더 그대로라 코드 변경 최소.
- 검증: 문서 변경 위주. 자동화는 로컬 1회 실행으로 reports에 수면 언급 포함 확인.

### 공통 헤드리스 한계(각 PR 본문에 명시)
- 실 이미지 디코드/canvas 인코딩, IndexedDB(브라우저), Storage 업로드/signed URL, 구글포토 선택창, magic-link/세션 → **헤드리스 스모크 불가.** 자동 단언은 "순수 함수 + DOM/idb 스텁 동작 + 미설정(supa=null) 경로 보존"으로 한정, 나머지는 폰 수동.

---

## 7. 라이트 팔레트 / 타이포 / 간격(재사용)

신규 색 없음. 기존 `:root` 변수 그대로 사용.

| 용도 | 변수 | hex |
|---|---|---|
| 배경 | `--bg` | `#F2F4F7` |
| 카드 표면 | `--surface` | `#FFFFFF` |
| 보조 표면 | `--surface2` | `#F7F8FA` |
| 라인 | `--line` | `#E5E8EE` |
| 본문 텍스트 | `--text` | `#1F2937` |
| 강조 텍스트 | `--text-strong` | `#111827` |
| 보조 텍스트 | `--muted` | `#6B7280` |
| 강조(액션·총수면) | `--accent` | `#3B82F6` |
| 강조 진하게 | `--accent-strong` | `#2563EB` |
| 강조 배경(아바타·뱃지) | `--accent-soft` | `#E8F1FE` |
| 좋음(달성) | `--good` | `#22C55E` |
| 경고/감소(체지방·하향) | `--warn` | `#F59E0B` |
| 위험/삭제 | `--danger` | `#EF4444` |

- 타이포: 카드 제목 `h2`(기존 스타일), 지표 숫자는 `.metric .v`, 보조문구 `muted` 12~13px. 폰트 스택은 기존 시스템 폰트.
- 간격/컴포넌트: `.card`, `.grid3`, `.metric`/`metricBox`, `.btn`/`.btn.sec`/`.btn.sm`/`.btn.danger`, `.thumb`, `.tag`, `.empty`/`.empty-ico`, `.fld`, `.spread`, `.divider`, `.row`, `.mt8`/`.mt12` 전부 재사용. 신규 CSS 클래스 불필요(있어도 1~2개 작은 유틸 정도).
- 수면 지표 색 제안(선택, 변수 재사용): 총수면 = `--accent`(파랑), 렘 = `--part-팔`(`#8B5CF6` 보라), 깊은잠 = `--part-등`(`#3B82F6`)와 충돌하니 깊은잠은 `--chip-dark`/`--text-strong` 또는 `--part-하체`(`#22C55E`). MVP는 색 구분 없이 `metricBox` 기본 톤이면 충분.

---

## 8. ROI 요약(우선순위)

1. **PR-1(모델+분리)** — 데이터 안전·중복 제거의 기반. 가장 먼저, 위험 낮음(폴백·멱등).
2. **PR-2(입력 UI)** — 매일 총수면 1초 입력(체중처럼). 코치가 쓸 수치 확보.
3. **PR-3(이미지)** — 핵심 요구(렘/깊은잠 분석 이미지·구글포토). 기존 인프라 재사용이라 코드 적음.
4. **PR-4(코치 연계)** — 문서/자동화. 데이터 쌓인 뒤 가치 발생.

---

## 저장 경로
`C:\Users\user\Desktop\고형석은몸짱이될테야\docs\sleep-spec.md`
