@echo off
cd /d "c:\Users\rronc\AllarmeApp"
echo ============================================
echo   Build APK Release - Allarme App
echo ============================================
echo.

set "COUNTER_FILE=android\version-counter.txt"
if not exist "%COUNTER_FILE%" (
  echo 0>"%COUNTER_FILE%"
)
set /p LAST_CODE=<"%COUNTER_FILE%"
if "%LAST_CODE%"=="" set "LAST_CODE=0"
set /a NEXT_CODE=LAST_CODE+1
> "%COUNTER_FILE%" echo %NEXT_CODE%
set "PATCH=00%NEXT_CODE%"
set "PATCH=%PATCH:~-2%"
echo Versione build: 1.0.%PATCH%  (versionCode=%NEXT_CODE%)
echo.

if not exist "android\app\debug.keystore" (
  echo Creazione debug.keystore per la firma...
  keytool -genkey -v -keystore android\app\debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
  if errorlevel 1 (
    echo Impossibile creare il keystore. Assicurati che il JDK sia nel PATH.
    pause
    exit /b 1
  )
  echo.
)

echo Build per telefoni 64-bit e 32-bit (arm64 + armv7) - compatibile con più dispositivi.
echo Gradle: clean + assembleRelease cosi l APK e sempre riscritto (data modifica aggiornata).
echo Senza clean, un build "success" puo lasciare UP-TO-DATE e la data del file non cambia.
echo.
echo Pulizia cache build (CMake, autolinking, node_modules native)...
call pulisci-build-release.bat
if errorlevel 1 (
  echo PULIZIA FALLITA.
  pause
  exit /b 1
)
echo.
cd android
call gradlew.bat clean assembleRelease -PappVersionCode=%NEXT_CODE% -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
set "BUILD_EXIT=%ERRORLEVEL%"
cd ..
if not "%BUILD_EXIT%"=="0" (
  > "%COUNTER_FILE%" echo %LAST_CODE%
  echo BUILD FALLITO. Se vedi errore su .cxx, chiudi tutto e riprova dopo riavvio.
  pause
  exit /b %BUILD_EXIT%
)

echo.
echo   APK creato: android\app-build-output\outputs\apk\release\allarme_app_1.0.%PATCH%.apk
echo   Copialo sul telefono e installalo (attiva "Origini sconosciute" se richiesto).
echo.
pause
