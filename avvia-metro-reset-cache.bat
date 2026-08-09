@echo off
echo Arresta Metro se e' in esecuzione (Ctrl+C nel terminale dove gira npm start).
echo.
echo Avvio Metro con cache azzerata...
call npx react-native start --reset-cache
