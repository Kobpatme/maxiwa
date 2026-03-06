
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bydsmmhdebcjznhrktey.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZHNtbWhkZWJjanpuaHJrdGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NjI2NTQsImV4cCI6MjA4ODMzODY1NH0.eer7UKB1WHbaTwAsC2vfmCJKfNWNPgeo-2gJG3F6Nhc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUsersTable() {
    console.log('Checking "users" table...');
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching from "users" table:', error);
        console.log('HINT: This usually means the table does not exist or RLS is blocking it.');
    } else {
        console.log('"users" table exists. Data found:', data);
    }
}

checkUsersTable();
