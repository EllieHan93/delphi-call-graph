"""CLI entrypoint: parse a .dpr project and optionally run call graph analysis.

Usage:
    python -m backend.cli <path-to-dpr>                    # parse only (JSON)
    python -m backend.cli <path-to-dpr> --analyze          # full analysis JSON
    python -m backend.cli <path-to-dpr> --analyze --unused-only  # unused only
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from backend.analyzer.models import Project, Unit
from backend.parser.dpr_parser import parse_dpr
from backend.parser.pas_parser import parse_pas


def analyze_project(dpr_path: str | Path) -> tuple[Project, str]:
    """Parse a .dpr file and all referenced .pas units.

    Returns:
        Tuple of (Project model, raw dpr source text).
    """
    dpr_path = Path(dpr_path)
    dpr_source = dpr_path.read_text(encoding="utf-8", errors="replace")
    dpr_info = parse_dpr(dpr_path)

    units: list[Unit] = []
    for dpr_unit in dpr_info.units:
        if not dpr_unit.absolute_path:
            continue  # Skip units without path (e.g., system units like Forms)

        pas_path = Path(dpr_unit.absolute_path)
        if not pas_path.is_file():
            print(f"[WARN] Unit file not found, skipping: {pas_path}", file=sys.stderr)
            continue

        try:
            unit = parse_pas(pas_path)
            units.append(unit)
        except Exception as e:
            print(f"[WARN] Failed to parse {pas_path}: {e}", file=sys.stderr)

    project = Project(
        name=dpr_info.project_name,
        dpr_path=str(dpr_path.resolve()),
        units=units,
    )
    return project, dpr_source


def main() -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(
        prog="python -m backend.cli",
        description="Delphi static call graph analyzer",
    )
    parser.add_argument("dpr_path", help="Path to the .dpr project file")
    parser.add_argument(
        "--analyze",
        action="store_true",
        help="Run call graph analysis and output AnalysisResult JSON",
    )
    parser.add_argument(
        "--unused-only",
        action="store_true",
        help="(With --analyze) Output only unused methods",
    )

    args = parser.parse_args()

    try:
        project, dpr_source = analyze_project(args.dpr_path)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"Parse error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.analyze:
        from backend.analyzer.call_graph import analyze

        result = analyze(project, dpr_source)

        if args.unused_only:
            output = result.model_dump()
            output["methods"] = [m for m in output["methods"] if not m["is_used"]]
            output["summary"]["used_count"] = 0  # filtered view — keep summary honest
        else:
            output = result.model_dump()

        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        output = project.model_dump(by_alias=False)
        print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
