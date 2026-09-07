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
  let cart = readCart(), step = 0, busy = false, availability = null, availabilityLoading = false, availabilityError = '', availabilityPromise = null, loadId = 0;
  let complete = false, completedPayload = null;
  let availabilityPreview = false, availabilityPreviewTimer = null;
  function previewAvailability() {
    clearTimeout(availabilityPreviewTimer);
    availabilityPreview = !availabilityError;
    if(!availabilityPreview)return;
    availabilityPreviewTimer=setTimeout(()=>{
      availabilityPreview=false;
      if(step===4){const message=$('booking-error').textContent;render();error(message);}
    },2000);
  }
  const draft = {category:professional?.categories[0] || cart[0]?.category || categories[0],professional:professional?.id || 'any',date:'',time:'',name:'',phone:'',email:'',location:'',locationCoords:'',notes:'',paymentType:'',paymentProvider:'',paymentStatus:'not_started',paymentAmount:null,paymentInitiatedAt:null,paymentVerifiedAt:null,paymentReference:'',consent:false};
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
  function fixedPrices() { return cart.length>0 && cart.every(item=>/^(?:UGX\s*)?(?:[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(item.price.trim()) && !/per[ -]person|\/person|custom|variable/i.test([item.name,item.duration,item.description].join(' ')) && Number.isSafeInteger(amount(item)) && amount(item)>0) && Number.isSafeInteger(total()); }
  function compatible() { return team.filter(person=>cart.some(item=>person.categories.includes(item.category))); }
  function personName() { return team.find(person=>person.id===draft.professional)?.name || 'No preference — salon to assign'; }
  function normalizeProfessional() { if(draft.professional!=='any'&&!compatible().some(person=>person.id===draft.professional))draft.professional='any'; }
  function today() { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kampala',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-'); }
  function maxDate() { const date=new Date(today()+'T12:00:00Z');date.setMonth(date.getMonth()+6);return date.toISOString().slice(0,10); }
  function future(date,time) { return new Date(`${date}T${time}:00+03:00`).getTime()>Date.now(); }
  function slotFree(date,time) { return availability && !availability.closed_days.includes(date) && ![...availability.booked_slots,...availability.blocked_slots].some(slot=>slot.date===date&&slot.time===time) && future(date,time); }
  function invalidate() { syncPayment();draft.time='';draft.consent=false; }
  function error(message) { $('booking-error').textContent=message; }
  function capture() { const form=$('journey-form');if(!form)return; const data=new FormData(form);for(const name of ['category','professional','date','time','name','phone','email','location','notes','paymentType','paymentProvider'])if(data.has(name))draft[name]=String(data.get(name)).trim();if(step===7)draft.consent=data.has('consent'); }
  function showSummary() {
    $('summary-count').textContent=cart.length?`(${cart.length})`:'';
    $('booking-summary').innerHTML=`${cart.length?`<ul>${cart.map((item,index)=>`<li><strong>${esc(item.name)}</strong><small>${esc(item.price)}${item.duration?' · '+esc(item.duration):''}</small>${!complete?`<button type="button" data-remove="${index}" aria-label="Remove ${esc(item.name)}">Remove</button>`:''}</li>`).join('')}</ul>`:'<p>Choose a service to start your visit.</p>'}<dl><div><dt>${fixedPrices()?'Estimated total':'Estimate from'}</dt><dd>${cart.length&&total()?money(total()):'Confirm with salon'}</dd></div><div><dt>Professional</dt><dd>${esc(personName())}</dd></div><div><dt>Date</dt><dd>${esc(draft.date)||'To be chosen'}</dd></div><div><dt>Time</dt><dd>${draft.time?esc(draft.time)+' EAT':'To be chosen'}</dd></div></dl><p class="journey-note">Final pricing and your appointment are subject to salon confirmation.</p>`;
    document.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{capture();cart.splice(Number(button.dataset.remove),1);saveCart();normalizeProfessional();invalidate();if(!cart.length)step=1;render();});
  }
  function field(label,name,type='text',required=false,value=draft[name]||'') {return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${name==='email'?'autocomplete="email"':name==='name'?'autocomplete="name"':name==='phone'?'autocomplete="tel"':''} maxlength="${type==='email'?120:80}"></div>`;}
  function choice(name,value,label,description='',checked=false) {return `<label class="journey-choice"><input type="radio" name="${name}" value="${esc(value)}" ${checked?'checked':''} required><span><strong>${esc(label)}</strong>${description?`<small>${esc(description)}</small>`:''}</span></label>`;}
  function reviewRow(label,content,target) {return `<div class="review-row"><div><strong>${label}</strong><p>${content}</p></div><button type="button" data-edit="${target}">Edit</button></div>`;}
  function review() {return reviewRow('Services',cart.map(item=>esc(item.name)+' · '+esc(item.price)).join('<br>'),1)+reviewRow('Preferred professional',esc(personName()),2)+reviewRow('Date and time',esc(draft.date)+' · '+esc(draft.time)+' EAT',3)+reviewRow('Your details',esc(draft.name)+'<br>'+esc(draft.phone)+'<br>'+esc(draft.email),5)+reviewRow('Notes',esc(draft.notes)||'No additional notes',6);}
  // These lifecycle values are a contract for the next backend phase. Only
  // not_started/initiated are assigned here; browser state is never payment proof.
  const paymentStatuses = Object.freeze(['not_started','initiated','submitted','verified','failed','cancelled']);
  let paymentFingerprint = '';
  const providerNames = {mtn:'MTN Mobile Money',airtel:'Airtel Money'};
  function getSelectedProvider() {
    const providerKey=draft.paymentProvider;
    return Object.hasOwn(providerNames,providerKey)?{...config.payment?.providers?.[providerKey],name:providerNames[providerKey],providerKey}:null;
  }
  function getMerchantId() {
    const provider=getSelectedProvider();
    const id=String(provider?.merchantId||'').trim();
    return provider?.merchantConfigured===true && /^[0-9]+$/.test(id) && !/^0+$/.test(id)?id:'';
  }
  // Future salon-approved quotes must enter here through a verified server response.
  function payableTotal() { return fixedPrices()?total():null; }
  function quote() {
    const value=payableTotal();
    return value!==null && ['deposit','full'].includes(draft.paymentType)?value*(draft.paymentType==='deposit'?0.5:1):null;
  }
  function syncPayment() {
    const fingerprint=JSON.stringify([cart,draft.paymentType,draft.paymentProvider,getMerchantId()]);
    if(fingerprint!==paymentFingerprint){
      draft.paymentStatus='not_started';draft.paymentInitiatedAt=null;
      draft.paymentReference='';draft.paymentVerifiedAt=null;paymentFingerprint=fingerprint;
    }
    draft.paymentAmount=quote();
  }
  function paymentValidation() {
    return [!['deposit','full'].includes(draft.paymentType)?'Choose either a 50% deposit or full payment.':'',
      !getSelectedProvider()?'Choose MTN Mobile Money or Airtel Money.':''].filter(Boolean).join(' ');
  }
  function validPaymentAmount() {return Number.isSafeInteger(draft.paymentAmount)&&draft.paymentAmount>0;}
  function buildMtnPaymentUri() {
    if(!getMerchantId()||!validPaymentAmount())return null;
    const ussd=`*165*3*${getMerchantId()}*${draft.paymentAmount}#`;
    // Preserve dial characters; encode the terminal # so it is not a URL fragment.
    return 'tel:'+ussd.replace(/#/g,'%23');
  }
  function buildAirtelPaymentUri() { return null; } // Await a verified merchant sequence.
  function manualPaymentInstructions() {
    const provider=getSelectedProvider();
    if(!provider||!getMerchantId()||!validPaymentAmount())return '';
    const instructions=provider.providerKey==='mtn'
      ?'<li>Dial <strong>*165*3#</strong></li><li>Choose Merchant Code</li><li>Enter the Stuwie’s merchant code</li><li>Enter the displayed amount</li><li>Confirm the merchant details</li><li>Enter your MoMo PIN on your phone</li>'
      :'<li>Open the Airtel Money menu on your Airtel phone</li><li>Choose the merchant payment option</li><li>Enter the Stuwie’s merchant code and the displayed amount</li><li>Confirm the merchant details</li><li>Authorize the payment on your phone</li>';
    return `<div class="payment-box" id="payment-instructions"><h3>Pay from your ${provider.providerKey==='mtn'?'MTN':'Airtel'} phone</h3><p>Merchant ID: <strong>${esc(getMerchantId())}</strong><br>Amount: <strong>${money(draft.paymentAmount)}</strong></p><ol>${instructions}</ol>${provider.providerKey==='airtel'?'<p>Automatic Airtel handoff is not available yet. If the merchant option is unavailable, contact the salon before paying.</p>':''}<p>Enter your PIN only on your phone, never on this website.</p></div>`;
  }
  function initiatePayment() {
    capture();syncPayment();
    const validation=paymentValidation();if(validation){error(validation);return;}
    if(!getMerchantId()||!validPaymentAmount()){error('Payment cannot be initiated until the merchant and final amount are confirmed.');return;}
    const provider=getSelectedProvider();
    const uri=provider.providerKey==='mtn'?buildMtnPaymentUri():buildAirtelPaymentUri();
    draft.paymentStatus='initiated';draft.paymentInitiatedAt=new Date().toISOString();
    render();
    // External dialers provide no reliable success/failure callback. Keep manual fallback visible.
    if(uri && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){
      try {window.location.href=uri;}catch {error('Use the payment instructions below to pay from your phone.');}
    }
  }
  function payment() {
    syncPayment();
    const exact=payableTotal()!==null, provider=getSelectedProvider();
    return `<p>Select your required payment amount and provider. Payment is required; sending a booking request does not verify payment.</p><div class="payment-box"><strong>Service total</strong><h3>${exact?money(total()):'Awaiting confirmed price'}</h3>${!exact?'<p role="status">One or more selected services require the salon to confirm the final price before payment.</p>':''}</div>
      <fieldset class="payment-choices"><legend>Choose how much to pay</legend><div class="journey-options">${choice('paymentType','deposit','50% Deposit',exact?'Pay '+money(total()*0.5):'Awaiting confirmed price',draft.paymentType==='deposit')}${choice('paymentType','full','Full Payment',exact?'Pay '+money(total()):'Awaiting confirmed price',draft.paymentType==='full')}</div></fieldset>
      <fieldset class="payment-choices"><legend>Choose payment provider</legend><div class="journey-options">${Object.entries(providerNames).map(([key,name])=>`<label class="journey-choice provider-card"><input type="radio" name="paymentProvider" value="${key}" required ${draft.paymentProvider===key?'checked':''}><img class="provider-logo" src="${esc(config.payment?.providers?.[key]?.logo||'')}" alt="" width="48" height="48"><span><strong>${name}</strong><small>${draft.paymentProvider===key?'Selected':'Select provider'}</small></span></label>`).join('')}</div></fieldset>
      ${draft.paymentAmount!==null?`<p class="payment-amount">Amount to pay: <strong>${money(draft.paymentAmount)}</strong></p>${!validPaymentAmount()?'<p role="status">The salon must confirm an amount payable in whole Uganda shillings before payment.</p>':''}`:''}
      ${provider&&!getMerchantId()?`<p class="payment-warning" role="status">${esc(provider.name)} merchant payment is not configured yet. Payment cannot be initiated. Contact the salon for assistance.</p>`:''}
      ${provider&&validPaymentAmount()?`<button class="btn btn-primary" type="button" id="pay-mobile-money" ${getMerchantId()?'':'disabled'}>Pay with ${provider.providerKey==='mtn'?'MTN MoMo':'Airtel Money'}</button>`:''}
      ${draft.paymentStatus==='initiated'?'<p role="status">Complete the payment on your phone. Payment has not been verified.</p>':''}
      ${manualPaymentInstructions()}<p class="journey-note">You can send your request after selecting both options. Your appointment and payment still require salon confirmation.</p>`;
  }
  function body() {
    if(step===0)return `<p>Start with a category. You can add services from more than one category.</p><div class="journey-options">${categories.map(category=>choice('category',category,category,'',draft.category===category)).join('')}</div>`;
    if(step===1)return `<p>Select the services you’d like. Your current service cart is included.</p><div class="field"><label for="category">Service category</label><select id="category" name="category">${categories.map(category=>`<option ${category===draft.category?'selected':''}>${esc(category)}</option>`).join('')}</select></div><div class="journey-options">${catalogue.filter(item=>item.category===draft.category).map(item=>`<label class="journey-choice"><input type="checkbox" data-service="${catalogue.indexOf(item)}" ${cart.some(selected=>selected.key===item.key||selected.name===item.name&&selected.category===item.category)?'checked':''}><span><strong>${esc(item.name)}</strong><small>${esc(item.price)}${item.duration?' · '+esc(item.duration):''}</small></span></label>`).join('')}</div><p class="journey-note">Range prices and custom packages are confirmed with the salon.</p>`;
    if(step===2)return `<p>Choose a preferred professional for their specialty, or let the salon arrange your team. For a visit with several specialties, the salon will coordinate the remaining services.</p><div class="journey-options">${choice('professional','any','No preference','Let the salon arrange the right professional.',draft.professional==='any')}${compatible().map(person=>`<label class="journey-choice"><input type="radio" name="professional" value="${person.id}" ${draft.professional===person.id?'checked':''}><img src="assets/images/${person.image}" srcset="assets/images/responsive/${person.id}-480.webp 480w, assets/images/responsive/${person.id}-960.webp 960w" sizes="64px" width="4480" height="6720" class="professional-portrait" alt="${person.name}, Masseuse and Esthetician" loading="lazy" decoding="async"><span><strong>${person.name}</strong><small>${person.role}</small><small>${person.bio}</small></span></label>`).join('')}</div><p class="journey-note">Professional preferences are subject to confirmation. Availability below is the salon’s shared calendar.</p>`;
    if(step===3)return `<p>Choose a date within the next six months. All appointment times are in Kampala (EAT, UTC+3).</p><div class="journey-fields"><div class="field"><label for="date">Preferred date</label><input type="date" id="date" name="date" required min="${today()}" max="${maxDate()}" value="${esc(draft.date)}"></div></div>`;
    if(step===4) {
      if(availabilityError)return `<p>${esc(availabilityError)}</p><button type="button" class="btn btn-light" id="retry-availability">Try again</button>`;
      if(availabilityLoading||availabilityPreview)return `<div class="availability-check" role="status" aria-live="polite">
        <div class="availability-calendar" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><rect x="9" y="11" width="30" height="29" rx="6"/><path d="M9 21h30M17 7v8M31 7v8"/><path class="calendar-days" d="M17 28h2m10 0h2m-14 6h2m10 0h2"/></svg><span class="calendar-scan"></span></div>
        <div class="availability-copy"><span class="availability-eyebrow">SALON CALENDAR</span><strong>Checking appointment times<span class="availability-dots" aria-hidden="true"><i></i><i></i><i></i></span></strong><p>Finding available times for your visit.</p><div class="availability-placeholders" aria-hidden="true"><span></span><span></span><span></span></div></div>
      </div>`;
      const slots=['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];
      const available=slots.filter(time=>slotFree(draft.date,time));
      return `<p>Available start times for ${esc(draft.date)}. Your appointment will be checked again before submission.</p>${available.length?`<div class="journey-options">${slots.map(time=>`<label class="journey-choice"><input type="radio" name="time" value="${time}" ${time===draft.time?'checked':''} ${available.includes(time)?'required':'disabled'}><span><strong>${time} EAT</strong><small>${available.includes(time)?'Available to request':'Unavailable'}</small></span></label>`).join('')}</div>`:'<p>No start times are available for this date. Go back to choose another day.</p>'}`;
    }
    if(step===5)return `<p>Tell us how to contact you about your appointment.</p><div class="journey-fields">${field('Your name','name','text',true)}${field('Phone / WhatsApp','phone','tel',true)}${field('Email','email','email',true)}${field('Area / landmark (optional)','location')}<div class="field full"><button class="btn btn-light" type="button" id="use-gps">Use GPS location</button><p id="gps-status" role="status">${draft.locationCoords?'Live location added.':''}</p></div></div>`;
    if(step===6)return `<p>A preferred finish, a question, or anything else you’d like the team to know.</p><div class="journey-fields"><div class="field full"><label for="notes">Appointment notes (optional)</label><textarea id="notes" name="notes" rows="5" maxlength="1000">${esc(draft.notes)}</textarea></div></div>`;
    if(step===7)return `<p>Check your details before continuing to payment.</p>${review()}<label class="journey-consent"><input type="checkbox" name="consent" required ${draft.consent?'checked':''}><span>I agree to share these details with Stuwie’s for this appointment request. My appointment and payment require salon confirmation.</span></label>`;
    return payment();
  }
  function render(focus=false) {
    if(step!==4){clearTimeout(availabilityPreviewTimer);availabilityPreview=false;}
    error('');showSummary();
    $('step-label').textContent=`Step ${step+1} of 9 · ${steps[step]}`;$('progress').value=step+1;
    $('step-list').innerHTML=steps.map((label,index)=>`<li ${index===step?'aria-current="step"':''}>${index+1}. ${label}</li>`).join('');
    $('step-body').innerHTML=`<h2>${titles[step]}</h2><form id="journey-form" ${step===8?'novalidate':''}>${body()}<div class="journey-actions">${step?'<button class="btn btn-light" type="button" id="back">Back</button>':'<a class="btn btn-light" href="services.html">Service menu</a>'}<button class="btn ${step===8?'btn-light':'btn-primary'}" type="submit" ${busy||step===4&&(availabilityLoading||availabilityPreview||availabilityError)?'disabled':''}>${busy?'Sending…':step===8?'Send booking request':step===7?'Continue to payment':'Continue'}</button></div></form>`;
    $('journey-form').onsubmit=advance;
    $('back')?.addEventListener('click',()=>{capture();step--;if(step===4)previewAvailability();render(true);if(step===4)ensureAvailability();});
    document.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{step=Number(button.dataset.edit);render(true);});
    $('category')?.addEventListener('change',()=>{capture();render();});
    $('date')?.addEventListener('change',()=>{capture();invalidate();showSummary();});
    document.querySelectorAll('[data-service]').forEach(input=>input.onchange=()=>{const item=catalogue[Number(input.dataset.service)];if(input.checked){cart.push({...item});}else{cart=cart.filter(selected=>!(selected.key===item.key||selected.name===item.name&&selected.category===item.category));}saveCart();normalizeProfessional();invalidate();showSummary();});
    document.querySelectorAll('[name="paymentType"],[name="paymentProvider"]').forEach(input=>input.onchange=()=>{const name=input.name,value=input.value;capture();render();document.querySelector(`[name="${name}"][value="${value}"]`)?.focus();});
    document.querySelectorAll('[name="professional"],[name="time"]').forEach(input=>input.onchange=()=>{capture();showSummary();});
    $('pay-mobile-money')?.addEventListener('click',initiatePayment);
    document.querySelectorAll('.provider-logo').forEach(img=>{img.onerror=()=>{img.hidden=true;};if(img.complete&&!img.naturalWidth)img.hidden=true;});
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
  // Display availability lives only in memory for this page visit.
  // A pending prefetch is shared with Time; failures remain visible until Retry.
  function ensureAvailability() {
    if(availabilityPromise)return availabilityPromise;
    if(availability || availabilityError)return Promise.resolve(availability);
    return refreshAvailability();
  }
  function refreshAvailability() {
    if(availabilityPromise)return availabilityPromise;
    availabilityLoading=true;availabilityError='';if(step===4)render();
    availabilityPromise=loadAvailability()
      .then(result=>{availability=result;return result;})
      .catch(err=>{availability=null;availabilityError=err.message;return null;})
      .finally(()=>{
        availabilityPromise=null;availabilityLoading=false;
        if(step===4)render();
      });
    return availabilityPromise;
  }
  async function advance(event) {
    event.preventDefault();if(busy)return;capture();error('');
    if(step>=1&&!cart.length){step=1;render();error('Choose at least one service.');return;}
    if(step===3 && (draft.date<today()||draft.date>maxDate())){error('Choose a date within the next six months.');return;}
    if(step===4&&(availabilityLoading||availabilityPreview))return;
    if(step===4&&!slotFree(draft.date,draft.time)){error('Choose an available time, or go back and select another date.');return;}
    if(step===5&&!/^[+\d\s()-]{7,20}$/.test(draft.phone)){error('Enter a valid phone number.');return;}
    if(step===8){await submit();return;}
    step++;if(step===4)previewAvailability();render(true);if(step===4)ensureAvailability();
  }
  function paymentRecord() {
    syncPayment();
    const provider=getSelectedProvider(), serviceTotal=payableTotal();
    return {paymentType:draft.paymentType,paymentProvider:provider?.name||'',providerKey:provider?.providerKey||'',paymentStatus:draft.paymentStatus,merchantId:getMerchantId(),serviceTotal,paymentAmount:draft.paymentAmount,balanceRemaining:draft.paymentAmount===null?null:serviceTotal-draft.paymentAmount,paymentReference:'',paymentInitiatedAt:draft.paymentInitiatedAt,paymentVerifiedAt:null,paymentPriceReviewRequired:serviceTotal===null};
  }

  function payload() {
    const payment=paymentRecord();
    const paymentNote=`Payment choice: ${payment.paymentType}; ${payment.paymentProvider}; browser initiation: ${payment.paymentStatus}; NOT verified. ${payment.paymentAmount!==null?'Amount to pay '+money(payment.paymentAmount)+'; balance after verification '+money(payment.balanceRemaining)+'.':'Final price requires salon confirmation.'}`;
    return {submitted_at:new Date().toISOString(),type:'Appointment booking',source:'Website / guided bookings',customer_name:draft.name,phone:draft.phone,customer_phone:draft.phone,customer_email:draft.email,customer_location:draft.location||'None',customer_location_link:draft.locationCoords?'https://www.google.com/maps?q='+encodeURIComponent(draft.locationCoords):'',service:cart.length===1?cart[0].name:'Multiple selected services',selected_items:cart.map((item,index)=>`${index+1}. ${item.category}: ${item.name} - ${item.price}${item.duration?' · '+item.duration:''}`).join('\n'),estimated_total:total()?money(total())+(fixedPrices()?'':' (estimate; confirm final price)'):'Confirm with salon',preferred_date:draft.date,preferred_time:draft.time,notes:[draft.notes,'Preferred professional: '+personName()+' (subject to confirmation).',paymentNote].filter(Boolean).join('\n'),raw_items:cart.map(item=>({...item})),preferred_professional:draft.professional,payment};
  }
  async function submit() {
    normalizeProfessional();
    if(!cart.length||!draft.date||!draft.time||!draft.name||!draft.phone||!draft.email||!draft.consent){error('Please review your booking details before submitting.');return;}
    const validation=paymentValidation();if(validation){error(validation);return;}
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
    $('step-body').innerHTML=`<h2 class="journey-success">Your request is on its way</h2><p>Please wait for Stuwie’s to confirm your appointment. This submission is not a confirmed reservation.</p><div class="payment-box"><h3>${esc(draft.date)} · ${esc(draft.time)} EAT</h3><p>${esc(personName())}</p><p>${esc(payment.paymentProvider)} · ${payment.paymentType==='deposit'?'50% Deposit':'Full Payment'}<br>${payment.paymentStatus==='initiated'?'Complete the payment on your phone.':'Payment has not been initiated.'} Payment has not been verified.</p>${payment.paymentAmount!==null?`<p>Amount to pay: ${money(payment.paymentAmount)}<br>Balance after payment verification: ${money(payment.balanceRemaining)}</p>`:''}</div><p>The salon will confirm receipt, availability and payment status. You can also send these details via WhatsApp.</p><div class="success-actions"><a class="btn btn-primary" href="https://wa.me/256706081927?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">Send via WhatsApp</a><button class="btn btn-light" id="download-booking" type="button">Download request</button><a class="btn btn-light" href="index.html">Back to home</a></div>`;
    $('download-booking').onclick=()=>{
      const record={status:'Awaiting salon confirmation',services:completedPayload.raw_items,date:draft.date,time:draft.time,timezone:'Africa/Kampala',professional:personName(),payment};
      const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='stuwies-booking-request.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    $('step-body').focus();
  }
  window.addEventListener('storage',event=>{if((event.key===key||event.key===null)&&!complete&&!busy){capture();cart=readCart();normalizeProfessional();invalidate();if(step>1)step=1;render();error('Your service cart changed in another tab. Please review your selection.');}});
  if(cart.length)normalizeProfessional();render();
  void ensureAvailability();
  if(matchMedia('(max-width:800px)').matches)document.querySelector('.journey-summary details').open=false;
})();
