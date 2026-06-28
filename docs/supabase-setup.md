# Supabase 수동 설정 (형석님 직접 — PR-1 동기화용)

> dev(코드 담당)는 Supabase 대시보드에 접근할 수 없습니다. 아래 **(a) SQL + (b) 비밀번호 로그인(Confirm email OFF)** 두 가지를 **형석님이 대시보드에서 직접** 해주셔야 로그인·동기화가 실제로 동작합니다.
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

## (b) ★ 비밀번호 로그인 — Confirm email OFF (필수 1회 설정)

> 앱 로그인이 **이메일 OTP(6자리 코드) → 이메일 + 비밀번호** 로 바뀌었습니다. 이유: Supabase가 **커스텀 SMTP 없이는 OTP 메일 템플릿 편집을 막아서**(아래 (b-옛) 참고), 1인 앱엔 비밀번호 로그인이 가장 단순·확실합니다. **메일 발송 자체가 필요 없어집니다.**

대시보드 → **Authentication** → **Providers** → **Email**:

- **Email** provider **Enable** = **ON**
- **Confirm email** = **OFF** ← ★ 이게 핵심. 가입 시 확인 메일이 안 나가고, **가입 즉시 로그인(세션 발급)** 됩니다. (앱의 `signUp` 이 즉시 세션을 받아 바로 동기화 켜짐.)
  - Confirm email 을 **ON으로 두면**: 가입 후 메일의 링크를 눌러야 로그인됩니다(메일 발송 발생). 앱은 이 경우도 안전하게 처리(세션 없이 오면 "확인 메일을 보냈어요" 안내)하지만, **OFF 를 권장**합니다(메일 0).
- (OTP 시절의 **Enable Email OTP / Magic Link** 토글은 비밀번호 로그인엔 무관합니다. 켜져 있어도 앱은 쓰지 않습니다.)

(선택·권장) 남이 가입하지 못하도록 **"Allow new users to sign up" 을 OFF**. 단, 이 경우 앱에서 **"새로 시작하기"(가입)가 막히므로**, 먼저 **Authentication → Users → Add user** 로 형석님 계정(이메일+비밀번호)을 **수동 1회 생성**한 뒤 끄세요. (RLS가 어차피 데이터는 막지만, 계정 난립 방지로 깔끔합니다.)

> 비밀번호는 Supabase가 해시로 보관합니다. 앱/공개 저장소엔 비밀번호도, service_role 키도 절대 넣지 않습니다(앱엔 publishable 키만).

---

## (b-옛) ~~URL Configuration / OTP 템플릿~~ — **비밀번호 방식으로 대체됨**

> 아래는 **매직링크/OTP 시절의 설정**입니다. 비밀번호 로그인에서는 **필요 없습니다.** (혼선 방지용으로 남겨두되, 새로 설정할 필요는 없습니다.)
>
> - **URL Configuration(Site URL / Redirect URLs)**: 매직링크 복귀 주소용이었음. 비밀번호 로그인은 리다이렉트가 없어 **불필요**. (앱 코드의 `detectSessionInUrl` 은 휴면 잔재로 남아 있어 무해합니다.)
> - **이메일 템플릿 `{{ .Token }}` 편집(OTP 6자리 코드)**: OTP 코드를 메일에 노출시키려던 작업. 비밀번호 로그인은 **코드 메일 자체가 없으므로 불필요**. (애초에 커스텀 SMTP 없이는 이 편집이 막혀, 비밀번호 방식으로 전환한 것입니다.)

무료 티어 기본 SMTP 한도는 비밀번호 로그인에선 사실상 쓰이지 않습니다(Confirm email OFF면 메일 0).

---

## 폰 실기기 검증 (헤드리스로는 불가)

실 네트워크·실제 로그인/동기화는 헤드리스 스모크로 검증할 수 없어, **폰에서 수동 확인**합니다:

1. (a)+(b) 완료 후 배포본 접속 → **프로필 탭 → "☁️ 클라우드 동기화"** 카드에 **이메일 + 비밀번호(6자 이상)** 입력 → **"이 이메일로 새로 시작하기"**(첫 1회 가입).
2. 카드가 **"● 동기화 켜짐"** 으로 바뀌는지 확인. (Confirm email 이 ON이면 메일의 링크를 먼저 눌러야 함 — 그래서 OFF 권장.)
3. 이후엔 같은 이메일/비밀번호로 **"로그인"** 버튼. 폰A에서 운동/체중을 기록 → 다른 기기(또는 시크릿 창)에서 같은 계정으로 로그인 → **같은 데이터가 pull** 되는지 확인.
4. (선택) 비행기모드로 기록 후 복구 → 다음 저장/포커스에서 자동 재동기화 확인.
5. (선택) 한 번 로그인 후 앱 재실행/새로고침에도 **로그인 유지**되는지 확인(세션 지속).
6. (선택) 틀린 비밀번호 → "이메일/비밀번호를 확인해주세요" 토스트, 5자 이하 비번 → "6자 이상" 가드 동작 확인.

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
