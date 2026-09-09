import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const normalize = value => String(value || '').trim().toLowerCase();

export function analyzeMigration(legacyInput, authInput) {
  const legacyUsers = Array.isArray(legacyInput) ? legacyInput : legacyInput?.users || [];
  const authUsers = Array.isArray(authInput) ? authInput : authInput?.users || [];
  const employeeCounts = countBy(legacyUsers, user => normalize(user.employee_id));
  const emailCounts = countBy(legacyUsers, user => normalize(user.email));
  const authByEmail = new Map(authUsers.map(user => [normalize(user.email), user]));

  const rows = legacyUsers.map(user => {
    const employeeId = normalize(user.employee_id);
    const email = normalize(user.email);
    const issues = [];
    if (!employeeId) issues.push('missing_employee_id');
    if (!email) issues.push('missing_email');
    if (employeeId && employeeCounts.get(employeeId) > 1) issues.push('duplicate_employee_id');
    if (email && emailCounts.get(email) > 1) issues.push('duplicate_email');

    const authUser = email ? authByEmail.get(email) : null;
    if (!authUser?.uid) issues.push('missing_auth_uid');

    return {
      employee_id: employeeId || null,
      email: email || null,
      role: user.role || null,
      auth_uid: authUser?.uid || null,
      target_profile_path: authUser?.uid ? `user_profiles/${authUser.uid}` : null,
      action: issues.length ? 'blocked' : 'upsert_profile',
      issues
    };
  });

  return {
    summary: {
      legacy_users: legacyUsers.length,
      auth_users: authUsers.length,
      ready: rows.filter(row => row.action === 'upsert_profile').length,
      blocked: rows.filter(row => row.action === 'blocked').length,
      legacy_password_fields_detected: legacyUsers.filter(user => Object.hasOwn(user, 'password')).length
    },
    rows
  };
}

function countBy(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

async function main() {
  const [legacyPath, authPath] = process.argv.slice(2);
  if (!legacyPath || !authPath) {
    console.error('Usage: node scripts/auth-migration-dry-run.mjs <legacy-users.json> <firebase-auth-users.json>');
    process.exitCode = 2;
    return;
  }
  const [legacyInput, authInput] = await Promise.all([
    readFile(legacyPath, 'utf8').then(JSON.parse),
    readFile(authPath, 'utf8').then(JSON.parse)
  ]);
  console.log(JSON.stringify(analyzeMigration(legacyInput, authInput), null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
