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
  { status: 'done', demolish: 2000, demoReturn: 'Yes' },
  { status: 'ret', demolish: 3000, demoReturn: 'No' },
  { status: 'Cancel', demolish: 4000, demoReturn: 'No' }
]);
assert.deepEqual(JSON.parse(JSON.stringify(metrics)), {
  totalAmount: 6000, totalCount: 3,
  refundedAmount: 2000, refundedCount: 1,
  outstandingAmount: 4000, outstandingCount: 2,
  onServiceAmount: 1000, onServiceCount: 1,
  preServiceAmount: 3000, preServiceCount: 1
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

console.log('PASS removal-deposit domain rules and metrics');
