/* Current staff identity and role confirmed by the salon owner. */
window.STUWIES_TEAM = [
  {id:'jalira-muyonjo',name:'Jalira Muyonjo',role:'Masseuse & Esthetician',image:'jalira-muyonjo.jpg',bio:'Providing professional massage and esthetic treatments in a calm, welcoming environment.',categories:['Massages','Facials','Body Scrubs'],specialties:['Massage Therapy','Esthetic Treatments','Skin & Body Care']}
];
(() => {
  const cards = document.querySelectorAll('#team .member-card');
  if (!cards.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'team-profile';
  dialog.setAttribute('aria-labelledby','profile-name');
  document.body.append(dialog);
  cards.forEach(card => {
    const person = window.STUWIES_TEAM.find(p => p.name === card.querySelector('h3')?.textContent);
    if (!person) return;
    const content = card.querySelector('div');
    const tags = document.createElement('p'); tags.className = 'team-specialties';
    person.specialties.forEach(text => { const tag=document.createElement('span'); tag.textContent=text; tags.append(tag); });
    content.append(tags);
    const actions = document.createElement('div'); actions.className='team-actions';
    const profile = document.createElement('button'); profile.type='button'; profile.className='btn btn-light'; profile.textContent='View profile';
    const book=document.createElement('a'); book.className='btn btn-primary'; book.href='bookings.html?professional='+person.id; book.textContent='Book with '+person.name;
    actions.append(profile,book); content.append(actions);
    profile.addEventListener('click', () => {
      dialog.innerHTML=`<button class="close-btn" type="button" aria-label="Close profile">&times;</button><img src="assets/images/${person.image}" srcset="assets/images/responsive/${person.id}-480.webp 480w, assets/images/responsive/${person.id}-960.webp 960w" sizes="(max-width: 600px) 90vw, 190px" width="4480" height="6720" alt="${person.name}, Masseuse and Esthetician" decoding="async"><div><p class="eyebrow">Meet your professional</p><h2 id="profile-name">${person.name}</h2><h3>${person.role}</h3><p>${person.bio}</p><p>${person.specialties.join(' · ')}</p><h3>Services with ${person.name}</h3>${person.categories.map(category=>`<p><a href="bookings.html?professional=${person.id}&service=${encodeURIComponent(category)}">${category} ↗</a></p>`).join('')}<a class="btn btn-primary" href="${book.href}">Book with ${person.name}</a><p>Professional requests are subject to salon confirmation.</p></div>`;
      dialog.querySelector('button').onclick=()=>dialog.close(); dialog.showModal();
    });
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog && (event.clientX<dialog.getBoundingClientRect().left || event.clientX>dialog.getBoundingClientRect().right || event.clientY<dialog.getBoundingClientRect().top || event.clientY>dialog.getBoundingClientRect().bottom))dialog.close();});
})();
