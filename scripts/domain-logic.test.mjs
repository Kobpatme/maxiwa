import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sandbox = {};
vm.runInNewContext(readFileSync('domain-logic.js', 'utf8'), sandbox);
const d = sandbox.DepositDomain;

assert.equal(d.isOnServiceItem({ status: 'done', demolish: 1000, demoReturn: 'No' }), true);
assert.equal(d.isOnServiceItem({ status: 'Done', demolish: '1,000', demoReturn: ' yes ' }), false);
assert.equal(d.isOnServiceItem({ status: 'clo', inspected_by: 'Building Dept', demolish: 2000, demoReturn: '' }), true);
assert.equal(d.isOnServiceItem({ status: 'clo', pdf_user_final: 'https://example.invalid/final.pdf', demolish: 3000, demoReturn: 'No' }), true);
assert.equal(d.isOnServiceItem({ status: 'clo', demolish: 3000, demoReturn: 'No' }), false);
assert.equal(d.isOnServiceItem({ status: 'Cancel', demolish: 5000, demoReturn: 'No' }), false);
assert.equal(d.isOnServiceItem({ status: 'ret', demolish: 5000, demoReturn: 'No' }), false);
assert.equal(d.isOffServicePendingItem({ status: 'done', demolish: 5000, demoReturn: 'No', service_cancel_date: '2026-09-09' }), true);
assert.equal(d.isOnServiceItem({ status: 'done', demolish: 5000, demoReturn: 'No', service_cancel_date: '2026-09-09' }), false);
assert.equal(d.isPreServiceItem({ status: 'ret', demolish: 5000, demoReturn: 'No' }), true);
assert.equal(d.isPreServiceItem({ status: 'done', demolish: 5000, demoReturn: 'No' }), false);
assert.equal(d.isPreServiceItem({ status: 'ret', demolish: 5000, demoReturn: 'Yes' }), false);
assert.equal(d.isFullyCompleted({ status: 'done', demolish: 1000, demoReturn: 'No' }), false);
assert.equal(d.isFullyCompleted({ status: 'done', demolish: 1000, demoReturn: 'Yes' }), true);
assert.equal(d.isFullyCompleted({ status: 'done', demolish: 0 }), true);
assert.equal(d.parseMoney('12,345.67'), 12345.67);
assert.equal(d.parseMoney(-1), 0);
assert.equal(d.parseMoney('Infinity'), 0);

const metrics = d.getRemovalDepositMetrics([
  { status: 'done', demolish: 1000, demoReturn: 'No' },
  { status: 'done', demolish: 500, demoReturn: 'No', off_service_status: 'pending' },
  { status: 'done', demolish: 2000, demoReturn: 'Yes' },
  { status: 'ret', demolish: 3000, demoReturn: 'No' },
  { status: 'Cancel', demolish: 4000, demoReturn: 'No' }
]);
assert.deepEqual(JSON.parse(JSON.stringify(metrics)), {
  totalAmount: 6500, totalCount: 4,
  refundedAmount: 2000, refundedCount: 1,
  outstandingAmount: 4500, outstandingCount: 3,
  onServiceAmount: 1000, onServiceCount: 1,
  offServicePendingAmount: 500, offServicePendingCount: 1,
  preServiceAmount: 3000, preServiceCount: 1
});

const installation = d.getInstallationDepositMetrics([
  { status: 'new', deposit: '10,000', depReturn: 'No' },
  { status: 'ret', deposit: 5000, depReturn: 'Yes' },
  { status: 'done', deposit: 2500, depReturn: 'No' },
  { status: 'Cancel', deposit: 9000, depReturn: 'No' }
]);
assert.deepEqual(JSON.parse(JSON.stringify(installation)), {
  totalAmount: 17500,
  totalCount: 3,
  refundedAmount: 5000,
  refundedCount: 1,
  outstandingAmount: 12500,
  outstandingCount: 2
});

const ordered = d.sortCompletedLast([
  { id: 'done-2', status: 'done', demolish: 0, no: 2 },
  { id: 'active-3', status: 'ret', no: 3 },
  { id: 'done-1', status: 'done', demolish: 0, no: 1 },
  { id: 'active-1', status: 'new', no: 1 },
  { id: 'on-service', status: 'done', demolish: 500, demoReturn: 'No', no: 0 }
], (a, b) => a.no - b.no);
assert.deepEqual(Array.from(ordered, item => item.id), [
  'active-1', 'active-3', 'on-service', 'done-1', 'done-2'
]);

const costs = d.getNonRefundableCostMetrics([
  { status: 'new', fee: '1,000', other: 250, other_desc: 'ค่าดำเนินการ' },
  { status: 'done', fee: 500, other: 100 },
  { status: 'Cancel', fee: 9000, other: 9000 },
  { status: 'ret', fee: 0, other: 0 }
]);
assert.deepEqual(JSON.parse(JSON.stringify(costs)), {
  feeAmount: 1500,
  otherAmount: 350,
  totalAmount: 1850,
  affectedCount: 2,
  missingOtherDescriptionCount: 1
});

const sidebar = d.getSidebarFinancialMetrics([
  { status: 'new', deposit: '10,000', demolish: 2000, fee: 500, other: 250, depReturn: 'No', demoReturn: 'No' },
  { status: 'done', deposit: 5000, demolish: 3000, fee: 100, depReturn: 'Yes', demoReturn: 'Yes' },
  { status: 'Cancel', deposit: 9000, demolish: 9000, fee: 9000, other: 9000, depReturn: 'No', demoReturn: 'No' }
]);
assert.deepEqual(JSON.parse(JSON.stringify(sidebar)), {
  totalPaymentAmount: 20850,
  installationOutstandingAmount: 10000,
  removalOutstandingAmount: 2000,
  totalOutstandingAmount: 12000
});

const listKpis = d.getListPageKpiMetrics([
  { workflowKey: 'tl_process', status: 'On Process', deposit: '10,000', demolish: 1000, fee: 500 },
  { workflowKey: 'refund_process', status: 'On Process', deposit: 5000, demolish: 2000, other: 250 },
  { workflowKey: 'on_service', status: 'done', deposit: 3000, demolish: 4000, depReturn: 'Yes', demoReturn: 'No' },
  { workflowKey: 'done', status: 'done', deposit: 2000, demolish: 500, depReturn: 'Yes', demoReturn: 'Yes' },
  { workflowKey: 'cancel', status: 'Cancel', deposit: 9000, demolish: 9000, fee: 9000 }
], {
  statusResolver: item => item.workflowKey
});
assert.deepEqual(JSON.parse(JSON.stringify(listKpis)), {
  totalCount: 5,
  activeWorkCount: 2,
  completedCount: 1,
  nonRefundableCostAmount: 750,
  feeAmount: 500,
  otherAmount: 250,
  installationDepositAmount: 20000,
  onServiceRemovalAmount: 4000
});

assert.equal(d.getListPageKpiMetrics([
  { workflowKey: 'new', status: 'new' },
  { workflowKey: 'off_service_pending', status: 'done' },
  { workflowKey: 'on_service', status: 'done' },
  { workflowKey: 'done', status: 'done' },
  { workflowKey: 'cancel', status: 'Cancel' }
], {
  statusResolver: item => item.workflowKey
}).activeWorkCount, 2);

assert.equal(d.parseDateValue('09/09/2569 09:00:00').getFullYear(), 2026);
assert.equal(d.daysBetween('2026-09-01', '2026-09-10'), 9);

const smartQueue = d.getSmartWorkQueue([
  {
    id: 'urgent-fin', status: 'fin', place: 'อาคารทดสอบ', deposit: 80000,
    depReturn: 'No', dateReq: '2026-08-20', dateDue: '2026-09-01',
    updatedAt: '2026-08-29T09:00:00+07:00'
  },
  {
    id: 'inconsistent-done', status: 'done', deposit: 10000,
    depReturn: 'No', dateReq: '2026-09-08', dateDue: '2026-09-20',
    updatedAt: '2026-09-09T09:00:00+07:00'
  },
  {
    id: 'complete', status: 'done', deposit: 5000,
    depReturn: 'Yes', dateReq: '2026-09-01', dateDue: '2026-09-05',
    updatedAt: '2026-09-06T09:00:00+07:00'
  },
  {
    id: 'active-on-service', status: 'done', demolish: 25000, demoReturn: 'No',
    depReturn: 'Yes', dateReq: '2026-01-01', updatedAt: '2026-01-01'
  },
  {
    id: 'off-service-pending', status: 'done', demolish: 25000, demoReturn: 'No',
    depReturn: 'Yes', service_cancel_date: '2026-09-08', off_service_status: 'pending',
    dateReq: '2026-01-01', updatedAt: '2026-09-08'
  }
], { now: '2026-09-10T12:00:00+07:00' });
assert.equal(smartQueue.length, 3);
assert.equal(smartQueue[0].item.id, 'urgent-fin');
assert.equal(smartQueue[0].priority, 'high');
assert.equal(smartQueue[0].overdueDays, 9);
assert.ok(smartQueue[0].reasons.some(reason => reason.includes('เกินกำหนด 9 วัน')));
assert.ok(smartQueue.find(entry => entry.item.id === 'inconsistent-done').consistencyIssues.length > 0);
assert.equal(smartQueue.some(entry => entry.item.id === 'active-on-service'), false);
assert.ok(smartQueue.find(entry => entry.item.id === 'off-service-pending').missingDocuments.includes('หลักฐาน Off Service'));

const notifications = d.getActionNotifications([
  {
    id: 'due-today', status: 'fin', place: '<อาคารทดสอบ>', deposit: 50000,
    dateReq: '2026-09-01', dateDue: '2026-09-10', updatedAt: '2026-09-09'
  },
  {
    id: 'active-on-service', status: 'done', place: 'ลูกค้ายังใช้งาน', demolish: 90000,
    demoReturn: 'No', depReturn: 'Yes', dateReq: '2025-01-01', updatedAt: '2025-01-01'
  },
  {
    id: 'off-service-pending', status: 'done', place: 'ลูกค้ายกเลิกแล้ว', demolish: 10000,
    demoReturn: 'No', depReturn: 'Yes', service_cancel_date: '2026-09-09',
    off_service_status: 'pending', updatedAt: '2026-09-09'
  }
], { now: '2026-09-10T12:00:00+07:00' });
assert.equal(notifications.length, 2);
assert.equal(notifications.some(item => item.taskId === 'active-on-service'), false);
assert.equal(notifications.find(item => item.taskId === 'due-today').type, 'due-soon');
assert.match(notifications.find(item => item.taskId === 'due-today').title, /ครบกำหนดวันนี้/);
assert.equal(notifications.find(item => item.taskId === 'off-service-pending').type, 'off-service');
assert.equal(new Set(notifications.map(item => item.taskId)).size, notifications.length);

const tlNotifications = d.getActionNotifications([
  {
    id: 'tl-new', status: 'tl', workflowKey: 'tl_wait', place: 'อาคาร TL', deposit: 1000,
    dateReq: '2026-09-09', dateDue: '2026-09-30', tl_due_date: '2026-09-12', updatedAt: '2026-09-09'
  }
], {
  now: '2026-09-10T12:00:00+07:00',
  recipientRole: 'tl',
  statusResolver: item => item.workflowKey
});
assert.equal(tlNotifications.length, 1);
assert.equal(tlNotifications[0].type, 'due-soon');
assert.match(tlNotifications[0].title, /ครบกำหนดใน 2 วัน/);

const analytics = d.getOperationalAnalytics([
  {
    id: 'open', status: 'fin', area: 'BKK 1', place: 'อาคาร A', deposit: 20000,
    depReturn: 'No', dateReq: '2026-08-01', dateDue: '2026-09-01', updatedAt: '2026-09-05'
  },
  {
    id: 'returned', status: 'done', area: 'BKK 1', place: 'อาคาร A', deposit: 10000,
    depReturn: 'Yes', dateReq: '2026-08-01', date_return: '2026-08-11', updatedAt: '2026-08-11'
  },
  {
    id: 'cancelled', status: 'Cancel', area: 'BKK 2', deposit: 99999,
    dateReq: '2026-09-01', dateDue: '2026-09-02'
  },
  {
    id: 'active-on-service', status: 'done', area: 'BKK 3', demolish: 90000,
    demoReturn: 'No', depReturn: 'Yes', dateReq: '2025-01-01', dateDue: '2025-01-02', updatedAt: '2025-01-01'
  }
], { now: '2026-09-10T12:00:00+07:00' });
assert.equal(analytics.overdueCount, 1);
assert.equal(analytics.overdueRiskAmount, 20000);
assert.equal(analytics.bottleneck.label, 'fin');
assert.equal(analytics.refundByArea[0].averageDays, 10);
assert.equal(analytics.accuracy.dueDateCoveragePct, 100);
assert.equal(analytics.accuracy.openCount, 1);
assert.equal(analytics.queue.some(entry => entry.item.id === 'active-on-service'), false);

console.log('PASS deposit domain rules and financial metrics');
