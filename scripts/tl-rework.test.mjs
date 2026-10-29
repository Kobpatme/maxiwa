import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const domain = readFileSync(new URL('../domain-logic.js', import.meta.url), 'utf8');

function source(name) {
  const start = html.search(new RegExp(`    (?:async )?function ${name}\\(`));
  assert.ok(start >= 0, `Missing function ${name}`);
  const next = html.slice(start + 1).search(/\n    (?:async )?function /);
  return html.slice(start, start + 1 + next);
}

function fixture(overrides = {}, remote = false) {
  const item = {
    id: 'synthetic-rework', status: 'ret', status_final: 'ret', complete_tl: 'On Process',
    pdf_tl_work: 'https://example.invalid/original.pdf', inspected_by: 'TL',
    tl_complete_date: '2026-10-20', install_date: '2026-10-19', deposit: 1000,
    return_status: 'Pending', log: [], ...overrides
  };
  const elements = new Map();
  const input = id => {
    if (!elements.has(id)) elements.set(id, {
      value: id.includes('inspected') ? 'TL' : '2026-10-29',
      files: [], style: {}, innerHTML: '', textContent: 'Save', disabled: false
    });
    return elements.get(id);
  };
  const notices = [];
  const overlays = [];
  const ctx = {
    console: { error() {} }, USE_MOCK: !remote,
    prompt: () => 'แก้ไขรอบทดสอบ', confirm: () => true,
    findDepositById: () => item,
    addLogEntry: (d, title) => d.log.push({ title, time: '29/10/2569 10:00:00' }),
    updateDeposit: async (id, patch) => patch,
    mergeDepositIntoDB: (id, patch) => Object.assign(item, patch),
    toast: (message, kind) => notices.push({ message, kind }),
    closeModal() {}, renderTable() {}, renderKPI() {}, renderTLTasksPage() {},
    openTLModal() {}, openDetail() {},
    document: { getElementById: input, createElement: () => ({ style: {} }) },
    body: { appendChild() {} }, event: { currentTarget: input('button') },
    toggleUploadOverlay: visible => overlays.push(visible),
    isOffServicePendingItem: d => ctx.DepositDomain.isOffServicePendingItem(d),
    isOnServiceItem: d => ctx.DepositDomain.isOnServiceItem(d)
  };
  vm.createContext(ctx);
  vm.runInContext(domain, ctx);
  for (const name of ['getWorkflowStatusKey', 'isTLWorkInProgress', 'getTLReworkLog',
    'sendBackToTL', 'acceptJobTLDetail', 'saveTLWorkDetail', 'saveExtraDocsOnly', 'parseTHLogDate', 'getTLAcceptInfo']) {
    vm.runInContext(source(name), ctx);
  }
  return { ctx, item, input, notices, overlays };
}

function actions(f) {
  const start = html.indexOf("      const actionsContainer = document.getElementById('tlModalActions');");
  const end = html.indexOf("      openModal('tlWorkOverlay');", start);
  f.ctx.d = f.item;
  vm.runInContext(`{${html.slice(start, end)}}`, f.ctx);
  return f.input('tlModalActions').innerHTML;
}

test('two complete rework rounds keep evidence, reason and review status consistent', async () => {
  const f = fixture();
  for (let round = 1; round <= 2; round++) {
    await f.ctx.sendBackToTL(f.item.id);
    assert.equal(f.item.status, 'tl');
    assert.equal(f.item.status_final, 'tl');
    assert.equal(f.item.return_status, 'Pending');
    assert.match(actions(f), /acceptJobTLDetail/);
    await f.ctx.acceptJobTLDetail(f.item.id, true);
    assert.equal(f.item.status, 'On Process');
    assert.equal(f.item.status_final, 'On Process');
    assert.ok(f.ctx.getTLReworkLog(f.item));
    assert.match(actions(f), /showUploadTLModal/);
    await f.ctx.saveTLWorkDetail(f.item.id, true, true);
    assert.equal(f.item.status, 'On Process');
    assert.match(actions(f), /showUploadTLModal/);
    f.input('f-pdf-tl-work-modal').files = [{ name: `round-${round}.pdf`, size: 50, type: 'application/pdf' }];
    await f.ctx.saveTLWorkDetail(f.item.id, true);
    assert.equal(f.item.status, 'ret');
    assert.equal(f.item.status_final, 'ret');
    assert.equal(f.item.return_status, 'Pending');
    assert.ok(f.item.pdf_tl_work.includes('https://example.invalid/original.pdf'));
    assert.equal(f.item.pdf_tl_work.length, round + 1);
    assert.match(actions(f), /รอ User ตรวจรับ/);
    assert.doesNotMatch(actions(f), /showUploadTLModal/);
    assert.equal(f.ctx.getTLReworkLog(f.item), null);
    assert.equal(f.overlays.at(-1), false);
  }
  assert.equal(f.item.log.filter(e => e.title === 'TL ส่งงานแก้ไขให้ตรวจรับใหม่').length, 2);
});

test('normal first submission requires evidence and reaches review', async () => {
  const f = fixture({ status: 'tl', status_final: 'tl', complete_tl: 'Pending', pdf_tl_work: '' });
  await f.ctx.acceptJobTLDetail(f.item.id, true);
  await f.ctx.saveTLWorkDetail(f.item.id, true);
  assert.equal(f.item.status, 'On Process');
  assert.match(f.notices.at(-1).message, /กรุณาเลือกไฟล์/);
  f.input('f-pdf-tl-work-modal').files = [{ name: 'first.pdf', size: 50, type: 'application/pdf' }];
  await f.ctx.saveTLWorkDetail(f.item.id, true);
  assert.equal(f.item.status, 'ret');
});

test('Building Dept can submit without an evidence file', async () => {
  const f = fixture({ status: 'On Process', status_final: 'On Process', pdf_tl_work: '' });
  f.input('f-inspected-by-modal').value = 'Building Dept';
  await f.ctx.saveTLWorkDetail(f.item.id, true);
  assert.equal(f.item.status, 'ret');
  assert.match(actions(f), /รอ User ตรวจรับ/);
});

test('rework can submit corrected operation info with existing evidence', async () => {
  const f = fixture();
  await f.ctx.sendBackToTL(f.item.id);
  await f.ctx.acceptJobTLDetail(f.item.id, true);
  await f.ctx.saveTLWorkDetail(f.item.id, true);
  assert.equal(f.item.status, 'ret');
  assert.equal(f.item.pdf_tl_work, 'https://example.invalid/original.pdf');
});

test('extra documents do not submit field work', async () => {
  const f = fixture({ status: 'On Process', status_final: 'On Process' });
  f.input('f-pdf-tl-extra-after').files = [{ name: 'extra.pdf' }];
  await f.ctx.saveExtraDocsOnly(f.item.id);
  assert.equal(f.item.status, 'On Process');
  assert.equal(f.item.pdf_tl_extra, 'mock://uploads/tl_extra/extra.pdf');
});

test('stale TL completion marker cannot resubmit review or closed work', async () => {
  for (const status of ['ret', 'clo', 'done', 'Cancel']) {
    const f = fixture({ status, status_final: status });
    const before = structuredClone(f.item);
    await f.ctx.saveTLWorkDetail(f.item.id, true);
    assert.deepEqual(f.item, before);
    assert.doesNotMatch(actions(f), /showUploadTLModal/);
  }
});

test('failed send-back, acceptance, info save and submission leave local state and logs untouched', async () => {
  for (const operation of ['sendBackToTL', 'acceptJobTLDetail', 'info', 'saveTLWorkDetail']) {
    const status = operation === 'sendBackToTL' ? 'ret' : operation === 'acceptJobTLDetail' ? 'tl' : 'On Process';
    const f = fixture({ status, status_final: status, complete_tl: status === 'tl' ? 'Pending' : 'On Process' }, true);
    const before = structuredClone(f.item);
    f.ctx.updateDeposit = async () => { throw new Error('synthetic-write-failure'); };
    if (operation === 'info') await f.ctx.saveTLWorkDetail(f.item.id, true, true);
    else await f.ctx[operation](f.item.id, true);
    assert.deepEqual(f.item, before, operation);
    assert.equal(f.notices.at(-1).kind, 'error');
    assert.equal(f.input('button').disabled, false);
    if (operation === 'saveTLWorkDetail') assert.equal(f.overlays.at(-1), false);
  }
});

test('cancelled prompt and invalid repeated send-back do not alter work', async () => {
  const f = fixture();
  f.ctx.prompt = () => null;
  await f.ctx.sendBackToTL(f.item.id);
  assert.equal(f.item.status, 'ret');
  f.ctx.prompt = () => 'reason';
  await f.ctx.sendBackToTL(f.item.id);
  const before = structuredClone(f.item);
  await f.ctx.sendBackToTL(f.item.id);
  assert.deepEqual(structuredClone(f.item), before);
});

test('TL duration follows the latest acceptance instead of a completed older round', () => {
  const f = fixture({ status: 'On Process', log: [
    { title: 'TL รับงานเข้าดำเนินการ', time: '01/10/2569 10:00:00' },
    { title: 'TL ดำเนินการเสร็จสิ้นและแนบหลักฐาน', time: '02/10/2569 10:00:00' },
    { title: 'ส่งกลับแก้ไขโดย User: แก้ไข', time: '03/10/2569 10:00:00' },
    { title: 'TL รับงานเข้าดำเนินการ', time: '04/10/2569 10:00:00' }
  ] });
  assert.equal(f.ctx.getTLAcceptInfo(f.item).dateStr, '04/10/2569');
  assert.equal(f.ctx.getTLAcceptInfo(f.item).stopped, false);
  f.item.log.push({ title: 'TL ส่งงานแก้ไขให้ตรวจรับใหม่', time: '06/10/2569 10:00:00' });
  assert.equal(f.ctx.getTLAcceptInfo(f.item).diff, 2);
  assert.equal(f.ctx.getTLAcceptInfo(f.item).stopped, true);
});
