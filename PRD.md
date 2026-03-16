# PRD: Delphi Static Call Graph Analyzer Dashboard

## 1. 개요

Delphi 프로젝트(.dpr)를 입력하면, 해당 프로젝트에 포함된 모든 `.pas` 유닛 파일을 파싱하여 **메소드 간 호출 관계(Call Graph)**를 정적 분석하고, 특정 실행파일(exe) 기준으로 **사용/미사용 메소드를 식별**하는 웹 대시보드.

## 2. 문제 정의

### 2.1 현실의 문제
Delphi는 1995년부터 이어져 온 레거시 언어로, 국내 금융/제조/공공 분야에 20년 이상 된 대규모 프로젝트가 다수 존재한다. 이런 프로젝트들은 수백~수천 개의 `.pas` 유닛, 수만 개의 메소드를 포함하며 다음과 같은 문제를 겪고 있다:

- **Dead Code 식별 불가**: 대규모 Delphi 레거시 프로젝트에서 실제로 사용되지 않는 코드가 얼마나 있는지 알 방법이 없음
- **수작업 의존**: 메소드가 어디서 호출되는지 파악하려면 IDE의 "Find References"를 하나씩 수동 검색해야 함
- **리팩토링 리스크**: 삭제해도 되는 메소드인지 판단할 근거가 없어, 코드 정리가 사실상 불가능
- **유지보수 비용 증가**: 불필요한 코드가 쌓일수록 빌드 시간 증가, 버그 유입 경로 확대, 신규 개발자 온보딩 지연

### 2.2 기존 솔루션과 차별화

| 기존 접근 | 한계 | 본 프로젝트의 차별점 |
|-----------|------|---------------------|
| Delphi IDE "Find References" | 메소드 하나씩 수동 검색, 전체 조감 불가 | **프로젝트 전체** 메소드를 일괄 분석, 대시보드로 조감 |
| Pascal Analyzer (PAL) | 유료 상용 도구($249+), 설치형 | 오픈소스 웹 대시보드, 무료, 경량 |
| Delphi 컴파일러 힌트 | "unused" 힌트는 interface 선언 기준, 실제 호출 관계 미반영 | 실제 코드 본문의 **호출 관계(Call Graph)** 기반 분석 |
| SonarQube Delphi 플러그인 | 커뮤니티 플러그인 유지보수 중단, 설정 복잡 | Delphi 특화 경량 도구, 설정 없이 .dpr 경로만 입력 |
| 수동 코드 리뷰 | 대규모 프로젝트에서 비현실적 | 자동화된 정적 분석 + 인터랙티브 시각화 |

## 3. 목표

| 목표 | 측정 기준 |
|------|-----------|
| .dpr 프로젝트 파싱 및 uses 절 기반 .pas 파일 수집 | 프로젝트 내 모든 유닛 자동 탐색 |
| .pas 파일에서 클래스/메소드 선언 추출 | procedure/function 선언 정확 파싱 |
| 메소드 본문 내 다른 메소드 호출 탐지 | 정적 텍스트 기반 호출 관계 매핑 |
| 호출 횟수 및 사용/미사용 분류 | 0회 호출 = 미사용, 1회 이상 = 사용 |
| 웹 대시보드로 결과 시각화 | 인터랙티브 UI 제공 |

## 4. 사용자 스토리

1. **프로젝트 로드**: 사용자가 `.dpr` 파일 경로를 입력하면, 시스템이 해당 프로젝트의 모든 `.pas` 파일을 자동 탐색한다.
2. **분석 실행**: "분석" 버튼을 누르면 정적 콜 그래프 분석이 수행된다.
3. **결과 조회**: 대시보드에서 메소드별 호출 횟수, 호출자/피호출자 관계, 사용/미사용 상태를 확인한다.
4. **필터링**: 특정 유닛, 클래스, 또는 사용/미사용 상태로 필터링하여 조회한다.
5. **콜 그래프 시각화**: 특정 메소드를 선택하면 해당 메소드의 호출 체인을 그래프로 확인한다.

## 5. 기능 요구사항

### 5.1 백엔드 — 파서 & 분석 엔진

#### 5.1.1 .dpr 파일 파싱
- `program` 선언에서 프로젝트명 추출
- `uses` 절에서 참조 유닛 목록 추출
- `in '경로'` 구문으로 .pas 파일의 실제 경로 매핑
- .dpr 파일 기준 상대 경로 해석

#### 5.1.2 .pas 파일 파싱
- **유닛 구조 파싱**: `unit`, `interface`, `implementation`, `uses` 절 구분
- **메소드 선언 추출**:
  - `procedure ClassName.MethodName(params);`
  - `function ClassName.MethodName(params): ReturnType;`
  - standalone procedure/function (클래스 소속 아닌 것)
  - `constructor`, `destructor` 포함
- **메소드 본문 추출**: `begin...end` 블록 내 코드
- **주석/문자열 제외**: `//`, `{ }`, `(* *)` 주석과 `'문자열'` 내부는 분석 대상에서 제외

#### 5.1.3 콜 그래프 생성
- 각 메소드 본문에서 다른 메소드명이 등장하는지 텍스트 매칭
- 호출 관계를 방향 그래프(Directed Graph)로 구성
- 각 메소드 노드에 다음 정보 부착:
  - `unitName`: 소속 유닛
  - `className`: 소속 클래스 (없으면 `<standalone>`)
  - `methodName`: 메소드명
  - `callers`: 이 메소드를 호출하는 메소드 목록
  - `callees`: 이 메소드가 호출하는 메소드 목록
  - `callCount`: 호출당하는 총 횟수
  - `isUsed`: callCount > 0 여부

#### 5.1.5 순환 참조 탐지
- 메소드 간 호출 그래프에서 **사이클(순환 참조)**을 탐지
- DFS(깊이 우선 탐색) + back-edge 방식으로 사이클 구성 메소드 ID 순서 추출
- 결과: `AnalysisResult.cycles: list[list[str]]` — 각 리스트가 하나의 사이클
- 요약 통계에 `cycleCount` 반영, 콜 그래프 엣지에 `isCycle` 플래그 추가

#### 5.1.6 코드 복잡도 분석
- 메소드 본문(`bodyText`) 기반 복잡도 점수(0~100) 계산
- 계산 요소: 줄 수, 제어문 키워드(`if/for/while/repeat/case/try/except`) 밀도, 중첩 `begin...end` 최대 깊이
- 0~100 정규화: 단순 body→낮은 점수, 복잡한 중첩 제어문→높은 점수(≥60)
- `Method.complexity_score`, `MethodDetail.complexity_score` 필드에 저장

#### 5.1.4 분석 한계 (Scope)
- **정적 분석만** 수행 (런타임 동적 호출, RTTI, 메시지 핸들러 등은 미탐지)
- 텍스트 매칭 기반이므로 **오탐(false positive) 가능** — 동일 이름 메소드 구분 불가
- 외부 라이브러리(.dcu, 3rd party) 내부는 분석 불가
- 이벤트 핸들러(`OnClick` 등 DFM 바인딩)는 1차 버전에서 미지원

### 5.2 프론트엔드 — 대시보드

#### 5.2.1 프로젝트 입력
- `.dpr` 파일 경로 입력 필드
- 분석 실행 버튼
- 분석 진행 상태 표시 (파일 수, 현재 처리 중인 파일)

#### 5.2.2 요약 카드 (Summary)
| 카드 | 내용 |
|------|------|
| 총 유닛 수 | 분석된 .pas 파일 개수 |
| 총 메소드 수 | 추출된 procedure/function 개수 |
| 사용 메소드 | callCount > 0인 메소드 수 |
| 미사용 메소드 | callCount == 0인 메소드 수 |
| 미사용 비율 | 미사용 / 전체 × 100% |

#### 5.2.3 메소드 테이블
- 컬럼: 유닛명 | 클래스명 | 메소드명 | 호출 횟수 | 상태(사용/미사용)
- 정렬: 각 컬럼 클릭으로 오름차순/내림차순
- 필터:
  - 유닛 선택 (드롭다운/멀티셀렉트)
  - 상태 필터 (전체 / 사용 / 미사용)
  - 텍스트 검색 (메소드명 부분 일치)
- 행 클릭 시 상세 패널 표시

#### 5.2.4 메소드 상세 패널
- 선택한 메소드의 전체 시그니처
- **Callers** 목록 (이 메소드를 호출하는 곳)
- **Callees** 목록 (이 메소드가 호출하는 곳)
- 소스 코드 미리보기 (해당 메소드 본문)

#### 5.2.5 콜 그래프 시각화
- 선택한 메소드 중심으로 호출 체인을 트리/그래프로 표시
- depth 조절 가능 (1단계, 2단계, 전체)
- 노드 색상: 사용(초록) / 미사용(빨강)
- 노드 클릭으로 해당 메소드로 이동

#### 5.2.6 유닛별 분석 뷰
- 유닛 단위로 메소드 사용률 바 차트
- 미사용률이 높은 유닛 하이라이트

#### 5.2.7 순환 참조 시각화
- 요약 카드에 "순환 참조" 6번째 카드 추가 (0이면 초록, 1 이상이면 오렌지)
- 콜 그래프에서 사이클을 구성하는 엣지를 **빨간 점선 + 애니메이션**으로 표시
- "순환 참조 보기" 버튼으로 첫 번째 사이클 루트를 그래프 중심으로 로드

#### 5.2.8 코드 복잡도 히트맵
- CSS flexbox 기반 트리맵: 유닛별로 그룹핑, 각 셀에 메소드명 + 복잡도 점수
- 색상 그라디언트: 0~100 → 초록(낮음) ~ 빨강(높음) 5단계
- **미사용 + 복잡도 ≥60** 메소드: 점선 테두리 + 경고 아이콘 ⚠ 표시
- 셀 hover 시 툴팁(메소드명, 유닛, 복잡도, 줄 번호, 사용 여부)
- 셀 클릭 시 메소드 상세 패널 열기

## 6. 디자인 시스템

### 6.1 디자인 토큰

#### 색상 (Color Palette)
```
Primary       #2563EB (Blue-600)      — 주 액션, 링크, 선택 상태
Primary Hover #1D4ED8 (Blue-700)      — 호버 상태

Success       #16A34A (Green-600)     — "사용" 상태, 정상
Danger        #DC2626 (Red-600)       — "미사용" 상태, 경고
Warning       #D97706 (Amber-600)     — 주의, 오탐 가능성

Neutral-50    #F8FAFC                 — 페이지 배경
Neutral-100   #F1F5F9                 — 카드 배경
Neutral-200   #E2E8F0                 — 보더, 구분선
Neutral-500   #64748B                 — 보조 텍스트
Neutral-800   #1E293B                 — 본문 텍스트
Neutral-900   #0F172A                 — 제목 텍스트
```

#### 타이포그래피
```
Font Family   "Pretendard", "Inter", system-ui, sans-serif
Mono Font     "JetBrains Mono", "Fira Code", monospace  (코드 미리보기)

Heading 1     24px / 700 / 1.3 line-height   — 페이지 제목
Heading 2     20px / 600 / 1.4               — 섹션 제목
Heading 3     16px / 600 / 1.4               — 카드 제목
Body          14px / 400 / 1.6               — 본문, 테이블
Caption       12px / 400 / 1.5               — 보조 텍스트, 레이블
Code          13px / 400 / 1.5 (mono)        — 소스 코드
```

#### 간격 (Spacing Scale)
```
4px  (xs)    — 인라인 요소 간격
8px  (sm)    — 컴포넌트 내부 패딩
12px (md)    — 관련 요소 간 간격
16px (lg)    — 카드 내부 패딩
24px (xl)    — 섹션 간 간격
32px (2xl)   — 주요 블록 간 간격
```

#### 라운딩 & 그림자
```
Border Radius  6px (sm), 8px (md), 12px (lg)
Shadow-sm      0 1px 2px rgba(0,0,0,0.05)          — 카드
Shadow-md      0 4px 6px -1px rgba(0,0,0,0.1)      — 드롭다운, 모달
Shadow-lg      0 10px 15px -3px rgba(0,0,0,0.1)     — 플로팅 패널
```

### 6.2 UI 컴포넌트 일관성 규칙

| 컴포넌트 | 스타일 규칙 |
|----------|------------|
| **요약 카드** | 높이 동일, 아이콘 좌측, 숫자 강조(Heading 1), 라벨(Caption), 배경 Neutral-100 |
| **테이블** | 헤더 Neutral-100 배경, 짝수 행 stripe, 호버 Primary/5%, 행 높이 44px |
| **상태 배지** | 사용: Success 배경 + 흰 텍스트, 미사용: Danger 배경 + 흰 텍스트, pill 형태 |
| **버튼** | Primary: 파란 배경 + 흰 텍스트, Ghost: 텍스트만, 높이 36px (sm) / 40px (md) |
| **입력 필드** | 높이 40px, 보더 Neutral-200, 포커스 시 Primary 링 2px, 라운딩 md |
| **그래프 노드** | 사용: Success 외곽선, 미사용: Danger 외곽선, 선택됨: Primary 채움 |
| **탭** | 활성: Primary 텍스트 + 하단 2px 바, 비활성: Neutral-500 |

### 6.3 접근성 (Accessibility)

| 항목 | 기준 | 구현 방법 |
|------|------|-----------|
| **색상 대비** | WCAG 2.1 AA 기준 (4.5:1 이상) | 모든 텍스트/배경 조합 contrast ratio 검증 |
| **색상만으로 구분 금지** | 사용/미사용을 색상+텍스트+아이콘으로 중복 표현 | 배지에 텍스트 라벨 포함, 그래프 노드에 아이콘 |
| **키보드 네비게이션** | Tab으로 모든 인터랙티브 요소 접근 가능 | `tabIndex`, `onKeyDown` 핸들링 |
| **포커스 표시** | 포커스된 요소에 visible outline | `focus-visible` 링 스타일 (Primary 2px) |
| **스크린 리더** | 주요 영역에 ARIA 레이블 | `aria-label`, `role`, `aria-live` (분석 상태) |
| **테이블 접근성** | 정렬 상태를 스크린 리더에 전달 | `aria-sort`, `<th scope="col">` |

### 6.4 디자인 검토 프로세스

| 단계 | 시점 | 체크리스트 |
|------|------|-----------|
| **토큰 검증** | Sprint 4 시작 시 | Tailwind config에 디자인 토큰이 정확히 매핑되었는가 |
| **컴포넌트 리뷰** | 각 컴포넌트 구현 후 | 토큰 준수, 일관성, 반응형, 접근성 체크 |
| **통합 리뷰** | Sprint 6 | 전체 화면 플로우에서 시각적 일관성, 색상/간격/타이포 통일 확인 |
| **접근성 감사** | Sprint 6 | Lighthouse Accessibility 점수 ≥ 90, 키보드 전체 탐색 가능 확인 |

## 7. API 설계 (추가: Sprint 7 엔드포인트)

### `GET /api/cycles`
- **Response**: `{ "cycles": [["MethodA", "MethodB", "MethodC"], ...], "count": N }`
- 탐지된 모든 순환 참조 목록 반환

### `GET /api/complexity`
- **Response**: `{ "units": [{ "unitName": "...", "avgComplexity": N, "methods": [...] }] }`
- 유닛별 복잡도 집계 (트리맵 시각화용)

---

## 8. 기술 스택

| 레이어 | 기술 | 선정 이유 |
|--------|------|-----------|
| 백엔드 | **Python (FastAPI)** | 파일 I/O, 텍스트 파싱에 적합, 빠른 프로토타이핑 |
| 파서 | **Python regex + 커스텀 파서** | Delphi 문법의 주요 패턴을 정규식으로 처리 |
| 프론트엔드 | **React + TypeScript** | 인터랙티브 대시보드 구현 |
| 차트/그래프 | **D3.js** 또는 **React Flow** | 콜 그래프 시각화 |
| 테이블 | **TanStack Table** | 정렬, 필터, 페이지네이션 |
| 스타일 | **Tailwind CSS** | 빠른 UI 구성 |
| 데이터 저장 | **In-memory (dict)** | 토이 프로젝트이므로 DB 불필요 |

## 9. API 설계

### `POST /api/analyze`
- **Request**: `{ "dprPath": "C:/projects/MyApp/MyApp.dpr" }`
- **Response**: `{ "projectName": "MyApp", "unitCount": 42, "methodCount": 385, ... }`

### `GET /api/summary`
- 마지막 분석 결과의 요약 통계 반환

### `GET /api/methods?unit=&status=&search=&sort=&order=`
- 필터/정렬된 메소드 목록 반환

### `GET /api/methods/{id}`
- 특정 메소드 상세 정보 (callers, callees, source)

### `GET /api/callgraph/{id}?depth=2`
- 특정 메소드 중심 콜 그래프 (지정 깊이)

### `GET /api/units`
- 유닛별 통계 (메소드 수, 사용률)

## 10. 데이터 모델

```
Project
├── name: string
├── dprPath: string
├── units: Unit[]

Unit
├── name: string
├── filePath: string
├── uses: string[]           # 이 유닛이 참조하는 다른 유닛
├── methods: Method[]

Method
├── id: string               # "UnitName.ClassName.MethodName" 형태의 고유 키
├── unitName: string
├── className: string | null
├── methodName: string
├── methodType: "procedure" | "function" | "constructor" | "destructor"
├── signature: string        # 전체 시그니처 문자열
├── lineNumber: int          # 선언 위치
├── bodyText: string         # begin...end 사이 코드
├── callers: MethodRef[]     # 이 메소드를 호출하는 메소드들
├── callees: MethodRef[]     # 이 메소드가 호출하는 메소드들
├── callCount: int           # callers의 총 수
├── isUsed: bool             # callCount > 0
├── complexityScore: int     # 코드 복잡도 점수 (0~100)

AnalysisSummary (요약 통계)
├── unitCount: int
├── methodCount: int
├── usedCount: int
├── unusedCount: int
├── cycleCount: int          # 탐지된 순환 참조 수

AnalysisResult
├── summary: AnalysisSummary
├── methods: list[Method]
├── cycles: list[list[str]]  # 각 리스트: 사이클 구성 메소드 ID 순서
```

## 11. 파싱 전략

### Step 1: .dpr 파싱
```
program MyApp;
uses
  Unit1 in 'src\Unit1.pas',
  Unit2 in 'src\Unit2.pas';
```
→ 정규식으로 `uses` 블록 추출 → `in '...'` 경로 매핑

### Step 2: .pas 메소드 선언 추출
```
procedure TMyClass.DoSomething(Param1: Integer);
function TMyClass.Calculate: Double;
procedure StandaloneProc;
```
→ `(procedure|function|constructor|destructor)\s+(\w+\.)?(\w+)` 패턴

### Step 3: 메소드 본문 추출
- `implementation` 섹션에서 메소드 선언 후 `begin` ~ 매칭되는 `end;` 구간
- 중첩 `begin...end` 처리 (depth counting)

### Step 4: 호출 탐지
- 각 메소드 본문에서 알려진 메소드명 목록을 토큰 단위로 매칭
- 주석, 문자열 리터럴 내부는 제외
- `MethodName(` 또는 `Object.MethodName` 패턴 우선 매칭

## 12. 프로젝트 구조

```
hackerton/
├── backend/
│   ├── main.py              # FastAPI 앱 엔트리
│   ├── parser/
│   │   ├── dpr_parser.py    # .dpr 파일 파서
│   │   ├── pas_parser.py    # .pas 파일 파서
│   │   └── tokenizer.py     # 주석/문자열 제거, 토큰화
│   ├── analyzer/
│   │   ├── call_graph.py    # 콜 그래프 + 순환 참조 탐지 엔진
│   │   ├── complexity.py    # 코드 복잡도 계산 모듈
│   │   └── models.py        # 데이터 모델 (Pydantic)
│   ├── api/
│   │   └── routes.py        # API 라우트 정의
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ProjectInput.tsx
│   │   │   ├── SummaryCards.tsx
│   │   │   ├── MethodTable.tsx
│   │   │   ├── MethodDetail.tsx
│   │   │   ├── CallGraph.tsx
│   │   │   ├── UnitChart.tsx
│   │   │   └── ComplexityMap.tsx
│   │   ├── hooks/
│   │   │   └── useApi.ts
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   └── tailwind.config.js
└── PRD.md
```

## 13. 스프린트 계획

각 스프린트의 상세 태스크는 `docs/sprints/` 디렉토리에서 관리합니다.

| 스프린트 | 내용 | 산출물 | 문서 |
|----------|------|--------|------|
| **Sprint 1** | Delphi 파서 코어 | CLI 메소드 목록 출력 | [SPRINT-1.md](docs/sprints/SPRINT-1.md) |
| **Sprint 2** | 콜 그래프 분석 엔진 | 호출 관계 JSON 출력 | [SPRINT-2.md](docs/sprints/SPRINT-2.md) |
| **Sprint 3** | FastAPI REST API | API 엔드포인트 동작 | [SPRINT-3.md](docs/sprints/SPRINT-3.md) |
| **Sprint 4** | 대시보드 — 요약 + 테이블 | 기본 대시보드 UI | [SPRINT-4.md](docs/sprints/SPRINT-4.md) |
| **Sprint 5** | 콜 그래프 시각화 | 인터랙티브 그래프 | [SPRINT-5.md](docs/sprints/SPRINT-5.md) |
| **Sprint 6** | 유닛별 분석 + 마무리 | 완성된 대시보드 | [SPRINT-6.md](docs/sprints/SPRINT-6.md) |
| **Sprint 7** | 순환 참조 탐지 + 복잡도 히트맵 | 고도화된 대시보드 | [SPRINT-7.md](docs/sprints/SPRINT-7.md) |

## 14. 검증 계획

### 14.1 핵심 가설

| # | 가설 | 검증 방법 |
|---|------|-----------|
| H1 | Delphi .pas 파일을 정규식 기반으로 파싱하여 메소드 선언의 **90% 이상**을 정확히 추출할 수 있다 | 샘플 프로젝트 3개에서 수동 카운트 vs 파서 결과 비교 |
| H2 | 텍스트 매칭 기반 호출 탐지로 실제 호출 관계의 **80% 이상**을 식별할 수 있다 | 소규모 프로젝트에서 IDE "Find References" 결과와 교차 검증 |
| H3 | 미사용 메소드 식별 결과가 개발자의 수동 판단과 **70% 이상** 일치한다 | Delphi 개발자 2-3명에게 결과 리뷰 요청 |
| H4 | 대시보드를 통해 프로젝트 전체 메소드 사용 현황을 **5분 이내**에 파악할 수 있다 | 사용성 테스트 — 처음 접하는 사용자가 미사용 메소드 목록까지 도달하는 시간 측정 |
| H5 | 정적 텍스트 기반 DFS 탐지로 실제 순환 참조의 **90% 이상**을 탐지할 수 있다 | A→B→C→A 패턴 및 다중 사이클 포함 샘플 프로젝트로 자동화 테스트 검증 |
| H6 | 복잡도 점수(0~100)가 개발자의 주관적 복잡도 판단과 **70% 이상** 일치한다 | 복잡도 높은 메소드 Top 10을 Delphi 경험자가 리뷰하여 일치율 측정 |

### 14.2 성공 지표 (Success Metrics)

| 지표 | 목표값 | 측정 방법 |
|------|--------|-----------|
| **파서 정확도** (Precision) | 메소드 추출 정확률 ≥ 90% | 샘플 프로젝트 수동 검증 대비 정확 추출 비율 |
| **파서 재현율** (Recall) | 메소드 누락률 ≤ 10% | 실제 존재 메소드 중 파서가 찾지 못한 비율 |
| **호출 탐지 정확도** | 정탐률 ≥ 80% | 탐지된 호출 중 실제 호출인 비율 |
| **호출 탐지 오탐률** | 오탐(false positive) ≤ 20% | 탐지된 호출 중 실제로는 아닌 비율 |
| **분석 성능** | 100개 유닛 프로젝트 분석 ≤ 30초 | 분석 API 응답 시간 측정 |
| **사용자 Task 완료율** | 첫 분석~결과 확인까지 이탈 없이 완료 | 사용성 테스트 관찰 |
| **Dead Code 발견율** | 실제 미사용 코드의 70% 이상 식별 | IDE 수동 검증과 비교 |

### 14.3 검증 시나리오

**시나리오 A: 소규모 프로젝트 (10개 유닛 이하)**
1. 샘플 Delphi 프로젝트 직접 작성 (다양한 패턴 포함)
2. 파서 결과 vs 실제 메소드 수동 카운트 비교
3. 콜 그래프 결과 vs IDE Find References 비교

**시나리오 B: 중규모 실제 프로젝트 (50~100개 유닛)**
1. 오픈소스 Delphi 프로젝트 활용 (GitHub 소스)
2. 분석 시간, 메모리 사용량 측정
3. 미사용 판정 결과를 Delphi 경험자가 리뷰

**시나리오 C: 사용자 경험 검증**
1. 처음 접하는 사용자에게 "이 프로젝트에서 미사용 메소드를 찾아보세요" 과제 부여
2. Task 완료 시간, 클릭 수, 혼란 지점 관찰
3. 대시보드의 정보 탐색 흐름이 직관적인지 평가

### 14.4 테스트 전략

#### 단위 테스트 (Unit Test)
| 대상 | 테스트 항목 | 도구 |
|------|------------|------|
| `tokenizer.py` | 주석 제거, 문자열 마스킹, 엣지 케이스 | pytest |
| `dpr_parser.py` | uses 절 파싱, 경로 매핑, 프로젝트명 추출 | pytest |
| `pas_parser.py` | 메소드 선언 추출, 본문 추출, 중첩 begin/end | pytest |
| `call_graph.py` | 호출 탐지, 양방향 매핑 일관성, 순환 참조 | pytest |
| `models.py` | Pydantic 직렬화/역직렬화 | pytest |
| React 컴포넌트 | 렌더링, 상태 변화, 이벤트 핸들링 | Vitest + Testing Library |

#### 통합 테스트 (Integration Test)
| 시나리오 | 검증 내용 | 도구 |
|----------|-----------|------|
| 파서 → 분석 파이프라인 | .dpr 입력 → 콜 그래프 JSON 출력 전체 플로우 | pytest |
| API 엔드포인트 | 각 API 요청/응답 검증 | pytest + httpx |
| 프론트 ↔ 백엔드 | API 호출 → UI 렌더링 연동 | Vitest + MSW (Mock Service Worker) |

#### E2E 테스트 (End-to-End)
| 시나리오 | 검증 내용 | 도구 |
|----------|-----------|------|
| 전체 플로우 | 경로 입력 → 분석 → 요약 확인 → 테이블 필터 → 그래프 조회 | Playwright |
| 에러 케이스 | 잘못된 경로, 빈 프로젝트, 서버 미응답 시 UI 동작 | Playwright |

#### 테스트 커버리지 목표
| 레이어 | 목표 커버리지 | 비고 |
|--------|-------------|------|
| 파서 모듈 | ≥ 90% | 핵심 로직, 높은 커버리지 필수 |
| 분석 엔진 | ≥ 85% | 호출 탐지 로직 중심 |
| API 라우트 | ≥ 80% | 요청/응답 매핑 |
| React 컴포넌트 | ≥ 70% | 주요 인터랙션 위주 |
| E2E | 핵심 시나리오 3개 | 전체 플로우 검증 |

### 14.5 CI/CD 파이프라인

```
[Push / PR] → [Lint] → [Unit Test] → [Integration Test] → [Build] → [E2E] → [Deploy Preview]
```

| 단계 | 도구 | 트리거 |
|------|------|--------|
| **Lint** | Ruff (Python) + ESLint (TS) | 모든 push/PR |
| **Unit Test** | pytest + Vitest | 모든 push/PR |
| **Integration Test** | pytest + httpx | 모든 push/PR |
| **Build** | Vite build + Python 패키지 검증 | PR merge |
| **E2E Test** | Playwright | PR merge to main |
| **Deploy Preview** | (선택) Vercel/Netlify preview | PR 생성 시 |

CI 환경: **GitHub Actions**
- `.github/workflows/ci.yml` — lint + test + build
- `.github/workflows/e2e.yml` — E2E 테스트 (main merge 시)

### 14.6 사용성 테스트 계획

| 항목 | 내용 |
|------|------|
| **대상** | Delphi 경험자 1-2명 + 비경험자 1-2명 |
| **과제** | "이 프로젝트에서 미사용 메소드 Top 5를 찾고, 특정 메소드의 호출 관계를 확인하세요" |
| **측정 지표** | Task 완료 시간, 클릭 수, 오류 횟수, 혼란 지점 |
| **방법** | Think-aloud 프로토콜 (화면 공유 + 생각 말하기) |
| **시점** | Sprint 6 완료 후 |
| **기록** | 관찰 노트 → `docs/usability-test-results.md`에 정리 |

### 14.7 MVP 검증 기준 (Go/No-Go)

| 조건 | 기준 |
|------|------|
| **Go** | H1, H2 가설 목표치 달성 + 시나리오 A 통과 + 핵심 테스트 전부 통과 |
| **Pivot** | 파서 정확도 < 70%인 경우 → AST 기반 파서로 전환 검토 |
| **Stop** | Delphi 소스의 인코딩/문법 변형이 너무 다양하여 범용 파싱 자체가 비현실적인 경우 |

## 15. 향후 확장 (Out of Scope for v1)

- `.dfm` 파일 파싱으로 이벤트 핸들러 바인딩 탐지
- `.dcu` 바이너리 유닛 심볼 추출
- 여러 `.dpr` 프로젝트 비교 분석
- 프로젝트 히스토리 저장 (SQLite)
- Dead code 자동 제거 제안
- RTTI / 메시지 핸들러 / virtual method dispatch 탐지
