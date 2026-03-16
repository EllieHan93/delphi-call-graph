"""Code complexity calculator for Delphi method bodies.

Computes a 0–100 complexity score based on:
- Line count
- Control-flow keyword density (if/for/while/repeat/case/try/except)
- Nested begin…end depth
"""

from __future__ import annotations

import re

from backend.analyzer.models import Method, MethodDetail

# 제어 흐름 키워드 (대소문자 무관)
_CONTROL_KEYWORDS = re.compile(
    r"\b(if|for|while|repeat|case|try|except|finally)\b", re.IGNORECASE
)
_BEGIN = re.compile(r"\bbegin\b", re.IGNORECASE)
_END = re.compile(r"\bend\b", re.IGNORECASE)


def calculate_complexity(body_text: str) -> int:
    """주어진 body_text로 복잡도 점수(0~100)를 계산한다.

    Args:
        body_text: 주석이 제거된 메소드 본문 텍스트.

    Returns:
        0~100 정규화된 복잡도 점수.
    """
    if not body_text or not body_text.strip():
        return 0

    lines = [ln for ln in body_text.splitlines() if ln.strip()]
    line_count = len(lines)
    if line_count == 0:
        return 0

    # 제어문 수
    control_count = len(_CONTROL_KEYWORDS.findall(body_text))

    # 최대 begin...end 중첩 깊이 계산
    max_depth = 0
    depth = 0
    for token in re.findall(r"\bbegin\b|\bend\b", body_text, re.IGNORECASE):
        if token.lower() == "begin":
            depth += 1
            max_depth = max(max_depth, depth)
        else:
            depth = max(0, depth - 1)

    # 점수 구성요소 (각 30/40/30 비중)
    # 줄 수: 0~200줄 → 0~30
    line_score = min(line_count / 200.0, 1.0) * 30

    # 제어문 밀도: 줄 수 대비, 0.5 이상이면 최고
    density = control_count / max(line_count, 1)
    control_score = min(density / 0.5, 1.0) * 40

    # 중첩 깊이: 0~6단계 → 0~30
    depth_score = min(max_depth / 6.0, 1.0) * 30

    raw = line_score + control_score + depth_score
    return round(min(raw, 100))


def enrich_methods_with_complexity(methods: list[MethodDetail]) -> None:
    """MethodDetail 리스트에 complexity_score를 일괄 계산·주입한다 (in-place)."""
    for m in methods:
        # body_text가 없으면 0 유지
        m.complexity_score = calculate_complexity(getattr(m, "body_text", "") or "")


def enrich_raw_methods_with_complexity(methods: list[Method]) -> None:
    """파서 단계 Method 리스트에 complexity_score를 계산·주입한다 (in-place)."""
    for m in methods:
        m.complexity_score = calculate_complexity(m.body_text or "")
