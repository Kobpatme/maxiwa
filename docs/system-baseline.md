# Deposit Manager — System Baseline

วันที่สำรวจ: 9 กันยายน 2026  
ขอบเขตหลักฐาน: source code ใน workspace และ local fixture เท่านั้น ไม่ได้อ่านข้อมูลจริงหรือ Firebase Console

## วิธีรันที่ตรวจพบ

- ระบบเป็น static HTML/CSS/JavaScript ใช้ Firebase compat SDK 10.7.1 จาก CDN
- ไม่พบ `package.json`, `firebase.json`, `.firebaserc`, `wrangler.toml` หรือ hosting configuration ที่ source root
- มี artifact ชั่วคราวของ Wrangler ใน `.wrangler/tmp` แต่ยังใช้ยืนยันวิธี deploy จริงไม่ได้
- รัน local fixture ด้วย `node tools/local-server.mjs` แล้วเปิด `http://127.0.0.1:4173/index.html?mock=1&user=admin001`
- บัญชี fixture: `admin001`, `user001`, `tl001`; fixture auto-login ผ่าน query `user` และไม่ใช้บัญชีจริง
- ตรวจ fixture แบบไม่เปิด browser ด้วย `node scripts/baseline-check.mjs`

## แผนผังหน้าและจุดบันทึก

| หน้า/ส่วน | หน้าที่ | จุดอ่าน/เขียนสำคัญ |
|---|---|---|
| Login / Forgot password | เข้าระบบและรีเซ็ตรหัสผ่าน | `validateUserWithPassword`, `validateUser`, `verifyAndResetPassword`, `updateUser` |
| My Dashboard | KPI และงานของผู้ใช้ | อ่าน `DB`; กรองใน browser |
| รายการทั้งหมด / เสร็จแล้ว | ตาราง ค้นหา กรอง แบ่งหน้า | `getDeposits`, `updateDeposit`, `deleteDeposit`, export CSV |
| ฟอร์ม 6 ขั้น | สร้าง/แก้รายการและแนบเอกสาร | `insertDeposit`, `updateDeposit`, `uploadFile`, `deleteFileFromUrl` |
| TL tasks | รับงาน ส่งกลับ แนบหลักฐาน | `updateDeposit`, `uploadFile` |
| Active removal deposit | ติดตาม On Service / Off Service | `updateDeposit`, `uploadFile` |
| Executive Dashboard | KPI และกราฟ | อ่านข้อมูล role-allowed ใน `DB` |
| User management | เพิ่ม แก้ ลบผู้ใช้และสิทธิ์ | `getUsers`, `addUser`, `updateUser`, `removeUser` |

Data flow ปัจจุบัน: Firebase snapshot → debounce → `initApp()` → get deposits ทั้ง collection และ get users ทั้ง collection → render. เมื่อโหลดผิดพลาด `initApp()` ตั้ง `DB=[]` จึงยังแยก “ไม่มีข้อมูล” จาก “โหลดไม่ได้” ไม่ได้

## โครงสร้างข้อมูลที่พบ

### deposits

- ตัวระบุ: Firestore document ID (`id_firestore`) และ legacy `id` ซึ่งอาจเป็นเลขหรือ string
- workflow: `status`, `status_final`, `complete`, `complete_tl`, `return_status`, `inspected_by`
- งาน/พื้นที่: `owner`, `area`, `tl_team`, `place`, `customer`, `cid`, `pr`
- เงิน: `deposit`, `demolish`, `fee`, `other`, `total`, `depReturn`, `demoReturn`
- วันที่: `dateReq`, `dateDue`, `dateAcc`, `date_return`, `tl_accept_date`, `tl_complete_date`, `tl_due_date`, `install_date`
- เอกสาร: `pdf_payment`, `pdf_layout`, `pdf_additional`, `pdf_tl_work`, `pdf_tl_extra`, `pdf_user_final`, `pdf_demo_off`
- ประวัติ/ยกเลิก: `log[]`, `cancel_reason`, `canceled_by`, `canceled_at`, `final_remark`

ยังไม่พบ schema enforcement, version, trusted updatedBy, operation ID, audit collection หรือ soft-delete fields ใน source ปัจจุบัน

### users

- `employee_id`, `name`, `email`, `password`, `role`, `area`, `can_see_tl`, `can_see_dashboard`, `last_session_id`
- หน้าเว็บโหลด users ทั้ง collection และใช้ข้อมูลนี้ทั้ง login, owner list และ admin table

## Permission matrix ที่โค้ดหน้าเว็บใช้จริง

ตารางนี้บันทึก UI behavior ไม่ใช่ฐานสิทธิ์ที่เชื่อถือได้ เพราะยังไม่เห็น deployed Rules

| ความสามารถ | admin | user | tl | เงื่อนไขเสริม/ข้อสังเกต |
|---|---:|---:|---:|---|
| My Dashboard / รายการ / รายการเสร็จ | ✓ | ✓ | ซ่อน | `user` เห็น `DB` ทั้งหมดใน `getFilteredData`; ยังไม่กรอง owner/team |
| TL tasks | ✓ | เมื่อ `can_see_tl` | ✓ | `tl` ถูกกรองด้วยรายการพื้นที่ใน `area`; admin เห็นทั้งหมด |
| Executive Dashboard | ✓ | เมื่อ `can_see_dashboard` | เมื่อ `can_see_dashboard` | UI visibility เท่านั้น |
| Active removal deposit | ✓ | ✓ | ✓ | `tl` ถูกกรองพื้นที่ใน renderer |
| เพิ่ม/แก้รายการ | ✓ | ✓ | ปุ่มซ่อน | call API ตรงยังต้อง Rules ป้องกัน |
| ลบรายการถาวร | ✓ | ไม่ | ไม่ | ตรวจ `CURRENT_USER.role` ใน browser เท่านั้น |
| จัดการผู้ใช้/role | ✓ | ไม่ | ไม่ | admin nav ซ่อนด้วย browser; data access layer ไม่มี trusted admin gate |
| อ่านรายชื่อ users | UI admin แต่ `initApp` เรียกทุก role | เช่นเดียวกัน | เช่นเดียวกัน | เสี่ยงเปิดข้อมูลบัญชีเกินจำเป็น |
| เข้าถึงงานข้ามทีม | UI อนุญาต | UI อนุญาต | ปฏิเสธเฉพาะ area mismatch | พฤติกรรมธุรกิจที่ถูกต้องยังต้องยืนยัน |

สิทธิ์ที่ยังต้องยืนยันกับเจ้าของนโยบาย: user ควรเห็นทุกงานหรือเฉพาะ owner/team, ความหมาย `can_see_tl` สำหรับการแก้ไข, ขอบเขต admin ต่อพื้นที่, ใครยกเลิก/คืนรายการได้ และสิทธิ์อ่านไฟล์ที่แชร์ด้วย download-token URL

## Workflow transition baseline

| สถานะเดิม | คำสั่ง/เงื่อนไขในโค้ด | บทบาทที่ UI เปิดทาง | ข้อมูล/เอกสารบังคับที่พบ | สถานะใหม่ |
|---|---|---|---|---|
| ไม่มีรายการ | บันทึก Step 1 | admin/user | อาคาร, owner; ฟิลด์ทั่วไป | `new` หรือสถานะที่ logic คำนวณ |
| `new` | ยืนยันข้อมูลการเงิน/PR | admin/user | PR/ข้อมูลการเงินตาม validation ใน `submitForm` | `fin` |
| `fin` | ยืนยันการชำระ/ไปแนบหลักฐาน | admin/user | ข้อมูลจ่ายเงิน | `att` |
| `att` | แนบหลักฐานและเลือกทีม TL | admin/user | หลักฐาน/ทีมตาม validation | `tl` |
| `tl` + Pending | TL รับงาน | tl/admin ผ่าน TL UI | สถานะต้องยังเป็น `tl` | `On Process`, `complete_tl=On Process` |
| `tl` + Pending | ส่งกลับก่อนรับ | tl | เหตุผล | `att`, ล้าง `tl_team` |
| `On Process` | TL เสร็จงาน | tl/admin ผ่าน TL UI | ถ้า TL ตรวจ: หลักฐานหลักและวันที่; ถ้า Building Dept ตรวจ: ไม่บังคับหลักฐาน TL | `ret` |
| `ret` | user ส่งกลับ TL | non-TL detail/form | เหตุผล | `tl`, `complete_tl=Pending` |
| `ret` | ยืนยันการคืน/ตรวจรับ | admin/user | `return_status`; เอกสารปิดงานบังคับเมื่อ TL ตรวจ แต่ optional เมื่อ Building Dept ตรวจ | `clo`/`done` ตาม branch |
| `clo` | แนบหลักฐานปิดงาน | admin/user | `pdf_user_final` ตามผู้ตรวจรับ | `done` |
| สถานะที่ไม่ใช่ cancel/done | ไม่มีเงินประกันติดตั้งและรื้อถอน | admin/user ใน `submitForm` | มีเฉพาะค่าใช้จ่ายได้; หลังผ่านอย่างน้อย Step 2 | `done` อัตโนมัติ |
| สถานะใช้งาน | ยกเลิก | UI รายการ | เหตุผล | `Cancel`; เก็บผู้ยกเลิก เวลา log และหมายเหตุ |
| On Service | แนบหลักฐาน Off Service | ผู้ที่เข้าถึง detail | PDF หลักฐาน Off Service | `done` |
| ใด ๆ | ลบถาวร | admin UI | confirm browser | document ถูกลบถาวร |

จุดที่ยังต้องยืนยัน: transition ที่แน่นอนของ Step 1–3 ทุก branch, นิยาม `clo` เทียบ `done`, ผู้มีสิทธิ์ยกเลิก, Building Dept ปิดงานได้ทันทีหรือไม่ และกฎยอดคงค้าง/SLA

## Local fixture coverage และ safety

`mock-data.js` มีข้อมูลสังเคราะห์ 3 บทบาทและ 10 กรณี: new, finance, attach, TL waiting, TL in process, return, close, done, ไม่มีเงินประกัน/มีเฉพาะค่าใช้จ่าย, cancel และ Building Dept inspection

มาตรการไม่แตะ production เมื่อ `?mock=1`:

- ไม่ attach Firestore realtime listeners
- `initApp` อ่านเฉพาะ deep copy ของ fixture
- data-access write APIs ทั้งหมดมี guard และ throw ก่อน Firebase call
- URL/file ใน fixture ใช้โดเมน `.invalid`; ไม่มีข้อมูลจริงหรือ PII

## Known / unknown

ทราบจาก source: Firebase project web config, SDK versions, client-side auth/session, UI permission branches, write call sites, workflow labels และ data fields ข้างต้น

ยังไม่ทราบและยังไม่ได้อ้างว่าตรวจแล้ว: deployed Firestore/Storage Rules, Firebase Auth users, indexes, production hosting, backup, data volume, actual read counts, download-token exposure, business policy ที่ยืนยันแล้ว และ production behavior

