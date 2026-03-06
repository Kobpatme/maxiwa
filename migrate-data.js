/*
  migrate-data.js
  Usage: powershell -ExecutionPolicy Bypass -Command "node migrate-data.js"
*/

const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load config from supabase-config.js (needs to be readable by Node)
const configText = fs.readFileSync('supabase-config.js', 'utf8');
const SUPABASE_URL = configText.match(/SUPABASE_URL\s*=\s*['"](.*)['"]/)[1];
const SUPABASE_ANON_KEY = configText.match(/SUPABASE_ANON_KEY\s*=\s*['"](.*)['"]/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function excelDateToJS(serial) {
    if (!serial || isNaN(serial)) return null;
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
}

async function migrate() {
    console.log('--- Starting Migration ---');
    try {
        const workbook = xlsx.readFile('Report Update Work 2026.xlsx');
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        console.log('Total rows in data array:', data.length);

        // Based on log: data[2] contains 'No.', 'Status', 'Owner', 'Place Name'...
        const headers = data[2];
        console.log('Actual Headers (data[2]):', headers);

        if (!headers || !headers.includes('Place Name')) {
            console.error('CRITICAL: "Place Name" column not found in headers at data[2]');
            return;
        }

        const rows = data.slice(3); // Data starts after the headers
        console.log(`Processing ${rows.length} rows...`);

        const mappedData = rows.map((row, i) => {
            const getVal = (headerName) => {
                const idx = headers.indexOf(headerName);
                if (idx === -1) return null;
                const val = row[idx];
                return (val === undefined || val === null) ? null : val;
            };

            const place = getVal('Place Name');
            if (!place || place === 'Place Name') return null; // Avoid re-header or empty

            return {
                status: getVal('Status'),
                depStatus: getVal('เงินประกัน_S'),
                demoStatus: getVal('รื้อถอน_S'),
                owner: getVal('Owner'),
                place: String(place).trim(),
                area: getVal('Area'),
                customer: getVal('Customer'),
                deal: String(getVal('Deal') || ''),
                dateReq: excelDateToJS(getVal('วันที่ประสานอาคาร')),
                project: getVal('Project code'),
                pr: String(getVal('PR NO.') || ''),
                dateDue: excelDateToJS(getVal('วันที่ต้องการ')),
                dateCheck: excelDateToJS(getVal('วันที่ได้รับเช็ค')),
                payTo: getVal('Pay to'),
                payType: getVal('ประเภทการเบิกจ่าย'),
                deposit: parseFloat(getVal('เงินประกัน')) || 0,
                demolish: parseFloat(getVal('เงินประกันรื้อถอน')) || 0,
                fee: parseFloat(getVal('ค่าธรรมเนียม')) || 0,
                other: parseFloat(getVal('ค่าใช้จ่ายอื่นๆ')) || 0,
                total: parseFloat(getVal('จำนวนเงิน')) || 0,
                complete: getVal('Status Complete'),
                depReturn: getVal('เงินประกัน') === 'Yes' ? 'Yes' : 'No',
                demoReturn: getVal('เงินประกันรื้อถอน') === 'Yes' ? 'Yes' : 'No',
                contact: getVal('ผู้ประสานงาน'),
                tel: String(getVal('โทร.') || ''),
                mobile: String(getVal('มือถือ') || ''),
                remark: String(getVal('Remark') || ''),
                expense: getVal('ค่าใช้จ่าย') || ''
            };
        }).filter(r => r !== null);

        console.log(`Mapped ${mappedData.length} valid rows. Attempting insert...`);

        if (mappedData.length === 0) {
            console.warn('No valid rows mapped. Skipping insert.');
            return;
        }

        const { error } = await supabase.from('deposits').insert(mappedData);

        if (error) {
            console.error('Error inserting data:', error);
            if (error.code === 'PGRST205') {
                console.error('\nCRITICAL: The table "deposits" does not exist in your Supabase database.');
                console.error('Please run the SQL schema previously provided in your Supabase SQL Editor.');
            }
        } else {
            console.log(`Migration successful! ✓ Imported ${mappedData.length} records.`);
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
}

migrate();
