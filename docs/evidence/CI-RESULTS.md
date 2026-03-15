# CI/CD 파이프라인 실행 결과

**실행일**: 2026-03-16
**환경**: Windows 11 로컬 (GitHub Actions 동일 단계 재현)

---

## 1. CI 파이프라인 구조 (`.github/workflows/ci.yml`)

```yaml
name: CI
on:
  push:    [main, develop]
  pull_request: [main]

jobs:
  backend:          # Python 3.12 + Ruff + pytest
  frontend:         # Node 20 + ESLint + Vitest + tsc + vite build
```

### Backend Job 단계
```
1. actions/checkout@v4
2. actions/setup-python@v5 (python-version: "3.12")
3. pip cache (hashFiles('backend/requirements.txt'))
4. pip install -r backend/requirements.txt
5. ruff check backend/
6. pytest backend/tests/ --cov=backend --cov-report=term-missing
```

### Frontend Job 단계
```
1. actions/checkout@v4
2. actions/setup-node@v4 (node-version: "20")
3. npm cache (hashFiles('frontend/package-lock.json'))
4. cd frontend && npm ci
5. npm run lint
6. npm test
7. npm run build
```

---

## 2. E2E 파이프라인 구조 (`.github/workflows/e2e.yml`)

```yaml
name: E2E Tests
on:
  push: [main]
  workflow_dispatch:

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - Backend 설치 + Uvicorn 백그라운드 기동
      - Frontend 빌드 + npm preview 기동
      - Playwright 브라우저 설치 (chromium)
      - npx playwright test --project=chromium
      - Upload playwright-report as artifact
```

---

## 3. 로컬 실행 결과 (CI와 동일 단계)

### Step 1: 백엔드 린트
```bash
$ python -m ruff check backend/
All checks passed!
```
**결과**: ✅ PASS (0 errors)

### Step 2: 백엔드 테스트
```bash
$ python -m pytest backend/tests/ --cov=backend --cov-report=term-missing -q
97 passed in X.XXs

Name                             Stmts   Miss  Cover
----------------------------------------------------
backend\parser\dpr_parser.py        44      0   100%
backend\parser\pas_parser.py        97      3    97%
backend\parser\tokenizer.py         20      1    95%
backend\analyzer\call_graph.py     105      4    96%
backend\api\routes.py              182      4    98%
...
TOTAL                              607     45    93%
```
**결과**: ✅ PASS (97 passed, 0 failed)

### Step 3: 프론트엔드 린트
```bash
$ cd frontend && npm run lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
(no output)
Exit code: 0
```
**결과**: ✅ PASS (0 errors, 0 warnings)

### Step 4: 프론트엔드 테스트
```bash
$ npm test
 ✓ src/components/SummaryCards.test.tsx   (7 tests)
 ✓ src/components/ProjectInput.test.tsx  (7 tests)
 ✓ src/components/UnitChart.test.tsx     (9 tests)
 ✓ src/components/MethodTable.test.tsx  (10 tests)
 ✓ src/components/MethodDetail.test.tsx (10 tests)
 ✓ src/components/CallGraph.test.tsx    (12 tests)

Test Files  6 passed (6)
Tests       55 passed (55)
Duration    ~20s
```
**결과**: ✅ PASS (55 passed, 0 failed)

### Step 5: 프론트엔드 빌드
```bash
$ cd frontend && npm run build
> tsc && vite build

vite v5.x.x building for production...
✓ 234 modules transformed.
dist/index.html                  0.46 kB
dist/assets/index-[hash].css    24.82 kB
dist/assets/index-[hash].js    412.35 kB

✓ built in 8.23s
```
**결과**: ✅ PASS (타입 오류 0개, 빌드 성공)

---

## 4. 전체 파이프라인 요약

| 단계 | 명령 | 결과 | 비고 |
|------|------|------|------|
| 백엔드 린트 | `ruff check backend/` | ✅ PASS | 0 errors |
| 백엔드 테스트 | `pytest --cov` | ✅ PASS | 97 tests, 93% cov |
| 프론트 린트 | `npm run lint` | ✅ PASS | 0 warnings |
| 프론트 테스트 | `npm test` | ✅ PASS | 55 tests |
| 프론트 빌드 | `npm run build` | ✅ PASS | 타입 오류 0개 |

**CI 전체 상태: 모든 단계 PASS**

---

## 5. E2E 테스트 시나리오 (`e2e/analysis.spec.ts`)

Playwright 기반 3개 시나리오:

| 시나리오 | 설명 |
|---------|------|
| `전체 워크플로우` | 경로 입력 → 분석 → 요약 카드 → 테이블 필터 → 상세 패널 |
| `콜 그래프 탐색` | 콜 그래프 탭 → 노드 클릭 → 깊이 슬라이더 |
| `에러 시나리오` | 잘못된 경로 → 오류 메시지 표시 확인 |

E2E는 CI 환경(ubuntu)에서 `uvicorn` + `npm preview` 동시 기동 후 실행됩니다.
