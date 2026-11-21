/* FZ Barra Móvil | Interacciones, opiniones y solicitudes de presupuesto.
   Configurá SUPABASE_URL y SUPABASE_ANON_KEY para habilitar el almacenamiento compartido.
*/
const SUPABASE_URL = 'https://bqqktwikyqychyazzlbs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MRQLfMPFCiFK7dZNPaW4IA_kZh4nCwZ';
const hasSupabaseConfig = SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.startsWith('ey');
const db = hasSupabaseConfig && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
let chosenRating = 0;
let adminUser = null;

$('#year').textContent = new Date().getFullYear();

// Carrusel abanico: hover, click y foco mantienen una tarjeta destacada.
const fanCards = $$('.fan-card');
function activateCard(card){ fanCards.forEach(c=>c.classList.toggle('active',c===card)); }
fanCards.forEach(card=>{
  card.addEventListener('mouseenter',()=>activateCard(card));
  card.addEventListener('focus',()=>activateCard(card));
  card.addEventListener('click',()=>{ activateCard(card); openPanel(card.dataset.panel); });
});
$('#fan').addEventListener('mouseleave',()=>fanCards.forEach(c=>c.classList.remove('active')));

const backdrop=$('#modalBackdrop'), modalContent=$('#modalContent');
function openPanel(name){
  const map={contacto:'contactTemplate',presupuesto:'budgetTemplate',tragos:'drinksTemplate',nosotros:'aboutTemplate',opiniones:'reviewsTemplate'};
  const tpl=document.getElementById(map[name]); if(!tpl)return;
  modalContent.replaceChildren(tpl.content.cloneNode(true));
  backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
  bindPanel(name);
  $('#modalClose').focus();
}
function closePanel(){backdrop.classList.remove('open');backdrop.setAttribute('aria-hidden','true');document.body.style.overflow='';}
$('#modalClose').addEventListener('click',closePanel);
backdrop.addEventListener('click',e=>{if(e.target===backdrop)closePanel();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&backdrop.classList.contains('open'))closePanel();});

function bindPanel(name){
  if(name==='presupuesto'){
    $('#budgetForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const form=e.currentTarget, values=new FormData(form);
      const request={
        name:String(values.get('name')||'').trim(),
        event:String(values.get('event')||'').trim(),
        date:String(values.get('date')||'')||null,
        guests:Number(values.get('guests'))||null,
        whatsapp:String(values.get('whatsapp')||'').trim(),
        email:String(values.get('email')||'').trim(),
        details:String(values.get('details')||'').trim()
      };
      const emailOk=!request.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email);
      const phoneDigits=request.whatsapp.replace(/\D/g,'');
      if(request.name.length<2||request.event.length<3){setBudgetStatus('Completá tu nombre y el tipo de evento.','error');return;}
      if(!request.whatsapp&&!request.email){setBudgetStatus('Dejanos un WhatsApp o un correo para poder contactarte.','error');return;}
      if(request.whatsapp&&phoneDigits.length<8){setBudgetStatus('Revisá el número de WhatsApp: debe incluir al menos 8 dígitos.','error');return;}
      if(request.guests!==null&&(!Number.isInteger(request.guests)||request.guests<1||request.guests>5000)){setBudgetStatus('La cantidad de invitados debe ser un número entero entre 1 y 5000.','error');return;}
      if(!emailOk){setBudgetStatus('Ingresá un correo electrónico válido.','error');return;}
      if(!db){setBudgetStatus('La recepción online todavía no está configurada. El equipo debe conectar Supabase para guardar tu solicitud.','error');return;}
      const submit=form.querySelector('button[type="submit"]');
      submit.disabled=true;
      setBudgetStatus('Enviando tu solicitud...','');
      try{
        const {error}=await db.from('budget_requests').insert(request);
        if(error)throw error;
        showBudgetConfirmation(request);
      }catch(err){
        setBudgetStatus('No se pudo guardar la solicitud. Intentá nuevamente o escribinos por WhatsApp.','error');
        submit.disabled=false;
        console.error(err);
      }
    });
  }
  if(name==='opiniones') bindReviews();
}

async function fetchReviews(admin=false){
  if(!db)throw new Error('Supabase no está configurado.');
  let query=db.from('reviews').select('*').order('created_at',{ascending:false});
  if(!admin)query=query.eq('visible',true);
  const {data,error}=await query;if(error)throw error;return data||[];
}
async function saveReview(review){
  if(!db)throw new Error('Supabase no está configurado.');
  const {error}=await db.from('reviews').insert([{...review,visible:true}]);if(error)throw error;
}
function bindReviews(){
  const tabs=$$('.tab');
  tabs.forEach(tab=>tab.addEventListener('click',()=>{
    tabs.forEach(t=>t.classList.toggle('active',t===tab));
    ['write','read','admin'].forEach(k=>$('#review'+k[0].toUpperCase()+k.slice(1)).classList.toggle('hidden',tab.dataset.tab!==k));
    if(tab.dataset.tab==='read')loadPublicReviews();
    if(tab.dataset.tab==='admin')refreshAdmin();
  }));
  const form=$('#reviewForm');
  const name=form.elements.name,comment=form.elements.comment;
  [name,comment].forEach(input=>input.addEventListener('input',()=>validateReviewForm()));
  $$('.stars button').forEach(btn=>btn.addEventListener('click',()=>{
    chosenRating=Number(btn.dataset.rating);form.elements.rating.value=String(chosenRating);
    $$('.stars button').forEach(b=>b.classList.toggle('selected',Number(b.dataset.rating)<=chosenRating));
    validateReviewForm();
  }));
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!validateReviewForm())return;
    const submit=$('#reviewSubmit');submit.disabled=true;$('#reviewStatus').textContent='Enviando tu opinión...';
    try{
      await saveReview({name:name.value.trim(),rating:chosenRating,comment:comment.value.trim()});
      form.reset();chosenRating=0;$$('.stars button').forEach(b=>b.classList.remove('selected'));validateReviewForm();
      $('#reviewStatus').textContent='¡Gracias! Tu opinión fue recibida.';$('#reviewStatus').className='form-status success';
    }catch(err){$('#reviewStatus').textContent='No se pudo guardar. Revisá la conexión o la configuración de la base de datos.';$('#reviewStatus').className='form-status error';console.error(err);}
    finally{validateReviewForm();}
  });
  $('#adminLogin').addEventListener('submit',loginAdmin);
  $('#adminLogout').addEventListener('click',logoutAdmin);
  loadPublicReviews();
}
function validateReviewForm(){
  const form=$('#reviewForm');if(!form)return false;
  const n=form.elements.name,c=form.elements.comment;
  const nameOk=/^[\p{L}][\p{L}\s.'’-]{1,59}$/u.test(n.value.trim());
  const commentText=c.value.trim();const commentOk=commentText.length>=12&&/[\p{L}]{2}/u.test(commentText)&&!/^\d+$/.test(commentText);
  setField(n,nameOk,n.value.trim().length===0?'Ingresá tu nombre (solo letras y espacios).':'Usá un nombre válido de al menos 2 letras.');
  setField(c,commentOk,'Escribí una oración de al menos 12 caracteres.');
  $('#ratingState').textContent=chosenRating?'✓ Puntuación seleccionada: '+chosenRating+'/5':'Elegí de 1 a 5 estrellas.';
  $('#ratingState').className='field-state '+(chosenRating?'success':'error');
  const valid=nameOk&&commentOk&&chosenRating>0;
  const count=[nameOk,commentOk,chosenRating>0].filter(Boolean).length;
  $('#progressBar').style.width=(count/3*100)+'%';
  $('#reviewSubmit').disabled=!valid;
  $('#reviewStatus').textContent=valid?'¡Todo listo! Ya podés publicar tu opinión.':`Validación: ${count} de 3 campos completos.`;
  $('#reviewStatus').className='form-status '+(valid?'success':'');
  return valid;
}
function setField(input,valid,errorText){
  const state=input.parentElement.querySelector('.field-state');
  input.classList.toggle('valid',valid);input.classList.toggle('invalid',input.value.trim().length>0&&!valid);
  if(state){state.textContent=input.value.trim().length===0?'':(valid?'✓ Correcto':('✕ '+errorText));state.className='field-state '+(valid?'success':input.value.trim()?'error':'');}
}
function safeText(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function setBudgetStatus(message,state){const status=$('#budgetStatus');status.textContent=message;status.className='form-status '+state;}
function showBudgetConfirmation(request){
  const confirmation=document.createElement('div');
  confirmation.className='budget-confirmation';
  confirmation.innerHTML='<h2 id="modalTitle">Tu presupuesto está <em>en proceso</em></h2><p class="modal-lead">Recibimos lo que nos contaste:</p>';
  const details=document.createElement('dl');
  const rows=[
    ['Nombre',request.name],['Evento',request.event],['Fecha',request.date||'A definir'],
    ['Invitados',request.guests||'A definir'],['WhatsApp',request.whatsapp],
    ['Correo electrónico',request.email],['Detalles',request.details||'Sin detalles adicionales']
  ];
  rows.filter(([,value])=>value).forEach(([label,value])=>{
    const row=document.createElement('div'), term=document.createElement('dt'), description=document.createElement('dd');
    term.textContent=label;description.textContent=String(value);row.append(term,description);details.append(row);
  });
  const thanks=document.createElement('p');
  thanks.className='form-status success';
  thanks.textContent='Pronto tendrás tu presupuesto. ¡Gracias!';
  confirmation.append(details,thanks);
  modalContent.replaceChildren(confirmation);
  $('#modalClose').focus();
}
function reviewMarkup(r){const date=r.created_at?new Date(r.created_at).toLocaleDateString('es-AR'):'Reciente';return `<article class="review-card"><div class="review-card-top"><b>${safeText(r.name)}</b><span class="review-stars">${'★'.repeat(Number(r.rating)||0)}${'☆'.repeat(5-(Number(r.rating)||0))}</span></div><p>${safeText(r.comment)}</p><time>${date}</time></article>`;}
async function loadPublicReviews(){
  const list=$('#reviewsList');if(!list)return;list.innerHTML='<p class="admin-note">Cargando comentarios...</p>';
  try{const rows=await fetchReviews(false);const avg=rows.length?rows.reduce((s,r)=>s+Number(r.rating),0)/rows.length:0;
    $('#reviewsSummary').textContent=rows.length?`${avg.toFixed(1)} ★ · ${rows.length} ${rows.length===1?'opinión':'opiniones'}`:'Todavía no hay opiniones publicadas.';
    list.innerHTML=rows.length?rows.map(reviewMarkup).join(''):'<p class="admin-note">Sé la primera persona en compartir tu experiencia con FZ.</p>';
  }catch(err){list.innerHTML=`<p class="form-status error">${db?'No se pudieron cargar los comentarios. Revisá la conexión y la configuración de Supabase.':'Los comentarios compartidos estarán disponibles cuando el equipo configure Supabase.'}</p>`;console.error(err);}
}
async function loginAdmin(e){
  e.preventDefault();const status=$('#adminStatus');
  if(!db){status.textContent='Configurá Supabase para habilitar el acceso privado.';status.className='form-status error';return;}
  const f=new FormData(e.currentTarget);const {data,error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});
  if(error){status.textContent='No se pudo iniciar sesión. Revisá email y contraseña.';status.className='form-status error';return;}
  adminUser=data.user;status.textContent='Sesión iniciada.';status.className='form-status success';await refreshAdmin();
}
async function refreshAdmin(){
  if(!db){$('#adminStatus').textContent='Modo demostración: no hay acceso administrador online.';return;}
  const {data}=await db.auth.getUser();adminUser=data.user;
  if(!adminUser){$('#adminLogin').classList.remove('hidden');$('#adminArea').classList.add('hidden');return;}
  $('#adminLogin').classList.add('hidden');$('#adminArea').classList.remove('hidden');
  try{const rows=await fetchReviews(true);$('#adminReviews').innerHTML=rows.length?rows.map(r=>`<div class="admin-row"><span>${safeText(r.name)} · ${Number(r.rating)}★ · ${r.visible?'Visible':'Oculta'}</span><button data-review-id="${safeText(r.id)}" data-visible="${!r.visible}">${r.visible?'Ocultar':'Publicar'}</button></div>`).join(''):'<p class="admin-note">Todavía no hay opiniones.</p>';
    $$('#adminReviews button').forEach(btn=>btn.addEventListener('click',()=>setReviewVisibility(btn.dataset.reviewId,btn.dataset.visible==='true')));
  }catch(err){$('#adminReviews').textContent='No se pudieron cargar las opiniones. Verificá las políticas de acceso.';console.error(err);}
  await loadBudgetRequests();
}
async function setReviewVisibility(id,visible){if(!db)return;const {error}=await db.from('reviews').update({visible}).eq('id',id);if(error){$('#adminStatus').textContent='No se pudo actualizar el comentario.';return;}refreshAdmin();}
async function loadBudgetRequests(){
  const list=$('#adminBudgetRequests');
  try{
    const {data,error}=await db.from('budget_requests').select('*').order('created_at',{ascending:false});
    if(error)throw error;
    list.innerHTML=data.length?data.map(r=>`<article class="budget-request-card"><b>${safeText(r.name)} · ${safeText(r.event)}</b><p>WhatsApp: ${safeText(r.whatsapp||'No indicado')} · Email: ${safeText(r.email||'No indicado')}</p><p>Fecha: ${safeText(r.date||'A definir')} · Invitados: ${safeText(r.guests||'A definir')}</p><p>${safeText(r.details||'Sin detalles adicionales')}</p></article>`).join(''):'<p class="admin-note">Todavía no hay solicitudes.</p>';
  }catch(err){list.innerHTML='<p class="form-status error">No se pudieron cargar las solicitudes. Verificá la tabla y las políticas de acceso.</p>';console.error(err);}
}
async function logoutAdmin(){if(db)await db.auth.signOut();adminUser=null;$('#adminArea').classList.add('hidden');$('#adminLogin').classList.remove('hidden');$('#adminStatus').textContent='Sesión cerrada.';}
