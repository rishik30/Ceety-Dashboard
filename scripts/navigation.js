// ══════════════════════════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════

function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (el) el.classList.add('active');
  if (page === 'overview')  renderOverview();
  if (page === 'database')  renderDatabase();
  if (page === 'accounts')  renderAccounts();
  if (page === 'stock')     renderStock();
  if (page === 'orders')    renderOrders();
}

function renderAll() {
  renderOverview(); renderDatabase(); renderAccounts(); renderOrders(); renderStock();
}
