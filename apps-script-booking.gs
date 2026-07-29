/*
  Stuwie's Salon & Spa booking receiver and availability API

  Sheets created/managed:
  - Bookings: every website booking request
  - Availability: salon-managed blocked/free dates and times
  - Dashboard: quick admin notes and status guide
  - Salon-Email: stuwiessalonandspa@gmail.com

  Public website reads only safe availability data. Customer details stay private.
*/

const SALON_EMAIL = 'kmantalgosolo@gmail.com';
const SHEET_ID = '11ef_KyjslER3On5KrjcwLQI7fWvrcrajhH1sXDeyu-8';
const BOOKINGS_SHEET = 'Bookings';
const AVAILABILITY_SHEET = 'Availability';
const DASHBOARD_SHEET = 'Dashboard';

const BRAND = {
  blue: '#0064b4',
  brightBlue: '#009fe3',
  black: '#000000',
  grey: '#dcdcdc',
  lightBlue: '#e9f5ff',
  wash: '#f5f9fc',
  warm: '#d9a15f',
  softWarm: '#fff3df',
  green: '#dff5e5',
  red: '#fde4e4'
};

const BOOKING_HEADERS = [
  'Booking ID',
  'Created At',
  'Customer Name',
  'Phone',
  'Email',
  'Service Requested',
  'Selected Items',
  'Estimated Total',
  'Preferred Date',
  'Preferred Time',
  'Duration',
  'Status',
  'Notes',
  'Source'
];

const AVAILABILITY_HEADERS = [
  'Date',
  'Time',
  'Status',
  'Reason / Note',
  'Updated At'
];

const ACTIVE_BOOKING_STATUSES = ['new', 'booked', 'confirmed'];
const BLOCKING_AVAILABILITY_STATUSES = ['blocked', 'closed', 'not available'];
const FREE_STATUSES = ['free', 'cancelled', 'completed', 'open'];

function doPost(e) {
  try {
    setupWorkbook_();
    const data = JSON.parse(e.postData.contents || '{}');
    const date = normalizeDate_(data.preferred_date);
    const time = normalizeTime_(data.preferred_time);

    if (!date || !time) return json_({ ok: false, error: 'Preferred date and time are required.' });
    if (!isSlotAvailable_(date, time)) return json_({ ok: false, error: 'That date and time is already booked or unavailable.', available: false });

    const sheet = getSheet_(BOOKINGS_SHEET);
    appendBooking_(sheet, data, date, time);
    sendBookingEmail_(data);
    return json_({ ok: true, available: true });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function doGet(e) {
  try {
    setupWorkbook_();
    const params = (e && e.parameter) || {};
    const action = params.action || 'status';
    let payload;

    if (action === 'availability') {
      payload = getAvailabilityPayload_();
    } else if (action === 'setup') {
      payload = setupWorkbook_();
    } else {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      payload = {
        ok: true,
        message: 'Stuwie booking endpoint is active.',
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl()
      };
    }

    if (params.callback) return jsonp_(params.callback, payload);
    return json_(payload);
  } catch (error) {
    const payload = { ok: false, error: String(error), sheetId: SHEET_ID };
    if (e && e.parameter && e.parameter.callback) return jsonp_(e.parameter.callback, payload);
    return json_(payload);
  }
}

function setupWorkbook_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const bookings = ensureSheet_(ss, BOOKINGS_SHEET, BOOKING_HEADERS);
  const availability = ensureSheet_(ss, AVAILABILITY_SHEET, AVAILABILITY_HEADERS);
  const dashboard = ensureSheet_(ss, DASHBOARD_SHEET, ['Area', 'How to Use']);

  styleBookings_(bookings);
  styleAvailability_(availability);
  styleDashboard_(dashboard);

  return { ok: true, sheets: [BOOKINGS_SHEET, AVAILABILITY_SHEET, DASHBOARD_SHEET], spreadsheetUrl: ss.getUrl() };
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (current.join('|') !== headers.join('|')) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function styleBookings_(sheet) {
  styleHeader_(sheet, BOOKING_HEADERS.length);
  sheet.setFrozenColumns(2);
  sheet.setColumnWidths(1, 1, 130);
  sheet.setColumnWidths(2, 1, 150);
  sheet.setColumnWidths(3, 3, 150);
  sheet.setColumnWidth(6, 190);
  sheet.setColumnWidth(7, 340);
  sheet.setColumnWidths(9, 3, 120);
  sheet.setColumnWidth(12, 120);
  sheet.setColumnWidth(13, 260);
  applyStatusValidation_(sheet, 12);
  applyBookingConditionalFormatting_(sheet);
}

function styleAvailability_(sheet) {
  styleHeader_(sheet, AVAILABILITY_HEADERS.length);
  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 320);
  sheet.setColumnWidth(5, 150);
  applyAvailabilityValidation_(sheet, 3);
  applyAvailabilityConditionalFormatting_(sheet);
  if (sheet.getLastRow() === 1) {
    sheet.getRange(2, 1, 3, 5).setValues([
      ['2026-08-01', '10:00', 'blocked', 'Example: existing appointment', new Date()],
      ['2026-08-03', 'all_day', 'closed', 'Example: salon closed / staff training', new Date()],
      ['2026-08-05', '14:00', 'free', 'Example: reopened after cancellation', new Date()]
    ]);
  }
}

function styleDashboard_(sheet) {
  sheet.clear();
  const rows = [
    ['Area', 'How to Use'],
    ['Booking statuses that block a slot', 'New, Booked, Confirmed'],
    ['Statuses that free a booked slot', 'Cancelled, Completed, Free'],
    ['Block a full day', 'Go to Availability and add Date + Time = all_day + Status = closed'],
    ['Block one time slot', 'Go to Availability and add Date + Time, then Status = blocked'],
    ['Reopen a slot', 'Change the booking status to Cancelled/Completed/Free, or add Availability status = free']
  ];
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  styleHeader_(sheet, 2);
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 620);
  sheet.getRange(2, 1, rows.length - 1, 2)
    .setBackground(BRAND.wash)
    .setWrap(true)
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, BRAND.grey, SpreadsheetApp.BorderStyle.SOLID);
}

function appendBooking_(sheet, data, date, time) {
  const row = [
    'STW-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'),
    new Date(),
    data.customer_name || '',
    data.phone || '',
    data.customer_email || '',
    data.service || '',
    data.selected_items || '',
    data.estimated_total || '',
    date,
    time,
    data.duration || '',
    'New',
    data.notes || '',
    'Website'
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  const lastCol = row.length;
  sheet.getRange(lastRow, 1, 1, lastCol)
    .setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, BRAND.grey, SpreadsheetApp.BorderStyle.SOLID)
    .setBackground(lastRow % 2 === 0 ? '#ffffff' : '#f6fbff');
  sheet.getRange(lastRow, 2).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(lastRow, 9).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(lastRow, 10).setNumberFormat('@');
  sheet.getRange(lastRow, 12).setFontWeight('bold').setBackground(BRAND.lightBlue);
}

function getAvailabilityPayload_() {
  const bookings = getSheet_(BOOKINGS_SHEET).getDataRange().getValues();
  const availability = getSheet_(AVAILABILITY_SHEET).getDataRange().getValues();
  const bookedSlots = [];
  const closedDays = [];
  const blockedSlots = [];

  bookings.slice(1).forEach((row) => {
    const date = normalizeDate_(row[8]);
    const time = normalizeTime_(row[9]);
    const status = normalizeStatus_(row[11]);
    if (date && time && ACTIVE_BOOKING_STATUSES.indexOf(status) !== -1) bookedSlots.push({ date, time });
  });

  availability.slice(1).forEach((row) => {
    const date = normalizeDate_(row[0]);
    const time = normalizeTime_(row[1]);
    const status = normalizeStatus_(row[2]);
    if (!date || FREE_STATUSES.indexOf(status) !== -1) return;
    if (BLOCKING_AVAILABILITY_STATUSES.indexOf(status) === -1) return;
    if (time === 'all_day') closedDays.push(date);
    else if (time) blockedSlots.push({ date, time });
  });

  return { ok: true, booked_slots: bookedSlots, blocked_slots: blockedSlots, closed_days: closedDays };
}

function isSlotAvailable_(date, time) {
  const availability = getAvailabilityPayload_();
  if (availability.closed_days.indexOf(date) !== -1) return false;
  const slotTaken = availability.booked_slots.concat(availability.blocked_slots).some((slot) => slot.date === date && slot.time === time);
  return !slotTaken;
}

function getSheet_(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function styleHeader_(sheet, headerCount) {
  sheet.getRange(1, 1, 1, headerCount)
    .setBackground(BRAND.blue)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, BRAND.black, SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(1, 42);
}

function applyStatusValidation_(sheet, col) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['New', 'Booked', 'Confirmed', 'Completed', 'Cancelled', 'Free'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, col, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
}

function applyAvailabilityValidation_(sheet, col) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['blocked', 'closed', 'not available', 'free'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, col, Math.max(999, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
}

function applyBookingConditionalFormatting_(sheet) {
  const range = sheet.getRange(2, 1, Math.max(999, sheet.getMaxRows() - 1), BOOKING_HEADERS.length);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$L2="New"').setBackground(BRAND.lightBlue).setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$L2="Confirmed"').setBackground(BRAND.green).setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=OR($L2="Cancelled",$L2="Free")').setBackground(BRAND.red).setRanges([range]).build()
  ];
  sheet.setConditionalFormatRules(rules);
}

function applyAvailabilityConditionalFormatting_(sheet) {
  const range = sheet.getRange(2, 1, Math.max(999, sheet.getMaxRows() - 1), AVAILABILITY_HEADERS.length);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=OR($C2="blocked",$C2="closed",$C2="not available")').setBackground(BRAND.red).setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="free"').setBackground(BRAND.green).setRanges([range]).build()
  ];
  sheet.setConditionalFormatRules(rules);
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
  const callUrl = customerCallUrl_(data.phone);
  return [
    '<h2>New Stuwie booking request</h2>',
    '<p><strong>Name:</strong> ' + escape_(data.customer_name) + '</p>',
    '<p><strong>Phone:</strong> ' + escape_(data.phone) + '</p>',
    '<p><a href="' + callUrl + '" style="display:inline-block;background:#000;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:6px;font-weight:bold;">&#9742; Call Customer</a></p>',
    '<p><strong>Email:</strong> ' + escape_(data.customer_email) + '</p>',
    '<p><strong>Items:</strong><br>' + escape_(data.selected_items).replace(/\n/g, '<br>') + '</p>',
    '<p><strong>Date/Time:</strong> ' + escape_(data.preferred_date) + ' ' + escape_(data.preferred_time) + '</p>',
    '<p><strong>Notes:</strong> ' + escape_(data.notes) + '</p>'
  ].join('');
}

function customerCallUrl_(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.indexOf('0') === 0) digits = '256' + digits.slice(1);
  return digits ? 'tel:+' + digits : '#';
}

function normalizeDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).trim().slice(0, 10);
}

function normalizeTime_(value) {
  if (!value) return '';
  const raw = String(value).trim().toLowerCase();
  if (raw === 'all_day' || raw === 'all day') return 'all_day';
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  return ('0' + match[1]).slice(-2) + ':' + match[2];
}

function normalizeStatus_(value) {
  return String(value || '').trim().toLowerCase();
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

function jsonp_(callback, payload) {
  const safeCallback = String(callback).replace(/[^\w.$]/g, '');
  return ContentService
    .createTextOutput(safeCallback + '(' + JSON.stringify(payload) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
