const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const configText = fs.readFileSync('supabase-config.js', 'utf8');
const SUPABASE_URL = configText.match(/SUPABASE_URL\s*=\s*['"](.*)['"]/)[1];
const SUPABASE_ANON_KEY = configText.match(/SUPABASE_ANON_KEY\s*=\s*['"](.*)['"]/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
    console.log('--- Checking Columns in "deposits" table ---');
    try {
        const { data, error } = await supabase.from('deposits').select('*').limit(1);
        if (error) {
            console.error('Error fetching data:', error);
            return;
        }
        if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]));
        } else {
            console.log('No data in table to determine columns.');
        }
    } catch (err) {
        console.error('Check failed:', err.message);
    }
}

checkColumns();
