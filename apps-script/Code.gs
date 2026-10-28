/**
 * LoanCheck Google Apps Script backend.
 * Store only the fields listed in ALLOWED_FIELDS. Never add Aadhaar, PAN,
 * bank-account, card, password, or identity-document fields here.
 */
const ALLOWED_FIELDS = [
  'name', 'email', 'phone', 'income', 'creditScore', 'loanType',
  'requestedAmount', 'eligibilityScore', 'verdict', 'timestamp'
];
const SHEET_NAME = 'Loan Checks';

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ALLOWED_FIELDS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const record = {};
    ALLOWED_FIELDS.forEach((field) => { record[field] = body[field] ?? ''; });
    if (!String(record.name).trim() || !String(record.email).trim()) {
      return json_({ ok: false, error: 'Name and email are required.' });
    }
    record.timestamp = record.timestamp || new Date().toISOString();
    getSheet_().appendRow(ALLOWED_FIELDS.map((field) => record[field]));
    return json_({ ok: true, record });
  } catch (error) {
    return json_({ ok: false, error: 'Unable to save this record.' });
  }
}

function doGet() {
  try {
    const sheet = getSheet_();
    const values = sheet.getDataRange().getDisplayValues();
    if (values.length < 2) return json_({ ok: true, records: [] });
    const headers = values[0];
    const records = values.slice(1).reverse().slice(0, 25).map((row) => {
      const record = {};
      headers.forEach((header, index) => { if (ALLOWED_FIELDS.includes(header)) record[header] = row[index] || ''; });
      return record;
    });
    return json_({ ok: true, records });
  } catch (error) {
    return json_({ ok: false, error: 'Unable to read recent checks.' });
  }
}
