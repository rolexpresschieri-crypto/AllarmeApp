@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Pulizia build release (Allarme App)
echo ============================================
echo.

echo Arresto Gradle...
cd android
call gradlew.bat --stop 2>nul
cd ..

taskkill /F /IM java.exe >nul 2>nul
ping localhost -n 3 >nul

echo Rimozione cache Android / CMake / autolinking...
call :deleteDir "android\.cxx-staging"
call :deleteDir "android\app\.cxx"
call :deleteDir "android\app-build-output"
call :deleteDir "android\.gradle"
call :deleteDir "android\build"

echo Rimozione cache native nei node_modules...
call :deleteDir "node_modules\react-native-screens\android\build"
call :deleteDir "node_modules\react-native-safe-area-context\android\build"
call :deleteDir "node_modules\@react-native-async-storage\async-storage\android\build"
call :deleteDir "node_modules\@notifee\react-native\android\build"
call :deleteDir "node_modules\@react-native-firebase\app\android\build"
call :deleteDir "node_modules\@react-native-firebase\messaging\android\build"
call :deleteDir "node_modules\react-native-webview\android\build"

echo.
echo Pulizia completata. Ora puoi lanciare build-apk.bat
exit /b 0

:deleteDir
set "TARGET=%~1"
if not exist "%TARGET%" (
  echo [SKIP] %TARGET%
  goto :eof
)
rmdir /s /q "%TARGET%" 2>nul
if exist "%TARGET%" (
  echo [WARN] Bloccata: %TARGET%
) else (
  echo [OK]   %TARGET%
)
goto :eof
