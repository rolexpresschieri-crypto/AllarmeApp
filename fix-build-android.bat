@echo off
cd /d "C:\Users\rronc\AllarmeApp"
echo ============================================
echo   Fix build: pulizia .cxx e rilancio Android
echo ============================================
echo.
echo Chiudi Metro (Ctrl+C nel terminale dove gira npm start) se e' aperto.
echo Chiudi l'emulatore o stacca il telefono per evitare lock sui file.
echo.
pause

echo.
echo Eliminazione cartella .cxx (cache CMake)...
rd /s /q "android\app\.cxx" 2>nul
if exist "android\app\.cxx" (
  echo ATTENZIONE: .cxx non eliminata - probabilmente in uso.
  echo Prova a: chiudere tutto, aprire PowerShell come Amministratore,
  echo poi eseguire: rd /s /q "C:\Users\rronc\AllarmeApp\android\app\.cxx"
  echo.
  pause
  exit /b 1
)
echo .cxx eliminata.

echo.
echo Avvio build Android...
call npm run android
echo.
pause
