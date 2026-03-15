program SampleApp;

uses
  Forms,
  MainUnit in 'src\MainUnit.pas',
  DataModule in 'src\DataModule.pas',
  Utils in 'src\Utils.pas';

{$R *.res}

begin
  Application.Initialize;
  Application.CreateForm(TMainForm, MainForm);
  Application.Run;
end.
