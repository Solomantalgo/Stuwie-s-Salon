/* Guided booking: existing cart format, availability API and booking payload. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = value => 'UGX ' + Number(value).toLocaleString('en-US');
  const key = 'stuwiesBookingCart';
  const catalogue = window.STUWIES_SERVICES;
  const team = window.STUWIES_TEAM;
  const config = window.STUWIES_CONFIG || {};
  const categories = [...new Set(catalogue.map(item => item.category))];
  const steps = ['Category','Service','Professional','Date','Time','Details','Notes','Review','Payment'];
  const titles = ['What brings you in?','Choose your services','Choose your professional','A day that works for you','Choose your preferred time','A little about you','Make it personal','Review your visit','Payment details'];
  const params = new URLSearchParams(location.search);
  const professional = team.find(person => person.id === params.get('professional'));
  let cart = readCart(), step = 0, busy = false, availability = null, availabilityLoading = false, availabilityError = '', loadId = 0;
  let complete = false, completedPayload = null;
  const draft = {category:professional?.categories[0] || cart[0]?.category || categories[0],professional:professional?.id || 'any',date:'',time:'',name:'',phone:'',email:'',location:'',locationCoords:'',notes:'',paymentType:'later',paymentReference:'',paymentPhone:'',paymentProvider:'MTN Mobile Money',consent:false};
  const entry = params.get('service');
  const selected = catalogue.find(item => item.name === entry);
  if (selected) { if (!cart.some(item=>item.name===selected.name)) cart.push({...selected}); draft.category=selected.category; step=1; saveCart(); }
  else if (categories.includes(entry)) { draft.category=entry; step=1; }
  else if (entry==='Package' || entry==='Spa Packages') {draft.category='Spa Packages';step=1;}
  else if (cart.length) step=1;
  function readCart() {
    try { const value=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(value)?value.filter(item=>item && typeof item.name==='string' && typeof item.price==='string').map(item=>({...item,key:item.key||[item.category,item.name,item.duration||'',item.price].join('|')})):[]; } catch { return []; }
  }
  function saveCart() { try { if(cart.length)localStorage.setItem(key,JSON.stringify(cart));else localStorage.removeItem(key); } catch { /* Current page can still submit the selected services. */ } }
  function amount(item) { return Number(String(item.price).match(/\d[\d,]*/)?.[0].replace(/,/g,'') || 0); }
  function total() { return cart.reduce((sum,item)=>sum+amount(item),0); }
  function fixedPrices() { return cart.length>0 && cart.every(item=>/^(?:UGX\s*)?[\d,]+$/.test(item.price.trim()) && amount(item)>0); }
  function compatible() { return team.filter(person=>cart.some(item=>person.categories.includes(item.category))); }
  function personName() { return team.find(person=>person.id===draft.professional)?.name || 'No preference — salon to assign'; }
  function normalizeProfessional() { if(draft.professional!=='any'&&!compatible().some(person=>person.id===draft.professional))draft.professional='any'; }
  function today() { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kampala',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-'); }
  function maxDate() { const date=new Date(today()+'T12:00:00Z');date.setMonth(date.getMonth()+6);return date.toISOString().slice(0,10); }
  function future(date,time) { return new Date(`${date}T${time}:00+03:00`).getTime()>Date.now(); }
  function slotFree(date,time) { return availability && !availability.closed_days.includes(date) && ![...availability.booked_slots,...availability.blocked_slots].some(slot=>slot.date===date&&slot.time===time) && future(date,time); }
  function invalidate() { draft.time='';draft.consent=false; }
  function error(message) { $('booking-error').textContent=message; }
  function capture() { const form=$('journey-form');if(!form)return; const data=new FormData(form);for(const name of ['category','professional','date','time','name','phone','email','location','notes','paymentType','paymentReference','paymentPhone','paymentProvider'])if(data.has(name))draft[name]=String(data.get(name)).trim();if(step===7)draft.consent=data.has('consent'); }
  function showSummary() {
    $('summary-count').textContent=cart.length?`(${cart.length})`:'';
    $('booking-summary').innerHTML=`${cart.length?`<ul>${cart.map((item,index)=>`<li><strong>${esc(item.name)}</strong><small>${esc(item.price)}${item.duration?' · '+esc(item.duration):''}</small>${!complete?`<button type="button" data-remove="${index}" aria-label="Remove ${esc(item.name)}">Remove</button>`:''}</li>`).join('')}</ul>`:'<p>Choose a service to start your visit.</p>'}<dl><div><dt>${fixedPrices()?'Estimated total':'Estimate from'}</dt><dd>${cart.length&&total()?money(total()):'Confirm with salon'}</dd></div><div><dt>Professional</dt><dd>${esc(personName())}</dd></div><div><dt>Date</dt><dd>${esc(draft.date)||'To be chosen'}</dd></div><div><dt>Time</dt><dd>${draft.time?esc(draft.time)+' EAT':'To be chosen'}</dd></div></dl><p class="journey-note">Final pricing and your appointment are subject to salon confirmation.</p>`;
    document.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{capture();cart.splice(Number(button.dataset.remove),1);saveCart();normalizeProfessional();invalidate();if(!cart.length)step=1;render();});
  }
  function field(label,name,type='text',required=false,value=draft[name]||'') {return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${name==='email'?'autocomplete="email"':name==='name'?'autocomplete="name"':name==='phone'||name==='paymentPhone'?'autocomplete="tel"':''} maxlength="${type==='email'?120:80}"></div>`;}
  function choice(name,value,label,description='',checked=false) {return `<label class="journey-choice"><input type="radio" name="${name}" value="${esc(value)}" ${checked?'checked':''} required><span><strong>${esc(label)}</strong>${description?`<small>${esc(description)}</small>`:''}</span></label>`;}
  function reviewRow(label,content,target) {return `<div class="review-row"><div><strong>${label}</strong><p>${content}</p></div><button type="button" data-edit="${target}">Edit</button></div>`;}
  function review() {return reviewRow('Services',cart.map(item=>esc(item.name)+' · '+esc(item.price)).join('<br>'),1)+reviewRow('Preferred professional',esc(personName()),2)+reviewRow('Date and time',esc(draft.date)+' · '+esc(draft.time)+' EAT',3)+reviewRow('Your details',esc(draft.name)+'<br>'+esc(draft.phone)+'<br>'+esc(draft.email),5)+reviewRow('Notes',esc(draft.notes)||'No additional notes',6);}
  function quote() {return draft.paymentType==='full'?total():Math.round(total()*0.5);}
  function payment() {
    const exact=fixedPrices();
    return `<p>Our booking deposit is 50%. You can also submit a full-payment reference. Payment references are checked by the salon before your slot is confirmed.</p><div class="payment-box"><strong>${exact?'Estimated service total':'Indicative estimate'}</strong><h3>${total()?money(total()):'Confirm with salon'}</h3>${!exact?'<p>Your selection includes variable pricing. Please confirm the final amount with the salon before paying.</p>':''}</div><div class="journey-options">${choice('paymentType','later','Arrange payment with the salon','Send your booking request and confirm payment details.',draft.paymentType==='later')}${choice('paymentType','deposit','Submit a 50% deposit reference',exact?money(Math.round(total()/2)):'Amount to be agreed with salon',draft.paymentType==='deposit')}${choice('paymentType','full','Submit a full-payment reference',exact?money(total()):'Amount to be agreed with salon',draft.paymentType==='full')}</div>${draft.paymentType!=='later'?`<div class="payment-box"><h3>Mobile Money payment</h3>${config.payment?.merchantId?`<p>${esc(config.payment.provider||'Mobile Money')} · Merchant / payment number: <strong>${esc(config.payment.merchantId)}</strong></p>`:'<p>Contact Stuwie’s for the correct payment number before sending money.</p><a class="btn btn-light" href="https://wa.me/256706081927?text=Hello%20Stuwie%27s%2C%20please%20confirm%20the%20payment%20number%20and%20amount%20for%20my%20booking." target="_blank" rel="noopener">Confirm payment details</a>'}${exact?`<dl><div><dt>${draft.paymentType==='full'?'Full payment':'50% deposit'}</dt><dd>${money(quote())}</dd></div><div><dt>Estimated balance</dt><dd>${money(total()-quote())}</dd></div></dl>`:''}<p>After paying through your Mobile Money service, enter the transaction reference below. We never ask for your PIN.</p></div><div class="journey-fields"><div class="field"><label for="paymentProvider">Payment provider</label><select name="paymentProvider" id="paymentProvider">${['MTN Mobile Money','Airtel Money'].map(provider=>`<option ${draft.paymentProvider===provider?'selected':''}>${provider}</option>`).join('')}</select></div>${field('Payment phone number','paymentPhone','tel',true,draft.paymentPhone||draft.phone)}<div class="field full"><label for="paymentReference">Transaction / reference ID</label><input name="paymentReference" id="paymentReference" value="${esc(draft.paymentReference)}" required minlength="6" maxlength="40" pattern="[A-Za-z0-9-]{6,40}" autocomplete="off" placeholder="Enter the reference from your payment message"><small>Enter only the reference, not the full message. Submission does not verify payment.</small></div></div>`:'<p>You can send your appointment request now. The salon will confirm payment instructions with you.</p>'}`;
  }
  function body() {
    if(step===0)return `<p>Start with a category. You can add services from more than one category.</p><div class="journey-options">${categories.map(category=>choice('category',category,category,'',draft.category===category)).join('')}</div>`;
    if(step===1)return `<p>Select the services you’d like. Your current service cart is included.</p><div class="field"><label for="category">Service category</label><select id="category" name="category">${categories.map(category=>`<option ${category===draft.category?'selected':''}>${esc(category)}</option>`).join('')}</select></div><div class="journey-options">${catalogue.filter(item=>item.category===draft.category).map(item=>`<label class="journey-choice"><input type="checkbox" data-service="${catalogue.indexOf(item)}" ${cart.some(selected=>selected.key===item.key||selected.name===item.name&&selected.category===item.category)?'checked':''}><span><strong>${esc(item.name)}</strong><small>${esc(item.price)}${item.duration?' · '+esc(item.duration):''}</small></span></label>`).join('')}</div><p class="journey-note">Range prices and custom packages are confirmed with the salon.</p>`;
    if(step===2)return `<p>Choose a preferred professional for their specialty, or let the salon arrange your team. For a visit with several specialties, the salon will coordinate the remaining services.</p><div class="journey-options">${choice('professional','any','No preference','Let the salon arrange the right professional.',draft.professional==='any')}${compatible().map(person=>`<label class="journey-choice"><input type="radio" name="professional" value="${person.id}" ${draft.professional===person.id?'checked':''}><img src="assets/images/${person.image}" alt="${person.name}"><span><strong>${person.name}</strong><small>${person.role}</small><small>${person.bio}</small></span></label>`).join('')}</div><p class="journey-note">Professional preferences are subject to confirmation. Availability below is the salon’s shared calendar.</p>`;
    if(step===3)return `<p>Choose a date within the next six months. All appointment times are in Kampala (EAT, UTC+3).</p><div class="journey-fields"><div class="field"><label for="date">Preferred date</label><input type="date" id="date" name="date" required min="${today()}" max="${maxDate()}" value="${esc(draft.date)}"></div></div>`;
    if(step===4) {
      if(availabilityLoading)return '<p role="status">Checking the salon’s availability…</p>';
      if(availabilityError)return `<p>${esc(availabilityError)}</p><button type="button" class="btn btn-light" id="retry-availability">Try again</button>`;
      const slots=['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];
      const available=slots.filter(time=>slotFree(draft.date,time));
      return `<p>Available start times for ${esc(draft.date)}. Your appointment will be checked again before submission.</p>${available.length?`<div class="journey-options">${slots.map(time=>`<label class="journey-choice"><input type="radio" name="time" value="${time}" ${time===draft.time?'checked':''} ${available.includes(time)?'required':'disabled'}><span><strong>${time} EAT</strong><small>${available.includes(time)?'Available to request':'Unavailable'}</small></span></label>`).join('')}</div>`:'<p>No start times are available for this date. Go back to choose another day.</p>'}`;
    }
    if(step===5)return `<p>Tell us how to contact you about your appointment.</p><div class="journey-fields">${field('Your name','name','text',true)}${field('Phone / WhatsApp','phone','tel',true)}${field('Email','email','email',true)}${field('Area / landmark (optional)','location')}<div class="field full"><button class="btn btn-light" type="button" id="use-gps">Use GPS location</button><p id="gps-status" role="status">${draft.locationCoords?'Live location added.':''}</p></div></div>`;
    if(step===6)return `<p>A preferred finish, a question, or anything else you’d like the team to know.</p><div class="journey-fields"><div class="field full"><label for="notes">Appointment notes (optional)</label><textarea id="notes" name="notes" rows="5" maxlength="1000">${esc(draft.notes)}</textarea></div></div>`;
    if(step===7)return `<p>Check your details before continuing to payment.</p>${review()}<label class="journey-consent"><input type="checkbox" name="consent" required ${draft.consent?'checked':''}><span>I agree to share these details with Stuwie’s for this appointment request. My slot and any payment reference require salon confirmation.</span></label>`;
    return payment();
  }
  function render(focus=false) {
    error('');showSummary();
    $('step-label').textContent=`Step ${step+1} of 9 · ${steps[step]}`;$('progress').value=step+1;
    $('step-list').innerHTML=steps.map((label,index)=>`<li ${index===step?'aria-current="step"':''}>${index+1}. ${label}</li>`).join('');
    $('step-body').innerHTML=`<h2>${titles[step]}</h2><form id="journey-form">${body()}<div class="journey-actions">${step?'<button class="btn btn-light" type="button" id="back">Back</button>':'<a class="btn btn-light" href="services.html">Service menu</a>'}<button class="btn btn-primary" type="submit" ${busy||step===4&&(availabilityLoading||availabilityError)?'disabled':''}>${busy?'Sending…':step===8?'Send booking request':step===7?'Continue to payment':'Continue'}</button></div></form>`;
    $('journey-form').onsubmit=advance;
    $('back')?.addEventListener('click',()=>{capture();step--;render(true);if(step===4)refreshAvailability();});
    document.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{step=Number(button.dataset.edit);render(true);});
    $('category')?.addEventListener('change',()=>{capture();render();});
    $('date')?.addEventListener('change',()=>{capture();invalidate();showSummary();});
    document.querySelectorAll('[data-service]').forEach(input=>input.onchange=()=>{const item=catalogue[Number(input.dataset.service)];if(input.checked){cart.push({...item});}else{cart=cart.filter(selected=>!(selected.key===item.key||selected.name===item.name&&selected.category===item.category));}saveCart();normalizeProfessional();invalidate();showSummary();});
    document.querySelectorAll('[name="paymentType"]').forEach(input=>input.onchange=()=>{capture();render();});
    document.querySelectorAll('[name="professional"],[name="time"]').forEach(input=>input.onchange=()=>{capture();showSummary();});
    $('retry-availability')?.addEventListener('click',refreshAvailability);
    $('use-gps')?.addEventListener('click',()=>{
      if(!navigator.geolocation){$('gps-status').textContent='GPS is unavailable. Please type your area.';return;}
      const button=$('use-gps');button.disabled=true;$('gps-status').textContent='Checking your location…';
      navigator.geolocation.getCurrentPosition(position=>{draft.locationCoords=`${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;if($('gps-status'))$('gps-status').textContent='Live location added.';button.disabled=false;},()=>{if($('gps-status'))$('gps-status').textContent='Location was not shared. You can type your area instead.';button.disabled=false;},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
    });
    if(focus){$('step-body').focus({preventScroll:true});$('step-body').scrollIntoView({block:'start',behavior:'auto'});}
    const active=$('step-list').querySelector('[aria-current]');
    if(active)$('step-list').scrollLeft=active.offsetLeft-$('step-list').offsetLeft;
  }
  function loadAvailability() {
    return new Promise((resolve,reject)=>{
      if(!config.webAppUrl){reject(new Error('Booking is unavailable. Please contact the salon.'));return;}
      const callback='__stuwiesGuidedAvailability'+(++loadId), script=document.createElement('script');
      let settled=false;
      const finish=(payload,error)=>{if(settled)return;settled=true;clearTimeout(timer);script.remove();delete window[callback];if(error)reject(error);else resolve(payload);};
      const timer=setTimeout(()=>finish(null,new Error('Availability could not be checked. Please try again or contact the salon.')),12000);
      window[callback]=payload=>{if(!payload?.ok||!['closed_days','booked_slots','blocked_slots'].every(field=>Array.isArray(payload[field])))finish(null,new Error('Availability could not be checked. Please try again.'));else finish(payload);};
      script.onerror=()=>finish(null,new Error('Availability could not be checked. Please try again or contact the salon.'));
      script.src=config.webAppUrl+'?action=availability&callback='+callback+'&_='+Date.now();document.body.append(script);
    });
  }
  async function refreshAvailability() {
    availabilityLoading=true;availabilityError='';if(step===4)render();
    try {availability=await loadAvailability();}catch(err){availability=null;availabilityError=err.message;}
    availabilityLoading=false;if(step===4)render();
  }
  async function advance(event) {
    event.preventDefault();if(busy)return;capture();error('');
    if(step>=1&&!cart.length){step=1;render();error('Choose at least one service.');return;}
    if(step===3 && (draft.date<today()||draft.date>maxDate())){error('Choose a date within the next six months.');return;}
    if(step===4&&!slotFree(draft.date,draft.time)){error('Choose an available time, or go back and select another date.');return;}
    if(step===5&&!/^[+\d\s()-]{7,20}$/.test(draft.phone)){error('Enter a valid phone number.');return;}
    if(step===8){await submit();return;}
    step++;render(true);if(step===4)refreshAvailability();
  }
  function paymentRecord() {
    const submitted=draft.paymentType!=='later';
    return {paymentType:draft.paymentType,paymentStatus:submitted?'submitted':'not_submitted',paymentProvider:submitted?draft.paymentProvider:'',paymentReference:submitted?draft.paymentReference:'',paymentPhone:submitted?draft.paymentPhone:'',serviceTotal:fixedPrices()?total():null,paymentAmount:submitted&&fixedPrices()?quote():null,balanceRemaining:submitted&&fixedPrices()?total()-quote():null,paymentPriceReviewRequired:!fixedPrices(),paymentSubmittedAt:submitted?new Date().toISOString():null};
  }
  function payload() {
    const payment=paymentRecord();
    const paymentNote=payment.paymentStatus==='submitted'?`Payment: ${payment.paymentType}; ${payment.paymentProvider}; reference ${payment.paymentReference}; payment phone ${payment.paymentPhone}; awaiting manual verification. ${payment.paymentAmount!==null?'Amount '+money(payment.paymentAmount)+'; balance '+money(payment.balanceRemaining)+'.':'Amount and balance to be confirmed by salon.'}`:'Payment: to be arranged with salon; not submitted.';
    return {submitted_at:new Date().toISOString(),type:'Appointment booking',source:'Website / guided bookings',customer_name:draft.name,phone:draft.phone,customer_phone:draft.phone,customer_email:draft.email,customer_location:draft.location||'None',customer_location_link:draft.locationCoords?'https://www.google.com/maps?q='+encodeURIComponent(draft.locationCoords):'',service:cart.length===1?cart[0].name:'Multiple selected services',selected_items:cart.map((item,index)=>`${index+1}. ${item.category}: ${item.name} - ${item.price}${item.duration?' · '+item.duration:''}`).join('\n'),estimated_total:total()?money(total())+(fixedPrices()?'':' (estimate; confirm final price)'):'Confirm with salon',preferred_date:draft.date,preferred_time:draft.time,notes:[draft.notes,'Preferred professional: '+personName()+' (subject to confirmation).',paymentNote].filter(Boolean).join('\n'),raw_items:cart.map(item=>({...item})),preferred_professional:draft.professional,payment};
  }
  async function submit() {
    normalizeProfessional();
    if(!cart.length||!draft.date||!draft.time||!draft.name||!draft.phone||!draft.email||!draft.consent){error('Please review your booking details before submitting.');return;}
    if(draft.paymentType!=='later'&&(!/^[A-Za-z0-9-]{6,40}$/.test(draft.paymentReference)||!/^[+\d\s()-]{7,20}$/.test(draft.paymentPhone))){error('Enter a valid payment reference and payment phone number.');return;}
    busy=true;render();
    // Lock the request snapshot while checking the shared calendar and sending.
    document.querySelectorAll('#journey-form input,#journey-form select,#journey-form textarea,#journey-form button,[data-remove]').forEach(control=>control.disabled=true);
    try {
      availability=await loadAvailability();
      if(!slotFree(draft.date,draft.time)){busy=false;step=4;draft.time='';render(true);error('That time is no longer available. Please choose another time.');return;}
      const data=payload();
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
      try {await fetch(config.webAppUrl,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data),signal:controller.signal});}finally{clearTimeout(timer);}
      completedPayload=data;complete=true;
      // Retain services added in another tab while this request was in flight.
      try {const remaining=readCart().filter(item=>!data.raw_items.some(sent=>sent.key===item.key));if(remaining.length)localStorage.setItem(key,JSON.stringify(remaining));else localStorage.removeItem(key);}catch{}
      confirmation();
    }catch(err){busy=false;render();error(err.name==='AbortError'?'The request timed out and its delivery is uncertain. Contact the salon before retrying. Your details are still here.':err.message||'Your request could not be sent. Please try again or contact the salon.');}
  }
  function confirmation() {
    showSummary();$('step-label').textContent='Request submitted · awaiting salon confirmation';$('progress').value=9;$('step-list').innerHTML='';error('');
    const payment=completedPayload.payment;
    const message=`Hello Stuwie's Salon & Spa, please confirm my appointment request.\n\nName: ${draft.name}\nPhone: ${draft.phone}\nEmail: ${draft.email}\n${completedPayload.selected_items}\nDate: ${draft.date}\nTime: ${draft.time} EAT\n${completedPayload.notes}`;
    $('step-body').innerHTML=`<h2 class="journey-success">Your request is on its way</h2><p>Please wait for Stuwie’s to confirm your appointment. This submission is not a confirmed reservation.</p><div class="payment-box"><h3>${esc(draft.date)} · ${esc(draft.time)} EAT</h3><p>${esc(personName())}</p><p>${payment.paymentStatus==='submitted'?`Payment reference: <strong>${esc(payment.paymentReference)}</strong><br>Awaiting manual verification.`:'Payment to be arranged with the salon.'}</p>${payment.paymentAmount!==null?`<p>Submitted amount: ${money(payment.paymentAmount)}<br>Estimated balance: ${money(payment.balanceRemaining)}</p>`:''}</div><p>The salon will confirm receipt, availability and payment status. You can also send these details via WhatsApp.</p><div class="success-actions"><a class="btn btn-primary" href="https://wa.me/256706081927?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">Send via WhatsApp</a><button class="btn btn-light" id="download-booking" type="button">Download request</button><a class="btn btn-light" href="index.html">Back to home</a></div>`;
    $('download-booking').onclick=()=>{
      const record={status:'Awaiting salon confirmation',services:completedPayload.raw_items,date:draft.date,time:draft.time,timezone:'Africa/Kampala',professional:personName(),paymentType:payment.paymentType,paymentStatus:payment.paymentStatus,paymentReference:payment.paymentReference,paymentAmount:payment.paymentAmount,balanceRemaining:payment.balanceRemaining};
      const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='stuwies-booking-request.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    $('step-body').focus();
  }
  window.addEventListener('storage',event=>{if((event.key===key||event.key===null)&&!complete&&!busy){capture();cart=readCart();normalizeProfessional();invalidate();if(step>1)step=1;render();error('Your service cart changed in another tab. Please review your selection.');}});
  if(cart.length)normalizeProfessional();render();
  if(matchMedia('(max-width:800px)').matches)document.querySelector('.journey-summary details').open=false;
})();
