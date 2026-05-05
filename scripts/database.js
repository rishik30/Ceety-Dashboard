// ══════════════════════════════════════════════════════════════════════════════
//  DATABASE RENDER
// ══════════════════════════════════════════════════════════════════════════════

function renderDatabase() {
  const search   = (document.getElementById('db-search')?.value || '').toLowerCase();
  const costMap = getChallanCostMap();
  const filtered = S.challans.filter(c =>
    (c.party || '').toLowerCase().includes(search) ||
    (c.no || '').toLowerCase().includes(search) ||
    (c.date || '').includes(search)
  );
  document.getElementById('db-count').textContent = filtered.length + ' record(s)';
  const tbody = document.getElementById('db-body');
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">No records found.</td></tr>'; return; }
  tbody.innerHTML = filtered.map(c => {
    const profit = getChallanProfit(c, costMap);
    const items = c.items || [];
    const itemsLabel = `${items.length} item(s)`;
    const itemsTooltip = escapeHtml(buildChallanItemsTooltip(items));
    return `
    <tr>
      <td style="font-family:var(--mono);font-size:12px;">${c.no}</td>
      <td>${fmtDate(c.date)}</td>
      <td style="font-weight:500;">${c.party}</td>
      <td style="color:var(--text2);">${c.company||'—'}</td>
      <td><span title="${itemsTooltip}" style="cursor:help;text-decoration:underline dotted;">${itemsLabel}</span></td>
      <td style="font-family:var(--mono);">${fmt(c.subtotal)}</td>
      <td style="font-family:var(--mono);">${fmt(c.adj)}</td>
      <td style="font-family:var(--mono);font-weight:600;color:var(--accent);">${fmt(c.total)}</td>
      <td style="font-family:var(--mono);font-weight:600;color:${profit.profit >= 0 ? 'var(--accent)' : 'var(--danger)'};" title="Cost: ${fmt(profit.cost)} | Margin: ${profit.margin.toFixed(1)}%">${fmt(profit.profit)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteChallan('${c.no}')">Del</button></td>
    </tr>
  `;
  }).join('');
}

function filterDatabase() { renderDatabase(); }

async function deleteChallan(no) {
  if (!confirm(`Delete challan ${no}? This cannot be undone.`)) return;
  S.challans = S.challans.filter(c => c.no !== no);
  renderDatabase(); renderOverview();
  if (S.gasUrl) {
    try { await api('deleteChallan', { no }); toast(`Challan ${no} deleted from Sheet.`); }
    catch(e) { toast('Local delete done. Sheet: ' + e.message, 'error'); }
  }
}
