# 아키텍처 문서

## 1. 시스템 개요

Delphi Static Call Graph Analyzer는 정적 텍스트 분석 기반으로 Delphi 프로젝트의 메소드 간 호출 관계를 추출하고, 미사용 코드를 식별하는 웹 대시보드입니다.

```
.dpr 파일
    │
    ▼
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  DprParser  │───▶│   PasParser     │───▶│ CallGraphAnalyzer│
│  (유닛 목록) │    │  (메소드 추출)   │    │  (호출 관계 추출)  │
└─────────────┘    └─────────────────┘    └──────────────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │  AnalysisResult  │
                                          │  (summary+methods│
                                          └──────────────────┘
                                                    │
                              ┌─────────────────────┼──────────────────────┐
                              ▼                     ▼                      ▼
                       ┌──────────┐        ┌──────────────┐       ┌──────────────┐
                       │  FastAPI │        │   CLI Tool   │       │  In-Memory   │
                       │ REST API │        │ (--analyze)  │       │    State     │
                       └──────────┘        └──────────────┘       └──────────────┘
                              │
                              ▼
                    ┌──────────────────────────────────────┐
                    │          React + TypeScript           │
                    │  ProjectInput → SummaryCards → Tabs  │
                    │  MethodTable │ CallGraph │ UnitChart  │
                    └──────────────────────────────────────┘
```

---

## 2. 데이터 플로우 상세

### Step 1: DPR 파싱 (`backend/parser/dpr_parser.py`)

`.dpr` 파일에서 `uses` 절을 추출하고 유닛별 파일 경로를 매핑합니다.

```
program SampleApp;
uses
  Forms,
  MainUnit in 'src\MainUnit.pas',    ← 경로 명시 유닛
  DataModule in 'src\DataModule.pas',
  Utils in 'src\Utils.pas';
```

출력: `DprInfo { project_name, units: [{ name, absolute_path }] }`

**설계 결정**: `in '경로'` 구문 우선, 없으면 `.dpr` 위치 기준으로 탐색

### Step 2: PAS 파싱 (`backend/parser/pas_parser.py`)

각 `.pas` 파일을 파싱해 메소드 정의를 추출합니다.

```
1. clean_source() → 주석({..}, //..) 제거
2. interface 절 → implementation 절 분리
3. 메소드 선언 regex 매칭
   r"(procedure|function|constructor|destructor)\s+(\w+)\.(\w+)"
4. 구현 본문 begin...end 블록 추출
5. uses 절 파싱 (inter-unit 의존성)
```

출력: `Unit { name, file_path, uses: [str], methods: [Method] }`

### Step 3: 토크나이저 (`backend/parser/tokenizer.py`)

```python
clean_source(src)   # 주석 제거 ({} 블록, // 라인, (* *) 블록)
mask_strings(src)   # 문자열 리터럴을 공백으로 마스킹 ('...' → '   ')
```

**Why**: 주석/문자열 내부의 메소드명이 호출로 오탐되는 것을 방지.

### Step 4: 콜 그래프 분석 (`backend/analyzer/call_graph.py`)

```
1. _build_method_index()
   - 모든 유닛의 메소드를 lowercase name → [Method] 딕셔너리로 인덱싱
   - O(1) 조회로 대규모 프로젝트 성능 확보

2. _build_call_pattern()
   - 알려진 메소드명을 하나의 통합 정규식으로 컴파일
   - 긴 이름 우선 정렬 (prefix shadowing 방지)
   - r"\b(method1|method2|...)\b" (IGNORECASE)

3. _build_uses_set()
   - 유닛별 uses절 의존성 맵 구축
   - inter-unit 호출 해석 시 범위 제한용

4. _detect_and_link_calls()
   - 각 메소드 body_text에 패턴 매칭
   - _resolve_candidates()로 후보 메소드 우선순위 결정:
     1순위: 동일 유닛 내 메소드
     2순위: uses절에 명시된 유닛의 메소드
     3순위: 전체 후보 (오탐 허용)
   - 양방향 링크: caller.callees ↔ callee.callers

5. _process_entry_point()
   - .dpr begin...end. 블록 분석
   - 진입점에서 호출된 메소드를 is_used=true로 마킹

6. 최종 집계
   - call_count = len(callers)
   - is_used = call_count > 0
```

### Step 5: Pydantic 모델 (`backend/analyzer/models.py`)

```python
MethodRef     # 참조용 경량 모델 (id, unit, class, method)
Method        # 파싱 결과 (+ callers/callees/call_count/is_used)
MethodDetail  # API 응답용 (Method의 직렬화 형태)
Unit          # 유닛 (name, file_path, uses, methods)
Project       # 프로젝트 (name, dpr_path, units)
AnalysisSummary  # 통계 (total/used/unused/ratio)
AnalysisResult   # 최종 결과 (project_name, summary, methods)
```

---

## 3. API 레이어 (`backend/api/`)

### 엔드포인트 목록

| 메소드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/analyze` | .dpr 경로로 분석 시작, analysis_id 반환 |
| GET | `/api/analysis/{id}/summary` | 프로젝트 통계 요약 |
| GET | `/api/analysis/{id}/methods` | 메소드 목록 (페이지네이션, 필터링, 정렬) |
| GET | `/api/analysis/{id}/methods/{method_id}` | 단일 메소드 상세 |
| GET | `/api/analysis/{id}/callgraph/{method_id}` | 특정 메소드 중심 그래프 노드/엣지 |
| GET | `/api/analysis/{id}/units` | 유닛별 사용/미사용 통계 |

### 인메모리 상태 관리 (`backend/api/state.py`)

```python
_store: dict[str, AnalysisResult] = {}

def save(result) -> str:   # UUID 생성 후 저장
def get(analysis_id) -> AnalysisResult | None
def list_all() -> list[str]
```

**설계 결정**: DB 없는 토이 프로젝트 → 인메모리 딕셔너리. 서버 재시작 시 초기화.

---

## 4. 프론트엔드 아키텍처 (`frontend/src/`)

### 컴포넌트 트리

```
App.tsx
├── ProjectInput       — .dpr 경로 입력 + 분석 버튼
├── SummaryCards       — 4개 지표 카드 (total/used/unused/ratio)
└── Tabs
    ├── MethodTable    — TanStack Table (정렬, 필터, 페이지네이션)
    │   └── MethodDetail (Slide Panel) — 단일 메소드 상세 + 호출 관계
    ├── CallGraph      — React Flow + dagre 자동 레이아웃
    │   └── MethodDetail (Modal)
    └── UnitChart      — 유닛별 막대 차트
```

### 핵심 기술 선택 이유

| 기술 | 선택 이유 |
|------|----------|
| React Flow (`@xyflow/react`) | 인터랙티브 노드-엣지 그래프, 줌/팬 내장 |
| dagre (`@dagrejs/dagre`) | 방향 그래프 자동 레이아웃 (위→아래 계층형) |
| TanStack Table | headless 테이블 (정렬·필터·페이지네이션 내장) |
| Tailwind CSS | 디자인 토큰 기반 유틸리티 클래스, 빠른 반응형 구현 |

### 데이터 흐름

```
useApi(POST /api/analyze)
    │
    ├── analysisId 획득
    │
    ├── useApi(GET /api/analysis/{id}/summary)    → SummaryCards
    ├── useApi(GET /api/analysis/{id}/methods)    → MethodTable
    ├── useApi(GET /api/analysis/{id}/callgraph)  → CallGraph
    └── useApi(GET /api/analysis/{id}/units)      → UnitChart
```

---

## 5. 설계 결정 기록

### Regex vs AST 선택

**결정**: Regex 기반 텍스트 매칭

**이유**:
- Delphi AST 파서 (Python)가 존재하지 않음 (Antlr4 기반 도구는 JVM 의존)
- 토이 프로젝트 범위에서 regex로 충분한 정확도 달성 가능
- 주석/문자열 마스킹으로 오탐률 최소화

**한계 인정**:
- 런타임 동적 호출 (RTTI, 이벤트 핸들러) 탐지 불가
- 동일명 오버로드 메소드 구분 불가

### 동일명 메소드 해석 전략

```
TMainForm.Create vs TDataModule.Create
```

**해결**: uses절 우선순위 (`_resolve_candidates`)
1. 동일 유닛 내 메소드 → 확실한 로컬 호출
2. uses절 명시 유닛 → 가장 가능성 높은 외부 호출
3. 전체 후보 → 오탐 허용, 사용자에게 정보 제공

### 엔트리포인트 처리

`.dpr`의 `begin...end.` 블록은 일반 메소드 body가 아니므로 별도 처리:
- `__entrypoint__` 가상 ID로 callers에 추가
- UI에서는 "프로그램 진입점에서 호출됨"으로 표시

---

## 6. 성능 특성

| 작업 | 시간 복잡도 | 실측 (3유닛/12메소드) |
|------|------------|----------------------|
| DPR 파싱 | O(lines) | < 1ms |
| PAS 파싱 (n유닛) | O(n × lines) | < 5ms |
| 메소드 인덱스 구축 | O(m) | < 1ms |
| 호출 탐지 (m메소드) | O(m × body_len) | < 10ms |
| **전체 분석** | **O(n × lines × m)** | **< 20ms** |

실무 규모(100유닛/800메소드) 예상: < 3초
