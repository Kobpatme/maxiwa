/* Synthetic local-only baseline data. Contains no production or personal data. */
(function () {
  const now = '2026-09-09T09:00:00+07:00';
  const log = action => [{ time: '09/09/2569 09:00:00', user: 'ผู้ใช้ทดสอบ', title: action, action, type: 'FIXTURE' }];

  window.DEPOSIT_MOCK_USERS = {
    admin001: {
      id: 'fixture-admin', employee_id: 'admin001', password: 'demo',
      name: 'ผู้ดูแลทดสอบ', email: 'admin@example.invalid', role: 'admin',
      area: 'BKK 1,BKK 4,CMI', can_see_tl: true, can_see_dashboard: true
    },
    user001: {
      id: 'fixture-user', employee_id: 'user001', password: 'demo',
      name: 'เจ้าของงานทดสอบ', email: 'user@example.invalid', role: 'user',
      area: 'BKK 1', can_see_tl: false, can_see_dashboard: false
    },
    tl001: {
      id: 'fixture-tl', employee_id: 'tl001', password: 'demo',
      name: 'ทีแอลทดสอบ', email: 'tl@example.invalid', role: 'tl',
      area: 'BKK 1,BKK 4', can_see_tl: true, can_see_dashboard: false
    }
  };

  const base = {
    customer: 'บริษัทตัวอย่าง จำกัด', owner: 'เจ้าของงานทดสอบ', contact: 'ผู้ประสานงานทดสอบ',
    tel: '0000000000', mobile: '0000000000', payTo: 'นิติบุคคลตัวอย่าง',
    dateReq: '2026-09-01', dateDue: '2026-09-15', dateAcc: '', payType: 'โอนเงิน',
    depStatus: 'Pending', demoStatus: 'Pending', complete: 'Pending', complete_tl: 'Pending',
    depReturn: 'No', demoReturn: 'No', fee: 500, other: 0, createdAt: now
  };

  window.DEPOSIT_MOCK_CASES = [
    { ...base, id: 1001, id_firestore: 'fixture-new', status: 'new', place: 'อาคารตัวอย่าง A', area: 'BKK 1', cid: 'FIX-001', pr: '', deposit: 10000, demolish: 5000, total: 15500, log: log('สร้างรายการ') },
    { ...base, id: 1002, id_firestore: 'fixture-fin', status: 'fin', place: 'อาคารตัวอย่าง B', area: 'BKK 4', cid: 'FIX-002', pr: 'PR-002', deposit: 20000, demolish: 0, total: 20500, dateReq: '2026-08-01', dateDue: '2026-08-20', createdAt: '2026-08-01T09:00:00+07:00', log: [{ time: '01/08/2569 09:00:00', user: 'ผู้ใช้ทดสอบ', title: 'ส่งให้ทีมการเงิน', action: 'ส่งให้ทีมการเงิน', type: 'FIXTURE' }] },
    { ...base, id: 1003, id_firestore: 'fixture-att', status: 'att', place: 'อาคารตัวอย่าง C', area: 'CMI', cid: 'FIX-003', pr: 'PR-003', deposit: 0, demolish: 8000, total: 8500, dateDue: '', log: log('รอแนบเอกสาร') },
    { ...base, id: 1004, id_firestore: 'fixture-tl-wait', status: 'tl', place: 'อาคารตัวอย่าง D', area: 'BKK 1', cid: 'FIX-004', pr: 'PR-004', deposit: 12000, demolish: 3000, total: 15500, tl_team: 'BKK', pdf_payment: 'https://example.invalid/payment.pdf', log: log('ส่งให้ TL') },
    { ...base, id: 1005, id_firestore: 'fixture-tl-process', status: 'On Process', place: 'อาคารตัวอย่าง E', area: 'BKK 4', cid: 'FIX-005', pr: 'PR-005', deposit: 9000, demolish: 1000, total: 10500, tl_team: 'BKK', complete_tl: 'On Process', pdf_payment: 'https://example.invalid/payment.pdf', log: log('TL รับงาน') },
    { ...base, id: 1006, id_firestore: 'fixture-ret', status: 'ret', place: 'อาคารตัวอย่าง F', area: 'BKK 1', cid: 'FIX-006', pr: 'PR-006', deposit: 15000, demolish: 0, total: 15500, tl_team: 'BKK', complete: 'Complete', complete_tl: 'On Process', pdf_tl_work: 'https://example.invalid/tl.pdf', return_status: 'Pending', log: log('TL ส่งตรวจรับ') },
    { ...base, id: 1007, id_firestore: 'fixture-clo', status: 'clo', place: 'อาคารตัวอย่าง G', area: 'CMI', cid: 'FIX-007', pr: 'PR-007', deposit: 5000, demolish: 4000, total: 9500, complete: 'Complete', return_status: 'Done', inspected_by: 'Building Dept', install_date: '2026-09-08', log: log('ฝ่ายอาคารตรวจรับ') },
    { ...base, id: 1008, id_firestore: 'fixture-done', status: 'done', status_final: 'done', place: 'อาคารตัวอย่าง H', area: 'BKK 4', cid: 'FIX-008', pr: 'PR-008', deposit: 7000, demolish: 2000, total: 9500, complete: 'Complete', return_status: 'Done', depReturn: 'Yes', demoReturn: 'Yes', install_date: '2026-09-05', pdf_user_final: 'https://example.invalid/final.pdf', log: log('ปิดงาน') },
    { ...base, id: 1009, id_firestore: 'fixture-no-deposit', status: 'done', status_final: 'done', place: 'อาคารตัวอย่าง ไม่มีเงินประกัน', area: 'BKK 1', cid: 'FIX-009', pr: 'PR-009', deposit: 0, demolish: 0, fee: 750, total: 750, complete: 'Complete', return_status: 'Done', log: log('ปิดอัตโนมัติ: ไม่มีเงินประกัน') },
    { ...base, id: 1010, id_firestore: 'fixture-cancel', status: 'Cancel', status_final: 'Cancel', place: 'อาคารตัวอย่าง ยกเลิก', area: 'BKK 4', cid: 'FIX-010', pr: 'PR-010', deposit: 6000, demolish: 0, total: 6500, cancel_reason: 'ข้อมูลสังเคราะห์สำหรับทดสอบ', canceled_by: 'ผู้ดูแลทดสอบ', canceled_at: now, log: log('ยกเลิกรายการ') }
  ];
})();
