unit Utils;

interface

uses
  SysUtils;

procedure LogMessage(const AMsg: string);
function FormatOutput(const AData: string): string;
// Standalone function - never called (dead code)
function CalculateChecksum(const AInput: string): Integer;

implementation

procedure LogMessage(const AMsg: string);
begin
  WriteLn('[LOG] ' + DateTimeToStr(Now) + ': ' + AMsg);
end;

function FormatOutput(const AData: string): string;
begin
  if AData = '' then
    Result := '(empty)'
  else
    Result := '=== Output ===' + sLineBreak + AData;
end;

{ This function is dead code - never called from anywhere }
function CalculateChecksum(const AInput: string): Integer;
var
  I: Integer;
begin
  Result := 0;
  for I := 1 to Length(AInput) do
    Result := Result + Ord(AInput[I]);
end;

(* Multi-line comment style:
   This is a utility unit providing shared helper functions.
   Used by MainUnit and potentially others. *)

end.
