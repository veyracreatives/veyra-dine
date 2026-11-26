Build (Linux, Mono + NSIS):
  mkdir -p build && mcs -target:winexe -sdk:4.5 -langversion:7 -optimize+ -platform:anycpu -win32icon:app.ico -out:build/NCExplorer.exe -r:System.Windows.Forms.dll -r:System.Drawing.dll -r:System.Security.dll -r:System.Core.dll src/*.cs
  makensis installer.nsi
Runs on Windows 10/11 (.NET Framework 4.5+ built in). Talks to the M80 by FTP (port 21) only on Connect.
