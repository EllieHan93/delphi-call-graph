"""성능 테스트 — 100유닛/800메소드 합성 프로젝트 분석이 30초 이내 완료되어야 함.

PRD §12.2 성공 지표: "100유닛 규모 프로젝트 분석 ≤ 30초"
"""

from __future__ import annotations

import time

from backend.analyzer.call_graph import analyze
from backend.analyzer.models import Method, MethodType, Unit


def _make_synthetic_project(
    num_units: int = 100,
    methods_per_unit: int = 8,
) -> tuple[object, str]:
    """합성 Delphi 프로젝트 생성.

    Returns:
        (project, dpr_source) 튜플
    """
    from backend.analyzer.models import Project

    units: list[Unit] = []
    all_method_names: list[str] = []

    for u_idx in range(num_units):
        unit_name = f"Unit{u_idx}"
        methods: list[Method] = []

        for m_idx in range(methods_per_unit):
            method_name = f"Method{u_idx}_{m_idx}"
            all_method_names.append(method_name)
            method_id = f"{unit_name}.TClass{u_idx}.{method_name}"

            # 각 메소드 body에 다음 유닛의 첫 번째 메소드 호출 삽입 (체인 생성)
            next_unit = (u_idx + 1) % num_units
            callee_name = f"Method{next_unit}_0"
            body = f"begin\n  {callee_name};\nend;"

            methods.append(
                Method(
                    id=method_id,
                    unit_name=unit_name,
                    class_name=f"TClass{u_idx}",
                    method_name=method_name,
                    method_type=MethodType.PROCEDURE,
                    signature=f"procedure TClass{u_idx}.{method_name};",
                    line_number=10 + m_idx * 5,
                    body_text=body,
                )
            )

        unit = Unit(
            name=unit_name,
            file_path=f"/fake/{unit_name}.pas",
            uses=[f"Unit{(u_idx + 1) % num_units}"],
            methods=methods,
        )
        units.append(unit)

    project = Project(
        name="SyntheticApp",
        dpr_path="/fake/SyntheticApp.dpr",
        units=units,
    )

    # 진입점에서 첫 유닛의 첫 메소드 호출
    dpr_source = "program SyntheticApp;\nbegin\n  Method0_0;\nend."

    return project, dpr_source


class TestPerformance:
    """PRD §12.2 성능 목표 검증."""

    def test_analysis_completes_within_30_seconds(self) -> None:
        """100유닛 × 8메소드 = 800메소드 분석이 30초 이내 완료."""
        project, dpr_source = _make_synthetic_project(num_units=100, methods_per_unit=8)

        start = time.perf_counter()
        result = analyze(project, dpr_source)
        elapsed = time.perf_counter() - start

        assert elapsed < 30.0, (
            f"분석 시간 {elapsed:.2f}초가 PRD 목표(30초)를 초과했습니다."
        )

        # 결과 유효성도 확인
        assert result.summary.total_units == 100
        assert result.summary.total_methods == 800

    def test_analysis_completes_within_5_seconds_typical(self) -> None:
        """일반적인 환경에서 100유닛 분석은 5초 이내 (실용적 기준)."""
        project, dpr_source = _make_synthetic_project(num_units=100, methods_per_unit=8)

        start = time.perf_counter()
        analyze(project, dpr_source)
        elapsed = time.perf_counter() - start

        # 30초 절대 한계보다 훨씬 빠른 실용 기준
        assert elapsed < 5.0, (
            f"분석 시간 {elapsed:.2f}초 — 성능 저하 가능성이 있습니다."
        )

    def test_used_unused_ratio_synthetic(self) -> None:
        """합성 프로젝트에서 체인 호출로 사용 메소드가 올바르게 탐지됨."""
        project, dpr_source = _make_synthetic_project(num_units=10, methods_per_unit=5)
        result = analyze(project, dpr_source)

        # 체인 호출 구조이므로 적어도 일부 메소드는 사용 상태여야 함
        assert result.summary.used_count > 0
        assert result.summary.total_methods == 50

    def test_small_project_sub_second(self) -> None:
        """소규모 프로젝트(10유닛/50메소드)는 1초 이내 분석."""
        project, dpr_source = _make_synthetic_project(num_units=10, methods_per_unit=5)

        start = time.perf_counter()
        analyze(project, dpr_source)
        elapsed = time.perf_counter() - start

        assert elapsed < 1.0, f"소규모 분석이 {elapsed:.2f}초 — 예상치 못한 지연"

    def test_large_methods_per_unit(self) -> None:
        """유닛당 메소드 수가 많은 경우(50유닛 × 20메소드 = 1000메소드)도 30초 이내."""
        project, dpr_source = _make_synthetic_project(num_units=50, methods_per_unit=20)

        start = time.perf_counter()
        result = analyze(project, dpr_source)
        elapsed = time.perf_counter() - start

        assert elapsed < 30.0, f"1000메소드 분석이 {elapsed:.2f}초 초과"
        assert result.summary.total_methods == 1000
