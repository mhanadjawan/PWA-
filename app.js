// app.js من  نسخة مُصحّحة 
// ========== الدوال الأساسية والمساعدة ==========
function escapeHtml(s) { 
    if (!s) return ''; 
    return String(s).replace(/&/g,'&amp;')
                   .replace(/</g,'&lt;')
                   .replace(/>/g,'&gt;')
                   .replace(/"/g,'&quot;')
                   .replace(/'/g,'&#039;'); 
}

async function hashPassword(password) { 
    const enc = new TextEncoder(); 
    const data = await crypto.subtle.digest('SHA-256', enc.encode(password)); 
    return Array.from(new Uint8Array(data)).map(b=>b.toString(16).padStart(2,'0')).join(''); 
}

// ========== دوال التخزين ==========
function loadUsers(){ 
    try{ 
        return JSON.parse(localStorage.getItem('fc_users')||'[]'); 
    }catch(e){ 
        return []; 
    } 
}

function saveUsers(u){ 
    localStorage.setItem('fc_users', JSON.stringify(u)); 
}

function loadCards(){ 
    try{ 
        return JSON.parse(localStorage.getItem('fc_cards')||'[]'); 
    }catch(e){ 
        return []; 
    } 
}

function saveCards(c){ 
    localStorage.setItem('fc_cards', JSON.stringify(c)); 
}

function loadClaims(){ 
    try{ 
        return JSON.parse(localStorage.getItem('fc_claims')||'[]'); 
    }catch(e){ 
        return []; 
    } 
}

function saveClaims(c){ 
    localStorage.setItem('fc_claims', JSON.stringify(c)); 
}

function setSessionUser(id){ 
    localStorage.setItem('fc_session_user', id); 
}

function getSessionUserId(){ 
    return localStorage.getItem('fc_session_user') || null; 
}

function clearSession(){ 
    localStorage.removeItem('fc_session_user'); 
}

// ========== المتغيرات العامة ==========
const CATEGORIES = ['عام','رياضيات','علوم','العلوم الدينية (إسلامية)','الفيزياء','الكيمياء','HTML','CSS','JavaScript','PHP','Python','Java','C#','C++','SQL','Ruby','Go','Swift','TypeScript','Kotlin','لغات البرمجة عامة','لغات تصميم الويب عام',' لغات انسانية طبيعية'];

let deferredPrompt = null;

// ========== دالة تحليل CSV محسنة ==========
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const current = [];
        let inQuotes = false;
        let currentField = '';
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = line[j + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentField += '"';
                    j++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                current.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        
        current.push(currentField);
        result.push(current);
    }
    
    return result;
}

// ========== دالة التصدير العامة (حماية من صفوف فارغة) ==========
function exportToCSV(rows, headers) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return '';
    }
    const cols = headers || Object.keys(rows[0] || {});
    const lines = [cols.join(',')];
    rows.forEach(r => {
        const row = cols.map(c => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(',');
        lines.push(row);
    });
    return lines.join('\n');
}

// ========== دالة تصدير حسب التصنيف ==========
window.exportCategoryCSV = function(category) {
    const sessionId = getSessionUserId();
    if (!sessionId) return alert('سجل الدخول أولاً');
    const cards = loadCards().filter(c => c.userId === sessionId && c.category === category);
    if (cards.length === 0) return alert('لا توجد بطاقات للتصدير في هذا التصنيف');
    
    const rows = cards.map(c => ({
        id: c.id,
        question: c.question,
        category: c.category,
        choice1: c.choices[0]?.text || '',
        choice2: c.choices[1]?.text || '',
        choice3: c.choices[2]?.text || ''
    }));
    
    const csv = exportToCSV(rows, ['id','question','category','choice1','choice2','choice3']);
    if (!csv) return alert('خطأ في إنشاء ملف التصدير');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flashcards_${category.replace(/\s+/g,'_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
};

// ========== دالة تصدير كل البطاقات للمستخدم ==========
window.exportAllCardsCSV = function() {
    const sessionId = getSessionUserId();
    if (!sessionId) return alert('سجل الدخول أولاً');
    const cards = loadCards().filter(c => c.userId === sessionId);
    if (cards.length === 0) return alert('لا توجد بطاقات للتصدير');
    
    const rows = cards.map(c => ({
        id: c.id,
        question: c.question,
        category: c.category,
        choice1: c.choices[0]?.text || '',
        choice2: c.choices[1]?.text || '',
        choice3: c.choices[2]?.text || '',
        createdAt: c.createdAt || ''
    }));
    
    const csv = exportToCSV(rows, ['id','question','category','choice1','choice2','choice3','createdAt']);
    if (!csv) return alert('خطأ في إنشاء ملف التصدير');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flashcards_all_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
};

// ========== دوال حذف إضافية (حذف بالتصنيف وحذف الكل) ==========
function deleteAllInCategory(category) {
    if (!confirm(`هل أنت متأكد من حذف كل البطاقات في التصنيف "${category}"؟ لا يمكن التراجع عن هذا.`)) return;
    const sessionId = getSessionUserId();
    if (!sessionId) return alert('سجل الدخول أولاً');
    const cards = loadCards().filter(c => !(c.userId === sessionId && c.category === category));
    saveCards(cards);
    renderAppForUser(sessionId);
    alert(`تم حذف كل بطاقات التصنيف "${category}"`);
}

function deleteAllCards() {
    if (!confirm('هل أنت متأكد من حذف كل البطاقات الخاصة بك؟ هذا الإجراء نهائي.')) return;
    const sessionId = getSessionUserId();
    if (!sessionId) return alert('سجل الدخول أولاً');
    const cards = loadCards().filter(c => c.userId !== sessionId);
    saveCards(cards);
    renderAppForUser(sessionId);
    alert('تم حذف كل البطاقات الخاصة بك');
}

// ========== التهيئة الرئيسية (مع حماية) ==========
document.addEventListener('DOMContentLoaded', init);

function init(){
    console.log('بدء تهيئة التطبيق...');
    
    // التحقق من الصفحة الحالية
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;
    
    console.log('المسار الحالي:', currentPath);
    console.log('الرابط الحالي:', currentUrl);
    
    const isSettingsPage = currentPath.includes('settings.html') || 
                          currentUrl.includes('settings.html') ||
                          (document.querySelector('section.card h3') && 
                           document.querySelector('section.card h3').textContent === 'تصدير / استيراد');

    if (isSettingsPage) {
        console.log('تم التعرف على صفحة الإعدادات');
        initializeSettingsPage();
        return;
    }

    console.log('تهيئة الصفحة الرئيسية');
    initializeMainPage();
}




// ========== تهيئة الصفحة الرئيسية ==========
function initializeMainPage() {
    console.log('بدء تهيئة الصفحة الرئيسية...');
    
    const btnSettings = document.getElementById('btnSettings');
    const btnInstall = document.getElementById('btnInstall');
    const btnLogout = document.getElementById('btnLogout');

    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            const sessionId = getSessionUserId();
            if (sessionId) {
                window.location.href = 'settings.html';
            } else {
                alert('يجب تسجيل الدخول أولاً للوصول إلى الإعدادات');
                showLoginModal();
            }
        });
    }
    
    if (btnLogout) {
        btnLogout.addEventListener('click', () => { 
            logout(); 
            showLoginModal(); 
        });
    }
    
    
    
    

    // قبل محاولة تسجيل Service Worker، تحقق من البروتوكول

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
    if (catSelect) {
        catSelect.innerHTML = CATEGORIES.map(c => 
            `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
        ).join('');
    }

    setupLoginModal(); 
    setupAddCardModal();
    
    const sessionId = getSessionUserId();
    if (sessionId) {
        renderAppForUser(sessionId);
    } else {
        showLoginModal();
    }
}

// ========== دوال الإعدادات ==========
function initializeSettingsPage() {
    console.log('بدء تهيئة صفحة الإعدادات...');
    
    const sessionId = getSessionUserId();
    if (!sessionId) {
        alert('يجب تسجيل الدخول أولاً للوصول إلى الإعدادات');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1200);
        return;
    }

    const info = document.getElementById('settings-user-info'); 
    const users = loadUsers();
    
    if (info) {
        info.innerHTML = users.map(u => `
            <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
                ${escapeHtml(u.username)} - ${escapeHtml(u.name)} - نقاط: ${u.points || 0} 
                <button class="btn small edit-u" data-id="${u.id}" style="margin-right: 5px;">تعديل</button> 
                <button class="btn small switch-user" data-id="${u.id}" style="margin-right: 5px;">تبديل</button>
            </div>
        `).join('') || '<div class="muted">لا يوجد مستخدم</div>';
    }
//////////adit
    document.querySelectorAll('.edit-u').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || btn.dataset.id;
            populateProfileForm(id);
            showModal(document.getElementById('modal-profile'));
        });
    });

    document.querySelectorAll('.switch-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || btn.dataset.id;
            switchUserConfirm(id);
        });
    });

    // export-by-cat (إن وجد)
    const exportByCatDiv = document.getElementById('export-by-cat'); 
    if (exportByCatDiv) {
        exportByCatDiv.innerHTML = CATEGORIES.map(c => `
            <button class="btn small export-cat-btn" data-category="${escapeHtml(c)}" style="margin: 3px;">
                ${escapeHtml(c)}
            </button>
        `).join(' ');
        document.querySelectorAll('.export-cat-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const category = this.getAttribute('data-category');
                exportCategoryCSV(category);
            });
        });
    }
}



const themeSelect = document.getElementById('theme-select'); 
    if (themeSelect) {
        const savedTheme = localStorage.getItem('fc_theme') || 'light'; 
        themeSelect.value = savedTheme;
        
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme','dark');
        }
        
        themeSelect.addEventListener('change', (e) => { 
            localStorage.setItem('fc_theme', e.target.value); 
            if (e.target.value === 'dark') {
                document.documentElement.setAttribute('data-theme','dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        });
    }



    const btnRequestNotification = document.getElementById('btnRequestNotification');
    if (btnRequestNotification) {
        btnRequestNotification.addEventListener('click', async () => { 
            if (!('Notification' in window)) {
                return alert('المتصفح لا يدعم الإشعارات'); 
            }
            const p = await Notification.requestPermission(); 
            if (p === 'granted') { 
                new Notification('تم تفعيل الإشعارات', {body: 'ستصل لك تذكيرات'}); 
            } else {
                alert('لم تُمنح الأذونات');
            }
        });
    }
    


const btnExportClaims = document.getElementById('btnExportClaims');
    if (btnExportClaims) {
        btnExportClaims.addEventListener('click', () => { 
            const claims = loadClaims(); 
            if (claims.length === 0) return alert('لا توجد طلبات'); 
            const csv = exportToCSV(claims.map(c => ({
                id: c.id,
                userName: c.name,
                points: c.points,
                status: c.status,
                createdAt: c.createdAt
            })), ['id','userName','points','status','createdAt']); 
            const a = document.createElement('a'); 
            a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); 
            a.download = 'claims.csv'; 
            a.click(); 
        });
    }
    
   
    

// ========== دوال واجهة المستخدم ==========
function setupLoginModal() {
    const select = document.getElementById('login-user-select');
    const btnDoLogin = document.getElementById('btnDoLogin');
    const btnOpenCreate = document.getElementById('btnOpenCreate');
    const btnCreateUser = document.getElementById('btnCreateUser');
    const btnCloseLogin = document.getElementById('btnCloseLogin');

    function refreshUsersSelect() { 
        const users = loadUsers(); 
        if (!select) return;
        select.innerHTML = users.map(u => 
            `<option value="${u.id}">${escapeHtml(u.username)} (${escapeHtml(u.name)})</option>`
        ).join(''); 
        if (users.length === 0) select.innerHTML = '<option value="">لا يوجد مستخدم</option>'; 
    }
    
    refreshUsersSelect();

    if (btnDoLogin) {
        btnDoLogin.addEventListener('click', async () => {
            const uid = select ? select.value : null; 
            const pwd = document.getElementById('login-password').value || '';
            if (!uid) return alert('اختر حسابًا أو أنشئ حسابًا جديدًا');
            const users = loadUsers(); 
            const user = users.find(x => x.id === uid); 
            if (!user) return alert('المستخدم غير موجود');
            const hash = await hashPassword(pwd);
            if (hash === user.passwordHash) { 
                setSessionUser(user.id); 
                hideModal(document.getElementById('modal-login')); 
                renderAppForUser(user.id); 
            } else {
                alert('كلمة المرور خاطئة');
            }
        });
    }

    if (btnOpenCreate) {
        btnOpenCreate.addEventListener('click', () => {
            const el = document.getElementById('create-username');
            if (el) el.focus();
        });
    }
    
    if (btnCreateUser) {
        btnCreateUser.addEventListener('click', async () => {
            const username = document.getElementById('create-username').value.trim();
            const name = document.getElementById('create-name').value.trim();
            const age = document.getElementById('create-age').value.trim();
            const grade = document.getElementById('create-grade').value.trim();
            const password = document.getElementById('create-password').value || '';
            
            if (!username || !name || !age || !grade || !password) {
                return alert('املأ كل الحقول لإنشاء المستخدم');
            }
            
            const users = loadUsers(); 
            if (users.find(u => u.username === username)) {
                return alert('اسم الحساب مستخدم');
            }
            
            const hash = await hashPassword(password);
            const newUser = { 
                id: 'u' + Date.now().toString(36), 
                username, 
                name, 
                age, 
                grade, 
                passwordHash: hash, 
                points: 0, 
                correct: 0, 
                wrong: 0, 
                createdAt: new Date().toISOString() 
            };
            
            users.push(newUser); 
            saveUsers(users); 
            alert('تم إنشاء المستخدم بنجاح'); 
            refreshUsersSelect(); 
            if (select) select.value = newUser.id;
        });
    }
    
    if (btnCloseLogin) {
        btnCloseLogin.addEventListener('click', () => hideModal(document.getElementById('modal-login')));
    }
}




    const fileImport = document.getElementById('fileImport'); 
    if (fileImport) {
        fileImport.addEventListener('change', async (ev) => { 
            const file = ev.target.files[0]; 
            if (!file) return; 
            
            try {
                console.log('بدء استيراد الملف...');
                const text = await file.text();
                
                const rows = parseCSV(text);
                console.log('تم تحليل CSV، عدد الصفوف:', rows.length);
                
                if (rows.length === 0) {
                    alert('الملف فارغ أو غير صالح');
                    return;
                }

                const sessionId = getSessionUserId();
                if (!sessionId) {
                    alert('يجب تسجيل الدخول أولاً');
                    return;
                }

                const cards = loadCards();
                let importedCount = 0;
                let skippedCount = 0;

                // تخطي الصف الأول (العناوين)
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (row.length < 3) continue;
                    
                    const [id, question, category, choice1, choice2, choice3] = row;
                    
                    // تنظيف البيانات
                    const cleanQuestion = question ? question.replace(/^"|"$/g, '').trim() : '';
                    const cleanCategory = category ? category.replace(/^"|"$/g, '').trim() : 'عام';
                    const cleanChoice1 = choice1 ? choice1.replace(/^"|"$/g, '').trim() : '';
                    const cleanChoice2 = choice2 ? choice2.replace(/^"|"$/g, '').trim() : '';
                    const cleanChoice3 = choice3 ? choice3.replace(/^"|"$/g, '').trim() : '';
                    
                    if (!cleanQuestion || !cleanChoice1) {
                        skippedCount++;
                        continue;
                    }
                    
                    const newCard = {
                        id: id && id.trim() !== '' ? id.replace(/^"|"$/g, '') : ('c' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)),
                        userId: sessionId,
                        question: cleanQuestion,
                        category: cleanCategory,
                        choices: [
                            {text: cleanChoice1, correct: true},
                            {text: cleanChoice2, correct: false},
                            {text: cleanChoice3, correct: false}
                        ],
                        createdAt: new Date().toISOString(),
                        errorCount: 0
                    };
                    
                    // التحقق من التكرار
                    const existingCard = cards.find(c => 
                        c.question === newCard.question && 
                        c.category === newCard.category && 
                        c.userId === sessionId
                    );
                    
                    if (!existingCard) {
                        cards.push(newCard);
                        importedCount++;
                    } else {
                        skippedCount++;
                    }
                }
                
                saveCards(cards);
                
                let message = `تم استيراد ${importedCount} بطاقة بنجاح`;
                if (skippedCount > 0) {
                    message += ` (تم تخطي ${skippedCount} بطاقة مكررة أو غير صالحة)`;
                }
                alert(message);
                
                ev.target.value = '';
                
            } catch (error) {
                console.error('خطأ في الاستيراد:', error);
                alert('حدث خطأ أثناء استيراد الملف. تأكد من صحة تنسيق الملف.');
            }
        });
    }
    
// ======= SHOW LOGIN MODAL (دالة مفقودة تمت إضافتها) =======
function showLoginModal(prefillId) {
    // تعرض مودال التسجيل/تبديل المستخدم وتملأ القائمة إذا وُجدت
    const users = loadUsers();
    const select = document.getElementById('login-user-select');
    if (select) {
        select.innerHTML = users.map(u => `<option value="${u.id}">${escapeHtml(u.username)} (${escapeHtml(u.name)})</option>`).join('');
        if (users.length === 0) select.innerHTML = '<option value="">لا يوجد مستخدم</option>';
        if (prefillId) select.value = prefillId;
    }
    showModal(document.getElementById('modal-login'));
}

// ========== الباقي (إعادة العرض، الاختبارات، الحذف...) ==========
function setupAddCardModal() {
    const btnSaveCard = document.getElementById('btnSaveCard');
    const btnCancelCard = document.getElementById('btnCancelCard');
    
    if (btnCancelCard) {
        btnCancelCard.addEventListener('click', () => hideModal(document.getElementById('modal-addcard')));
    }
    
    if (btnSaveCard) {
        btnSaveCard.addEventListener('click', async () => {
            const question = document.getElementById('card-question').value.trim();
            const choice1 = document.getElementById('choice-1').value.trim();
            const choice2 = document.getElementById('choice-2').value.trim();
            const choice3 = document.getElementById('choice-3').value.trim();
            const correctIndex = Number(document.getElementById('card-correct').value) - 1;
            const category = document.getElementById('card-category').value || 'عام';
            
            if (!question || !choice1 || !choice2 || !choice3) {
                return alert('أدخل السؤال والثلاث إجابات');
            }
            
            const sessionId = getSessionUserId(); 
            if (!sessionId) return alert('سجل الدخول أولاً');
            
            const cards = loadCards();
            const card = { 
                id: 'c' + Date.now().toString(36), 
                userId: sessionId, 
                question: question, 
                choices: [
                    {text: choice1, correct: correctIndex === 0},
                    {text: choice2, correct: correctIndex === 1},
                    {text: choice3, correct: correctIndex === 2}
                ], 
                category: category, 
                errorCount: 0, 
                createdAt: new Date().toISOString() 
            };
            
            cards.push(card); 
            saveCards(cards); 
            hideModal(document.getElementById('modal-addcard')); 
            renderAppForUser(sessionId);
        });
    }
}

function showModal(el) { 
    if (!el) return; 
    el.classList.remove('hidden'); 
}

function hideModal(el) { 
    if (!el) return; 
    el.classList.add('hidden'); 
}

function renderAppForUser(userId) {
    try {
        const users = loadUsers(); 
        const user = users.find(u => u.id === userId);
        if (!user) { 
            showLoginModal(); 
            return; 
        }
        
        
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.classList.remove('hidden');
    
        const main = document.getElementById('main');
        if (!main) {
            console.warn('عنصر main غير موجود في DOM — إيقاف rendering لتجنب الأخطاء');
            alert('عذرًا، عنصر الصفحة الرئيسة غير موجود. تحقق من HTML.');
            return;
        }
        
        main.innerHTML = `
            <div class="card">
                <h2>مرحبًا ${escapeHtml(user.name)}</h2>
                <div>اسم الحساب: ${escapeHtml(user.username)}</div>
                <div>العمر: ${escapeHtml(user.age)} - ${escapeHtml(user.grade)}</div>
                <div>النقاط: <span id="user-points">${user.points}</span></div>
                <div style="margin-top:8px">
                    <button id="btnAddNewCard" class="btn">➕ إضافة بطاقة</button> 
                    <button id="btnRequestPrize" class="btn">طلب الجائزة</button>
                    <button id="btnExportAll" class="btn" style="margin-left:6px">⬇️ تصدير كل البطاقات</button>
                    <button id="btnDeleteAll" class="btn" style="background:#e74c3c;margin-left:6px">🗑️ حذف كل البطاقات</button>
                </div>
            </div>
            <div class="card">
                <h3>التصنيفات</h3>
                <div id="categories-list" class="grid"></div>
            </div>
         
        `;
        
        setTimeout(() => {
            const btnAddNewCard = document.getElementById('btnAddNewCard');
            const btnRequestPrize = document.getElementById('btnRequestPrize');
            const btnExportAll = document.getElementById('btnExportAll');
            const btnDeleteAll = document.getElementById('btnDeleteAll');
            
            if (btnAddNewCard) btnAddNewCard.addEventListener('click', () => showModal(document.getElementById('modal-addcard')));
            if (btnRequestPrize) btnRequestPrize.addEventListener('click', () => requestPrize());
            if (btnExportAll) btnExportAll.addEventListener('click', () => exportAllCardsCSV());
            if (btnDeleteAll) btnDeleteAll.addEventListener('click', () => deleteAllCards());
        }, 100);
    } catch (err) {
        console.error('خطأ في renderAppForUser:', err);
        alert('حدث خطأ أثناء عرض التطبيق. افتح الكونسول للمزيد.');
    }
    
    renderCategories(userId); 
    renderCardsList(userId);
    renderCategorySnippets(userId);
}

function renderCategories(userId) {
    const div = document.getElementById('categories-list'); 
    if (!div) return;
    
    div.innerHTML = CATEGORIES.map(c => `
        <div class="card">
            <strong>${escapeHtml(c)}</strong>
            <div style="margin-top:8px">
                <button class="btn small view-cat" data-cat="${escapeHtml(c)}">عرض</button>
                <button class="btn small export-cat" data-cat="${escapeHtml(c)}">تصدير</button>
                <button class="btn small del-cat" data-cat="${escapeHtml(c)}" style="background:#e74c3c;margin-left:6px">حذف كل بطاقات التصنيف</button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.view-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.cat) || btn.dataset.cat;
            showCardsByCategory(cat);
        });
    });
    
    document.querySelectorAll('.export-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.cat) || btn.dataset.cat;
            exportCategoryCSV(cat);
        });
    });

    document.querySelectorAll('.del-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cat = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.cat) || btn.dataset.cat;
            deleteAllInCategory(cat);
        });
    });
}


function renderCategorySnippets(userId) {
    try {
        const div = document.getElementById('category-snippets');
        if (!div) return;
        const cards = loadCards().filter(c => c.userId === userId);
        
        const usedCategories = Array.from(new Set(cards.map(c => c.category))).filter(Boolean);
        const MAX_CATS = 10;
        const categoriesToShow = usedCategories.slice(0, MAX_CATS);
        
        if (categoriesToShow.length === 0) {
            div.innerHTML = `<div class="muted">لا توجد بطاقات لعرض مقتطفات التصنيفات</div>`;
            return;
        }
        
        div.innerHTML = categoriesToShow.map(cat => {
            const catCards = cards.filter(c => c.category === cat).slice(0,5);
            const listHtml = catCards.map(c => `<div style="margin-top:6px">• ${escapeHtml(c.question)} <button class="btn tiny play-snippet" data-id="${c.id}" style="margin-left:6px">اختبار</button></div>`).join('');
            return `
                <div class="card">
                    <strong>${escapeHtml(cat)}</strong>
                    <div style="margin-top:8px">${listHtml}</div>
                    <div style="margin-top:8px">
                        <button class="btn small view-cat" data-cat="${escapeHtml(cat)}">عرض كامل التصنيف</button>
                        <button class="btn small export-cat" data-cat="${escapeHtml(cat)}">تصدير</button>
                    </div>
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.play-snippet').forEach(btn => {
            btn.addEventListener('click', (e) => playCard((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || btn.dataset.id));
        });
        document.querySelectorAll('#category-snippets .view-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cat = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.cat) || btn.dataset.cat;
                showCardsByCategory(cat);
            });
        });
        document.querySelectorAll('#category-snippets .export-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cat = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.cat) || btn.dataset.cat;
                exportCategoryCSV(cat);
            });
        });
    } catch (err) {
        console.error('خطأ في renderCategorySnippets:', err);
        const div = document.getElementById('category-snippets');
        if (div) div.innerHTML = `<div class="muted">تعذر تحميل مقتطفات التصنيفات.</div>`;
    }
}

function showCardsByCategory(category) {
    const sessionId = getSessionUserId(); 
    if (!sessionId) return alert('سجل الدخول');
    
    const cards = loadCards().filter(c => c.userId === sessionId && c.category === category);
    if (cards.length === 0) return alert('لا توجد بطاقات في هذا التصنيف');
    
    const content = cards.map(c => `
        <div class="card">
            <div><b>س:</b> ${escapeHtml(c.question)}</div>
            <div style="margin-top:8px">
                <button class="btn small play-card" data-id="${c.id}">اختبار</button>
                <button class="btn small delete-card" data-id="${c.id}" style="background:#e74c3c;margin-left:6px">حذف</button>
            </div>
        </div>
    `).join('');
    
    const main = document.getElementById('main');
    if (main) {
        main.innerHTML = `
            <div class="card">
                <h3>بطاقات: ${escapeHtml(category)}</h3>
                ${content}
                <div style="margin-top:8px">
                    <button class="btn small export-cat" data-cat="${escapeHtml(category)}">تصدير تصنيف</button>
                    <button class="btn small del-cat" data-cat="${escapeHtml(category)}" style="background:#e74c3c;margin-left:6px">حذف كل بطاقات التصنيف</button>
                    <button class="btn back-to-main" style="margin-left:6px">رجوع</button>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.play-card').forEach(btn => {
            btn.addEventListener('click', (e) => playCard((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || btn.dataset.id));
        });
        document.querySelectorAll('.delete-card').forEach(btn => {
            btn.addEventListener('click', (e) => deleteCard((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || btn.dataset.id));
        });
        document.querySelectorAll('.export-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cat = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.cat) || btn.dataset.cat;
                exportCategoryCSV(cat);
            });
        });
        document.querySelectorAll('.del-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cat = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.cat) || btn.dataset.cat;
                deleteAllInCategory(cat);
            });
        });
        
        const backButton = document.querySelector('.back-to-main');
        if (backButton) {
            backButton.addEventListener('click', () => renderAppForUser(sessionId));
        }
    }
}

function playCard(cardId) {
    const cards = loadCards(); 
    const card = cards.find(c => c.id === cardId);
    if (!card) return alert('البطاقة غير موجودة');
    
    const choices = card.choices.map((ch, idx) => ({...ch, idx})).sort(() => Math.random() - 0.5);
    
    const quizQuestion = document.getElementById('quiz-question');
    const quizChoices = document.getElementById('quiz-choices');
    
    if (quizQuestion) quizQuestion.innerText = card.question;
    if (quizChoices) {
        quizChoices.innerHTML = choices.map(ch => 
            `<button class="btn small choice-btn" data-idx="${ch.idx}">${escapeHtml(ch.text)}</button>`
        ).join('');
        
        quizChoices.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chosenIdx = Number(e.target.dataset.idx); 
                const picked = card.choices[chosenIdx];
                const sessionId = getSessionUserId(); 
                if (!sessionId) return alert('سجل الدخول');
                
                const users = loadUsers(); 
                const user = users.find(u => u.id === sessionId);
                let stats = {
                    correct: user.correct || 0, 
                    wrong: user.wrong || 0, 
                    points: user.points || 0, 
                    penalty: user.penalty || 0
                };
                
                if (picked && picked.correct) { 
                    alert('✅ إجابة صحيحة'); 
                    stats.correct = (stats.correct || 0) + 1; 
                    stats.points = (stats.points || 0) + 10; 
                } else { 
                    alert('❌ إجابة خاطئة'); 
                    stats.wrong = (stats.wrong || 0) + 1; 
                    stats.penalty = (stats.penalty || 0) + 5; 
                    stats.points = (stats.points || 0) - 5; 
                    card.errorCount = (card.errorCount || 0) + 1; 
                    saveCards(cards); 
                }
                
                const userIndex = users.findIndex(u => u.id === user.id); 
                users[userIndex] = {
                    ...user, 
                    correct: stats.correct, 
                    wrong: stats.wrong, 
                    points: stats.points, 
                    penalty: stats.penalty
                }; 
                saveUsers(users);
                
                const pointsElement = document.getElementById('user-points'); 
                if (pointsElement) pointsElement.innerText = stats.points; 
                
                hideModal(document.getElementById('modal-quiz'));
            });
        });
    }
    
    showModal(document.getElementById('modal-quiz'));
}

function deleteCard(cardId) { 
    if (!confirm('حذف هذه البطاقة؟')) return; 
    const cards = loadCards().filter(c => c.id !== cardId); 
    saveCards(cards); 
    const sessionId = getSessionUserId(); 
    renderAppForUser(sessionId); 
}
//jawan
function requestPrize() { 
    const sessionId = getSessionUserId(); 
    if (!sessionId) return alert('سجل الدخول'); 
    const users = loadUsers(); 
    const user = users.find(u => u.id === sessionId); 
    if (!user) return alert('المستخدم غير موجود'); 
    if ((user.points || 0) < 1000) return alert('لم تصل للنقاط المطلوبة بعد'); 
    const claims = loadClaims(); 
    const claim = { 
        id: 'cl' + Date.now().toString(36), 
        userId: user.id, 
        name: user.name, 
        points: user.points, 
        status: 'pending', 
        createdAt: new Date().toISOString() 
    }; 
    claims.push(claim); 
    saveClaims(claims); 
    alert('تم تقديم طلب الجائزة. سنراجعها.'); 
}



function logout() { 
    clearSession(); 
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.classList.add('hidden'); 
    const main = document.getElementById('main');
    if (main) main.innerHTML = ''; 
    showLoginModal(); 
}



function showLoginModal(prefillId) { 
    const users = loadUsers(); 
    const select = document.getElementById('login-user-select'); 
    if (select) {
        select.innerHTML = users.map(u => 
            `<option value="${u.id}">${escapeHtml(u.username)} (${escapeHtml(u.name)})</option>`
        ).join(''); 
        if (prefillId && select) select.value = prefillId; 
    }
    showModal(document.getElementById('modal-login')); 
}





////////
// ========== دوال إدارة المستخدمين ==========
function populateProfileForm(userId) {
    const users = loadUsers(); 
    const uid = userId || getSessionUserId(); 
    const user = users.find(u => u.id === uid); 
    if (!user) return;
    
    const profileName = document.getElementById('profile-name');
    const profileAge = document.getElementById('profile-age');
    const profileGrade = document.getElementById('profile-grade');
    const profilePassword = document.getElementById('profile-password');
    
    if (profileName) profileName.value = user.name || '';
    if (profileAge) profileAge.value = user.age || '';
    if (profileGrade) profileGrade.value = user.grade || '';
    if (profilePassword) profilePassword.value = '';
    
    const btnSaveProfile = document.getElementById('btnSaveProfile');
    const btnCancelProfile = document.getElementById('btnCancelProfile');
    
    if (btnSaveProfile) {
        btnSaveProfile.onclick = async () => {
            const name = document.getElementById('profile-name').value.trim();
            const age = document.getElementById('profile-age').value.trim();
            const grade = document.getElementById('profile-grade').value.trim();
            const newPwd = document.getElementById('profile-password').value || '';
            
            if (!name || !age || !grade) {
                return alert('املأ الحقول');
            }
            
            const users = loadUsers(); 
            const userIndex = users.findIndex(u => u.id === uid); 
            if (userIndex === -1) return alert('المستخدم غير موجود');
            
            users[userIndex].name = name;
            users[userIndex].age = age;
            users[userIndex].grade = grade;
            
            if (newPwd) {
                users[userIndex].passwordHash = await hashPassword(newPwd);
            }
            
            saveUsers(users); 
            alert('تم حفظ البيانات'); 
            hideModal(document.getElementById('modal-profile'));
            
            if (window.location.pathname.includes('settings.html')) {
                initializeSettingsPage();
            }
        };
    }
    
    if (btnCancelProfile) {
        btnCancelProfile.onclick = () => hideModal(document.getElementById('modal-profile'));
    }
}

function switchUserConfirm(userId) {
    const password = prompt('أدخل كلمة مرور الحساب للتبديل');
    if (!password) return;
    
    hashPassword(password).then(hash => {
        const users = loadUsers(); 
        const user = users.find(x => x.id === userId);
        if (!user) return alert('المستخدم غير موجود');
        
        if (user.passwordHash === hash) {
            setSessionUser(user.id);
            alert('تم التبديل للمستخدم ' + user.username);
            if (window.location.pathname.includes('settings.html')) {
                initializeSettingsPage();
            } else {
                location.href = 'index.html';
            }
        } else {
            alert('كلمة المرور غير صحيحة');
        }
    });
}

// ========== أحداث عامة ==========
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btnAddNewCard') {
        showModal(document.getElementById('modal-addcard'));
    }
    if (e.target && e.target.id === 'btnRequestPrize') {
        requestPrize();
    }
});

// ========== تهيئة PWA ==========
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('beforeinstallprompt event fired');
    e.preventDefault();
    deferredPrompt = e;
    const btnInstall = document.getElementById('btnInstall');
    if (btnInstall) btnInstall.classList.remove('hidden');
});

if (document.getElementById('btnInstall')) {
    document.getElementById('btnInstall').addEventListener('click', async () => {
        if (!deferredPrompt) {
            alert('التثبيت غير متاح الآن — تأكد أن التطبيق يعمل كـ PWA');
            return;
        }
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        console.log('userChoice', choiceResult);
        deferredPrompt = null;
        document.getElementById('btnInstall').classList.add('hidden');
    });
}

window.addEventListener('appinstalled', (evt) => {
    console.log('PWA was installed.', evt);
});

console.log('تم تحميل تطبيق البطاقات التعليمية بنجاح');



