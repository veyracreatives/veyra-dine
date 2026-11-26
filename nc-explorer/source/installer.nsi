Unicode true
!include "MUI2.nsh"
Name "Veyra NC Explorer"
OutFile "build\VeyraNCExplorer-Setup-1.2.0.exe"
InstallDir "$PROGRAMFILES64\Veyra NC Explorer"
RequestExecutionLevel admin
!define MUI_ICON "app.ico"
!define MUI_UNICON "app.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\NCExplorer.exe"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
VIProductVersion "1.2.0.0"
VIAddVersionKey "ProductName" "Veyra NC Explorer"
VIAddVersionKey "FileVersion" "1.2.0"
VIAddVersionKey "CompanyName" "Veyra Creatives"
VIAddVersionKey "FileDescription" "Veyra NC Explorer Setup"
Section "Install"
  SetOutPath "$INSTDIR"
  nsExec::Exec 'taskkill /IM NCExplorer.exe /F'
  Sleep 800
  File "build\NCExplorer.exe"
  File "app.ico"
  File "README.txt"
  CreateDirectory "$SMPROGRAMS\Veyra NC Explorer"
  CreateShortcut "$SMPROGRAMS\Veyra NC Explorer\Veyra NC Explorer.lnk" "$INSTDIR\NCExplorer.exe" "" "$INSTDIR\app.ico"
  CreateShortcut "$DESKTOP\NC Explorer (Veyra).lnk" "$INSTDIR\NCExplorer.exe" "" "$INSTDIR\app.ico"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VeyraNCExplorer" "DisplayName" "Veyra NC Explorer"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VeyraNCExplorer" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VeyraNCExplorer" "DisplayIcon" "$INSTDIR\app.ico"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VeyraNCExplorer" "DisplayVersion" "1.2.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VeyraNCExplorer" "Publisher" "Veyra Creatives"
SectionEnd
Section "Uninstall"
  Delete "$INSTDIR\NCExplorer.exe"
  Delete "$INSTDIR\app.ico"
  Delete "$INSTDIR\README.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\Veyra NC Explorer\Veyra NC Explorer.lnk"
  RMDir "$SMPROGRAMS\Veyra NC Explorer"
  Delete "$DESKTOP\NC Explorer (Veyra).lnk"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VeyraNCExplorer"
SectionEnd
