/* supabase-client.js */

if (typeof _supabase === 'undefined') {
    var _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function getDeposits() {
    const { data, error } = await _supabase
        .from('deposits')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Error fetching deposits:', error);
        return [];
    }
    return data;
}

async function insertDeposit(depositData) {
    const { data, error } = await _supabase
        .from('deposits')
        .insert([depositData])
        .select();

    if (error) {
        console.error('Error inserting deposit:', error);
        throw error;
    }
    return data[0];
}

async function updateDeposit(id, depositData) {
    const { data, error } = await _supabase
        .from('deposits')
        .update(depositData)
        .eq('id', id)
        .select();

    if (error) {
        console.error('Error updating deposit:', error);
        throw error;
    }
    return data[0];
}

async function deleteDeposit(id) {
    const { error } = await _supabase
        .from('deposits')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting deposit:', error);
        throw error;
    }
    return true;
}

/* ─── STORAGE (File Upload) ─── */

async function uploadFile(file, folder = 'misc') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await _supabase.storage
        .from('deposits_files')
        .upload(filePath, file);

    if (error) {
        console.error('Error uploading file:', error);
        toast('อัปโหลดไฟล์ไม่สำเร็จ', 'error');
        return null;
    }

    // Get public URL
    const { data: { publicUrl } } = _supabase.storage
        .from('deposits_files')
        .getPublicUrl(filePath);

    return publicUrl;
}

async function deleteFileFromUrl(url) {
    if (!url || typeof url !== 'string') return;
    try {
        // Extract path from public URL
        // Format: .../storage/v1/object/public/deposits_files/folder/filename.ext
        const parts = url.split('/deposits_files/');
        if (parts.length < 2) return;

        const filePath = parts[1];
        const { error } = await _supabase.storage
            .from('deposits_files')
            .remove([filePath]);

        if (error) {
            console.error('Error deleting file from storage:', error);
        }
    } catch (err) {
        console.error('Failed to parse storage URL for deletion:', err);
    }
}

/* ─── USER MANAGEMENT (Auth/Admin) ─── */

async function validateUser(employeeId) {
    const { data, error } = await _supabase
        .from('users')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();

    if (error) {
        console.error('Login validation error:', error);
        return null;
    }
    return data;
}

async function getUsers() {
    const { data, error } = await _supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    return data;
}

async function addUser(userData) {
    const { data, error } = await _supabase
        .from('users')
        .insert([userData])
        .select();

    if (error) {
        console.error('Error adding user:', error);
        throw error;
    }
    return data[0];
}

async function removeUser(id) {
    const { error } = await _supabase
        .from('users')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error removing user:', error);
        throw error;
    }
    return true;
}

async function updateUser(id, userData) {
    const { data, error } = await _supabase
        .from('users')
        .update(userData)
        .eq('id', id)
        .select();

    if (error) {
        console.error('Error updating user:', error);
        throw error;
    }
    return data[0];
}
