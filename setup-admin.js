
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bydsmmhdebcjznhrktey.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZHNtbWhkZWJjanpuaHJrdGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NjI2NTQsImV4cCI6MjA4ODMzODY1NH0.eer7UKB1WHbaTwAsC2vfmCJKfNWNPgeo-2gJG3F6Nhc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupAdmin() {
    console.log('Inserting default Admin user...');
    const { data, error } = await supabase
        .from('users')
        .insert([
            { employee_id: 'ADMIN01', name: 'Admin User', role: 'admin' }
        ])
        .select();

    if (error) {
        console.error('Error inserting admin:', error);
    } else {
        console.log('Admin user added successfully:', data);
    }
}

setupAdmin();
