// ══════════════════════════════════════════════════════════════════════════════
//  CHALLAN
// ══════════════════════════════════════════════════════════════════════════════

function initChallanForm() {
  document.getElementById('ch-date').value = today();
  document.getElementById('ch-no').value   = genChallanNo();
  S.items = [];
  document.getElementById('items-body').innerHTML = '';
  addItem(); addItem();
  updatePreview();
}

function addItem() {
  const id = Date.now() + Math.random();
  S.items.push({ id, desc: '', qty: 1, unit: 'bag', pcsUnit: '', price: 0 });
  renderItemsTable();
}

function removeItem(id) {
  S.items = S.items.filter(i => i.id != id);
  renderItemsTable(); updatePreview();
}

function renderItemsTable() {
  document.getElementById('items-body').innerHTML = S.items.map(item => `
    <tr>
      <td><input type="text" value="${item.desc}" placeholder="Description" oninput="updateItem(${item.id},'desc',this.value)"></td>
      <td><input type="number" value="${item.qty}" min="0" style="width:55px;" oninput="updateItem(${item.id},'qty',this.value)"></td>
      <td><select onchange="updateItem(${item.id},'unit',this.value)">${['bag','pkt','kg','pcs','box'].map(u=>`<option ${u===item.unit?'selected':''}>${u}</option>`).join('')}</select></td>
      <td><input type="number" value="${item.pcsUnit||''}" min="0" placeholder="—" style="width:55px;" oninput="updateItem(${item.id},'pcsUnit',this.value)"></td>
      <td><input type="number" value="${item.price}" min="0" step="0.01" oninput="updateItem(${item.id},'price',this.value)"></td>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text2);">${fmt(item.qty*item.price)}</td>
      <td><button onclick="removeItem(${item.id})" style="background:none;border:none;color:var(--danger);cursor:pointer;">✕</button></td>
    </tr>
  `).join('');
}

function updateItem(id, field, val) {
  const item = S.items.find(i => i.id == id);
  if (!item) return;
  item[field] = (field === 'qty' || field === 'price' || field === 'pcsUnit') ? (parseFloat(val) || 0) : val;
  renderItemsTable(); updatePreview();
}

function updatePreview() {
  const no      = document.getElementById('ch-no').value;
  const party   = document.getElementById('ch-party').value || '—';
  const company = document.getElementById('ch-company').value || '—';
  const date    = document.getElementById('ch-date').value;
  const notes   = document.getElementById('ch-notes').value || '—';
  const adj     = parseFloat(document.getElementById('ch-adjustment').value) || 0;
  const subtotal = S.items.reduce((s, i) => s + i.qty * i.price, 0);

  document.getElementById('prev-no').textContent      = no;
  document.getElementById('prev-party').textContent   = party;
  document.getElementById('prev-company').textContent = company;
  document.getElementById('prev-date').textContent    = fmtDate(date);
  document.getElementById('prev-notes').textContent   = notes;
  document.getElementById('prev-subtotal').textContent = fmt(subtotal);
  document.getElementById('prev-adj').textContent     = fmt(adj);
  document.getElementById('prev-total').textContent   = fmt(subtotal + adj);

  document.getElementById('prev-items').innerHTML = S.items.map(i => `
    <tr><td>${i.desc||'—'}</td><td>${i.qty}</td><td>${i.unit}</td><td>${i.pcsUnit||'—'}</td><td>${fmt(i.price)}</td><td>${fmt(i.qty*i.price)}</td></tr>
  `).join('');
}

async function generateChallan() {
  const party = document.getElementById('ch-party').value.trim();
  const date  = document.getElementById('ch-date').value;
  const validItems = S.items.filter(i => i.desc);

  if (!party)               { toast('Party name is required.', 'error'); return; }
  if (!date)                { toast('Date is required.', 'error'); return; }
  if (!validItems.length)   { toast('Add at least one item with a description.', 'error'); return; }

  const no       = document.getElementById('ch-no').value;
  const company  = document.getElementById('ch-company').value.trim();
  const notes    = document.getElementById('ch-notes').value.trim();
  const adj      = parseFloat(document.getElementById('ch-adjustment').value) || 0;
  const subtotal = validItems.reduce((s, i) => s + i.qty * i.price, 0);
  const total    = subtotal + adj;

  const challan = { no, date, party, company, notes, adj, items: validItems, subtotal, total };

  // Optimistic local update
  S.challans.unshift(challan);
  validItems.forEach(item => {
    const desc = item.desc.toLowerCase();
    const match = S.stock.find(s => s.name.toLowerCase().includes(desc) || desc.includes(s.name.toLowerCase()));
    if (match) match.qty = Math.max(0, match.qty - item.qty);
  });

  initChallanForm(); renderAll();
  toast(`Challan ${no} created!`, 'success');

  // Sync to sheet
  if (S.gasUrl) {
    setLoading('gen-btn', true, 'Saving…');
    try {
      await api('createChallan', { data: challan });
      setSyncState('connected', 'Saved ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      toast(`Challan ${no} saved to Google Sheets!`, 'success');
    } catch (e) {
      toast('Saved locally. Sheet sync failed: ' + e.message, 'error');
    } finally {
      setLoading('gen-btn', false);
      document.getElementById('gen-btn').textContent = '✦ Generate Challan';
    }
  }
}

function clearChallanForm() {
  ['ch-party','ch-company','ch-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ch-adjustment').value = '0';
  initChallanForm();
}

async function loadChallans() {
  if (!S.gasUrl) return;
  try {
    S.challans = await api('getChallans');
    renderDatabase();
    toast('Challan database refreshed.');
  } catch(e) { toast('Refresh failed: ' + e.message, 'error'); }
}
