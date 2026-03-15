"""Pydantic data models for Delphi static call graph analysis."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class MethodType(StrEnum):
    PROCEDURE = "procedure"
    FUNCTION = "function"
    CONSTRUCTOR = "constructor"
    DESTRUCTOR = "destructor"


class MethodRef(BaseModel):
    """Lightweight reference to a method (used in callers/callees lists)."""

    id: str
    unit_name: str
    class_name: str | None = None
    method_name: str


class Method(BaseModel):
    """A parsed Delphi method with optional call graph info."""

    id: str = Field(description="Unique key: UnitName.ClassName.MethodName")
    unit_name: str
    class_name: str | None = None
    method_name: str
    method_type: MethodType
    signature: str = Field(description="Full declaration signature")
    line_number: int = Field(ge=1)
    body_text: str = ""

    # Call graph fields (populated during analysis phase, Sprint 2)
    callers: list[MethodRef] = Field(default_factory=list)
    callees: list[MethodRef] = Field(default_factory=list)
    call_count: int = Field(default=0, ge=0)
    is_used: bool = False


class Unit(BaseModel):
    """A parsed Delphi .pas unit."""

    name: str
    file_path: str
    uses: list[str] = Field(default_factory=list)
    methods: list[Method] = Field(default_factory=list)


class Project(BaseModel):
    """Root model for a parsed Delphi project."""

    name: str
    dpr_path: str
    units: list[Unit] = Field(default_factory=list)


class AnalysisSummary(BaseModel):
    """Aggregate statistics for a project analysis."""

    total_units: int
    total_methods: int
    used_count: int
    unused_count: int
    unused_ratio: float = Field(ge=0.0, le=1.0)


class MethodDetail(BaseModel):
    """Full method info including call graph edges — returned in analysis result."""

    id: str
    unit_name: str
    class_name: str | None = None
    method_name: str
    method_type: MethodType
    signature: str
    line_number: int
    callers: list[MethodRef] = Field(default_factory=list)
    callees: list[MethodRef] = Field(default_factory=list)
    call_count: int = 0
    is_used: bool = False


class AnalysisResult(BaseModel):
    """Top-level result returned by the call graph analysis engine."""

    project_name: str
    summary: AnalysisSummary
    methods: list[MethodDetail] = Field(default_factory=list)
