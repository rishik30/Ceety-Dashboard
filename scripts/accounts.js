// ══════════════════════════════════════════════════════════════════════════════
//  ACCOUNTS
// ══════════════════════════════════════════════════════════════════════════════

// Presets
const ACC_PRESETS = {
	challan: {
		type: 'credit',
		category: 'Challan Payment',
		desc: 'Challan payment — ',
		ref: '',
	},
	supplier: {
		type: 'debit',
		category: 'Purchase',
		desc: 'Supplier payment — ',
		ref: '',
	},
	transport: {
		type: 'debit',
		category: 'Transport',
		desc: 'Transport charge — ',
		ref: '',
	},
	salary: { type: 'debit', category: 'Salary', desc: 'Salary — ', ref: '' },
	misc: {
		type: 'debit',
		category: 'Miscellaneous',
		desc: 'Misc expense — ',
		ref: '',
	},
};

function applyPreset(key) {
	const p = ACC_PRESETS[key];
	if (!p) return;
	document.getElementById('acc-type').value = p.type;
	document.getElementById('acc-category').value = p.category;
	document.getElementById('acc-desc').value = p.desc;
	document.getElementById('acc-ref').value = p.ref;
	document.getElementById('acc-form-title').textContent =
		'New Entry — ' + p.category;
	// Focus amount so user can type immediately
	document.getElementById('acc-amount').focus();
}

// Period filter state
S.accPeriod = 'month';

function setPeriod(period) {
	S.accPeriod = period;
	// Update active button style
	document
		.querySelectorAll('.acc-period-btn')
		.forEach((b) => b.classList.remove('active-period'));
	document.getElementById('period-' + period).classList.add('active-period');
	// Show/hide custom range inputs
	const customRange = document.getElementById('custom-range');
	customRange.style.display = period === 'custom' ? 'flex' : 'none';
	renderAccounts();
}

function getDateRange() {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();

	switch (S.accPeriod) {
		case 'month': {
			const from = new Date(year, month, 1);
			const to = new Date(year, month + 1, 0);
			return { from, to };
		}
		case 'lastmonth': {
			const from = new Date(year, month - 1, 1);
			const to = new Date(year, month, 0);
			return { from, to };
		}
		case 'year': {
			const from = new Date(year, 0, 1);
			const to = new Date(year, 11, 31);
			return { from, to };
		}
		case 'custom': {
			const fromVal = document.getElementById('acc-from')?.value;
			const toVal = document.getElementById('acc-to')?.value;
			return {
				from: fromVal ? new Date(fromVal) : null,
				to: toVal ? new Date(toVal) : null,
			};
		}
		default:
			return { from: null, to: null }; // all time
	}
}

function entryInRange(entry, from, to) {
	if (!from && !to) return true;
	if (!entry.date) return false;
	const d = new Date(entry.date + 'T00:00:00');
	if (from && d < from) return false;
	if (to && d > to) return false;
	return true;
}

async function addAccountEntry() {
	const date = document.getElementById('acc-date').value;
	const desc = document.getElementById('acc-desc').value.trim();
	const type = document.getElementById('acc-type').value;
	const amount = parseFloat(document.getElementById('acc-amount').value) || 0;
	const category = document.getElementById('acc-category').value;
	const ref = document.getElementById('acc-ref').value.trim();

	if (!date) {
		toast('Date is required.', 'error');
		return;
	}
	if (!desc) {
		toast('Description is required.', 'error');
		return;
	}
	if (amount <= 0) {
		toast('Enter a valid amount.', 'error');
		return;
	}

	const entry = { date, desc, type, amount, category, ref, id: Date.now() };
	S.accounts.unshift(entry);
	renderAccounts();
	clearAccForm();
	renderOverview();
	toast('Entry added!');

	if (S.gasUrl) {
		setLoading('acc-btn', true, 'Saving…');
		try {
			await api('addAccountEntry', { data: entry });
			toast('Entry saved to Google Sheets!', 'success');
		} catch (e) {
			toast('Local save done. Sheet: ' + e.message, 'error');
		} finally {
			setLoading('acc-btn', false);
			document.getElementById('acc-btn').textContent = '+ Add Entry';
		}
	}
}

function clearAccForm() {
	['acc-desc', 'acc-amount', 'acc-ref'].forEach(
		(id) => (document.getElementById(id).value = ''),
	);
	document.getElementById('acc-date').value = today();
	document.getElementById('acc-form-title').textContent = 'New Entry';
}

function clearAccFilters() {
	document.getElementById('acc-filter-type').value = 'all';
	document.getElementById('acc-filter-cat').value = 'all';
	document.getElementById('acc-search').value = '';
	document.getElementById('acc-from').value = '';
	document.getElementById('acc-to').value = '';
	setPeriod('all');
}

async function loadAccounts() {
	if (!S.gasUrl) return;
	try {
		S.accounts = (await api('getAccounts')) || [];
		renderAccounts();
		toast('Accounts refreshed.');
	} catch (e) {
		toast('Refresh failed: ' + e.message, 'error');
	}
}

async function deleteAccount(id, rowIndex) {
	S.accounts = S.accounts.filter((a) => a.id !== id);
	renderAccounts();
	renderOverview();
	if (S.gasUrl) {
		try {
			await api('deleteAccount', { rowIndex });
		} catch (e) {
			toast('Sheet delete failed: ' + e.message, 'error');
		}
	}
}

function renderAccounts() {
	// ── Overall totals (all time, no filters) ──
	const allCredits = S.accounts
		.filter((a) => a.type === 'credit')
		.reduce((s, a) => s + a.amount, 0);
	const allDebits = S.accounts
		.filter((a) => a.type === 'debit')
		.reduce((s, a) => s + a.amount, 0);
	const allNet = allCredits - allDebits;

	document.getElementById('acc-total-credit').textContent = fmt(allCredits);
	document.getElementById('acc-total-debit').textContent = fmt(allDebits);
	const netEl = document.getElementById('acc-net');
	netEl.textContent = fmt(allNet);
	netEl.className = 'stat-val ' + (allNet >= 0 ? 'green' : 'red');

	// ── Apply filters ──
	const { from, to } = getDateRange();
	const typeFilter = document.getElementById('acc-filter-type')?.value || 'all';
	const catFilter = document.getElementById('acc-filter-cat')?.value || 'all';
	const search = (
		document.getElementById('acc-search')?.value || ''
	).toLowerCase();

	const filtered = S.accounts.filter((a) => {
		if (!entryInRange(a, from, to)) return false;
		if (typeFilter !== 'all' && a.type !== typeFilter) return false;
		if (catFilter !== 'all' && a.category !== catFilter) return false;
		if (
			search &&
			!(
				(a.desc || '').toLowerCase().includes(search) ||
				(a.ref || '').toLowerCase().includes(search)
			)
		)
			return false;
		return true;
	});

	// ── Filtered totals ──
	const filteredCredits = filtered
		.filter((a) => a.type === 'credit')
		.reduce((s, a) => s + a.amount, 0);
	const filteredDebits = filtered
		.filter((a) => a.type === 'debit')
		.reduce((s, a) => s + a.amount, 0);
	const filteredNet = filteredCredits - filteredDebits;

	document.getElementById('acc-filtered-credit').textContent =
		fmt(filteredCredits);
	document.getElementById('acc-filtered-debit').textContent =
		fmt(filteredDebits);
	const filtNetEl = document.getElementById('acc-filtered-net');
	filtNetEl.textContent = fmt(filteredNet);
	filtNetEl.style.color = filteredNet >= 0 ? 'var(--accent)' : 'var(--danger)';

	document.getElementById('acc-row-count').textContent =
		filtered.length + ' of ' + S.accounts.length + ' entries';

	// ── Running balance ──
	// Sort filtered oldest→newest to calculate running balance correctly
	const sorted = [...filtered].sort((a, b) => {
		if (!a.date) return 1;
		if (!b.date) return -1;
		return new Date(a.date) - new Date(b.date);
	});

	// Calculate running balance starting from 0 within the filtered set
	let running = 0;
	const withBalance = sorted.map((a) => {
		running += a.type === 'credit' ? a.amount : -a.amount;
		return { ...a, runningBalance: running };
	});

	// Reverse back to newest-first for display
	const display = [...withBalance].reverse();

	// ── Render table ──
	const tbody = document.getElementById('acc-body');
	if (!display.length) {
		tbody.innerHTML =
			'<tr><td colspan="8" class="empty">No entries match your filters.</td></tr>';
		return;
	}

	tbody.innerHTML = display
		.map(
			(a) => `
    <tr>
      <td style="font-size:12px;white-space:nowrap;">${fmtDate(a.date)}</td>
      <td style="font-weight:500;">${a.desc}</td>
      <td><span class="badge badge-warn">${a.category}</span></td>
      <td>
        <span class="badge ${a.type === 'credit' ? 'badge-green' : 'badge-red'}">
          ${a.type === 'credit' ? 'Credit' : 'Debit'}
        </span>
      </td>
      <td style="font-family:var(--mono);font-weight:500;color:${a.type === 'credit' ? 'var(--accent)' : 'var(--danger)'};">
        ${a.type === 'credit' ? '+' : '−'}${fmt(a.amount)}
      </td>
      <td style="color:var(--text2);font-size:12px;">
        ${
					a.ref
						? `<span style="font-family:var(--mono);background:var(--surface2);padding:2px 7px;border-radius:4px;font-size:11px;">${a.ref}</span>`
						: '—'
				}
      </td>
      <td style="font-family:var(--mono);font-size:12px;font-weight:500;color:${a.runningBalance >= 0 ? 'var(--text)' : 'var(--danger)'};">
        ${fmt(a.runningBalance)}
      </td>
      <td>
        <button class="btn btn-danger btn-sm"
          onclick="deleteAccount(${a.id}, ${a.id})">Del</button>
      </td>
    </tr>
  `,
		)
		.join('');
}
