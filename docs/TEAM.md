# 몸짱일지 개발팀 (오케스트레이션 모델)

`AI_Study_Team`(NAVI 멀티에이전트 프레임워크)의 규칙을 차용해 구성. 단 그 repo 전용 FastAPI/SDK 백엔드·heritage seal·대시보드는 도입하지 않고, **Claude Code 네이티브 서브에이전트(Agent 도구)** 로 동일한 디스패치·PR 워크플로를 구현한다.

## 역할
| 역할 | 정의 | 하는 일 | 안 하는 일 |
|---|---|---|---|
| **NAVI (오케스트레이터)** | 메인 세션(=사용자와 대화하는 Claude) | 작업 분해, 에이전트 **병렬 디스패치**, 결과 통합·보고 | 직접 코딩/머지 안 함 (페르소나 금지·실제 위임) |
| **dev** | `.claude/agents/dev.md` | 기능 구현, 스모크 테스트, **PR 오픈** | 머지 |
| **reviewer** | `.claude/agents/reviewer.md` | PR 리뷰·테스트 검증·**머지** | 직접 구현 |
| **designer** | `.claude/agents/designer.md` | 참고 분석 → UI/기능 사양서 | 코드 작성 |

## 워크플로
```
NAVI가 작업 분해
  → designer(사양) ∥ dev(구현·PR)  ← 병렬, 독립 작업은 동시 디스패치
  → dev가 PR 오픈
  → reviewer가 리뷰·테스트·머지(squash, 브랜치 삭제)
  → main → GitHub Pages 자동 배포
  → NAVI가 사용자에게 보고
```

## 규칙 (AI_Study_Team에서 차용)
- 코드·커밋·브랜치명 = 영문. 문서·UI = 한국어.
- **main 직접 푸시 금지** — 기능은 전부 브랜치 + PR. (단 팀 설정 등 오케스트레이터 인프라는 NAVI가 직접 관리.)
- 브랜치: `feature/<task>` · 커밋: 영문 명령형 · author 고정(고형석).
- 에이전트 정의는 SSOT로 `.claude/agents/`에 두고 git으로 버전관리.
- 검증은 헤드리스 스모크 테스트(`smoke.js`)로 — 시각 미리보기 도구는 이 환경에서 timeout.
