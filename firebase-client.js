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
        const snapshot = await db.collection('deposits').orderBy('id', 'desc').get();
        return snapshot.docs.map(doc => {
            const data = doc.data();
            // Map Firestore doc ID to id for internal use if needed, 
            // but the app uses numeric 'id' field from Supabase.
            // We'll keep the numeric 'id' field if it exists in data.
            return { id_firestore: doc.id, ...data };
        });
    } catch (error) {
        console.error('Error fetching deposits:', error);
        return [];
    }
}

async function insertDeposit(depositData) {
    try {
        // Auto-increment logic for numeric 'id' is not native to Firestore.
        // For simplicity, we'll try to get the max current id or use timestamp if it's missing.
        // But the best way is to let the app handle it or add it to the data.
        const docRef = await db.collection('deposits').add(depositData);
        return { id_firestore: docRef.id, ...depositData };
    } catch (error) {
        console.error('Error inserting deposit:', error);
        throw error;
    }
}

async function updateDeposit(id, depositData) {
    try {
        // In this implementation, 'id' could be the numeric id or Firestore Doc ID.
        // To be safe, we first find the document if 'id' is numeric.
        let docId = id;
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
    try {
        let docId = id;
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
    try {
        await db.collection('users').doc(id).delete();
        return true;
    } catch (error) {
        console.error('Error removing user:', error);
        throw error;
    }
}

async function updateUser(id, userData) {
    try {
        await db.collection('users').doc(id).update(userData);
        return { id: id, ...userData };
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}
