// Run against tools/local-server.mjs. Uses synthetic local fixture data only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DEPOSIT_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.DEPOSIT_BROWSER_PATH ? { executablePath: process.env.DEPOSIT_BROWSER_PATH } : {})
});
const base = process.env.DEPOSIT_TEST_URL || 'http://127.0.0.1:4175';
const output = resolve('docs/quality/tl-rework');
await mkdir(output, { recursive: true });
const results = [];
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

// Keep this workflow test offline. These shims only initialize unused external
// SDKs; all application workflow, file inputs, rendering and handlers are real.
await context.route('**/*', async route => {
  const url = route.request().url();
  if (url.startsWith(base + '/')) return route.continue();
  let body = '';
  if (url.includes('firebase-app-compat.js')) {
    body = `window.firebase={apps:[],initializeApp(){},firestore(){return {}},storage(){return {}},auth(){return {}}};`;
  }
  if (url.includes('chart.js')) body = 'window.Chart=class { destroy(){} };';
  await route.fulfill({ status: 200, contentType: url.includes('fonts.googleapis') ? 'text/css' : 'application/javascript', body });
});

async function pageFor(user, pageName) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept(dialog.type() === 'prompt' ? 'แก้ไขหลักฐานตามข้อเสนอแนะ' : undefined));
  await page.goto(`${base}/?mock=1&user=${user}&page=${pageName}`);
  await page.waitForFunction(() => typeof DB !== 'undefined' && DB.length === 10 && CURRENT_USER);
  return page;
}

const item = (page, id = 1006) => page.evaluate(id => JSON.parse(JSON.stringify(findDepositById(id))), id);
async function state(page, id, expected) {
  await page.waitForFunction(({ id, expected }) => findDepositById(id).status === expected, { id, expected });
  const d = await item(page, id);
  assert.equal(d.status_final, expected);
  return d;
}
async function sync(from, to) {
  const data = await from.evaluate(() => JSON.parse(JSON.stringify(DB)));
  await to.evaluate(data => { DB = data; renderTable(); renderKPI(); renderTLTasksPage(); }, data);
}
async function openUser(page, id = 1006) {
  await page.locator(`#tbody tr[onclick*="openEdit('${id}'"]`).click();
  await page.locator('#formOverlay.open').waitFor();
}
async function openTL(page, id = 1006) {
  await page.locator(`#tl-task-tbody tr[onclick="openTLModal('${id}')"]`).click();
  await page.locator('#tlWorkOverlay.open').waitFor();
}
const pdf = name => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% synthetic workflow fixture\n%%EOF') });

try {
  const user = await pageFor('user001', 'list');
  const tl = await pageFor('tl001', 'tl-tasks');
  for (let round = 1; round <= 2; round++) {
    await openUser(user);
    const count = await user.locator('#step5-tl-evidence a').count();
    assert.equal(count, round);
    await user.locator('#step5-sendback-ui button').click();
    await state(user, 1006, 'tl');
    await sync(user, tl);
    await openTL(tl);
    assert.ok((await tl.locator('#tlWorkBody').innerText()).includes('แก้ไขหลักฐานตามข้อเสนอแนะ'));
    await tl.locator('#tlModalActions button', { hasText: 'รับงาน' }).click();
    await state(tl, 1006, 'On Process');
    assert.ok((await tl.locator('#tlWorkBody').innerText()).includes('แก้ไขหลักฐานตามข้อเสนอแนะ'));
    await tl.locator('#f-install-date-modal').fill('2026-10-20');
    await tl.locator('#f-tl-complete-date-modal-permanent').fill('2026-10-29');
    await tl.locator('#tlWorkBody button', { hasText: 'บันทึกข้อมูลเบื้องต้น' }).click();
    await state(tl, 1006, 'On Process');
    assert.equal(await tl.locator('#modal-finish-btn').count(), 1);
    await tl.locator('#modal-finish-btn').click();
    await tl.locator('#f-pdf-tl-work-modal').setInputFiles(pdf(`correction-${round}.pdf`));
    await tl.locator('#tl-modal-upload-ui button').scrollIntoViewIfNeeded();
    await tl.screenshot({ path: resolve(output, `round-${round}-ready.png`), fullPage: true });
    await tl.locator('#tl-modal-upload-ui button').click();
    const reviewed = await state(tl, 1006, 'ret');
    assert.equal(reviewed.pdf_tl_work.length, round + 1);
    assert.ok(reviewed.pdf_tl_work.includes('https://example.invalid/tl.pdf'));
    assert.equal(await tl.locator('#modal-finish-btn').count(), 0);
    assert.ok((await tl.locator('#tlModalActions').innerText()).includes('รอ User ตรวจรับ'));
    assert.equal(await tl.locator('#uploadProgressOverlay').isVisible(), false);
    await tl.screenshot({ path: resolve(output, `round-${round}-submitted.png`), fullPage: true });
    await tl.locator('#tlWorkOverlay .modal-close').click();
    await sync(tl, user);
    results.push(`PASS round ${round}: User send-back -> TL accept -> edit/save -> submit -> User review; original evidence retained`);
  }

  // Saving the main form while TL is working must not use old evidence to skip review.
  await openUser(user);
  await user.locator('#step5-sendback-ui button').click();
  await state(user, 1006, 'tl');
  await openUser(user);
  await user.locator('#formSubmitBtn').click();
  await user.waitForFunction(() => !document.getElementById('formSubmitBtn').disabled);
  await state(user, 1006, 'tl');
  assert.equal(await user.evaluate(() => currentStep), 4);
  await user.evaluate(() => { setDirty(false); closeModal('formOverlay'); });
  await sync(user, tl);
  await openTL(tl);
  await tl.locator('#tlModalActions button', { hasText: 'รับงาน' }).click();
  await state(tl, 1006, 'On Process');
  await tl.locator('#modal-finish-btn').click();
  // Reuse evidence when the correction only changes operation details.
  await tl.locator('#tl-modal-upload-ui button').click();
  await state(tl, 1006, 'ret');
  await tl.locator('#tlWorkOverlay .modal-close').click();
  await sync(tl, user);
  results.push('PASS main-form save does not skip TL work; corrected info may reuse existing evidence');

  await openUser(user);
  assert.equal(await user.locator('#step5-tl-evidence a').count(), 3);
  await user.locator('#formSubmitBtn').click();
  await state(user, 1006, 'clo');
  await user.locator('#f-pdf-user-final').setInputFiles(pdf('final-refund.pdf'));
  await user.locator('#formSubmitBtn').click();
  const closed = await state(user, 1006, 'done');
  assert.equal(closed.depReturn, 'Yes');
  assert.equal(closed.return_status, 'Done');
  assert.equal(closed.pdf_tl_work.length, 3);
  await user.screenshot({ path: resolve(output, 'user-closed.png'), fullPage: true });
  results.push('PASS User accepts corrected work -> closing -> final document upload -> done');

  // Normal first-time work still exposes a required evidence input.
  await openTL(tl, 1004);
  await tl.locator('#tlModalActions button', { hasText: 'รับงาน' }).click();
  await state(tl, 1004, 'On Process');
  await tl.locator('#f-install-date-modal').fill('2026-10-20');
  await tl.locator('#f-tl-complete-date-modal-permanent').fill('2026-10-29');
  await tl.locator('#modal-finish-btn').click();
  await tl.locator('#tl-modal-upload-ui button').click();
  await state(tl, 1004, 'On Process');
  await tl.locator('#f-pdf-tl-work-modal').setInputFiles(pdf('normal-first.pdf'));
  await tl.locator('#tl-modal-upload-ui button').click();
  await state(tl, 1004, 'ret');
  results.push('PASS normal first submission validates missing evidence and then reaches User review');

  const beforeExtra = await item(tl, 1004);
  await tl.locator('#tlModalActions button', { hasText: 'แนบเอกสารเพิ่มเติม' }).click();
  await tl.locator('#f-pdf-tl-extra-after').setInputFiles(pdf('additional.pdf'));
  await tl.locator('#tl-modal-extra-only-ui button').click();
  await tl.waitForFunction(() => !!findDepositById(1004).pdf_tl_extra);
  const afterExtra = await state(tl, 1004, 'ret');
  assert.deepEqual(afterExtra.pdf_tl_work, beforeExtra.pdf_tl_work);
  await tl.locator('#tlWorkOverlay .modal-close').click();
  results.push('PASS extra-document upload preserves evidence and workflow state');

  // Recreate an already-stuck legacy record and use the alternate detail screen.
  await tl.evaluate(() => {
    Object.assign(findDepositById(1005), {
      status_final: 'On Process', pdf_tl_work: 'https://example.invalid/legacy.pdf',
      tl_complete_date: '2026-10-29', install_date: '2026-10-20', inspected_by: 'TL'
    });
    openDetail(1005);
  });
  await tl.locator('#finish-btn-tl').click();
  await tl.locator('#f-pdf-tl-work-detail').setInputFiles(pdf('detail-correction.pdf'));
  await tl.locator('#tl-upload-ui button').click();
  const recovered = await state(tl, 1005, 'ret');
  assert.equal(recovered.pdf_tl_work.length, 2);
  assert.ok(recovered.pdf_tl_work.includes('https://example.invalid/legacy.pdf'));
  assert.equal(await tl.locator('#finish-btn-tl').count(), 0);
  assert.equal(await tl.locator('#uploadProgressOverlay').isVisible(), false);
  await tl.screenshot({ path: resolve(output, 'legacy-detail-submitted.png'), fullPage: true });
  results.push('PASS previously stuck record can submit from the detail screen without clearing old evidence');

  assert.deepEqual(errors, []);
  results.push('PASS no uncaught browser errors');
  console.log(results.join('\n'));
} finally {
  await writeFile(resolve(output, 'browser-results.json'), JSON.stringify({
    mode: 'offline local fixture; external SDK initialization shimmed; no production/Firebase integration exercised',
    results, errors
  }, null, 2));
  await browser.close();
}
