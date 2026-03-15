"""Tests for the .dpr parser."""

from pathlib import Path

from backend.parser.dpr_parser import parse_dpr, parse_dpr_content


class TestParseDprContent:
    def test_project_name(self, sample_dpr_content: str):
        result = parse_dpr_content(sample_dpr_content)
        assert result.project_name == "SampleApp"

    def test_unit_count(self, sample_dpr_content: str):
        result = parse_dpr_content(sample_dpr_content)
        # Forms (no path), MainUnit, DataModule, Utils
        assert len(result.units) == 4

    def test_unit_names(self, sample_dpr_content: str):
        result = parse_dpr_content(sample_dpr_content)
        names = [u.name for u in result.units]
        assert "Forms" in names
        assert "MainUnit" in names
        assert "DataModule" in names
        assert "Utils" in names

    def test_unit_with_path(self, sample_dpr_content: str):
        result = parse_dpr_content(sample_dpr_content)
        main_unit = next(u for u in result.units if u.name == "MainUnit")
        assert main_unit.relative_path == "src\\MainUnit.pas"

    def test_unit_without_path(self, sample_dpr_content: str):
        result = parse_dpr_content(sample_dpr_content)
        forms = next(u for u in result.units if u.name == "Forms")
        assert forms.relative_path is None
        assert forms.absolute_path is None

    def test_path_resolution(self, sample_dpr_content: str, tmp_path: Path):
        dpr_file = tmp_path / "Test.dpr"
        dpr_file.write_text(sample_dpr_content)
        result = parse_dpr_content(sample_dpr_content, dpr_file)
        main_unit = next(u for u in result.units if u.name == "MainUnit")
        assert main_unit.absolute_path is not None
        assert "MainUnit.pas" in main_unit.absolute_path

    def test_no_program_raises(self):
        import pytest

        with pytest.raises(ValueError, match="program"):
            parse_dpr_content("uses SysUtils;")

    def test_empty_uses(self):
        src = "program Empty;\nbegin\nend."
        result = parse_dpr_content(src)
        assert result.project_name == "Empty"
        assert len(result.units) == 0

    def test_comments_in_uses(self):
        src = (
            "program Test;\n"
            "uses\n"
            "  // UnitA comment\n"
            "  UnitA in 'UnitA.pas',\n"
            "  {UnitB comment} UnitB;\n"
        )
        result = parse_dpr_content(src)
        names = [u.name for u in result.units]
        assert "UnitA" in names
        assert "UnitB" in names


class TestParseDprFile:
    def test_parse_sample_file(self, sample_dpr_path: Path):
        result = parse_dpr(sample_dpr_path)
        assert result.project_name == "SampleApp"
        assert len(result.units) == 4

    def test_file_not_found(self, tmp_path: Path):
        import pytest

        with pytest.raises(FileNotFoundError):
            parse_dpr(tmp_path / "nonexistent.dpr")
