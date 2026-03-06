const xlsx = require('xlsx');
const path = require('path');

try {
    const filePath = path.join(__dirname, 'Report Update Work 2026.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const datasheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(datasheet, { header: 1 });

    console.log('Sheet Name:', sheetName);
    console.log('Headers:', data[0]);
    console.log('First row of data:', data[1]);
    console.log('Sample data (rows 1-5):');
    console.log(data.slice(1, 6));
} catch (err) {
    console.error('Error:', err.message);
}
