// ══════════════════════════════════════════════════════════════════════════════
//  PROFIT
// ══════════════════════════════════════════════════════════════════════════════

const PROFIT_CONVERSION = {
	'Regular Ceety': { pcsPerPkt: 1440, pktPerBag: 50 },
	'Small Ceety': { pcsPerPkt: 2880, pktPerBag: 50 },
};

const DEFAULT_COST_PER_PCS = {
	'Regular Ceety': 0.32,
	'Small Ceety': 0.32,
};

function getProductFromText(text = '') {
	return String(text).toLowerCase().includes('small')
		? 'Small Ceety'
		: 'Regular Ceety';
}

function toProfitPcs(qty, unit, product) {
	const c = PROFIT_CONVERSION[product] || PROFIT_CONVERSION['Regular Ceety'];
	const normalizedUnit = String(unit || 'pcs').toLowerCase();
	const n = Number(qty) || 0;

	if (normalizedUnit === 'bag') return n * c.pcsPerPkt * c.pktPerBag;
	if (normalizedUnit === 'pkt' || normalizedUnit === 'packet') {
		return n * c.pcsPerPkt;
	}
	return n;
}

function sortByDateAsc(rows) {
	return [...rows].sort((a, b) => {
		const ad = parseAppDate(a.date)?.getTime() || 0;
		const bd = parseAppDate(b.date)?.getTime() || 0;
		return ad - bd;
	});
}

function getStockPurchaseLots() {
	const ledgerLots = (S.stockLedger || [])
		.filter((row) => row.type === 'IN' && Number(row.pcs) > 0)
		.map((row) => {
			const product = getProductFromText(row.product);
			return {
				date: row.date,
				product,
				pcs: Number(row.pcs) || 0,
				remaining: Number(row.pcs) || 0,
				costPerPcs: Number(row.costRate) || DEFAULT_COST_PER_PCS[product],
				source: row.reference || 'Stock IN',
			};
		});

	if (ledgerLots.length) return sortByDateAsc(ledgerLots);

	const orderLots = [];
	(S.orders || []).forEach((order) => {
		const items = order.items || [];
		const subtotal =
			Number(order.subtotal) ||
			items.reduce((sum, item) => {
				return sum + (Number(item.total) || Number(item.qty) * Number(item.rate));
			}, 0);
		const overheadTotal = Number(order.overheadTotal) || 0;

		items.forEach((item) => {
			const product = getProductFromText(item.product || item.desc);
			const itemTotal =
				Number(item.total) || Number(item.qty) * Number(item.rate) || 0;
			const overheadShare =
				subtotal > 0 ? overheadTotal * (itemTotal / subtotal) : 0;
			const pcs = toProfitPcs(item.qty, item.unit, product);
			const costPerPcs =
				pcs > 0
					? (itemTotal + overheadShare) / pcs
					: DEFAULT_COST_PER_PCS[product];

			orderLots.push({
				date: order.delivery || order.date,
				product,
				pcs,
				remaining: pcs,
				costPerPcs,
				source: order.no,
			});
		});
	});

	return sortByDateAsc(orderLots);
}

function getChallanCostMap() {
	const lots = getStockPurchaseLots();
	const available = {
		'Regular Ceety': [],
		'Small Ceety': [],
	};
	const latestCost = { ...DEFAULT_COST_PER_PCS };
	const costs = {};
	let lotIndex = 0;

	sortByDateAsc(S.challans || []).forEach((challan) => {
		const challanDate = parseAppDate(challan.date) || new Date(0);
		while (lotIndex < lots.length) {
			const lotDate = parseAppDate(lots[lotIndex].date) || new Date(0);
			if (lotDate > challanDate) break;
			const lot = { ...lots[lotIndex] };
			available[lot.product].push(lot);
			latestCost[lot.product] = lot.costPerPcs;
			lotIndex += 1;
		}

		let cost = 0;
		(challan.items || []).forEach((item) => {
			const product = getProductFromText(item.product || item.desc);
			let remainingPcs = toProfitPcs(item.qty, item.unit, product);

			while (remainingPcs > 0 && available[product].length) {
				const lot = available[product][0];
				const usedPcs = Math.min(remainingPcs, lot.remaining);
				cost += usedPcs * lot.costPerPcs;
				lot.remaining -= usedPcs;
				remainingPcs -= usedPcs;
				if (lot.remaining <= 0) available[product].shift();
			}

			if (remainingPcs > 0) {
				cost += remainingPcs * latestCost[product];
			}
		});

		costs[challan.no] = cost;
	});

	return costs;
}

function getChallanProfit(challan, costMap = getChallanCostMap()) {
	const cost = Number(costMap[challan.no]) || 0;
	const revenue = Number(challan.total) || 0;
	const profit = revenue - cost;
	const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

	return { revenue, cost, profit, margin };
}

function getProfitDateRange() {
	return {
		from: document.getElementById('profit-from')?.value || '',
		to: document.getElementById('profit-to')?.value || '',
	};
}

function isInProfitRange(challan, range = getProfitDateRange()) {
	const date = parseAppDate(challan.date);
	if (!date) return false;

	if (range.from) {
		const from = parseAppDate(range.from);
		if (from && date < from) return false;
	}
	if (range.to) {
		const to = parseAppDate(range.to);
		if (to) {
			to.setHours(23, 59, 59, 999);
			if (date > to) return false;
		}
	}
	return true;
}

function getProfitSummary(range = getProfitDateRange()) {
	const costMap = getChallanCostMap();
	return S.challans
		.filter((challan) => isInProfitRange(challan, range))
		.reduce(
			(summary, challan) => {
				const result = getChallanProfit(challan, costMap);
				summary.count += 1;
				summary.revenue += result.revenue;
				summary.cost += result.cost;
				summary.profit += result.profit;
				return summary;
			},
			{ count: 0, revenue: 0, cost: 0, profit: 0 },
		);
}

function renderProfitSummary() {
	const summary = getProfitSummary();
	const profitEl = document.getElementById('stat-profit');
	const countEl = document.getElementById('profit-count');
	const revenueEl = document.getElementById('profit-revenue');
	const costEl = document.getElementById('profit-cost');
	const totalEl = document.getElementById('profit-total');

	if (!profitEl || !countEl || !revenueEl || !costEl || !totalEl) return;

	profitEl.textContent = fmt(summary.profit);
	profitEl.className = 'stat-val ' + (summary.profit >= 0 ? 'green' : 'red');
	countEl.textContent = summary.count;
	revenueEl.textContent = fmt(summary.revenue);
	costEl.textContent = fmt(summary.cost);
	totalEl.textContent = fmt(summary.profit);
	totalEl.className = 'stat-val ' + (summary.profit >= 0 ? 'green' : 'red');
}

function clearProfitRange() {
	document.getElementById('profit-from').value = '';
	document.getElementById('profit-to').value = '';
	renderOverview();
}
