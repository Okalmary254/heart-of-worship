// ============================================================
//  PesaTrack — app.js
// ============================================================

const STORAGE_KEY = 'pesatrack_v1';
let state = {
  transactions: [],
  budgets: [],
  savings: [],
  smsGranted: false
};

// -------- STATE PERSISTENCE --------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch(e) {}
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// -------- MPESA SMS PARSING --------
const MPESA_PATTERNS = [
  // Received money
  { re: /You\s+have\s+received\s+Ksh\s*([\d,]+(?:\.\d+)?)\s+from\s+(.+?)\s+on\s+(\d+\/\d+\/\d+)/i, type: 'income', cat: 'Business', desc: m => `Received from ${m[2].trim()}`, amt: m => parseFloat(m[1].replace(/,/g,'')), date: m => parseMpesaDate(m[3]) },
  // Sent money
  { re: /Confirmed\.\s*Ksh\s*([\d,]+(?:\.\d+)?)\s+sent\s+to\s+(.+?)\s+on\s+(\d+\/\d+\/\d+)/i, type: 'expense', cat: 'Other', desc: m => `Sent to ${m[2].trim()}`, amt: m => parseFloat(m[1].replace(/,/g,'')), date: m => parseMpesaDate(m[3]) },
  // Paybill
  { re: /Ksh\s*([\d,]+(?:\.\d+)?)\s+sent\s+to\s+(.+?)\s+for\s+account\s+(.+?)\s+on\s+(\d+\/\d+\/\d+)/i, type: 'expense', cat: 'Bills', desc: m => `Bill: ${m[2].trim()}`, amt: m => parseFloat(m[1].replace(/,/g,'')), date: m => parseMpesaDate(m[4]) },
  // Buy goods
  { re: /Ksh\s*([\d,]+(?:\.\d+)?)\s+paid\s+to\s+(.+?)\s+on\s+(\d+\/\d+\/\d+)/i, type: 'expense', cat: 'Shopping', desc: m => `Paid to ${m[2].trim()}`, amt: m => parseFloat(m[1].replace(/,/g,'')), date: m => parseMpesaDate(m[3]) },
  // Airtime
  { re: /Ksh\s*([\d,]+(?:\.\d+)?)\s+airtime/i, type: 'expense', cat: 'Bills', desc: () => 'M-Pesa Airtime', amt: m => parseFloat(m[1].replace(/,/g,'')), date: () => today() },
  // Withdrawal
  { re: /Withdraw\s+Ksh\s*([\d,]+(?:\.\d+)?)\s+from\s+/i, type: 'expense', cat: 'Other', desc: () => 'M-Pesa Withdrawal', amt: m => parseFloat(m[1].replace(/,/g,'')), date: () => today() },
];

function parseMpesaDate(str) {
  if (!str) return today();
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, mo, y] = parts;
    return `${y.length===2?'20'+y:y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return today();
}
function today() {
  return new Date().toISOString().split('T')[0];
}

function parseMpesaSMS(body) {
  for (const p of MPESA_PATTERNS) {
    const m = body.match(p.re);
    if (m) {
      return {
        id: Date.now() + Math.random(),
        type: p.type,
        amount: p.amt(m),
        description: p.desc(m),
        category: p.cat,
        date: p.date(m),
        source: 'mpesa'
      };
    }
  }
  return null;
}

// -------- SMS PERMISSION --------
async function requestSmsPermission() {
  // Web SMS API (experimental, Android Chrome)
  if ('SMS' in window || navigator.permissions) {
    try {
      // Try Web OTP / SMS Retriever API awareness
      // Most browsers: request notification permission as proxy indicator
      const perm = await navigator.permissions.query({ name: 'notifications' });
      // Show mock scanning UX; real SMS access needs native wrapper
      showSmsBanner();
      await scanDeviceSms();
    } catch(e) {}
  }
  showMain();
  state.smsGranted = true;
  saveState();
}

function skipPermission() {
  showMain();
}

function showMain() {
  document.getElementById('splash').classList.remove('active');
  document.getElementById('main').classList.add('active');
  renderAll();
}

async function scanDeviceSms() {
  // Native Android SMS access via WebView bridge (injected by TWA/PWA wrapper)
  if (window.Android && window.Android.getSmsMessages) {
    try {
      const messages = JSON.parse(window.Android.getSmsMessages('MPESA'));
      let added = 0;
      for (const msg of messages) {
        const txn = parseMpesaSMS(msg.body);
        if (txn) {
          const dup = state.transactions.find(t => t.description === txn.description && t.amount === txn.amount && t.date === txn.date);
          if (!dup) { state.transactions.push(txn); added++; }
        }
      }
      if (added > 0) { saveState(); renderAll(); showToast(`${added} M-Pesa transaction${added>1?'s':''} imported!`); }
    } catch(e) {}
  } else {
    // Browser fallback: demonstrate with sample M-Pesa messages
    importDemoMpesaData();
  }
  setTimeout(hideSmsBanner, 2000);
}

function importDemoMpesaData() {
  const samples = [
    "You have received Ksh1,500 from JOHN DOE 0712345678 on 10/06/2025 at 09:15 AM",
    "Confirmed. Ksh850 sent to NAIVAS SUPERMARKET on 11/06/2025 at 02:30 PM",
    "Ksh2,200 sent to KENYA POWER for account 1234567 on 12/06/2025 at 10:00 AM",
    "You have received Ksh45,000 from EMPLOYER LTD on 01/06/2025 at 08:00 AM",
    "Ksh600 paid to JAVA HOUSE on 09/06/2025 at 12:15 PM",
    "Confirmed. Ksh300 sent to PETER KAMAU on 08/06/2025 at 07:40 PM",
    "Ksh150 airtime purchased successfully",
    "You have received Ksh3,000 from JANE WANJIRU on 05/06/2025 at 04:00 PM",
    "Ksh1,200 paid to UBER KENYA on 07/06/2025 at 08:55 AM",
    "Confirmed. Ksh500 sent to ZUKU FIBER on 06/06/2025 at 11:20 AM"
  ];
  let added = 0;
  for (const s of samples) {
    const txn = parseMpesaSMS(s);
    if (txn) { state.transactions.push(txn); added++; }
  }
  if (added) { saveState(); showToast(`${added} demo transactions loaded`); }
}

function showSmsBanner() { document.getElementById('smsBanner').style.display = 'flex'; }
function hideSmsBanner() { document.getElementById('smsBanner').style.display = 'none'; }

// -------- ADD TRANSACTION --------
let currentType = 'income';

function setType(t) {
  currentType = t;
  document.getElementById('typeIncome').className = 'toggle-btn' + (t==='income' ? ' active income-active' : '');
  document.getElementById('typeExpense').className = 'toggle-btn' + (t==='expense' ? ' active expense-active' : '');
}

function openAddModal() {
  document.getElementById('txnDate').value = today();
  document.getElementById('addModal').classList.add('open');
}
function openBudgetModal() { document.getElementById('budgetModal').classList.add('open'); }
function openSavingsModal() { document.getElementById('savingsModal').classList.add('open'); }
function openExportModal() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  document.getElementById('exportFrom').value = firstDay;
  document.getElementById('exportTo').value = today();
  document.getElementById('exportModal').classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function saveTransaction() {
  const amt = parseFloat(document.getElementById('txnAmount').value);
  const desc = document.getElementById('txnDesc').value.trim();
  const cat = document.getElementById('txnCat').value;
  const date = document.getElementById('txnDate').value;
  if (!amt || !desc || !cat || !date) { showToast('Please fill in all fields', true); return; }
  state.transactions.push({ id: Date.now(), type: currentType, amount: amt, description: desc, category: cat, date, source: 'manual' });
  saveState();
  renderAll();
  closeModal('addModal');
  clearForm(['txnAmount','txnDesc','txnCat']);
}

function saveBudget() {
  const cat = document.getElementById('budgetCat').value;
  const amt = parseFloat(document.getElementById('budgetAmt').value);
  if (!cat || !amt) { showToast('Fill all budget fields', true); return; }
  const existing = state.budgets.findIndex(b => b.category === cat);
  if (existing > -1) state.budgets[existing].limit = amt;
  else state.budgets.push({ id: Date.now(), category: cat, limit: amt });
  saveState(); renderBudget(); closeModal('budgetModal');
  clearForm(['budgetCat','budgetAmt']);
}

function saveSavingsGoal() {
  const name = document.getElementById('savingsName').value.trim();
  const target = parseFloat(document.getElementById('savingsTarget').value);
  const current = parseFloat(document.getElementById('savingsCurrent').value) || 0;
  if (!name || !target) { showToast('Fill all savings fields', true); return; }
  state.savings.push({ id: Date.now(), name, target, current });
  saveState(); renderSavings(); closeModal('savingsModal');
  clearForm(['savingsName','savingsTarget','savingsCurrent']);
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState(); renderAll();
}

function addToSavings(id, inputId) {
  const val = parseFloat(document.getElementById(inputId).value);
  if (!val || val <= 0) return;
  const g = state.savings.find(s => s.id === id);
  if (g) { g.current = Math.min(g.current + val, g.target); saveState(); renderSavings(); }
}

// -------- COMPUTED VALUES --------
function currentMonthTxns() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  return state.transactions.filter(t => t.date && t.date.startsWith(ym));
}
function fmtKes(n) { return 'KES ' + Math.round(n).toLocaleString('en-KE'); }
function fmtShort(n) { if (n >= 1000) return (n/1000).toFixed(1)+'K'; return Math.round(n).toString(); }

// -------- ANALYTICS --------
let chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function getMonthlyData(months) {
  const result = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    const inc = state.transactions.filter(t => t.type==='income' && t.date?.startsWith(ym)).reduce((s,t)=>s+t.amount,0);
    const exp = state.transactions.filter(t => t.type==='expense' && t.date?.startsWith(ym)).reduce((s,t)=>s+t.amount,0);
    result.push({ label, inc, exp, net: inc - exp });
  }
  return result;
}

function renderAnalytics() {
  const months = parseInt(document.getElementById('analyticsRange')?.value || 6);
  const data = getMonthlyData(months);

  // Stats
  const totalInc = data.reduce((s,d)=>s+d.inc, 0);
  const totalExp = data.reduce((s,d)=>s+d.exp, 0);
  const savingsRate = totalInc > 0 ? ((totalInc - totalExp) / totalInc * 100) : 0;
  document.getElementById('analyticsStats').innerHTML = `
    <div class="astat"><div class="astat-label">Total In</div><div class="astat-value pos">${fmtShort(totalInc)}</div></div>
    <div class="astat"><div class="astat-label">Total Out</div><div class="astat-value neg">${fmtShort(totalExp)}</div></div>
    <div class="astat"><div class="astat-label">Save Rate</div><div class="astat-value neu">${savingsRate.toFixed(0)}%</div></div>`;

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { labels: { color: '#8888a0', font: { family: 'Space Grotesk', size: 11 }, boxWidth: 12, padding: 16 } } },
    scales: {
      x: { ticks: { color: '#555568', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#555568', font: { size: 10 }, callback: v => fmtShort(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }
    }
  };

  // Income vs Expense bar chart
  destroyChart('incomeExpenseChart');
  const ctx1 = document.getElementById('incomeExpenseChart');
  if (ctx1) {
    chartInstances['incomeExpenseChart'] = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [
          { label: 'Income', data: data.map(d => d.inc), backgroundColor: 'rgba(0,229,160,0.6)', borderColor: '#00e5a0', borderWidth: 1, borderRadius: 4 },
          { label: 'Expenses', data: data.map(d => d.exp), backgroundColor: 'rgba(255,82,82,0.5)', borderColor: '#ff5252', borderWidth: 1, borderRadius: 4 }
        ]
      },
      options: { ...chartDefaults, plugins: { ...chartDefaults.plugins } }
    });
  }

  // Donut chart - category spending this month
  const monthTxns = currentMonthTxns().filter(t=>t.type==='expense');
  const cats = {};
  for (const t of monthTxns) cats[t.category] = (cats[t.category]||0) + t.amount;
  const catEntries = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const donutColors = ['#00e5a0','#5c9cf5','#ff5252','#ffb74d','#b57bee','#00b4d8','#ff7043','#26c6da'];
  destroyChart('donutChart');
  const ctx2 = document.getElementById('donutChart');
  if (ctx2 && catEntries.length) {
    chartInstances['donutChart'] = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: catEntries.map(([c])=>c),
        datasets: [{ data: catEntries.map(([,v])=>v), backgroundColor: donutColors, borderColor: '#111118', borderWidth: 2, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: true, cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8888a0', font: { family: 'Space Grotesk', size: 10 }, boxWidth: 10, padding: 10 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmtKes(ctx.parsed)}` } }
        }
      }
    });
  } else if (ctx2) {
    const wrap = ctx2.closest('.chart-wrap');
    if(wrap) wrap.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;text-align:center;padding:2rem 0;">No expenses this month</p>';
  }

  // Net savings line chart
  destroyChart('netChart');
  const ctx3 = document.getElementById('netChart');
  if (ctx3) {
    const netData = data.map(d => d.net);
    chartInstances['netChart'] = new Chart(ctx3, {
      type: 'line',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Net',
          data: netData,
          borderColor: '#5c9cf5',
          backgroundColor: 'rgba(92,156,245,0.08)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: netData.map(v => v >= 0 ? '#00e5a0' : '#ff5252'),
          pointRadius: 4
        }]
      },
      options: {
        ...chartDefaults,
        plugins: { legend: { display: false } },
        scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks, callback: v => (v>=0?'+':'')+fmtShort(v) } } }
      }
    });
  }
}

// -------- EXPORT --------
function getExportTxns() {
  const from = document.getElementById('exportFrom')?.value;
  const to = document.getElementById('exportTo')?.value;
  let txns = [...state.transactions].sort((a,b)=>new Date(a.date)-new Date(b.date));
  if (from) txns = txns.filter(t => t.date >= from);
  if (to) txns = txns.filter(t => t.date <= to);
  return txns;
}

function txnsToRows(txns) {
  const header = ['Date', 'Type', 'Description', 'Category', 'Amount (KES)', 'Source'];
  const rows = txns.map(t => [t.date, t.type, t.description, t.category, t.amount, t.source||'manual']);
  return [header, ...rows];
}

function exportCSV() {
  const txns = getExportTxns();
  if (!txns.length) { showToast('No transactions in range', true); return; }
  const rows = txnsToRows(txns);
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadFile(blob, `pesatrack_${today()}.csv`);
  closeModal('exportModal');
  showToast('CSV downloaded!');
}

function exportXLSX() {
  if (typeof XLSX === 'undefined') { showToast('XLSX library loading…', true); return; }
  const txns = getExportTxns();
  if (!txns.length) { showToast('No transactions in range', true); return; }

  const wb = XLSX.utils.book_new();

  // Transactions sheet
  const rows = txnsToRows(txns);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 35 }, { wch: 16 }, { wch: 14 }, { wch: 10 }];

  // Style header row (limited support in SheetJS free)
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true, color: { rgb: '00E5A0' } }, fill: { fgColor: { rgb: '111118' } } };
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  // Summary sheet
  const incTotal = txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expTotal = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const cats = {};
  txns.filter(t=>t.type==='expense').forEach(t => cats[t.category] = (cats[t.category]||0)+t.amount);
  const summaryRows = [
    ['Summary', ''],
    ['Total Income', incTotal],
    ['Total Expenses', expTotal],
    ['Net Balance', incTotal - expTotal],
    [''],
    ['Category', 'Total Spent'],
    ...Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,v])=>[c,v])
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadFile(blob, `pesatrack_${today()}.xlsx`);
  closeModal('exportModal');
  showToast('Excel file downloaded!');
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// -------- RENDER --------
function renderAll() {
  renderBalance();
  renderDashboard();
  renderTransactions();
  renderBudget();
  renderSavings();
  populateCategoryFilter();
}

function renderBalance() {
  const all = state.transactions;
  const inc = all.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp = all.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  document.getElementById('totalBalance').textContent = fmtKes(inc - exp);
  document.getElementById('totalIncome').textContent = fmtShort(inc);
  document.getElementById('totalExpense').textContent = fmtShort(exp);
}

function renderDashboard() {
  const txns = currentMonthTxns().filter(t=>t.type==='expense');
  const now = new Date();
  document.getElementById('monthLabel').textContent = now.toLocaleString('default',{month:'long',year:'numeric'});

  // Category breakdown
  const cats = {};
  for (const t of txns) cats[t.category] = (cats[t.category]||0) + t.amount;
  const sorted = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const max = sorted[0]?.[1] || 1;
  const colors = ['#00e5a0','#5c9cf5','#ff5252','#ffb74d','#b57bee','#00b4d8','#ff7043','#26c6da'];
  const el = document.getElementById('categoryChart');
  if (sorted.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;text-align:center;padding:1.5rem 0;">No expenses this month</p>';
  } else {
    el.innerHTML = sorted.map(([cat, amt], i) => `
      <div class="cat-row">
        <span class="cat-label">${cat}</span>
        <div class="cat-bar-bg"><div class="cat-bar" style="width:${(amt/max*100).toFixed(1)}%;background:${colors[i%colors.length]}"></div></div>
        <span class="cat-amount">${fmtShort(amt)}</span>
      </div>`).join('');
  }

  // Recent 5
  const recent = [...state.transactions].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  document.getElementById('recentList').innerHTML = recent.length ? recent.map(txnHtml).join('') : emptyTxn();
}

function renderTransactions() {
  const type = document.getElementById('filterType')?.value || 'all';
  const cat = document.getElementById('filterCat')?.value || 'all';
  let txns = [...state.transactions].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (type !== 'all') txns = txns.filter(t=>t.type===type);
  if (cat !== 'all') txns = txns.filter(t=>t.category===cat);
  document.getElementById('txnList').innerHTML = txns.length ? txns.map(t=>txnHtml(t,true)).join('') : emptyTxn();
}

function txnHtml(t, showDelete=false) {
  const emoji = catEmoji(t.category);
  const sign = t.type==='income' ? '+' : '-';
  const dateStr = t.date ? new Date(t.date+'T00:00:00').toLocaleDateString('en-KE',{day:'numeric',month:'short'}) : '';
  return `<div class="txn-item">
    <div class="txn-icon ${t.type}">${emoji}</div>
    <div class="txn-info">
      <div class="txn-desc">${escHtml(t.description)}</div>
      <div class="txn-meta">${t.category} · ${dateStr}${t.source==='mpesa'?' · M-Pesa':''}</div>
    </div>
    <span class="txn-amount ${t.type}">${sign}${fmtKes(t.amount)}</span>
    ${showDelete ? `<button class="txn-delete" onclick="deleteTransaction(${t.id})">✕</button>` : ''}
  </div>`;
}
function emptyTxn() { return '<p style="color:var(--text3);font-size:0.85rem;text-align:center;padding:2rem 0;">No transactions yet</p>'; }

function renderBudget() {
  const monthTxns = currentMonthTxns().filter(t=>t.type==='expense');
  const el = document.getElementById('budgetList');
  const empty = document.getElementById('noBudget');
  if (!state.budgets.length) { el.innerHTML=''; empty.style.display='flex'; return; }
  empty.style.display='none';
  el.innerHTML = state.budgets.map(b => {
    const spent = monthTxns.filter(t=>t.category===b.category).reduce((s,t)=>s+t.amount,0);
    const pct = Math.min((spent/b.limit)*100, 100);
    const cls = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : 'ok';
    return `<div class="budget-item">
      <div class="budget-head">
        <span class="budget-cat">${catEmoji(b.category)} ${b.category}</span>
        <span class="budget-nums">${fmtShort(spent)} / ${fmtShort(b.limit)}</span>
      </div>
      <div class="budget-track"><div class="budget-fill ${cls}" style="width:${pct.toFixed(1)}%"></div></div>
      <div class="budget-pct">${pct.toFixed(0)}% used${pct>=100?' — over budget!':pct>=75?' — almost there':''}</div>
    </div>`;
  }).join('');
}

function renderSavings() {
  const el = document.getElementById('savingsList');
  const empty = document.getElementById('noSavings');
  if (!state.savings.length) { el.innerHTML=''; empty.style.display='flex'; return; }
  empty.style.display='none';
  el.innerHTML = state.savings.map(g => {
    const pct = Math.min((g.current/g.target)*100,100);
    const inputId = `savinput_${g.id}`;
    return `<div class="saving-item">
      <div class="saving-head">
        <div>
          <div class="saving-name">🎯 ${escHtml(g.name)}</div>
          <div class="saving-target">${fmtKes(g.current)} of ${fmtKes(g.target)}</div>
        </div>
        <span class="saving-pct-badge">${pct.toFixed(0)}%</span>
      </div>
      <div class="saving-track"><div class="saving-fill" style="width:${pct.toFixed(1)}%"></div></div>
      ${pct < 100 ? `<div class="saving-add">
        <input type="number" id="${inputId}" placeholder="Add KES" inputmode="decimal">
        <button onclick="addToSavings(${g.id},'${inputId}')">Add</button>
      </div>` : '<p style="font-size:0.8rem;color:var(--accent);margin-top:0.5rem;font-weight:600;">✓ Goal reached!</p>'}
    </div>`;
  }).join('');
}

function populateCategoryFilter() {
  const sel = document.getElementById('filterCat');
  if (!sel) return;
  const cats = [...new Set(state.transactions.map(t=>t.category))].filter(Boolean);
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Categories</option>' + cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  if (cats.includes(current)) sel.value = current;
}

// -------- UTILS --------
function catEmoji(cat) {
  const m = { Food:'🍽️', Transport:'🚗', Shopping:'🛍️', Bills:'💡', Health:'💊', Entertainment:'🎬', Education:'📚', Salary:'💼', Business:'💰', Other:'📦' };
  return m[cat] || '📦';
}
function clearForm(ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function showToast(msg, error=false) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'5rem', left:'50%', transform:'translateX(-50%)',
    background: error ? 'var(--red-dim)' : 'var(--accent-dim)',
    color: error ? 'var(--red)' : 'var(--accent)',
    border: `1px solid ${error ? 'rgba(255,82,82,0.3)' : 'rgba(0,229,160,0.3)'}`,
    padding:'0.5rem 1.25rem', borderRadius:'20px', fontSize:'0.8rem',
    zIndex:'999', whiteSpace:'nowrap', animation:'fadeIn 0.2s ease'
  });
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2500);
}

function renderAll() {
  renderBalance();
  renderDashboard();
  renderTransactions();
  renderBudget();
  renderSavings();
  populateCategoryFilter();
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const el = document.getElementById('tab-'+name);
  if(el) el.classList.add('active');
  if (name === 'analytics') setTimeout(renderAnalytics, 50);
}
loadState();
if (state.smsGranted || state.transactions.length > 0) {
  showMain();
} else {
  document.getElementById('splash').classList.add('active');
}
