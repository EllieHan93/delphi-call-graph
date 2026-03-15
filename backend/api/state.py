"""In-memory analysis state management.

Stores the latest AnalysisResult and related data for the current session.
No persistence — restarting the server clears all state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from backend.analyzer.models import AnalysisResult, Project


@dataclass
class AnalysisState:
    """Container for the current analysis session state."""

    project: Project | None = None
    dpr_source: str = ""
    result: AnalysisResult | None = None
    # method_id → body_text (extracted from parsed Method objects)
    method_body_index: dict[str, str] = field(default_factory=dict)


_state = AnalysisState()


def get_state() -> AnalysisState:
    """Return the current analysis state."""
    return _state


def reset_state() -> None:
    """Clear all analysis state (used in tests and on new analysis)."""
    global _state
    _state = AnalysisState()


def run_analysis(dpr_path: str | Path) -> AnalysisResult:
    """Parse the .dpr project and run call graph analysis.

    Stores the result in the global state and returns it.

    Raises:
        FileNotFoundError: If the .dpr file does not exist.
        ValueError: If the file is not a .dpr file.
    """
    from backend.analyzer.call_graph import analyze
    from backend.cli import analyze_project

    dpr_path = Path(dpr_path)

    if not dpr_path.exists():
        raise FileNotFoundError(f".dpr 파일을 찾을 수 없습니다: {dpr_path}")
    if dpr_path.suffix.lower() != ".dpr":
        raise ValueError(f".dpr 파일이 아닙니다: {dpr_path.name}")

    project, dpr_source = analyze_project(dpr_path)
    result = analyze(project, dpr_source)

    # Build body index from parsed project units
    body_index: dict[str, str] = {}
    for unit in project.units:
        for method in unit.methods:
            body_index[method.id] = method.body_text

    global _state
    _state = AnalysisState(
        project=project,
        dpr_source=dpr_source,
        result=result,
        method_body_index=body_index,
    )

    return result
