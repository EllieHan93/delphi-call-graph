unit MainUnit;

interface

uses
  SysUtils, Classes, DataModule;

type
  TMainForm = class(TForm)
    procedure FormCreate(Sender: TObject);
    procedure btnAnalyzeClick(Sender: TObject);
  private
    FData: TDataModule;
  public
    function GetStatus: string;
  end;

var
  MainForm: TMainForm;

implementation

uses
  Utils;

{$R *.dfm}

{ TMainForm }

procedure TMainForm.FormCreate(Sender: TObject);
begin
  FData := TDataModule.Create(Self);
  FData.Initialize;
  LogMessage('Form created');
end;

procedure TMainForm.btnAnalyzeClick(Sender: TObject);
var
  StatusStr: string;
begin
  StatusStr := GetStatus;
  if StatusStr <> '' then
    ShowMessage(StatusStr);
end;

function TMainForm.GetStatus: string;
begin
  Result := FormatOutput(FData.QueryAll);
end;

end.
