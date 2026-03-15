# Delphi Static Call Graph Analyzer

## 프로젝트 개요
Delphi 프로젝트(.dpr)를 입력받아 .pas 파일들을 정적 분석하고, 메소드 간 호출 관계(Call Graph)를 추출하여 사용/미사용 메소드를 식별하는 웹 대시보드.

## 기술 스택
- **백엔드**: Python 3.12+, FastAPI, uvicorn, Pydantic
- **파서**: Python regex 기반 커스텀 Delphi 파서
- **프론트엔드**: React + TypeScript, Vite, Tailwind CSS
- **그래프 시각화**: React Flow
- **테이블**: TanStack Table
- **데이터 저장**: In-memory (DB 없음, 토이 프로젝트)
- **테스트**: pytest + httpx (백엔드), Vitest + Testing Library (프론트), Playwright (E2E)
- **CI/CD**: GitHub Actions (lint → test → build → E2E)
- **Lint**: Ruff (Python), ESLint + Prettier (TypeScript)

## 프로젝트 구조
```
hackerton/
├── CLAUDE.md
├── PRD.md                    # 제품 요구사항 문서
├── docs/sprints/             # 스프린트별 태스크 관리
│   ├── SPRINT-1.md           # 파서 코어 (.dpr/.pas)
│   ├── SPRINT-2.md           # 콜 그래프 분석 엔진
│   ├── SPRINT-3.md           # FastAPI REST API
│   ├── SPRINT-4.md           # 대시보드 기본 UI
│   ├── SPRINT-5.md           # 콜 그래프 시각화
│   └── SPRINT-6.md           # 유닛별 분석 + 마무리
├── backend/
│   ├── main.py               # FastAPI 엔트리
│   ├── cli.py                # CLI 엔트리포인트
│   ├── parser/
│   │   ├── dpr_parser.py     # .dpr 파일 파서
│   │   ├── pas_parser.py     # .pas 파일 파서
│   │   └── tokenizer.py      # 주석/문자열 제거
│   ├── analyzer/
│   │   ├── call_graph.py     # 콜 그래프 생성 엔진
│   │   └── models.py         # Pydantic 데이터 모델
│   ├── api/
│   │   └── routes.py         # API 라우트
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/       # ProjectInput, SummaryCards, MethodTable, etc.
    │   ├── hooks/useApi.ts
    │   └── types/index.ts
    ├── package.json
    └── tailwind.config.js
```

## 개발 컨벤션

### 백엔드 (Python)
- Python 3.12+ 사용
- FastAPI + Pydantic v2 모델
- 테스트: pytest + httpx (async)
- 가상환경: `backend/` 디렉토리 내 venv
- 실행: `uvicorn backend.main:app --reload --port 8000`
- CLI: `python -m backend.cli <path-to-dpr>`

### 프론트엔드 (React)
- Vite + React 18 + TypeScript strict mode
- Tailwind CSS (유틸리티 클래스 우선)
- 컴포넌트: 함수형 컴포넌트 + hooks
- API 호출: fetch 기반 커스텀 훅 (`useApi.ts`)
- 개발 서버: `npm run dev` (포트 5173)

### 디자인 시스템 (Tailwind 매핑)
- 디자인 토큰은 PRD §6에 정의, `tailwind.config.js`의 `extend`에 매핑
- 색상: Primary(blue-600), Success(green-600), Danger(red-600), Neutral 스케일
- 폰트: Pretendard(본문), JetBrains Mono(코드)
- 간격: Tailwind 기본 스케일 사용 (4px 배수)
- 상태 배지: 사용(green pill) / 미사용(red pill) — 색상+텍스트+아이콘 중복 표현
- 접근성: WCAG 2.1 AA 대비비, focus-visible 링, ARIA 레이블 필수

### 테스트 컨벤션
- 백엔드 테스트: `backend/tests/` 디렉토리, `test_*.py` 네이밍
- 프론트 테스트: `*.test.tsx` 또는 `*.test.ts` 컴포넌트 옆 배치
- E2E: `e2e/` 디렉토리, Playwright
- 테스트 실행: `pytest` (백엔드), `npm test` (프론트), `npx playwright test` (E2E)
- 커버리지 목표: 파서 ≥90%, 분석 ≥85%, API ≥80%, 컴포넌트 ≥70%

### 공통
- 한국어 주석/문서, 영문 코드(변수명, 함수명)
- 커밋 메시지: 한국어 허용, `[Sprint-N]` 접두사
- 에러 메시지: 사용자향은 한국어, 로그는 영문

## 핵심 도메인 용어
- **Unit**: Delphi의 .pas 파일 단위 (모듈)
- **Method**: procedure, function, constructor, destructor
- **Caller**: 특정 메소드를 호출하는 쪽
- **Callee**: 특정 메소드가 호출하는 대상
- **Call Count**: 해당 메소드가 호출당하는 총 횟수
- **Used/Unused**: callCount > 0이면 사용, 0이면 미사용

## 분석 범위 및 한계
- 정적 텍스트 매칭 기반 (런타임 동적 호출 미탐지)
- 동일 이름 메소드 구분 불가 (오탐 가능)
- 외부 라이브러리(.dcu) 내부 분석 불가
- DFM 이벤트 바인딩 v1 미지원
- 주석/문자열 내부는 분석 대상에서 제외

## 문서화 체계

### 프로젝트 문서 구조
```
hackerton/
├── CLAUDE.md          # AI 컨텍스트 — 프로젝트 맥락, 컨벤션, 진행 상태 (이 파일)
├── PRD.md             # 제품 정의 — 문제 정의, 목표, 기능 명세, 검증 계획
└── docs/sprints/      # 개발 진행 — 스프린트별 태스크, 완료 조건
    ├── SPRINT-1.md    #   파서 코어
    ├── SPRINT-2.md    #   콜 그래프 엔진
    ├── SPRINT-3.md    #   REST API
    ├── SPRINT-4.md    #   대시보드 기본 UI
    ├── SPRINT-5.md    #   콜 그래프 시각화
    └── SPRINT-6.md    #   유닛별 분석 + 마무리
```

### 각 문서의 역할
| 문서 | 역할 | 평가 관점 |
|------|------|-----------|
| `PRD.md` | 문제 정의, 목표, 기능 명세, 차별화, 검증 계획, 성공 지표 | 프로젝트 정의 + 아이디어 가치 + 검증 계획 |
| `CLAUDE.md` | AI 에이전트 컨텍스트, 기술 스택, 컨벤션, 진행 상태 | AI 컨텍스트 + 개발 기록 |
| `SPRINT-*.md` | 스프린트별 태스크 체크리스트, DoD, 산출물 | 개발 진행 기록 추적 |
| Git 커밋 이력 | 코드 변경의 시간순 기록 | 개발 과정 추적 가능성 |

### 개발 기록 전략
- **스프린트 문서**: 태스크 체크리스트로 진행 상태 추적 (완료 시 체크)
- **Git 커밋**: 스프린트 태스크 단위로 커밋, 메시지에 스프린트 번호 포함
  - 예: `[Sprint-1] .dpr 파서 구현 — uses 절 파싱 + 경로 매핑`
- **CLAUDE.md 진행 상태**: 스프린트 레벨 진행 상태를 여기서 업데이트
- **PRD 검증 계획**: 각 스프린트 완료 시 검증 시나리오 결과 기록

## 평가 기준 대응 매핑

4개 평가 관점(PM, 디자인, 개발, QA)의 기준이 프로젝트 문서/코드 어디에서 충족되는지 매핑.

### 공통 영역 (4개 관점 모두 적용)

| 평가 영역 | 세부 기준 | 대응 위치 |
|-----------|----------|-----------|
| **AI/Native 문서화** — 프로젝트 정의 | PRD에 문제 정의, 목표, 기능 명세 기술 | `PRD.md` §1~§5 |
| **AI/Native 문서화** — AI 컨텍스트 | claude.md 존재 및 충실 작성 | `CLAUDE.md` (이 파일) |
| **AI/Native 문서화** — 개발 진행 기록 | 커밋 이력 + 문서 추적 | `docs/sprints/`, Git 커밋 (`[Sprint-N]` 접두사) |
| **기술 구현력** — 코드 품질 | 가독성, 일관성 | 개발 컨벤션 섹션 준수, Lint(Ruff/ESLint) 적용 |
| **기술 구현력** — 기술 스택 | 문제 적합성 | `PRD.md` §7 기술 스택 선정 이유 |
| **완성도 및 UX** — 완성도 | 핵심 기능 동작 | Sprint 1~6 DoD, E2E 테스트 |
| **완성도 및 UX** — 사용자 경험 | 자연스러운 흐름, 직관적 UI | `PRD.md` §4 사용자 스토리, §12.6 사용성 테스트 |
| **아이디어** — 문제 정의 | 실제적이고 가치 있는 문제 | `PRD.md` §2.1 현실의 문제 |
| **아이디어** — 차별화 | 기존 솔루션 대비 차별점 | `PRD.md` §2.2 차별화 테이블 |

### PM 고유

| 평가 기준 | 대응 위치 |
|----------|-----------|
| 가설 설정 | `PRD.md` §12.1 핵심 가설 (H1~H4) |
| 성공 지표 + 측정 방법 | `PRD.md` §12.2 성공 지표 테이블 |

### 디자인 고유

| 평가 기준 | 대응 위치 |
|----------|-----------|
| 시각적 일관성 — UI 컴포넌트 | `PRD.md` §6.2 컴포넌트 일관성 규칙 |
| 디자인 토큰 — 색상/간격/타이포 시스템화 | `PRD.md` §6.1 디자인 토큰 정의 |
| 접근성 — 색상 대비, 포커스, 스크린 리더 | `PRD.md` §6.3 접근성 테이블 |
| 사용성 테스트 계획 | `PRD.md` §12.6 사용성 테스트 계획 |
| 디자인 검토 프로세스 문서화 | `PRD.md` §6.4 디자인 검토 프로세스 |

### 개발 고유

| 평가 기준 | 대응 위치 |
|----------|-----------|
| 테스트 전략 — 단위/통합 테스트 존재 및 커버리지 | `PRD.md` §12.4 테스트 전략, `CLAUDE.md` 테스트 컨벤션 |
| CI/CD — 자동화 파이프라인 | `PRD.md` §12.5 CI/CD, `.github/workflows/` |

### QA 고유

| 평가 기준 | 대응 위치 |
|----------|-----------|
| 테스트 전략 — 단위/통합/E2E 체계 | `PRD.md` §12.4 테스트 전략 (3단계 분류) |
| 테스트 커버리지 — 핵심 기능 커버 | `PRD.md` §12.4 커버리지 목표 테이블 |
| 테스트 자동화 — 구현 또는 계획 | `PRD.md` §12.5 CI/CD (GitHub Actions 자동 실행) |

## 현재 진행 상태
- [x] PRD 작성 완료 (문제 정의, 기능 명세, 차별화, 검증 계획 포함)
- [x] 스프린트 문서 분리 완료 (6개 스프린트)
- [x] AI 컨텍스트 (CLAUDE.md) 작성 완료
- [x] Sprint 1: 파서 코어 — 완료
- [x] Sprint 2: 콜 그래프 분석 엔진 — 완료
- [x] Sprint 3: FastAPI REST API — 완료
- [x] Sprint 4: 대시보드 기본 UI — 완료
- [x] Sprint 5: 콜 그래프 시각화 — 완료
- [x] Sprint 6: 유닛별 분석 + 마무리 — 완료
