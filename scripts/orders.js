// ══════════════════════════════════════════════════════════════════════════════
//  ORDERS
// ══════════════════════════════════════════════════════════════════════════════

function initOrderForm() {
  document.getElementById('ord-date').value = today();
  document.getElementById('ord-no').value   = genOrderNo();
}

async function addOrder() {
  const date    = document.getElementById('ord-date').value;
  const party   = document.getElementById('ord-party').value.trim();
  const company = document.getElementById('ord-company').value.trim();
  const desc    = document.getElementById('ord-desc').value.trim();
  const qty     = parseFloat(document.getElementById('ord-qty').value) || 0;
  const unit    = document.getElementById('ord-unit').value;
  const status  = document.getElementById('ord-status').value;
  const notes   = document.getElementById('ord-notes').value.trim();
  const no      = document.getElementById('ord-no').value;

  if (!party || !desc) { toast('Party name and description are required.', 'error'); return; }

  const order = { no, date, party, company, desc, qty, unit, status, notes, id: Date.now() };
  S.orders.unshift(order);
  renderOrders(); clearOrderForm(); renderOverview();
  toast(`Order ${no} added!`);

  if (S.gasUrl) {
    setLoading('ord-btn', true, 'Saving…');
    try {
      await api('addOrder', { data: order });
      toast(`Order ${no} saved to Google Sheets!`, 'success');
    } catch(e) { toast('Local save done. Sheet: ' + e.message, 'error'); }
    finally {
      setLoading('ord-btn', false);
      document.getElementById('ord-btn').textContent = '+ Add Order';
    }
  }
}

function clearOrderForm() {
  ['ord-party','ord-company','ord-desc','ord-notes','ord-qty'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ord-date').value = today();
  document.getElementById('ord-no').value   = genOrderNo();
}

async function loadOrders() {
  if (!S.gasUrl) return;
  try { S.orders = await api('getOrders'); renderOrders(); toast('Orders refreshed.'); }
  catch(e) { toast('Refresh failed: ' + e.message, 'error'); }
}

async function updateOrderStatus(no, status) {
  const o = S.orders.find(o => o.no === no);
  if (o) { o.status = status; renderOrders(); renderOverview(); }
  if (S.gasUrl) {
    try { await api('updateOrderStatus', { no, status }); }
    catch(e) { toast('Status sync failed: ' + e.message, 'error'); }
  }
}

async function deleteOrder(no) {
  S.orders = S.orders.filter(o => o.no !== no);
  renderOrders(); renderOverview();
  if (S.gasUrl) {
    try { await api('deleteOrder', { no }); toast('Order deleted.'); }
    catch(e) { toast('Sheet delete failed: ' + e.message, 'error'); }
  }
}

function renderOrders() {
  const tbody = document.getElementById('orders-body');
  if (!S.orders.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No orders yet.</td></tr>'; return; }
  const sb = { pending:'badge-warn', fulfilled:'badge-green', partial:'badge-warn', cancelled:'badge-red' };
  tbody.innerHTML = S.orders.map(o => `
    <tr>
      <td style="font-family:var(--mono);font-size:12px;">${o.no}</td>
      <td>${fmtDate(o.date)}</td>
      <td style="font-weight:500;">${o.party}</td>
      <td>${o.desc}</td>
      <td>${o.qty} ${o.unit}</td>
      <td><span class="badge ${sb[o.status]}">${o.status}</span></td>
      <td style="color:var(--text2);font-size:12px;">${o.notes||'—'}</td>
      <td style="white-space:nowrap;">
        <select onchange="updateOrderStatus('${o.no}',this.value)" style="font-size:11px;padding:4px 6px;width:auto;">
          ${['pending','fulfilled','partial','cancelled'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class="btn btn-danger btn-sm" onclick="deleteOrder('${o.no}')">Del</button>
      </td>
    </tr>
  `).join('');
}
