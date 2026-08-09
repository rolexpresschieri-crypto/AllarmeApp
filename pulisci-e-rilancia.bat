@echo off
cd /d "c:\Users\rronc\AllarmeApp"
echo ============================================
echo   PULIZIA COMPLETA - AllarmeApp
echo   Cartella: %CD%
echo ============================================
echo.

echo 1. Pulizia cache Metro...
if exist "%USERPROFILE%\.metro" (
  rd /s /q "%USERPROFILE%\.metro" 2>nul
  echo    .metro eliminata
)
if exist "node_modules\.cache" (
  rd /s /q "node_modules\.cache" 2>nul
  echo    node_modules\.cache eliminata
)
echo.

echo 2. Pulizia build Android...
cd android
call gradlew.bat clean 2>nul
cd ..
if exist "android\app\build" rd /s /q "android\app\build"
echo    android\app\build pulita
echo.

echo 3. Fatto. Ora:
echo    - Apri un terminale qui e lancia:  npx react-native start --reset-cache
echo    - Apri un SECONDO terminale qui e lancia:  npm run android
echo.
echo    L'app deve partire da QUESTA cartella per vedere logo e grafica nuova.
echo    Se vedi ancora "ALLARME APP" e due pulsanti blu, stai lanciando da un'altra cartella.
echo.
pause
