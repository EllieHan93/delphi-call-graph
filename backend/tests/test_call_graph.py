"""Tests for the call graph analysis engine (Sprint 2)."""

from __future__ import annotations

from pathlib import Path

from backend.analyzer.call_graph import (
    _build_call_pattern,
    _build_method_index,
    _build_uses_set,
    _detect_and_link_calls,
    _extract_entry_body,
    _resolve_candidates,
    analyze,
)
from backend.analyzer.models import (
    AnalysisResult,
    Method,
    MethodType,
    Project,
    Unit,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_method(
    unit_name: str,
    method_name: str,
    class_name: str | None = None,
    body_text: str = "",
    method_type: MethodType = MethodType.PROCEDURE,
) -> Method:
    class_part = f"{class_name}." if class_name else ""
    id_ = f"{unit_name}.{class_part}{method_name}"
    if method_type == MethodType.PROCEDURE:
        sig = f"procedure {class_part}{method_name}"
    else:
        sig = f"function {class_part}{method_name}: string"
    return Method(
        id=id_,
        unit_name=unit_name,
        class_name=class_name,
        method_name=method_name,
        method_type=method_type,
        signature=sig,
        line_number=1,
        body_text=body_text,
    )


def _make_unit(name: str, methods: list[Method], uses: list[str] | None = None) -> Unit:
    return Unit(name=name, file_path=f"{name}.pas", uses=uses or [], methods=methods)


def _make_project(*units: Unit) -> Project:
    return Project(name="TestProject", dpr_path="Test.dpr", units=list(units))


# ---------------------------------------------------------------------------
# TestBuildMethodIndex
# ---------------------------------------------------------------------------


class TestBuildMethodIndex:
    def test_single_method(self) -> None:
        m = _make_method("UnitA", "DoSomething")
        project = _make_project(_make_unit("UnitA", [m]))
        index = _build_method_index(project)
        assert "dosomething" in index
        assert index["dosomething"] == [m]

    def test_multiple_units(self) -> None:
        m1 = _make_method("UnitA", "Alpha")
        m2 = _make_method("UnitB", "Beta")
        project = _make_project(_make_unit("UnitA", [m1]), _make_unit("UnitB", [m2]))
        index = _build_method_index(project)
        assert "alpha" in index
        assert "beta" in index

    def test_same_name_grouped(self) -> None:
        m1 = _make_method("UnitA", "Init")
        m2 = _make_method("UnitB", "Init")
        project = _make_project(_make_unit("UnitA", [m1]), _make_unit("UnitB", [m2]))
        index = _build_method_index(project)
        assert len(index["init"]) == 2
        assert m1 in index["init"]
        assert m2 in index["init"]

    def test_case_insensitive_key(self) -> None:
        m = _make_method("UnitA", "FormCreate")
        project = _make_project(_make_unit("UnitA", [m]))
        index = _build_method_index(project)
        assert "formcreate" in index
        assert "FormCreate" not in index


# ---------------------------------------------------------------------------
# TestDetectCalls
# ---------------------------------------------------------------------------


class TestDetectCalls:
    def _setup(self, caller_body: str) -> tuple[Method, Method, Method]:
        """Return (caller, target, other) methods for detection tests."""
        caller = _make_method("UnitA", "Caller", body_text=caller_body)
        target = _make_method("UnitA", "Target")
        other = _make_method("UnitA", "Other")
        return caller, target, other

    def _run(self, caller: Method, *all_methods: Method) -> None:
        units = [_make_unit("UnitA", list(all_methods) + [caller])]
        project = _make_project(*units)
        index = _build_method_index(project)
        pattern = _build_call_pattern(index)
        uses_map = _build_uses_set(project)
        assert pattern is not None
        _detect_and_link_calls(caller, index, uses_map, pattern)

    def test_plain_call_detected(self) -> None:
        caller, target, _ = self._setup("begin Target; end;")
        self._run(caller, target)
        assert any(r.id == target.id for r in caller.callees)
        assert any(r.id == caller.id for r in target.callers)

    def test_member_call_detected(self) -> None:
        caller, target, _ = self._setup("begin Obj.Target; end;")
        self._run(caller, target)
        assert any(r.id == target.id for r in caller.callees)

    def test_string_content_not_matched(self) -> None:
        # "Target" inside a string literal should NOT be detected
        caller, target, _ = self._setup("begin s := 'call Target here'; end;")
        self._run(caller, target)
        assert not any(r.id == target.id for r in caller.callees)

    def test_self_call_excluded(self) -> None:
        caller = _make_method("UnitA", "Recursive", body_text="begin Recursive; end;")
        other = _make_method("UnitA", "Other")
        units = [_make_unit("UnitA", [caller, other])]
        project = _make_project(*units)
        index = _build_method_index(project)
        pattern = _build_call_pattern(index)
        uses_map = _build_uses_set(project)
        assert pattern is not None
        _detect_and_link_calls(caller, index, uses_map, pattern)
        # Recursive should not appear in its own callers
        assert not any(r.id == caller.id for r in caller.callers)

    def test_inherited_keyword_excluded(self) -> None:
        # "inherited Create" should not count as a call to Create method
        create = _make_method(
            "UnitA", "Create", class_name="TFoo",
            method_type=MethodType.CONSTRUCTOR,
        )
        caller = _make_method(
            "UnitA", "Create", class_name="TBar",
            body_text="begin inherited Create(AOwner); end;",
            method_type=MethodType.CONSTRUCTOR,
        )
        units = [_make_unit("UnitA", [create, caller])]
        project = _make_project(*units)
        index = _build_method_index(project)
        pattern = _build_call_pattern(index)
        uses_map = _build_uses_set(project)
        assert pattern is not None
        _detect_and_link_calls(caller, index, uses_map, pattern)
        # create should NOT appear as a callee of caller (it's an inherited call)
        assert not any(r.id == create.id for r in caller.callees)

    def test_no_false_positive_on_subword(self) -> None:
        # "InitializeAll" should not match as a call to "Initialize"
        init = _make_method("UnitA", "Initialize")
        caller = _make_method("UnitA", "Caller", body_text="begin InitializeAll; end;")
        other = _make_method("UnitA", "InitializeAll")
        units = [_make_unit("UnitA", [init, caller, other])]
        project = _make_project(*units)
        index = _build_method_index(project)
        pattern = _build_call_pattern(index)
        uses_map = _build_uses_set(project)
        assert pattern is not None
        _detect_and_link_calls(caller, index, uses_map, pattern)
        # Should match InitializeAll (the longer name), not Initialize
        assert not any(r.id == init.id for r in caller.callees)
        assert any(r.id == other.id for r in caller.callees)


# ---------------------------------------------------------------------------
# TestResolveCandidates
# ---------------------------------------------------------------------------


class TestResolveCandidates:
    def test_same_unit_wins(self) -> None:
        caller = _make_method("UnitA", "Caller")
        same = _make_method("UnitA", "Helper")
        other = _make_method("UnitB", "Helper")
        project = _make_project(
            _make_unit("UnitA", [caller, same]),
            _make_unit("UnitB", [other]),
        )
        index = _build_method_index(project)
        uses_map = _build_uses_set(project)
        result = _resolve_candidates("helper", caller, index, uses_map)
        assert result == [same]

    def test_uses_unit_wins_over_unknown(self) -> None:
        caller = _make_method("UnitA", "Caller")
        in_uses = _make_method("UnitB", "Helper")
        not_in_uses = _make_method("UnitC", "Helper")
        project = _make_project(
            _make_unit("UnitA", [caller], uses=["UnitB"]),
            _make_unit("UnitB", [in_uses]),
            _make_unit("UnitC", [not_in_uses]),
        )
        index = _build_method_index(project)
        uses_map = _build_uses_set(project)
        result = _resolve_candidates("helper", caller, index, uses_map)
        assert in_uses in result
        assert not_in_uses not in result

    def test_all_fallback(self) -> None:
        caller = _make_method("UnitA", "Caller")
        m1 = _make_method("UnitB", "Helper")
        m2 = _make_method("UnitC", "Helper")
        project = _make_project(
            _make_unit("UnitA", [caller]),
            _make_unit("UnitB", [m1]),
            _make_unit("UnitC", [m2]),
        )
        index = _build_method_index(project)
        uses_map = _build_uses_set(project)
        result = _resolve_candidates("helper", caller, index, uses_map)
        assert m1 in result
        assert m2 in result

    def test_unknown_name_returns_empty(self) -> None:
        caller = _make_method("UnitA", "Caller")
        project = _make_project(_make_unit("UnitA", [caller]))
        index = _build_method_index(project)
        uses_map = _build_uses_set(project)
        result = _resolve_candidates("nonexistent", caller, index, uses_map)
        assert result == []


# ---------------------------------------------------------------------------
# TestBidirectionalConsistency
# ---------------------------------------------------------------------------


class TestBidirectionalConsistency:
    def test_callers_callees_symmetric(self) -> None:
        caller = _make_method("UnitA", "Caller", body_text="begin Callee; end;")
        callee = _make_method("UnitA", "Callee")
        project = _make_project(_make_unit("UnitA", [caller, callee]))

        result = analyze(project)

        caller_detail = next(m for m in result.methods if m.method_name == "Caller")
        callee_detail = next(m for m in result.methods if m.method_name == "Callee")

        # Caller's callees should include Callee
        assert any(r.id == callee_detail.id for r in caller_detail.callees)
        # Callee's callers should include Caller
        assert any(r.id == caller_detail.id for r in callee_detail.callers)

    def test_call_count_equals_callers_length(self) -> None:
        m1 = _make_method("UnitA", "A", body_text="begin Target; end;")
        m2 = _make_method("UnitA", "B", body_text="begin Target; end;")
        target = _make_method("UnitA", "Target")
        project = _make_project(_make_unit("UnitA", [m1, m2, target]))

        result = analyze(project)

        target_detail = next(m for m in result.methods if m.method_name == "Target")
        assert target_detail.call_count == len(target_detail.callers)
        assert target_detail.call_count == 2


# ---------------------------------------------------------------------------
# TestCircularReferences
# ---------------------------------------------------------------------------


class TestCircularReferences:
    def test_mutual_recursion_no_infinite_loop(self) -> None:
        a = _make_method("UnitA", "Alpha", body_text="begin Beta; end;")
        b = _make_method("UnitA", "Beta", body_text="begin Alpha; end;")
        project = _make_project(_make_unit("UnitA", [a, b]))

        # Must not raise or loop infinitely
        result = analyze(project)
        assert isinstance(result, AnalysisResult)

        alpha = next(m for m in result.methods if m.method_name == "Alpha")
        beta = next(m for m in result.methods if m.method_name == "Beta")
        assert alpha.is_used
        assert beta.is_used

    def test_self_loop_no_infinite_loop(self) -> None:
        a = _make_method("UnitA", "Recurse", body_text="begin Recurse; end;")
        project = _make_project(_make_unit("UnitA", [a]))
        result = analyze(project)
        # Self-calls are excluded from callers, so Recurse is unused
        recurse = next(m for m in result.methods if m.method_name == "Recurse")
        assert not recurse.is_used


# ---------------------------------------------------------------------------
# TestEntryPoint
# ---------------------------------------------------------------------------


class TestEntryPoint:
    def test_extract_entry_body(self) -> None:
        dpr = "program X;\nbegin\n  Initialize;\n  Run;\nend.\n"
        body = _extract_entry_body(dpr)
        assert "Initialize" in body
        assert "Run" in body

    def test_entry_point_marks_method_used(self) -> None:
        m = _make_method("UnitA", "Initialize")
        project = _make_project(_make_unit("UnitA", [m]))
        dpr_source = "program X;\nbegin\n  Initialize;\nend.\n"

        result = analyze(project, dpr_source)

        init_detail = next(d for d in result.methods if d.method_name == "Initialize")
        assert init_detail.is_used
        assert init_detail.call_count >= 1


# ---------------------------------------------------------------------------
# TestAnalyzeIntegration
# ---------------------------------------------------------------------------


class TestAnalyzeIntegration:
    """Full integration test against the sample project in samples/."""

    def test_sample_project_unused_methods(self, sample_dpr_path: Path) -> None:
        """DeprecatedCleanup and CalculateChecksum must be identified as unused."""
        from backend.cli import analyze_project

        project, dpr_source = analyze_project(sample_dpr_path)
        result = analyze(project, dpr_source)

        method_names = {m.method_name: m for m in result.methods}

        assert "DeprecatedCleanup" in method_names, "DeprecatedCleanup should be parsed"
        assert "CalculateChecksum" in method_names, "CalculateChecksum should be parsed"

        assert not method_names["DeprecatedCleanup"].is_used, "DeprecatedCleanup should be unused"
        assert not method_names["CalculateChecksum"].is_used, "CalculateChecksum should be unused"

    def test_sample_project_used_methods(self, sample_dpr_path: Path) -> None:
        """FormCreate, Initialize, QueryAll etc. should be detected as used."""
        from backend.cli import analyze_project

        project, dpr_source = analyze_project(sample_dpr_path)
        result = analyze(project, dpr_source)

        method_names = {m.method_name: m for m in result.methods}

        assert method_names["Initialize"].is_used
        assert method_names["QueryAll"].is_used
        assert method_names["LogMessage"].is_used
        assert method_names["FormatOutput"].is_used

    def test_summary_counts_consistent(self, sample_dpr_path: Path) -> None:
        """Summary totals should be consistent with method list."""
        from backend.cli import analyze_project

        project, dpr_source = analyze_project(sample_dpr_path)
        result = analyze(project, dpr_source)

        s = result.summary
        assert s.total_methods == len(result.methods)
        assert s.used_count + s.unused_count == s.total_methods
        assert 0.0 <= s.unused_ratio <= 1.0

    def test_analyze_result_type(self, sample_dpr_path: Path) -> None:
        from backend.cli import analyze_project

        project, dpr_source = analyze_project(sample_dpr_path)
        result = analyze(project, dpr_source)
        assert isinstance(result, AnalysisResult)
        assert result.project_name == "SampleApp"
