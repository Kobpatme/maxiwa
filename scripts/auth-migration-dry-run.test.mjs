import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMigration } from './auth-migration-dry-run.mjs';

test('matches legacy users to Auth UID without exposing password values', () => {
  const report = analyzeMigration([
    { employee_id: 'USER001', email: 'USER@example.invalid', password: 'must-not-appear', role: 'user' }
  ], [
    { uid: 'uid-user-001', email: 'user@example.invalid' }
  ]);

  assert.deepEqual(report.summary, {
    legacy_users: 1,
    auth_users: 1,
    ready: 1,
    blocked: 0,
    legacy_password_fields_detected: 1
  });
  assert.equal(report.rows[0].target_profile_path, 'user_profiles/uid-user-001');
  assert.equal(JSON.stringify(report).includes('must-not-appear'), false);
});

test('blocks duplicate and incomplete identities', () => {
  const report = analyzeMigration([
    { employee_id: 'dup001', email: 'a@example.invalid' },
    { employee_id: 'DUP001', email: '' }
  ], []);

  assert.equal(report.summary.ready, 0);
  assert.equal(report.summary.blocked, 2);
  assert.ok(report.rows[0].issues.includes('duplicate_employee_id'));
  assert.ok(report.rows[1].issues.includes('missing_email'));
  assert.ok(report.rows[1].issues.includes('missing_auth_uid'));
});
