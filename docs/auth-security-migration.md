# Authentication and authorization migration

สถานะเอกสาร: staging/local design เท่านั้น ห้าม deploy Rules หรือเปิด `DEPOSIT_AUTH_MODE = "firebase"` ใน production ก่อนผ่าน checklist ช่วง Cutover

## Target identity model

- Firebase Authentication เป็นแหล่งยืนยันตัวตน และใช้ UID เป็น document ID ของ `user_profiles/{uid}`
- `user_profiles` เก็บ `employee_id`, `name`, `email`, `role`, `area`, flags และ `active`; ไม่มี password
- `staff_directory` เก็บเฉพาะข้อมูลที่ผู้ใช้ซึ่งล็อกอินแล้วต้องใช้เลือกเจ้าของงาน เช่น UID, employee ID, ชื่อ และสถานะ active
- การสร้าง Auth account, เปลี่ยน role/area/active และเขียน audit log ต้องทำผ่าน trusted admin backend ที่ตรวจ admin claim/profile ไม่ใช่ JavaScript ใน browser
- deposit ใหม่ต้องมี `owner_uid`, `tl_area`, `version`, `created_at`, `updated_at`, `updated_by`

## Login decision

Firebase Email/Password รับอีเมล ไม่รับ employee ID โดยตรง และหน้า login ที่ยังไม่ยืนยันตัวตนไม่ควรอ่าน directory เพื่อแปลง employee ID เป็นอีเมล การเปิด secure mode ระยะแรกจึงเปลี่ยนช่อง login เป็นอีเมลบริษัท ส่วน `employee_id` ยังคงแสดงและใช้ในกระบวนงาน

หากต้องคง employee-ID login ในระยะถัดไป ให้สร้าง HTTPS/Callable endpoint สำหรับ resolve employee ID ที่มี rate limit, App Check และคำตอบแบบไม่เปิดเผยว่าบัญชีใดมีอยู่ ห้ามเปิด collection mapping ให้ unauthenticated client อ่าน

## Dry run

เตรียม JSON export สองชุดในเครื่องที่ได้รับอนุญาต แล้วรัน:

```powershell
node scripts/auth-migration-dry-run.mjs legacy-users.json firebase-auth-users.json
```

สคริปต์จับคู่ด้วย normalized email, ตรวจ employee ID/email ซ้ำหรือขาด และสร้าง path เป้าหมายจาก UID แบบ idempotent รายงานเพียงจำนวนฟิลด์ password ที่พบ ไม่พิมพ์ค่ารหัสผ่าน

ตัวอย่างสังเคราะห์:

```powershell
node scripts/auth-migration-dry-run.mjs tests/fixtures/auth-migration/legacy-users.json tests/fixtures/auth-migration/firebase-auth-users.json
```

## Query contract for Rules

- admin: อ่าน `deposits` ตาม filter ธุรกิจได้ทั้งหมด
- user: query ต้องมี `where('owner_uid', '==', auth.uid)`
- TL: หลังโหลด profile ของตนแล้ว query ต้องมี `where('tl_area', '==', profile.area)`
- ห้ามเรียก `get()` ทั้ง collection แล้วหวังให้ Rules กรองผลลัพธ์ เพราะ Firestore Rules ประเมิน query ว่ามีโอกาสคืนเอกสารที่ไม่มีสิทธิ์หรือไม่

นโยบายที่ต้องมีเจ้าของระบบยืนยันก่อนเปิดใช้: ผู้ใช้ทั่วไปเห็นเฉพาะงานตนหรือทั้งฝ่าย, TL หลายพื้นที่แทนค่าเดียวอย่างไร, ฟิลด์สถานะใดที่แต่ละบทบาทเปลี่ยนได้ และผู้ใดอนุมัติ soft delete

## Storage migration

Rules เป้าหมายรองรับเฉพาะ `deposits/{depositId}/{category}/{fileName}` และตรวจสิทธิ์จาก deposit เดียวกัน ไฟล์ flat path เดิม (`payments/`, `layouts/`, `tl_works/` ฯลฯ) จะถูกปฏิเสธ

ก่อนย้ายต้อง inventory URL เดิมและ download token ที่เคยแชร์ เพราะ URL ที่มี token อาจเข้าถึงได้โดยไม่ผ่านการล็อกอินจนกว่าจะ revoke token/แทนที่ metadata จากนั้น copy ไฟล์, ตรวจ hash/count, เปลี่ยน reference ใน transaction และเก็บ rollback map ห้ามลบไฟล์ต้นทางในรอบแรก

## Cutover checklist

1. เปิด Email/Password ใน staging และเปิด email-enumeration protection
2. สร้างบัญชี Auth ทดสอบ admin/user/TL และ profile UID ที่ active
3. รัน dry-run จน `blocked = 0`; ห้ามนำ password เดิมเข้า Auth ให้ส่ง password-reset link
4. เติม `owner_uid`, `tl_area`, version/audit fields ใน deposit staging และตรวจยอดก่อน/หลัง
5. ย้ายไฟล์ staging ไป path ใหม่และตรวจทุกลิงก์
6. รัน `npm run test:all` และทดสอบ browser ครบสามบทบาท
7. deploy Auth accounts/profile/backend, Rules และหน้าเว็บใน maintenance window เดียวกัน
8. ทดสอบบัญชี admin ฉุกเฉินก่อนเปิดระบบ และเก็บ rollback ของ hosting/Rules/profile mapping
9. หลังยืนยันแล้วจึง quarantine/delete password field ตามนโยบาย retention ที่อนุมัติ

ห้ามแก้ Rules เป็น public เพื่อแก้ปัญหา cutover และห้ามย้อนกลับไปใช้ plaintext password
