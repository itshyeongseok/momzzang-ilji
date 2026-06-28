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
