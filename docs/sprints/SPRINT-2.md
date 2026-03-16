# Sprint 2: 콜 그래프 분석 엔진

> **목표**: 파싱된 메소드 데이터를 기반으로 호출 관계를 분석하여 콜 그래프 생성
> **산출물**: 메소드별 callers/callees, 호출 횟수, 사용/미사용 판정 JSON 출력

---

## 선행 조건
- Sprint 1 완료 (파서가 메소드 목록 + 본문 텍스트를 제공)

---

## 태스크

### 2.1 호출 탐지 로직 (`call_graph.py`)
- [x] 전체 메소드명 사전(dictionary) 구축
- [x] 각 메소드 본문에서 알려진 메소드명 토큰 매칭
  - `MethodName(` 패턴 (함수 호출)
  - `Object.MethodName` 패턴 (멤버 호출)
  - 단순 식별자 매칭 (할당, 콜백 등)
- [x] 토크나이저 연동: 주석/문자열 제거된 본문에서만 매칭
- [x] 동일 메소드명 충돌 시 처리 전략:
  - 같은 유닛 내 우선
  - uses 절 참조 유닛 내 탐색
  - 해결 불가 시 모든 후보에 연결 (오탐 허용)

### 2.2 방향 그래프 구성
- [x] 메소드 노드 생성 (id, unitName, className, methodName)
- [x] 엣지 생성: caller → callee
- [x] 각 노드에 `callers[]`, `callees[]` 리스트 부착
- [x] `callCount` 계산 (callers 총 수)
- [x] `isUsed` 플래그 설정 (callCount > 0)

### 2.3 진입점(Entry Point) 처리
- [x] .dpr의 `begin...end.` 블록 → 프로그램 진입점으로 처리
- [x] 진입점에서 호출하는 메소드는 자동으로 "사용" 처리
- [x] DPR 진입점 자체는 항상 isUsed = true

### 2.4 분석 결과 모델
- [x] `AnalysisResult` Pydantic 모델 정의
  - 요약 통계: totalUnits, totalMethods, usedCount, unusedCount, unusedRatio
  - 메소드별 상세: callers, callees, callCount, isUsed
- [x] JSON 직렬화 지원

### 2.5 CLI 확장
- [x] `python -m backend.cli <dpr-path> --analyze` 옵션 추가
- [x] 분석 결과 JSON 출력 (요약 + 메소드별 호출 관계)
- [x] `--unused-only` 플래그: 미사용 메소드만 출력

### 2.6 테스트
- [x] 호출 탐지 단위 테스트: 단순 호출, 멤버 호출, 체이닝 케이스
- [x] 양방향 매핑 일관성 테스트: callers ↔ callees 교차 검증
- [x] 순환 참조 케이스 테스트: A → B → A 무한 루프 방지 확인
- [x] 진입점 처리 테스트: .dpr begin..end 블록의 호출 체인
- [x] 오탐/미탐 경계 케이스: 동일 이름 메소드, 주석 내 메소드명

---

## 검증 결과 (2026-03-16)

| 항목 | 결과 |
|------|------|
| `pytest` (Sprint 1~2 누적) | ✅ 75 passed (0.17s) |
| `tsc --noEmit` | 해당 없음 (프론트엔드 미구현) |
| `analyzer/call_graph.py` 커버리지 | ✅ 95% |
| `parser/` 모듈 커버리지 | ✅ 97%+ |

---

## 완료 조건 (Definition of Done)

- [x] 샘플 프로젝트에서 메소드 간 호출 관계가 정확히 탐지됨
- [x] callers/callees 양방향 매핑 일관성 검증
- [x] 미사용 메소드가 올바르게 식별됨
- [x] 주석/문자열 내 메소드명이 호출로 오인되지 않음
- [x] 유닛 테스트 통과 (분석 엔진 커버리지 ≥ 85%)
- [x] Ruff 린트 통과

---

## 의사결정 기록 (Decision Records)

### DR-2.1: uses절 기반 우선순위 해결

**결정**: 동일명 메소드 충돌 시 3단계 우선순위로 해결 (`_resolve_candidates`)

**이유**:
- Delphi의 name resolution 규칙(동일 유닛 우선 → uses 순서)을 모방
- 완전한 타입 정보 없이 정적 텍스트 분석만으로 최선의 근사치 제공
- 3순위(전체 후보) 연결은 오탐이지만 누락(false negative)보다 낫다고 판단

**결과**: 실제 프로젝트에서 충돌 케이스의 80%+ 정확 해결

### DR-2.2: `__entrypoint__` 가상 호출자

**결정**: `.dpr begin...end.` 블록 호출을 `MethodRef(id="__entrypoint__")`로 표현

**이유**:
- 진입점은 일반 메소드가 아니므로 별도 ID가 필요
- UI에서 "프로그램 진입점에서 호출됨"으로 표시 가능
- 분석 결과의 일관성 유지 (모든 callers가 MethodRef 타입)

---

## 회고 (Retrospective)

### 잘된 점
- 단일 통합 regex 컴파일 전략(`_build_call_pattern`)으로 성능 대폭 향상
- 양방향 링크(caller.callees ↔ callee.callers) 동시 업데이트로 일관성 보장

### 개선할 점
- `inherited MethodName` 패턴을 초기에 고려하지 않아 오탐 발생 → 후에 마스킹 추가
- 재귀 호출(self-call) 필터링 로직 추가가 늦어짐

### 예상 vs 실제 소요 시간
- 예상: 분석 엔진 5시간
- 실제: 7시간 (동일명 해결 전략 + 진입점 처리 설계)

---

## 샘플 출력

```json
{
  "summary": {
    "totalUnits": 5,
    "totalMethods": 42,
    "usedCount": 35,
    "unusedCount": 7,
    "unusedRatio": 16.67
  },
  "methods": [
    {
      "id": "Unit1.TMyForm.FormCreate",
      "callCount": 1,
      "isUsed": true,
      "callers": ["MyApp.<entrypoint>"],
      "callees": ["Unit2.TDataModule.Initialize", "Unit1.TMyForm.LoadConfig"]
    },
    {
      "id": "Unit1.TMyForm.OldHandler",
      "callCount": 0,
      "isUsed": false,
      "callers": [],
      "callees": ["SysUtils.IntToStr"]
    }
  ]
}
```
