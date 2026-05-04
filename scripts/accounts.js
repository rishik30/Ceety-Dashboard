// ══════════════════════════════════════════════════════════════════════════════
//  ACCOUNTS
// ══════════════════════════════════════════════════════════════════════════════

const accTypes = {
	credit: 'credit',
	debit: 'debit',
};

function getAccountFormData() {
	const date = document.getElementById('acc-date').value;
	const desc = document.getElementById('acc-desc').value.trim();
	const type = document.getElementById('acc-type').value;
	const amount = parseFloat(document.getElementById('acc-amount').value) || 0;
	const category = document.getElementById('acc-category').value;
	const ref = document.getElementById('acc-ref').value.trim();

	return { date, desc, type, amount, category, ref };
}

function validateAccountEntry(entry) {
	if (!entry.date) {
		toast('Date is required.', 'error');
		return false;
	}
	if (!entry.desc) {
		toast('Description is required.', 'error');
		return false;
	}
	if (entry.amount <= 0) {
		toast('Enter a valid amount.', 'error');
		return false;
	}
	return true;
}

function submitAccountEntry() {
	if (S.editingAccountId) {
		updateAccountEntry();
		return;
	}
	addAccountEntry();
}

function getSortedAccounts() {
	return [...S.accounts].sort((a, b) => Number(b.id) - Number(a.id));
}

async function addAccountEntry() {
	const entry = getAccountFormData();

	if (!validateAccountEntry(entry)) return;

	entry.id = Date.now();
	entry.localOnly = true;
	S.accounts.unshift(entry);
	renderAccounts();
	clearAccForm();
	renderOverview();
	toast('Entry added!');

	if (S.gasUrl) {
		setLoading('acc-btn', true, 'Saving…');
		try {
			const result = await api('addAccountEntry', { data: entry });
			if (result.id) entry.id = result.id;
			entry.localOnly = false;
			renderAccounts();
			toast('Entry saved to Google Sheets!', 'success');
		} catch (e) {
			toast('Local save done. Sheet: ' + e.message, 'error');
		} finally {
			setLoading('acc-btn', false);
			document.getElementById('acc-btn').textContent = '+ Add Entry';
		}
	}
}

async function updateAccountEntry() {
	const updated = getAccountFormData();
	if (!validateAccountEntry(updated)) return;

	const id = S.editingAccountId;
	const idx = S.accounts.findIndex((a) => a.id === id);
	if (idx === -1) {
		toast('Could not find the entry to update.', 'error');
		return;
	}

	S.accounts[idx] = { ...S.accounts[idx], ...updated };
	renderAccounts();
	renderOverview();

	if (S.gasUrl && !S.accounts[idx].localOnly) {
		setLoading('acc-btn', true, 'Saving…');
		try {
			await api('updateAccount', { rowIndex: id, data: updated });
			toast('Entry updated in Google Sheets!', 'success');
		} catch (e) {
			toast('Local update done. Sheet: ' + e.message, 'error');
		} finally {
			setLoading('acc-btn', false);
			clearAccForm();
		}
		return;
	}

	clearAccForm();
	toast('Entry updated locally!', 'success');
}

function clearAccForm() {
	['acc-desc', 'acc-amount', 'acc-ref'].forEach(
		(id) => (document.getElementById(id).value = ''),
	);
	document.getElementById('acc-date').value = today();
	document.getElementById('acc-type').value = accTypes.credit;
	S.editingAccountId = null;
	const btn = document.getElementById('acc-btn');
	btn.textContent = '+ Add Entry';
	btn.dataset.label = '+ Add Entry';
}

async function loadAccounts() {
	if (!S.gasUrl) return;
	try {
		S.accounts = await api('getAccounts');
		renderAccounts();
		renderOverview();
		toast('Accounts refreshed.');
	} catch (e) {
		toast('Refresh failed: ' + e.message, 'error');
	}
}

async function deleteAccount(id, rowIndex) {
	const entry = S.accounts.find((a) => a.id === id);
	if (!entry) return;
	const shouldDelete = await confirmModal({
		title: 'Delete account entry',
		message: `Delete "${entry.desc}" for ${fmt(entry.amount)}? This will remove it from the sheet.`,
		confirmLabel: 'Delete Entry',
	});
	if (!shouldDelete) return;

	if (S.gasUrl && !entry.localOnly) {
		try {
			await api('deleteAccount', { rowIndex });
			S.accounts = await api('getAccounts');
			toast('Entry deleted from Google Sheets.', 'success');
		} catch (e) {
			toast('Sheet delete failed: ' + e.message, 'error');
			return;
		}
	} else {
		S.accounts = S.accounts.filter((a) => a.id !== id);
		toast('Entry deleted locally.', 'success');
	}
	renderAccounts();
	renderOverview();
	if (S.editingAccountId === id) clearAccForm();
}

function editAccount(id) {
	const entry = S.accounts.find((a) => a.id === id);
	if (!entry) return;

	S.editingAccountId = id;
	document.getElementById('acc-date').value = entry.date || today();
	document.getElementById('acc-desc').value = entry.desc || '';
	document.getElementById('acc-type').value = entry.type || accTypes.credit;
	document.getElementById('acc-amount').value = entry.amount || '';
	document.getElementById('acc-category').value = entry.category || 'Other';
	document.getElementById('acc-ref').value = entry.ref || '';

	const btn = document.getElementById('acc-btn');
	btn.textContent = 'Save Changes';
	btn.dataset.label = 'Save Changes';
	document.getElementById('acc-date').focus();
}

function renderAccounts() {
	const credits = S.accounts
		.filter((a) => a.type === accTypes.credit)
		.reduce((s, a) => s + a.amount, 0);
	const debits = S.accounts
		.filter((a) => a.type === accTypes.debit)
		.reduce((s, a) => s + a.amount, 0);
	const net = credits - debits;
	document.getElementById('acc-total-count').textContent = S.accounts.length;
	document.getElementById('acc-total-credit').textContent = fmt(credits);
	document.getElementById('acc-total-debit').textContent = fmt(debits);
	const el = document.getElementById('acc-net');
	el.textContent = fmt(net);
	el.className = 'stat-val ' + (net >= 0 ? 'green' : 'red');

	const tbody = document.getElementById('acc-body');
	if (!S.accounts.length) {
		tbody.innerHTML =
			'<tr><td colspan="7" class="empty">No entries yet.</td></tr>';
		return;
	}
	tbody.innerHTML = getSortedAccounts()
		.map(
			(a) => `
    <tr>
      <td>${fmtDate(a.date)}</td>
      <td style="font-weight:500;">${a.desc}</td>
      <td><span class="badge badge-warn">${a.category}</span></td>
      <td><span class="badge ${a.type === accTypes.credit ? 'badge-green' : 'badge-red'}">${a.type === accTypes.credit ? 'Credit' : 'Debit'}</span></td>
      <td style="font-family:var(--mono);font-weight:500;color:${a.type === accTypes.credit ? 'var(--accent)' : 'var(--danger)'};">${fmt(a.amount)}</td>
      <td style="color:var(--text2);font-size:12px;">${a.ref || '—'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="editAccount(${a.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAccount(${a.id},${a.id})">Del</button>
      </td>
    </tr>
  `,
		)
		.join('');
}
