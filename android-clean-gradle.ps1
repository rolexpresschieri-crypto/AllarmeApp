# Pulizia cache Gradle - esegui con PowerShell dalla cartella del progetto
# Oppure: .\android-clean-gradle.ps1

$ErrorActionPreference = "Continue"
$androidDir = Join-Path $PSScriptRoot "android"
if (-not (Test-Path $androidDir)) {
    Write-Host "Cartella android non trovata. Esegui dalla root del progetto."
    exit 1
}

Set-Location $androidDir
Write-Host "Arresto Gradle Daemon..."
& .\gradlew.bat --stop 2>$null
Set-Location ..

Write-Host "Rimozione android\.gradle..."
Remove-Item (Join-Path $androidDir ".gradle") -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path (Join-Path $androidDir ".gradle")) {
    Write-Host "AVVISO: android\.gradle non eliminata (in uso?). Chiudi Android Studio/Metro e riprova come Amministratore."
} else {
    Write-Host "Pulizia completata. Esegui: npm run android"
}
