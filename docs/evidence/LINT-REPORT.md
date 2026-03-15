# 린트 실행 결과 보고서

**실행일**: 2026-03-16
**환경**: Windows 11, Python 3.13.3, Node.js 22.x

---

## 백엔드 — Ruff

### 실행 명령
```bash
python -m ruff check backend/
```

### 결과
```
All checks passed!
```

**상태**: ✅ 0 errors, 0 warnings

### Ruff 설정 (`pyproject.toml`)
```toml
[tool.ruff]
target-version = "py312"
line-length = 120
select = ["E", "F", "W", "I", "N", "UP", "B", "SIM"]
```

활성화된 규칙셋:
- `E` — pycodestyle errors
- `F` — pyflakes (미사용 import, 미정의 이름 등)
- `W` — pycodestyle warnings
- `I` — isort (import 정렬)
- `N` — pep8-naming (네이밍 컨벤션)
- `UP` — pyupgrade (Python 3.12+ 스타일)
- `B` — flake8-bugbear (잠재적 버그)
- `SIM` — flake8-simplify (코드 단순화)

### 검사 대상 파일
| 파일 | 상태 |
|------|------|
| `backend/__init__.py` | ✅ |
| `backend/__main__.py` | ✅ |
| `backend/main.py` | ✅ |
| `backend/cli.py` | ✅ |
| `backend/parser/__init__.py` | ✅ |
| `backend/parser/tokenizer.py` | ✅ |
| `backend/parser/dpr_parser.py` | ✅ |
| `backend/parser/pas_parser.py` | ✅ |
| `backend/analyzer/__init__.py` | ✅ |
| `backend/analyzer/models.py` | ✅ |
| `backend/analyzer/call_graph.py` | ✅ |
| `backend/api/__init__.py` | ✅ |
| `backend/api/routes.py` | ✅ |
| `backend/api/state.py` | ✅ |
| `backend/tests/conftest.py` | ✅ |
| `backend/tests/test_tokenizer.py` | ✅ |
| `backend/tests/test_dpr_parser.py` | ✅ |
| `backend/tests/test_pas_parser.py` | ✅ |
| `backend/tests/test_call_graph.py` | ✅ |
| `backend/tests/test_api.py` | ✅ |

---

## 프론트엔드 — ESLint

### 실행 명령
```bash
cd frontend && npm run lint
# = eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
```

### 결과
```
> delphi-call-graph-frontend@0.1.0 lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0

(no output = 0 errors)
Exit code: 0
```

**상태**: ✅ 0 errors, 0 warnings (`--max-warnings 0` 옵션으로 엄격 검사)

### ESLint 설정
- `@typescript-eslint/eslint-plugin` v7 적용
- TypeScript strict mode (`tsconfig.json`)
- 미사용 disable 지시어도 오류로 처리

### 검사 대상 파일
| 파일 | 상태 |
|------|------|
| `src/App.tsx` | ✅ |
| `src/main.tsx` | ✅ |
| `src/types/index.ts` | ✅ |
| `src/hooks/useApi.ts` | ✅ |
| `src/hooks/useDebounce.ts` | ✅ |
| `src/components/ProjectInput.tsx` | ✅ |
| `src/components/SummaryCards.tsx` | ✅ |
| `src/components/StatusBadge.tsx` | ✅ |
| `src/components/MethodTable.tsx` | ✅ |
| `src/components/MethodDetail.tsx` | ✅ |
| `src/components/CallGraph.tsx` | ✅ |
| `src/components/UnitChart.tsx` | ✅ |

---

## 요약

| 도구 | 대상 | 결과 | 오류 수 |
|------|------|------|---------|
| Ruff | Python 백엔드 20개 파일 | ✅ 통과 | 0 |
| ESLint | TypeScript 프론트엔드 12개 파일 | ✅ 통과 | 0 |

**전체 린트 상태: PASS**
