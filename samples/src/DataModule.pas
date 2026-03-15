unit DataModule;

interface

uses
  SysUtils, Classes;

type
  TDataModule = class(TComponent)
  private
    FItems: TStringList;
  public
    constructor Create(AOwner: TComponent); override;
    destructor Destroy; override;
    procedure Initialize;
    function QueryAll: string;
    procedure AddItem(const AName: string);
    // This method is intentionally never called (dead code)
    procedure DeprecatedCleanup;
  end;

implementation

{ TDataModule }

constructor TDataModule.Create(AOwner: TComponent);
begin
  inherited Create(AOwner);
  FItems := TStringList.Create;
end;

destructor TDataModule.Destroy;
begin
  FItems.Free;
  inherited Destroy;
end;

procedure TDataModule.Initialize;
begin
  FItems.Clear;
  AddItem('Default');
end;

function TDataModule.QueryAll: string;
var
  I: Integer;
begin
  Result := '';
  for I := 0 to FItems.Count - 1 do
  begin
    if Result <> '' then
      Result := Result + ', ';
    Result := Result + FItems[I];
  end;
end;

procedure TDataModule.AddItem(const AName: string);
begin
  if AName <> '' then
    FItems.Add(AName);
end;

// Dead code: never called anywhere
procedure TDataModule.DeprecatedCleanup;
begin
  FItems.Clear;
  // Old cleanup logic, replaced by Destroy
end;

end.
