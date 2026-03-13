/* firebase-client.js */

// Initialize Firebase App
if (firebase.apps.length === 0) {
    firebase.initializeApp(FIREBASE_CONFIG);
}

const db = firebase.firestore();
const storage = firebase.storage();

/* ─── DATA: DEPOSITS ─── */

async function getDeposits() {
    try {
        // Fetch all deposits. We'll handle sorting in memory if needed, 
        // to avoid Firestore filtering out docs that lack the 'id' field.
        const snapshot = await db.collection('deposits').get();
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            return { 
                id_firestore: doc.id, 
                id: docData.id || doc.id, // Fallback to doc ID if numeric id is missing
                ...docData 
            };
        });
        
        // Manual sort by id (descending) as a fallback
        return data.sort((a, b) => {
            const idA = typeof a.id === 'number' ? a.id : 0;
            const idB = typeof b.id === 'number' ? b.id : 0;
            return idB - idA;
        });
    } catch (error) {
        console.error('Error fetching deposits:', error);
        return [];
    }
}

async function insertDeposit(depositData) {
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
    if (!id) throw new Error('ID is required for updateDeposit');
    try {
        let docId = String(id);
        if (typeof id === 'number' || !isNaN(id)) {
            const snapshot = await db.collection('deposits').where('id', '==', Number(id)).limit(1).get();
            if (!snapshot.empty) {
                docId = snapshot.docs[0].id;
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
    if (!id) throw new Error('ID is required for deleteDeposit');
    try {
        let docId = String(id);
        if (typeof id === 'number' || !isNaN(id)) {
            const snapshot = await db.collection('deposits').where('id', '==', Number(id)).limit(1).get();
            if (!snapshot.empty) {
                docId = snapshot.docs[0].id;
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
        return null;
    }
}

async function deleteFileFromUrl(url) {
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
    try {
        const snapshot = await db.collection('users').orderBy('name').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

async function addUser(userData) {
    try {
        const docRef = await db.collection('users').add(userData);
        return { id: docRef.id, ...userData };
    } catch (error) {
        console.error('Error adding user:', error);
        throw error;
    }
}

async function removeUser(id) {
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
    if (!id) throw new Error('ID is required for updateUser');
    try {
        await db.collection('users').doc(String(id)).update(userData);
        return { id: id, ...userData };
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

// บันทึกคำขอรีเซ็ตรหัสผ่านให้แอดมินจัดการ
async function requestPasswordReset(payload) {
    try {
        await db.collection('password_reset_requests').add({
            employee_id: payload.employee_id,
            contact: payload.contact || '',
            reason: payload.reason || '',
            created_at: Date.now()
        });
        return true;
    } catch (error) {
        console.error('Error creating password reset request:', error);
        throw error;
    }
}
