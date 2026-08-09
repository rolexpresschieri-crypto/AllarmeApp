@echo off
cd /d "C:\Users\rronc\AllarmeApp"
echo ============================================
echo   Build SOLO per telefono (arm64) - salta x86
echo   Cosi' non usa la cartella .cxx\x86 bloccata
echo ============================================
echo.
echo Usa questo se .cxx non si elimina. L'app andra' sul TELEFONO
echo (o su emulatore con immagine arm64), non su emulatore x86.
echo.
pause

cd android
call gradlew.bat app:installDebug -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=8081
set "BUILD_EXIT=%ERRORLEVEL%"
cd ..
if not "%BUILD_EXIT%"=="0" (
  echo BUILD FALLITO.
  pause
  exit /b %BUILD_EXIT%
)
echo.
echo Installazione completata sul dispositivo connesso.
pause
