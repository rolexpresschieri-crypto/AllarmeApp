/**
 * Applica la modifica "build fuori da node_modules" al plugin Gradle di React Native.
 * Necessario su Windows per evitare blocchi (antivirus / "Unable to delete directory").
 * Eseguito dopo ogni npm install.
 */
const fs = require('fs');
const path = require('path');

const pluginRoot = path.join(__dirname, '..', 'node_modules', '@react-native', 'gradle-plugin');
const buildDirRoot = path.join(process.env.USERPROFILE || process.env.HOME || '', '.gradle', 'AllarmeAppBuild-plugin-build');

const modules = [
  { dir: 'shared', name: 'shared' },
  { dir: 'settings-plugin', name: 'settings-plugin' },
  { dir: 'shared-testutil', name: 'shared-testutil' },
  { dir: 'react-native-gradle-plugin', name: 'react-native-gradle-plugin' },
];

const blockToAdd = (name) => ''; // Patch disabilitata: causava "Unresolved reference layout" in settings-plugin

modules.forEach(({ dir, name }) => {
  const filePath = path.join(pluginRoot, dir, 'build.gradle.kts');
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('AllarmeAppBuild-plugin-build')) return; // già applicato

  const insertAfter = ' */\n\n';
  const idx = content.indexOf(insertAfter);
  if (idx === -1) return;

  content = content.slice(0, idx + insertAfter.length) + blockToAdd(name) + content.slice(idx + insertAfter.length);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('patch-gradle-plugin: applied to', dir);
});
