# Setup Android per AllarmeApp

## Modifiche applicate per evitare blocchi su Windows

Sono state applicate queste modifiche **permanentemente** nel progetto:

1. **Cache Gradle fuori dal progetto**  
   La cartella `.gradle` non è più in `android\.gradle` ma in `C:\Users\rronc\.gradle\AllarmeAppBuild-cache`. Così si evitano errori "Could not move temporary workspace" e blocchi sull’antivirus.

2. **Gradle daemon disattivato**  
   In `android/gradle.properties` è impostato `org.gradle.daemon=false`. La build usa un solo processo e si riducono i conflitti sui file (es. "Unable to delete directory").

3. **Gradle 8.5**  
   Usato Gradle 8.5 per evitare bug di Gradle 8.6+ su Windows.

**Cosa fare adesso (una sola volta):**

1. **Aggiungi un’esclusione in Windows Defender** (importante):
   - **Impostazioni Windows** → **Privacy e sicurezza** → **Sicurezza di Windows** → **Protezione da virus e minacce** → **Impostazioni** → **Esclusioni** → **Aggiungi esclusione** → **Cartella**.
   - Aggiungi: `C:\Users\rronc\AllarmeAppBuild`
   - (Opzionale) Aggiungi anche: `C:\Users\rronc\.gradle`

2. **Riavvia il PC** (per rilasciare eventuali lock sui file).

3. **Dopo il riavvio:** chiudi tutto (Cursor, Android Studio, terminali), apri un solo PowerShell, vai nella cartella del progetto ed esegui:
   ```powershell
   cd "C:\Users\rronc\AllarmeAppBuild"
   .\PRIMA-BUILD.bat
   ```
   Lo script pulisce le cartelle problematiche e lancia la build. La prima build sarà lenta (Gradle senza daemon).

4. Se la build va a buon fine, per le volte successive: `npm start` in un terminale e `npm run android` in un altro.

---

## Se continua a fallire: usa WSL2 (soluzione definitiva)

Su Windows i blocchi sui file (antivirus, permessi, più processi) sono frequenti con React Native. Con **WSL2** (Linux dentro Windows) la build gira in Linux e questi problemi spariscono.

### Passi per usare WSL2

1. **Attiva WSL2** (PowerShell come Amministratore):
   ```powershell
   wsl --install
   ```
   Riavvia il PC se richiesto. Poi completa l’installazione di Ubuntu (username/password).

2. **Apri Ubuntu** dal menu Start. Nel terminale Ubuntu:
   ```bash
   # Installa Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Installa Java 17 (per Android)
   sudo apt-get update
   sudo apt-get install -y openjdk-17-jdk

   # Vai nella cartella del progetto (in WSL i dischi Windows sono in /mnt/c/...)
   cd /mnt/c/Users/rronc/AllarmeAppBuild
   npm install
   ```

3. **Android SDK in Windows** (va bene quello che hai già): in Ubuntu aggiungi alle variabili d’ambiente (nel file `~/.bashrc` o `~/.zshrc`):
   ```bash
   export ANDROID_HOME=/mnt/c/Users/rronc/AppData/Local/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
   ```
   (Modifica il percorso se il tuo SDK è altrove.)

4. **Build da WSL:**
   ```bash
   cd /mnt/c/Users/rronc/AllarmeAppBuild
   npm start
   ```
   In un altro terminale Ubuntu:
   ```bash
   cd /mnt/c/Users/rronc/AllarmeAppBuild
   npm run android
   ```
   L’emulatore Android va avviato da Windows (Android Studio); da WSL verrà visto e l’app si installerà.

Con WSL2 non serve più fare pulizie continue di `.gradle` o `node_modules`: la build è stabile.

---

## 0. Errore "Could not move temporary workspace" (Gradle)

È un **bug noto di Gradle 8.6+ su Windows**: antivirus (es. Windows Defender) blocca lo spostamento di file nella cache.

**Soluzione applicata nel progetto:** uso di **Gradle 8.5** (non affetto dal bug).

**Cosa fare tu:**

1. **Rimuovi la vecchia cache** (così viene usato Gradle 8.5):
   - Chiudi Metro e Android Studio.
   - Doppio clic su **`pulisci-gradle.bat`** nella root del progetto, oppure in PowerShell:
     ```powershell
     cd "C:\Users\rronc\AllarmeAppBuild"
     cd android; .\gradlew.bat --stop; cd ..
     Remove-Item -Recurse -Force android\.gradle -ErrorAction SilentlyContinue
     ```
2. **Aggiungi un’eccezione in Windows Defender** (consigliato):
   - **Impostazioni Windows** → **Privacy e sicurezza** → **Sicurezza di Windows** → **Protezione da virus e minacce** → **Impostazioni di Protezione da virus e minacce** → **Esclusioni** → **Aggiungi o rimuovi esclusioni** → **Aggiungi un’esclusione** → **Cartella**.
   - Aggiungi: `C:\Users\rronc\AllarmeAppBuild`.
3. Esegui di nuovo: `npm run android`.

Se l’eliminazione di `android\.gradle` fallisce con "Accesso negato", riavvia il PC e ripeti il punto 1.

---

## 1. Errore build Gradle (generateAutolinkingNewArchitectureFiles)

È stato impostato **Gradle 8.10.2** al posto di 9.0 per evitare l'errore con la cartella `generated/autolinking`.

**Se la build fallisce ancora:**

1. Chiudi **Metro** (Ctrl+C nel terminale dove gira `npm start`).
2. Chiudi **Android Studio** se aperto.
3. In un terminale nella cartella del progetto:
   ```powershell
   cd android
   .\gradlew.bat --stop
   cd ..
   ```
4. Riprova: `npm run android`.

Se compare ancora "Accesso negato" sulla cartella `android\app\build`:
- Riavvia il PC (per rilasciare eventuali lock), oppure
- Apri PowerShell **come Amministratore**, vai nella cartella del progetto ed esegui:
  ```powershell
  Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force android\build -ErrorAction SilentlyContinue
  ```
  Poi di nuovo `npm run android`.

---

## 2. "adb non è riconosciuto"

Serve avere **Android SDK** e **platform-tools** nel PATH.

1. Apri **Android Studio** → **Settings** (o **File** → **Settings**).
2. Vai in **Languages & Frameworks** → **Android SDK**.
3. Scheda **SDK Location**: annota il percorso **Android SDK Location** (es. `C:\Users\rronc\AppData\Local\Android\Sdk`).
4. Nella scheda **SDK Tools**, assicurati che **Android SDK Platform-Tools** sia installato (spunta e applica se serve).
5. Aggiungi al **PATH** di Windows:
   - `%LOCALAPPDATA%\Android\Sdk\platform-tools`
   - (oppure il percorso che hai annotato + `\platform-tools`).

Per verificare: apri un **nuovo** PowerShell e digita `adb version`. Deve mostrare la versione.

---

## 3. "No emulators found"

Serve almeno un **AVD** (Android Virtual Device).

1. Apri **Android Studio**.
2. **More Actions** → **Virtual Device Manager** (oppure **Tools** → **Device Manager**).
3. **Create Device** → scegli un dispositivo (es. Pixel 6) → **Next**.
4. Scegli un’immagine di sistema (es. **Tiramisu** API 33 o **UpsideDownCake** API 34) → **Download** se serve → **Next** → **Finish**.
5. Nella lista dell’emulatore, clicca sul pulsante **Play** per avviarlo.

Poi in un terminale: `npm run android`. L’app verrà installata sull’emulatore avviato.

---

## 4. Dispositivo fisico

1. Sul telefono: **Impostazioni** → **Opzioni sviluppatore** → abilita **Debug USB**.
2. Collega il cavo USB e accetta il messaggio di autorizzazione sul telefono.
3. Con **adb** nel PATH: `adb devices` per verificare che il dispositivo sia visto.
4. Esegui `npm run android`: l’app verrà installata sul dispositivo.
