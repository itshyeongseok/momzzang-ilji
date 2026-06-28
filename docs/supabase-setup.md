# Supabase 수동 설정 (형석님 직접 — PR-1 동기화용)

> dev(코드 담당)는 Supabase 대시보드에 접근할 수 없습니다. 아래 (a)~(c)는 **형석님이 대시보드에서 직접** 해주셔야 PR-1의 로그인·동기화가 실제로 동작합니다.
> 이 설정을 **안 해도 앱은 기존처럼 로컬 전용으로 100% 동작**합니다(로그인 카드만 "꺼짐"으로 표시). 즉 이 설정은 동기화를 켜기 위한 일회성 작업입니다.
>
> 프로젝트: `https://gjiyfgkswbzjfkibvwva.supabase.co`

---

## (a) SQL — `app_state` 테이블 + RLS 정책

Supabase 대시보드 → 좌측 **SQL Editor** → **New query** → 아래 전문을 붙여넣고 **Run**.

(플랜 `docs/supabase-plan.md` 3절·1.4절 기반. PR-1은 `app_state`만 필요 — `media`/`reports`는 PR-2/PR-3에서 추가합니다.)

```sql
-- 1) 앱 상태: 사용자당 1행. DB 객체 전체를 jsonb로 저장(단일 행 LWW).
create table if not exists public.app_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 2) RLS 켜기
alter table public.app_state enable row level security;

-- 3) "내 행만" 정책. auth.uid()를 (select ...)로 감싸 성능 최적화(플랜 권장).
--    TO authenticated 라 비로그인엔 정책이 안 돌고, 따라서 0건 반환(공개키여도 안전).
drop policy if exists "own rows - app_state" on public.app_state;
create policy "own rows - app_state"
  on public.app_state for all
  to authenticated
  using      ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );
```

검증: 대시보드 SQL Editor는 RLS를 우회하므로 진짜 검증은 **앱에서 로그인한 채** 읽기/쓰기로 합니다(아래 폰 검증 참고). 로그아웃 상태에서 `select * from app_state` 가 0건이면 정상.

---

## (b) Authentication → URL Configuration

대시보드 → **Authentication** → **URL Configuration**:

- **Site URL**: `https://itshyeongseok.github.io/momzzang-ilji/`
- **Redirect URLs**에 아래 둘을 추가:
  - `https://itshyeongseok.github.io/momzzang-ilji/`  (배포본 — 매직링크 복귀 주소)
  - `http://localhost:8000/`  (로컬 개발용, 선택)

> 앱은 매직링크 복귀 주소로 `location.origin + location.pathname` 을 보냅니다. 위 Site/Redirect URL과 정확히 일치해야 링크 클릭 후 세션이 수립됩니다(끝의 `/` 포함 주의).

---

## (c) 이메일(매직링크) 인증 활성 확인

대시보드 → **Authentication** → **Providers** → **Email**:

- **Email** provider **Enable** = ON
- **Confirm email** = ON
- **Enable Email OTP / Magic Link** = ON (매직링크 발송에 필요)

(선택·권장) 남이 가입하지 못하도록 **Email signup(또는 "Allow new users to sign up")을 OFF** 한 뒤, **Authentication → Users → Add user** 로 형석님 계정(이메일)을 **수동 1회 생성**. RLS가 어차피 데이터는 막지만, 계정 난립 방지로 깔끔합니다.

무료 티어 기본 SMTP는 1인 사용엔 충분합니다(분당 발송 한도 낮음). 한도에 걸리면 외부 SMTP(Resend 등)를 연결하세요.

---

## 폰 실기기 검증 (헤드리스로는 불가)

매직링크·실 네트워크·실제 동기화는 헤드리스 스모크로 검증할 수 없어, **폰에서 수동 확인**합니다:

1. (a)~(c) 완료 후 배포본 접속 → **프로필 탭 → "☁️ 클라우드 동기화"** 카드에 이메일 입력 → **링크 받기**.
2. 메일의 로그인 링크 탭 → 앱 복귀 시 카드가 **"● 동기화 켜짐"** 으로 바뀌는지 확인.
3. 폰A에서 운동/체중을 기록 → 다른 기기(또는 시크릿 창)에서 같은 이메일로 로그인 → **같은 데이터가 pull** 되는지 확인.
4. (선택) 비행기모드로 기록 후 복구 → 다음 저장/포커스에서 자동 재동기화 확인.

> service_role/secret 키는 **앱·공개 저장소에 절대 넣지 않습니다.** (AI 코치 루틴용으로 PR-3에서 로컬 PC `.env`에만 보관.)

---
---

# Supabase 수동 설정 (형석님 직접 — PR-2 사진용)

> PR-2는 **식단·인바디 사진**을 추가합니다. 아래 (d)~(e)는 **로그인 시 클라우드 백업**을 켜기 위한 일회성 설정입니다.
> **이 설정을 안 해도 사진 기능은 100% 동작합니다** — 비로그인/오프라인이면 사진은 폰의 **IndexedDB(`bulcup_media`)** 에만 저장되고 네트워크는 0입니다. 아래 설정은 로그인했을 때 사진을 Supabase Storage(비공개 버킷)에 백업하고 다른 기기에서도 보이게 하는 용도입니다.
>
> 프로젝트: `https://gjiyfgkswbzjfkibvwva.supabase.co`

---

## (d) SQL — `media` 테이블 + RLS 정책

대시보드 → **SQL Editor** → **New query** → 아래 전문을 붙여넣고 **Run**.

(플랜 `docs/supabase-plan.md` 3절·1.4절 기반. 사진 **메타**(경로·치수·바이트)만 이 테이블에 저장하고, 실제 이미지 바이너리는 (e)의 Storage 버킷에 저장합니다.)

```sql
-- 1) 사진 메타. 바이너리는 Storage(photos 버킷). 식단/인바디 사진 공통.
create table if not exists public.media (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('meal','body')),  -- 어떤 탭의 사진인지
  ref_date     date not null,                                   -- 식단/신체 기록 날짜 'YYYY-MM-DD'
  storage_path text not null,         -- 예: '<user_id>/meal/2026-06-27/<uuid>.jpg'
  width  int, height int, bytes int,
  created_at   timestamptz not null default now()
);
create index if not exists media_user_date_idx on public.media(user_id, ref_date);

-- 2) RLS 켜기
alter table public.media enable row level security;

-- 3) "내 행만" 정책(앱 INSERT/SELECT). auth.uid()를 (select ...)로 감싸 성능 최적화.
drop policy if exists "own rows - media" on public.media;
create policy "own rows - media"
  on public.media for all
  to authenticated
  using      ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );
```

---

## (e) Storage — 비공개 버킷 `photos` 생성 + 폴더단위 RLS

### (e-1) 버킷 만들기 (대시보드 클릭)

1. 대시보드 → 좌측 **Storage** → **New bucket**.
2. **Name**: `photos` (정확히 소문자, 앱 코드와 일치).
3. **Public bucket**: **OFF (비공개)** — 켜지 마세요. 비공개여야 모든 접근이 RLS로 통제되고, 표시는 짧은 만료의 **signed URL**로만 됩니다(무료 egress 방어).
4. (선택) File size limit / Allowed MIME types: 비워두거나 `image/jpeg`만 허용해도 됩니다. 앱은 압축 후 JPEG(장당 ~100~200KB)만 올립니다.
5. **Create bucket**.

### (e-2) Storage RLS 정책 SQL

대시보드 → **SQL Editor** → **New query** → 아래 전문 붙여넣고 **Run**.
경로 규칙은 **`<user_id>/<kind>/<YYYY-MM-DD>/<uuid>.jpg`** — 최상위 폴더가 `user_id`라서 폴더 첫 세그먼트로 본인 파일만 통제합니다.

```sql
-- 'photos' 버킷에서 "내 폴더(=user_id로 시작하는 경로)"만 읽기/쓰기/수정/삭제.
-- storage.foldername(name)[1] = 경로 첫 세그먼트(=user_id 여야 함).

drop policy if exists "photos: read own"   on storage.objects;
drop policy if exists "photos: write own"  on storage.objects;
drop policy if exists "photos: update own" on storage.objects;
drop policy if exists "photos: delete own" on storage.objects;

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

> 검증: 대시보드는 RLS를 우회하므로 진짜 검증은 **앱에서 로그인한 채** 사진을 올리고 다시 보는 것으로 합니다(아래 폰 검증).

---

## 폰 실기기 검증 — 사진 (헤드리스로는 불가)

압축·IndexedDB·Storage 업로드·signed URL 표시는 헤드리스 스모크로 검증할 수 없어, **폰에서 수동 확인**합니다:

1. **비로그인/오프라인(로컬 우선) 먼저:** 로그아웃(또는 비행기모드) 상태에서 홈 **식단 추가 → 📷 사진 첨부**로 한 장 → 추가. 목록에 **썸네일**이 뜨고, 탭하면 크게 보이는지 확인. (이때 네트워크 요청 0 — 개발자도구 Network 탭으로 확인 가능.)
2. **신체 → 측정 기록 → 📷 인바디 사진** 첨부 → 저장. 기록 목록에 썸네일 표시 확인(주 1회 인바디 용도).
3. **로그인 후 백업:** (d)~(e) 완료 + 로그인 상태에서 사진 첨부 → 추가. 잠시 뒤 대시보드 **Storage → photos** 에 `<uid>/meal|body/<날짜>/<uuid>.jpg`가, **Table editor → media** 에 메타 행이 생기는지 확인.
4. **egress(재다운로드) 0 확인:** 같은 사진을 다시 볼 때(앱 재진입/탭 전환) Network 탭에서 Storage 다운로드가 **다시 일어나지 않는지** 확인 — IndexedDB 캐시 히트로 즉시 표시돼야 합니다.
5. **다른 기기:** 다른 기기/시크릿 창에서 같은 이메일 로그인 → 사진이 signed URL로 받아져 보이고, 이후엔 그 기기의 IndexedDB에 캐시되는지 확인.

> 사진은 **localStorage에 절대 저장하지 않습니다**(5MB 한계). 로컬 사본은 IndexedDB(`bulcup_media`), 원본 진실원은 Storage(`photos`)입니다.
