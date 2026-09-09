import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const client = readFileSync('firebase-client.js', 'utf8');
const config = readFileSync('firebase-config.js', 'utf8');
const firestoreRules = readFileSync('firestore.rules', 'utf8');
const storageRules = readFileSync('storage.rules', 'utf8');
const fixture = readFileSync('mock-data.js', 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(fixture, sandbox);

const users = sandbox.window.DEPOSIT_MOCK_USERS;
const cases = sandbox.window.DEPOSIT_MOCK_CASES;
assert.deepEqual(Object.keys(users).sort(), ['admin001', 'tl001', 'user001']);
assert.equal(cases.length, 10);
assert.ok(cases.every(item => String(item.id_firestore).startsWith('fixture-')));
assert.ok(cases.some(item => item.status === 'Cancel'));
assert.ok(cases.some(item => item.status === 'done' && item.deposit === 0 && item.demolish === 0));
assert.ok(cases.some(item => item.inspected_by === 'Building Dept'));
assert.match(html, /if \(USE_MOCK\) \{\s*_depositsUnsubscribe = null;/);
assert.match(html, /window\.DEPOSIT_LOCAL_FIXTURE === true/);
assert.match(html, /<script src="domain-logic\.js"><\/script>/);
assert.ok((html.match(/DepositDomain\.sortCompletedLast\(/g) || []).length >= 2,
  'main and TL lists must both place completed work last');
assert.match(html, /id="active-demo-tbody"/);
assert.match(html, /id="pre-service-demo-tbody"/);
assert.match(html, /filteredData\.filter\(DepositDomain\.isPreServiceItem\)/);
assert.match(html, /id="nonRefundableCostKpi"/);
assert.match(html, /id="costDetailOverlay"/);
assert.match(html, /getNonRefundableCostMetrics\(filteredData\)/);
assert.match(html, /firebase-auth-compat\.js/);
assert.match(client, /signInWithEmailAndPassword/);
assert.match(client, /sendPasswordResetEmail/);
assert.match(client, /Legacy password lookup is disabled/);
assert.match(config, /DEPOSIT_AUTH_MODE = 'legacy'/);
assert.match(firestoreRules, /match \/user_profiles\/\{uid\}/);
assert.match(firestoreRules, /match \/users\/\{document=\*\*\}/);
assert.match(storageRules, /match \/deposits\/\{depositId\}\/\{category\}\/\{fileName\}/);

for (const operation of [
  'insertDeposit', 'updateDeposit', 'deleteDeposit', 'uploadFile', 'deleteFileFromUrl',
  'addUser', 'removeUser', 'updateUser', 'requestPasswordReset', 'verifyAndResetPassword'
]) {
  assert.match(client, new RegExp(`assertRemoteWriteAllowed\\('${operation}'\\)`), `${operation} lacks local write guard`);
}

console.log('PASS baseline fixture: 3 roles, 10 synthetic workflow cases');
console.log('PASS local safety: realtime listeners disabled and every Firebase write API guarded');
