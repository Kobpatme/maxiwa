import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'deposit-manager-emulator-'));

try {
  await Promise.all([
    copyFile(join(root, 'firestore.rules'), join(temp, 'firestore.rules')),
    copyFile(join(root, 'storage.rules'), join(temp, 'storage.rules')),
    copyFile(join(root, 'firestore.indexes.json'), join(temp, 'firestore.indexes.json'))
  ]);
  await writeFile(join(temp, 'firebase.json'), JSON.stringify({
    firestore: { rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
    storage: { rules: 'storage.rules' },
    emulators: {
      firestore: { port: 8080 },
      storage: { port: 9199 },
      ui: { enabled: false },
      singleProjectMode: true
    }
  }, null, 2));

  const firebaseCli = join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
  const testFiles = [
    join(root, 'tests', 'rules', 'firestore.rules.test.mjs'),
    join(root, 'tests', 'rules', 'storage.rules.test.mjs')
  ];
  const testCommand = `"${process.execPath}" --test --test-concurrency=1 ${testFiles.map(file => `"${file}"`).join(' ')}`;
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [
      firebaseCli,
      'emulators:exec',
      '--project', 'deposit-manager-local',
      '--only', 'firestore,storage',
      testCommand
    ], {
      cwd: temp,
      stdio: 'inherit',
      windowsHide: true,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: join(temp, '.config'),
        FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true'
      }
    });
    child.once('error', reject);
    child.once('exit', code => resolveExit(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  await rm(temp, { recursive: true, force: true });
}
