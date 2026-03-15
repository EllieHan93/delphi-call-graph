# Delphi Call Graph Analyzer

Delphi 프로젝트(`.dpr`)를 정적 분석하여 메소드 간 호출 관계를 시각화하는 웹 대시보드입니다.

## 주요 기능

- **.dpr / .pas 파싱**: 프로젝트 구조와 메소드 선언 + 본문 추출
- **콜 그래프 생성**: 메소드 간 호출 관계(caller / callee) 양방향 분석
- **사용/미사용 판별**: `callCount > 0`이면 사용, 0이면 미사용
- **대시보드 UI**:
  - **Overview**: 요약 카드 + 유닛별 사용률 차트
  - **Methods**: 필터/정렬/검색 가능한 메소드 테이블 + 상세 패널
  - **Call Graph**: depth 조절 가능한 인터랙티브 호출 그래프

## 기술 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | Python 3.12, FastAPI, Pydantic v2, uvicorn |
| 프론트엔드 | React 18, TypeScript, Vite, Tailwind CSS |
| 그래프 시각화 | React Flow (`@xyflow/react`) + dagre 레이아웃 |
| 테이블 | TanStack Table v8 |
| 테스트 (백엔드) | pytest + httpx |
| 테스트 (프론트) | Vitest + Testing Library |
| E2E | Playwright |
| CI/CD | GitHub Actions |

## 설치 및 실행

### 사전 요구사항

- Python 3.12+
- Node.js 20+

### 1. 백엔드

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

### 2. 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

브라우저: http://localhost:5173

### 3. 분석 실행

1. 브라우저에서 `.dpr` 파일의 **절대 경로** 입력
2. **분석 실행** 버튼 클릭
3. Overview / Methods / Call Graph 탭에서 결과 확인

샘플 프로젝트 경로 예시:
```
D:/Project/hackerton/samples/SampleApp.dpr
```

## 테스트

### 백엔드 단위 테스트

```bash
pytest --cov=backend --cov-report=term-missing -q
```

### 프론트엔드 컴포넌트 테스트

```bash
cd frontend
npm test
```

### E2E 테스트 (Playwright)

```bash
# 백엔드 + 프론트엔드 서버가 실행 중인 상태에서
npx playwright test
npx playwright show-report  # 결과 확인
```

## CLI 사용

```bash
# 파싱만 (JSON 출력)
python -m backend.cli samples/SampleApp.dpr

# 콜 그래프 분석 포함
python -m backend.cli samples/SampleApp.dpr --analyze

# 미사용 메소드만
python -m backend.cli samples/SampleApp.dpr --analyze --unused-only
```

## 프로젝트 구조

```
hackerton/
├── backend/
│   ├── main.py               # FastAPI 엔트리포인트
│   ├── cli.py                # CLI 엔트리포인트
│   ├── parser/
│   │   ├── tokenizer.py      # 주석/문자열 제거
│   │   ├── dpr_parser.py     # .dpr 파서
│   │   └── pas_parser.py     # .pas 파서
│   ├── analyzer/
│   │   ├── call_graph.py     # 콜 그래프 분석 엔진
│   │   └── models.py         # Pydantic 모델
│   ├── api/
│   │   ├── routes.py         # API 라우트 (6개 엔드포인트)
│   │   └── state.py          # 인메모리 상태 관리
│   ├── tests/                # pytest 테스트
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # 탭 기반 앱 루트
│   │   ├── components/
│   │   │   ├── ProjectInput.tsx    # .dpr 경로 입력
│   │   │   ├── SummaryCards.tsx    # 요약 카드 5개
│   │   │   ├── MethodTable.tsx     # 메소드 테이블
│   │   │   ├── MethodDetail.tsx    # 메소드 상세 패널
│   │   │   ├── CallGraph.tsx       # 콜 그래프 시각화
│   │   │   └── UnitChart.tsx       # 유닛별 사용률 차트
│   │   ├── hooks/useApi.ts   # API 클라이언트
│   │   └── types/index.ts    # TypeScript 타입 정의
│   └── package.json
├── samples/                  # 테스트용 샘플 Delphi 프로젝트
│   ├── SampleApp.dpr
│   └── src/
│       ├── MainUnit.pas
│       ├── DataModule.pas
│       └── Utils.pas
├── e2e/                      # Playwright E2E 테스트
├── docs/sprints/             # 스프린트별 태스크 문서
├── playwright.config.ts
├── CLAUDE.md
└── PRD.md
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/analyze` | 프로젝트 분석 실행 |
| GET | `/api/summary` | 분석 요약 통계 |
| GET | `/api/methods` | 메소드 목록 (필터/정렬/페이지네이션) |
| GET | `/api/methods/{id}` | 메소드 상세 (callers/callees/소스) |
| GET | `/api/callgraph/{id}` | 콜 그래프 서브그래프 (BFS depth) |
| GET | `/api/units` | 유닛별 통계 |

## 분석 한계

- **정적 텍스트 매칭 기반** — 런타임 동적 호출 미탐지
- **동일 이름 메소드** — 오탐 가능 (모든 후보에 연결)
- **외부 라이브러리** (`.dcu`) 내부 분석 불가
- **DFM 이벤트 바인딩** 미지원
