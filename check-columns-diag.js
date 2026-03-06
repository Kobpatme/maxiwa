
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bydsmmhdebcjznhrktey.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZHNtbWhkZWJjanpuaHJrdGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NjI2NTQsImV4cCI6MjA4ODMzODY1NH0.eer7UKB1WHbaTwAsC2vfmCJKfNWNPgeo-2gJG3F6Nhc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
    console.log('Checking columns of "deposits" table...');
    // We can't easily list columns with Anon Key via PostgREST 
    // BUT we can try to select specific columns and see which one fails.

    const obj = { place: 'Test' };
    const { data, error } = await supabase.from('deposits').insert([obj]).select();

    if (error) {
        console.log('Test insert (minimal) error:', error);
    } else {
        console.log('Test insert (minimal) success. Row:', data[0]);
        console.log('Columns available in response:', Object.keys(data[0]));
    }
}

checkColumns();
