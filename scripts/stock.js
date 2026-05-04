// ══════════════════════════════════════════════════════════════════════════════
//  STOCK
// ══════════════════════════════════════════════════════════════════════════════

const CONVERSION = {
	'Regular Ceety': { pcsPerPkt: 1440, pktPerBag: 50 },
	'Small Ceety': { pcsPerPkt: 2880, pktPerBag: 50 },
};

function toPcs(qty, unit, product) {
	const c = CONVERSION[product];
	if (unit === 'pcs') return qty;
	if (unit === 'pkt') return qty * c.pcsPerPkt;
	if (unit === 'bag') return qty * c.pcsPerPkt * c.pktPerBag;
	return qty;
}

async function addStockEntry() {
	const date = document.getElementById('stk-date').value;
	const ref = document.getElementById('stk-ref').value.trim();
	const type = document.getElementById('stk-type').value;
	const product = document.getElementById('stk-product').value;
	const qty = parseFloat(document.getElementById('stk-qty').value) || 0;
	const unit = document.getElementById('stk-unit').value;

	if (!date) {
		toast('Date is required.', 'error');
		return;
	}
	if (!ref) {
		toast('Reference / reason is required.', 'error');
		return;
	}
	if (qty <= 0) {
		toast('Enter a valid quantity.', 'error');
		return;
	}

	const pcs = toPcs(qty, unit, product);
	const c = CONVERSION[product];
	const pkt = Math.floor(pcs / c.pcsPerPkt);
	const bag = Math.floor(pkt / c.pktPerBag);

	const entry = { date, reference: ref, type, product, pcs, pkt, bag };

	// Optimistic local update
	S.stockLedger.unshift(entry);
	rebuildSummaryLocally();
	renderStock();
	clearStockForm();
	renderOverview();
	toast(`${type} entry added for ${product}.`);

	if (S.gasUrl) {
		setLoading('stk-btn', true, 'Saving…');
		try {
			await api('addStock', {
				data: { date, reference: ref, type, product, pcs },
			});
			// Refresh summary from sheet after save
			const fresh = await api('getStockSummary');
			S.stockSummary = fresh || [];
			renderStockSummaryCards();
			toast('Stock saved to Google Sheets!', 'success');
		} catch (e) {
			toast('Local save done. Sheet sync failed: ' + e.message, 'error');
		} finally {
			setLoading('stk-btn', false);
			document.getElementById('stk-btn').textContent = '+ Add Entry';
		}
	}
}

// Build summary locally from ledger when offline or before sync
function rebuildSummaryLocally() {
	S.stockSummary = Object.keys(CONVERSION).map((product) => {
		const inPcs = S.stockLedger
			.filter((r) => r.product === product && r.type === 'IN')
			.reduce((s, r) => s + r.pcs, 0);
		const outPcs = S.stockLedger
			.filter((r) => r.product === product && r.type === 'OUT')
			.reduce((s, r) => s + r.pcs, 0);
		const balPcs = inPcs - outPcs;
		const c = CONVERSION[product];
		const balPkt = Math.floor(balPcs / c.pcsPerPkt);
		const balBag = Math.floor(balPkt / c.pktPerBag);
		return {
			product,
			totalIn: inPcs,
			totalOut: outPcs,
			balancePcs: balPcs,
			balancePkt: balPkt,
			balanceBag: balBag,
		};
	});
}

function clearStockForm() {
	document.getElementById('stk-ref').value = '';
	document.getElementById('stk-qty').value = '';
	document.getElementById('stk-date').value = today();
}

async function loadStock() {
	if (!S.gasUrl) return;
	try {
		const [ledger, summary] = await Promise.all([
			api('getStock'),
			api('getStockSummary'),
		]);
		S.stockLedger = ledger || [];
		S.stockSummary = summary || [];
		renderStock();
		toast('Stock refreshed.');
	} catch (e) {
		toast('Refresh failed: ' + e.message, 'error');
	}
}

function filterLedger(type) {
	S.ledgerFilter = type;
	document.getElementById('lf-all').style.fontWeight =
		type === 'all' ? '600' : '400';
	document.getElementById('lf-in').style.fontWeight =
		type === 'IN' ? '600' : '400';
	document.getElementById('lf-out').style.fontWeight =
		type === 'OUT' ? '600' : '400';
	renderLedgerTable();
}

function renderStockSummaryCards() {
	['Regular Ceety', 'Small Ceety'].forEach((product) => {
		const prefix = product === 'Regular Ceety' ? 'stk-reg' : 'stk-sml';
		const data = (S.stockSummary || []).find((s) => s.product === product);

		if (!data) {
			['bag', 'pkt', 'pcs', 'in', 'out'].forEach((k) => {
				const el = document.getElementById(`${prefix}-${k}`);
				if (el) el.textContent = '—';
			});
			return;
		}

		document.getElementById(`${prefix}-bag`).textContent = Number(
			data.balanceBag,
		).toLocaleString('en-IN');
		document.getElementById(`${prefix}-pkt`).textContent = Number(
			data.balancePkt,
		).toLocaleString('en-IN');
		document.getElementById(`${prefix}-pcs`).textContent = Number(
			data.balancePcs,
		).toLocaleString('en-IN');
		document.getElementById(`${prefix}-in`).textContent = Number(
			data.totalIn,
		).toLocaleString('en-IN');
		document.getElementById(`${prefix}-out`).textContent = Number(
			data.totalOut,
		).toLocaleString('en-IN');

		const statusEl = document.getElementById(`${prefix}-status`);
		if (statusEl) {
			if (data.balancePcs <= 0) {
				statusEl.textContent = 'Out of Stock';
				statusEl.className = 'badge badge-red';
			} else {
				statusEl.textContent = 'In Stock';
				statusEl.className = 'badge badge-green';
			}
		}
	});
}

function renderLedgerTable() {
	const filter = S.ledgerFilter || 'all';
	const rows =
		filter === 'all'
			? S.stockLedger
			: S.stockLedger.filter((r) => r.type === filter);

	const tbody = document.getElementById('stock-body');
	if (!rows.length) {
		tbody.innerHTML = `<tr><td colspan="7" class="empty">No ${filter === 'all' ? '' : filter + ' '}transactions yet.</td></tr>`;
		return;
	}
	tbody.innerHTML = rows
		.map(
			(r) => `
    <tr>
      <td style="font-family:var(--mono);font-size:12px;">${r.date || '—'}</td>
      <td style="font-weight:500;">${r.reference}</td>
      <td><span class="badge ${r.type === 'IN' ? 'badge-green' : 'badge-red'}">${r.type}</span></td>
      <td style="color:var(--text2);">${r.product}</td>
      <td style="font-family:var(--mono);color:${r.type === 'IN' ? 'var(--accent)' : 'var(--danger)'};">${Number(r.pcs).toLocaleString('en-IN')}</td>
      <td style="font-family:var(--mono);">${Number(r.pkt).toLocaleString('en-IN')}</td>
      <td style="font-family:var(--mono);font-weight:600;">${Number(r.bag).toLocaleString('en-IN')}</td>
    </tr>
  `,
		)
		.join('');
}

function renderStock() {
	renderStockSummaryCards();
	renderLedgerTable();
}
