import { bindAuthUIs, onUserChanged, getUser } from "./auth.js";
import { loadState as fbLoadState, saveState as fbSaveState, defaultState } from "./storage.js";

/* =========================
   State (Firebase)
   ========================= */
let state = structuredClone(defaultState);

// optional: simple local cache per user (faster loads, offline friendly)
function cacheKey(uid){ return `ghadeer_accounts_cache_${uid}`; }
function loadCache(uid){
  try{
    const raw = localStorage.getItem(cacheKey(uid));
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}
function saveCache(uid){
  try{ localStorage.setItem(cacheKey(uid), JSON.stringify(state)); }catch{}
}

let saving = false;
let pendingSave = false;

async function persist(){
  const user = getUser();
  if(!user) return;
  // debounce-like: if a save is running, mark pending
  if (saving){ pendingSave = true; return; }
  saving = true;
  try{
    saveCache(user.uid);
    await fbSaveState(user.uid, state);
  }catch(e){
    console.error(e);
    // don't spam alerts
  }finally{
    saving = false;
    if (pendingSave){
      pendingSave = false;
      persist();
    }
  }
}

/* =========================
   أدوات مساعدة
   ========================= */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const today = () => new Date().toISOString().slice(0,10);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function fmt(n){
  const {locale, currency} = state.settings;
  try{
    return Number(n).toLocaleString(locale || 'ar', { style:'currency', currency: currency || 'IQD' });
  } catch {
    return Number(n).toLocaleString(locale || 'ar') + ' ' + (state.settings.currency || 'IQD');
  }
}
function sum(arr){ return arr.reduce((a,b)=>a+Number(b||0),0); }

/* =========================
   تنقل التبويبات
   ========================= */
function bindTabs(){
  $$('#tabs .tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('#tabs .tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const id = btn.dataset.tab;
      $$('.tab-pane').forEach(p=>p.classList.add('hidden'));
      $('#'+id).classList.remove('hidden');
      if(id==='summary') renderSummary();
      if(id==='expenses') renderExpenses();
      if(id==='transactions') syncClientSelects();
      if(id==='clients') renderClients();
    });
  });
}

/* =========================
   واجهة: العملاء
   ========================= */
function bindClients(){
  $('#addClientBtn').addEventListener('click', ()=>{
    const name = $('#c_name').value.trim();
    const phone = $('#c_phone').value.trim();
    const city = $('#c_city').value.trim();
    if(!name){ alert('أدخل اسم العميل'); return; }

    const key = name; // الاسم مفتاح
    if(!state.clients[key]){
      state.clients[key] = { name, phone, city, ledger:[] };
    }else{
      state.clients[key].phone = phone || state.clients[key].phone;
      state.clients[key].city  = city  || state.clients[key].city;
    }
    persist();
    $('#c_name').value = ''; $('#c_phone').value=''; $('#c_city').value='';
    renderClients(); syncClientSelects();
  });

  $('#exportClientsBtn').addEventListener('click', ()=>{
    const rows = Object.values(state.clients).map(c=>({
      name:c.name, phone:c.phone||'', city:c.city||'',
      operations:c.ledger.length,
      balance: calcClientBalance(c.name)
    }));
    downloadJSON(rows, 'clients_export.json');
  });

  $('#importClientsBtn').addEventListener('click', ()=>{
    pickFile('.csv', (text)=>{
      const lines = text.split(/\r?\n/).filter(Boolean);
      for(const line of lines){
        const [name, phone='', city=''] = line.split(',').map(s=>s?.trim());
        if(!name) continue;
        if(!state.clients[name]) state.clients[name] = { name, phone, city, ledger:[] };
      }
      persist(); renderClients(); syncClientSelects();
    });
  });

  $('#clientSearch').addEventListener('input', renderClients);
  $('#clientSort').addEventListener('change', renderClients);
}

function renderClients(){
  const tbody = $('#clientRows'); tbody.innerHTML = '';
  const q = $('#clientSearch').value.trim().toLowerCase();
  const sort = $('#clientSort').value;
  let list = Object.values(state.clients);
  if(q){
    list = list.filter(c =>
      (c.name||'').toLowerCase().includes(q) ||
      (c.phone||'').toLowerCase().includes(q) ||
      (c.city||'').toLowerCase().includes(q)
    );
  }
  list.forEach(c=> c.balance = calcClientBalance(c.name));
  if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name, 'ar'));
  if(sort==='balanceDesc') list.sort((a,b)=>b.balance-a.balance);
  if(sort==='balanceAsc') list.sort((a,b)=>a.balance-b.balance);
  if(sort==='invoices') list.sort((a,b)=>b.ledger.length - a.ledger.length);

  for(const c of list){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="العميل">${escapeHtml(c.name)}</td>
      <td data-label="الهاتف">${escapeHtml(c.phone||'-')}</td>
      <td data-label="المدينة">${escapeHtml(c.city||'-')}</td>
      <td data-label="العمليات">${c.ledger.length}</td>
      <td data-label="الرصيد">
        <span class="${c.balance>=0?'balance-pos':'balance-neg'}">${fmt(c.balance)}</span>
      </td>
      <td class="right" data-label="خيارات">
        <div class="row-actions">
          <button class="btn" onclick="openStatement('${escapeAttr(c.name)}')">👁️ كشف</button>
          <button class="btn" onclick="quickInvoice('${escapeAttr(c.name)}')">🧾 فاتورة</button>
          <button class="btn" onclick="quickPayment('${escapeAttr(c.name)}')">💸 دفعة</button>
          <button class="btn danger" onclick="deleteClient('${escapeAttr(c.name)}')">🗑️ حذف</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function deleteClient(name){
  if(confirm('حذف العميل وجميع عملياته؟')) {
    delete state.clients[name]; persist(); renderClients(); syncClientSelects();
  }
}

function quickInvoice(name){
  $('#t_client').value = name;
  $$('#tabs .tab').find(b=>b.dataset.tab==='transactions').click();
  $('#t_desc').focus();
}
function quickPayment(name){
  $('#p_client').value = name;
  $$('#tabs .tab').find(b=>b.dataset.tab==='transactions').click();
  $('#p_desc').focus();
}

function calcClientBalance(name){
  const c = state.clients[name]; if(!c) return 0;
  let bal = 0;
  for(const op of c.ledger){
    if(op.type==='invoice') bal += Number(op.amount||0);
    if(op.type==='payment') bal -= Number(op.amount||0);
  }
  return bal;
}

/* =========================
   واجهة: فواتير/دفعات
   ========================= */
function syncClientSelects(){
  const names = Object.keys(state.clients).sort((a,b)=>a.localeCompare(b,'ar'));
  for(const id of ['t_client','p_client']){
    const el = $('#'+id); el.innerHTML = '';
    for(const n of names){
      const o = document.createElement('option'); o.value = n; o.textContent = n;
      el.appendChild(o);
    }
  }
}

function bindTransactions(){
  $('#addInvoiceBtn').addEventListener('click', ()=>{
    const client = $('#t_client').value;
    const desc = $('#t_desc').value.trim();
    const amount = Number($('#t_amount').value);
    const date = $('#t_date').value || today();
    if(!client){ alert('اختر العميل'); return; }
    if(!(amount>0)){ alert('أدخل مبلغًا صحيحًا'); return; }

    state.clients[client].ledger.push({ id:uid(), type:'invoice', desc, amount, date });
    persist();
    $('#t_desc').value=''; $('#t_amount').value=''; $('#t_date').value='';
    renderClients(); renderSummary();
    alert('تمت إضافة الفاتورة.');
  });

  $('#addPaymentBtn').addEventListener('click', ()=>{
    const client = $('#p_client').value;
    const desc = $('#p_desc').value.trim();
    const amount = Number($('#p_amount').value);
    const date = $('#p_date').value || today();
    if(!client){ alert('اختر العميل'); return; }
    if(!(amount>0)){ alert('أدخل مبلغًا صحيحًا'); return; }

    state.clients[client].ledger.push({ id:uid(), type:'payment', desc, amount, date });
    persist();
    $('#p_desc').value=''; $('#p_amount').value=''; $('#p_date').value='';
    renderClients(); renderSummary();
    alert('تم تسجيل الدفعة.');
  });
}

/* =========================
   واجهة: المصروفات
   ========================= */
function bindExpenses(){
  $('#addExpenseBtn').addEventListener('click', ()=>{
    const desc = $('#e_desc').value.trim();
    const amount = Number($('#e_amount').value);
    const date = $('#e_date').value || today();
    if(!(amount>0)){ alert('أدخل مبلغًا صحيحًا'); return; }
    state.expenses.push({ id:uid(), desc, amount, date });
    persist();
    $('#e_desc').value=''; $('#e_amount').value=''; $('#e_date').value='';
    renderExpenses(); renderSummary();
  });

  $('#exportExpensesBtn').addEventListener('click', ()=>{
    downloadJSON(state.expenses, 'expenses_export.json');
  });
}

function renderExpenses(){
  const tbody = $('#expenseRows'); tbody.innerHTML='';
  const rows = [...state.expenses].sort((a,b)=> (a.date||'').localeCompare(b.date||''));
  for(const e of rows){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="التاريخ">${escapeHtml(e.date||'-')}</td>
      <td data-label="الوصف">${escapeHtml(e.desc||'-')}</td>
      <td data-label="المبلغ">${fmt(e.amount||0)}</td>
      <td data-label="خيارات" class="right">
        <div class="row-actions">
          <button class="btn danger" onclick="deleteExpense('${e.id}')">🗑️ حذف</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}
function deleteExpense(id){
  if(!confirm('حذف المصروف؟')) return;
  state.expenses = state.expenses.filter(x=>x.id!==id);
  persist(); renderExpenses(); renderSummary();
}

/* =========================
   واجهة: ملخص الشركة
   ========================= */
function renderSummary(){
  const allClients = Object.values(state.clients);
  const invoicesTotal = sum(allClients.flatMap(c => c.ledger.filter(x=>x.type==='invoice').map(x=>x.amount)));
  const paymentsTotal = sum(allClients.flatMap(c => c.ledger.filter(x=>x.type==='payment').map(x=>x.amount)));
  const expensesTotal = sum(state.expenses.map(e=>e.amount));
  const netProfit = invoicesTotal - expensesTotal;

  $('#s_totalInvoices').textContent = fmt(invoicesTotal);
  $('#s_totalPayments').textContent = fmt(paymentsTotal);
  $('#s_totalExpenses').textContent = fmt(expensesTotal);
  $('#s_netProfit').textContent = fmt(netProfit);

  const tbody = $('#topClientsRows'); tbody.innerHTML='';
  const ranked = allClients
    .map(c=>{
      const inv = sum(c.ledger.filter(x=>x.type==='invoice').map(x=>x.amount));
      const bal = calcClientBalance(c.name);
      return {name:c.name, inv, count:c.ledger.filter(x=>x.type==='invoice').length, bal};
    })
    .sort((a,b)=> b.inv - a.inv)
    .slice(0, 10);
  for(const r of ranked){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="العميل">${escapeHtml(r.name)}</td>
      <td data-label="عدد الفواتير">${r.count}</td>
      <td data-label="إجمالي فواتيره">${fmt(r.inv)}</td>
      <td data-label="الرصيد الحالي">
        <span class="${r.bal>=0?'balance-pos':'balance-neg'}">${fmt(r.bal)}</span>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

/* =========================
   كشف حساب العميل (Drawer)
   ========================= */
let currentStatementName = null;
function bindDrawer(){
  const drawer = $('#drawer');
  $('#d_close').addEventListener('click', ()=> drawer.classList.remove('open'));
  $('#d_search').addEventListener('input', ()=> renderStatement(currentStatementName));
  $('#d_range').addEventListener('change', ()=> renderStatement(currentStatementName));
  $('#d_export').addEventListener('click', ()=>{
    if(!currentStatementName) return;
    const rows = buildStatementRows(currentStatementName, true).map(r=>({
      date:r.date, desc:r.desc, type:r.type, amount:r.amount, balance:r.balance
    }));
    downloadJSON(rows, `statement_${safeFileName(currentStatementName)}.json`);
  });

  drawer.addEventListener('click', (e)=> {
    if(e.target === drawer) drawer.classList.remove('open');
  });
}

function openStatement(name){
  currentStatementName = name;
  $('#d_title').textContent = 'كشف حساب';
  const c = state.clients[name];
  $('#d_subtitle').textContent = `${c.name} — ${c.phone||'-'} — ${c.city||'-'}`;
  $('#d_search').value=''; $('#d_range').value='all';
  renderStatement(name);
  $('#drawer').classList.add('open');
}

function renderStatement(name){
  const tbody = $('#d_rows'); tbody.innerHTML='';
  if(!name) return;
  const rows = buildStatementRows(name);
  let running = 0;
  for(const r of rows){
    running += (r.type==='invoice'? Number(r.amount): -Number(r.amount));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="التاريخ">${escapeHtml(r.date||'-')}</td>
      <td data-label="البيان">${escapeHtml(r.desc||'-')}</td>
      <td data-label="النوع">
        <span class="pill ${r.type==='invoice'?'in':'out'}">
          ${r.type==='invoice'?'فاتورة':'دفعة'}
        </span>
      </td>
      <td data-label="المبلغ">${fmt(r.amount||0)}</td>
      <td data-label="الرصيد بعد العملية">${fmt(running)}</td>
      <td data-label="خيارات" class="right">
        <div class="row-actions">
          <button class="btn" onclick="editOp('${escapeAttr(name)}','${r.id}')">✏️ تعديل</button>
          <button class="btn danger" onclick="deleteOp('${escapeAttr(name)}','${r.id}')">🗑️ حذف</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function buildStatementRows(name, raw=false){
  const q = $('#d_search').value?.trim().toLowerCase() || '';
  const range = $('#d_range').value;
  const sinceDays = range==='all'? null : Number(range);
  const c = state.clients[name];
  const now = new Date();
  let list = [...c.ledger];

  list.sort((a,b)=> (a.date||'').localeCompare(b.date||'') || a.id.localeCompare(b.id));

  if(q) list = list.filter(x=> (x.desc||'').toLowerCase().includes(q));
  if(sinceDays){
    const since = new Date(now.getTime() - sinceDays*24*60*60*1000);
    list = list.filter(x=> (x.date && new Date(x.date) >= since));
  }
  if(raw) return list.map(x=>({...x}));
  return list.map(x=>({id:x.id, date:x.date, desc:x.desc, type:x.type, amount:Number(x.amount)}));
}

function editOp(name, opId){
  const c = state.clients[name];
  const op = c.ledger.find(x=>x.id===opId);
  if(!op) return;
  const newDesc = prompt('وصف العملية:', op.desc||'') ?? op.desc;
  const newAmount = Number(prompt('المبلغ:', op.amount) ?? op.amount);
  const newDate = prompt('التاريخ (YYYY-MM-DD):', op.date||today()) ?? op.date;
  if(!(newAmount>0)){ alert('المبلغ غير صالح'); return; }
  op.desc = newDesc; op.amount = newAmount; op.date = newDate;
  persist(); renderClients(); renderStatement(name); renderSummary();
}
function deleteOp(name, opId){
  if(!confirm('حذف العملية؟')) return;
  const c = state.clients[name];
  c.ledger = c.ledger.filter(x=>x.id!==opId);
  persist(); renderClients(); renderStatement(name); renderSummary();
}

/* =========================
   إعدادات ونسخ احتياطي
   ========================= */
function bindSettings(){
  $('#saveSettingsBtn').addEventListener('click', ()=>{
    state.settings.currency = $('#currencyCode').value.trim() || 'IQD';
    state.settings.locale = $('#localeSelect').value || 'ar-IQ';
    persist(); renderClients(); renderExpenses(); renderSummary();
    alert('تم حفظ الإعدادات');
  });

  $('#exportAllBtn').addEventListener('click', ()=>{
    downloadJSON(state, 'ghadeer_backup.json');
  });

  $('#importAllBtn').addEventListener('click', ()=>{
    pickFile('.json', async (text)=>{
      try{
        const data = JSON.parse(text);
        state = data;
        // normalize a little
        state.clients ??= {};
        state.expenses ??= [];
        state.settings ??= { currency:'IQD', locale:'ar-IQ' };
        await persist();
        hydrateSettingsUI();
        renderClients(); renderExpenses(); renderSummary(); syncClientSelects();
        alert('تم الاستيراد بنجاح');
      }catch(e){ alert('ملف غير صالح'); }
    });
  });

  $('#resetBtn').addEventListener('click', ()=>{
    if(confirm('مسح كل البيانات؟ لا يمكن التراجع.')){
      state = structuredClone(defaultState); persist();
      hydrateSettingsUI();
      renderClients(); renderExpenses(); renderSummary(); syncClientSelects();
    }
  });
}

function hydrateSettingsUI(){
  $('#currencyCode').value = state.settings.currency || 'IQD';
  $('#localeSelect').value = state.settings.locale || 'ar-IQ';
}

/* =========================
   أدوات تنزيل/رفع + أمان بسيط
   ========================= */
function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function pickFile(accept, ontext){
  const fp = $('#filePicker'); fp.value=''; fp.accept = accept;
  fp.onchange = ()=>{
    const f = fp.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=> ontext(r.result);
    r.readAsText(f, 'utf-8');
  };
  fp.click();
}

function escapeHtml(s=''){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s=''){ return s.replace(/['"]/g, m=> (m==='"'?'&quot;':'&#39;')); }
function safeFileName(s=''){ return s.replace(/[^-\w]+/g,'_'); }

/* =========================
   تهيئة
   ========================= */
let bound = false;

function bindOnce(){
  if (bound) return;
  bound = true;

  bindAuthUIs();
  bindTabs();
  bindClients();
  bindTransactions();
  bindExpenses();
  bindDrawer();
  bindSettings();

  // expose globals used by onclick handlers
  window.openStatement = openStatement;
  window.deleteClient = deleteClient;
  window.quickInvoice = quickInvoice;
  window.quickPayment = quickPayment;
  window.deleteExpense = deleteExpense;
  window.editOp = editOp;
  window.deleteOp = deleteOp;
}

function init(){
  bindOnce();
  // تواريخ اليوم
  $('#t_date').value = today();
  $('#p_date').value = today();
  $('#e_date').value = today();

  hydrateSettingsUI();
  syncClientSelects();
  renderClients();
  renderExpenses();
  renderSummary();
}

onUserChanged(async (user)=>{
  if(user){
    // try cache first
    const cached = loadCache(user.uid);
    if (cached) state = cached;
    try{
      state = await fbLoadState(user.uid);
      saveCache(user.uid);
    }catch(e){
      console.warn("Using cached state due to load error", e);
      if(!cached) state = structuredClone(defaultState);
    }
    init();
  }else{
    // Logged out: keep UI but don't show old data
    state = structuredClone(defaultState);
    init();
  }
});

// Start
bindOnce();
