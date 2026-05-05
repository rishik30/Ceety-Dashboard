// ══════════════════════════════════════════════════════════════════════════════
//  OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════

function renderOverview() {
	const revenue = S.challans.reduce((s, c) => s + c.total, 0);
	const credits = S.accounts
		.filter((a) => a.type === 'credit')
		.reduce((s, a) => s + a.amount, 0);
	const debits = S.accounts
		.filter((a) => a.type === 'debit')
		.reduce((s, a) => s + a.amount, 0);
	const balance = credits - debits;
	const pending = S.orders.filter((o) => o.status === 'pending').length;

	document.getElementById('stat-challans').textContent = S.challans.length;
	document.getElementById('stat-revenue').textContent = fmt(revenue);
	renderProfitSummary();
	document.getElementById('stat-stock').textContent = S.stockSummary.length
		? S.stockSummary.map((s) => s.balanceBag + ' bag').join(' / ')
		: '—';
	document.getElementById('stat-orders').textContent = pending;
	const balEl = document.getElementById('stat-balance');
	balEl.textContent = fmt(balance);
	balEl.className = 'stat-val ' + (balance >= 0 ? 'green' : 'red');

	const rc = document.getElementById('recent-challans');
	rc.innerHTML = S.challans.length
		? S.challans
				.slice(0, 6)
				.map(
					(c) => `
        <tr>
          <td style="font-family:var(--mono);font-size:12px;">${c.no}</td>
          <td style="font-weight:500;">${c.party}</td>
          <td>${fmtDate(c.date)}</td>
          <td style="font-family:var(--mono);color:var(--accent);">${fmt(c.total)}</td>
          <td><span class="badge badge-green">Generated</span></td>
        </tr>`,
				)
				.join('')
		: '<tr><td colspan="5" class="empty">No challans yet.</td></tr>';

	const ss = document.getElementById('stock-summary');
	ss.innerHTML = S.stockSummary.length
		? S.stockSummary
				.map(
					(s) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-weight:500;font-size:13px;">${s.product}</div>
            <div style="font-size:11px;color:var(--text3);font-family:var(--mono);">${Number(s.balancePcs).toLocaleString('en-IN')} pcs</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--mono);font-weight:600;color:${s.balancePcs <= 0 ? 'var(--danger)' : 'var(--accent)'};">${Number(s.balanceBag).toLocaleString('en-IN')} bag</div>
            <div style="font-size:11px;color:var(--text3);font-family:var(--mono);">${Number(s.balancePkt).toLocaleString('en-IN')} pkt</div>
          </div>
        </div>`,
				)
				.join('')
		: '<div class="empty">No stock data.</div>';

	const as = document.getElementById('account-summary');
	const accountRows =
		typeof getSortedAccounts === 'function' ? getSortedAccounts() : S.accounts;
	as.innerHTML = accountRows.length
		? accountRows
				.slice(0, 5)
				.map(
					(a) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:500;">${a.desc}</div><div style="font-size:11px;color:var(--text3);">${fmtDate(a.date)} · ${a.category}</div></div>
          <div style="font-family:var(--mono);font-weight:600;color:${a.type === 'credit' ? 'var(--accent)' : 'var(--danger)'};">${a.type === 'credit' ? '+' : '−'}${fmt(a.amount)}</div>
        </div>`,
				)
				.join('')
		: '<div class="empty">No entries.</div>';
}
