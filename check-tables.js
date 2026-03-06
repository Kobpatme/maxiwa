/*
  check-tables.js
  Usage: powershell -ExecutionPolicy Bypass -Command "node check-tables.js"
*/

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const configText = fs.readFileSync('supabase-config.js', 'utf8');
const SUPABASE_URL = configText.match(/SUPABASE_URL\s*=\s*['"](.*)['"]/)[1];
const SUPABASE_ANON_KEY = configText.match(/SUPABASE_ANON_KEY\s*=\s*['"](.*)['"]/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    console.log('--- Checking Supabase Tables ---');
    try {
        // Querying the RPC to get table names or just a generic select from a known internal table if allowed
        // But usually, we can just try to select from 'deposits' again with more info
        const { data, error } = await supabase
            .from('deposits')
            .select('*')
            .limit(1);

        if (error) {
            console.log('Error searching for "deposits" table:', error.message);
            console.log('Error Code:', error.code);
        } else {
            console.log('Successfully found "deposits" table! Data count:', data.length);
        }

        // Try to fetch all table names in public schema
        // Note: This requires the user to have granted access to the information_schema or similar
        // Usually anonymous keys can't do this.
        console.log('\nNote: Anonymous keys usually cannot list all tables via PostgREST.');
    } catch (err) {
        console.error('Check failed:', err.message);
    }
}

check();
