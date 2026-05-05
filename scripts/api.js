// ══════════════════════════════════════════════════════════════════════════════
//  APPS SCRIPT API
// ══════════════════════════════════════════════════════════════════════════════

async function api(action, extra = {}) {
	if (!S.gasUrl) throw new Error('No Apps Script URL configured.');
	const body = JSON.stringify({ action, ...extra });
	const res = await fetch(S.gasUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'text/plain' }, // GAS requires text/plain for cross-origin POST
		body,
	});
	const json = await res.json();
	if (json.error) throw new Error(json.error);
	return json;
}

async function connectGAS() {
	const url = document.getElementById('gas-url').value.trim();
	if (!url) {
		toast('Paste your Web App URL first.', 'error');
		return;
	}
	S.gasUrl = url;
	localStorage.setItem('ceety_gas_url', url);
	setSyncState('syncing', 'Connecting…');
	try {
		await syncAll();
		setSyncState('connected', 'Synced');
		document.getElementById('offline-banner').classList.remove('show');
	} catch (e) {
		setSyncState('error', 'Connection failed');
		toast('Could not connect: ' + e.message, 'error');
	}
}

async function syncAll() {
	setSyncState('syncing', 'Syncing…');
	try {
		const data = await api('bootstrap');
		console.log('Bootstrap data:', data);
		S.challans = data.challans || [];
		S.accounts = data.accounts || [];
		S.orders = data.orders || [];
		S.stockLedger = data.stockLedger || [];
		S.stockSummary = data.stockSummary || [];
		S.online = true;
		setSyncState(
			'connected',
			'Synced ' +
				new Date().toLocaleTimeString('en-IN', {
					hour: '2-digit',
					minute: '2-digit',
				}),
		);
		renderAll();

		// Reinit order form now that S.orders is populated
		initOrderForm();

		toast('Synced with Google Sheets!', 'success');
	} catch (e) {
		setSyncState('error', 'Sync failed');
		toast('Sync error: ' + e.message, 'error');
	}
}

function setSyncState(state, label) {
	const dot = document.getElementById('sync-dot');
	const lbl = document.getElementById('sync-label');
	dot.className = 'sync-dot ' + state;
	lbl.textContent = label;
}
