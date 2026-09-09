/* firebase-client.js */

// Initialize Firebase App
if (firebase.apps.length === 0) {
    firebase.initializeApp(FIREBASE_CONFIG);
}

const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

function isFirebaseAuthEnabled() {
    return !window.DEPOSIT_LOCAL_FIXTURE && window.DEPOSIT_AUTH_MODE === 'firebase';
}

async function signInWithFirebase(email, password) {
    if (!isFirebaseAuthEnabled()) throw new Error('Firebase Auth mode is not enabled');
    if (!String(email || '').includes('@')) {
        throw new Error('secure-auth-requires-email');
    }
    const credential = await auth.signInWithEmailAndPassword(String(email).trim(), password);
    return getAuthProfile(credential.user.uid);
}

async function getAuthProfile(uid) {
    if (!uid) return null;
    const doc = await db.collection('user_profiles').doc(uid).get();
    if (!doc.exists || doc.data().active !== true) {
        await auth.signOut();
        throw new Error('auth-profile-unavailable');
    }
    return { id: doc.id, uid: doc.id, ...doc.data() };
}

function waitForFirebaseAuthProfile() {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(async user => {
            unsubscribe();
            if (!user) return resolve(null);
            try {
                resolve(await getAuthProfile(user.uid));
            } catch (error) {
                reject(error);
            }
        }, reject);
    });
}

async function sendFirebasePasswordReset(email) {
    if (!isFirebaseAuthEnabled()) throw new Error('Firebase Auth mode is not enabled');
    auth.useDeviceLanguage();
    await auth.sendPasswordResetEmail(String(email || '').trim());
}

async function signOutFirebase() {
    await auth.signOut();
}

async function getStaffDirectory() {
    const snapshot = await db.collection('staff_directory').orderBy('name').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function assertRemoteWriteAllowed(operation) {
    if (window.DEPOSIT_LOCAL_FIXTURE === true) {
        throw new Error(`Local fixture mode blocked Firebase write: ${operation}`);
    }
}

/* ─── DATA: DEPOSITS ─── */

function getDepositsQuery(userProfile) {
    let query = db.collection('deposits');
    if (!isFirebaseAuthEnabled()) return query;
    if (!userProfile?.uid) throw new Error('Authenticated UID profile is required');
    if (userProfile.role === 'admin') return query;
    if (userProfile.role === 'user') return query.where('owner_uid', '==', userProfile.uid);
    if (userProfile.role === 'tl' && userProfile.area) {
        return query.where('tl_area', '==', userProfile.area);
    }
    throw new Error('Profile role/area is not configured for an authorized deposit query');
}

async function getDeposits(userProfile = null) {
    try {
        // Fetch all deposits. We'll handle sorting in memory if needed, 
        // to avoid Firestore filtering out docs that lack the 'id' field.
        const snapshot = await getDepositsQuery(userProfile).get();
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            return { 
                id_firestore: doc.id, 
                id: docData.id || doc.id, // Fallback to doc ID if numeric id is missing
                ...docData 
            };
        });
        
        // Sort: numeric id descending; string id (doc id) by id_firestore for consistency
        return data.sort((a, b) => {
            const aNum = typeof a.id === 'number' ? a.id : null;
            const bNum = typeof b.id === 'number' ? b.id : null;
            if (aNum != null && bNum != null) return bNum - aNum;
            if (aNum != null) return -1;
            if (bNum != null) return 1;
            const aKey = a.id_firestore || String(a.id || '');
            const bKey = b.id_firestore || String(b.id || '');
            return bKey.localeCompare(aKey);
        });
    } catch (error) {
        console.error('Error fetching deposits:', error);
        throw error;
    }
}

async function insertDeposit(depositData) {
    assertRemoteWriteAllowed('insertDeposit');
    try {
        const docRef = await db.collection('deposits').add(depositData);
        // Ensure the returned object has an 'id' field for app compatibility
        const result = { 
            id: depositData.id || docRef.id, 
            id_firestore: docRef.id, 
            ...depositData 
        };
        // Also update the document in Firestore to include the ID if it was auto-generated
        if (!depositData.id) {
            await docRef.update({ id: docRef.id });
        }
        return result;
    } catch (error) {
        console.error('Error inserting deposit:', error);
        throw error;
    }
}

async function updateDeposit(id, depositData) {
    assertRemoteWriteAllowed('updateDeposit');
    if (!id) throw new Error('ID is required for updateDeposit');
    try {
        let docId = String(id);
        if (typeof id === 'number' || (typeof id === 'string' && id !== '' && !isNaN(Number(id)))) {
            const numId = typeof id === 'number' ? id : Number(id);
            const snapshot = await db.collection('deposits').where('id', '==', numId).limit(1).get();
            if (!snapshot.empty) {
                docId = snapshot.docs[0].id;
            } else {
                throw new Error('ไม่พบรายการที่ต้องการแก้ไข (ID ไม่ถูกต้องหรือถูกลบแล้ว)');
            }
        }
        
        await db.collection('deposits').doc(docId).update(depositData);
        return { id: id, ...depositData };
    } catch (error) {
        console.error('Error updating deposit:', error);
        throw error;
    }
}

async function deleteDeposit(id) {
    assertRemoteWriteAllowed('deleteDeposit');
    if (!id) throw new Error('ID is required for deleteDeposit');
    try {
        let docId = String(id);
        if (typeof id === 'number' || (typeof id === 'string' && id !== '' && !isNaN(Number(id)))) {
            const numId = typeof id === 'number' ? id : Number(id);
            const snapshot = await db.collection('deposits').where('id', '==', numId).limit(1).get();
            if (!snapshot.empty) {
                docId = snapshot.docs[0].id;
            } else {
                throw new Error('ไม่พบรายการที่ต้องการลบ (ID ไม่ถูกต้องหรือถูกลบแล้ว)');
            }
        }
        await db.collection('deposits').doc(docId).delete();
        return true;
    } catch (error) {
        console.error('Error deleting deposit:', error);
        throw error;
    }
}

/* ─── STORAGE (File Upload) ─── */

async function uploadFile(file, folder = 'misc') {
    assertRemoteWriteAllowed('uploadFile');
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        const storageRef = storage.ref().child(filePath);
        const snapshot = await storageRef.put(file);
        const publicUrl = await snapshot.ref.getDownloadURL();

        return publicUrl;
    } catch (err) {
        console.error('Error uploading file:', err);
        // แปล Firebase Storage error code เป็นข้อความที่เข้าใจง่าย
        const code = err.code || '';
        if (code === 'storage/unauthorized') {
            throw new Error(`อัปโหลดไม่สำเร็จ: ไม่มีสิทธิ์อัปโหลดไฟล์ไปยัง Firebase Storage (unauthorized) — กรุณาตรวจสอบ Storage Rules`);
        } else if (code === 'storage/quota-exceeded') {
            throw new Error(`อัปโหลดไม่สำเร็จ: พื้นที่จัดเก็บ Firebase Storage เต็มแล้ว (quota-exceeded)`);
        } else if (code === 'storage/network-request-failed') {
            throw new Error(`อัปโหลดไม่สำเร็จ: ปัญหาการเชื่อมต่อเครือข่าย (network-request-failed) — กรุณาตรวจสอบอินเทอร์เน็ต`);
        } else if (code === 'storage/canceled') {
            throw new Error(`อัปโหลดถูกยกเลิก (canceled)`);
        } else if (code === 'storage/unknown') {
            throw new Error(`อัปโหลดไม่สำเร็จ: เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ (unknown) — ${err.message}`);
        } else if (code) {
            throw new Error(`อัปโหลดไม่สำเร็จ [${code}]: ${err.message}`);
        } else {
            throw new Error(`อัปโหลดไม่สำเร็จ: ${err.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'}`);
        }
    }
}

async function deleteFileFromUrl(url) {
    assertRemoteWriteAllowed('deleteFileFromUrl');
    if (!url || typeof url !== 'string') return;
    try {
        // Firebase storage references can be created from URL
        const storageRef = firebase.storage().refFromURL(url);
        await storageRef.delete();
    } catch (err) {
        console.error('Failed to delete file from Firebase Storage:', err);
    }
}

/* ─── USER MANAGEMENT (Auth/Admin) ─── */

async function validateUserWithPassword(employeeId, password) {
    if (isFirebaseAuthEnabled()) throw new Error('Legacy password lookup is disabled in Firebase Auth mode');
    try {
        const snapshot = await db.collection('users')
            .where('employee_id', '==', employeeId)
            .where('password', '==', password)
            .limit(1)
            .get();
        if (snapshot.empty) return null;
        const user = snapshot.docs[0].data();
        return { id: snapshot.docs[0].id, ...user };
    } catch (error) {
        console.error('Login validation error:', error);
        return null;
    }
}

// ใช้สำหรับตรวจ session ที่มีอยู่แล้ว (ไม่เช็กรหัสผ่านซ้ำ)
async function validateUser(employeeId) {
    if (isFirebaseAuthEnabled()) throw new Error('Legacy session lookup is disabled in Firebase Auth mode');
    try {
        const snapshot = await db.collection('users').where('employee_id', '==', employeeId).limit(1).get();
        if (snapshot.empty) return null;
        const user = snapshot.docs[0].data();
        return { id: snapshot.docs[0].id, ...user };
    } catch (error) {
        console.error('Login validation error:', error);
        return null;
    }
}

async function getUsers() {
    if (isFirebaseAuthEnabled()) {
        throw new Error('Bulk legacy account reads are disabled in Firebase Auth mode');
    }
    try {
        const snapshot = await db.collection('users').orderBy('name').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

async function addUser(userData) {
    if (isFirebaseAuthEnabled()) throw new Error('Account creation requires the trusted admin backend');
    assertRemoteWriteAllowed('addUser');
    try {
        const docRef = await db.collection('users').add(userData);
        return { id: docRef.id, ...userData };
    } catch (error) {
        console.error('Error adding user:', error);
        throw error;
    }
}

async function removeUser(id) {
    if (isFirebaseAuthEnabled()) throw new Error('Account removal requires the trusted admin backend');
    assertRemoteWriteAllowed('removeUser');
    if (!id) throw new Error('ID is required for removeUser');
    try {
        // Force ID to string to prevent Firestore path errors
        await db.collection('users').doc(String(id)).delete();
        return true;
    } catch (error) {
        console.error('Error removing user:', error);
        throw error;
    }
}

async function updateUser(id, userData) {
    if (isFirebaseAuthEnabled()) throw new Error('Account and role changes require the trusted admin backend');
    assertRemoteWriteAllowed('updateUser');
    if (!id) throw new Error('ID is required for updateUser');
    try {
        await db.collection('users').doc(String(id)).update(userData);
        return { id: id, ...userData };
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

// บันทึกคำขอรีเซ็ตรหัสผ่านให้แอดมินจัดการ (แบบเก่า - มีไว้แจ้งเตือนแอดมิน)
async function requestPasswordReset(payload) {
    if (isFirebaseAuthEnabled()) throw new Error('Legacy password reset requests are disabled in Firebase Auth mode');
    assertRemoteWriteAllowed('requestPasswordReset');
    try {
        await db.collection('password_reset_requests').add({
            employee_id: payload.employee_id,
            contact: payload.email || payload.contact || '',
            reason: payload.reason || 'Requested automatic reset',
            created_at: Date.now()
        });
        return true;
    } catch (error) {
        console.error('Error creating password reset request:', error);
        throw error;
    }
}

// ระบบรีเซ็ตรหัสผ่านอัตโนมัติ (Phase 2)
async function verifyAndResetPassword(employeeId, email, newPassword) {
    if (isFirebaseAuthEnabled()) throw new Error('Direct password reset is disabled in Firebase Auth mode');
    assertRemoteWriteAllowed('verifyAndResetPassword');
    try {
        const snapshot = await db.collection('users')
            .where('employee_id', '==', employeeId)
            .where('email', '==', email)
            .get();

        if (snapshot.empty) {
            throw new Error('ข้อมูลไม่ถูกต้อง: ไม่พบรหัสพนักงานหรืออีเมลนี้ในระบบ');
        }

        const userDoc = snapshot.docs[0];
        await db.collection('users').doc(userDoc.id).update({
            password: newPassword
        });

        // บันทึกประวัติการขอรีเซ็ตด้วย
        await requestPasswordReset({ 
            employee_id: employeeId, 
            email: email, 
            reason: 'Automatic reset successful' 
        });

        return true;
    } catch (error) {
        console.error('Verify and Reset error:', error);
        throw error;
    }
}
