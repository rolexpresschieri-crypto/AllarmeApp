@echo off
REM Risolve "Unable to delete directory" in node_modules\@react-native\gradle-plugin
REM Chiudi prima: Metro (Ctrl+C), Cursor/Android Studio

cd /d "%~dp0"

echo Arresto Gradle Daemon...
cd android
call gradlew.bat --stop 2>nul
cd ..

echo Rimozione cache build in node_modules\@react-native\gradle-plugin...
rmdir /s /q "node_modules\@react-native\gradle-plugin\shared\build" 2>nul
if exist "node_modules\@react-native\gradle-plugin\shared\build" (
    echo.
    echo ERRORE: Cartella ancora bloccata.
    echo - Chiudi Cursor e qualsiasi terminale aperto sul progetto
    echo - Riavvia il PC
    echo - Poi riesegui questo script
    pause
    exit /b 1
)

echo OK. Pulisci completata.
echo.
echo Ora: npm start (in un terminale), npm run android (in un altro)
pause
