/*
  Stuwie's Salon & Spa booking receiver

  Setup:
  1. Create a Google Sheet for booking requests.
  2. Copy that Sheet ID from its URL and paste it into SHEET_ID below.
  3. Set SALON_EMAIL to the inbox that should receive booking notifications.
  4. In Google Apps Script, deploy as Web App:
     - Execute as: Me
     - Who has access: Anyone
  5. Copy the Web App URL into index.html as BOOKING_WEB_APP_URL.
*/

const SALON_EMAIL = 'stuwiessalonandspa@gmail.com';
const SHEET_ID = '11ef_KyjslER3On5KrjcwLQI7fWvrcrajhH1sXDeyu-8';
const SHEET_NAME = 'Website Bookings';

const BRAND = {
  blue: '#0064b4',
  brightBlue: '#009fe3',
  black: '#000000',
  grey: '#dcdcdc',
  lightBlue: '#e9f5ff',
  warm: '#d9a15f'
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const sheet = getBookingSheet_();
    appendBooking_(sheet, data);
    sendBookingEmail_(data);
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function doGet() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getBookingSheet_();
    return json_({
      ok: true,
      message: 'Stuwie booking endpoint is active.',
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      sheetName: sheet.getName(),
      lastRow: sheet.getLastRow()
    });
  } catch (error) {
    return json_({ ok: false, error: String(error), sheetId: SHEET_ID });
  }
}

function getBookingSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const headers = [
    'Timestamp',
    'Customer Name',
    'Phone',
    'Email',
    'Service Requested',
    'Selected Items',
    'Estimated Total',
    'Preferred Date',
    'Preferred Time',
    'Notes',
    'Status'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    styleHeader_(sheet, headers.length);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function appendBooking_(sheet, data) {
  const row = [
    new Date(),
    data.customer_name || '',
    data.phone || '',
    data.customer_email || '',
    data.service || '',
    data.selected_items || '',
    data.estimated_total || '',
    data.preferred_date || '',
    data.preferred_time || '',
    data.notes || '',
    'New'
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  const lastCol = row.length;
  const range = sheet.getRange(lastRow, 1, 1, lastCol);

  range
    .setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, BRAND.grey, SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange(lastRow, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(lastRow, 7).setFontWeight('bold').setFontColor(BRAND.blue);
  sheet.getRange(lastRow, 11).setBackground(BRAND.lightBlue).setFontWeight('bold');

  const bg = lastRow % 2 === 0 ? '#ffffff' : '#f6fbff';
  sheet.getRange(lastRow, 1, 1, lastCol).setBackground(bg);
  sheet.autoResizeColumns(1, lastCol);
  sheet.setColumnWidth(6, 320);
  sheet.setColumnWidth(10, 260);
}

function styleHeader_(sheet, headerCount) {
  sheet.getRange(1, 1, 1, headerCount)
    .setBackground(BRAND.blue)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setWrap(true);

  sheet.setRowHeight(1, 42);
  sheet.getRange(1, 1, 1, headerCount)
    .setBorder(true, true, true, true, true, true, BRAND.black, SpreadsheetApp.BorderStyle.SOLID);
}

function sendBookingEmail_(data) {
  const htmlBody = data.html_email || fallbackEmail_(data);
  const ss = SpreadsheetApp.openById(SHEET_ID);
  MailApp.sendEmail({
    to: SALON_EMAIL,
    subject: data.subject || 'New Stuwie booking request',
    htmlBody: htmlBody + '<p style="font-family:Arial,sans-serif;font-size:12px;color:#666;margin-top:18px;">Saved to Google Sheet: <a href="' + ss.getUrl() + '">Open bookings sheet</a></p>',
    replyTo: data.customer_email || undefined,
    name: "Stuwie's Website Bookings"
  });
}

function fallbackEmail_(data) {
  return [
    '<h2>New Stuwie booking request</h2>',
    '<p><strong>Name:</strong> ' + escape_(data.customer_name) + '</p>',
    '<p><strong>Phone:</strong> ' + escape_(data.phone) + '</p>',
    '<p><strong>Email:</strong> ' + escape_(data.customer_email) + '</p>',
    '<p><strong>Items:</strong><br>' + escape_(data.selected_items).replace(/\n/g, '<br>') + '</p>',
    '<p><strong>Date/Time:</strong> ' + escape_(data.preferred_date) + ' ' + escape_(data.preferred_time) + '</p>',
    '<p><strong>Notes:</strong> ' + escape_(data.notes) + '</p>'
  ].join('');
}

function escape_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
