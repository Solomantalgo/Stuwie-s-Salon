// All Apps Script traffic is mocked; no live bookings are sent.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/tmp/mobile-hero-check/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/tmp/trial-builder-browser/chrome-linux/headless_shell',args:['--no-sandbox']});
 const context=await browser.newContext();let calls=0,posts=0,mode='hold';const pending=[],errors=[];
 const response={ok:true,closed_days:[],booked_slots:[],blocked_slots:[]};
 async function respond(route){const url=new URL(route.request().url());return route.fulfill({contentType:'text/javascript',body:`${url.searchParams.get('callback')}(${JSON.stringify(response)})`});}
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='script.google.com'){
   if(route.request().method()==='POST'){posts++;return route.fulfill({body:'{}'});}
   calls++;if(mode==='hold'){pending.push(route);return;}if(mode==='fail')return route.abort();return respond(route);
  }
  if(url.hostname!=='booking.test')return route.abort();
  const file=path.join(__dirname,'..',url.pathname);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
  return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'image/png'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const next=()=>page.locator('#journey-form button[type=submit]').click();
 async function reachTime(){await next();await next();await page.locator('#date').fill('2026-10-10');await next();}
 // The page renders while its initial request is deliberately held open.
 await page.goto('http://booking.test/bookings.html?service=Hair%20Cut',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('script[src*="action=availability"]'));
 await reachTime();assert.equal(calls,1);assert.match(await page.locator('#step-body').innerText(),/Checking appointment times/);
 await page.locator('#back').click();await next();assert.equal(calls,1);
 await respond(pending.shift());await page.locator('[name=time][value="10:00"]').check();assert.equal(calls,1);
 await page.locator('#back').click();await next();await page.locator('[name=time][value="10:00"]').waitFor();assert.equal(await page.locator('[name=time][value="10:00"]').count(),1);assert.equal(calls,1);
 // Fresh check at submission must catch a slot taken since prefetch.
 await page.locator('[name=time][value="10:00"]').check();await next();await page.locator('#name').fill('Availability QA');await page.locator('#phone').fill('0700000000');await page.locator('#email').fill('qa@example.com');await next();await next();await page.locator('[name=consent]').check();await next();await page.locator('[name=paymentType][value=deposit]').check();await page.locator('[name=paymentProvider][value=mtn]').check();
 response.booked_slots=[{date:'2026-10-10',time:'10:00'}];mode='open';await next();await page.getByText('That time is no longer available. Please choose another time.').waitFor();assert.equal(calls,2);assert.equal(posts,0);
 // Each new page requests again. Initial failure is retained until explicit Retry.
 mode='fail';await page.goto('http://booking.test/bookings.html?service=Hair%20Cut');await reachTime();await page.locator('#retry-availability').waitFor();assert.equal(calls,3);assert.match(await page.locator('#step-body').innerText(),/Availability could not be checked/);
 await page.locator('#back').click();await next();assert.equal(calls,3);
 mode='hold';await page.locator('#retry-availability').click();await page.waitForFunction(()=>!!document.querySelector('script[src*="action=availability"]'));await page.locator('#back').click();await next();assert.equal(calls,4);
 response.booked_slots=[];await respond(pending.shift());await page.locator('[name=time][value="10:00"]').waitFor();assert.equal(calls,4);
 // Reload gets fresh data, already loaded before entering Time.
 mode='open';await page.reload();await reachTime();assert.equal(await page.locator('.availability-check').count(),1);assert.equal(await page.locator('#journey-form button[type=submit]').isDisabled(),true);await page.locator('[name=time][value="10:00"]').waitFor();assert.equal(calls,5);assert.doesNotMatch(await page.locator('#step-body').innerText(),/Checking appointment times/);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: nonblocking page-load prefetch, one shared in-flight request, cached in-memory display, failure/retry recovery, fresh reload and final conflict check.');
})().catch(e=>{console.error(e);process.exit(1)});
