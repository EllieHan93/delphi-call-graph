"""Delphi source tokenizer — strips comments and masks string literals."""

from __future__ import annotations

import re

# Pattern matches Delphi comments and string literals in priority order:
#  1. (* ... *) block comments (possibly multiline)
#  2. { ... }   block comments (possibly multiline)
#  3. // ...    line comments
#  4. '...'     string literals (Delphi uses '' for escaped quote)
_TOKEN_PATTERN = re.compile(
    r"""
    (\(\*.*?\*\))        # (* block comment *)
    |(\{.*?\})           # { block comment }
    |(//[^\n]*)          # // line comment
    |('(?:''|[^'])*')    # 'string literal' with '' escape
    """,
    re.DOTALL | re.VERBOSE,
)


def strip_comments(source: str) -> str:
    """Remove all Delphi comments from source, preserving line structure.

    String literals are kept intact. Comments are replaced with spaces
    to preserve character offsets (useful for line-number mapping).
    """

    def _replace(match: re.Match[str]) -> str:
        # Group 4 = string literal → keep it
        if match.group(4):
            return match.group(4)
        # Comments → replace each char with space, keep newlines
        text = match.group(0)
        return re.sub(r"[^\n]", " ", text)

    return _TOKEN_PATTERN.sub(_replace, source)


def mask_strings(source: str) -> str:
    """Replace string literal contents with underscores, keeping quotes.

    Useful before method-call detection so that string contents
    don't produce false-positive matches.
    """

    def _replace(match: re.Match[str]) -> str:
        # Group 4 = string literal → mask contents
        if match.group(4):
            inner = match.group(4)[1:-1]  # strip outer quotes
            masked = re.sub(r"[^\n]", "_", inner)
            return f"'{masked}'"
        # Comments → keep as-is (caller should strip_comments first)
        return match.group(0)

    return _TOKEN_PATTERN.sub(_replace, source)


def clean_source(source: str) -> str:
    """Strip comments then mask string literals — full preprocessing pipeline."""
    return mask_strings(strip_comments(source))
