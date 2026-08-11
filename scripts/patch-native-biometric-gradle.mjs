import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const buildFile = resolve(
  'node_modules/capacitor-native-biometric/android/build.gradle',
);
const source = readFileSync(buildFile, 'utf8');
const patched = source.replaceAll('jcenter()', 'mavenCentral()');

if (patched !== source) {
  writeFileSync(buildFile, patched);
  console.log('Updated capacitor-native-biometric to use Maven Central.');
}
