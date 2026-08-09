@echo off
chcp 65001 >nul
echo ============================================
echo   PULIZIA + PRIMA BUILD (esegui dopo riavvio)
echo ============================================
echo.

cd /d "%~dp0"

echo [1/4] Arresto Gradle...
cd android
call gradlew.bat --stop 2>nul
cd ..
echo.

echo [2/4] Rimozione cartelle di build...
rmdir /s /q "android\.gradle" 2>nul
rmdir /s /q "node_modules\@react-native\gradle-plugin\shared\build" 2>nul
rmdir /s /q "node_modules\@react-native\gradle-plugin\settings-plugin\build" 2>nul
rmdir /s /q "%USERPROFILE%\.gradle\AllarmeApp-plugin-build" 2>nul
rmdir /s /q "android\app\build" 2>nul
rmdir /s /q "android\build" 2>nul
rmdir /s /q "%USERPROFILE%\.gradle\AllarmeApp-cache" 2>nul
echo      Fatto.
echo.

echo [3/4] Avvio build Android (la prima volta sara lenta, senza daemon)...
echo.
call npm run android
set BUILD_EXIT=%ERRORLEVEL%
echo.
if %BUILD_EXIT% neq 0 (
    echo BUILD FALLITA. Controlla SETUP-ANDROID.md - se continua, usa WSL2.
    pause
    exit /b %BUILD_EXIT%
)

echo [4/4] Build completata.
echo.
echo Per le prossime volte: npm start + npm run android (in due terminali)
pause
