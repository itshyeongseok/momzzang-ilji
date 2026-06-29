# BULCUP v1 — 전체 디자인 리프레시 사양서

> 목적: BULCUP v1 출시를 위해 현재의 밝은(라이트) 톤을 유지하되, 번핏보다 **한 단계 더 트렌디하고 요즘 웰니스 앱 감성**으로 총체적 업그레이드.
> 제약: 순수 HTML/CSS/JS, 빌드/프레임워크/외부 폰트 CDN 금지. 시스템 폰트로 충분. 모바일(갤럭시 S25) 우선, 한국어, 라이트 테마 고정.
> 범위: **기능·데이터·로직 변경 없음.** CSS 토큰/컴포넌트 스타일 + 아이콘(SVG/PNG) 중심. JS는 마이크로 인터랙션(ripple)에 한해 선택적.

이 문서는 개발자가 `app/index.html`의 `<style>` 블록·아이콘 파일만 손대서 그대로 적용할 수 있도록 **정확한 hex/px/CSS 스니펫**으로 작성했다.

---

## 0. 디자인 방향 한 줄 요약

번핏은 "하늘색 + 흰 카드 + 부드러운 그라데이션 배경"의 정석 라이트 UI다. BULCUP은 거기에 **(1) 더 따뜻한 뉴트럴 배경**, **(2) 생기있는 인디고-바이올렛 강조 1색 + 미묘한 그라데이션**, **(3) 더 큰 라운드와 부드러운 그림자(soft UI)**, **(4) tabular 숫자·또렷한 위계의 타이포**, **(5) 절제된 마이크로 모션**을 더해 "2025년 프리미엄 무료앱" 인상을 만든다.

핵심 차별점(번핏 대비):
- 강조색을 번핏의 평범한 파랑(#3B82F6 계열)에서 **인디고→바이올렛 그라데이션**으로 이동 → 더 트렌디.
- 배경을 차가운 회청색에서 **약간 따뜻한 뉴트럴(#F6F7F9)** 로 → 눈이 편하고 카드 흰색이 더 도드라짐.
- 카드 radius 18 → **20~24**, 그림자를 색조 있는 soft shadow로.

---

## 1. 색 시스템 (Color Tokens)

현재 `:root` 토큰을 아래로 **교체**한다. 변수 이름은 최대한 유지(기존 `--accent` `--accent-soft` `--accent-strong` `--good` 등 참조가 많음) → 값만 갱신하면 전역 반영.

### 1.1 배경 / 표면 단계
| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg` | `#F6F7F9` | 앱 최하단 배경(따뜻한 뉴트럴) |
| `--bg-tint` | `#EEF0FF` | 홈 상단 은은한 그라데이션 보조(아래 1.5) |
| `--surface` | `#FFFFFF` | 카드/시트 기본 표면 |
| `--surface2` | `#F4F5F8` | 입력칸·내부 박스(ex, sum, stepper) |
| `--surface3` | `#ECEEF3` | 트랙/비활성 배경 |

### 1.2 라인 / 구분
| 토큰 | 값 | 용도 |
|---|---|---|
| `--line` | `#E6E8EE` | 카드 테두리·구분선 |
| `--line-soft` | `#EEF0F4` | 더 옅은 내부 구분 |
| `--dash` | `#C7CCD8` | 점선(운동 추가 등) |

### 1.3 텍스트 위계
| 토큰 | 값 | 용도 |
|---|---|---|
| `--text-strong` | `#0E1116` | 제목·숫자(가장 진함, 거의 검정) |
| `--text` | `#272B33` | 본문 |
| `--muted` | `#646B78` | 보조 설명 |
| `--faint` | `#9AA1AE` | 비활성·플레이스홀더·nav 미선택 |

### 1.4 강조 (Accent — 인디고→바이올렛)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--accent` | `#5B6CF5` | 메인 강조(인디고) — 활성 nav, 링크, 포커스 |
| `--accent-strong` | `#4A57E0` | 진한 강조(그라데이션 끝, 텍스트 on-soft) |
| `--accent-2` | `#7C5CFB` | 그라데이션용 바이올렛 |
| `--accent-soft` | `#ECEEFE` | 강조 배경(칩 on, 셀 강조, 환영카드) |
| `--accent-soft-2`| `#F3EEFF` | 보조 강조 배경(바이올렛 틴트) |
| `--on-accent` | `#FFFFFF` | 강조 위 텍스트 |
| `--accent2` | `#5B6CF5` | (호환 별칭, 기존 코드 참조 유지) |

> 그라데이션 표준: `linear-gradient(135deg, #5B6CF5 0%, #7C5CFB 100%)` — 1차 버튼·운동종료·앱아이콘에 공통 사용.

### 1.5 상태 / 보조
| 토큰 | 값 | 용도 |
|---|---|---|
| `--good` | `#16B981` | 성공·달성·체중감소(에메랄드, 번핏보다 차분) |
| `--good-soft` | `#E3F7EF` | 성공 배경 |
| `--danger` | `#F0556A` | 위험·삭제(약간 코랄 핑크 → 트렌디) |
| `--danger-soft` | `#FDE8EB` | 위험 배경 |
| `--warn` | `#F5A524` | 경고·식단 마커 |
| `--gold` | `#F5A524` | 즐겨찾기 별 |
| `--chip-dark` | `#1E232C` | 다크 칩(토스트 배경 등) |

### 1.6 부위 색 (라이트, 채도 약간 낮춰 통일감)
```
--part-가슴:#F0556A; --part-등:#5B6CF5; --part-어깨:#F5A524; --part-팔:#7C5CFB;
--part-하체:#16B981; --part-복근:#06B6D4; --part-유산소:#EC6FA8; --part-기타:#646B78;
```

### 1.7 교체용 `:root` 스니펫(요약)
```css
:root{
  --bg:#F6F7F9; --bg-tint:#EEF0FF;
  --surface:#FFFFFF; --surface2:#F4F5F8; --surface3:#ECEEF3;
  --line:#E6E8EE; --line-soft:#EEF0F4; --dash:#C7CCD8;
  --text-strong:#0E1116; --text:#272B33; --muted:#646B78; --faint:#9AA1AE;
  --accent:#5B6CF5; --accent-strong:#4A57E0; --accent-2:#7C5CFB;
  --accent-soft:#ECEEFE; --accent-soft-2:#F3EEFF; --on-accent:#FFFFFF; --accent2:#5B6CF5;
  --good:#16B981; --good-soft:#E3F7EF; --danger:#F0556A; --danger-soft:#FDE8EB;
  --warn:#F5A524; --gold:#F5A524; --chip-dark:#1E232C;
  --part-가슴:#F0556A; --part-등:#5B6CF5; --part-어깨:#F5A524; --part-팔:#7C5CFB;
  --part-하체:#16B981; --part-복근:#06B6D4; --part-유산소:#EC6FA8; --part-기타:#646B78;
  /* 그림자 토큰(아래 4장) */
  --grad-accent:linear-gradient(135deg,#5B6CF5 0%,#7C5CFB 100%);
  --sh-1:0 1px 2px rgba(16,21,40,.04), 0 2px 8px rgba(16,21,40,.05);
  --sh-2:0 6px 20px -8px rgba(40,46,90,.18);
  --sh-3:0 12px 32px -10px rgba(40,46,90,.24);
  --sh-accent:0 8px 20px -6px rgba(91,108,245,.45);
  --safe-top:env(safe-area-inset-top); --safe-bot:env(safe-area-inset-bottom);
}
```
> `meta[name=theme-color]`(현재 `#F2F4F7`)와 `manifest.json`의 `theme_color`/`background_color`도 **`#F6F7F9`** 로 맞춘다.

---

## 2. 타이포 스케일

폰트 스택 유지(시스템 폰트로 충분히 트렌디):
```
-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Apple SD Gothic Neo","Noto Sans KR",sans-serif
```

| 역할 | size | weight | letter-spacing | line-height | 비고 |
|---|---|---|---|---|---|
| 화면 타이틀(header .title) | 24px | 800 | -0.6px | 1.2 | 번핏 헤더보다 살짝 크게 |
| 카드 제목(h2) | 16px | 750(=700+) | -0.2px | 1.3 | |
| 본문 | 15~16px | 400~500 | 0 | 1.5 | |
| 보조/캡션(.muted) | 12~13px | 500 | 0 | 1.45 | |
| 큰 숫자(metric .v, sum .v, 타이머) | 22~28px | 800 | -0.5px | 1.1 | **tabular-nums 필수** |
| 라벨(label.fld) | 12px | 600 | 0.2px | 1.3 | 약간 자간 |
| 버튼 | 15px | 800 | -0.2px | 1 | |
| nav 라벨 | 11px | 700 | 0 | 1 | |

전역 규칙 추가:
```css
/* 모든 숫자가 정렬되도록 — 입력칸·메트릭·타이머 공통 */
.elapsed-time,.rest-time,.iv-time,.metric .v,.sum .v,
input[type=number],.setline input,.stepper .val{font-variant-numeric:tabular-nums}
body{ -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility }
```
> weight 750은 CSS에 없으므로 700으로 두되, "숫자/타이틀은 800, 강조 라벨은 700" 2단계로만 운용(과한 weight 종류 금지 → 일관성).

---

## 3. 버튼 시스템

터치 타깃 **최소 44px 높이** 보장. 모든 버튼에 공통 트랜지션 + press 이펙트.

### 3.1 공통 베이스
```css
.btn{
  --btn-h:48px;
  min-height:var(--btn-h); padding:13px 16px;
  border:none; border-radius:16px; width:100%;
  font-weight:800; font-size:15px; letter-spacing:-.2px;
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  position:relative; overflow:hidden; /* ripple용 */
  transition:transform .12s cubic-bezier(.2,.7,.3,1), box-shadow .18s, filter .15s, background .15s;
}
.btn:disabled{opacity:.45; pointer-events:none}
```

### 3.2 1차(Primary) — 그라데이션
```css
.btn{ background:var(--grad-accent); color:var(--on-accent); box-shadow:var(--sh-accent) }
.btn:hover{ filter:brightness(1.03) }
.btn:active{ transform:translateY(1px) scale(.985); box-shadow:0 4px 12px -4px rgba(91,108,245,.5) }
```

### 3.3 2차(Secondary)
```css
.btn.sec{ background:var(--surface); color:var(--text); border:1px solid var(--line); box-shadow:var(--sh-1) }
.btn.sec:active{ transform:translateY(1px) scale(.985); background:var(--surface2) }
```

### 3.4 위험(Danger)
```css
.btn.danger{ background:transparent; color:var(--danger); border:1px solid var(--danger-soft); box-shadow:none }
.btn.danger:active{ background:var(--danger-soft); transform:scale(.985) }
```

### 3.5 작은 버튼 / 아이콘 버튼
```css
.btn.sm{ width:auto; min-height:40px; padding:9px 14px; font-size:13px; border-radius:12px }
.icon-btn{ width:42px; height:42px; border-radius:13px; background:var(--surface);
  border:1px solid var(--line); box-shadow:var(--sh-1);
  transition:transform .12s, background .15s }
.icon-btn:active{ transform:scale(.92); background:var(--surface2) }
```

### 3.6 칩(Chip) — 토글 + press
```css
.chip{ background:var(--surface); border:1px solid var(--line); border-radius:999px;
  padding:8px 15px; font-size:13px; font-weight:700; color:var(--muted); min-height:38px;
  transition:transform .12s, background .15s, color .15s, border-color .15s }
.chip:active{ transform:scale(.94) }
.chip.on{ background:var(--accent-soft); color:var(--accent-strong); border-color:transparent;
  box-shadow:inset 0 0 0 1.5px var(--accent) }
```

### 3.7 Ripple 마이크로 인터랙션 (선택, JS 6줄)
번핏에는 없지만 "요즘 감성" 핵심. CSS만으로는 클릭 위치 ripple이 어려워 **아주 작은 위임 핸들러** 1개로 처리(기능/데이터 무관, 순수 시각). 헤드리스 테스트 영향 없음.
```css
.btn .rip{position:absolute;border-radius:50%;transform:scale(0);pointer-events:none;
  background:rgba(255,255,255,.45);animation:rip .5s ease-out forwards}
.btn.sec .rip,.chip .rip{background:rgba(91,108,245,.18)}
@keyframes rip{to{transform:scale(2.6);opacity:0}}
```
```js
// document 위임 1회 바인딩. .btn/.chip 클릭 시 좌표 기반 원형 파동.
document.addEventListener('pointerdown',e=>{
  const b=e.target.closest('.btn,.chip'); if(!b||b.disabled)return;
  const r=b.getBoundingClientRect(), d=Math.max(r.width,r.height);
  const s=document.createElement('span'); s.className='rip';
  s.style.width=s.style.height=d+'px';
  s.style.left=(e.clientX-r.left-d/2)+'px'; s.style.top=(e.clientY-r.top-d/2)+'px';
  b.appendChild(s); setTimeout(()=>s.remove(),500);
});
```
> `prefers-reduced-motion`이면 이 리스너를 등록하지 않거나 `.rip` 애니메이션을 무효화(6장 참고).

---

## 4. 카드 / 표면 / 떠 있는 요소

### 4.1 카드
번핏 대비 radius를 키우고 색조 있는 soft shadow 적용.
```css
.card{ background:var(--surface); border:1px solid var(--line); border-radius:22px;
  padding:18px; margin-bottom:14px; box-shadow:var(--sh-1) }
.card h2{ font-size:16px; font-weight:700; color:var(--text-strong); letter-spacing:-.2px;
  display:flex; align-items:center; gap:8px; margin:0 0 14px }
.card h2 .tag{ margin-left:auto; font-size:12px; font-weight:700; color:var(--accent-strong);
  background:var(--accent-soft); padding:3px 10px; border-radius:999px } /* "기록됨/볼륨" 뱃지 → 알약형 */
```
- 내부 박스(`.ex` `.sum` `.rt-card` `.stepper` 등): `background:var(--surface2); border:1px solid var(--line-soft); border-radius:14px`.
- 환영 카드: `background:linear-gradient(135deg,var(--accent-soft),var(--accent-soft-2)); border-color:transparent`.

### 4.2 입력칸
```css
input[type=text],input[type=number],select,textarea{
  background:var(--surface2); border:1.5px solid transparent; border-radius:12px;
  padding:12px 13px; transition:border-color .15s, background .15s, box-shadow .15s }
input:focus,select:focus,textarea:focus{
  background:var(--surface); border-color:var(--accent);
  box-shadow:0 0 0 3px var(--accent-soft) } /* 포커스 링 */
::placeholder{color:var(--faint)}
```

### 4.3 시트(Bottom Sheet)
```css
.sheet{ border-radius:24px 24px 0 0; box-shadow:var(--sh-3); border:none;
  padding-top:8px; }
/* 드래그 핸들(번핏 시트 상단 그립 재현) */
.sheet::before{ content:""; display:block; width:40px; height:5px; border-radius:999px;
  background:var(--surface3); margin:0 auto 14px }
.sheet-bg{ background:rgba(14,17,22,.42); backdrop-filter:blur(2px) }
```

### 4.4 토스트
```css
.toast{ background:var(--chip-dark); color:#fff; border:none; border-radius:14px;
  padding:12px 18px; font-weight:600; box-shadow:var(--sh-3);
  transform:translateX(-50%) translateY(8px); transition:opacity .25s, transform .25s }
.toast.show{ transform:translateX(-50%) translateY(0) } /* 살짝 떠오르며 등장 */
```

### 4.5 떠 있는 바(경과시간/휴식/인터벌/FAB)
공통: radius 16, `box-shadow:var(--sh-2)`, 1차 그라데이션은 운동종료·휴식바 같은 강조 컨텍스트에만.
```css
.elapsed-bar,.rest-fab{ border-radius:16px; box-shadow:var(--sh-2); border:1px solid var(--line) }
.rest-fab{ border-radius:50%; transition:transform .15s, box-shadow .15s }
.rest-fab:active{ transform:scale(.9) }
.elapsed-end{ background:var(--grad-accent); border-radius:12px; box-shadow:none }
.rest-bar{ background:var(--grad-accent); border-radius:16px; box-shadow:var(--sh-accent) }
.rest-bar.warn{ background:linear-gradient(135deg,#F0556A,#F5728A) }
.iv-bar{ background:linear-gradient(135deg,#16B981,#34C79A); border-radius:16px }
.iv-bar.rest{ background:var(--grad-accent) }
.iv-bar.done{ background:linear-gradient(135deg,#F5A524,#FBBF4A) }
```
- 등장 시 아래에서 떠오르도록(6장 `floatUp` 키프레임).

---

## 5. 하단 탭 (Bottom Nav)

번핏은 미선택 회색 / 선택 파랑 텍스트+아이콘. BULCUP은 **선택 시 알약형 인디케이터(soft 배경)** 와 아이콘 살짝 튀어오르는 마이크로 모션을 추가해 더 트렌디하게.

```css
nav{ background:rgba(255,255,255,.94); backdrop-filter:blur(14px) saturate(1.3);
  border-top:1px solid var(--line); box-shadow:0 -2px 12px rgba(16,21,40,.04) }
nav button{ color:var(--faint); gap:4px; font-size:11px; font-weight:700;
  transition:color .18s; position:relative }
nav button .ico{ font-size:22px; line-height:1; transition:transform .22s cubic-bezier(.34,1.56,.64,1) }
nav button.active{ color:var(--accent) }
nav button.active .ico{ transform:translateY(-2px) scale(1.12) } /* 활성 아이콘 팝업 */
/* 활성 알약 인디케이터: 아이콘 뒤 soft 배경 */
nav button::before{ content:""; position:absolute; top:6px; width:46px; height:30px;
  border-radius:999px; background:transparent; transition:background .2s; z-index:-1 }
nav button.active::before{ background:var(--accent-soft) }
```
> 현재 nav가 이모지 아이콘이라면 유지 가능하나(투데이📅/운동🏋️/분석📊/프로필👤), 톤 통일을 위해 **선형(outline) SVG 아이콘**으로 교체하면 번핏 수준의 정돈된 느낌(아래 7.4 옵션). v1에선 이모지 유지 + 인디케이터만으로도 충분.

---

## 6. 전역 모션

원칙: **빠르고 절제(120~260ms)**, 진입은 ease-out, 강조 팝은 약한 spring. 성능을 위해 `transform/opacity`만 애니메이트.

### 6.1 키프레임
```css
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes floatUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes popIn{0%{opacity:0;transform:scale(.96)}100%{opacity:1;transform:scale(1)}}
```

### 6.2 적용
- **탭 전환**: `#view`에 이미 `.fade` 부여 중 → 유지하되 위 `fade`로 교체(살짝 위로 떠오름).
- **리스트 추가**(세트/운동/식단 추가): 새로 그려지는 카드/행에 `animation:popIn .22s ease-out`. (renderAll가 통째로 다시 그리므로, "방금 추가한 항목"만 표시하려면 추가 직후 해당 요소에 1회 클래스 부여 — 비용 크면 v1은 전체 `.fade`로 충분.)
- **시트 슬라이드**: 현재 `transform:translateY(100%)→0` 유지, transition `.28s cubic-bezier(.2,.8,.2,1)`로 부드럽게.
- **떠있는 바 등장**: `.show` 될 때 `animation:floatUp .26s ease-out`.
- **체크/완료 토글**(`.set-check.on`,`.check.on`): `transition:transform .12s; :active{transform:scale(.85)}` + 켜질 때 `popIn`.
- **진행바**(`.goalfill`): 현재 `transition:width .3s` 유지(달성 시 `--good`로 색 전환 `.3s`).

### 6.3 reduced-motion 배려
```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{ animation-duration:.001ms!important; animation-iteration-count:1!important;
    transition-duration:.001ms!important; scroll-behavior:auto!important }
}
```
> 이 경우 ripple 리스너도 등록하지 않도록 JS에서 `matchMedia('(prefers-reduced-motion:reduce)').matches` 가드.

---

## 7. 앱 아이콘 (홈화면)

### 7.1 현재 문제
`icon.svg`는 다크 배경(`#0f1115`) + 초록 덤벨 + 파란 점 → 라이트 리프레시/새 강조색과 불일치.

### 7.2 새 컨셉 — "BULCUP 에너지 컵"
방향: **밝은 그라데이션 배경 + 심볼 1개**. "BULCUP"의 컵(cup=성취 트로피/프로틴컵 중의성) 또는 **상승 에너지 마크**를 단순 기하로. 번핏 로고 복제 금지 → 완전 오리지널 기하 도형.

권장안(개발자가 SVG로 바로 그릴 수 있게):
- **배경**: 라운드 사각(rx=112) 그라데이션 `#5B6CF5 → #7C5CFB`(앱 그라데이션과 동일) — 홈화면에서 밝고 눈에 띔.
- **심볼**: 흰색 **상승 화살/펄스 형태** 또는 **컵 실루엣**. 가장 단순·트렌디한 건 "위로 솟는 둥근 막대 3개(미니 바차트=성장)" 또는 "체크 안에 든 상승선". v1 1순위는 아래 막대형(성장·기록 앱 정체성 명확, 그릴 코드 단순).
- **악센트 점**: 우상단에 작은 흰 점 또는 `--good` 점으로 생기.

### 7.3 `app/icon.svg` 새 안 (그대로 사용 가능)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5B6CF5"/>
      <stop offset="1" stop-color="#7C5CFB"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <!-- 성장 막대 3개 (흰색, 라운드) : 낮음→높음 -->
  <g fill="#FFFFFF">
    <rect x="120" y="300" width="64" height="92"  rx="24"/>
    <rect x="224" y="232" width="64" height="160" rx="24"/>
    <rect x="328" y="150" width="64" height="242" rx="24"/>
  </g>
  <!-- 상승 포인트 점 (에메랄드 악센트) -->
  <circle cx="360" cy="120" r="26" fill="#16B981"/>
</svg>
```
대안(컵/트로피 선호 시): 가운데 흰색 라운드 컵 실루엣(반원+받침) + 위에 에메랄드 점. 위 막대안이 "기록 앱" 정체성과 더 맞아 1순위.

### 7.4 `app/make_icons.py` 갱신 가이드
현재 파일은 덤벨 좌표를 직접 그린다. 새 컨셉에 맞춰 상수/도형 교체:
- 색 상수:
  ```python
  G1=(91,108,245)   # #5B6CF5
  G2=(124,92,251)   # #7C5CFB  (대각 그라데이션 근사)
  WHITE=(255,255,255)
  GREEN=(22,185,129) # #16B981
  ```
- 배경: 단색 PIL은 그라데이션이 번거로우므로 **대각 선형 그라데이션을 픽셀 보간**으로 채운 뒤 둥근 사각 마스크 적용. 간단 버전은 G1·G2 중간색 단색으로도 무방(슈퍼샘플 유지).
  ```python
  # 대각 그라데이션 + 라운드 마스크 (슈퍼샘플 S 적용)
  from PIL import Image, ImageDraw
  def grad_rounded(size, r, c1, c2):
      w=h=size
      base=Image.new("RGB",(w,h))
      px=base.load()
      for y in range(h):
          for x in range(w):
              t=(x+y)/(w+h)
              px[x,y]=tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3))
      mask=Image.new("L",(w,h),0)
      ImageDraw.Draw(mask).rounded_rectangle([0,0,w-1,h-1],radius=r,fill=255)
      out=Image.new("RGBA",(w,h),(0,0,0,0)); out.paste(base,(0,0),mask); return out
  ```
  (성능: 512*S 픽셀 루프가 느리면 256에서 그린 뒤 LANCZOS 업스케일.)
- 도형: 위 SVG 좌표(막대 3개 + 점)를 `rr()`/`ellipse`로 동일하게.
- 출력은 기존대로 `icon-512/192/180.png`.
- **maskable 안전영역**: 심볼이 가장자리 잘려도 되도록 막대/점을 중앙 80% 영역 안에 배치(위 좌표는 OK). manifest의 maskable 512 그대로 사용.

### 7.5 manifest / theme 맞춤
```json
"background_color":"#F6F7F9",
"theme_color":"#F6F7F9"
```
- `index.html`의 `<meta name="theme-color" content="#F6F7F9">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">` 유지.
- `apple-touch-icon`은 새 `icon-180.png`로 자동 반영(파일만 재생성).

---

## 8. 화면별 일관성 점검

번핏 참고 + 현재 BULCUP 4탭(투데이/운동/분석/프로필) 기준. **레이아웃·기능 변경 없이** 위 토큰/컴포넌트가 모든 화면에 동일 적용되는지 체크리스트.

### 8.1 투데이(home)
- 환영 카드 → 8.1 그라데이션 soft(`--accent-soft → --accent-soft-2`).
- 주간 목표 진행바: 트랙 `--surface3`, 채움 `--accent`(달성 `--good`), 스텝 도트 hover/active scale.
- 달력: 오늘=그라데이션 원(`--grad-accent`), 운동일=`--accent-soft` 원, 선택=`--accent` 링. 마커 점 운동=`--accent`/식단=`--warn`.
- 체중/수면/식단/습관/신체 카드 모두 `.card` 공통 → 자동 통일.
- 빈 상태(empty): `.empty-ico` opacity .9, 텍스트 `--muted`, 그 아래 1차 버튼.

### 8.2 운동(workout)
- 운동 행(`.ex`): surface2 박스 + 부위 배지(부위 색 칩). 세트 완료 행 `--accent-soft` 배경.
- 세트 체크(`.set-check.on`)·완료 버튼: 그라데이션 또는 `--accent`. 토글 시 popIn.
- "운동 추가" 점선 박스: `--dash` 점선, 누르면 `--accent-soft` 잠깐 하이라이트.
- 하단 운동종료/완료 바: `.elapsed-bar` + 그라데이션 종료 버튼(4.5).

### 8.3 분석(stats)
- 차트(svg.chart): 라인/막대 색을 `--accent`(주), 보조 `--good`. 그리드 라인 `--line-soft`.
- 통계 카드들 `.card`/`.sum` 통일. "전월 대비" 증감 텍스트: 증가 `--good`/감소 `--danger` 또는 지표 성격에 맞게(체중은 반대) — 기존 로직 유지, 색 토큰만 교체.

### 8.4 프로필(me)
- 프로필 헤더 카드, 업적 그리드(`.sum` 2×2), 3대중량/신체정보/메뉴리스트 → 전부 `.card`+`.sum`.
- 메뉴 리스트 행(루틴/라이브러리/메모): `.rt-card` 스타일 재사용(좌 아이콘·우 chevron), `:active` 살짝 눌림.
- 설정 진입 버튼(`.icon-btn`) press 이펙트.

### 8.5 입력칸·플레이스홀더 통일
- 모든 input/select/textarea: 4.2 규칙(투명 테두리 → 포커스 시 링). 플레이스홀더 `--faint`.
- 숫자 입력은 `inputmode` 유지 + tabular-nums.

---

## 9. 구현 PR 분할안 (ROI 순)

> 전부 CSS/아이콘 중심. 기능·데이터·로직 무변경. 각 PR은 `feature/<이름>` 브랜치 → PR → 머지.

### PR-1 — 토큰·타이포·버튼·카드·입력 (가장 큰 ROI)
**내용**: 1·2·3·4장 적용. `:root` 토큰 교체, 폰트 위계/tabular-nums, `.btn`/`.chip`/`.icon-btn` 상태+press, `.card`/입력칸/시트/토스트 폴리시. `meta theme-color` + manifest 색 갱신.
**범위**: `app/index.html` `<style>` + 2개 메타/`manifest.json`.
**검증**:
- 헤드리스 스모크: 기존 테스트 전부 통과(클래스/구조 변경 없음 확인). DOM 셀렉터(`.btn`,`.card`,`.chip` 존재) 그대로.
- CSS 파싱: `index.html` 로드 시 콘솔 에러 0, `:root` 변수 참조 누락 없음(특히 `--accent2` 별칭 유지).
- **시각은 폰 수동**: 갤럭시 S25 PWA 설치 후 4탭·버튼 press·입력 포커스 링·시트/토스트 육안 확인(`preview_screenshot`는 timeout이므로 의존 금지).

### PR-2 — 모션·마이크로 인터랙션·하단 nav
**내용**: 5·6장 적용. nav 활성 인디케이터+아이콘 팝, 키프레임(fade/floatUp/popIn), 떠있는 바 등장 모션, 체크 토글 모션, `prefers-reduced-motion`, 선택적 ripple(3.7).
**범위**: `app/index.html` `<style>` (+ ripple 쓰면 `<script>` 위임 6줄).
**검증**:
- 헤드리스 스모크: ripple 추가 시 `pointerdown` 위임이 기존 클릭 핸들러를 막지 않음 단언(타이머 시작/세트 추가 등 핵심 흐름 여전히 동작). reduced-motion 가드로 테스트 환경(모션 없음)에서 예외 없음.
- 회귀: 타이머/시트/토스트 표시 토글 클래스(`.show`)가 그대로 동작.
- **시각은 폰 수동**: nav 전환 애니메이션, 시트 슬라이드, 토스트 떠오름, 버튼 ripple 육안 확인.

### PR-3 — 앱 아이콘 리프레시
**내용**: 7장 적용. `app/icon.svg` 교체, `app/make_icons.py` 도형/색 교체 후 `icon-192/512/180.png` 재생성, manifest icons 그대로(파일만 갱신).
**범위**: `app/icon.svg`, `app/make_icons.py`, 생성된 PNG 3종, (manifest 색은 PR-1에서 처리).
**검증**:
- `python app/make_icons.py` 실행 → 3개 PNG 생성/덮어쓰기 성공, 깨짐 없음(파일 크기 > 0, 192/512/180 해상도 확인).
- SVG 유효성: 브라우저/뷰어에서 렌더 확인.
- **시각은 폰 수동**: 홈화면에 PWA 재설치 → 아이콘이 밝은 그라데이션으로 보이는지, maskable(원형/스쿼클 마스크)에서 심볼 안 잘리는지 확인.

> 순서 권장: PR-1 → PR-2 → PR-3. PR-1만으로도 체감 리프레시의 70%가 끝남.

---

## 10. 적용 시 주의 (회귀 방지)

- 변수 이름 유지가 핵심: 기존 코드가 `--accent` `--accent-soft` `--accent-strong` `--good` `--warn` `--gold` `--danger` `--part-*` `--surface*` `--line*` `--text*` `--faint` `--muted` `--on-accent` `--accent2`를 직접 참조 → **값만** 바꾼다. 새 토큰(`--grad-accent` `--sh-*` 등)은 추가.
- `.btn`에 그라데이션 하드코딩된 인라인/별도 규칙(예: `.elapsed-end`,`.btn` background에 `#3B82F6`)을 토큰/`--grad-accent`로 교체.
- 재렌더(`renderAll`)가 `#view`를 통째로 다시 그림 → 모션은 "진입 애니메이션"(fade/popIn) 위주로, 상태 보존 필요한 타이머 오버레이는 `#view` 밖이라 영향 없음.
- localStorage 데이터·백업 호환과 무관(시각만 변경).
- 폰트 CDN 도입 금지: 시스템 스택으로 충분. weight는 800/700/500/400 4단계만 사용.

---

## 부록 A. 빠른 비교 (번핏 → BULCUP)
| 항목 | 번핏 | BULCUP v1 |
|---|---|---|
| 강조색 | 파랑 #3B82F6 계열 단색 | 인디고→바이올렛 그라데이션(#5B6CF5→#7C5CFB) |
| 배경 | 차가운 회청 + 라디얼 그라데이션 | 따뜻한 뉴트럴 #F6F7F9 |
| 카드 radius | ~16–20 | 22 |
| 그림자 | 옅은 회색 | 색조 있는 soft(보라끼) |
| 성공색 | 진한 그린 | 에메랄드 #16B981 |
| 위험색 | 빨강 | 코랄핑크 #F0556A |
| nav 활성 | 텍스트/아이콘 색만 | 알약 인디케이터 + 아이콘 팝 |
| 버튼 press | 거의 없음 | scale+shadow+ripple |
| 앱아이콘 | (다크 덤벨) | 밝은 그라데이션 + 성장 막대 |
