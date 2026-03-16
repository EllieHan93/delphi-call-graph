"""FastAPI route definitions for the Delphi Call Graph Analyzer API.

All responses use camelCase field names via alias_generator.
Prefix: /api
"""

from __future__ import annotations

from collections import deque
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from backend.analyzer.models import MethodType
from backend.api.state import get_state, run_analysis

router = APIRouter(prefix="/api", tags=["analysis"])

# ---------------------------------------------------------------------------
# Response models (camelCase)
# ---------------------------------------------------------------------------


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SummaryResponse(_CamelModel):
    project_name: str
    total_units: int
    total_methods: int
    used_count: int
    unused_count: int
    unused_ratio: float = Field(description="미사용 비율 (0~100 퍼센트)")
    cycle_count: int = 0


class MethodItem(_CamelModel):
    id: str
    unit_name: str
    class_name: str | None = None
    method_name: str
    method_type: MethodType
    signature: str
    line_number: int
    call_count: int
    is_used: bool
    complexity_score: int = 0


class MethodListResponse(_CamelModel):
    total: int
    page: int
    page_size: int
    items: list[MethodItem]


class MethodRefItem(_CamelModel):
    id: str
    unit_name: str
    class_name: str | None = None
    method_name: str


class MethodDetailResponse(_CamelModel):
    id: str
    unit_name: str
    class_name: str | None = None
    method_name: str
    method_type: MethodType
    signature: str
    line_number: int
    call_count: int
    is_used: bool
    callers: list[MethodRefItem]
    callees: list[MethodRefItem]
    body_text: str
    complexity_score: int = 0


class GraphNode(_CamelModel):
    id: str
    unit_name: str
    class_name: str | None = None
    method_name: str
    is_used: bool
    is_root: bool = False


class GraphEdge(_CamelModel):
    source: str
    target: str


class CallGraphResponse(_CamelModel):
    root_id: str
    depth: int
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class UnitStats(_CamelModel):
    unit_name: str
    total_methods: int
    used_methods: int
    unused_methods: int
    usage_rate: float = Field(description="사용 비율 (0~100 퍼센트)")


class UnitStatsResponse(_CamelModel):
    total: int
    units: list[UnitStats]


class CyclesResponse(_CamelModel):
    count: int
    cycles: list[list[str]]


class ComplexityMethodItem(_CamelModel):
    id: str
    method_name: str
    complexity_score: int
    is_used: bool
    line_number: int


class ComplexityUnit(_CamelModel):
    unit_name: str
    avg_complexity: float
    methods: list[ComplexityMethodItem]


class ComplexityResponse(_CamelModel):
    units: list[ComplexityUnit]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


class AnalyzeRequest(_CamelModel):
    dpr_path: str = Field(description="분석할 .dpr 파일의 절대 경로")


@router.post("/analyze", response_model=SummaryResponse)
def analyze(body: AnalyzeRequest) -> SummaryResponse:
    """DPR 프로젝트 분석을 실행하고 요약 정보를 반환합니다."""
    try:
        result = run_analysis(body.dpr_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    s = result.summary
    return SummaryResponse(
        project_name=result.project_name,
        total_units=s.total_units,
        total_methods=s.total_methods,
        used_count=s.used_count,
        unused_count=s.unused_count,
        unused_ratio=round(s.unused_ratio * 100, 2),
        cycle_count=s.cycle_count,
    )


@router.get("/summary", response_model=SummaryResponse)
def get_summary() -> SummaryResponse:
    """마지막 분석 결과의 요약 정보를 반환합니다."""
    state = get_state()
    if state.result is None:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다. 먼저 /api/analyze를 호출하세요.")

    result = state.result
    s = result.summary
    return SummaryResponse(
        project_name=result.project_name,
        total_units=s.total_units,
        total_methods=s.total_methods,
        used_count=s.used_count,
        unused_count=s.unused_count,
        unused_ratio=round(s.unused_ratio * 100, 2),
        cycle_count=s.cycle_count,
    )


@router.get("/methods", response_model=MethodListResponse)
def list_methods(
    unit: str | None = Query(default=None, description="유닛 이름 필터"),
    status: Literal["used", "unused"] | None = Query(default=None, description="used / unused 필터"),
    search: str | None = Query(default=None, description="메소드 이름 부분 문자열 검색"),
    sort_by: Literal["method_name", "unit_name", "call_count", "line_number"] = Query(
        default="method_name", alias="sortBy"
    ),
    sort_dir: Literal["asc", "desc"] = Query(default="asc", alias="sortDir"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200, alias="pageSize"),
) -> MethodListResponse:
    """메소드 목록을 필터/정렬/페이지네이션하여 반환합니다."""
    state = get_state()
    if state.result is None:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다. 먼저 /api/analyze를 호출하세요.")

    methods = list(state.result.methods)

    # Filters
    if unit is not None:
        methods = [m for m in methods if m.unit_name.lower() == unit.lower()]
    if status == "used":
        methods = [m for m in methods if m.is_used]
    elif status == "unused":
        methods = [m for m in methods if not m.is_used]
    if search is not None:
        search_lower = search.lower()
        methods = [m for m in methods if search_lower in m.method_name.lower()]

    # Sort
    reverse = sort_dir == "desc"
    methods.sort(key=lambda m: getattr(m, sort_by), reverse=reverse)

    # Pagination
    total = len(methods)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = methods[start:end]

    items = [
        MethodItem(
            id=m.id,
            unit_name=m.unit_name,
            class_name=m.class_name,
            method_name=m.method_name,
            method_type=m.method_type,
            signature=m.signature,
            line_number=m.line_number,
            call_count=m.call_count,
            is_used=m.is_used,
            complexity_score=m.complexity_score,
        )
        for m in page_items
    ]
    return MethodListResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/methods/{method_id:path}", response_model=MethodDetailResponse)
def get_method(method_id: str) -> MethodDetailResponse:
    """특정 메소드의 상세 정보와 body_text를 반환합니다."""
    state = get_state()
    if state.result is None:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다. 먼저 /api/analyze를 호출하세요.")

    method = next((m for m in state.result.methods if m.id == method_id), None)
    if method is None:
        raise HTTPException(status_code=404, detail=f"메소드를 찾을 수 없습니다: {method_id}")

    body_text = state.method_body_index.get(method_id, "")
    return MethodDetailResponse(
        id=method.id,
        unit_name=method.unit_name,
        class_name=method.class_name,
        method_name=method.method_name,
        method_type=method.method_type,
        signature=method.signature,
        line_number=method.line_number,
        call_count=method.call_count,
        is_used=method.is_used,
        callers=[
            MethodRefItem(id=r.id, unit_name=r.unit_name, class_name=r.class_name, method_name=r.method_name)
            for r in method.callers
        ],
        callees=[
            MethodRefItem(id=r.id, unit_name=r.unit_name, class_name=r.class_name, method_name=r.method_name)
            for r in method.callees
        ],
        body_text=body_text,
        complexity_score=method.complexity_score,
    )


@router.get("/callgraph/{method_id:path}", response_model=CallGraphResponse)
def get_callgraph(
    method_id: str,
    depth: int = Query(default=2, ge=1, le=10, description="BFS 탐색 깊이"),
) -> CallGraphResponse:
    """특정 메소드를 중심으로 BFS로 콜 그래프를 탐색하여 반환합니다."""
    state = get_state()
    if state.result is None:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다. 먼저 /api/analyze를 호출하세요.")

    # Build method lookup
    method_map = {m.id: m for m in state.result.methods}
    if method_id not in method_map:
        raise HTTPException(status_code=404, detail=f"메소드를 찾을 수 없습니다: {method_id}")

    visited_ids: set[str] = set()
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []

    # BFS: explore both callers and callees up to depth
    # Queue entries: (method_id, current_depth)
    queue: deque[tuple[str, int]] = deque([(method_id, 0)])
    visited_ids.add(method_id)

    while queue:
        current_id, current_depth = queue.popleft()
        current = method_map.get(current_id)
        if current is None:
            continue

        nodes.append(
            GraphNode(
                id=current.id,
                unit_name=current.unit_name,
                class_name=current.class_name,
                method_name=current.method_name,
                is_used=current.is_used,
                is_root=(current_id == method_id),
            )
        )

        if current_depth >= depth:
            continue

        # Expand callers
        for ref in current.callers:
            if ref.id == "__entrypoint__":
                continue
            edge = GraphEdge(source=ref.id, target=current_id)
            if edge not in edges:
                edges.append(edge)
            if ref.id not in visited_ids and ref.id in method_map:
                visited_ids.add(ref.id)
                queue.append((ref.id, current_depth + 1))

        # Expand callees
        for ref in current.callees:
            edge = GraphEdge(source=current_id, target=ref.id)
            if edge not in edges:
                edges.append(edge)
            if ref.id not in visited_ids and ref.id in method_map:
                visited_ids.add(ref.id)
                queue.append((ref.id, current_depth + 1))

    return CallGraphResponse(root_id=method_id, depth=depth, nodes=nodes, edges=edges)


@router.get("/units", response_model=UnitStatsResponse)
def list_units() -> UnitStatsResponse:
    """유닛별 메소드 통계를 반환합니다."""
    state = get_state()
    if state.result is None:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다. 먼저 /api/analyze를 호출하세요.")

    # Aggregate by unit
    unit_map: dict[str, list] = {}
    for method in state.result.methods:
        unit_map.setdefault(method.unit_name, []).append(method)

    unit_stats: list[UnitStats] = []
    for unit_name, methods in sorted(unit_map.items()):
        total = len(methods)
        used = sum(1 for m in methods if m.is_used)
        unused = total - used
        usage_rate = round(used / total * 100, 2) if total > 0 else 0.0
        unit_stats.append(
            UnitStats(
                unit_name=unit_name,
                total_methods=total,
                used_methods=used,
                unused_methods=unused,
                usage_rate=usage_rate,
            )
        )

    return UnitStatsResponse(total=len(unit_stats), units=unit_stats)


@router.get("/cycles", response_model=CyclesResponse)
def get_cycles() -> CyclesResponse:
    """탐지된 순환 참조 목록을 반환합니다."""
    state = get_state()
    if state.result is None:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다. 먼저 /api/analyze를 호출하세요.")

    cycles = state.result.cycles
    return CyclesResponse(count=len(cycles), cycles=cycles)


@router.get("/complexity", response_model=ComplexityResponse)
def get_complexity() -> ComplexityResponse:
    """유닛별 복잡도 집계 데이터를 반환합니다 (트리맵용)."""
    state = get_state()
    if state.result is None:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다. 먼저 /api/analyze를 호출하세요.")

    unit_map: dict[str, list] = {}
    for method in state.result.methods:
        unit_map.setdefault(method.unit_name, []).append(method)

    units: list[ComplexityUnit] = []
    for unit_name, methods in sorted(unit_map.items()):
        items = [
            ComplexityMethodItem(
                id=m.id,
                method_name=m.method_name,
                complexity_score=m.complexity_score,
                is_used=m.is_used,
                line_number=m.line_number,
            )
            for m in methods
        ]
        avg = round(sum(m.complexity_score for m in methods) / len(methods), 1) if methods else 0.0
        units.append(ComplexityUnit(unit_name=unit_name, avg_complexity=avg, methods=items))

    return ComplexityResponse(units=units)
