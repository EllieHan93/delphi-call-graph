# Sprint 1: Delphi 파서 코어

> **목표**: .dpr / .pas 파일을 읽어 메소드 목록을 추출하는 파서 완성
> **산출물**: CLI에서 프로젝트 경로 입력 → 메소드 목록 JSON 출력

---

## 태스크

### 1.1 프로젝트 초기 세팅
- [x] `backend/` 디렉토리 생성, Python 가상환경 구성
- [x] `requirements.txt` 작성 (fastapi, uvicorn, pydantic, pytest, httpx, ruff)
- [x] Pydantic 데이터 모델 정의 (`models.py`)
  - `Project`, `Unit`, `Method` 스키마
- [x] 테스트 구조 셋업: `backend/tests/` 디렉토리, `conftest.py`
- [x] Ruff 린트 설정: `pyproject.toml`에 ruff 룰 정의
- [x] 샘플 Delphi 프로젝트 생성: `samples/` 디렉토리에 테스트용 .dpr + .pas 파일

### 1.2 토크나이저 (`tokenizer.py`)
- [x] Delphi 소스에서 주석 제거: `//`, `{ }`, `(* *)`
- [x] 문자열 리터럴(`'...'`) 마스킹 처리
- [x] 유닛 테스트 작성 — 주석/문자열 제거 검증

### 1.3 .dpr 파서 (`dpr_parser.py`)
- [x] `program` 선언에서 프로젝트명 추출
- [x] `uses` 절 파싱 → 유닛명 + `in '경로'` 매핑
- [x] .dpr 기준 상대 경로 → 절대 경로 변환
- [x] 유닛 테스트 — 샘플 .dpr 파일 파싱 검증

### 1.4 .pas 파서 (`pas_parser.py`)
- [x] `unit`, `interface`, `implementation` 섹션 분리
- [x] `uses` 절 추출 (interface/implementation 양쪽)
- [x] 메소드 선언 추출
  - `procedure/function/constructor/destructor`
  - `TClassName.MethodName` 패턴 → className, methodName 분리
  - standalone procedure/function 처리
- [x] 메소드 본문 추출 (`begin...end` 블록, 중첩 depth 카운팅)
- [x] 라인 번호 매핑
- [x] 유닛 테스트 — 다양한 Delphi 패턴 커버

### 1.5 CLI 엔트리포인트
- [x] `python -m backend.cli <path-to-dpr>` 실행 시:
  1. .dpr 파싱 → 유닛 목록 수집
  2. 각 .pas 파싱 → 메소드 추출
  3. 결과를 JSON으로 stdout 출력
- [x] 에러 핸들링: 파일 못 찾음, 인코딩 문제 등

---

## 검증 결과 (2026-03-16)

| 항목 | 결과 |
|------|------|
| `pytest` (Sprint 1 테스트) | ✅ 45 passed (0.09s) |
| `tsc --noEmit` | 해당 없음 (프론트엔드 미구현) |
| `parser/dpr_parser.py` 커버리지 | ✅ 100% |
| `parser/pas_parser.py` 커버리지 | ✅ 97% |
| `parser/tokenizer.py` 커버리지 | ✅ 95% |

---

## 완료 조건 (Definition of Done)

- [x] 샘플 Delphi 프로젝트(.dpr + .pas 3개 이상)로 파싱 성공
- [x] 추출된 메소드 목록이 JSON 형태로 정확히 출력
- [x] 주석/문자열 내부 코드가 메소드로 오인되지 않음
- [x] 모든 유닛 테스트 통과 (`pytest` 실행)
- [x] Ruff 린트 통과 (경고 0개)
- [x] 파서 모듈 테스트 커버리지 ≥ 90% 목표

---

## 의사결정 기록 (Decision Records)

### DR-1.1: Regex vs Antlr4 파서 선택

**결정**: Python regex 기반 커스텀 파서 구현

**이유**:
- Python용 Delphi Antlr4 문법이 존재하나 JVM 의존성 또는 불완전한 Python 바인딩 문제
- 토이 프로젝트 범위에서 `procedure/function TClass.Method` 패턴의 regex 커버리지로 충분
- 주석/문자열 마스킹(`tokenizer.py`)으로 오탐 최소화 가능

**결과**: 정상 Delphi 코드 파싱 성공률 ~97%, 구현 시간 1/5 수준

### DR-1.2: utf-8-sig 인코딩 처리

**결정**: .pas 파일 읽기 시 `encoding='utf-8-sig'` 우선, 실패 시 `latin-1` fallback

**이유**:
- Delphi IDE가 BOM 있는 UTF-8 파일을 생성하는 경우가 많음
- `latin-1`은 모든 바이트를 오류 없이 읽어 최후 수단으로 활용

---

## 회고 (Retrospective)

### 잘된 점
- tokenizer 선구현으로 파서 오탐 문제를 처음부터 방지
- pytest conftest.py에 샘플 파일 픽스처를 등록해 모든 테스트가 재사용

### 개선할 점
- 중첩 `begin...end` 블록 depth 카운팅이 예상보다 복잡 → 추가 엣지 케이스 발견
- `TClass.Method` 패턴 외 standalone `procedure Name` 처리 추가 필요를 늦게 발견

### 예상 vs 실제 소요 시간
- 예상: 파서 코어 4시간
- 실제: 6시간 (중첩 블록 + 인코딩 이슈 처리)

---

## 샘플 입출력

**입력**:
```
python -m backend.cli C:/projects/MyApp/MyApp.dpr
```

**출력**:
```json
{
  "projectName": "MyApp",
  "dprPath": "C:/projects/MyApp/MyApp.dpr",
  "units": [
    {
      "name": "Unit1",
      "filePath": "C:/projects/MyApp/src/Unit1.pas",
      "uses": ["SysUtils", "Classes", "Unit2"],
      "methods": [
        {
          "id": "Unit1.TMyForm.FormCreate",
          "className": "TMyForm",
          "methodName": "FormCreate",
          "methodType": "procedure",
          "signature": "procedure TMyForm.FormCreate(Sender: TObject);",
          "lineNumber": 45
        }
      ]
    }
  ]
}
```
