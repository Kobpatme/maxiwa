# Deposit Manager — Test Report

วันที่: 9 กันยายน 2026  
สภาพแวดล้อม: local workspace, synthetic fixture only, timezone Asia/Bangkok

## P0 baseline

| การตรวจ | คำสั่ง/วิธี | ผล |
|---|---|---|
| ตรวจการแก้ค้าง | `git status --short` | ผ่าน: พบไฟล์ untracked เดิมหลายรายการใน `deliverables/` และ `.codex-tmp-exec-deck/`; ไม่แก้หรือทับไฟล์เหล่านั้น |
| ตรวจคำสั่ง repository | ตรวจ `AGENTS.md` และ `.agents/` | ผ่าน: ไม่พบไฟล์คำสั่งใน workspace |
| ตรวจวิธีรัน/deploy | ตรวจ root config และ tracked files | ผ่านแบบมีข้อจำกัด: เป็น static app; ไม่พบ source-level hosting config จึงยังยืนยันวิธี deploy ไม่ได้ |
| Static fixture safety | `node scripts/baseline-check.mjs` | ผ่าน: 3 roles, 10 cases; listener ถูกปิดและ Firebase write APIs มี guard ครบ |
| JavaScript syntax | `node --check mock-data.js`, `node --check firebase-client.js`, `node --check tools/local-server.mjs`, `node --check scripts/baseline-check.mjs` | ผ่านทั้งหมด |
| Syntax/diff | `git diff --check` | ผ่าน; มีเพียงคำเตือน line-ending LF/CRLF ของ Git บน Windows |
| Desktop visual | Chrome local fixture, admin, 1440×900 | ผ่านการ render; พบรายการสังเคราะห์ 10 รายการและ KPI ตรง fixture |
| Mobile visual 390×844 | Chrome local fixture, admin/TL | render ได้ แต่พบ layout ถูกตัด/บีบด้านขวาและ action/filter ล้นพื้นที่ เป็น baseline defect สำหรับ P4 |
| Browser smoke | Chrome tab ใหม่, admin และ TL fixture | ผ่าน: admin แสดง 10 แถว/KPI ตาม fixture; TL เปิด `page-tl-tasks`; ไม่พบ console error ในรอบตรวจสุดท้าย |
| Firebase Emulator | `npm run test:rules` | ผ่าน 12/12: unauthenticated, owner, admin, query constraint, TL ข้ามพื้นที่, privilege escalation, protected fields, PDF/file path และ cross-team file access |

## ข้อจำกัดและสิ่งที่ยังไม่ยืนยัน

- ผลรายงานนี้ไม่ใช่การทดสอบ production และไม่ได้อ่านข้อมูลจริง
- ยังไม่ได้ตรวจ Firebase Console, deployed Rules, Authentication accounts, Storage objects หรือ backup
- browser smoke ใน P0 ตรวจการ render จาก fixture; ยังไม่ใช่ workflow regression test เต็มรูปแบบ

## P1 Authentication and authorization staging

| การตรวจ | คำสั่ง/วิธี | ผล |
|---|---|---|
| Secure Auth adapter | `node scripts/baseline-check.mjs` + syntax check | ผ่าน: Auth state/UID profile, email-password sign-in, sign-out และ provider reset link ถูกเตรียมหลัง feature gate; legacy เป็นค่าเริ่มต้นจนกว่าจะ cutover |
| Plaintext path isolation | static integration | ผ่านใน secure mode: query password, session lookup, bulk legacy user read และ browser account/role mutation ถูกปฏิเสธ |
| Migration dry-run | `node --test scripts/auth-migration-dry-run.test.mjs` | ผ่าน 2/2: จับคู่ UID แบบ idempotent, ตรวจ duplicate/missing และไม่แสดงค่ารหัสผ่าน |
| Firestore/Storage Rules | `npm run test:rules` | ผ่าน 12/12 บน Emulator รวม constrained/unconstrained list query โดย test runner รองรับ workspace path ภาษาไทยผ่าน temporary ASCII path |
| Production dependency audit | `npm audit --omit=dev` | ผ่าน: 0 ช่องโหว่ production dependency |
| Dev tool audit | `npm audit` | ยังมี 10 รายการใน Firebase CLI/test dependency (8 moderate, 1 high, 1 critical); `npm audit fix` แบบไม่ breaking ลดแล้ว และไม่ใช้ `--force` ที่จะ downgrade CLI แบบ breaking |
| Production cutover/deploy | ไม่ได้ดำเนินการ | ถูกต้องตามแผน: ยังไม่แก้ Auth accounts, Rules, database หรือ Storage production |

## Removal deposit / On Service consistency

| การตรวจ | คำสั่ง/วิธี | ผล |
|---|---|---|
| Domain regression | `node scripts/domain-logic.test.mjs` | ผ่าน: done/unreturned, returned, Building Dept, closing document, cancel, pre-close และ money normalization |
| Shared calculations | static inspection + domain test | ผ่าน: หน้า On Service, KPI, My Dashboard, Executive Dashboard, TL KPI และยอดคงค้างตามพื้นที่ใช้กฎกลาง |
| Production data migration | ไม่ได้ดำเนินการ | ยังไม่แก้ข้อมูลจริง; legacy values ถูก normalize ตอนอ่าน |
| Visual verification | Chrome headless, fixture, 1440×900 และ 390×844 | Desktop ผ่าน: Building Dept/`clo` แสดง 1 งาน ยอดคงค้าง ฿4,000 พร้อม owner/วันที่; mobile ยังต้องเลื่อนตารางแนวนอนและอยู่ในขอบเขต P4 |
| Workflow ordering | `node scripts/domain-logic.test.mjs` + static integration check | ผ่าน: รายการหลักและรายการ TL เรียงงานกำลังทำ → On Service → เสร็จสมบูรณ์; การเรียง NO. ทำงานภายในแต่ละกลุ่ม |
| Dashboard ↔ On Service reconciliation | shared removal metrics + visual fixture | ผ่าน: การ์ด Executive Dashboard ใช้ `onServiceAmount/onServiceCount` ตรงกับหน้ารายการ และแสดงยอดที่ยังไม่เข้า On Service แยกต่างหาก |
| Removal page separation | domain regression + static integration + visual fixture | ผ่าน: หน้า “มีประกันรื้อถอน” แยกตาราง On Service ออกจากรายการที่ยังดำเนินงาน; ตารางหลังไม่มีปุ่ม Off Service |
| Non-refundable cost breakdown | `node scripts/domain-logic.test.mjs` + static integration + visual fixture | ตรวจยอด fee/other/รวม, ตัด cancel, แจ้ง other ที่ไม่มีคำอธิบาย และเปิดรายละเอียดด้วย mouse/keyboard |

## ภาพ baseline

- `admin-desktop-1440x900.png`
- `admin-mobile-390x844.png`
- `tl-mobile-390x844.png`

ภาพทั้งหมดสร้างจาก local fixture ไม่มีข้อมูลจริง ภาพ TL รอบแรกพบ fixture log ขาด `title`; แก้ fixture แล้วจับภาพซ้ำจนไม่มี toast error

ภาพหลังปรับกฎ On Service อยู่ใน `docs/after-screenshots/`
