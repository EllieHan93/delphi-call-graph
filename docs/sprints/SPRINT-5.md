# Sprint 5: 콜 그래프 시각화

> **목표**: 선택한 메소드 중심으로 호출 체인을 인터랙티브 그래프로 시각화
> **산출물**: 메소드 선택 → depth 조절 가능한 콜 그래프 렌더링

---

## 선행 조건
- Sprint 4 완료 (메소드 테이블에서 메소드 선택 가능)

---

## 태스크

### 5.1 그래프 라이브러리 세팅
- [x] React Flow(`@xyflow/react`) 설치 및 기본 설정
- [x] 커스텀 노드 컴포넌트 정의 (`MethodNode`)
- [x] 커스텀 엣지 스타일 정의 (화살표 + stroke color)

### 5.2 콜 그래프 컴포넌트 (`CallGraph.tsx`)
- [x] 선택된 메소드 id를 prop으로 받음
- [x] `GET /api/callgraph/{id}?depth=N` 호출 (`useApi.ts` 확장)
- [x] API 응답(nodes, edges)을 React Flow 노드/엣지로 변환
- [x] 자동 레이아웃 배치 (`@dagrejs/dagre`, `rankdir: 'TB'`)

### 5.3 노드 디자인
- [x] 노드 내용: `ClassName.MethodName` (또는 standalone명)
- [x] 서브텍스트: `UnitName`
- [x] 디자인 토큰 적용:
  - 선택된(중심) 메소드: Primary 채움 (`border-primary bg-primary text-white`)
  - 사용 메소드: Success 외곽선 (`border-success`)
  - 미사용 메소드: Danger 외곽선 (`border-danger`)
- [x] 접근성: 색상 외 아이콘(✓/✗)으로도 사용/미사용 구분

### 5.4 인터랙션
- [x] depth 조절 슬라이더 (1 ~ 5, 기본값 2)
- [x] depth 변경 시 그래프 재로드
- [x] 노드 클릭 → 해당 메소드를 중심으로 그래프 재구성 (`centerId` 상태)
- [x] 노드 더블클릭 → 메소드 상세 패널 열기 (`onMethodDoubleClick` 콜백)
- [x] 줌 인/아웃, 패닝 (React Flow 기본 제공)
- [x] "화면 맞추기" 버튼 (`fitView`)

### 5.5 방향 표시
- [x] 엣지에 화살표로 호출 방향 표시 (`MarkerType.ArrowClosed`)
- [x] callers(위) → 중심 메소드 → callees(아래) 배치 (dagre `rankdir: 'TB'`)

### 5.6 UI 통합
- [x] 메소드 테이블 행에 "그래프 보기" 버튼 추가 (`MethodTable.tsx` 액션 컬럼)
- [x] 메소드 상세 패널에서도 그래프 열기 가능 (`MethodDetail.tsx` 헤더 버튼)
- [x] 그래프 ↔ 테이블 간 네비게이션 연결 (`App.tsx` `graphMethodId` 상태)

### 5.7 테스트
- [x] CallGraph 컴포넌트 테스트: 모달 표시/숨김, ESC 닫기, 닫기 버튼
- [x] depth 슬라이더 렌더링 및 변경 시 API 재호출 테스트
- [x] API 올바른 파라미터 호출 검증
- [x] 접근성: 그래프 영역에 `aria-label`, 닫기 버튼 `aria-label`

---

## 검증 결과 (2026-03-16)

| 항목 | 결과 |
|------|------|
| `pytest` (백엔드, Sprint 1~3 누적) | ✅ 103 passed |
| `vitest run` (Sprint 4~5 누적) | ✅ 46 passed |
| `tsc --noEmit` | ✅ 오류 0 |
| 백엔드 전체 커버리지 | ✅ 91% |
| 프론트엔드 컴포넌트 커버리지 | ✅ 94% |

---

## 완료 조건 (Definition of Done)

- [x] 메소드 선택 시 콜 그래프 정확히 렌더링
- [x] depth 조절에 따라 그래프 범위 변경
- [x] 노드 클릭으로 그래프 중심 전환 동작
- [x] 사용/미사용 노드 색상+아이콘 구분 명확
- [x] 컴포넌트 테스트 통과
- [x] ESLint 통과

---

## 의사결정 기록 (Decision Records)

### DR-5.1: dagre 자동 레이아웃 선택

**결정**: 수동 좌표 배치 대신 `@dagrejs/dagre` 자동 레이아웃 채택

**이유**:
- 호출 관계 그래프는 메소드 수에 따라 동적으로 크기가 변함
- 수동 배치는 노드 오버랩/겹침 방지 알고리즘 별도 구현 필요
- dagre의 `rankdir: 'TB'` (위→아래)가 callers → 중심 → callees 흐름과 자연스럽게 매핑

**결과**: 계층형 레이아웃으로 호출 방향이 직관적으로 표현됨

### DR-5.2: BFS depth 제한 (`depth=1~5`)

**결정**: 그래프 탐색 깊이를 1~5로 제한, 기본값 2

**이유**:
- depth 제한 없으면 대형 프로젝트에서 전체 그래프가 렌더링되어 성능 저하
- depth=2가 "직접 caller/callee + 그 다음 단계" 구조로 가장 유용한 정보 제공
- React Flow는 노드 수 ~100개까지 원활, 그 이상은 성능 이슈

---

## 회고 (Retrospective)

### 잘된 점
- dagre + React Flow 통합이 생각보다 원활 (노드 position만 주입하면 됨)
- 노드 클릭으로 중심 전환하는 인터랙션이 UX 차별화 포인트가 됨

### 개선할 점
- 초기에 `@xyflow/react` v12 API 변경으로 문서와 불일치 → 마이그레이션 가이드 참조 필요
- fitView 타이밍 문제 (레이아웃 계산 전 호출) → setTimeout으로 임시 해결

### 예상 vs 실제 소요 시간
- 예상: 그래프 시각화 5시간
- 실제: 7시간 (React Flow API 학습 + dagre 통합 + 인터랙션 구현)

---

## 시각화 예시

```
                    ┌─────────────────┐
                    │ TForm.FormCreate │  ← callers
                    └────────┬────────┘
                             │ calls
                             ▼
    ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐
    │ TData.Init   │←─│ ★ TForm.OnClick │─→│ Utils.Format  │
    └──────────────┘  └────────┬────────┘  └───────────────┘
                               │ calls          callees →
                               ▼
                    ┌─────────────────┐
                    │ TForm.Refresh   │
                    └─────────────────┘

    ★ = 선택된 중심 메소드
    초록 = 사용 / 빨강 = 미사용
```
