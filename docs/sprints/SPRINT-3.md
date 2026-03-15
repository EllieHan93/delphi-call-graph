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

## 완료 조건 (Definition of Done)

- [x] `uvicorn backend.main:app` 으로 서버 기동
- [x] Swagger UI (`/docs`)에서 모든 엔드포인트 테스트 가능
- [x] 샘플 .dpr 경로로 분석 실행 → 결과 조회 플로우 동작
- [x] CORS로 `localhost:5173` (Vite dev) 허용
- [x] pytest 통과 (API 라우트 커버리지 ≥ 80%)
- [x] GitHub Actions CI 워크플로우 동작 확인 (lint + test)

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
