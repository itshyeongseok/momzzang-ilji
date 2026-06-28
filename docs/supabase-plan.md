# BULCUP(벌컵) × Supabase 연동 아키텍처 플랜

> 아키텍트 산출물. 전제: 정적 PWA(GitHub Pages, **공개 저장소**), 갤럭시 S25(안드로이드 크롬), **1인 사용(고형석)**, 현재 데이터는 `localStorage` 키 `momzzang_v1`(모델: `workouts/meals/habits/habitDefs/body/sessions/routines/exDB/settings`).
> 이전 `backend-ai-plan.md`(PC 셀프호스팅)는 **폐기 대신 대체**한다 — PC 상시가동·터널·서비스 등록의 운영 부담을 Supabase 무료 매니지드로 옮긴다.

---

## 결론 (TL;DR)

| 항목 | 결정 | 근거 |
|---|---|---|
| **인증** | Supabase **magic-link 이메일 로그인**(고형석 단일 계정) | 비밀번호 관리 0, 폰에서 메일 탭 한 번. 공개 사이트라 RLS가 필수인데 RLS는 `auth.uid()` 기반이라 로그인이 전제 |
| **데이터 보호** | **RLS로 `user_id = auth.uid()` 인 행만** 접근 | anon 키가 공개 JS에 노출돼도, 로그인 안 했거나 남의 행이면 0건 반환 |
| **동기화 모델** | **`app_state` jsonb 단일 행 LWW** (정규화 X) | 1인·전체상태 `DB` 하나·구조 자주 바뀜 → 정규화는 과설계. CLAUDE.md "과설계 금지"와 정합 |
| **충돌** | **Last-Write-Wins**(`updated_at` 비교) | 1인 멀티기기 동시편집 거의 없음. 단순함 우선 |
| **사진** | **Private Storage 버킷** + `media` 테이블에 메타, **IndexedDB 로컬 캐시** | localStorage엔 사진 못 넣음(5MB 한계). 업로드 전 캔버스 압축 |
| **AI 코치** | **API 키 안 씀.** 로컬 PC의 **Claude Code 예약 루틴**이 service_role로 읽고 리포트를 DB에 씀 | 과금폭탄 원천 차단. service_role 키는 PC `.env`에만 |
| **클라이언트 통합** | **supabase-js v2 ESM CDN import 1개**(`esm.sh`) 허용 | "의존성0/빌드0" 원칙의 최소 절충. 빌드는 여전히 0, npm도 0 |
| **월 비용** | **₩0** | 무료 티어 한도 안. 단 **주 1회 핑으로 7일 자동 일시정지 방지** |

---

## 0. 무료 티어 현실 점검 (먼저 읽을 것)

2026년 6월 기준 Supabase Free 한도와 1인 사용 영향:

| 한도 | Free | BULCUP 1인 실사용 | 판단 |
|---|---|---|---|
| DB 용량 | 500 MB | jsonb 상태 1행 = 수십~수백 KB | 여유 만만 |
| 파일 스토리지 | 1 GB | 사진 압축 후 장당 ~150 KB → 수천 장 | 충분 |
| 월 egress(대역폭) | 5 GB uncached + 5 GB cached | 사진 다운로드가 변수 → **IndexedDB 캐시로 재다운로드 방지** | 캐시로 방어 |
| 월간 활성유저(MAU) | 50,000 | 1 | 무관 |
| **프로젝트 자동 일시정지** | **7일 무활동 시 일시정지**(복구는 대시보드에서 수동, 콜드스타트 ~60초) | 폰을 며칠 안 켜면 멈춤 | ⚠️ **주간 AI 루틴이 매주 접근하므로 사실상 방지됨**. 보강용 주1회 헬스체크 핑 권장 |
| 백업 | 없음 | — | **앱의 기존 JSON 내보내기를 백업으로 유지**(이미 있음) |

> ⚠️ **egress 5GB 초과 시 402로 로그인·동기화까지 깨진다.** 사진을 매번 새로 받지 말고 **IndexedDB에 캐시**(아래 4절)하는 게 비용·가용성 양쪽의 핵심.

---

## 1. 로그인 / 보안 (RLS)

### 1.1 왜 magic-link 인가
- 공개 정적 사이트엔 **anon 키가 그대로 박힌다**(원래 그렇게 쓰라고 만든 키 — "공개 가능"). 보호는 키 은닉이 아니라 **RLS**가 한다.
- RLS 정책은 `auth.uid()`(JWT의 sub)에 의존 → **로그인이 없으면 RLS를 걸 주체가 없다.** 그래서 1인용이라도 로그인은 필요.
- 1인 최소 인증으로 **magic-link**(비밀번호 OTP 이메일) 채택: 비번 분실·관리 없음, 폰에서 이메일 한 번 탭. (대안 password는 비번 보관 부담, OAuth는 외부 제공자 의존 → 1인엔 과함.)

### 1.2 설정 (대시보드)
1. Authentication → Providers → **Email** 활성, **Confirm email** ON, **Enable email OTP / magic link** ON.
2. Authentication → URL Configuration → **Site URL** = `https://itshyeongseok.github.io/momzzang-ilji/`, **Redirect URLs**에 동일 추가(+ 로컬 `http://localhost:8000/` 개발용).
3. (선택·권장) Authentication → **Allow list**가 없으면, 가입을 막기 위해 **Email signup을 끄고** 고형석 계정을 대시보드에서 **수동 1회 초대/생성**. → 남이 magic-link로 가입 시도해도 계정 자체가 안 생김. (RLS가 어차피 데이터는 막지만, 계정 난립 방지로 깔끔.)
4. (선택) 무료에서 메일 발송은 Supabase 기본 SMTP(분당 한도 낮음, 1인엔 충분). 한도 걸리면 무료 SMTP(Resend 등) 연결.

### 1.3 키 취급 원칙 (절대 규칙)
| 키 | 위치 | 용도 |
|---|---|---|
| **anon (public) 키** | ✅ 공개 사이트 JS에 박아도 됨 | 브라우저에서 로그인·RLS 적용된 읽기/쓰기 |
| **service_role 키** | ❌ **절대 클라이언트/공개 저장소/GitHub Pages에 두지 말 것** | **RLS 우회**. 로컬 PC의 AI 루틴 `.env`에만(5절). 저장소엔 `.gitignore` |

> service_role은 RLS를 전부 무시한다. 공개 JS나 public repo에 들어가면 전 데이터 노출 + 삭제 가능. AI 코치 루틴(로컬 전용)에서만 사용.

### 1.4 RLS 정책 SQL (app_state·media는 3절에서 생성)
```sql
-- 모든 테이블 RLS 켜기
alter table public.app_state enable row level security;
alter table public.media     enable row level security;
alter table public.reports   enable row level security;

-- 핵심 패턴: "내 행만". auth.uid()를 (select ...)로 감싸 행마다 재호출 방지(성능 베스트프랙티스).
-- TO authenticated 로 비로그인엔 정책 자체가 안 돌게.

create policy "own rows - app_state"
  on public.app_state for all
  to authenticated
  using  ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

create policy "own rows - media"
  on public.media for all
  to authenticated
  using  ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- reports: 앱은 읽기만, 쓰기는 service_role(루틴)이 RLS 우회로 함
create policy "read own reports"
  on public.reports for select
  to authenticated
  using ( user_id = (select auth.uid()) );

-- 정책이 참조하는 컬럼엔 인덱스(베스트프랙티스). user_id는 PK/FK라 보통 자동.
create index if not exists media_user_idx   on public.media(user_id);
create index if not exists reports_user_idx on public.reports(user_id);
```
- **검증법**: 대시보드 SQL 에디터는 RLS를 우회하므로 **앱(supabase-js)에서 로그인한 상태로** 읽기/쓰기 테스트해야 진짜 검증. 로그아웃 상태에서 `select`가 0건이면 정상.

---

## 2. 로컬 우선(local-first) 동기화

### 2.1 대원칙 (CLAUDE.md "로컬 우선" 유지)
- 앱은 **계속 `localStorage(momzzang_v1)`를 1차 저장소**로 쓴다. 기존 `load()/save()`는 그대로.
- **비로그인이거나 Supabase 미설정이면 지금과 100% 동일하게 로컬만으로 동작**(네트워크 0). 동기화 코드는 전부 "로그인 시에만" 분기.
- 로그인하면 양방향 동기화: 앱 시작 시 pull(merge) → 이후 `save()` 때마다 debounce push.

### 2.2 모델 선택: jsonb 단일 행 LWW (정규화 X)
**선택: `app_state(user_id, data jsonb, updated_at)` 한 행에 `DB` 전체를 통째로.**

근거(왜 정규화 안 하나):
- 데이터 주체가 **고형석 1명**, 동기화 단위가 **앱 상태 객체 `DB` 하나**. 행 단위 협업·부분 권한 같은 정규화의 이점이 **전무**.
- `DB` 구조가 자주 바뀐다(로드맵: PR·루틴·통계). jsonb면 **마이그레이션 0** — 클라가 새 필드 넣으면 그만. 정규화면 컬럼·테이블·동기화 코드가 매번 변경.
- 용량: 상태 1행이 수십~수백 KB → 500MB DB에 무의미. egress도 1인이라 미미.
- CLAUDE.md "과설계 금지 / 추상화는 두 번째 사용처 생길 때만"과 정합. 정규화는 **명백한 과설계**.

트레이드오프(수용):
- 부분 동기화 불가(상태 전체를 올리고 내림) → 1인·수백KB라 무의미.
- 서버측 쿼리/집계 불가 → **불필요**. AI 루틴은 jsonb를 통째로 받아 코드에서 파싱하면 됨(5절).
- 동시편집 충돌 → LWW로 단순 처리(아래).

> 사진만은 예외로 별도 `media` 테이블+Storage(jsonb에 바이너리 못 넣음). 4절.

### 2.3 충돌 = LWW (Last-Write-Wins)
- `app_state.updated_at`(서버 timestamptz)과 클라가 들고 있는 `lastSyncedAt`을 비교.
- **Pull(앱 시작/포커스 시)**: 서버 `updated_at` > 로컬 `lastPulledAt` 이면 서버 `data`로 로컬 교체 후 `renderAll()`.
- **Push(`save()` 후 debounce ~1.5s)**: 로컬을 서버에 `upsert`, `updated_at = now()`.
- **경합 가드**: push 직전 서버 `updated_at`을 한 번 읽어, 내 `lastPulledAt`보다 **서버가 더 최신**이면(=다른 기기가 먼저 씀) **먼저 pull 후 merge**, 아니면 push. 1인 단일기기면 이 경합은 사실상 안 일어남 → 단순 LWW로 충분.
- **세밀 병합은 안 함**(객체 통째 교체). 1인이라 데이터 손실 위험 낮고, 불안하면 push 직전 로컬 자동 스냅샷(localStorage 보조 키)으로 안전망.

### 2.4 의사 흐름 (앱에 추가될 sync 레이어, 개념)
```text
init:
  if !SUPA_URL || !session: return            // 비로그인 → 로컬만, 기존과 동일
  row = supabase.from('app_state').select('data,updated_at').single()
  if row && row.updated_at > localStorage['sync_pulledAt']:
     DB = mergeServer(row.data); save(); renderAll()
  localStorage['sync_pulledAt'] = row?.updated_at ?? now

on save():                                     // 기존 save()에 훅 1줄
  schedulePush()                               // debounce

push():
  supabase.from('app_state').upsert(
     { user_id: session.user.id, data: DB, updated_at: 'now()' })
  localStorage['sync_pulledAt'] = serverUpdatedAt
```
- 기존 `save()`는 건드리지 않고 끝에 `syncQueue?.()` 한 줄만 추가(없으면 no-op) → **로컬 우선 불변**.

---

## 3. 스키마 (SQL)

```sql
-- 1) 앱 상태: 사용자당 1행. DB 객체 전체를 jsonb로.
create table public.app_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 2) 사진 메타(바이너리는 Storage). 식단/인바디 사진.
create table public.media (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('meal','body')),  -- 어떤 탭
  ref_date    date not null,                                   -- 'YYYY-MM-DD' (식단/신체 날짜와 매칭)
  storage_path text not null,        -- 예: '<user_id>/meal/2026-06-27/uuid.jpg'
  width int, height int, bytes int,
  created_at  timestamptz not null default now()
);
create index media_user_date_idx on public.media(user_id, ref_date);

-- 3) AI 주간 리포트(루틴이 service_role로 INSERT, 앱은 SELECT만)
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,         -- 그 주 월요일 등 기준일
  body_md     text not null,         -- 한국어 마크다운 리포트
  model       text,                  -- 어떤 모델로 생성됐는지(감사용)
  created_at  timestamptz not null default now(),
  unique (user_id, week_start)       -- 주당 1개(재실행 시 upsert)
);
create index reports_user_week_idx on public.reports(user_id, week_start desc);
```
RLS 정책은 1.4절 SQL 그대로 적용. (Storage 버킷 정책은 4절.)

---

## 4. 사진 저장 (Storage + IndexedDB 캐시)

### 4.1 버킷
- 대시보드 Storage → **New bucket** `photos`, **Public = OFF(private)**. private면 모든 접근이 RLS 통제.
- 경로 규칙: **`<user_id>/<kind>/<YYYY-MM-DD>/<uuid>.jpg`**. 최상위 폴더가 user_id여야 폴더 단위 RLS가 깔끔.

### 4.2 Storage RLS (storage.objects)
```sql
-- 내 폴더(=user_id로 시작하는 경로)만 읽기/쓰기/삭제.
-- storage.foldername(name)[1] = 경로 첫 세그먼트.
create policy "photos: read own"
  on storage.objects for select to authenticated
  using ( bucket_id = 'photos'
          and (storage.foldername(name))[1] = (select auth.uid())::text );

create policy "photos: write own"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'photos'
          and (storage.foldername(name))[1] = (select auth.uid())::text );

create policy "photos: update own"
  on storage.objects for update to authenticated
  using ( bucket_id = 'photos'
          and (storage.foldername(name))[1] = (select auth.uid())::text );

create policy "photos: delete own"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'photos'
          and (storage.foldername(name))[1] = (select auth.uid())::text );
```

### 4.3 업로드 흐름 (앱에서)
1. `<input type="file" accept="image/*" capture="environment">`로 촬영/선택.
2. **캔버스 압축**(의존성0): 긴 변 ~1280px로 리사이즈 → `canvas.toBlob(b=>..., 'image/jpeg', 0.8)`. 장당 목표 ~100~200KB(egress·용량 절감의 핵심).
3. `path = '<uid>/<kind>/<date>/<uuid>.jpg'` 로 `supabase.storage.from('photos').upload(path, blob, {upsert:true, contentType:'image/jpeg'})`.
4. 성공 시 `media` 테이블에 메타 INSERT(`storage_path`, kind, ref_date, w/h/bytes).
5. **IndexedDB 캐시**: 같은 blob을 `idb` 스토어(key=storage_path)에 저장 → 다음에 표시할 때 네트워크 0.

### 4.4 표시 흐름 (egress 방어)
- 사진 표시 시: **먼저 IndexedDB에서 찾고**, 있으면 `URL.createObjectURL(blob)`로 즉시 표시(다운로드 0).
- 없으면 `supabase.storage.from('photos').createSignedUrl(path, 3600)`로 서명 URL 받아 fetch → blob → **IndexedDB에 캐시** 후 표시.
- private 버킷이므로 공개 URL 대신 **서명 URL**(짧은 만료) 사용.
- 결과: 같은 사진은 평생 한 번만 다운로드 → 5GB egress 한도 사실상 무관.

### 4.5 localStorage엔 사진 금지
- localStorage 5MB라 사진 base64는 절대 안 됨(현재도 안 넣음). 사진의 로컬 사본은 **IndexedDB**, 원본 진실원은 **Storage**.

---

## 5. AI 코치 주간 리포트 (API 키 안 씀)

### 5.1 핵심 설계 — "구독 기반 Claude Code 예약 루틴"
- **Anthropic API 키를 어디에도 두지 않는다.** 대신 고형석 PC의 **Claude Code(구독)**가 **매주 일요일 밤** 예약 실행(이 환경의 scheduled-tasks / cron).
- 루틴은 **로컬·비공개 PC에서만** 돌고, 거기서 **service_role 키**로 Supabase에 접근한다. 키는 절대 폰·공개사이트에 없음.

### 5.2 키 보관/접근 경로 (안전 설계)
```text
PC(로컬, 비공개)
  ~/.bulcup/.env   (gitignore, 권한 본인만)
    SUPABASE_URL=...
    SUPABASE_SERVICE_ROLE=...   ← RLS 우회, 절대 외부로 안 나감
  scheduled-task "BULCUP 주간코치" (일요일 22:00)
     └ Claude Code가 실행:
        1) service_role로 app_state.data(jsonb) + media(지난 7일) 조회
           - 사진은 service_role로 signed URL 생성 후 필요시 다운로드
        2) 지난 7일 운동/식단/습관/체중 집계 → 프롬프트 구성
        3) Claude(구독, 키 없이 Claude Code 자체)로 한국어 리포트 작성
        4) reports 테이블에 upsert(user_id=고형석, week_start, body_md)
```
- **읽기 경로**: 루틴은 RLS를 우회해야 7일치를 한 번에 모으기 편하므로 **service_role**. 단 **로컬 전용**이라 노출면 0. (대안: 루틴이 magic-link로 로그인해 anon으로 읽을 수도 있으나, 봇 로그인은 번거로움 → service_role이 1인 로컬엔 합리적.)
- **쓰기 경로**: `reports`에 INSERT도 service_role. 앱은 `reports`를 **SELECT만**(RLS read 정책) → 분석 탭에 표시.

### 5.3 앱 표시
- 분석/신체 탭에 "이번 주 코치 리포트" 섹션: 로그인 시 `supabase.from('reports').select().order('week_start',{ascending:false}).limit(1)` → `body_md`를 마크다운 렌더(간단 변환 또는 `<pre>`).
- 비로그인/리포트 없음이면 섹션 숨김(로컬 우선 불변).

### 5.4 자동 일시정지 방지 보너스
- 이 주간 루틴이 매주 Supabase에 접근 → **7일 무활동 일시정지가 사실상 안 걸림**. 폰을 안 켜는 주가 있어도 루틴이 깨워줌. (보강: 루틴에 `select 1` 헬스핑 한 줄.)

### 5.5 service_role 유출 방지 체크리스트
- [ ] `.env`는 public repo(`momzzang-ilji`)에 **절대 커밋 금지** — 앱 저장소 밖(`~/.bulcup/`)에 둘 것.
- [ ] 키가 들어간 스크립트도 public repo에 올리지 않기(로컬 전용 폴더).
- [ ] 노출 의심 시 대시보드에서 service_role **즉시 rotate**.

---

## 6. 클라이언트 통합 (의존성0/빌드0 절충)

### 6.1 충돌과 절충
- CLAUDE.md: **"의존성 0, 빌드 0. npm·번들러·프레임워크 금지"**. supabase-js는 명백한 외부 의존성.
- 절충: **빌드는 여전히 0, npm도 0.** 단 **런타임 ESM CDN import 1개**만 허용.
```html
<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
  // ...
</script>
```
- 이유: supabase-js를 손으로 fetch만 써서 재구현하는 건(특히 auth 토큰 갱신·storage 멀티파트) **더 큰 유지보수 부채** → "평생 유지보수" 원칙에 오히려 역행. 검증된 단일 CDN import가 최소 절충.
- **버전 고정**: `@2` 대신 **정확한 버전 핀**(예: `@2.45.0`) 권장 — CDN 변동으로 앱 깨짐 방지. SW 캐시에 포함시켜 오프라인에도 모듈 보유.

### 6.2 설정 주입 (anon 키·URL)
- `app/index.html`에 직접 박아도 보안상 문제 없음(anon은 공개키). 단 **선택적 활성화**:
```js
const SUPA_URL = '...';        // 형석님이 제공
const SUPA_ANON = '...';       // 공개 OK
const supa = (SUPA_URL && window.location.protocol==='https:')
   ? createClient(SUPA_URL, SUPA_ANON) : null;
// supa === null 이면 앱은 기존처럼 로컬 전용으로 100% 동작
```
- **로컬 우선 가드**: `supa`가 없으면 sync/사진/리포트 코드가 전부 no-op. 네트워크 실패 시에도 앱 기능은 안 죽게(try/catch + 토스트).

### 6.3 Service Worker 영향
- `sw.js` 캐시 목록에 supabase-js CDN URL과 자체 자산 유지. Supabase API/Storage 호출은 **네트워크 우선**(캐시하면 안 됨), 정적 자산만 캐시 우선.

### 6.4 오프라인 동작
- 비행기모드/네트워크 끊김 → supabase 호출 실패해도 로컬은 정상. 복구 시 다음 `save()`/포커스에서 자동 재동기화.

---

## 7. 구현 PR 분할안

> 전제: **형석님이 먼저** Supabase 프로젝트 생성 → `SUPA_URL` + `anon 키` 제공, magic-link로 본인 계정 1회 로그인 확인, service_role 키는 **PC 로컬에만** 보관. dev는 그 다음 순서대로.

### PR-0 (형석님 수동, 코드 아님)
- Supabase 프로젝트 생성, Email/magic-link 활성, Site/Redirect URL 설정, 3절 스키마 + 1.4 RLS SQL 실행, `photos` 버킷 생성 + 4.2 정책.
- **산출물**: `SUPA_URL`, `anon 키`(dev에게), service_role(로컬 보관).
- **검증**: 대시보드에서 본인 계정 1개 존재, magic-link 메일 수신.

### PR-1 — 로그인 + 상태 동기화 (jsonb LWW)
- **범위**: supabase-js CDN import, `supa` 초기화 가드(6.2), 로그인/로그아웃 UI(설정 탭에 "클라우드 동기화" 섹션 + 이메일 입력→magic-link), `save()`에 push 훅, init에 pull+merge(2.3/2.4).
- **검증(헤드리스 한계)**: 스모크는 `supa=null`(미설정) 경로가 **기존과 동일 동작**임을 단언(네트워크 0, 로컬 read/write 정상). 실제 동기화는 **폰 실기기 수동 검증**(헤드리스로 magic-link·실 네트워크 불가 — 이 한계를 PR 본문에 명시). 수동: 폰A에서 기록 → 폰/PC 다른 세션에서 로그인 시 동일 데이터 pull.
- **롤백 안전**: `supa=null`이면 PR 이전과 바이트 단위로 동일 동작.

### PR-2 — 사진(Storage + IndexedDB 캐시)
- **범위**: 식단/신체 탭에 사진 첨부 UI, 캔버스 압축, Storage 업로드, `media` INSERT, IndexedDB 캐시 read-through, 서명 URL 표시(4절).
- **검증**: 스모크는 캔버스 압축 함수(입력 blob→출력 크기 축소)와 IndexedDB put/get을 DOM/idb 스텁으로 단언. 업로드·서명URL은 **폰 수동**(촬영→업로드→재진입 시 캐시로 즉시 표시, 네트워크탭 재다운로드 0 확인).

### PR-3 — AI 코치 리포트 표시 + 로컬 루틴
- **앱 측(이 저장소)**: 분석 탭 "이번 주 코치" 섹션, `reports` SELECT + 마크다운 표시(5.3). 리포트 없으면 숨김.
- **루틴 측(로컬, 저장소 밖)**: `~/.bulcup/` 스크립트 + scheduled-task(일요일 밤), service_role로 7일 조회→리포트→`reports` upsert(5.2). **public repo에 커밋 금지.**
- **검증**: 앱 측 스모크는 `reports` mock row가 있을 때 섹션 렌더, 없을 때 숨김을 단언. 루틴은 로컬에서 1회 수동 실행 → `reports`에 행 생성 + 앱에서 표시 확인.

### (선택) PR-4 — 보강
- 주1회 헬스핑(일시정지 방지 보강), 동기화 충돌 경합 가드 강화, 리포트 마크다운 렌더 개선.

### PR 공통 검증 한계(헤드리스 스모크)
- 이 환경 스모크(vm + DOM 스텁)는 **실 네트워크·magic-link·Storage·signed URL을 못 탄다.** → "미설정(supa=null) 경로 동작 보존"과 "순수 함수(압축·병합·캐시 키)"만 자동 단언하고, **네트워크 의존부는 폰 수동 검증**으로 분리. 각 PR 본문에 이 경계를 명시.

---

## 출처
- [Supabase RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security) / [RLS 성능 베스트프랙티스](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Auth(magic link)](https://supabase.com/docs/guides/auth) / [Users](https://supabase.com/docs/guides/auth/users)
- [Storage Access Control(RLS)](https://supabase.com/docs/guides/storage/security/access-control) / [Storage Helper Functions](https://supabase.com/docs/guides/storage/schema/helper-functions)
- [Free 티어 한도·일시정지](https://supabase.com/pricing) / [Bandwidth & Storage Egress](https://supabase.com/docs/guides/storage/serving/bandwidth)
