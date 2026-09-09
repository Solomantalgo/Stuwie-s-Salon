/*
  Stuwie's Salon & Spa booking receiver and availability API

  Sheets created/managed:
  - Bookings: every website booking request
  - Availability: salon-managed blocked/free dates and times
  - Dashboard: quick admin notes and status guide
  - Payments: linked transactions, reconciled by staff in the sheet
  - Salon-Email: stuwiessalonandspa@gmail.com

  Public website reads only safe availability data. Customer details stay private.
*/

const SALON_EMAIL = 'stuwiessalonandspa@gmail.com';
const SHEET_ID = '1Z7TYosoYPI3vsHqv3ftm2Z6C1Rvlyge81fRiD1Q1Sl0';
const BOOKINGS_SHEET = 'Bookings';
const PAYMENTS_SHEET = 'Payments';
const AVAILABILITY_SHEET = 'Availability';
const DASHBOARD_SHEET = 'Dashboard';
const CONFIRM_PAGE_URL = 'http://stuwies-salon.vercel.app/confirm.html';

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
  'Client Location',
  'Service Requested',
  'Selected Items',
  'Estimated Total',
  'Preferred Date',
  'Preferred Time',
  'Duration',
  'Status',
  'Notes',
  'Source',
  'Payment Status',
  'Amount Paid',
  'Balance'
];

const PAYMENT_HEADERS = [
  'Payment ID', 'Booking ID', 'Created At', 'Provider', 'Provider Key',
  'Payment Type', 'Expected Amount', 'Transaction Amount', 'Balance Before',
  'Balance After', 'Transaction Reference', 'Provider Status', 'Verification Status',
  'Initiated At', 'Verified At', 'Verified By', 'Notes'
];

const AVAILABILITY_HEADERS = [
  'Date',
  'Time',
  'Status',
  'Reason / Note',
  'Updated At'
];

const ACTIVE_BOOKING_STATUSES = ['new', 'pending', 'booked', 'confirmed', 'paid'];
const AUTO_PENDING_AFTER_MINUTES = 1;
const AUTO_CANCEL_AFTER_MINUTES = 60;
const BLOCKING_AVAILABILITY_STATUSES = ['blocked', 'closed', 'not available'];
const FREE_STATUSES = ['free', 'cancelled', 'completed', 'open', 'reschedule'];

function doPost(e) {
  try {
    setupWorkbook_();
    updateBookingAging_();
    const data = JSON.parse(e.postData.contents || '{}');
    const isProductOrder = String(data.type || '').toLowerCase().indexOf('product') !== -1 || String(data.service || '').toLowerCase().indexOf('product order') !== -1;
    const date = normalizeDate_(data.preferred_date);
    const time = normalizeTime_(data.preferred_time);

    if (!isProductOrder && (!date || !time)) return json_({ ok: false, error: 'Preferred date and time are required.' });
    const payment = normalizePayment_(data.payment, data.estimated_total);
    const bookingId = withBookingLock_(function() {
      if (!isProductOrder && !isSlotAvailable_(date, time)) throw new Error('That date and time is already booked or unavailable.');
      const sheet = getSheet_(BOOKINGS_SHEET);
      const id = appendBooking_(sheet, data, date, time, payment);
      if (payment) appendPayment_(getSheet_(PAYMENTS_SHEET), id, payment);
      return id;
    });
    data.booking_id = bookingId;
    sendBookingEmail_(data);
    return json_({ ok: true, available: true, booking_id: bookingId });
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
    } else if (action === 'booking_action') {
      payload = handleBookingAction_(params);
    } else if (action === 'find_payment') {
      payload = findPaymentByReference_(params);
    } else if (action === 'verify_payment') {
      payload = verifyPaymentFromStaff_(params);
    } else if (action === 'staff_dashboard') {
      payload = getStaffDashboard_(params);
    } else if (action === "staff_schedule") {
      payload = getStaffSchedule_(params);
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

function getStaffDashboard_(params) { var q=String((params&&params.q)||"").trim().toLowerCase(); var bs=getSheet_(BOOKINGS_SHEET).getDataRange().getValues(); var ps=getSheet_(PAYMENTS_SHEET).getDataRange().getValues(); var by={}; ps.slice(1).forEach(function(r){var id=String(r[1]||"").trim();if(id)(by[id]||(by[id]=[])).push(r);}); var list=bs.slice(1).filter(function(r){return String(r[0]||"").trim();}).map(function(r){var id=String(r[0]).trim(), rows=by[id]||[], pay=rows[rows.length-1]||[]; rows.forEach(function(x){if(normalizeStatus_(x[12])==="pending")pay=x;}); return {bookingId:id,createdAt:r[1]||"",customerName:String(r[2]||""),phone:String(r[3]||""),email:String(r[4]||""),location:String(r[5]||""),service:String(r[6]||""),selectedItems:String(r[7]||""),preferredDate:normalizeDate_(r[9]),preferredTime:normalizeTime_(r[10]),bookingStatus:String(r[12]||""),notes:String(r[13]||""),estimatedTotal:sheetAmount_(r[8]),paymentStatus:String(r[15]||""),amountPaid:sheetAmount_(r[16])||0,balance:sheetAmount_(r[17]),paymentType:String(pay[5]||""),provider:String(pay[3]||""),expectedAmount:sheetAmount_(pay[6]),transactionReference:String(pay[10]||""),verificationStatus:String(pay[12]||"")};}); list.sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt));}); var needsPayment=function(x){var p=normalizeStatus_(x.paymentStatus),v=normalizeStatus_(x.verificationStatus);return ["payment initiated","awaiting payment","payment failed"].indexOf(p)!==-1||["pending","mismatch","failed"].indexOf(v)!==-1;}; var summary={new:list.filter(function(x){return normalizeStatus_(x.bookingStatus)==="new";}).length,pending:list.filter(function(x){return normalizeStatus_(x.bookingStatus)==="pending";}).length,paymentAttention:list.filter(needsPayment).length,confirmed:list.filter(function(x){return normalizeStatus_(x.bookingStatus)==="confirmed";}).length}; if(q){var found=list.filter(function(x){return [x.bookingId,x.customerName,x.phone,x.transactionReference].some(function(v){return String(v||"").toLowerCase().indexOf(q)!==-1;});}); return {ok:true,query:params.q||"",results:found.slice(0,50),summary:summary};} var attention=list.filter(function(x){return needsPayment(x)||["new","pending"].indexOf(normalizeStatus_(x.bookingStatus))!==-1;}); return {ok:true,summary:summary,attention:attention.slice(0,20),recent:list.slice(0,20)}; }

function getStaffSchedule_(params) {
  var date = String((params && params.date) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'A valid date is required in YYYY-MM-DD format.' };
  var p = date.split('-'), check = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  if (check.getFullYear() !== Number(p[0]) || check.getMonth() !== Number(p[1]) - 1 || check.getDate() !== Number(p[2])) return { ok: false, error: 'A valid date is required in YYYY-MM-DD format.' };
  var ss = SpreadsheetApp.openById(SHEET_ID), bs = ss.getSheetByName(BOOKINGS_SHEET).getDataRange().getValues(), ps = ss.getSheetByName(PAYMENTS_SHEET).getDataRange().getValues(), by = {};
  ps.slice(1).forEach(function(r) { var id = String(r[1] || '').trim(); if (id) (by[id] || (by[id] = [])).push(r); });
  var active = ['new', 'pending', 'booked', 'confirmed', 'paid', 'completed'];
  var list = bs.slice(1).filter(function(r) { return normalizeDate_(r[9]) === date && active.indexOf(normalizeStatus_(r[12])) !== -1 && String(r[0] || '').trim(); }).map(function(r) {
    var id = String(r[0]).trim(), rows = by[id] || [], pay = rows[rows.length - 1] || [];
    rows.forEach(function(x) { if (normalizeStatus_(x[12]) === 'pending') pay = x; });
    return { bookingId:id, customerName:String(r[2] || ''), phone:String(r[3] || ''), email:String(r[4] || ''), service:String(r[6] || ''), selectedItems:String(r[7] || ''), preferredDate:date, preferredTime:normalizeTime_(r[10]), duration:String(r[11] || ''), professional:professionalFromNotes_(r[13]), bookingStatus:String(r[12] || ''), paymentStatus:String(r[15] || 'Unpaid'), amountPaid:sheetAmount_(r[16]) || 0, balance:sheetAmount_(r[17]), paymentType:String(pay[5] || ''), provider:String(pay[3] || ''), transactionReference:String(pay[10] || ''), verificationStatus:String(pay[12] || ''), expectedAmount:sheetAmount_(pay[6]), notes:String(r[13] || '') };
  });
  list.sort(function(a, b) { return timeSort_(a.preferredTime) - timeSort_(b.preferredTime); });
  var done = list.filter(function(x) { return normalizeStatus_(x.bookingStatus) === 'completed'; }).length;
  return { ok:true, date:date, summary:{ total:list.length, completed:done, remaining:list.length - done }, appointments:list };
}
function professionalFromNotes_(notes) { var m = String(notes || '').match(/Preferred professional:\s*([^\n(]+)/i); return m ? String(m[1]).trim() : ''; }
function timeSort_(value) { var m = String(value || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 9999; }

function setupWorkbook_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ensureSheet_(ss, BOOKINGS_SHEET, BOOKING_HEADERS);
  ensureSheet_(ss, AVAILABILITY_SHEET, AVAILABILITY_HEADERS);
  ensureSheet_(ss, PAYMENTS_SHEET, PAYMENT_HEADERS);
  if (!ss.getSheetByName(DASHBOARD_SHEET)) ss.insertSheet(DASHBOARD_SHEET);
  return { ok: true, sheets: [BOOKINGS_SHEET, PAYMENTS_SHEET, AVAILABILITY_SHEET, DASHBOARD_SHEET], spreadsheetUrl: ss.getUrl() };
}

function initializeWorkbook() {
  setupWorkbook_();
  styleBookings_(getSheet_(BOOKINGS_SHEET));
  stylePayments_(getSheet_(PAYMENTS_SHEET));
  styleAvailability_(getSheet_(AVAILABILITY_SHEET));
  styleDashboard_(getSheet_(DASHBOARD_SHEET));
  installPaymentEditTrigger();
  installBookingAgingTrigger();
  return { ok: true, message: 'Workbook initialized.' };
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (current.some((value, index) => value !== '' && value !== headers[index])) {
      throw new Error(name + ' headers do not match the expected schema; no columns were moved.');
    }
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
  sheet.setColumnWidth(6, 180);
  sheet.setColumnWidth(7, 190);
  sheet.setColumnWidth(8, 340);
  sheet.setColumnWidths(10, 3, 120);
  sheet.setColumnWidth(13, 120);
  sheet.setColumnWidth(14, 260);
  sheet.setColumnWidths(16, 3, 160);
  sheet.getRange(2, 17, Math.max(1, sheet.getMaxRows() - 1), 2).setNumberFormat('#,##0');
  applyStatusValidation_(sheet, 13);
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
  const rows = Math.max(sheet.getLastRow(), 28);
  const dashboardRange = sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), rows, 30), 8);
  dashboardRange.breakApart();
  dashboardRange.clearContent();
  dashboardRange.clearFormat();
  sheet.getRange(1, 1, rows, 8).setValues(Array.from({length: rows}, function() { return Array(8).fill(""); }));
  sheet.getRange(1, 1, rows, 8).setBackground("#ffffff").setFontColor(BRAND.black).setFontWeight("normal");
  sheet.setFrozenRows(2); sheet.setColumnWidths(1, 8, 118); sheet.setColumnWidth(1, 180);
  sheet.getRange(1, 1, 2, 8).merge().setValue("STUWIE SALON & SPA\nBooking & Payment Dashboard").setBackground(BRAND.blue).setFontColor("#ffffff").setFontWeight("bold").setFontSize(18).setVerticalAlignment("middle").setWrap(true);
  const cards = [["A4:B4","A5:B6","New Bookings",`=COUNTIF(Bookings!M:M,"New")`,BRAND.lightBlue],["C4:D4","C5:D6","Pending",`=COUNTIF(Bookings!M:M,"Pending")`,BRAND.softWarm],["E4:F4","E5:F6","Confirmed",`=COUNTIF(Bookings!M:M,"Confirmed")`,BRAND.green],["G4:H4","G5:H6","Cancelled",`=COUNTIF(Bookings!M:M,"Cancelled")`,BRAND.red],["A8:B8","A9:B10","Awaiting Payment",`=COUNTIF(Bookings!P:P,"Awaiting Payment")`,BRAND.wash],["C8:D8","C9:D10","Payment Initiated",`=COUNTIF(Bookings!P:P,"Payment Initiated")`,BRAND.lightBlue],["E8:F8","E9:F10","Deposit Paid",`=COUNTIF(Bookings!P:P,"Deposit Paid")`,BRAND.green],["G8:H8","G9:H10","Paid in Full",`=COUNTIF(Bookings!P:P,"Paid in Full")`,BRAND.green],["A12:B12","A13:B14","Today Bookings",`=COUNTIF(Bookings!J:J,TEXT(TODAY(),"yyyy-mm-dd"))+COUNTIF(Bookings!J:J,TODAY())`,BRAND.wash],["C12:D12","C13:D14","Today Confirmed",`=COUNTIFS(Bookings!M:M,"Confirmed",Bookings!J:J,TEXT(TODAY(),"yyyy-mm-dd"))+COUNTIFS(Bookings!M:M,"Confirmed",Bookings!J:J,TODAY())`,BRAND.green],["E12:F12","E13:F14","Today Verified Payments",`=SUMIFS(Payments!H:H,Payments!M:M,"Verified",Payments!O:O,">="&TODAY(),Payments!O:O,"<"&TODAY()+1)`,BRAND.lightBlue],["G12:H12","G13:H14","Outstanding Balance",`=SUMIFS(Bookings!R:R,Bookings!M:M,"<>Cancelled",Bookings!R:R,">0")`,BRAND.softWarm]];
  cards.forEach(function(card) { sheet.getRange(card[0]).merge().setValue(card[2]).setBackground(BRAND.wash).setFontColor(BRAND.blue).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true); sheet.getRange(card[1]).merge().setFormula(card[3]).setBackground(card[4]).setFontWeight("bold").setFontSize(20).setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true,true,true,true,true,true,BRAND.grey,SpreadsheetApp.BorderStyle.SOLID); });
  sheet.getRange(13, 5, 2, 2).setNumberFormat("#,##0"); sheet.getRange(13, 7, 2, 2).setNumberFormat("UGX #,##0");
  sheet.getRange(17, 1, 1, 8).merge().setValue("QUICK GUIDE").setBackground(BRAND.blue).setFontColor("#ffffff").setFontWeight("bold");
  const guide = [["Booking aging","New requests move to Pending after 1 minute and may be cancelled after 1 hour if not confirmed. Verified Deposit Paid and Paid in Full bookings are protected from automatic cancellation."],["Manage bookings","Use Manage Booking for appointment status and customer contact. Booking Status and Payment Status are separate."],["Verify a payment","Open Payments, find the Booking ID, confirm the merchant transaction, enter Transaction Amount and Transaction Reference, then set Verification Status to Verified."],["Payment results","Matching rows update Bookings Payment Status, Amount Paid and Balance. Missing or mismatched information becomes Mismatch and does not credit the booking."],["Availability","Add a blocked time or set Time to all_day with Status closed. Use free to reopen a slot."]];
  sheet.getRange(18, 1, guide.length, 2).setValues(guide).setBackground(BRAND.wash).setWrap(true).setVerticalAlignment("middle").setBorder(true,true,true,true,true,true,BRAND.grey,SpreadsheetApp.BorderStyle.SOLID); sheet.getRange(18,1,guide.length,1).setFontWeight("bold").setFontColor(BRAND.blue); sheet.getRange(18, 2, 5, 7).mergeAcross(); sheet.setRowHeights(18,guide.length,42);
}

function appendBooking_(sheet, data, date, time, payment) {
  const bookingId = 'STW-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  const locationLabel = data.customer_location || 'None';
  const locationLink = data.customer_location_link || '';
  const row = [
    bookingId,
    new Date(),
    data.customer_name || '',
    data.phone || data.customer_phone || '',
    data.customer_email || data.customer_email_address || '',
    locationLink ? '=HYPERLINK("' + locationLink + '","Location")' : locationLabel,
    data.service || '',
    data.selected_items || '',
    payment && payment.serviceTotal !== null ? 'UGX ' + payment.serviceTotal : data.estimated_total || '',
    date,
    time,
    data.duration || '',
    'New',
    data.notes || '',
    'Website',
    payment ? (payment.paymentStatus === 'initiated' ? 'Payment Initiated' : 'Awaiting Payment') : 'Unpaid',
    0,
    payment ? (payment.serviceTotal === null ? '' : payment.serviceTotal) : sheetAmount_(data.estimated_total) ?? ''
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
  sheet.getRange(lastRow, 10).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(lastRow, 11).setNumberFormat('@');
  sheet.getRange(lastRow, 13).setFontWeight('bold').setBackground(BRAND.lightBlue);
  return bookingId;
}

// Shared by submissions, sheet verification, staff actions and booking aging.
function withBookingLock_(work) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return work(); }
  finally { try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); } }
}

function paymentAmount_(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

// Never parse the first number of a range, From price or indicative estimate.
function sheetAmount_(value) {
  if (typeof value === 'number') return paymentAmount_(value);
  const text = String(value == null ? '' : value).trim();
  if (!/^(?:UGX\s*)?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(text)) return null;
  return paymentAmount_(Number(text.replace(/^UGX\s*/, '').replace(/,/g, '')));
}

function paymentReference_(value) {
  const text = String(value == null ? '' : value).trim();
  return /^[A-Za-z0-9][A-Za-z0-9._ /-]{0,119}$/.test(text) ? text : '';
}

function normalizePayment_(raw, estimatedTotal) {
  if (raw == null) return null; // Preserve legacy booking and product integrations.
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid payment selection.');
  if (['deposit', 'full'].indexOf(raw.paymentType) === -1 || ['mtn', 'airtel'].indexOf(raw.providerKey) === -1) {
    throw new Error('Select deposit or full payment and MTN or Airtel.');
  }
  ['serviceTotal', 'paymentAmount', 'balanceRemaining'].forEach(function(field) {
    if (raw[field] != null && paymentAmount_(raw[field]) === null) throw new Error('Invalid payment amount: ' + field);
  });
  let total = raw.serviceTotal == null ? null : paymentAmount_(raw.serviceTotal);
  const estimate = sheetAmount_(estimatedTotal);
  if (total !== null && estimate !== null && total !== estimate) throw new Error('Payment total does not match booking total.');
  // Explicit price-review flags and labelled estimates cannot become a payable quote.
  if (raw.paymentPriceReviewRequired === true || (estimatedTotal && estimate === null)) total = null;
  const expected = total === null ? null : total * (raw.paymentType === 'deposit' ? 0.5 : 1);
  const amount = paymentAmount_(expected);
  if (amount !== null && raw.paymentAmount != null && amount !== raw.paymentAmount) throw new Error('Expected payment must match deposit/full calculation.');
  const state = raw.paymentStatus === 'initiated' ? 'initiated' : 'not_started';
  const initiated = typeof raw.paymentInitiatedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(raw.paymentInitiatedAt) ? new Date(raw.paymentInitiatedAt) : null;
  return {
    paymentType: raw.paymentType, providerKey: raw.providerKey,
    paymentProvider: raw.providerKey === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money',
    paymentStatus: state, serviceTotal: total, paymentAmount: amount,
    paymentReference: paymentReference_(raw.paymentReference),
    paymentInitiatedAt: state === 'initiated' && initiated && Number.isFinite(initiated.getTime()) && initiated.getTime() <= Date.now() + 300000 ? initiated : ''
  };
}

function appendPayment_(sheet, bookingId, payment) {
  const id = 'PAY-STW-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  sheet.appendRow([
    id, bookingId, new Date(), payment.paymentProvider, payment.providerKey,
    payment.paymentType, payment.paymentAmount === null ? '' : payment.paymentAmount, '',
    payment.serviceTotal === null ? '' : payment.serviceTotal, '', payment.paymentReference,
    payment.paymentStatus, 'Pending', payment.paymentInitiatedAt, '', '',
    'Browser payment state is not verification. Staff must check merchant records and the booking total.'
  ]);
  return id;
}

function stylePayments_(sheet) {
  styleHeader_(sheet, PAYMENT_HEADERS.length);
  sheet.setFrozenColumns(2);
  sheet.setColumnWidths(1, 2, 260);
  sheet.setColumnWidth(3, 160);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidths(5, 6, 135);
  sheet.setColumnWidth(11, 210);
  sheet.setColumnWidths(12, 2, 155);
  sheet.setColumnWidths(14, 3, 170);
  sheet.setColumnWidth(17, 420);
  const count = Math.max(1, sheet.getMaxRows() - 1);
  sheet.getRange(2, 1, count, PAYMENT_HEADERS.length).setWrap(true).setVerticalAlignment('middle');
  sheet.getRange(2, 7, count, 4).setNumberFormat('#,##0');
  sheet.getRange(2, 11, count, 1).setNumberFormat('@');
  sheet.getRange(2, 3, count, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange(2, 14, count, 2).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  const validation = SpreadsheetApp.newDataValidation().requireValueInList(['Pending', 'Verified', 'Mismatch', 'Failed', 'Cancelled'], true).setAllowInvalid(false).build();
  sheet.getRange(2, 13, count, 1).setDataValidation(validation);
}

function findPaymentBooking_(id) {
  const sheet = getSheet_(BOOKINGS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const matches = rows.map((row, index) => ({row: row, number: index + 1})).filter(item => item.number > 1 && String(item.row[0]).trim() === id);
  if (matches.length !== 1) return null;
  return {sheet: sheet, row: matches[0].row, number: matches[0].number, total: sheetAmount_(matches[0].row[8])};
}

function verifiedPaymentSum_(rows, bookingId, excludedRow) {
  let paid = 0;
  const references = new Set();
  rows.forEach(function(row, index) {
    if (index === 0 || index + 1 === excludedRow || String(row[1]).trim() !== bookingId || normalizeStatus_(row[12]) !== 'verified') return;
    const amount = sheetAmount_(row[7]);
    const reference = paymentReference_(row[10]);
    // A pasted status alone is not enough: only processed verification rows count.
    if (amount === null || amount <= 0 || amount !== sheetAmount_(row[6]) || !reference || !row[14] || !row[15]) return;
    const key = row[4] + ':' + reference.toUpperCase();
    if (references.has(key)) return;
    references.add(key);
    if (!Number.isSafeInteger(paid + amount)) throw new Error('Verified payment sum exceeds safe numeric range.');
    paid += amount;
  });
  return paid;
}

function recalculateBookingPayment_(bookingId) {
  const booking = findPaymentBooking_(bookingId);
  if (!booking) return;
  const rows = getSheet_(PAYMENTS_SHEET).getDataRange().getValues();
  const linked = rows.slice(1).filter(row => String(row[1]).trim() === bookingId);
  const paid = verifiedPaymentSum_(rows, bookingId);
  let status = linked.length ? 'Awaiting Payment' : 'Unpaid';
  if (linked.some(row => normalizeStatus_(row[11]) === 'initiated' && normalizeStatus_(row[12]) === 'pending')) status = 'Payment Initiated';
  if (linked.length && linked.every(row => ['failed', 'cancelled', 'mismatch'].indexOf(normalizeStatus_(row[12])) !== -1)) status = 'Payment Failed';
  if (paid > 0) status = booking.total !== null && paid >= booking.total ? 'Paid in Full' : 'Deposit Paid';
  booking.sheet.getRange(booking.number, 16, 1, 3).setValues([[status, paid, booking.total === null ? '' : Math.max(booking.total - paid, 0)]]);
  // Main booking Status (M) is intentionally untouched, including Cancelled.
}

// Install once using installPaymentEditTrigger(). triggerUid distinguishes the
// installable event from the automatic simple trigger in bound projects.
function onEdit(e) {
  if (!e || !e.range || !e.source || e.source.getId() !== SHEET_ID || !e.triggerUid) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== PAYMENTS_SHEET || e.range.getColumn() > 13 || e.range.getLastColumn() < 13 || e.range.getLastRow() < 2) return;
  return withBookingLock_(function() {
    for (let row = Math.max(2, e.range.getRow()); row <= e.range.getLastRow(); row++) verifyPaymentRow_(sheet, row, e);
  });
}

function verifyPaymentRow_(sheet, number, event) {
  const row = sheet.getRange(number, 1, 1, PAYMENT_HEADERS.length).getValues()[0];
  const bookingId = String(row[1] || '').trim();
  const status = normalizeStatus_(row[12]);
  if (status !== 'verified') {
    // Reversals remove the row from the sum and clear current verification markers.
    sheet.getRange(number, 10).setValue('');
    sheet.getRange(number, 15, 1, 2).setValues([['', '']]);
    recalculateBookingPayment_(bookingId);
    return;
  }
  const booking = findPaymentBooking_(bookingId);
  const expected = sheetAmount_(row[6]), actual = sheetAmount_(row[7]), reference = paymentReference_(row[10]);
  let reason = '';
  if (!bookingId || !booking) reason = 'Booking ID is missing, unknown or ambiguous.';
  else if (booking.total === null) reason = 'Confirm the exact service total in Bookings Estimated Total before verification.';
  else if (expected === null || expected <= 0) reason = 'Expected Amount must be a positive whole-shilling amount.';
  else if (actual === null || actual <= 0) reason = 'Transaction Amount must be a positive whole-shilling amount.';
  else if (actual !== expected) reason = 'Transaction Amount does not equal Expected Amount.';
  else if (!reference) reason = 'Transaction Reference is missing or invalid.';
  else if (['mtn', 'airtel'].indexOf(row[4]) === -1) reason = 'Provider Key must be mtn or airtel.';
  else if (['deposit', 'full'].indexOf(row[5]) === -1) reason = 'Payment Type must be deposit or full.';
  const rows = sheet.getDataRange().getValues();
  if (!reason && rows.some((other, index) => index > 0 && index + 1 !== number && other[4] === row[4] && paymentReference_(other[10]).toUpperCase() === reference.toUpperCase() && normalizeStatus_(other[12]) === 'verified')) {
    reason = 'This provider transaction reference is already used by another Verified payment.';
  }
  const paidBefore = booking ? verifiedPaymentSum_(rows, bookingId, number) : 0;
  if (!reason && !Number.isSafeInteger(paidBefore + actual)) reason = 'Verified payment sum exceeds safe numeric range.';
  if (!reason && booking.total !== null && paidBefore + actual > booking.total) reason = 'Verified payments cannot exceed the booking total.';
  if (reason) {
    sheet.getRange(number, 13).setValue('Mismatch');
    sheet.getRange(number, 15, 1, 2).setValues([['', '']]);
    sheet.getRange(number, 10).setValue('');
    sheet.getRange(number, 17).setValue(appendNote_(row[16], 'Verification blocked: ' + reason));
    recalculateBookingPayment_(bookingId);
    return;
  }
  let staff = '';
  try { staff = (event && event.user && event.user.getEmail()) || Session.getActiveUser().getEmail(); } catch (error) { /* Identity may be unavailable to the trigger. */ }
  if (!row[0]) sheet.getRange(number, 1).setValue('PAY-STW-' + Utilities.getUuid());
  if (!row[2]) sheet.getRange(number, 3).setValue(new Date());
  sheet.getRange(number, 4).setValue(row[4] === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money');
  sheet.getRange(number, 9, 1, 2).setValues([[Math.max(booking.total - paidBefore, 0), Math.max(booking.total - paidBefore - actual, 0)]]);
  sheet.getRange(number, 13).setValue('Verified');
  sheet.getRange(number, 15, 1, 2).setValues([[new Date(), staff || 'Sheet staff']]);
  recalculateBookingPayment_(bookingId);
}

function paymentRowForStaff_(row) { return { paymentId:String(row[0] || ""), bookingId:String(row[1] || ""), provider:String(row[3] || ""), providerKey:String(row[4] || ""), paymentType:String(row[5] || ""), expectedAmount:sheetAmount_(row[6]), transactionAmount:sheetAmount_(row[7]), transactionReference:String(row[10] || ""), providerStatus:String(row[11] || ""), verificationStatus:String(row[12] || ""), initiatedAt:row[13] || "", verifiedAt:row[14] || "" }; }

function bookingForStaff_(booking) { const row=booking.row; return { bookingId:String(row[0] || ""), location:String(row[5] || ""), customerName:String(row[2] || ""), phone:String(row[3] || ""), email:String(row[4] || ""), service:String(row[6] || ""), selectedItems:String(row[7] || ""), total:booking.total, preferredDate:normalizeDate_(row[9]), preferredTime:normalizeTime_(row[10]), bookingStatus:String(row[12] || ""), paymentStatus:String(row[15] || ""), amountPaid:sheetAmount_(row[16]) || 0, balance:sheetAmount_(row[17]), notes:String(row[13] || "") }; }

function findPaymentByReference_(params) {
  const reference = paymentReference_(params && params.reference);
  if (!reference) return { ok:false, error:"No payment was found with that transaction reference." };
  const rows = getSheet_(PAYMENTS_SHEET).getDataRange().getValues();
  const matches = rows.map(function(row,index) { return {row:row,number:index+1}; }).filter(function(item) { return item.number > 1 && paymentReference_(item.row[10]).toUpperCase() === reference.toUpperCase(); });
  if (!matches.length) return { ok:false, error:"No payment was found with that transaction reference." };
  if (matches.length > 1) return { ok:false, error:"Multiple payments use that reference. Check the Payments sheet." };
  const payment = matches[0].row;
  const booking = findPaymentBooking_(String(payment[1] || "").trim());
  if (!booking) return { ok:false, error:"The payment was found, but its linked booking could not be found." };
  return { ok:true, payment:paymentRowForStaff_(payment), booking:bookingForStaff_(booking) };
}

function verifyPaymentFromStaff_(params) {
  return withBookingLock_(function() {
    const reference = paymentReference_(params && params.reference);
    if (!reference) return { ok:false, error:"Enter a valid transaction reference." };
    const rows = getSheet_(PAYMENTS_SHEET).getDataRange().getValues();
    const matches = rows.map(function(row,index) { return {row:row,number:index+1}; }).filter(function(item) { return item.number > 1 && paymentReference_(item.row[10]).toUpperCase() === reference.toUpperCase(); });
    if (!matches.length) return { ok:false, error:"No payment was found with that transaction reference." };
    if (matches.length > 1) return { ok:false, error:"Multiple payments use that reference. Check the Payments sheet." };
    const match = matches[0];
    const sheet = getSheet_(PAYMENTS_SHEET);
    const actual = sheetAmount_(params.amount);
    sheet.getRange(match.number, 8).setValue(actual === null ? String(params.amount || "") : actual);
    sheet.getRange(match.number, 13).setValue("Verified");
    verifyPaymentRow_(sheet, match.number, { user:{ getEmail:function() { return "Manage Booking page"; } } });
    const updated = sheet.getRange(match.number, 1, 1, PAYMENT_HEADERS.length).getValues()[0];
    const booking = findPaymentBooking_(String(updated[1] || "").trim());
    if (normalizeStatus_(updated[12]) !== "verified") return { ok:false, error:String(updated[16] || "Payment verification was blocked."), payment:paymentRowForStaff_(updated), booking:booking ? bookingForStaff_(booking) : null };
    return { ok:true, payment:paymentRowForStaff_(updated), booking:booking ? bookingForStaff_(booking) : null };
  });
}

function installPaymentEditTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'onEdit' && trigger.getTriggerSourceId() === SHEET_ID) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('onEdit').forSpreadsheet(SHEET_ID).onEdit().create();
}

function getAvailabilityPayload_() {
  const bookings = getSheet_(BOOKINGS_SHEET).getDataRange().getValues();
  const availability = getSheet_(AVAILABILITY_SHEET).getDataRange().getValues();
  const bookedSlots = [];
  const closedDays = [];
  const blockedSlots = [];

  bookings.slice(1).forEach((row) => {
    const date = normalizeDate_(row[9]);
    const time = normalizeTime_(row[10]);
    const status = normalizeStatus_(row[12]);
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

function handleBookingAction_(params) {
  return withBookingLock_(function() { return applyBookingAction_(params); });
}

function applyBookingAction_(params) {
  const bookingId = String(params.id || '').trim();
  const status = displayStatus_(params.status || '');
  // Public booking actions cannot verify a transaction or mark it paid.
  if (status === 'Paid') return { ok: false, error: 'Payment verification requires server-side reconciliation.' };
  if (!bookingId) return { ok: false, error: 'Booking ID is required.' };
  if (!status) return { ok: false, error: 'A valid status is required.' };

  const sheet = getSheet_(BOOKINGS_SHEET);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === bookingId) {
      const rowNumber = i + 1;
      sheet.getRange(rowNumber, 13).setValue(status);
      sheet.getRange(rowNumber, 14).setValue(appendNote_(values[i][13], 'Staff action: ' + status + ' at ' + new Date()));
      return {
        ok: true,
        booking_id: bookingId,
        status: status,
        message: 'Booking ' + bookingId + ' updated to ' + status + '.'
      };
    }
  }
  return { ok: false, error: 'Booking was not found.', booking_id: bookingId };
}

function updateBookingAging_() {
  return withBookingLock_(ageBookings_);
}

function ageBookings_() {
  const sheet = getSheet_(BOOKINGS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return;

  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, BOOKING_HEADERS.length);
  const values = range.getValues();
  const now = new Date().getTime();
  let changed = false;

  values.forEach(function(row) {
    const createdAt = row[1];
    const status = normalizeStatus_(row[12]);
    if (status !== 'new' && status !== 'pending') return;
    if (Object.prototype.toString.call(createdAt) !== '[object Date]') return;

    const ageMinutes = (now - createdAt.getTime()) / 60000;
    const paymentProtected = ['deposit paid', 'paid in full'].indexOf(normalizeStatus_(row[15])) !== -1;
    if (ageMinutes >= AUTO_CANCEL_AFTER_MINUTES && !paymentProtected) {
      row[12] = 'Cancelled';
      row[13] = appendNote_(row[13], 'Auto-cancelled after 1 hour with no staff confirmation.');
      changed = true;
    } else if (status === 'new' && ageMinutes >= AUTO_PENDING_AFTER_MINUTES) {
      row[12] = 'Pending';
      row[13] = appendNote_(row[13], 'Auto-moved to Pending after 1 minute.');
      changed = true;
    }
  });

  // Never rewrite payment summaries or other booking fields from an aging snapshot.
  if (changed) values.forEach((row, index) => sheet.getRange(index + 2, 13, 1, 2).setValues([[row[12], row[13]]]));
}

function runBookingAging() {
  setupWorkbook_();
  updateBookingAging_();
}

function installBookingAgingTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runBookingAging') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('runBookingAging')
    .timeBased()
    .everyMinutes(1)
    .create();
}

function displayStatus_(value) {
  const status = normalizeStatus_(value);
  const statuses = {
    new: 'New',
    pending: 'Pending',
    booked: 'Booked',
    confirmed: 'Confirmed',
    paid: 'Paid',
    completed: 'Completed',
    cancelled: 'Cancelled',
    reschedule: 'Reschedule',
    free: 'Free'
  };
  return statuses[status] || '';
}

function appendNote_(existing, note) {
  const current = String(existing || '').trim();
  return current ? current + '\n' + note : note;
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
    .requireValueInList(['New', 'Pending', 'Booked', 'Confirmed', 'Paid', 'Completed', 'Cancelled', 'Reschedule', 'Free'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, col, Math.max(1, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
}

function applyAvailabilityValidation_(sheet, col) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['blocked', 'closed', 'not available', 'free'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, col, Math.max(1, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
}

function applyBookingConditionalFormatting_(sheet) {
  const range = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), BOOKING_HEADERS.length);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$M2="New"').setBackground(BRAND.lightBlue).setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$M2="Pending"').setBackground(BRAND.softWarm).setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=OR($M2="Confirmed",$M2="Paid")').setBackground(BRAND.green).setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=OR($M2="Cancelled",$M2="Free",$M2="Reschedule")').setBackground(BRAND.red).setRanges([range]).build()
  ];
  sheet.setConditionalFormatRules(rules);
}

function applyAvailabilityConditionalFormatting_(sheet) {
  const range = sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), AVAILABILITY_HEADERS.length);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=OR($C2="blocked",$C2="closed",$C2="not available")').setBackground(BRAND.red).setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2="free"').setBackground(BRAND.green).setRanges([range]).build()
  ];
  sheet.setConditionalFormatRules(rules);
}

function sendBookingEmail_(data) {
  const htmlBody = fallbackEmail_(data);
  const ss = SpreadsheetApp.openById(SHEET_ID);
  MailApp.sendEmail({
    to: SALON_EMAIL,
    subject: data.subject || 'New Stuwie booking request',
    htmlBody: htmlBody + staffActionHtml_(data) + '<p style="font-family:Arial,sans-serif;font-size:12px;color:#666;margin-top:18px;">Saved to Google Sheet: <a href="' + ss.getUrl() + '">Open bookings sheet</a></p>',
    replyTo: data.customer_email || undefined,
    name: "Stuwie's Website Bookings"
  });
}

function staffActionHtml_(data) {
  const bookingId = data.booking_id || '';
  const manageUrl = manageBookingUrl_(bookingId, data);
  return '<div style="font-family:Arial,sans-serif;margin-top:22px;padding:16px;border:1px solid #d7e6f2;background:#f5f9fc;"><h3 style="margin:0 0 8px;color:#0064b4;">Staff Actions</h3><p style="margin:0 0 8px;color:#333;">New requests move to Pending after 1 minute and may be cancelled after 1 hour if not confirmed. Verified Deposit Paid and Paid in Full bookings are protected from automatic cancellation. Payment initiation is not verification; review and verify money separately in the Payments sheet. Manage Booking controls appointments only.</p><a href="' + manageUrl + '" style="display:inline-block;margin:6px 6px 0 0;background:#0064b4;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:6px;font-weight:bold;font-family:Arial,sans-serif;font-size:13px;">Manage Booking</a></div>';
}

function actionUrl_(bookingId, status) {
  const base = ScriptApp.getService().getUrl();
  return base + '?action=booking_action&id=' + encodeURIComponent(bookingId) + '&status=' + encodeURIComponent(status);
}

function manageBookingUrl_(bookingId, data) {
  const params = {
    id: bookingId,
    app: ScriptApp.getService().getUrl(),
    name: data.customer_name || '',
    phone: data.phone || data.customer_phone || '',
    email: data.customer_email || '',
    service: data.service || '',
    items: data.selected_items || '',
    total: data.estimated_total || '',
    date: data.preferred_date || '',
    time: data.preferred_time || '',
    location: data.customer_location || '',
    location_url: data.customer_location_link || '',
    notes: data.notes || '',
    payment_type: data.payment && data.payment.paymentType === 'deposit' ? 'Deposit' : data.payment && data.payment.paymentType === 'full' ? 'Full' : '',
    payment_provider: data.payment && data.payment.providerKey === 'mtn' ? 'MTN Mobile Money' : data.payment && data.payment.providerKey === 'airtel' ? 'Airtel Money' : '',
    expected_amount: data.payment && data.payment.paymentAmount != null ? data.payment.paymentAmount : '',
    amount_paid: 0,
    balance: data.payment && data.payment.serviceTotal != null ? data.payment.serviceTotal : sheetAmount_(data.estimated_total) || '',
    payment_status: data.payment && data.payment.paymentStatus === 'initiated' ? 'Payment Initiated' : data.payment ? 'Awaiting Payment' : 'Unpaid'
  };
  const query = Object.keys(params)
    .map(function(key) { return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]); })
    .join('&');
  return CONFIRM_PAGE_URL + '?' + query;
}

function fallbackEmail_(data) {
  const p = data.payment || {};
  const total = p.serviceTotal != null ? p.serviceTotal : sheetAmount_(data.estimated_total);
  const expected = p.paymentAmount != null ? p.paymentAmount : "Not available";
  const type = p.paymentType === "deposit" ? "Deposit" : p.paymentType === "full" ? "Full" : "Not selected";
  const provider = p.providerKey === "mtn" ? "MTN Mobile Money" : p.providerKey === "airtel" ? "Airtel Money" : "Not selected";
  const state = p.paymentStatus === "initiated" ? "Payment Initiated" : p ? "Awaiting Payment" : "Unpaid";
  const money = function(v) { return v == null || v === "" ? "Not available" : "UGX " + Number(v).toLocaleString("en-US"); };
  const row = function(label, value) { return "<p>" + label + ": <strong>" + value + "</strong></p>"; };
  return "<div><h1>STUWIE SALON &amp; SPA</h1><h2>New Booking Request</h2><p>Booking ID: <strong>" + escape_(data.booking_id || "Pending") + "</strong></p><h3>CUSTOMER DETAILS</h3>" + row("Name", escape_(data.customer_name)) + row("Phone", escape_(data.phone || data.customer_phone || "")) + row("Email", escape_(data.customer_email || "")) + row("Location", escape_(data.customer_location || "None")) + "<h3>APPOINTMENT DETAILS</h3>" + row("Services", escape_(data.selected_items || data.service || "Not provided")) + row("Date", escape_(data.preferred_date)) + row("Time", escape_(data.preferred_time)) + row("Professional", escape_(data.professional || data.professional_name || "No preference")) + row("Notes", escape_(data.notes || "None")) + "<h3>PAYMENT SUMMARY</h3>" + row("Payment Type", type) + row("Provider", provider) + row("Expected Amount", money(expected)) + row("Amount Paid", money(0)) + row("Balance", money(total)) + row("Payment Status", state) + "</div>";
}

function fallbackEmailLegacy_(data) {
  const phone = data.phone || data.customer_phone || '';
  const email = data.customer_email || '';
  const location = data.customer_location_link ? '<a href="' + escape_(data.customer_location_link) + '">Location</a>' : escape_(data.customer_location || 'None');
  return [
    '<h2>New Stuwie booking request</h2>',
    '<p><strong>Name:</strong> ' + escape_(data.customer_name) + '</p>',
    '<p><strong>Phone:</strong> ' + escape_(phone) + '</p>',
    '<p><strong>Email:</strong> ' + escape_(email) + '</p>',
    '<p><strong>Location:</strong> ' + location + '</p>',
    '<p><strong>Items:</strong><br>' + escape_(data.selected_items).replace(/\n/g, '<br>') + '</p>',
    '<p><strong>Date/Time:</strong> ' + escape_(data.preferred_date) + ' ' + escape_(data.preferred_time) + '</p>',
    '<p><strong>Notes:</strong> ' + escape_(data.notes) + '</p>'
  ].join('');
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
