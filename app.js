/* FZ Barra Móvil | Interacciones y opiniones.
   Para guardar opiniones entre dispositivos, completar SUPABASE_URL y SUPABASE_ANON_KEY.
   Sin configuración, el sitio funciona en modo demostración con localStorage del navegador.
*/
const SUPABASE_URL = 'PEGAR_URL_DE_TU_PROYECTO';
const SUPABASE_ANON_KEY = 'PEGAR_CLAVE_ANON_PUBLICA';
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
    $('#onlineBudget').addEventListener('click',()=>$('#budgetForm').classList.toggle('hidden'));
    $('#budgetForm').addEventListener('submit',e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);const n=String(f.get('name')||'').trim();const ev=String(f.get('event')||'').trim();
      if(n.length<2||ev.length<3){alert('Completá tu nombre y el tipo de evento.');return;}
      const msg=`Hola FZ! Quiero solicitar un presupuesto.\nNombre: ${n}\nEvento: ${ev}\nFecha: ${f.get('date')||'A definir'}\nInvitados: ${f.get('guests')||'A definir'}\nDetalles: ${f.get('details')||'Sin detalles adicionales'}`;
      window.open(`https://wa.me/message/AFC0QXZST4M6C1?text=${encodeURIComponent(msg)}`,'_blank','noopener');
    });
  }
  if(name==='opiniones') bindReviews();
}

function readLocal(){try{return JSON.parse(localStorage.getItem('fz_reviews')||'[]')}catch{return []}}
function writeLocal(rows){localStorage.setItem('fz_reviews',JSON.stringify(rows));}
async function fetchReviews(admin=false){
  if(!db){const rows=readLocal();return admin?rows:rows.filter(r=>r.visible!==false);}
  let query=db.from('reviews').select('*').order('created_at',{ascending:false});
  if(!admin)query=query.eq('visible',true);
  const {data,error}=await query;if(error)throw error;return data||[];
}
async function saveReview(review){
  if(!db){const rows=readLocal();rows.unshift({...review,id:crypto.randomUUID(),visible:true,created_at:new Date().toISOString()});writeLocal(rows);return;}
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
function reviewMarkup(r){const date=r.created_at?new Date(r.created_at).toLocaleDateString('es-AR'):'Reciente';return `<article class="review-card"><div class="review-card-top"><b>${safeText(r.name)}</b><span class="review-stars">${'★'.repeat(Number(r.rating)||0)}${'☆'.repeat(5-(Number(r.rating)||0))}</span></div><p>${safeText(r.comment)}</p><time>${date}</time></article>`;}
async function loadPublicReviews(){
  const list=$('#reviewsList');if(!list)return;list.innerHTML='<p class="admin-note">Cargando comentarios...</p>';
  try{const rows=await fetchReviews(false);const avg=rows.length?rows.reduce((s,r)=>s+Number(r.rating),0)/rows.length:0;
    $('#reviewsSummary').textContent=rows.length?`${avg.toFixed(1)} ★ · ${rows.length} ${rows.length===1?'opinión':'opiniones'}`:'Todavía no hay opiniones publicadas.';
    list.innerHTML=rows.length?rows.map(reviewMarkup).join(''):'<p class="admin-note">Sé la primera persona en compartir tu experiencia con FZ.</p>';
  }catch(err){list.innerHTML='<p class="form-status error">No se pudieron cargar los comentarios. Revisá la configuración.</p>';console.error(err);}
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
}
async function setReviewVisibility(id,visible){if(!db)return;const {error}=await db.from('reviews').update({visible}).eq('id',id);if(error){$('#adminStatus').textContent='No se pudo actualizar el comentario.';return;}refreshAdmin();}
async function logoutAdmin(){if(db)await db.auth.signOut();adminUser=null;$('#adminArea').classList.add('hidden');$('#adminLogin').classList.remove('hidden');$('#adminStatus').textContent='Sesión cerrada.';}
