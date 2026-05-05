// ══════════════════════════════════════════════════════════════════════════════
//  ORDERS (PURCHASE)
// ══════════════════════════════════════════════════════════════════════════════

// Line items and overheads state
S.orderItems = [];
S.orderOverheads = [];

function initOrderForm() {
	document.getElementById('ord-date').value = today();
	document.getElementById('ord-no').value = genOrderNo();
	S.orderItems = [];
	S.orderOverheads = [];
	renderOrderItems();
	renderOrderOverheads();
	addOrderItem(); // start with one blank item row
	calcOrderTotals();
}

// ── Order Items ──────────────────────────────────────────────────────────────

function addOrderItem() {
	S.orderItems.push({
		id: Date.now() + Math.random(),
		product: 'Regular Ceety',
		qty: 0,
		unit: 'Bag',
		rate: 0,
	});
	renderOrderItems();
}

function removeOrderItem(id) {
	S.orderItems = S.orderItems.filter((i) => i.id != id);
	renderOrderItems();
	calcOrderTotals();
}

function updateOrderItem(id, field, val) {
	const item = S.orderItems.find((i) => i.id == id);
	if (!item) return;
	item[field] =
		field === 'qty' || field === 'rate' ? parseFloat(val) || 0 : val;
	// renderOrderItems();
	const totalCell = document.getElementById(`item-total-${id}`);
	if (totalCell) totalCell.textContent = fmt(item.qty * item.rate);
	calcOrderTotals();
}

function renderOrderItems() {
	const tbody = document.getElementById('ord-items-body');
	if (!S.orderItems.length) {
		tbody.innerHTML =
			'<tr><td colspan="6" class="empty" style="padding:12px;">No items added yet.</td></tr>';
		return;
	}
	tbody.innerHTML = S.orderItems
		.map(
			(item) => `
    <tr>
      <td>
        <select onchange="updateOrderItem(${item.id},'product',this.value)">
          <option ${item.product === 'Regular Ceety' ? 'selected' : ''}>Regular Ceety</option>
          <option ${item.product === 'Small Ceety' ? 'selected' : ''}>Small Ceety</option>
        </select>
      </td>
      <td>
        <input type="number" value="${item.qty || ''}" min="0" placeholder="0"
          oninput="updateOrderItem(${item.id},'qty',this.value)">
      </td>
      <td>
        <select onchange="updateOrderItem(${item.id},'unit',this.value)">
          ${['Bag', 'Pkt', 'Pcs'].map((u) => `<option ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </td>
      <td>
        <input type="number" value="${item.rate || ''}" min="0" step="0.01" placeholder="0.00"
          oninput="updateOrderItem(${item.id},'rate',this.value)">
      </td>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text2);padding:6px 10px;">
        <span id="item-total-${item.id}">${fmt(item.qty * item.rate)}</span>
      </td>
      <td>
        <button onclick="removeOrderItem(${item.id})"
          style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;">✕</button>
      </td>
    </tr>
  `,
		)
		.join('');
}

// ── Overheads ────────────────────────────────────────────────────────────────

function addOverheadItem() {
	S.orderOverheads.push({
		id: Date.now() + Math.random(),
		desc: '',
		amount: 0,
	});
	renderOrderOverheads();
}

function removeOverheadItem(id) {
	S.orderOverheads = S.orderOverheads.filter((i) => i.id != id);
	renderOrderOverheads();
	calcOrderTotals();
}

function updateOverheadItem(id, field, val) {
	const item = S.orderOverheads.find((i) => i.id == id);
	if (!item) return;
	item[field] = field === 'amount' ? parseFloat(val) || 0 : val;
	// renderOrderOverheads();
	calcOrderTotals();
}

function renderOrderOverheads() {
	const tbody = document.getElementById('ord-overhead-body');
	if (!S.orderOverheads.length) {
		tbody.innerHTML =
			'<tr><td colspan="3" class="empty" style="padding:12px;">No overhead charges added.</td></tr>';
		return;
	}
	tbody.innerHTML = S.orderOverheads
		.map(
			(item) => `
    <tr>
      <td>
        <input type="text" value="${item.desc}" placeholder="e.g. Transport, Loading…"
          oninput="updateOverheadItem(${item.id},'desc',this.value)">
      </td>
      <td>
        <input type="number" value="${item.amount || ''}" min="0" step="0.01" placeholder="0.00"
          oninput="updateOverheadItem(${item.id},'amount',this.value)">
      </td>
      <td>
        <button onclick="removeOverheadItem(${item.id})"
          style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;">✕</button>
      </td>
    </tr>
  `,
		)
		.join('');
}

// ── Totals ───────────────────────────────────────────────────────────────────

function calcOrderTotals() {
	const subtotal = S.orderItems.reduce((s, i) => s + i.qty * i.rate, 0);
	const overheadTotal = S.orderOverheads.reduce((s, i) => s + i.amount, 0);
	const total = subtotal + overheadTotal;

	document.getElementById('ord-subtotal-display').textContent = fmt(subtotal);
	document.getElementById('ord-overhead-display').textContent =
		fmt(overheadTotal);
	document.getElementById('ord-total-display').textContent = fmt(total);

	calcOrderDue(total);
}

function calcOrderDue(total) {
	if (total === undefined) {
		const subtotal = S.orderItems.reduce((s, i) => s + i.qty * i.rate, 0);
		const overheadTotal = S.orderOverheads.reduce((s, i) => s + i.amount, 0);
		total = subtotal + overheadTotal;
	}
	const paid = parseFloat(document.getElementById('ord-paid').value) || 0;
	const due = total - paid;

	document.getElementById('ord-due').value = total > 0 ? fmt(due) : '';

	// Auto-set status
	const statusEl = document.getElementById('ord-status');
	if (total > 0) {
		if (paid <= 0) statusEl.value = 'Pending';
		else if (due <= 0) statusEl.value = 'Paid';
		else statusEl.value = 'Partial';
	}
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

async function addOrder() {
	const no = document.getElementById('ord-no').value;
	const date = document.getElementById('ord-date').value;
	const delivery = document.getElementById('ord-delivery').value;
	const supplier = document.getElementById('ord-supplier').value.trim();
	const paid = parseFloat(document.getElementById('ord-paid').value) || 0;
	const payDate = document.getElementById('ord-payment-date').value;
	const status = document.getElementById('ord-status').value;
	const notes = document.getElementById('ord-notes').value.trim();

	const validItems = S.orderItems.filter((i) => i.product && i.qty > 0);
	const validOverheads = S.orderOverheads.filter((i) => i.desc && i.amount > 0);

	// Validation
	if (!date) {
		toast('Order date is required.', 'error');
		return;
	}
	if (!supplier) {
		toast('Supplier name is required.', 'error');
		return;
	}
	if (!validItems.length) {
		toast('Add at least one item with quantity and rate.', 'error');
		return;
	}

	const subtotal = validItems.reduce((s, i) => s + i.qty * i.rate, 0);
	const overheadTotal = validOverheads.reduce((s, i) => s + i.amount, 0);
	const total = subtotal + overheadTotal;
	const due = total - paid;

	const order = {
		no,
		date,
		delivery,
		supplier,
		items: validItems.map(({ product, qty, unit, rate }) => ({
			product,
			qty,
			unit,
			rate,
			total: qty * rate,
		})),
		overheads: validOverheads.map(({ desc, amount }) => ({ desc, amount })),
		subtotal,
		overheadTotal,
		total,
		paid,
		due,
		paymentDate: payDate,
		status,
		notes,
		id: Date.now(),
	};

	// Optimistic local update
	S.orders.unshift(order);
	renderOrders();
	renderOverview();
	initOrderForm();
	toast(`Order ${no} added!`);

	if (S.gasUrl) {
		setLoading('ord-btn', true, 'Saving…');
		try {
			await api('addOrder', { data: order });
			toast(`Order ${no} saved to Google Sheets!`, 'success');
		} catch (e) {
			toast('Local save done. Sheet sync failed: ' + e.message, 'error');
		} finally {
			setLoading('ord-btn', false);
			document.getElementById('ord-btn').textContent = '+ Add Order';
		}
	}
}

function clearOrderForm() {
	['ord-supplier', 'ord-notes', 'ord-delivery', 'ord-payment-date'].forEach(
		(id) => {
			document.getElementById(id).value = '';
		},
	);
	document.getElementById('ord-paid').value = '';
	document.getElementById('ord-due').value = '';
	document.getElementById('ord-status').value = 'Pending';
	initOrderForm();
}

async function loadOrders() {
	if (!S.gasUrl) return;
	try {
		S.orders = (await api('getOrders')) || [];
		renderOrders();
		toast('Orders refreshed.');
	} catch (e) {
		toast('Refresh failed: ' + e.message, 'error');
	}
}

async function updateAmountPaid(no) {
	const o = S.orders.find((o) => o.no === no);
	if (!o) return;
	const newPaid = parseFloat(
		prompt(
			`Order ${no}\nSupplier: ${o.supplier}\nTotal: ${fmt(o.total)}\nCurrent paid: ${fmt(o.paid)}\n\nEnter new total amount paid:`,
		),
	);
	if (isNaN(newPaid) || newPaid < 0) return;

	o.paid = newPaid;
	o.due = o.total - newPaid;
	o.status = newPaid <= 0 ? 'Pending' : o.due <= 0 ? 'Paid' : 'Partial';

	renderOrders();
	renderOverview();
	toast(`Payment updated for ${no}.`);

	if (S.gasUrl) {
		try {
			await api('updateOrderPayment', {
				no,
				paid: newPaid,
				due: o.due,
				status: o.status,
			});
		} catch (e) {
			toast('Sheet sync failed: ' + e.message, 'error');
		}
	}
}

async function deleteOrder(no) {
	if (!confirm(`Delete order ${no}? This cannot be undone.`)) return;
	S.orders = S.orders.filter((o) => o.no !== no);
	renderOrders();
	renderOverview();
	if (S.gasUrl) {
		try {
			await api('deleteOrder', { no });
			toast(`Order ${no} deleted.`);
		} catch (e) {
			toast('Sheet delete failed: ' + e.message, 'error');
		}
	}
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderOrders() {
	console.log('renderOrders called, S.orders:', JSON.stringify(S.orders));
	console.log('First order supplier:', S.orders[0]?.supplier);
	console.log('First order items:', S.orders[0]?.items);
	const totalValue = S.orders.reduce((s, o) => s + (o.total || 0), 0);
	const totalPaid = S.orders.reduce((s, o) => s + (o.paid || 0), 0);
	const totalDue = S.orders.reduce((s, o) => s + (o.due || 0), 0);

	document.getElementById('po-stat-total').textContent = S.orders.length;
	document.getElementById('po-stat-value').textContent = fmt(totalValue);
	document.getElementById('po-stat-paid').textContent = fmt(totalPaid);
	document.getElementById('po-stat-due').textContent = fmt(totalDue);

	const search = (
		document.getElementById('ord-search')?.value || ''
	).toLowerCase();
	const statusFilt =
		document.getElementById('ord-filter-status')?.value || 'all';

	const filtered = S.orders.filter((o) => {
		const matchSearch =
			!search ||
			(o.no || '').toLowerCase().includes(search) ||
			(o.supplier || '').toLowerCase().includes(search);
		const matchStatus = statusFilt === 'all' || o.status === statusFilt;
		return matchSearch && matchStatus;
	});

	const tbody = document.getElementById('orders-body');
	if (!filtered.length) {
		tbody.innerHTML =
			'<tr><td colspan="13" class="empty">No orders match your filters.</td></tr>';
		return;
	}

	const statusBadge = {
		Pending: 'badge-warn',
		Partial: 'badge-warn',
		Paid: 'badge-green',
		Cancelled: 'badge-red',
	};

	tbody.innerHTML = filtered
		.map((o) => {
			const due = o.due ?? o.total - o.paid;
			const deliveryDate = parseAppDate(o.delivery);
			const isOverdue =
				deliveryDate &&
				o.status !== 'Paid' &&
				o.status !== 'Cancelled' &&
				deliveryDate < new Date();

			// Build items summary tooltip
			const itemsSummary = (o.items || [])
				.map((i) => `${i.qty} ${i.unit} ${i.product} @ ${fmt(i.rate)}`)
				.join('\n');

			const deliveryTd = o.delivery
				? `<td style="font-size:12px;${isOverdue ? 'color:var(--danger);font-weight:500;' : ''}">${fmtDate(o.delivery)}${isOverdue ? ' ⚠' : ''}</td>`
				: '<td style="color:var(--text3);">—</td>';

			return `
      <tr>
        <td style="font-family:var(--mono);font-size:12px;">${o.no}</td>
        <td style="font-size:12px;">${fmtDate(o.date)}</td>
        ${deliveryTd}
        <td style="font-weight:500;">${o.supplier}</td>
        <td>
          <span title="${itemsSummary}"
            style="cursor:help;font-size:12px;color:var(--text2);">
            ${(o.items || []).length} item(s)
          </span>
        </td>
        <td style="font-family:var(--mono);font-size:12px;">${fmt(o.subtotal || 0)}</td>
        <td style="font-family:var(--mono);font-size:12px;color:var(--text2);">${fmt(o.overheadTotal || 0)}</td>
        <td style="font-family:var(--mono);font-weight:500;">${fmt(o.total)}</td>
        <td style="font-family:var(--mono);color:var(--accent);">${fmt(o.paid || 0)}</td>
        <td style="font-family:var(--mono);color:${due > 0 ? 'var(--danger)' : 'var(--accent)'};">${fmt(due)}</td>
        <td><span class="badge ${statusBadge[o.status] || 'badge-warn'}">${o.status}</span></td>
        <td style="color:var(--text2);font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.notes || '—'}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="updateAmountPaid('${o.no}')">₹ Pay</button>
          <button class="btn btn-danger btn-sm" onclick="deleteOrder('${o.no}')">Del</button>
        </td>
      </tr>
    `;
		})
		.join('');
}
