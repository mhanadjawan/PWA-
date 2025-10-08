
function escapeHtml(s){ if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
async function hashPassword(password) { const enc = new TextEncoder(); const data = await crypto.subtle.digest('SHA-256', enc.encode(password)); return Array.from(new Uint8Array(data)).map(b=>b.toString(16).padStart(2,'0')).join(''); }

function loadUsers(){ try{ return JSON.parse(localStorage.getItem('fc_users')||'[]'); }catch(e){ return []; } }
function saveUsers(u){ localStorage.setItem('fc_users', JSON.stringify(u)); }
function loadCards(){ try{ return JSON.parse(localStorage.getItem('fc_cards')||'[]'); }catch(e){ return []; } }
function saveCards(c){ localStorage.setItem('fc_cards', JSON.stringify(c)); }
function loadClaims(){ try{ return JSON.parse(localStorage.getItem('fc_claims')||'[]'); }catch(e){ return []; } }
function saveClaims(c){ localStorage.setItem('fc_claims', JSON.stringify(c)); }
function setSessionUser(id){ localStorage.setItem('fc_session_user', id); }
function getSessionUserId(){ return localStorage.getItem('fc_session_user') || null; }
function clearSession(){ localStorage.removeItem('fc_session_user'); }

const CATEGORIES = ['عام','رياضيات','علوم','العلوم الدينية (إسلامية)','الفيزياء','الكيمياء','HTML','CSS','JavaScript','PHP','Python','Java','C#','C++','SQL','Ruby','Go','Swift','TypeScript','Kotlin','لغات البرمجة عامة','لغات تصميم الويب عام',' لغات انسانية طبيعية'];

const main = document.getElementById('main');
const modalLogin = document.getElementById('modal-login');
const modalProfile = document.getElementById('modal-profile');
const modalAddCard = document.getElementById('modal-addcard');
const modalQuiz = document.getElementById('modal-quiz');
let deferredPrompt = null;

document.addEventListener('DOMContentLoaded', init);

function init(){
  const btnSettings = document.getElementById('btnSettings');
 const btnInstall  = document.getElementById('btnInstall');
  const btnLogout   = document.getElementById('btnLogout');

  if (btnSettings) btnSettings.addEventListener('click', ()=> location.href='settings.html');
  if (btnLogout) btnLogout.addEventListener('click', ()=> { logout(); showLoginModal(); });

  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; const el = document.getElementById('btnInstall'); if (el) el.classList.remove('hidden'); });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
          console.log('Service Worker registered successfully:', registration);
      })
      .catch(error => {
          console.error('Service Worker registration failed:', error);
      });
}

  const catSelect = document.getElementById('card-category');
  if (catSelect) catSelect.innerHTML = CATEGORIES.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  setupLoginModal(); 
  setupAddCardModal();
  const sid = getSessionUserId();
  showLoginModal(sid);
}

function setupLoginModal(){
  const select = document.getElementById('login-user-select');
  const btnDoLogin = document.getElementById('btnDoLogin');
  const btnOpenCreate = document.getElementById('btnOpenCreate');
  const btnCreateUser = document.getElementById('btnCreateUser');
  const btnCloseLogin = document.getElementById('btnCloseLogin');

  function refreshUsersSelect(){ const users = loadUsers(); select.innerHTML = users.map(u=>`<option value="${u.id}">${escapeHtml(u.username)} (${escapeHtml(u.name)})</option>`).join(''); if (users.length===0) select.innerHTML='<option value="">لا يوجد مستخدم</option>'; }
  refreshUsersSelect();

  if (btnDoLogin) btnDoLogin.addEventListener('click', async ()=>{
    const uid = select.value; const pwd = document.getElementById('login-password').value||'';
    if (!uid) return alert('اختر حسابًا أو أنشئ حسابًا جديدًا');
    const users = loadUsers(); const user = users.find(x=>x.id===uid); if (!user) return alert('المستخدم غير موجود');
    const hash = await hashPassword(pwd);
    if (hash === user.passwordHash){ setSessionUser(user.id); hideModal(modalLogin); renderAppForUser(user.id); } else alert('كلمة المرور خاطئة');
  });

  if (btnOpenCreate) btnOpenCreate.addEventListener('click', ()=> document.getElementById('create-username').focus());
  if (btnCreateUser) btnCreateUser.addEventListener('click', async ()=>{
    const username = document.getElementById('create-username').value.trim();
    const name = document.getElementById('create-name').value.trim();
    const age = document.getElementById('create-age').value.trim();
    const grade = document.getElementById('create-grade').value.trim();
    const password = document.getElementById('create-password').value || '';
    if (!username || !name || !age || !grade || !password) return alert('املأ كل الحقول لإنشاء المستخدم');
    const users = loadUsers(); if (users.find(u=>u.username===username)) return alert('اسم الحساب مستخدم');
    const hash = await hashPassword(password);
    const newu = { id:'u'+Date.now().toString(36), username, name, age, grade, passwordHash:hash, points:0, correct:0, wrong:0, createdAt:new Date().toISOString() };
    users.push(newu); saveUsers(users); alert('تم إنشاء المستخدم بنجاح'); refreshUsersSelect(); select.value=newu.id;
  });
  if (btnCloseLogin) btnCloseLogin.addEventListener('click', ()=> hideModal(modalLogin));
}

function setupAddCardModal(){
  const btnSaveCard = document.getElementById('btnSaveCard');
  const btnCancelCard = document.getElementById('btnCancelCard');
  if (btnCancelCard) btnCancelCard.addEventListener('click', ()=> hideModal(modalAddCard));
  if (btnSaveCard) btnSaveCard.addEventListener('click', async ()=>{
    const q = document.getElementById('card-question').value.trim();
    const c1 = document.getElementById('choice-1').value.trim();
    const c2 = document.getElementById('choice-2').value.trim();
    const c3 = document.getElementById('choice-3').value.trim();
    const correctIndex = Number(document.getElementById('card-correct').value) - 1;
    const category = document.getElementById('card-category').value || 'عام';
    if (!q || !c1 || !c2 || !c3) return alert('أدخل السؤال والثلاث إجابات');
    const sessionId = getSessionUserId(); if (!sessionId) return alert('سجل الدخول أولاً');
    const cards = loadCards();
    const card = { id:'c'+Date.now().toString(36), userId:sessionId, question:q, choices:[{text:c1,correct: correctIndex===0},{text:c2,correct: correctIndex===1},{text:c3,correct: correctIndex===2}], category:category, errorCount:0, createdAt:new Date().toISOString() };
    cards.push(card); saveCards(cards); hideModal(modalAddCard); renderAppForUser(sessionId);
  });
}

function showModal(el){ if (!el) return; el.classList.remove('hidden'); }
function hideModal(el){ if (!el) return; el.classList.add('hidden'); }

function renderAppForUser(userId){
  const users = loadUsers(); const user = users.find(u=>u.id===userId);
  if (!user) { showLoginModal(); return; }
  document.getElementById('btnLogout').classList.remove('hidden');
  main.innerHTML = `
    <div class="card">
      <h2>مرحبًا ${escapeHtml(user.name)}</h2>
      <div>اسم الحساب: ${escapeHtml(user.username)}</div>
      <div>العمر: ${escapeHtml(user.age)} - ${escapeHtml(user.grade)}</div>
      <div>النقاط: <span id="user-points">${user.points}</span></div>
      <div style="margin-top:8px"><button id="btnAddNewCard" class="btn">➕ إضافة بطاقة</button> <button id="btnRequestPrize" class="btn">طلب الجائزة</button></div>
    </div>
    <div class="card">
      <h3>التصنيفات</h3>
      <div id="categories-list" class="grid"></div>
    </div>
    <div class="card">
      <h3>كل البطاقات الخاصة بك</h3>
      <div id="cards-list" class="grid"></div>
    </div>
  `;
  document.getElementById('btnAddNewCard').addEventListener('click', ()=> showModal(modalAddCard));
  document.getElementById('btnRequestPrize').addEventListener('click', ()=> requestPrize());
  renderCategories(userId); renderCardsList(userId);
}

function renderCategories(userId){
  const div = document.getElementById('categories-list'); if (!div) return;
  div.innerHTML = CATEGORIES.map(c=>`<div class="card"><strong>${escapeHtml(c)}</strong><div style="margin-top:8px"><button class="btn small view-cat" data-cat="${escapeHtml(c)}">عرض</button><button class="btn small" data-cat="${escapeHtml(c)}" onclick="exportCategoryCSV('${escapeHtml(c)}')">تصدير</button></div></div>`).join('');
  document.querySelectorAll('.view-cat').forEach(b=> b.addEventListener('click', (e)=>{ const cat = e.currentTarget.dataset.cat; showCardsByCategory(cat); }));
}

function renderCardsList(userId){
  const div = document.getElementById('cards-list'); if (!div) return;
  const cards = loadCards().filter(c=>c.userId===userId);
  if (cards.length===0) { div.innerHTML = '<div class="muted">لا توجد بطاقات بعد</div>'; return; }
  div.innerHTML = cards.map(c=>`<div class="card"><div><b>س:</b> ${escapeHtml(c.question)}</div><div>تصنيف: ${escapeHtml(c.category)}</div><div style="margin-top:8px"><button class="btn small play-card" data-id="${c.id}">اختبار</button><button class="btn small" data-id="${c.id}" style="background:#e74c3c;margin-left:6px" onclick="deleteCard('${c.id}')">حذف</button></div></div>`).join('');
  document.querySelectorAll('.play-card').forEach(b=> b.addEventListener('click', (e)=> playCard(e.currentTarget.dataset.id)));
}

function showCardsByCategory(cat){
  const sessionId = getSessionUserId(); if (!sessionId) return alert('سجل الدخول');
  const cards = loadCards().filter(c=>c.userId===sessionId && c.category===cat);
  if (cards.length===0) return alert('لا توجد بطاقات في هذا التصنيف');
  const content = cards.map((c)=> `<div class="card"><div><b>س:</b> ${escapeHtml(c.question)}</div><div style="margin-top:8px"><button class="btn small play-card" data-id="${c.id}">اختبار</button></div></div>`).join('');
  main.innerHTML = `<div class="card"><h3>بطاقات: ${escapeHtml(cat)}</h3>${content}<div style="margin-top:8px"><button class="btn" onclick="renderAppForUser('${sessionId}')">رجوع</button></div></div>`;
  document.querySelectorAll('.play-card').forEach(b=> b.addEventListener('click', (e)=> playCard(e.currentTarget.dataset.id)));
}

function playCard(cardId){
  const cards = loadCards(); const card = cards.find(c=>c.id===cardId);
  if (!card) return alert('البطاقة غير موجودة');
  const choices = card.choices.map((ch, idx)=> ({...ch, idx})).sort(()=>Math.random()-0.5);
  document.getElementById('quiz-question').innerText = card.question;
  const container = document.getElementById('quiz-choices');
  container.innerHTML = choices.map((ch)=>`<button class="btn small choice-btn" data-idx="${ch.idx}">${escapeHtml(ch.text)}</button>`).join('');
  container.querySelectorAll('.choice-btn').forEach(btn=> btn.addEventListener('click', (e)=>{
    const chosenIdx = Number(e.currentTarget.dataset.idx); const picked = card.choices[chosenIdx];
    const sessionId = getSessionUserId(); if (!sessionId) return alert('سجل الدخول');
    const users = loadUsers(); const user = users.find(u=>u.id===sessionId);
    let stats = {correct: user.correct||0, wrong: user.wrong||0, points: user.points||0, penalty: user.penalty||0};
    if (picked && picked.correct){ alert('✅ إجابة صحيحة'); stats.correct = (stats.correct||0) + 1; stats.points = (stats.points||0) + 10; }
    else { alert('❌ إجابة خاطئة'); stats.wrong = (stats.wrong||0) + 1; stats.penalty = (stats.penalty||0) + 5; stats.points = (stats.points||0) - 5; card.errorCount = (card.errorCount||0) + 1; saveCards(cards); }
    const idx = users.findIndex(u=>u.id===user.id); users[idx] = {...user, correct: stats.correct, wrong: stats.wrong, points: stats.points, penalty: stats.penalty}; saveUsers(users);
    const ptsEl = document.getElementById('user-points'); if (ptsEl) ptsEl.innerText = stats.points; hideModal(modalQuiz);
  }));
  showModal(modalQuiz);
}

function deleteCard(id){ if (!confirm('حذف هذه البطاقة؟')) return; const cards = loadCards().filter(c=>c.id!==id); saveCards(cards); const sessionId = getSessionUserId(); renderAppForUser(sessionId); }

function exportToCSV(rows, headers){ const cols = headers || Object.keys(rows[0]||{}); const lines = [cols.join(',')]; rows.forEach(r=>{ const row = cols.map(c=>`"${String(r[c]||'').replace(/"/g,'""')}"`).join(','); lines.push(row); }); return lines.join('\n'); }
window.exportCategoryCSV = function(cat){ const sessionId = getSessionUserId(); if (!sessionId) return alert('سجل الدخول'); const rows = loadCards().filter(c=>c.userId===sessionId && c.category===cat).map(c=>({id:c.id,question:c.question,category:c.category,choice1:c.choices[0].text,choice2:c.choices[1].text,choice3:c.choices[2].text})); if (rows.length===0) return alert('لا توجد بطاقات للتصدير في هذا التصنيف'); const csv = exportToCSV(rows,['id','question','category','choice1','choice2','choice3']); const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `flashcards_${cat.replace(/\s+/g,'_')}.csv`; a.click(); URL.revokeObjectURL(a.href); };

document.addEventListener('click', (e)=>{ if (e.target && e.target.id === 'btnExportAll') { const sessionId = getSessionUserId(); if (!sessionId) return alert('سجل الدخول'); const rows = loadCards().filter(c=>c.userId===sessionId).map(c=>({id:c.id,question:c.question,category:c.category,choice1:c.choices[0].text,choice2:c.choices[1].text,choice3:c.choices[2].text})); if (rows.length===0) return alert('لا توجد بطاقات للتصدير'); const csv = exportToCSV(rows,['id','question','category','choice1','choice2','choice3']); const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'flashcards_all.csv'; a.click(); URL.revokeObjectURL(a.href); } });

document.addEventListener('click', (e)=>{ if (e.target && e.target.id === 'btnExportClaims') { const claims = loadClaims(); if (claims.length===0) return alert('لا توجد طلبات'); const rows = claims.map(c=>({id:c.id,userName:c.name,points:c.points,status:c.status,createdAt:c.createdAt})); const csv = exportToCSV(rows,['id','userName','points','status','createdAt']); const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'claims.csv'; a.click(); URL.revokeObjectURL(a.href); } });

function requestPrize(){ const sessionId = getSessionUserId(); if (!sessionId) return alert('سجل الدخول'); const users = loadUsers(); const user = users.find(u=>u.id===sessionId); if (!user) return alert('المستخدم غير موجود'); if ((user.points||0) < 1000) return alert('لم تصل للنقاط المطلوبة بعد'); const claims = loadClaims(); const claim = { id:'cl'+Date.now().toString(36), userId:user.id, name:user.name, points:user.points, status:'pending', createdAt:new Date().toISOString() }; claims.push(claim); saveClaims(claims); alert('تم تقديم طلب الجائزة. سنراجعها.'); }

function logout(){ clearSession(); document.getElementById('btnLogout').classList.add('hidden'); main.innerHTML = ''; showLoginModal(); }

function showLoginModal(prefillId){ const users = loadUsers(); const select = document.getElementById('login-user-select'); if (select) select.innerHTML = users.map(u=>`<option value="${u.id}">${escapeHtml(u.username)} (${escapeHtml(u.name)})</option>`).join(''); if (prefillId && select) select.value = prefillId; showModal(modalLogin); }

if (location.pathname.endsWith('settings.html')){
  document.addEventListener('DOMContentLoaded', ()=>{
    const info = document.getElementById('settings-user-info'); const users = loadUsers();
    info.innerHTML = users.map(u=>`<div>${escapeHtml(u.username)} - ${escapeHtml(u.name)} - نقاط: ${u.points||0} <button class="btn small edit-u" data-id="${u.id}">تعديل</button> <button class="btn small" data-id="${u.id}" onclick="switchUserConfirm('${u.id}')">تبديل</button></div>`).join('') || '<div class="muted">لا يوجد مستخدم</div>';
    document.getElementById('btnEditAccount').addEventListener('click', ()=>{ showModal(document.getElementById('modal-profile')); populateProfileForm(); });
    document.getElementById('btnAddUser').addEventListener('click', ()=>{ showModal(modalLogin); });
    const themeSelect = document.getElementById('theme-select'); const savedTheme = localStorage.getItem('fc_theme') || 'light'; themeSelect.value = savedTheme; if (savedTheme==='dark') document.documentElement.setAttribute('data-theme','dark');
    themeSelect.addEventListener('change', (e)=>{ localStorage.setItem('fc_theme', e.target.value); if (e.target.value==='dark') document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme'); });
    document.getElementById('btnRequestNotification').addEventListener('click', async ()=>{ if (!('Notification' in window)) return alert('المتصفح لا يدعم الإشعارات'); const p = await Notification.requestPermission(); if (p==='granted'){ new Notification('تم تفعيل الإشعارات',{body:'ستصل لك تذكيرات'}); } else alert('لم تُمنح الأذونات'); });
    document.getElementById('btnExportAll').id = 'btnExportAll';
    const fileImport = document.getElementById('fileImport'); fileImport.addEventListener('change', async (ev)=>{ const f = ev.target.files[0]; if (!f) return; const txt = await f.text(); const rows = txt.split('\n').slice(1).map(r=>r.trim()).filter(Boolean); for (const row of rows){ const cols = row.split(',').map(c=>c.replace(/^"|"$/g,'')); const [id,question,category,choice1,choice2,choice3] = cols; const sessionId = getSessionUserId() || (loadUsers()[0] && loadUsers()[0].id); if (!sessionId) continue; const cards = loadCards(); cards.push({ id: id||('c'+Date.now().toString(36)), userId: sessionId, question, category, choices:[{text:choice1||'',correct:true},{text:choice2||'',correct:false},{text:choice3||'',correct:false}], createdAt:new Date().toISOString() }); saveCards(cards); } alert('تم الاستيراد (تقريبي)'); });
    const exportByCatDiv = document.getElementById('export-by-cat'); exportByCatDiv.innerHTML = CATEGORIES.map(c=>`<button class="btn small" onclick="(function(){ exportCategoryCSV('${escapeHtml(c)}') })()">${escapeHtml(c)}</button>`).join(' ');
    document.getElementById('btnExportClaims').addEventListener('click', ()=>{ const claims = loadClaims(); if (claims.length===0) return alert('لا توجد طلبات'); const csv = exportToCSV(claims.map(c=>({id:c.id,userName:c.name,points:c.points,status:c.status,createdAt:c.createdAt})), ['id','userName','points','status','createdAt']); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='claims.csv'; a.click(); });
    document.querySelectorAll('.edit-u').forEach(b=> b.addEventListener('click', (e)=>{ const id = e.currentTarget.dataset.id; populateProfileForm(id); showModal(document.getElementById('modal-profile')); }));
  });
}

function populateProfileForm(userId){
  const users = loadUsers(); const uid = userId || getSessionUserId(); const user = users.find(u=>u.id===uid); if (!user) return;
  document.getElementById('profile-name').value = user.name; document.getElementById('profile-age').value = user.age; document.getElementById('profile-grade').value = user.grade;
  document.getElementById('btnSaveProfile').onclick = async ()=>{ const name = document.getElementById('profile-name').value.trim(); const age = document.getElementById('profile-age').value.trim(); const grade = document.getElementById('profile-grade').value.trim(); const newPwd = document.getElementById('profile-password').value || ''; if (!name || !age || !grade) return alert('املأ الحقول'); const users = loadUsers(); const idx = users.findIndex(u=>u.id===uid); if (idx===-1) return alert('المستخدم غير موجود'); users[idx].name = name; users[idx].age = age; users[idx].grade = grade; if (newPwd) { users[idx].passwordHash = await hashPassword(newPwd); } saveUsers(users); alert('تم حفظ البيانات'); hideModal(document.getElementById('modal-profile')); };
  document.getElementById('btnCancelProfile').onclick = ()=> hideModal(document.getElementById('modal-profile'));
}

function switchUserConfirm(id){ const pwd = prompt('أدخل كلمة مرور الحساب للتبديل'); if (!pwd) return; hashPassword(pwd).then(hash=>{ const users = loadUsers(); const u = users.find(x=>x.id===id); if (!u) return alert('المستخدم غير موجود'); if (u.passwordHash === hash) { setSessionUser(u.id); alert('تم التبديل للمستخدم '+u.username); location.href = 'index.html'; } else alert('كلمة المرور غير صحيحة'); }); }

document.addEventListener('click', (e)=>{
  if (e.target && e.target.id === 'btnAddNewCard') { showModal(modalAddCard); }
  if (e.target && e.target.id === 'btnRequestPrize') { requestPrize(); }
});

