"""Parser for Delphi .dpr project files."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from backend.parser.tokenizer import strip_comments

# Matches: program <Name>;
_PROGRAM_RE = re.compile(r"program\s+(\w+)\s*;", re.IGNORECASE)

# Matches uses clause content between `uses` keyword and terminating `;`
_USES_BLOCK_RE = re.compile(r"\buses\b(.*?);", re.IGNORECASE | re.DOTALL)

# Matches individual unit entry:  UnitName  or  UnitName in 'path'
_UNIT_ENTRY_RE = re.compile(
    r"(\w+)\s*(?:in\s*'([^']*)')?\s*(?:,|$)",
    re.IGNORECASE,
)


@dataclass
class DprUnit:
    """A unit reference found in a .dpr uses clause."""

    name: str
    relative_path: str | None = None  # from `in '...'`
    absolute_path: str | None = None  # resolved against .dpr location


@dataclass
class DprInfo:
    """Parsed information from a .dpr file."""

    project_name: str
    dpr_path: str
    units: list[DprUnit]


def parse_dpr(dpr_path: str | Path) -> DprInfo:
    """Parse a .dpr file and return project name + unit list with resolved paths.

    Args:
        dpr_path: Path to the .dpr file.

    Returns:
        DprInfo with project name and list of units.

    Raises:
        FileNotFoundError: If the .dpr file does not exist.
        ValueError: If the file cannot be parsed as a valid .dpr.
    """
    dpr_path = Path(dpr_path).resolve()
    if not dpr_path.is_file():
        raise FileNotFoundError(f"DPR file not found: {dpr_path}")

    source = dpr_path.read_text(encoding="utf-8-sig", errors="replace")
    return parse_dpr_content(source, dpr_path)


def parse_dpr_content(source: str, dpr_path: Path | None = None) -> DprInfo:
    """Parse .dpr source content directly (useful for testing).

    Args:
        source: Raw .dpr file content.
        dpr_path: Optional path for resolving relative unit paths.

    Returns:
        DprInfo with project name and unit list.
    """
    cleaned = strip_comments(source)

    # Extract project name
    program_match = _PROGRAM_RE.search(cleaned)
    if not program_match:
        raise ValueError("Could not find 'program <Name>;' declaration in .dpr content")
    project_name = program_match.group(1)

    # Extract uses clause
    units: list[DprUnit] = []
    uses_match = _USES_BLOCK_RE.search(cleaned)
    if uses_match:
        uses_text = uses_match.group(1)
        for entry_match in _UNIT_ENTRY_RE.finditer(uses_text):
            unit_name = entry_match.group(1)
            relative_path = entry_match.group(2)

            absolute_path = None
            if relative_path and dpr_path:
                # Resolve relative to .dpr directory
                dpr_dir = dpr_path.parent if dpr_path.is_file() else dpr_path
                resolved = (dpr_dir / relative_path).resolve()
                absolute_path = str(resolved)

            units.append(
                DprUnit(
                    name=unit_name,
                    relative_path=relative_path,
                    absolute_path=absolute_path,
                )
            )

    return DprInfo(
        project_name=project_name,
        dpr_path=str(dpr_path) if dpr_path else "",
        units=units,
    )
