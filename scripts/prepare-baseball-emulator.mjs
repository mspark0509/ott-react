import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const target = '/tmp/ott-baseball-emulator';
await mkdir(target, { recursive: true });
const football = await readFile(new URL('../docs/sports-firestore.rules', import.meta.url), 'utf8');
const baseball = await readFile(new URL('../docs/baseball-firestore.rules', import.meta.url), 'utf8');
await writeFile(resolve(target, 'firestore.rules'), `rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\n${football}\n${baseball}\n} }\n`);
await writeFile(resolve(target, 'firebase.json'), JSON.stringify({ firestore: { rules: 'firestore.rules' },
  emulators: { firestore: { port: 8080 }, ui: { enabled: false }, singleProjectMode: true } }, null, 2));
console.log(`Prepared isolated demo rules at ${target}; no production configuration was changed.`);
