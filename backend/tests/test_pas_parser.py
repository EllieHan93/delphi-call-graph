"""Tests for the .pas parser."""

from pathlib import Path

from backend.analyzer.models import MethodType
from backend.parser.pas_parser import parse_pas, parse_pas_content, parse_uses


class TestParseUses:
    def test_simple_uses(self):
        text = "uses SysUtils, Classes, Forms;"
        result = parse_uses(text)
        assert result == ["SysUtils", "Classes", "Forms"]

    def test_no_uses(self):
        assert parse_uses("type TFoo = class end;") == []

    def test_multiline_uses(self):
        text = "uses\n  SysUtils,\n  Classes;\n"
        result = parse_uses(text)
        assert "SysUtils" in result
        assert "Classes" in result


class TestParsePasContent:
    def test_unit_name(self, sample_pas_content: str):
        result = parse_pas_content(sample_pas_content)
        assert result.name == "MainUnit"

    def test_uses_interface(self, sample_pas_content: str):
        result = parse_pas_content(sample_pas_content)
        assert "SysUtils" in result.uses
        assert "Classes" in result.uses
        assert "DataModule" in result.uses

    def test_uses_implementation(self, sample_pas_content: str):
        result = parse_pas_content(sample_pas_content)
        assert "Utils" in result.uses

    def test_method_count(self, sample_pas_content: str):
        result = parse_pas_content(sample_pas_content)
        assert len(result.methods) == 3  # FormCreate, btnAnalyzeClick, GetStatus

    def test_method_types(self, sample_pas_content: str):
        result = parse_pas_content(sample_pas_content)
        types = {m.method_name: m.method_type for m in result.methods}
        assert types["FormCreate"] == MethodType.PROCEDURE
        assert types["btnAnalyzeClick"] == MethodType.PROCEDURE
        assert types["GetStatus"] == MethodType.FUNCTION

    def test_class_name(self, sample_pas_content: str):
        result = parse_pas_content(sample_pas_content)
        for m in result.methods:
            assert m.class_name == "TMainForm"

    def test_method_id_format(self, sample_pas_content: str):
        result = parse_pas_content(sample_pas_content)
        ids = [m.id for m in result.methods]
        assert "MainUnit.TMainForm.FormCreate" in ids
        assert "MainUnit.TMainForm.GetStatus" in ids

    def test_body_extracted(self, sample_pas_content: str):
        result = parse_pas_content(sample_pas_content)
        form_create = next(m for m in result.methods if m.method_name == "FormCreate")
        assert "Initialize" in form_create.body_text
        assert "LogMessage" in form_create.body_text

    def test_line_numbers(self, sample_pas_content: str):
        result = parse_pas_content(sample_pas_content)
        for m in result.methods:
            assert m.line_number >= 1

    def test_standalone_procedure(self):
        src = (
            "unit MyUtils;\n"
            "interface\n"
            "procedure DoStuff;\n"
            "implementation\n"
            "procedure DoStuff;\n"
            "begin\n"
            "  WriteLn('hi');\n"
            "end;\n"
            "end.\n"
        )
        result = parse_pas_content(src)
        assert len(result.methods) == 1
        m = result.methods[0]
        assert m.class_name is None
        assert m.method_name == "DoStuff"
        assert m.id == "MyUtils.DoStuff"

    def test_constructor_destructor(self):
        src = (
            "unit CdUnit;\n"
            "interface\n"
            "type TFoo = class\n"
            "  constructor Create;\n"
            "  destructor Destroy; override;\n"
            "end;\n"
            "implementation\n"
            "constructor TFoo.Create;\n"
            "begin\n"
            "  inherited;\n"
            "end;\n"
            "destructor TFoo.Destroy;\n"
            "begin\n"
            "  inherited;\n"
            "end;\n"
            "end.\n"
        )
        result = parse_pas_content(src)
        types = {m.method_name: m.method_type for m in result.methods}
        assert types["Create"] == MethodType.CONSTRUCTOR
        assert types["Destroy"] == MethodType.DESTRUCTOR

    def test_nested_begin_end(self):
        src = (
            "unit Nested;\n"
            "interface\n"
            "implementation\n"
            "procedure TFoo.Bar;\n"
            "begin\n"
            "  if True then\n"
            "  begin\n"
            "    DoSomething;\n"
            "  end;\n"
            "end;\n"
            "end.\n"
        )
        result = parse_pas_content(src)
        assert len(result.methods) == 1
        assert "DoSomething" in result.methods[0].body_text

    def test_comments_not_parsed_as_methods(self):
        src = (
            "unit CommentUnit;\n"
            "interface\n"
            "implementation\n"
            "// procedure TFoo.FakeMethod;\n"
            "procedure TFoo.RealMethod;\n"
            "begin\n"
            "end;\n"
            "end.\n"
        )
        result = parse_pas_content(src)
        assert len(result.methods) == 1
        assert result.methods[0].method_name == "RealMethod"


class TestParsePasFile:
    def test_parse_main_unit(self, samples_dir: Path):
        unit = parse_pas(samples_dir / "src" / "MainUnit.pas")
        assert unit.name == "MainUnit"
        assert len(unit.methods) == 3

    def test_parse_data_module(self, samples_dir: Path):
        unit = parse_pas(samples_dir / "src" / "DataModule.pas")
        assert unit.name == "DataModule"
        method_names = [m.method_name for m in unit.methods]
        assert "Create" in method_names
        assert "Destroy" in method_names
        assert "Initialize" in method_names
        assert "QueryAll" in method_names
        assert "AddItem" in method_names
        assert "DeprecatedCleanup" in method_names

    def test_parse_utils(self, samples_dir: Path):
        unit = parse_pas(samples_dir / "src" / "Utils.pas")
        assert unit.name == "Utils"
        method_names = [m.method_name for m in unit.methods]
        assert "LogMessage" in method_names
        assert "FormatOutput" in method_names
        assert "CalculateChecksum" in method_names

    def test_file_not_found(self, tmp_path: Path):
        import pytest

        with pytest.raises(FileNotFoundError):
            parse_pas(tmp_path / "nonexistent.pas")
