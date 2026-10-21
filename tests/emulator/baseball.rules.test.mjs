import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

// Never fall through to an actual Firebase project if an emulator is unavailable.
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(?:127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('A local Firestore emulator is required; production is prohibited.');
const require = createRequire(resolve(process.env.BASEBALL_TEST_DEPS || '/tmp/ott-sports-browser', 'package.json'));
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, deleteDoc, Timestamp } = require('firebase/firestore');
let environment;
const roomA = 'Baseball001', roomB = 'Baseball002';
const body = (uid, text = '함께 응원해요') => ({ uid, name: uid, text, createdAt: serverTimestamp() });
before(async () => {
  environment = await initializeTestEnvironment({ projectId: 'demo-ott-baseball', firestore: {
    host: host.split(':')[0], port: Number(host.split(':')[1]), rules: await readFile('/tmp/ott-baseball-emulator/firestore.rules', 'utf8'),
  } });
});
beforeEach(async () => { await environment.clearFirestore(); });
after(async () => { await environment?.cleanup(); });

function messages(db, room, expected) {
  return new Promise((resolveMessages, reject) => {
    let unsubscribe;
    const timeout = setTimeout(() => { unsubscribe?.(); reject(new Error('Realtime delivery timed out')); }, 5000);
    unsubscribe = onSnapshot(query(collection(db, 'baseballBroadcasts', room, 'messages'), orderBy('createdAt')), (snapshot) => {
      if (snapshot.size !== expected) return;
      clearTimeout(timeout); unsubscribe(); resolveMessages(snapshot.docs.map((item) => item.data()));
    }, (error) => { clearTimeout(timeout); reject(error); });
  });
}

test('two authenticated emulator users receive each other’s messages and rooms stay isolated', async () => {
  const alice = environment.authenticatedContext('alice').firestore();
  const bob = environment.authenticatedContext('bob').firestore();
  const bobSeesAlice = messages(bob, roomA, 1);
  await assertSucceeds(setDoc(doc(alice, 'baseballBroadcasts', roomA, 'messages', 'alice-message'), body('alice')));
  assert.equal((await bobSeesAlice)[0].uid, 'alice');
  const aliceSeesBoth = messages(alice, roomA, 2);
  await assertSucceeds(setDoc(doc(bob, 'baseballBroadcasts', roomA, 'messages', 'bob-message'), body('bob')));
  assert.deepEqual(new Set((await aliceSeesBoth).map((item) => item.uid)), new Set(['alice', 'bob']));
  await assertSucceeds(setDoc(doc(bob, 'baseballBroadcasts', roomB, 'messages', 'other-room'), body('bob', '다른 방송')));
  assert.equal((await getDocs(collection(alice, 'baseballBroadcasts', roomA, 'messages'))).size, 2);
  assert.equal((await getDocs(collection(alice, 'baseballBroadcasts', roomB, 'messages'))).size, 1);
});

test('security rules reject anonymous writes, spoofed UID, extra fields, oversized messages and timestamps', async () => {
  const alice = environment.authenticatedContext('alice').firestore();
  const guest = environment.unauthenticatedContext().firestore();
  const path = ['baseballBroadcasts', roomA, 'messages', 'invalid'];
  await assertFails(setDoc(doc(guest, ...path), body('guest')));
  await assertFails(setDoc(doc(alice, ...path), body('bob')));
  await assertFails(setDoc(doc(alice, ...path), body('alice', 'x'.repeat(301))));
  await assertFails(setDoc(doc(alice, ...path), { ...body('alice'), role: 'admin' }));
  await assertFails(setDoc(doc(alice, ...path), { ...body('alice'), createdAt: Timestamp.fromMillis(0) }));
  await assertFails(setDoc(doc(alice, 'baseballBroadcasts', 'invalid-room', 'messages', 'id'), body('alice')));
  await assertFails(setDoc(doc(alice, 'baseballBroadcasts', roomA), { streamUrl: 'untrusted' }));
});

test('messages are immutable and baseball rules do not permit writes to unrelated football rooms', async () => {
  const alice = environment.authenticatedContext('alice').firestore();
  const reference = doc(alice, 'baseballBroadcasts', roomA, 'messages', 'message');
  await assertSucceeds(setDoc(reference, body('alice')));
  await assertFails(updateDoc(reference, { text: 'edited' }));
  await assertFails(deleteDoc(reference));
  await assertFails(setDoc(doc(alice, 'footballGames', 'unregistered', 'messages', 'id'), body('alice')));
});
