// ══════════════════════════════════════════════════════════════════════════════
//  CHALLAN
// ══════════════════════════════════════════════════════════════════════════════

function initChallanForm() {
	document.getElementById('ch-date').value = today();
	document.getElementById('ch-no').value = genChallanNo();
	S.items = [];
	document.getElementById('items-body').innerHTML = '';
	addItem();
	addItem();
	updatePreview();
}

function addItem() {
	const id = Date.now() + Math.random();
	S.items.push({ id, desc: '', qty: 1, unit: 'bag', pcsUnit: '', price: 0 });
	renderItemsTable();
}

function removeItem(id) {
	S.items = S.items.filter((i) => i.id != id);
	renderItemsTable();
	updatePreview();
}

function renderItemsTable() {
	const tbody = document.getElementById('items-body');
	if (!S.items.length) {
		tbody.innerHTML =
			'<tr><td colspan="7" class="empty" style="padding:12px;">No items added.</td></tr>';
		return;
	}
	tbody.innerHTML = S.items
		.map(
			(item) => `
    <tr>
      <td>
        <input type="text" value="${item.desc}" placeholder="Description"
          oninput="updateItem(${item.id},'desc',this.value)">
      </td>
      <td>
        <input type="number" value="${item.qty || ''}" min="0" style="width:55px;"
          oninput="updateItem(${item.id},'qty',this.value)">
      </td>
      <td>
        <select onchange="updateItem(${item.id},'unit',this.value)">
          ${['bag', 'pkt', 'kg', 'pcs', 'box']
						.map(
							(u) =>
								`<option ${u === item.unit ? 'selected' : ''}>${u}</option>`,
						)
						.join('')}
        </select>
      </td>
      <td>
        <input type="number" value="${item.pcsUnit || ''}" min="0" placeholder="—" style="width:55px;"
          oninput="updateItem(${item.id},'pcsUnit',this.value)">
      </td>
      <td>
        <input type="number" value="${item.price || ''}" min="0" step="0.01" placeholder="0.00"
          oninput="updateItem(${item.id},'price',this.value)">
      </td>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text2);padding:6px 10px;">
        <span id="ch-item-total-${item.id}">${fmt(item.qty * item.price)}</span>
      </td>
      <td>
        <button onclick="removeItem(${item.id})"
          style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;">✕</button>
      </td>
    </tr>
  `,
		)
		.join('');
}

function updateItem(id, field, val) {
	const item = S.items.find((i) => i.id == id);
	if (!item) return;
	item[field] =
		field === 'qty' || field === 'price' || field === 'pcsUnit'
			? parseFloat(val) || 0
			: val;

	// Only update the total cell — don't re-render the whole table
	const totalCell = document.getElementById(`ch-item-total-${id}`);
	if (totalCell) totalCell.textContent = fmt(item.qty * item.price);

	updatePreview();
}

function updatePreview() {
	const no = document.getElementById('ch-no').value;
	const party = document.getElementById('ch-party').value || '—';
	const company = document.getElementById('ch-company').value || '—';
	const date = document.getElementById('ch-date').value;
	const notes = document.getElementById('ch-notes').value || '—';
	const adj = parseFloat(document.getElementById('ch-adjustment').value) || 0;
	const subtotal = S.items.reduce((s, i) => s + i.qty * i.price, 0);

	document.getElementById('prev-no').textContent = no;
	document.getElementById('prev-party').textContent = party;
	document.getElementById('prev-company').textContent = company;
	document.getElementById('prev-date').textContent = fmtDate(date);
	document.getElementById('prev-notes').textContent = notes;
	document.getElementById('prev-subtotal').textContent = fmt(subtotal);
	document.getElementById('prev-adj').textContent = fmt(adj);
	document.getElementById('prev-total').textContent = fmt(subtotal + adj);

	document.getElementById('prev-items').innerHTML = S.items
		.map(
			(i) => `
    <tr><td>${i.desc || '—'}</td><td>${i.qty}</td><td>${i.unit}</td><td>${i.pcsUnit || '—'}</td><td>${fmt(i.price)}</td><td>${fmt(i.qty * i.price)}</td></tr>
  `,
		)
		.join('');
}

async function generateChallan() {
	const party = document.getElementById('ch-party').value.trim();
	const date = document.getElementById('ch-date').value;
	const validItems = S.items.filter((i) => i.desc);

	if (!party) {
		toast('Party name is required.', 'error');
		return;
	}
	if (!date) {
		toast('Date is required.', 'error');
		return;
	}
	if (!validItems.length) {
		toast('Add at least one item with a description.', 'error');
		return;
	}

	const no = document.getElementById('ch-no').value;
	const company = document.getElementById('ch-company').value.trim();
	const notes = document.getElementById('ch-notes').value.trim();
	const adj = parseFloat(document.getElementById('ch-adjustment').value) || 0;
	const subtotal = validItems.reduce((s, i) => s + i.qty * i.price, 0);
	const total = subtotal + adj;

	const challan = {
		no,
		date,
		party,
		company,
		notes,
		adj,
		items: validItems,
		subtotal,
		total,
	};

	// Optimistic local update
	S.challans.unshift(challan);
	initChallanForm();
	renderAll();
	toast(`Challan ${no} created!`, 'success');

	// Sync to sheet
	if (S.gasUrl) {
		setLoading('gen-btn', true, 'Saving…');
		try {
			await api('createChallan', { data: challan });
			setSyncState(
				'connected',
				'Saved ' +
					new Date().toLocaleTimeString('en-IN', {
						hour: '2-digit',
						minute: '2-digit',
					}),
			);
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
	['ch-party', 'ch-company', 'ch-notes'].forEach(
		(id) => (document.getElementById(id).value = ''),
	);
	document.getElementById('ch-adjustment').value = '0';
	initChallanForm();
}

async function loadChallans() {
	if (!S.gasUrl) return;
	try {
		S.challans = await api('getChallans');
		renderDatabase();
		toast('Challan database refreshed.');
	} catch (e) {
		toast('Refresh failed: ' + e.message, 'error');
	}
}

function printPreviewElement(preview) {
	const printContainer = document.createElement('div');
	printContainer.id = 'print-container';
	printContainer.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    background: #fff; z-index: 99999;
    padding: 40px; box-sizing: border-box;
  `;
	printContainer.appendChild(preview);
	document.body.appendChild(printContainer);

	// Hide everything else
	document.querySelector('.shell').style.display = 'none';

	window.print();

	// Restore after print dialog closes
	document.querySelector('.shell').style.display = '';
	document.body.removeChild(printContainer);
}

function printChallan() {
	updatePreview();
	const preview = document.querySelector('.challan-preview').cloneNode(true);
	printPreviewElement(preview);
}

function createChallanPreviewElement(challan) {
	const subtotal = Number(challan.subtotal) || 0;
	const adj = Number(challan.adj) || 0;
	const total = Number(challan.total) || subtotal + adj;
	const items = challan.items || [];
	const wrapper = document.createElement('div');
	wrapper.className = 'challan-preview';
	wrapper.innerHTML = `
    <div class="ch-header">
      <div><div class="ch-brand">Ceety</div><div class="ch-sub">Delivery Challan</div></div>
      <div class="ch-no">${escapeHtml(challan.no || '—')}</div>
    </div>
    <div class="ch-meta">
      <div class="ch-meta-item"><div class="lbl">Name</div><div class="val">${escapeHtml(challan.party || '—')}</div></div>
      <div class="ch-meta-item"><div class="lbl">Company</div><div class="val">${escapeHtml(challan.company || '—')}</div></div>
      <div class="ch-meta-item"><div class="lbl">Date</div><div class="val">${fmtDate(challan.date)}</div></div>
      <div class="ch-meta-item"><div class="lbl">Notes</div><div class="val" style="font-size:11px;color:var(--text2);">${escapeHtml(challan.notes || '—')}</div></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Pcs/U</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>
        ${items
					.map((item) => {
						const qty = Number(item.qty) || 0;
						const price = Number(item.price) || 0;
						return `<tr><td>${escapeHtml(item.desc || item.product || '—')}</td><td>${qty}</td><td>${escapeHtml(item.unit || '—')}</td><td>${escapeHtml(item.pcsUnit || '—')}</td><td>${fmt(price)}</td><td>${fmt(qty * price)}</td></tr>`;
					})
					.join('')}
      </tbody>
    </table>
    <div class="ch-total">
      <div class="ch-total-row"><span style="color:var(--text2)">Subtotal</span><span>${fmt(subtotal)}</span></div>
      <div class="ch-total-row"><span style="color:var(--text2)">Adjustment</span><span>${fmt(adj)}</span></div>
      <div class="ch-total-row final"><span>Total</span><span>${fmt(total)}</span></div>
    </div>
  `;
	return wrapper;
}

function printSavedChallan(no) {
	const challan = S.challans.find((c) => c.no === no);
	if (!challan) {
		toast(`Could not find challan ${no}.`, 'error');
		return;
	}
	printPreviewElement(createChallanPreviewElement(challan));
}
