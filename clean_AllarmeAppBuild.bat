@echo off
setlocal

echo [AllarmeApp] Pulizia in corso...

set "ROOT=C:\Users\rronc\AllarmeApp"

call :deleteDir "%ROOT%\android\app\build"
call :deleteDir "%ROOT%\android\.gradle"
call :deleteDir "%ROOT%\node_modules\.cache"

echo [AllarmeApp] Fine.
pause
exit /b

:deleteDir
set "TARGET=%~1"
if not exist "%TARGET%" (
  echo [SKIP] Non trovata: %TARGET%
  goto :eof
)

rmdir /s /q "%TARGET%" 2>nul
if exist "%TARGET%" (
  echo [WARN] Cartella bloccata: %TARGET%
  echo [INFO] Provo a chiudere processi comuni...
  taskkill /F /IM java.exe >nul 2>nul
  taskkill /F /IM adb.exe >nul 2>nul
  taskkill /F /IM node.exe >nul 2>nul
  taskkill /F /IM gradle.exe >nul 2>nul
  timeout /t 2 >nul
  rmdir /s /q "%TARGET%" 2>nul
)

if exist "%TARGET%" (
  echo [KO] Impossibile eliminare: %TARGET%
) else (
  echo [OK] Eliminata: %TARGET%
)
goto :eof
