# 셀프호스팅 백엔드 + AI 트레이너 아키텍처 플랜

> 서브에이전트(리서치) 산출물. 전제: Windows 11 PC 상시 가동, 정적 PWA(GitHub Pages), 현재 `localStorage`. 1인 사용.

## 결론 (TL;DR)

| 항목 | 추천 | 이유 |
|---|---|---|
| **외부 접속** | **Cloudflare Tunnel** | 포트 개방 0개, 무료, 고정 HTTPS 도메인, CGNAT 우회 |
| **백엔드 스택** | **Node(Fastify) + SQLite**(`better-sqlite3`) | 단일 파일 DB, 의존성 최소, 1인엔 충분 |
| **동기화** | **로컬 우선(IndexedDB outbox) + LWW 타임스탬프** | PC 꺼져도 폰 단독 기록, 켜지면 자동 병합 |
| **AI 키 위치** | **셀프호스팅 백엔드 `.env`** (서버리스 불필요) | 인프라 1개 통합, 키 노출 0 |
| **월 비용** | **인프라 ₩0 + AI 종량(가벼우면 수백~수천 원)** | 터널·서버 무료, AI만 종량제 |

핵심: 어차피 PC 백엔드를 세우니, AI 키도 그 백엔드에 둠 → 인프라 1개로 통합. (PC를 자주 끄면 AI만 Cloudflare Workers로 분리.)

## 목표 A — PC 셀프호스팅 백엔드

### 외부 접속 비교
| 방식 | 보안 | 난이도 | 비용 | CGNAT 우회 |
|---|---|---|---|---|
| **Cloudflare Tunnel(권장)** | 높음(포트 0, 아웃바운드 443만) | 낮음~중 | 무료 | O |
| Tailscale | 매우 높음(WireGuard, 내 기기만) | 낮음 | 무료 | O (단 폰에 VPN앱·로그인 필요) |
| 포트포워딩+DDNS | 낮음(홈IP 노출) | 중~높음 | 무료 | X(CGNAT 불가) |

**Cloudflare Tunnel 설치 (Windows):**
1. Cloudflare 계정 + 도메인 등록(없으면 연 1만원대 구매 → 네임서버 이전). *완전무료 원하면 Tailscale Funnel `*.ts.net` 경로.*
2. Zero Trust → Networks → Tunnels → Create → OS=Windows → `cloudflared.exe` 다운로드
3. **서비스 등록**(부팅 자동시작): `cloudflared.exe service install <토큰>`
4. Public Hostname: `api.내도메인.com` → `http://localhost:3000`
5. 폰 LTE에서 `https://api.내도메인.com/health` 200 확인
- 전원옵션: 절전 끄기, 빠른시작 끄기, BIOS 정전후 자동부팅. 백엔드도 PM2/NSSM으로 서비스화.
- 주의: Cloudflare가 엣지에서 평문을 봄(헬스 데이터는 민감도 낮아 1인용 수용 가능). 의료수준 프라이버시면 Tailscale.

### 백엔드 스택
```
fitness-backend/
  server.js   # /health, /sync, /records, /coach
  db.sqlite   # 단일 파일(백업=파일복사)
  .env        # ANTHROPIC_API_KEY, SYNC_TOKEN
```
인증(1인 최소): `.env`의 긴 랜덤 토큰을 PWA가 `Authorization: Bearer` 헤더로 전송 → 서버 검증.

### 동기화 — 로컬 우선
**원칙: PWA는 항상 로컬을 먼저 읽고 쓴다. 백엔드는 보조 진실원(공유+백업)일 뿐, 없어도 앱은 동작.**
- 권장: `localStorage` → **IndexedDB** 이전(용량·Service Worker 접근 때문). 부담되면 1차는 localStorage + outbox 키만.
- 각 레코드에 동기화 메타: `id`(클라이언트 UUID), `updatedAt`(LWW 기준), `deleted`(소프트삭제).
- **쓰기**: ① IndexedDB 즉시 저장(UI 반영) → ② outbox에 변경 push → ③ 온라인이면 `POST /sync`, 실패면 큐 보관 후 재시도.
- **충돌**: Last-Write-Wins(`updatedAt` 큰 쪽 승). 1인용엔 충분.
- **PC 꺼짐/오프라인**: 폰 IndexedDB만으로 읽기·쓰기 정상, outbox 누적 → PC 켜지면 자동 병합. 백엔드 가용성 요구 낮음.

## 목표 B — AI 트레이너 코칭 (Claude API)

**대원칙: API 키는 절대 정적 사이트 JS에 넣지 않는다(즉시 유출→과금폭탄). 반드시 서버측.**

| 옵션 | 키 위치 | 장점 | 단점 |
|---|---|---|---|
| **백엔드 통합(권장)** | PC `.env` | 인프라 1개, 데이터가 이미 그 DB에 | PC 꺼지면 AI 불가 |
| 서버리스 분리 | Cloudflare Workers 시크릿 | AI 24/7, 무료 100k req/day | 인프라 2개로 분리 |

**요청 흐름:** 폰은 `POST /coach {range}` (키 안 보냄) → 백엔드가 SQLite에서 기간 데이터 조회 → 프롬프트 구성 → Claude 호출(키는 서버에만) → 결과 반환. 모델: 일상=**Haiku 4.5**, 주간 심층=**Sonnet 4.6**.

**비용(백만 토큰당):** Haiku $1/$5, Sonnet $3/$15, Opus $5/$25.
- 요청당(입력 2K+출력 0.7K): Haiku ≈ 7~8원, Sonnet ≈ 22원.
- 월 60회: Haiku 위주 수백 원, 혼합 1,000~3,000원.
- 절감: 프롬프트 캐싱(고정부 10%), Batch API(50%↓), 서버에서 집계·요약 후 전송(입력 토큰↓).

## 실행 순서 (검증 포함)
```
1. 백엔드 골격 Node+Fastify+SQLite, /health → verify: localhost:3000/health 200
2. Cloudflare Tunnel + Windows 서비스 → verify: 폰 LTE에서 api.도메인/health 200
3. PWA localStorage→IndexedDB + outbox → verify: 비행기모드 기록 정상
4. /sync + /records (UUID·updatedAt·LWW·소프트삭제) → verify: PC끄고 폰기록→PC켜면 자동병합
5. /coach (.env 키, Haiku) → verify: 코칭 응답 + 네트워크탭에 키 미노출
6. (선택) 프롬프트 캐싱·주간 배치·Sonnet 심층
```

## 출처
Cloudflare Tunnel docs, Tailscale vs Tunnel 비교, web.dev offline-data, PWA offline-sync/LWW, Anthropic 공식 가격, Cloudflare Workers 가격·AI Gateway. (상세 링크는 리서치 원문 참조)
