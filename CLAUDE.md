# 몸짱일지 (momzzang-ilji)

고형석 개인용 헬스 기록 PWA. 운동일지·식단·생활습관·신체변화를 기록한다.
"기능 적고, 무료고, 평생 내 거" 가 목표. 기존 헬스앱들의 기능 과잉·pro 결제에 대한 반작용으로 시작됨.

## 핵심 원칙
- **의존성 0, 빌드 0.** 순수 HTML/CSS/JS. npm 패키지·번들러·프레임워크 도입 금지(이게 평생 유지보수의 핵심).
- **로컬 우선.** 데이터는 브라우저 `localStorage`(키 `momzzang_v1`)에만. 서버·로그인·계정 없음.
- **모바일 우선, 한국어 UI.** 폰에서 한 손으로 쓰는 화면. 카피·라벨은 한국어, 격려하는 톤.
- **과설계 금지.** 요청된 것만. 추상화·설정 옵션은 실제로 두 번째 사용처가 생길 때만.

## 구조 (단일 파일 앱)
- `index.html` — 앱 전체(인라인 CSS + JS). 탭: 홈/운동/식단/습관/신체 + 휴식 타이머 오버레이.
- `manifest.json`, `sw.js`(오프라인 캐시 `momzzang-v1`), `icon.svg` + `icon-192/512/180.png`.
- `make_icons.py` — Pillow로 PNG 아이콘 생성. `serve.py` — 로컬 멀티스레드 서버.
- 코드가 ~1500줄 넘어 불편해지면 그때 모듈 분리 검토(지금은 단일 파일 유지).

## 데이터 모델 (`DB`)
```
workouts: { 'YYYY-MM-DD': [ {name, sets:[{weight,reps}]} ] }
meals:    { 'YYYY-MM-DD': [ {type:'아침|점심|저녁|간식', memo, kcal, protein} ] }
habits:   { 'YYYY-MM-DD': { <habitId>: true | number } }
habitDefs:[ {id, name, type:'check'|'num', unit?, step?, icon} ]   // 사용자 편집 가능
body:     [ {date, weight, muscle, fat} ]
settings: { restDefault, autoRest, ... }   // 새 설정은 여기에. 기존 백업과 호환되게 항상 기본값 폴백.
```
- 렌더는 `renderAll()`이 `#view.innerHTML`를 통째로 다시 그림. **재렌더에도 살아남아야 하는 UI(타이머 등)는 `#view` 바깥 고정 오버레이로** 둘 것.
- 데이터 구조 변경 시 기존 사용자 백업(JSON)과의 호환을 깨지 말 것.

## 개발 워크플로 (사용자와 합의됨)
1. 기능마다 `feature/<이름>` 브랜치 생성
2. 작업 → 커밋 → 푸시 → **PR 오픈**(한국어 본문: 무엇/어떻게/리뷰 포인트/검증)
3. **Claude가 머지까지 담당**(`gh pr merge <n> --squash --delete-branch`) 후 사용자에게 보고. 사용자는 원하면 PR에서 리뷰.
4. 머지 → main → GitHub Pages 자동 배포(~1분)
- 커밋 author 고정: `git -c user.name="itshyeongseok" -c user.email="yohan001223@gmail.com"`
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## 테스트 (중요)
- **시각 미리보기(preview_screenshot)는 이 환경에서 계속 timeout** → 의존하지 말 것.
- 대신 헤드리스 스모크 테스트로 검증: vm + 관찰 가능한 DOM 스텁으로 `index.html`의 `<script>`를 실행하고 핵심 흐름을 단언.
  - 주의: `let DB`/`cur` 등은 vm 컨텍스트 밖으로 노출 안 됨 → 상태는 `localStorage`를 다시 읽거나 DOM 요소(textContent/classList)로 관찰.
  - `function` 선언만 컨텍스트에 노출됨(`G.quickEx` 등 호출 가능).
- **새 기능은 반드시 스모크 테스트를 추가하고 전부 통과시킨 뒤 PR**.

## 배포
- GitHub: `itshyeongseok/momzzang-ilji` (public), Pages = main 브랜치 루트, `.nojekyll`.
- 라이브: https://itshyeongseok.github.io/momzzang-ilji/

## 로드맵
1. ✅ 휴식 타이머 (PR #1)
2. 🏆 개인 최고기록(PR) 추적
3. 📋 루틴 템플릿(분할 저장/불러오기)
4. 📊 통계·그래프(부위별 볼륨, 주간 횟수, 캘린더)
- 이후: 데이터 저장을 **내 PC 자체 서버**로(Tailscale 터널로 폰 접속). AI 트레이너 코칭(Claude API, 키 보호용 소형 백엔드 필요).
