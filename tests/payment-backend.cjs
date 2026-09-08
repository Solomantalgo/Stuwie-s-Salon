// Offline Apps Script workbook emulator. No Google calls, emails or live writes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
class Range {
 constructor(sheet,r,c,n=1,m=1){Object.assign(this,{sheet,r,c,n,m});assert.ok(r>0&&c>0&&n>0&&m>0);}
 getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sheet.rows[this.r+i-1]?.[this.c+j-1]??''));}
 setValues(values){assert.equal(values.length,this.n);values.forEach((row,i)=>{assert.equal(row.length,this.m);row.forEach((v,j)=>{const target=this.sheet.rows[this.r+i-1]??=[];target[this.c+j-1]=v;});});return this;}
 setValue(v){return this.n===1 && this.m===1 ? this.setValues([[v]]) : this;}getSheet(){return this.sheet;}getColumn(){return this.c;}getLastColumn(){return this.c+this.m-1;}getRow(){return this.r;}getLastRow(){return this.r+this.n-1;}
}
for(const name of ['setBackground','setFontColor','setFontWeight','setVerticalAlignment','setHorizontalAlignment','setWrap','setBorder','setNumberFormat','setDataValidation','merge','mergeAcross','setFormula','setFontSize'])Range.prototype[name]=function(){return this;};
class Sheet {constructor(name,rows=[]){this.name=name;this.rows=rows;}getName(){return this.name;}getLastRow(){return this.rows.length;}getMaxRows(){return 100;}getRange(...args){if(typeof args[0] === "string"){const first=args[0].match(/([A-Z]+)(\d+)/); const last=args[0].match(/:([A-Z]+)(\d+)/); const col=x=>x.split("").reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0); args=[Number(first[2]),col(first[1]),last?Number(last[2])-Number(first[2])+1:1,last?col(last[1])-col(first[1])+1:1];} return new Range(this,...args);}getDataRange(){return this.getRange(1,1,Math.max(1,this.rows.length),Math.max(1,...this.rows.map(r=>r.length)));}appendRow(r){this.rows.push([...r]);}clear(){throw Error('Must not clear live data');}}
for(const name of ['setFrozenRows','setFrozenColumns','setColumnWidth','setColumnWidths','setRowHeight','setRowHeights','setConditionalFormatRules'])Sheet.prototype[name]=function(){return this;};
const sheets=new Map();let locked=false,emails=0,triggerCreates=0;
const workbook={getId:()=>id,getSheetByName:n=>sheets.get(n),insertSheet:n=>{const sheet=new Sheet(n);sheets.set(n,sheet);return sheet;},getUrl:()=> 'https://test.invalid/workbook'};
function chain(){return new Proxy({}, {get:(target,key)=>key==='build'?()=>({}):()=>chain()});}
const sandbox={console,Date,Set,Number,LockService:{getScriptLock:()=>({waitLock:()=>{assert.equal(locked,false);locked=true;},releaseLock:()=>{locked=false;}})},SpreadsheetApp:{openById:()=>workbook,flush:()=>{},BorderStyle:{SOLID:'solid'},newDataValidation:chain,newConditionalFormatRule:chain},Session:{getScriptTimeZone:()=> 'Africa/Kampala',getActiveUser:()=>({getEmail:()=>''})},Utilities:{getUuid:()=>crypto.randomUUID(),formatDate:()=> '20260907-152746'},MailApp:{sendEmail:()=>emails++},ScriptApp:{getService:()=>({getUrl:()=> 'https://test.invalid/app'}),getProjectTriggers:()=>[],newTrigger:()=>({forSpreadsheet:()=>({onEdit:()=>({create:()=>triggerCreates++})})})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}};
const context=vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../apps-script-booking.gs'),'utf8'),context);
const id=vm.runInContext('SHEET_ID',context),headers=Array.from(vm.runInContext('BOOKING_HEADERS',context)),pheaders=Array.from(vm.runInContext('PAYMENT_HEADERS',context));
assert.equal(headers.length,18);assert.deepEqual(headers.slice(15),['Payment Status','Amount Paid','Balance']);
assert.deepEqual(pheaders,['Payment ID','Booking ID','Created At','Provider','Provider Key','Payment Type','Expected Amount','Transaction Amount','Balance Before','Balance After','Transaction Reference','Provider Status','Verification Status','Initiated At','Verified At','Verified By','Notes']);
const historical=['OLD',new Date('2020-01-01'),'Historical','','','','','','UGX 100,000','','','','Cancelled','Keep historical notes','Website','Unpaid',0,100000];
sheets.set('Bookings',new Sheet('Bookings',[headers,[...historical]]));sheets.set('Payments',new Sheet('Payments',[pheaders]));sheets.set('Availability',new Sheet('Availability',[['Date','Time','Status','Reason / Note','Updated At'],['2035-01-01','all_day','closed','Keep closure',new Date()]]));sheets.set('Dashboard',new Sheet('Dashboard',[['Area','How to Use'],['Staff notes','Keep me']]));sheets.set('Form Responses 1',new Sheet('Form Responses 1',[['Original'],['Keep response']]));
const bookings=sheets.get('Bookings'),payments=sheets.get('Payments');
const input=(overrides={})=>({paymentType:'deposit',providerKey:'mtn',paymentProvider:'Untrusted label',paymentStatus:'initiated',serviceTotal:100000,paymentAmount:50000,balanceRemaining:50000,paymentInitiatedAt:'2026-01-01T10:00:00Z',...overrides});
const data=(payment=input())=>({customer_name:'Offline QA',customer_email:'qa@example.invalid',preferred_date:'2030-01-01',preferred_time:'10:00',estimated_total:'UGX 100,000',payment});
let sequence=0;
function submit(payment=input()){const d=data(payment);d.preferred_date='2030-01-'+String(++sequence).padStart(2,'0');const result=context.doPost({postData:{contents:JSON.stringify(d)}});assert.equal(result.ok,true,JSON.stringify(result));return result.booking_id;}
function booking(bid){return bookings.rows.find(r=>r[0]===bid);}
function edit(number,status='Verified',extra={}){payments.getRange(number,13).setValue(status);context.onEdit({source:workbook,range:payments.getRange(number,13),triggerUid:'installed',authMode:'LIMITED',user:{getEmail:()=> 'staff@example.invalid'},...extra});}
function newPayment(bid,amount,reference){context.appendPayment_(payments,bid,context.normalizePayment_(input({paymentAmount:50000}),'UGX 100,000'));const number=payments.getLastRow();payments.getRange(number,7).setValue(amount);payments.getRange(number,8).setValue(amount);payments.getRange(number,11).setValue(reference);return number;}
// A: POST creates a linked Pending payment with full unpaid balance.
const bid=submit(),first=payments.getLastRow();assert.deepEqual(booking(bid).slice(15),['Payment Initiated',0,100000]);assert.equal(payments.rows[first-1][1],bid);assert.equal(payments.rows[first-1][6],50000);assert.equal(payments.rows[first-1][7],'');assert.equal(payments.rows[first-1][8],100000);assert.equal(payments.rows[first-1][12],'Pending');assert.equal(payments.rows[first-1][3],'MTN Mobile Money');assert.match(payments.rows[first-1][0],/^PAY-STW-\d{8}-\d{6}-[a-f0-9]{8}$/);assert.equal(emails,1);
// B: Exact confirmed deposit.
payments.getRange(first,8).setValue(50000);payments.getRange(first,11).setValue('QA-MTN-20260907-001');edit(first);assert.deepEqual(booking(bid).slice(15),['Deposit Paid',50000,50000]);assert.equal(booking(bid)[12],'New');assert.equal(payments.rows[first-1][9],50000);assert.equal(payments.rows[first-1][15],'staff@example.invalid');assert.ok(payments.rows[first-1][14] instanceof Date);
// Idempotence: processing Verified again never doubles the payment.
edit(first);assert.equal(booking(bid)[16],50000);
// C: Another linked transaction completes the booking payment.
const second=newPayment(bid,50000,'QA-MTN-20260907-002');edit(second);assert.deepEqual(booking(bid).slice(15),['Paid in Full',100000,0]);assert.deepEqual(payments.rows[second-1].slice(8,10),[50000,0]);
// D/E: mismatch and missing reference never credit money.
const mismatch=newPayment(bid,50000,'QA-MTN-MISMATCH');payments.getRange(mismatch,8).setValue(40000);edit(mismatch);assert.equal(payments.rows[mismatch-1][12],'Mismatch');assert.match(payments.rows[mismatch-1][16],/does not equal/);assert.equal(booking(bid)[16],100000);
const missing=newPayment(bid,50000,'');edit(missing);assert.equal(payments.rows[missing-1][12],'Mismatch');assert.match(payments.rows[missing-1][16],/Reference/);assert.equal(booking(bid)[16],100000);
// Duplicate references cannot be credited, even across bookings.
const duplicate=newPayment(bid,50000,'QA-MTN-20260907-001');edit(duplicate);assert.equal(payments.rows[duplicate-1][12],'Mismatch');assert.equal(booking(bid)[16],100000);
// F: browser success words and claimed verified fields cannot verify a payment.
for(const state of ['verified','paid','successful']){const b=submit(input({paymentStatus:state,paymentVerifiedAt:'2020-01-01'}));assert.deepEqual(booking(b).slice(15),['Awaiting Payment',0,100000]);const r=payments.rows.at(-1);assert.equal(r[11],'not_started');assert.equal(r[12],'Pending');assert.equal(r[14],'');assert.equal(r[15],'');}
for(const bad of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'50000',0.5])assert.throws(()=>context.normalizePayment_(input({paymentAmount:bad}),'UGX 100,000'));
assert.throws(()=>context.normalizePayment_(input({providerKey:'cash'}),'UGX 100,000'));assert.throws(()=>context.normalizePayment_(input({paymentType:'later'}),'UGX 100,000'));
// G/H: verified deposit preserves New/Pending slot, but never revives Cancelled.
const protectedId=submit(),protectedRow=payments.getLastRow();payments.getRange(protectedRow,8).setValue(50000);payments.getRange(protectedRow,11).setValue('QA-PROTECTED');edit(protectedRow);booking(protectedId)[1]=new Date(Date.now()-7200000);context.updateBookingAging_();assert.equal(booking(protectedId)[12],'Pending');assert.equal(booking(protectedId)[16],50000);
booking(protectedId)[12]='Cancelled';edit(protectedRow);assert.equal(booking(protectedId)[12],'Cancelled');context.updateBookingAging_();assert.equal(booking(protectedId)[12],'Cancelled');
const unpaid=submit();booking(unpaid)[1]=new Date(Date.now()-7200000);context.updateBookingAging_();assert.equal(booking(unpaid)[12],'Cancelled');
// Reversing verification subtracts the payment; failed payments never count.
edit(second,'Pending');assert.deepEqual(booking(bid).slice(15),['Deposit Paid',50000,50000]);edit(second);assert.equal(booking(bid)[16],100000);
// Missing staff identity gets a useful fallback.
edit(second,'Pending');edit(second,'Verified',{user:undefined});assert.equal(payments.rows[second-1][15],'Sheet staff');
// Amounts for variable-price bookings stay unknown until staff confirms the quote.
const variable=context.normalizePayment_(input({serviceTotal:null,paymentAmount:null,balanceRemaining:null}),'From UGX 100,000/person');assert.equal(variable.paymentAmount,null);const variableId=context.appendBooking_(bookings,{estimated_total:'From UGX 100,000/person'},'2030-02-01','10:00',variable);context.appendPayment_(payments,variableId,variable);assert.equal(booking(variableId)[17],'');const vn=payments.getLastRow();payments.getRange(vn,7).setValue(50000);payments.getRange(vn,8).setValue(50000);payments.getRange(vn,11).setValue('QA-QUOTE');edit(vn);assert.equal(payments.rows[vn-1][12],'Mismatch');assert.equal(booking(variableId)[16],0);
// Non-M edits and automatic simple trigger must not execute verification.
const untouched=newPayment(bid,50000,'QA-UNTOUCHED');payments.getRange(untouched,13).setValue('Verified');context.onEdit({source:workbook,range:payments.getRange(untouched,8),triggerUid:'installed'});assert.equal(payments.rows[untouched-1][14],'');context.onEdit({source:workbook,range:payments.getRange(untouched,13)});assert.equal(payments.rows[untouched-1][14],'');payments.getRange(untouched,13).setValue('Pending');
// Full payers also remain blocked after the aging deadline.
booking(bid)[1]=new Date(Date.now()-7200000);context.updateBookingAging_();assert.equal(booking(bid)[12],'Pending');assert.equal(booking(bid)[15],'Paid in Full');
// Unknown linkage, missing expected amount and invalid references fail closed.
const invalidLink=newPayment('MISSING-BOOKING',50000,'QA-NO-BOOKING');edit(invalidLink);assert.equal(payments.rows[invalidLink-1][12],'Mismatch');
const missingExpected=newPayment(bid,50000,'QA-NO-EXPECTED');payments.getRange(missingExpected,7).setValue('');edit(missingExpected);assert.equal(payments.rows[missingExpected-1][12],'Mismatch');
assert.equal(context.paymentReference_('=HYPERLINK(1)'), '');
// Multi-row M edits reconcile all rows; values already present without audit stamps don't count early.
const batchId=submit(),batch1=payments.getLastRow();payments.getRange(batch1,8).setValue(50000);payments.getRange(batch1,11).setValue('QA-BATCH-1');const batch2=newPayment(batchId,50000,'QA-BATCH-2');payments.getRange(batch1,13).setValue('Verified');payments.getRange(batch2,13).setValue('Verified');context.onEdit({source:workbook,range:payments.getRange(batch1,13,2,1),triggerUid:'installed'});assert.deepEqual(booking(batchId).slice(15),['Paid in Full',100000,0]);
assert.equal(context.handleBookingAction_({id:bid,status:'Paid'}).ok,false);context.installPaymentEditTrigger();assert.equal(triggerCreates,1);
context.setupWorkbook_();assert.deepEqual(bookings.rows[1],historical);assert.equal(sheets.get('Form Responses 1').rows[1][0],'Keep response');assert.equal(locked,false);assert.equal(new Set(payments.rows.slice(1).map(r=>r[0])).size,payments.rows.length-1);
console.log('PASS: exact schemas and preserved data; A–H; linked POST rows, forged success, unsafe amounts, multiple payments, mismatch/reference validation, duplicate transactions, idempotence/reversal, staff identity, variable quotes, trigger filtering and protected aging. No live calls.');
