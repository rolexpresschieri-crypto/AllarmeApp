@echo off
REM Esegui dalla cartella del progetto (AllarmeApp)
REM Chiudi prima Metro e Android Studio

cd /d "%~dp0"
cd android
call gradlew.bat --stop 2>nul
cd ..

echo Rimozione android\.gradle ...
rmdir /s /q android\.gradle 2>nul
if exist android\.gradle (
    echo ERRORE: android\.gradle ancora presente. Chiudi tutto e riprova come Amministratore.
    pause
    exit /b 1
)
echo OK. Cache Gradle rimossa. Gradle 8.5 sara usato al prossimo npm run android.
echo.
echo Ora esegui: npm run android
pause
