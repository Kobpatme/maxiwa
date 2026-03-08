/* assets/js/api.js - Shared Supabase Client */

const SUPABASE_URL = "https://your-project-url.supabase.co"; // This will be injected from supabase-config.js or kept separate
const SUPABASE_ANON_KEY = "your-anon-key";

// Use the existing supabase-config.js for actual keys
// or just wrap the existing client

if (typeof _supabase === 'undefined') {
    var _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// User Management
async function validateUser(employeeId) {
    const { data, error } = await _supabase.from('users').select('*').eq('employee_id', employeeId).maybeSingle();
    return error ? null : data;
}

async function getUsers() {
    const { data } = await _supabase.from('users').select('*').order('name', { ascending: true });
    return data || [];
}

async function addUser(userData) {
    const { data } = await _supabase.from('users').insert([userData]).select();
    return data ? data[0] : null;
}

async function updateUser(id, userData) {
    const { data } = await _supabase.from('users').update(userData).eq('id', id).select();
    return data ? data[0] : null;
}

async function removeUser(id) {
    await _supabase.from('users').delete().eq('id', id);
    return true;
}

// Deposit Refund Specific
async function getDeposits() {
    const { data } = await _supabase.from('deposits').select('*').order('id', { ascending: false });
    return data || [];
}

async function insertDeposit(obj) {
    const { data } = await _supabase.from('deposits').insert([obj]).select();
    return data ? data[0] : null;
}

async function updateDeposit(id, obj) {
    const { data } = await _supabase.from('deposits').update(obj).eq('id', id).select();
    return data ? data[0] : null;
}

async function deleteDeposit(id) {
    await _supabase.from('deposits').delete().eq('id', id);
    return true;
}

// Storage
async function uploadFile(file, folder = 'misc') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error } = await _supabase.storage.from('deposits_files').upload(filePath, file);
    if (error) return null;

    const { data: { publicUrl } } = _supabase.storage.from('deposits_files').getPublicUrl(filePath);
    return publicUrl;
}
