"""Call graph analysis engine for Delphi projects.

Builds caller/callee relationships between methods using static text matching,
then identifies used vs. unused methods.
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict

from backend.analyzer.complexity import calculate_complexity, enrich_methods_with_complexity
from backend.analyzer.models import (
    AnalysisResult,
    AnalysisSummary,
    Method,
    MethodDetail,
    MethodRef,
    Project,
)
from backend.parser.tokenizer import clean_source, mask_strings

logger = logging.getLogger(__name__)

# Delphi keywords that look like identifiers but are not method calls
_DELPHI_KEYWORDS = frozenset(
    {
        "and", "array", "as", "asm", "begin", "case", "class", "const",
        "constructor", "destructor", "div", "do", "downto", "else", "end",
        "except", "exports", "file", "finalization", "finally", "for",
        "function", "goto", "if", "implementation", "in", "inherited",
        "initialization", "inline", "interface", "is", "label", "library",
        "mod", "nil", "not", "object", "of", "on", "operator", "or", "out",
        "packed", "procedure", "program", "property", "raise", "record",
        "repeat", "resourcestring", "set", "shl", "shr", "string", "then",
        "threadvar", "to", "try", "type", "unit", "until", "uses", "var",
        "while", "with", "xor", "result", "self", "true", "false",
    }
)


def _make_ref(method: Method) -> MethodRef:
    return MethodRef(
        id=method.id,
        unit_name=method.unit_name,
        class_name=method.class_name,
        method_name=method.method_name,
    )


def _build_method_index(project: Project) -> dict[str, list[Method]]:
    """Map lowercase method name → list of Method objects across all units."""
    index: dict[str, list[Method]] = defaultdict(list)
    for unit in project.units:
        for method in unit.methods:
            index[method.method_name.lower()].append(method)
    return dict(index)


def _build_call_pattern(method_index: dict[str, list[Method]]) -> re.Pattern[str] | None:
    """Build a single compiled regex matching any known method name as a word boundary.

    Method names are sorted longest-first so longer names take precedence in
    alternation matching (prevents prefix shadowing).
    """
    names = [k for k in method_index if k not in _DELPHI_KEYWORDS]
    if not names:
        return None
    # Longest first to avoid prefix shadowing (e.g., "Init" before "Initialize")
    names.sort(key=len, reverse=True)
    alternation = "|".join(re.escape(n) for n in names)
    return re.compile(rf"\b({alternation})\b", re.IGNORECASE)


def _build_uses_set(project: Project) -> dict[str, set[str]]:
    """Return mapping of unit_name → set of unit names it uses (lowercase)."""
    result: dict[str, set[str]] = {}
    for unit in project.units:
        result[unit.name.lower()] = {u.lower() for u in unit.uses}
    return result


def _resolve_candidates(
    name_lower: str,
    caller: Method,
    method_index: dict[str, list[Method]],
    uses_map: dict[str, set[str]],
) -> list[Method]:
    """Choose which Method objects a name reference in caller's body resolves to.

    Priority:
    1. Same unit as caller
    2. Units listed in caller's unit's uses clause
    3. All candidates (false-positive tolerated)
    """
    candidates = method_index.get(name_lower, [])
    if not candidates:
        return []

    # Filter out self (recursive calls handled separately)
    non_self = [c for c in candidates if c.id != caller.id]
    if not non_self:
        return []

    caller_unit_lower = caller.unit_name.lower()

    # Priority 1: same unit
    same_unit = [c for c in non_self if c.unit_name.lower() == caller_unit_lower]
    if same_unit:
        return same_unit

    # Priority 2: units in uses clause
    uses_set = uses_map.get(caller_unit_lower, set())
    in_uses = [c for c in non_self if c.unit_name.lower() in uses_set]
    if in_uses:
        return in_uses

    # Priority 3: all remaining candidates
    return non_self


def _detect_and_link_calls(
    caller: Method,
    method_index: dict[str, list[Method]],
    uses_map: dict[str, set[str]],
    pattern: re.Pattern[str],
) -> None:
    """Scan caller.body_text, find referenced method names, and add edges."""
    if not caller.body_text:
        return

    try:
        _do_link_calls(caller, method_index, uses_map, pattern)
    except Exception as exc:
        logger.warning(
            "메소드 호출 탐지 중 오류 발생 — 건너뜀: %s (%s: %s)",
            caller.id,
            type(exc).__name__,
            exc,
        )


def _do_link_calls(
    caller: Method,
    method_index: dict[str, list[Method]],
    uses_map: dict[str, set[str]],
    pattern: re.Pattern[str],
) -> None:
    """호출 탐지 및 양방향 링크 구축 내부 구현."""
    # body_text already has comments stripped; mask string literals to avoid
    # false positives from string contents that look like method names.
    masked = mask_strings(caller.body_text)

    # Remove "inherited <Name>" occurrences so we don't count them as calls
    masked = re.sub(r"\binherited\s+\w+", "inherited", masked, flags=re.IGNORECASE)

    seen_callees: set[str] = set()
    for match in pattern.finditer(masked):
        name_lower = match.group(1).lower()
        callees = _resolve_candidates(name_lower, caller, method_index, uses_map)
        for callee in callees:
            if callee.id in seen_callees:
                continue
            seen_callees.add(callee.id)

            caller_ref = _make_ref(caller)
            callee_ref = _make_ref(callee)

            # caller.callees: what this method calls
            if not any(r.id == callee.id for r in caller.callees):
                caller.callees.append(callee_ref)

            # callee.callers: who calls this method
            if not any(r.id == caller.id for r in callee.callers):
                callee.callers.append(caller_ref)


def _detect_cycles(methods: list[Method]) -> list[list[str]]:
    """DFS back-edge 탐지로 순환 호출 체인을 찾는다.

    Args:
        methods: 콜 그래프가 완성된 Method 리스트.

    Returns:
        각 사이클을 구성하는 method id 목록의 리스트.
        예: [["A.foo", "B.bar", "C.baz"]] — A→B→C→A 사이클.
    """
    # adjacency: id → callee id 목록
    adj: dict[str, list[str]] = {}
    id_set: set[str] = set()
    for m in methods:
        adj[m.id] = [ref.id for ref in m.callees]
        id_set.add(m.id)

    visited: set[str] = set()
    in_stack: set[str] = set()
    stack: list[str] = []
    cycles: list[list[str]] = []
    seen_cycles: set[frozenset[str]] = set()

    def dfs(node: str) -> None:
        visited.add(node)
        in_stack.add(node)
        stack.append(node)

        for neighbor in adj.get(node, []):
            if neighbor not in id_set:
                continue
            if neighbor not in visited:
                dfs(neighbor)
            elif neighbor in in_stack:
                # back-edge: 사이클 추출
                cycle_start = stack.index(neighbor)
                cycle = stack[cycle_start:]
                key = frozenset(cycle)
                if key not in seen_cycles:
                    seen_cycles.add(key)
                    cycles.append(list(cycle))

        stack.pop()
        in_stack.discard(node)

    for m in methods:
        if m.id not in visited:
            dfs(m.id)

    return cycles


def _extract_entry_body(dpr_source: str) -> str:
    """Extract the begin...end. block from a .dpr source."""
    cleaned = clean_source(dpr_source)
    match = re.search(r"\bbegin\b(.*?)\bend\s*\.", cleaned, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1)
    return ""


def _process_entry_point(
    dpr_source: str,
    method_index: dict[str, list[Method]],
    pattern: re.Pattern[str],
) -> None:
    """Detect calls in the DPR entry point block and mark those methods as called."""
    entry_body = _extract_entry_body(dpr_source)
    if not entry_body:
        return

    entry_body = re.sub(r"\binherited\s+\w+", "inherited", entry_body, flags=re.IGNORECASE)

    for match in pattern.finditer(entry_body):
        name_lower = match.group(1).lower()
        for method in method_index.get(name_lower, []):
            # Mark the method as called from the entry point
            entry_ref = MethodRef(
                id="__entrypoint__",
                unit_name="__dpr__",
                method_name="<program>",
            )
            if not any(r.id == "__entrypoint__" for r in method.callers):
                method.callers.append(entry_ref)


def analyze(project: Project, dpr_source: str = "") -> AnalysisResult:
    """Run call graph analysis on a parsed project.

    Args:
        project: Parsed project with units and methods (Sprint 1 output).
        dpr_source: Raw .dpr source text for entry-point analysis (optional).

    Returns:
        AnalysisResult with summary stats and full per-method detail.
    """
    total_units = len(project.units)
    total_methods_count = sum(len(u.methods) for u in project.units)
    logger.info(
        "분석 시작: 프로젝트=%s, 유닛=%d, 메소드=%d",
        project.name,
        total_units,
        total_methods_count,
    )

    # Reset any previous analysis state on methods (idempotent)
    for unit in project.units:
        for method in unit.methods:
            method.callers = []
            method.callees = []
            method.call_count = 0
            method.is_used = False

    method_index = _build_method_index(project)
    pattern = _build_call_pattern(method_index)
    uses_map = _build_uses_set(project)

    if pattern is not None:
        for unit in project.units:
            for method in unit.methods:
                _detect_and_link_calls(method, method_index, uses_map, pattern)

        if dpr_source:
            _process_entry_point(dpr_source, method_index, pattern)

    # Finalise per-method stats
    all_methods: list[Method] = [
        method for unit in project.units for method in unit.methods
    ]
    for method in all_methods:
        method.call_count = len(method.callers)
        method.is_used = method.call_count > 0

    # Detect cycles
    cycles = _detect_cycles(all_methods)

    # Build summary
    total_methods = len(all_methods)
    used_count = sum(1 for m in all_methods if m.is_used)
    unused_count = total_methods - used_count
    unused_ratio = unused_count / total_methods if total_methods > 0 else 0.0

    summary = AnalysisSummary(
        total_units=len(project.units),
        total_methods=total_methods,
        used_count=used_count,
        unused_count=unused_count,
        unused_ratio=round(unused_ratio, 4),
        cycle_count=len(cycles),
    )

    methods = [
        MethodDetail(
            id=m.id,
            unit_name=m.unit_name,
            class_name=m.class_name,
            method_name=m.method_name,
            method_type=m.method_type,
            signature=m.signature,
            line_number=m.line_number,
            callers=list(m.callers),
            callees=list(m.callees),
            call_count=m.call_count,
            is_used=m.is_used,
        )
        for m in all_methods
    ]

    # Enrich methods with complexity scores (body_text from Method)
    body_map = {m.id: m.body_text for m in all_methods}
    for detail in methods:
        detail.complexity_score = calculate_complexity(body_map.get(detail.id, "") or "")

    result = AnalysisResult(
        project_name=project.name,
        summary=summary,
        methods=methods,
        cycles=cycles,
    )

    logger.info(
        "분석 완료: 프로젝트=%s, 총=%d, 사용=%d, 미사용=%d (%.1f%%)",
        project.name,
        summary.total_methods,
        summary.used_count,
        summary.unused_count,
        summary.unused_ratio * 100,
    )
    return result
