# Sprint 7: 고도화 — 순환 참조 탐지 + 코드 복잡도 히트맵

> **목표**: 분석 엔진 고도화 (순환 참조 탐지, 코드 복잡도 분석) + 시각화 확장
> **산출물**: 순환 참조 경고 + 복잡도 트리맵이 추가된 대시보드

---

## 선행 조건
- Sprint 6 완료 (전체 대시보드 동작)

---

## 태스크

### 7.1 순환 참조 탐지 — 백엔드

#### 7.1.1 모델 확장
- [x] `AnalysisSummary`에 `cycle_count: int = 0` 필드 추가
- [x] `AnalysisResult`에 `cycles: list[list[str]] = []` 필드 추가

#### 7.1.2 사이클 탐지 로직
- [x] `call_graph.py`에 `_detect_cycles()` 함수 구현
  - DFS + back-edge 기반 사이클 탐지
  - 입력: 메소드 간 callee 인접 리스트
  - 출력: `list[list[str]]` (각 리스트는 사이클을 구성하는 메소드 ID 순서)
- [x] `analyze()` 함수 내 호출 링크 완료 후 `_detect_cycles()` 호출
- [x] 결과를 `AnalysisResult.cycles` 및 `AnalysisSummary.cycle_count`에 반영

#### 7.1.3 API 엔드포인트
- [x] `GET /api/cycles` → `{ cycles: [[methodId, ...], ...], count: N }`
- [x] `GET /api/summary` 응답에 `cycleCount` 필드 추가
- [x] `GET /api/callgraph/{id}` 응답 엣지에 `isCycle` 플래그 추가

#### 7.1.4 테스트
- [x] A→B→C→A 패턴 사이클 탐지 테스트
- [x] 사이클 없는 프로젝트에서 빈 결과 확인
- [x] 다중 사이클 탐지 확인
- [x] `TestDetectCycles` 6개 케이스 (`test_call_graph.py`)

### 7.2 순환 참조 탐지 — 프론트엔드

#### 7.2.1 타입 확장
- [x] `SummaryResponse`에 `cycleCount: number` 추가
- [x] `CycleResponse` 인터페이스 추가
- [x] `CallGraphEdge`에 `isCycle?: boolean` 추가

#### 7.2.2 요약 카드 확장
- [x] 6번째 카드 "순환 참조" 추가 (Warning/Amber 색상)
- [x] 0이면 Success(초록), 1 이상이면 Warning(오렌지)
- [x] 카드 그리드 `lg:grid-cols-6`으로 확장

#### 7.2.3 콜 그래프 사이클 시각화
- [x] 사이클에 포함된 엣지: 빨간 점선 스타일 (`strokeDasharray`, `stroke: #dc2626`)
- [x] 사이클 엣지에 애니메이션 효과 (`animated: true`)
- [x] "순환 참조 보기" 버튼 → 첫 번째 사이클의 루트를 그래프 중심으로 로드

#### 7.2.4 테스트
- [x] SummaryCards에 순환 참조 카드 렌더링 테스트
- [x] CallGraph mock에 `getCycles` 추가

### 7.3 코드 복잡도 분석 — 백엔드

#### 7.3.1 복잡도 계산 모듈 (신규)
- [x] `backend/analyzer/complexity.py` 생성
- [x] `calculate_complexity(body_text: str) -> int` 함수
  - 줄 수 (line_count)
  - 제어문 키워드 밀도: `if`, `for`, `while`, `repeat`, `case`, `try`, `except`
  - 중첩 `begin...end` 최대 깊이
  - 0~100 정규화 점수 산출
- [x] `enrich_methods_with_complexity(methods)` — 일괄 계산 헬퍼

#### 7.3.2 모델 확장
- [x] `Method`에 `complexity_score: int = 0` 추가
- [x] `MethodDetail`에 `complexity_score: int = 0` 추가

#### 7.3.3 분석 엔진 통합
- [x] `call_graph.py`의 `analyze()` 마지막에 복잡도 계산 통합
- [x] MethodDetail 생성 시 `complexity_score` 포함

#### 7.3.4 API 엔드포인트
- [x] `GET /api/methods` 응답 아이템에 `complexityScore` 추가
- [x] `GET /api/methods/{id}` 응답에 `complexityScore` 추가
- [x] `GET /api/complexity` (신규) → 유닛별 복잡도 집계 (트리맵용)

#### 7.3.5 테스트
- [x] 빈 body → 복잡도 0
- [x] 단순 body (begin/end만) → 낮은 점수
- [x] 복잡한 body (중첩 if/for/while) → 높은 점수
- [x] `test_complexity.py` 17개 케이스

### 7.4 코드 복잡도 — 프론트엔드

#### 7.4.1 타입 확장
- [x] `MethodItem`에 `complexityScore: number` 추가
- [x] `ComplexityUnit`, `ComplexityMethod`, `ComplexityResponse` 인터페이스

#### 7.4.2 복잡도 히트맵 컴포넌트 (신규)
- [x] `frontend/src/components/ComplexityMap.tsx` 생성
- [x] CSS flexbox 기반 트리맵 (라이브러리 없이 비율 계산)
- [x] 색상: 복잡도 0~100 → 초록~빨강 그라디언트 (5단계)
- [x] 유닛별 그룹핑, 셀에 메소드명 + 점수
- [x] 미사용+복잡(≥60) 메소드: 점선 테두리 + 경고 아이콘 ⚠
- [x] 셀 hover 시 툴팁 (메소드명, 유닛, 복잡도, 줄 번호, 사용 여부)
- [x] 셀 클릭 시 메소드 상세 패널 열기

#### 7.4.3 App.tsx 통합
- [x] Overview 탭에 UnitChart 아래 ComplexityMap 섹션 추가
- [x] `useApi`에 `getComplexity()`, `getCycles()` 함수 추가

#### 7.4.4 테스트
- [x] `ComplexityMap.test.tsx` 9개 케이스
  - 유닛/메소드 렌더링, 경고 아이콘, 클릭 이벤트, 빈 데이터, 로딩, 오류, 범례

### 7.5 PRD 업데이트
- [x] §5.1.5 순환 참조 탐지 기능 설명 추가
- [x] §5.1.6 코드 복잡도 분석 기능 설명 추가
- [x] §5.2.7 순환 참조 시각화 설명 추가
- [x] §5.2.8 복잡도 히트맵 설명 추가
- [x] §7 API 설계에 신규 엔드포인트 추가 (`/api/cycles`, `/api/complexity`)
- [x] §10 데이터 모델에 신규 필드 추가 (`complexityScore`, `cycleCount`, `cycles`)
- [x] §14.1 가설 H5, H6 추가
- [x] 섹션 번호 재정렬 (중복 §7 → §7~§15 순번 정리)

### 7.6 문서 업데이트
- [x] CLAUDE.md 구조 트리 + 테이블에 Sprint 7 파일 반영
- [x] README.md 생성 (순환 참조, 복잡도 기능 포함 전체 프로젝트 문서)

---

## 검증 결과 (2026-03-16)

| 항목 | 결과 |
|------|------|
| `pytest backend/tests/` | ✅ 125 passed (0.98s) |
| `vitest run` (frontend) | ✅ 64 passed |
| `tsc --noEmit` | ✅ 오류 0 |
| 백엔드 전체 커버리지 | ✅ 91% |
| `analyzer/call_graph.py` 커버리지 | ✅ 96% |
| `analyzer/complexity.py` 커버리지 | ✅ 91% |

---

## 완료 조건 (Definition of Done)

- [x] 순환 참조 탐지: A→B→C→A 패턴 정확 탐지
- [x] 요약 카드에 순환 참조 수 표시
- [x] 콜 그래프에서 사이클 엣지 빨간 점선 표시
- [x] 복잡도 점수: 빈 body=0, 복잡한 body≥60
- [x] 트리맵 히트맵 렌더링 및 색상 그라디언트 동작
- [x] "미사용+복잡" 메소드 하이라이트 동작
- [x] 기존 테스트 전부 통과 + 신규 테스트 추가 (125 passed)
- [x] PRD에 고도화 기능 명세 반영

---

## 구현 순서

1. 모델 확장 (7.1.1, 7.3.2)
2. 사이클 탐지 로직 (7.1.2)
3. 복잡도 계산 모듈 (7.3.1)
4. 분석 엔진 통합 (7.1.2 후반, 7.3.3)
5. API 엔드포인트 (7.1.3, 7.3.4)
6. 프론트 타입 (7.2.1, 7.4.1)
7. 프론트 UI (7.2.2, 7.2.3, 7.4.2, 7.4.3)
8. 테스트 (7.1.4, 7.2.4, 7.3.5, 7.4.4)
9. PRD + 문서 업데이트 (7.5, 7.6)
