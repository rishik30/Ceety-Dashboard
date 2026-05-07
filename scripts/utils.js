// ══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function genChallanNo() {
	return '#C' + Math.random().toString(16).slice(2, 10).toUpperCase();
}

function genOrderNo() {
	if (!S.orders || !S.orders.length) return '#ORD0001';

	// Extract all existing sequence numbers
	const nums = S.orders
		.map((o) => {
			const match = String(o.no).match(/#ORD(\d+)/);
			return match ? parseInt(match[1], 10) : 0;
		})
		.filter((n) => !isNaN(n));

	const max = nums.length ? Math.max(...nums) : 0;
	return '#ORD' + String(max + 1).padStart(4, '0');
}

function fmt(n) {
	return (
		'₹' +
		Number(n).toLocaleString('en-IN', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})
	);
}

function parseAppDate(value) {
	if (!value) return null;
	if (value instanceof Date)
		return Number.isNaN(value.getTime()) ? null : value;

	const raw = String(value).trim();
	const ddmmyyyy = raw.match(
		/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
	);
	if (ddmmyyyy) {
		const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = ddmmyyyy;
		const year = yyyy.length === 2 ? Number(`20${yyyy}`) : Number(yyyy);
		return new Date(
			year,
			Number(mm) - 1,
			Number(dd),
			Number(hh),
			Number(min),
			Number(ss),
		);
	}

	const yyyymmdd = raw.match(
		/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
	);
	if (yyyymmdd) {
		const [, yyyy, mm, dd, hh = '0', min = '0', ss = '0'] = yyyymmdd;
		return new Date(
			Number(yyyy),
			Number(mm) - 1,
			Number(dd),
			Number(hh),
			Number(min),
			Number(ss),
		);
	}

	const parsed = new Date(raw);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fmtDate(d) {
	const date = parseAppDate(d);
	if (!date) return '—';
	return date.toLocaleDateString('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	});
}

function escapeHtml(value = '') {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function buildChallanItemsTooltip(items = []) {
	if (!items.length) return 'No items';
	return items
		.map((item) => {
			const desc = item.desc || item.product || 'Item';
			const qty = Number(item.qty) || 0;
			const unit = item.unit || 'pcs';
			const price = Number(item.price) || 0;
			const total = Number(item.total) || qty * price;
			return `${desc}: ${qty} ${unit} @ ${fmt(price)} = ${fmt(total)}`;
		})
		.join('\n');
}

function today() {
	const date = new Date();
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const dd = String(date.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

function setLoading(btnId, loading, label = '') {
	const btn = document.getElementById(btnId);
	if (!btn) return;
	btn.disabled = loading;
	if (loading) {
		btn.innerHTML = '<span class="spinner"></span> ' + label;
	} else {
		btn.textContent = btn.dataset.label || btn.textContent;
	}
}

function toast(msg, type = 'success') {
	const t = document.getElementById('toast');
	t.textContent = msg;
	t.className = 'toast show ' + type;
	setTimeout(() => t.classList.remove('show'), 3500);
}

function confirmModal({
	title = 'Confirm action',
	message,
	confirmLabel = 'Confirm',
}) {
	const modal = document.getElementById('confirm-modal');
	const titleEl = document.getElementById('confirm-title');
	const messageEl = document.getElementById('confirm-message');
	const cancelBtn = document.getElementById('confirm-cancel');
	const okBtn = document.getElementById('confirm-ok');

	titleEl.textContent = title;
	messageEl.textContent = message;
	okBtn.textContent = confirmLabel;
	modal.classList.add('show');
	modal.setAttribute('aria-hidden', 'false');
	okBtn.focus();

	return new Promise((resolve) => {
		const close = (value) => {
			modal.classList.remove('show');
			modal.setAttribute('aria-hidden', 'true');
			okBtn.removeEventListener('click', onConfirm);
			cancelBtn.removeEventListener('click', onCancel);
			modal.removeEventListener('click', onBackdrop);
			document.removeEventListener('keydown', onKeydown);
			resolve(value);
		};
		const onConfirm = () => close(true);
		const onCancel = () => close(false);
		const onBackdrop = (event) => {
			if (event.target === modal) close(false);
		};
		const onKeydown = (event) => {
			if (event.key === 'Escape') close(false);
		};

		okBtn.addEventListener('click', onConfirm);
		cancelBtn.addEventListener('click', onCancel);
		modal.addEventListener('click', onBackdrop);
		document.addEventListener('keydown', onKeydown);
	});
}

function calcPerPiecePriceFromItem(item) {
	// Detect product type from description
	const desc = (item.desc || '').toLowerCase();
	const isSmall = desc.includes('small');
	const conv = isSmall
		? CONVERSION['Small Ceety']
		: CONVERSION['Regular Ceety'];

	const unit = (item.unit || '').toLowerCase();
	let pcsInUnit = 1;

	if (unit === 'bag') pcsInUnit = conv.pktPerBag * conv.pcsPerPkt;
	if (unit === 'pkt') pcsInUnit = conv.pcsPerPkt;
	if (unit === 'pcs') pcsInUnit = 1;

	if (!pcsInUnit || !item.price) return null;
	return item.price / pcsInUnit;
}

function fmtPaise(n) {
	// Per-piece prices are tiny — show in paise if less than ₹1
	if (n === null || n === undefined) return '—';
	if (n < 1) return (n * 100).toFixed(0) + ' p'; // paise
	return '₹' + n.toFixed(4);
}
