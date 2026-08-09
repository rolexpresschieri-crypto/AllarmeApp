# Esegui PowerShell COME AMMINISTRATORE (tasto destro su PowerShell -> Esegui come amministratore)
# Poi incolla e lancia:

$path = "C:\Users\rronc\AllarmeApp\android\app\.cxx"
if (Test-Path $path) {
    Write-Host "Eliminazione .cxx in corso..."
    Remove-Item -Recurse -Force $path -ErrorAction Stop
    Write-Host "Eliminata. Ora dalla cartella del progetto lancia: npm run android"
} else {
    Write-Host "Cartella .cxx non trovata (gia' eliminata?). Lancia: npm run android"
}
