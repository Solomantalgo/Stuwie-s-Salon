/* Stuwie's existing professionals and their published specialties. */
window.STUWIES_TEAM = [
  {id:'barbra',name:'Barbra',role:'Hairstylist',image:'Barbra-Hairstylist.jpg',bio:"Ladies' hair, styling and treatments.",categories:['Hair Services (Ladies)'],specialties:['Hair styling','Treatments','Ladies’ hair']},
  {id:'james',name:'James',role:'Barber',image:'james-Barber.jpg',bio:"Gents' cuts, fades and beard care.",categories:['Barbering Services (Gents)'],specialties:['Haircuts','Fades','Beard care']},
  {id:'brenda',name:'Brenda',role:'Massage Therapist',image:'Brenda-Massage-Therapist.jpg',bio:'Relaxation, deep tissue and prenatal care.',categories:['Massages'],specialties:['Relaxation','Deep tissue','Prenatal massage']},
  {id:'scovia',name:'Scovia',role:'Nail Technician',image:'Scovia-Nails.jpg',bio:'Manicures, pedicures and nail enhancements.',categories:['Manicure & Pedicure'],specialties:['Manicures','Pedicures','Nail enhancements']}
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
      dialog.innerHTML=`<button class="close-btn" type="button" aria-label="Close profile">&times;</button><img src="assets/images/${person.image}" alt="${person.name}"><div><p class="eyebrow">Meet your professional</p><h2 id="profile-name">${person.name}</h2><h3>${person.role}</h3><p>${person.bio}</p><p>${person.specialties.join(' · ')}</p><h3>Services with ${person.name}</h3>${person.categories.map(category=>`<p><a href="bookings.html?professional=${person.id}&service=${encodeURIComponent(category)}">${category} ↗</a></p>`).join('')}<a class="btn btn-primary" href="${book.href}">Book with ${person.name}</a><p>Professional requests are subject to salon confirmation.</p></div>`;
      dialog.querySelector('button').onclick=()=>dialog.close(); dialog.showModal();
    });
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog && (event.clientX<dialog.getBoundingClientRect().left || event.clientX>dialog.getBoundingClientRect().right || event.clientY<dialog.getBoundingClientRect().top || event.clientY>dialog.getBoundingClientRect().bottom))dialog.close();});
})();
