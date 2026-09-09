import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

let env;
const firestoreRulesPath = new URL('../../firestore.rules', import.meta.url);
const storageRulesPath = new URL('../../storage.rules', import.meta.url);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'deposit-manager-local',
    firestore: { rules: await readFile(firestoreRulesPath, 'utf8') },
    storage: { rules: await readFile(storageRulesPath, 'utf8') }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'user_profiles/owner-a'), { role: 'user', area: 'BKK', active: true });
    await setDoc(doc(db, 'user_profiles/tl-bkk'), { role: 'tl', area: 'BKK', active: true });
    await setDoc(doc(db, 'user_profiles/tl-upc'), { role: 'tl', area: 'UPC', active: true });
    await setDoc(doc(db, 'deposits/job-bkk'), { owner_uid: 'owner-a', tl_area: 'BKK' });
  });
});

after(async () => {
  await env.cleanup();
});

test('owner can upload a PDF under its deposit and unauthenticated client cannot read it', async () => {
  const ownerStorage = env.authenticatedContext('owner-a').storage();
  const fileRef = ref(ownerStorage, 'deposits/job-bkk/payments/evidence.pdf');
  await assertSucceeds(uploadBytes(fileRef, new Uint8Array([37, 80, 68, 70]), {
    contentType: 'application/pdf'
  }));

  const anonymousRef = ref(env.unauthenticatedContext().storage(), fileRef.fullPath);
  await assertFails(getBytes(anonymousRef));
});

test('cross-team TL cannot read a deposit file', async () => {
  const ownerStorage = env.authenticatedContext('owner-a').storage();
  const filePath = 'deposits/job-bkk/layouts/layout.pdf';
  await assertSucceeds(uploadBytes(ref(ownerStorage, filePath), new Uint8Array([37, 80, 68, 70]), {
    contentType: 'application/pdf'
  }));

  await assertSucceeds(getBytes(ref(env.authenticatedContext('tl-bkk').storage(), filePath)));
  await assertFails(getBytes(ref(env.authenticatedContext('tl-upc').storage(), filePath)));
});

test('non-PDF uploads and legacy flat folders are rejected', async () => {
  const storage = env.authenticatedContext('owner-a').storage();
  await assertFails(uploadBytes(ref(storage, 'deposits/job-bkk/payments/evidence.exe'), new Uint8Array([1]), {
    contentType: 'application/octet-stream'
  }));
  await assertFails(uploadBytes(ref(storage, 'payments/legacy.pdf'), new Uint8Array([37, 80, 68, 70]), {
    contentType: 'application/pdf'
  }));
});
