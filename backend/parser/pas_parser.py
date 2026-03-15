"""Parser for Delphi .pas unit files — extracts methods with their bodies."""

from __future__ import annotations

import re
from pathlib import Path

from backend.analyzer.models import Method, MethodType, Unit
from backend.parser.tokenizer import strip_comments

# Matches: unit <Name>;
_UNIT_NAME_RE = re.compile(r"\bunit\s+(\w+)\s*;", re.IGNORECASE)

# Splits source into interface / implementation sections
_SECTION_RE = re.compile(r"\b(interface|implementation)\b", re.IGNORECASE)

# Matches uses clause
_USES_BLOCK_RE = re.compile(r"\buses\b(.*?);", re.IGNORECASE | re.DOTALL)
_USES_ITEM_RE = re.compile(r"(\w+)")

# Matches method implementation header in the implementation section:
#   procedure|function|constructor|destructor [ClassName.]MethodName
_METHOD_IMPL_RE = re.compile(
    r"^[ \t]*(procedure|function|constructor|destructor)"
    r"\s+(?:(\w+)\.)?(\w+)"
    r"\s*(\([^)]*\))?"
    r"\s*(?::\s*(\w+))?"
    r"\s*;",
    re.IGNORECASE | re.MULTILINE,
)


def _find_method_body(source: str, begin_pos: int) -> str:
    """Extract the begin..end block starting from begin_pos, handling nesting.

    Args:
        source: Full source text.
        begin_pos: Position right after method header where we search for `begin`.

    Returns:
        The body text between begin and the matching end (inclusive).
    """
    # Find the first `begin` after begin_pos
    begin_re = re.compile(r"\bbegin\b", re.IGNORECASE)
    m = begin_re.search(source, begin_pos)
    if not m:
        return ""

    depth = 1
    pos = m.end()
    body_start = m.start()

    # Tokens that increase/decrease nesting depth
    block_re = re.compile(r"\b(begin|case|try|end)\b", re.IGNORECASE)

    while depth > 0 and pos < len(source):
        bm = block_re.search(source, pos)
        if not bm:
            break
        keyword = bm.group(1).lower()
        if keyword in ("begin", "case", "try"):
            depth += 1
        elif keyword == "end":
            depth -= 1
        pos = bm.end()

    # pos is right after the matching `end`
    return source[body_start:pos].strip()


def _line_number_at(source: str, pos: int) -> int:
    """Return 1-based line number for character position pos."""
    return source[:pos].count("\n") + 1


def parse_uses(section_text: str) -> list[str]:
    """Extract unit names from a uses clause within a section."""
    m = _USES_BLOCK_RE.search(section_text)
    if not m:
        return []
    return _USES_ITEM_RE.findall(m.group(1))


def parse_pas(pas_path: str | Path) -> Unit:
    """Parse a .pas file and extract unit info + methods.

    Args:
        pas_path: Path to the .pas file.

    Returns:
        Unit with name, uses, and methods list.

    Raises:
        FileNotFoundError: If file does not exist.
    """
    pas_path = Path(pas_path).resolve()
    if not pas_path.is_file():
        raise FileNotFoundError(f"PAS file not found: {pas_path}")

    source = pas_path.read_text(encoding="utf-8-sig", errors="replace")
    return parse_pas_content(source, str(pas_path))


def parse_pas_content(source: str, file_path: str = "") -> Unit:
    """Parse .pas source content directly.

    Args:
        source: Raw .pas file content.
        file_path: Optional file path for metadata.

    Returns:
        Unit with extracted methods.
    """
    cleaned = strip_comments(source)

    # Extract unit name
    unit_match = _UNIT_NAME_RE.search(cleaned)
    unit_name = unit_match.group(1) if unit_match else Path(file_path).stem

    # Split into interface / implementation
    sections = _split_sections(cleaned)
    interface_text = sections.get("interface", "")
    impl_text = sections.get("implementation", "")

    # Collect uses from both sections
    uses = []
    uses.extend(parse_uses(interface_text))
    uses.extend(parse_uses(impl_text))
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_uses = []
    for u in uses:
        if u not in seen:
            seen.add(u)
            unique_uses.append(u)

    # Extract methods from implementation section (where bodies live)
    methods = _extract_methods(source, cleaned, impl_text, unit_name)

    return Unit(
        name=unit_name,
        file_path=file_path,
        uses=unique_uses,
        methods=methods,
    )


def _split_sections(cleaned: str) -> dict[str, str]:
    """Split cleaned source into named sections."""
    sections: dict[str, str] = {}
    matches = list(_SECTION_RE.finditer(cleaned))
    for i, m in enumerate(matches):
        name = m.group(1).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned)
        sections[name] = cleaned[start:end]
    return sections


def _extract_methods(
    original: str,
    cleaned: str,
    impl_text: str,
    unit_name: str,
) -> list[Method]:
    """Extract method declarations and bodies from the implementation section."""
    # Find where implementation starts in the cleaned source
    impl_match = re.search(r"\bimplementation\b", cleaned, re.IGNORECASE)
    if not impl_match:
        return []
    impl_offset = impl_match.end()

    methods: list[Method] = []

    for m in _METHOD_IMPL_RE.finditer(cleaned, impl_offset):
        method_type_str = m.group(1).lower()
        class_name = m.group(2)  # may be None for standalone
        method_name = m.group(3)
        params = m.group(4) or ""
        return_type = m.group(5) or ""

        method_type = MethodType(method_type_str)

        # Build unique ID
        method_id = f"{unit_name}.{class_name}.{method_name}" if class_name else f"{unit_name}.{method_name}"

        # Build full signature
        signature = f"{method_type_str} "
        if class_name:
            signature += f"{class_name}."
        signature += method_name
        if params:
            signature += params
        if return_type:
            signature += f": {return_type}"
        signature += ";"

        # Line number (use original source for accurate mapping)
        line_number = _line_number_at(original, m.start())

        # Extract body from cleaned source
        body_text = _find_method_body(cleaned, m.end())

        methods.append(
            Method(
                id=method_id,
                unit_name=unit_name,
                class_name=class_name,
                method_name=method_name,
                method_type=method_type,
                signature=signature,
                line_number=line_number,
                body_text=body_text,
            )
        )

    return methods
