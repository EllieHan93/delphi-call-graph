"""Shared pytest fixtures for backend tests."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.state import reset_state
from backend.main import app

SAMPLES_DIR = Path(__file__).resolve().parent.parent.parent / "samples"


@pytest.fixture
def client() -> TestClient:
    """Return a TestClient for the FastAPI app, with state reset after each test."""
    reset_state()
    with TestClient(app) as c:
        yield c
    reset_state()


@pytest.fixture
def samples_dir() -> Path:
    """Return the absolute path to the samples/ directory."""
    return SAMPLES_DIR


@pytest.fixture
def sample_dpr_path(samples_dir: Path) -> Path:
    """Return the path to the sample .dpr file."""
    return samples_dir / "SampleApp.dpr"


@pytest.fixture
def sample_dpr_content() -> str:
    """Return raw content of a typical .dpr file."""
    return (
        "program SampleApp;\n"
        "\n"
        "uses\n"
        "  Forms,\n"
        "  MainUnit in 'src\\MainUnit.pas',\n"
        "  DataModule in 'src\\DataModule.pas',\n"
        "  Utils in 'src\\Utils.pas';\n"
        "\n"
        "{$R *.res}\n"
        "\n"
        "begin\n"
        "  Application.Initialize;\n"
        "  Application.CreateForm(TMainForm, MainForm);\n"
        "  Application.Run;\n"
        "end.\n"
    )


@pytest.fixture
def sample_pas_content() -> str:
    """Return raw content of a typical .pas file with various method types."""
    return (
        "unit MainUnit;\n"
        "\n"
        "interface\n"
        "\n"
        "uses\n"
        "  SysUtils, Classes, DataModule;\n"
        "\n"
        "type\n"
        "  TMainForm = class(TForm)\n"
        "    procedure FormCreate(Sender: TObject);\n"
        "    procedure btnAnalyzeClick(Sender: TObject);\n"
        "  private\n"
        "    FData: TDataModule;\n"
        "  public\n"
        "    function GetStatus: string;\n"
        "  end;\n"
        "\n"
        "implementation\n"
        "\n"
        "uses\n"
        "  Utils;\n"
        "\n"
        "{ TMainForm }\n"
        "\n"
        "procedure TMainForm.FormCreate(Sender: TObject);\n"
        "begin\n"
        "  FData := TDataModule.Create(Self);\n"
        "  FData.Initialize;\n"
        "  LogMessage('Form created');\n"
        "end;\n"
        "\n"
        "procedure TMainForm.btnAnalyzeClick(Sender: TObject);\n"
        "var\n"
        "  Result: string;\n"
        "begin\n"
        "  Result := GetStatus;\n"
        "  if Result <> '' then\n"
        "    ShowMessage(Result);\n"
        "end;\n"
        "\n"
        "function TMainForm.GetStatus: string;\n"
        "begin\n"
        "  Result := FormatOutput(FData.QueryAll);\n"
        "end;\n"
        "\n"
        "end.\n"
    )
