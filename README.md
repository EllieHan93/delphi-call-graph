# Delphi Static Call Graph Analyzer

Delphi 프로젝트(.dpr)를 입력받아 `.pas` 파일들을 정적 분석하고, **메소드 간 호출 관계(Call Graph)**를 추출하여 사용/미사용 메소드를 식별하는 웹 대시보드.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **콜 그래프 분석** | `.dpr` 프로젝트 전체 `.pas` 파일을 정적 분석하여 메소드 간 호출 관계 추출 |
| **사용/미사용 식별** | `callCount == 0`인 Dead Code를 자동 탐지 |
| **인터랙티브 그래프** | React Flow 기반 콜 그래프 시각화 (depth 조절, 노드 클릭 탐색) |
| **유닛별 분석** | 유닛 단위 사용률 바 차트 |
| **순환 참조 탐지** | DFS 기반 사이클 탐지, 그래프에서 빨간 점선으로 표시 |
| **코드 복잡도 히트맵** | 메소드별 복잡도 점수(0~100) 계산 + 트리맵 시각화 |

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 백엔드 | Python 3.12+, FastAPI, uvicorn, Pydantic v2 |
| 파서 | Python regex 기반 커스텀 Delphi 파서 |
| 프론트엔드 | React 18 + TypeScript, Vite, Tailwind CSS |
| 그래프 시각화 | React Flow |
| 테이블 | TanStack Table |
| 테스트 | pytest + httpx, Vitest + Testing Library, Playwright |
| CI/CD | GitHub Actions |

## 설치 및 실행

### 백엔드

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 서버 실행
uvicorn backend.main:app --reload --port 8000
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### CLI 사용

```bash
python -m backend.cli path/to/MyProject.dpr
```

## API 엔드포인트

| 메소드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/analyze` | `.dpr` 경로로 프로젝트 분석 실행 |
| `GET` | `/api/summary` | 분석 요약 통계 (순환 참조 수 포함) |
| `GET` | `/api/methods` | 메소드 목록 (필터/정렬/검색 지원) |
| `GET` | `/api/methods/{id}` | 특정 메소드 상세 (callers, callees, source) |
| `GET` | `/api/callgraph/{id}` | 메소드 중심 콜 그래프 (`?depth=N`) |
| `GET` | `/api/units` | 유닛별 통계 (메소드 수, 사용률) |
| `GET` | `/api/cycles` | 순환 참조 목록 `{ cycles: [[id, ...], ...], count: N }` |
| `GET` | `/api/complexity` | 유닛별 복잡도 집계 (트리맵용) |

## 분석 한계

- 정적 텍스트 매칭 기반 — 런타임 동적 호출(RTTI, 메시지 핸들러 등) 미탐지
- 동일 이름 메소드 구분 불가 (오탐 가능)
- 외부 라이브러리(`.dcu`) 내부 분석 불가
- DFM 이벤트 핸들러 바인딩 미지원

## 테스트 실행

```bash
# 백엔드 단위/통합 테스트
cd backend
pytest

# 프론트엔드 컴포넌트 테스트
cd frontend
npm test

# E2E 테스트
npx playwright test
```

### 커버리지 현황 (Sprint 7 기준)

| 레이어 | 커버리지 |
|--------|----------|
| 전체 백엔드 | 91% |
| `analyzer/call_graph.py` | 96% |
| `analyzer/complexity.py` | 91% |
| 프론트엔드 컴포넌트 | ≥70% |

## 프로젝트 구조

```
hackerton/
├── backend/
│   ├── main.py               # FastAPI 엔트리
│   ├── cli.py                # CLI 엔트리포인트
│   ├── parser/
│   │   ├── dpr_parser.py     # .dpr 파일 파서
│   │   ├── pas_parser.py     # .pas 파일 파서
│   │   └── tokenizer.py      # 주석/문자열 제거
│   ├── analyzer/
│   │   ├── call_graph.py     # 콜 그래프 + 순환 참조 탐지 엔진
│   │   ├── complexity.py     # 코드 복잡도 계산 모듈
│   │   └── models.py         # Pydantic 데이터 모델
│   ├── api/
│   │   └── routes.py         # API 라우트
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── ProjectInput.tsx
        │   ├── SummaryCards.tsx   # 순환 참조 카드 포함
        │   ├── MethodTable.tsx
        │   ├── MethodDetail.tsx
        │   ├── CallGraph.tsx      # 사이클 엣지 빨간 점선
        │   ├── UnitChart.tsx
        │   └── ComplexityMap.tsx  # 복잡도 히트맵 (신규)
        ├── hooks/useApi.ts
        └── types/index.ts
```

## 관련 문서

- [PRD.md](PRD.md) — 제품 요구사항 및 기능 명세
- [CLAUDE.md](CLAUDE.md) — AI 에이전트 컨텍스트 및 개발 컨벤션
- [docs/sprints/](docs/sprints/) — 스프린트별 태스크 이력
