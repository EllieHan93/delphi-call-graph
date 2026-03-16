# Sprint 3: FastAPI REST API

> **목표**: 분석 엔진을 웹 API로 노출하여 프론트엔드에서 호출 가능하게 구성
> **산출물**: 모든 API 엔드포인트 동작 확인 (Swagger UI)

---

## 선행 조건
- Sprint 2 완료 (분석 엔진이 AnalysisResult를 반환)

---

## 태스크

### 3.1 FastAPI 앱 셋업 (`main.py`)
- [x] FastAPI 인스턴스 생성
- [x] CORS 미들웨어 설정 (프론트엔드 localhost 허용)
- [x] uvicorn 실행 스크립트

### 3.2 인메모리 상태 관리
- [x] 마지막 분석 결과를 메모리에 저장하는 싱글턴/글로벌 객체
- [x] 분석 실행 시 이전 결과 교체

### 3.3 API 엔드포인트 (`routes.py`)

#### `POST /api/analyze`
- [x] Request body: `{ "dprPath": "..." }`
- [x] .dpr 경로 유효성 검증
- [x] 파서 + 분석 엔진 실행
- [x] 결과 저장 후 요약 통계 반환
- [x] 에러 응답: 파일 미존재, 파싱 실패 등

#### `GET /api/summary`
- [x] 마지막 분석 결과의 요약 카드 데이터 반환
- [x] 분석 전이면 404 반환

#### `GET /api/methods`
- [x] 쿼리 파라미터: `unit`, `status` (used/unused/all), `search`, `sort`, `order`
- [x] 필터링 + 정렬 적용된 메소드 목록 반환
- [x] 페이지네이션: `page`, `pageSize` 파라미터

#### `GET /api/methods/{id}`
- [x] 특정 메소드 상세: 시그니처, callers, callees, 본문 코드
- [x] 없는 id면 404

#### `GET /api/callgraph/{id}`
- [x] 쿼리 파라미터: `depth` (기본값 2)
- [x] 지정 메소드 중심 서브그래프 반환
- [x] 응답 형식: `{ nodes: [...], edges: [...] }`

#### `GET /api/units`
- [x] 유닛별 통계: 유닛명, 메소드 수, 사용 수, 미사용 수, 사용률

### 3.4 에러 핸들링
- [x] 글로벌 예외 핸들러
- [x] 일관된 에러 응답 포맷: `{ "error": "message" }`

### 3.5 테스트
- [x] 각 엔드포인트 단위 테스트 (httpx + pytest)
  - 정상 응답, 404, 잘못된 입력 등 경로별 커버
- [x] 통합 테스트: 샘플 .dpr → `POST /api/analyze` → `GET /api/summary` → `GET /api/methods` 전체 플로우
- [x] API 라우트 커버리지 목표 ≥ 80%

### 3.6 CI/CD 파이프라인 초안
- [x] `.github/workflows/ci.yml` 작성
  - Ruff 린트 (Python)
  - pytest 실행 (단위 + 통합)
  - 트리거: push, PR
- [x] `pyproject.toml`에 pytest 설정 (커버리지 리포트 포함)

---

## 검증 결과 (2026-03-16)

| 항목 | 결과 |
|------|------|
| `pytest` (Sprint 1~3 누적) | ✅ 103 passed (0.43s) |
| `tsc --noEmit` | 해당 없음 (프론트엔드 미구현) |
| 백엔드 전체 커버리지 | ✅ 91% |
| `api/routes.py` 커버리지 | ✅ 90% |

---

## 완료 조건 (Definition of Done)

- [x] `uvicorn backend.main:app` 으로 서버 기동
- [x] Swagger UI (`/docs`)에서 모든 엔드포인트 테스트 가능
- [x] 샘플 .dpr 경로로 분석 실행 → 결과 조회 플로우 동작
- [x] CORS로 `localhost:5173` (Vite dev) 허용
- [x] pytest 통과 (API 라우트 커버리지 ≥ 80%)
- [x] GitHub Actions CI 워크플로우 동작 확인 (lint + test)

---

## 의사결정 기록 (Decision Records)

### DR-3.1: Flat API vs Resource-based API

**결정**: Flat API (`/api/summary`, `/api/methods`) 채택

**이유**:
- 단일 세션 인메모리 저장 구조에서 analysis_id 관리 오버헤드가 불필요
- `GET /api/analysis/{uuid}/summary` 형태는 UUID를 프론트엔드에서 보관해야 함
- 토이 프로젝트 특성: 마지막 분석 결과 1개만 유지, 멀티 세션 불필요

**결과**: 프론트엔드 코드 단순화, API 호출 시 analysis_id 전달 로직 생략

### DR-3.2: 인메모리 싱글턴 상태 관리

**결정**: 글로벌 변수 패턴 (`_analysis_state: AnalysisResult | None`)

**이유**:
- DB 연결 없는 토이 프로젝트 → SQLite조차 오버엔지니어링
- 서버 재시작 시 초기화 허용 (개발자 도구 특성)
- FastAPI의 단일 프로세스 내 공유 가능

---

## 회고 (Retrospective)

### 잘된 점
- Pydantic v2 `alias_generator=to_camel`로 camelCase 직렬화 자동화
- httpx + pytest-asyncio 조합으로 비동기 API 테스트 원활

### 개선할 점
- 초기에 response model을 명시하지 않아 Swagger 문서 품질이 낮았음 → 수정
- 커버리지 제외 라인(`cli.py`) 처리를 더 명확히 문서화 필요

### 예상 vs 실제 소요 시간
- 예상: API 구현 3시간
- 실제: 4시간 (camelCase 직렬화 설정 + 테스트 인프라 구축)

---

## API 응답 예시

### `GET /api/summary`
```json
{
  "projectName": "MyApp",
  "totalUnits": 5,
  "totalMethods": 42,
  "usedCount": 35,
  "unusedCount": 7,
  "unusedRatio": 16.67
}
```

### `GET /api/units`
```json
[
  {
    "name": "Unit1",
    "filePath": "C:/projects/MyApp/src/Unit1.pas",
    "totalMethods": 12,
    "usedMethods": 10,
    "unusedMethods": 2,
    "usageRate": 83.33
  }
]
```
