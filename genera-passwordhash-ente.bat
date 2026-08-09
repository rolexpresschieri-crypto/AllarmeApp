@echo off
setlocal EnableExtensions

title Generatore passwordHash ente (SHA-256)
echo ===============================================
echo   Generatore passwordHash ente (SHA-256)
echo ===============================================
echo.
echo Regole password ente:
echo - esattamente 6 caratteri
echo - solo lettere e cifre (A-Z, a-z, 0-9)
echo.

set /p PASS=Inserisci password (6 caratteri alfanumerici): 

if "%PASS%"=="" (
  echo.
  echo Errore: password vuota.
  goto :end_error
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = '%PASS%';" ^
  "if ($p -notmatch '^[A-Za-z0-9]{6}$') { Write-Host ''; Write-Host 'Errore: la password deve essere di 6 caratteri alfanumerici.'; exit 1 }" ^
  "$bytes = [System.Text.Encoding]::UTF8.GetBytes($p);" ^
  "$sha = [System.Security.Cryptography.SHA256]::Create();" ^
  "$hash = $sha.ComputeHash($bytes);" ^
  "$hex = ($hash | ForEach-Object { $_.ToString('x2') }) -join '';" ^
  "Write-Host '';" ^
  "Write-Host ('Password:      ' + $p);" ^
  "Write-Host ('passwordHash:  ' + $hex);" ^
  "Write-Host '';"

if errorlevel 1 (
  goto :end_error
)

echo Copia il valore "passwordHash" nel foglio Google Sheet (colonna passwordHash).
echo.
pause
exit /b 0

:end_error
echo.
pause
exit /b 1
