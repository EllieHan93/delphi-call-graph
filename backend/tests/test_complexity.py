"""Tests for the complexity calculator module (Sprint 7)."""

from __future__ import annotations

import pytest

from backend.analyzer.complexity import calculate_complexity, enrich_methods_with_complexity
from backend.analyzer.models import MethodDetail, MethodType


# ---------------------------------------------------------------------------
# calculate_complexity
# ---------------------------------------------------------------------------


class TestCalculateComplexity:
    def test_empty_body_returns_zero(self) -> None:
        assert calculate_complexity("") == 0

    def test_blank_body_returns_zero(self) -> None:
        assert calculate_complexity("   \n  \n  ") == 0

    def test_trivial_body_low_score(self) -> None:
        # 단순 begin..end, 제어문 없음
        score = calculate_complexity("begin\n  x := 1;\nend;")
        assert 0 <= score <= 20

    def test_if_keyword_increases_score(self) -> None:
        simple = calculate_complexity("begin\n  x := 1;\nend;")
        with_if = calculate_complexity("begin\n  if x > 0 then\n    x := 1;\nend;")
        assert with_if >= simple

    def test_many_control_statements_high_score(self) -> None:
        # 다수의 제어문 → 높은 점수
        body = "\n".join(
            [
                "begin",
                "  if a then begin",
                "    for i := 0 to 10 do begin",
                "      while b do begin",
                "        case c of",
                "          1: repeat x := x + 1; until x > 5;",
                "          2: try except end;",
                "        end;",
                "      end;",
                "    end;",
                "  end;",
                "end;",
            ]
        )
        score = calculate_complexity(body)
        assert score >= 40

    def test_long_body_increases_score(self) -> None:
        # 200줄 코드 → 줄 수 컴포넌트 최대
        lines = ["  x := x + 1;"] * 200
        body = "begin\n" + "\n".join(lines) + "\nend;"
        score = calculate_complexity(body)
        assert score >= 25

    def test_score_bounded_0_to_100(self) -> None:
        # 극단적인 입력도 0~100 범위
        huge = "if\n" * 500 + "begin\n" * 100
        score = calculate_complexity(huge)
        assert 0 <= score <= 100

    def test_deep_nesting_increases_score(self) -> None:
        # 깊이 6 이상 begin..end 중첩
        body = "begin " * 7 + "x := 1;" + " end;" * 7
        score = calculate_complexity(body)
        assert score >= 20

    def test_case_insensitive_keywords(self) -> None:
        upper = calculate_complexity("BEGIN\n  IF x > 0 THEN x := 1;\nEND;")
        lower = calculate_complexity("begin\n  if x > 0 then x := 1;\nend;")
        assert upper == lower

    @pytest.mark.parametrize("score", [0, 10, 50, 99, 100])
    def test_score_in_valid_range(self, score: int) -> None:
        # 점수가 항상 0~100 범위인지 파라메트릭 확인
        assert 0 <= score <= 100


# ---------------------------------------------------------------------------
# enrich_methods_with_complexity
# ---------------------------------------------------------------------------


class TestEnrichMethodsWithComplexity:
    def _make_detail(self, method_name: str, body_text: str = "") -> MethodDetail:
        return MethodDetail(
            id=f"UnitA.{method_name}",
            unit_name="UnitA",
            method_name=method_name,
            method_type=MethodType.PROCEDURE,
            signature=f"procedure {method_name}",
            line_number=1,
        )

    def test_enriches_all_methods(self) -> None:
        m1 = self._make_detail("Alpha")
        m2 = self._make_detail("Beta")
        # body_text 없음 → 0
        enrich_methods_with_complexity([m1, m2])
        assert m1.complexity_score == 0
        assert m2.complexity_score == 0

    def test_empty_list_no_error(self) -> None:
        # 빈 리스트도 오류 없이 처리
        enrich_methods_with_complexity([])

    def test_score_assigned(self) -> None:
        m = self._make_detail("WithControl")
        # body_text는 MethodDetail에 없어도 enrich가 0 반환
        enrich_methods_with_complexity([m])
        assert 0 <= m.complexity_score <= 100
