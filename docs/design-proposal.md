# 몸짱일지 디자인 리뉴얼 제안서

> 서브에이전트(디자인) 산출물. 순수 HTML/CSS/JS·모바일·한국어·다크 제약 준수. 데이터 스키마 변경은 `settings.bestStreak` 한 줄 외 거의 없음.

## 1. 색 팔레트

### A안 — Deep Forest + Lime Punch (권장: 적은 변경, 큰 인상)
배경을 약간 더 깊고 푸른 무채색으로 내리고, 강조색은 라임(#4ade80)→에메랄드(#34d399)로 채도를 낮춰 고급감. CTA는 그라데이션.
```css
:root{
  --bg:#0b0e14; --surface:#151a23; --surface2:#1d2430; --surface3:#252e3d;
  --line:#2c3545; --line-soft:#212835;
  --text:#eef1f6; --muted:#8b93a7; --faint:#5b6377;
  --accent:#34d399; --accent-strong:#10b981; --accent-soft:#34d39922; --on-accent:#04140c;
  --accent2:#38bdf8; --accent2-soft:#38bdf820; --danger:#f87171; --warn:#fbbf24; --gold:#fbbf24;
  --grad-accent:linear-gradient(135deg,#34d399 0%,#10b981 100%);
  --grad-accent2:linear-gradient(135deg,#38bdf8 0%,#0ea5e9 100%);
  --s1:4px;--s2:8px;--s3:12px;--s4:16px;--s5:20px;--s6:24px;--s8:32px;
}
```

### B안 — Electric Indigo (과감한 차별화)
강조를 인디고/바이올렛으로 전환. 초록 쓰는 헬스앱이 많아 브랜드 차별화를 원할 때. 정체성 변화가 큼 → 취향 확인 후 채택.
```css
:root{
  --bg:#0a0a12; --surface:#14141f; --surface2:#1d1d2c; --surface3:#26263a;
  --line:#2e2e44; --text:#eef0f8; --muted:#8d8fa8;
  --accent:#818cf8; --accent-strong:#6366f1; --on-accent:#0a0a18;
  --accent2:#22d3ee; --warn:#fbbf24; --danger:#fb7185;
  --grad-accent:linear-gradient(135deg,#818cf8 0%,#6366f1 100%);
}
```

## 2. 타이포그래피
폰트 스택 유지(웹폰트 미도입). `line-height:1.5`, 숫자엔 `font-variant-numeric:tabular-nums`(메트릭·요약까지 확대). 굵기는 500(본문)/700(강조)/800(타이틀·숫자) 3단계로만.

| 역할 | 크기 | 굵기 | 적용 |
|---|---|---|---|
| Display | 28 | 800 | 체중 대표값, 스트릭 |
| H1 제목 | 22 | 800 | header title |
| H2 카드제목 | 15 | 700 | .card h2 |
| Body/강조 | 15 | 500/700 | 본문/운동명 |
| Label/Caption | 12 | 700/600 | .fld, 보조설명 |
| Micro | 11 | 700 | 단위, 탭 라벨 |

## 3. 여백·위계
8px 그리드(`--s1~--s8`). 히어로 카드(홈 요약·신체 현재값)는 `--s5` 패딩으로 크게, 일반 카드 `--s4`. `.card h2` 하단 12→16px. `main` 좌우 16→20px. 빈 상태에 큰 아이콘+유도 버튼. 위계는 색이 아니라 크기·여백으로. 그림자는 떠 있는 것(타이머/토스트/FAB/시트)에만.

## 4. 컴포넌트 폴리시 (핵심 CSS)
```css
.card{background:var(--surface);border:1px solid var(--line-soft);border-radius:18px;padding:var(--s4);margin-bottom:var(--s4)}
.card.hero{background:radial-gradient(120% 100% at 0% 0%,var(--accent-soft),transparent 60%),var(--surface);padding:var(--s5)}
.btn{background:var(--grad-accent);color:var(--on-accent);border-radius:13px;padding:14px 16px;font-weight:800;
  box-shadow:0 4px 14px -4px var(--accent-strong);transition:transform .12s,filter .12s}
.btn:active{transform:translateY(1px) scale(.99);filter:brightness(.95)}
.btn.sec{background:var(--surface2);color:var(--text);border:1px solid var(--line);box-shadow:none}
.chip.on{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)} /* 꽉찬 초록 대신 틴트+초록글자 */
nav button.active::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:26px;height:3px;border-radius:0 0 3px 3px;background:var(--grad-accent)} /* 활성 탭 상단 인디케이터 */
```
- **한 화면에 primary 버튼은 하나만.** 빠른시작 4버튼은 모두 `.sec`, 각 탭 "+추가"만 그라데이션.
- 차트: 영역 그라데이션 채움 + 가로 그리드 3선 + 마지막 점 강조·값 라벨. 하드코딩 `#4ade80`(차트) 변수화.
- 휴식 타이머 바: 꽉 찬 초록 → 표면색 + **줄어드는 게이지(`.fill`)** 배경. `startRest`에 `restStart` 저장해 비율 계산.

## 5. 동기부여 요소 (기존 데이터만으로 구현)
1. **스트릭 히어로 카드(최우선)** — "🔥 N일 연속"을 홈 상단 큰 카드로. 최장기록(`settings.bestStreak`) 저장, 주간 7칸 도트(기록한 날 채움), "오늘 하나만 기록하면 N+1일!" 넛지, 7일↑ 불꽃 펄스.
2. **오늘 완성도 링** — SVG 도넛, 운동/식단/습관/신체 각 1/4 채움. 100%면 글로우+축하 토스트.
3. **성취 뱃지** — 자동 판정(첫발걸음👟/3일🔥/일주일⚡/볼륨1톤🏋️/단백질🥩/첫-1kg📉/30일🏅). 미획득은 흐림+"앞으로 N일".
4. **마이크로 피드백** — PR 뱃지(✅ 구현됨), 저장 카피 랜덤화, 빈 상태 동기부여 카피, 명언 로테이션.

## 구현 우선순위 (ROI 순)
1. `:root` 토큰 교체(A안) + 하드코딩색 변수화 — 체감 가장 큼
2. 버튼 그라데이션 + 칩 틴트 + 탭 인디케이터 (CSS만)
3. 타이포 토큰 + tabular-nums 확대
4. 휴식 타이머 게이지 바
5. 스트릭 히어로 카드 + 주간 도트 + bestStreak
6. 오늘 완성도 링
7. 차트 채움/그리드/값 라벨
8. 성취 뱃지 시스템
