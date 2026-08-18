import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const buildFiles = [
  'node_modules/capacitor-native-biometric/android/build.gradle',
  'node_modules/capacitor-secure-storage-plugin/android/build.gradle',
].map((path) => resolve(path));

for (const buildFile of buildFiles) {
  const source = readFileSync(buildFile, 'utf8');
  const patched = source
    .replaceAll('jcenter()', 'mavenCentral()')
    .replaceAll(
      "getDefaultProguardFile('proguard-android.txt')",
      "getDefaultProguardFile('proguard-android-optimize.txt')",
    );

  if (patched !== source) {
    writeFileSync(buildFile, patched);
    console.log(`Updated ${buildFile} for current Gradle compatibility.`);
  }
}
