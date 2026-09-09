import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'deposit-manager-local';
let env;

const firestoreRulesPath = new URL('../../firestore.rules', import.meta.url);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: await readFile(firestoreRulesPath, 'utf8') }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'user_profiles/admin-uid'), profile('admin', 'ALL'));
    await setDoc(doc(db, 'user_profiles/owner-a'), profile('user', 'BKK'));
    await setDoc(doc(db, 'user_profiles/owner-b'), profile('user', 'UPC'));
    await setDoc(doc(db, 'user_profiles/tl-bkk'), profile('tl', 'BKK'));
    await setDoc(doc(db, 'user_profiles/tl-upc'), profile('tl', 'UPC'));
    await setDoc(doc(db, 'staff_directory/owner-a'), {
      employee_id: 'user001', name: 'Fixture Owner', active: true
    });
    await setDoc(doc(db, 'deposits/job-bkk'), deposit('owner-a', 'BKK'));
  });
});

after(async () => {
  await env.cleanup();
});

function profile(role, area) {
  return { employee_id: `${role}001`, name: `Fixture ${role}`, role, area, active: true };
}

function deposit(ownerUid, tlArea) {
  return {
    owner_uid: ownerUid,
    employee_id: 'user001',
    tl_area: tlArea,
    status: 'tl',
    amount: 1000,
    created_at: 1,
    updated_at: 1,
    updated_by: ownerUid,
    version: 1
  };
}

test('unauthenticated clients cannot read deposits or directory', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'deposits/job-bkk')));
  await assertFails(getDoc(doc(db, 'staff_directory/owner-a')));
});

test('admin can read every deposit', async () => {
  const db = env.authenticatedContext('admin-uid').firestore();
  assert.equal((await assertSucceeds(getDoc(doc(db, 'deposits/job-bkk')))).exists(), true);
});

test('owner can read own deposit but another owner cannot', async () => {
  const ownerDb = env.authenticatedContext('owner-a').firestore();
  const otherDb = env.authenticatedContext('owner-b').firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'deposits/job-bkk')));
  await assertFails(getDoc(doc(otherDb, 'deposits/job-bkk')));
});

test('TL can read only matching area', async () => {
  const bkkDb = env.authenticatedContext('tl-bkk').firestore();
  const upcDb = env.authenticatedContext('tl-upc').firestore();
  await assertSucceeds(getDoc(doc(bkkDb, 'deposits/job-bkk')));
  await assertFails(getDoc(doc(upcDb, 'deposits/job-bkk')));
});

test('client cannot elevate its own role', async () => {
  const db = env.authenticatedContext('owner-a').firestore();
  await assertFails(updateDoc(doc(db, 'user_profiles/owner-a'), { role: 'admin' }));
});

test('owner cannot change protected financial fields', async () => {
  const db = env.authenticatedContext('owner-a').firestore();
  await assertFails(updateDoc(doc(db, 'deposits/job-bkk'), {
    amount: 999999,
    version: 2,
    updated_at: 2,
    updated_by: 'owner-a'
  }));
});

test('assigned TL can update only TL workflow fields with the next version', async () => {
  const db = env.authenticatedContext('tl-bkk').firestore();
  await assertSucceeds(updateDoc(doc(db, 'deposits/job-bkk'), {
    status: 'On Process',
    version: 2,
    updated_at: 2,
    updated_by: 'tl-bkk'
  }));
});
