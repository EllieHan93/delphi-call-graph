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

## 완료 조건 (Definition of Done)

- [x] 샘플 프로젝트에서 메소드 간 호출 관계가 정확히 탐지됨
- [x] callers/callees 양방향 매핑 일관성 검증
- [x] 미사용 메소드가 올바르게 식별됨
- [x] 주석/문자열 내 메소드명이 호출로 오인되지 않음
- [x] 유닛 테스트 통과 (분석 엔진 커버리지 ≥ 85%)
- [x] Ruff 린트 통과

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
