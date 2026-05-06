// ══════════════════════════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════════════════════════
const S = {
	gasUrl: localStorage.getItem('ceety_gas_url') || '',
	online: false,
	challans: [],
	accounts: [],
	orders: [],
	stockLedger: [],
	stockSummary: [],
	items: [], // challan line items being built
	editingAccountId: null,
	orderSeq: 1,
	orderItems: [],
	orderOverheads: [],
	accPeriod: 'month',
};

// ── Restore saved URL ──
window.addEventListener('DOMContentLoaded', () => {
	if (S.gasUrl) {
		document.getElementById('gas-url').value = S.gasUrl;
		connectGAS();
	}
	document.getElementById('stk-date').value = today();
	initChallanForm();
	initOrderForm();
	renderOverview();
	document.getElementById('offline-banner').classList.add('show');
	setPeriod('month');
});
