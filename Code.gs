// ═══════════════════════════════════════════════════════════════════════════════
//  CEETY BUSINESS DASHBOARD — Google Apps Script Backend
//  Paste this entire file into your Apps Script project (Extensions → Apps Script)
//  Then deploy as a Web App (Execute as: Me, Access: Anyone)
// ═══════════════════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1jwQMliZVGroGut2HtSmhN9ANODjpnWdDCchAHx_OV9Q';

// Sheet name constants — edit if your tab names differ
const SHEETS = {
	CHALLAN_TEMPLATE: 'Challan Template',
	CHALLAN_DB: 'Challan Database',
	ACCOUNT: 'Account',
	ORDER_BOOK: 'Order Book',
	STOCK: 'Stock',
	STOCK_LEDGER: 'Stock Ledger',
	STOCK_SUMMARY: 'Stock Summary',
};

// ── Conversion constants ─────────────────────────────────────────────────────
const CONVERSION = {
	'Regular Ceety': { pcsPerPkt: 1440, pktPerBag: 50 },
	'Small Ceety': { pcsPerPkt: 2880, pktPerBag: 50 },
};

const LEDGER_HEADERS = [
	'Date',
	'Reference',
	'Type',
	'Product',
	'Pcs',
	'Pkt',
	'Bag',
	'Cost Rate / Pc',
];
const SUMMARY_HEADERS = [
	'Product',
	'Total IN (Pcs)',
	'Total OUT (Pcs)',
	'Balance (Pcs)',
	'Balance (Pkt)',
	'Balance (Bag)',
];
const PRODUCTS = ['Regular Ceety', 'Small Ceety'];

// ─── Challan Database column layout (row 1 = headers) ───────────────────────
// A=Challan#  B=Date  C=Party  D=Company  E=Items(JSON)  F=Subtotal  G=Adjustment  H=Total  I=Notes  J=CreatedAt
const DB_HEADERS = [
	'Challan #',
	'Date',
	'Party',
	'Company',
	'Items (JSON)',
	'Subtotal',
	'Adjustment',
	'Total',
	'Notes',
	'Created At',
];

// ─── Account column layout ───────────────────────────────────────────────────
// A=Date  B=Description  C=Category  D=Type  E=Amount  F=Reference  G=CreatedAt
const ACC_HEADERS = [
	'Date',
	'Description',
	'Category',
	'Type',
	'Amount',
	'Reference',
	'Created At',
];

// ─── Order Book column layout ────────────────────────────────────────────────
// A=Order#  B=Date  C=Party  D=Company  E=Description  F=Qty  G=Unit  H=Status  I=Notes  J=CreatedAt
const ORD_HEADERS = [
	'Order #',
	'Order Date',
	'Expected Delivery',
	'Supplier',
	'Items (JSON)',
	'Overhead (JSON)',
	'Subtotal',
	'Overhead Total',
	'Total Amount',
	'Amount Paid',
	'Amount Due',
	'Payment Date',
	'Status',
	'Notes',
];

// ═══════════════════════════════════════════════════════════════════════════════
//  WEB APP ENTRY POINTS
// ═══════════════════════════════════════════════════════════════════════════════

function doGet(e) {
	return ContentService.createTextOutput(
		JSON.stringify({ status: 'ok', message: 'Ceety API is running' }),
	).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
	try {
		const payload = JSON.parse(e.postData.contents);
		const action = payload.action;
		let result;

		switch (action) {
			// ── Challan ──────────────────────────────────────────────
			case 'createChallan':
				result = createChallan(payload.data);
				break;
			case 'getChallans':
				result = getChallans();
				break;
			case 'deleteChallan':
				result = deleteChallan(payload.no);
				break;

			// ── Account ──────────────────────────────────────────────
			case 'addAccountEntry':
				result = addAccountEntry(payload.data);
				break;
			case 'getAccounts':
				result = getAccounts();
				break;
			case 'updateAccount':
				result = updateAccount(payload.rowIndex, payload.data);
				break;
			case 'deleteAccount':
				result = deleteAccount(payload.rowIndex);
				break;

			// ── Orders ───────────────────────────────────────────────
			case 'addOrder':
				result = addOrder(payload.data);
				break;
			case 'getOrders':
				result = getOrders();
				break;
			case 'updateOrderStatus':
				result = updateOrderStatus(payload.no, payload.status);
				break;
			case 'deleteOrder':
				result = deleteOrder(payload.no);
				break;
			case 'updateOrderPayment':
				result = updateOrderPayment(
					payload.no,
					payload.paid,
					payload.due,
					payload.status,
				);
				break;

			// ── Stock ────────────────────────────────────────────────
			case 'addStock':
				result = addStock(payload.data);
				break;
			case 'getStockSummary':
				result = getStockSummary();
				break;
			case 'getStockLedger':
				result = getStock();
				break;
			case 'deleteStock':
				result = { error: 'Deletion not supported in ledger mode' };
				break;

			// ── Bootstrap (load everything at once) ──────────────────
			case 'bootstrap':
				result = bootstrap();
				break;

			default:
				result = { error: 'Unknown action: ' + action };
		}

		return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
			ContentService.MimeType.JSON,
		);
	} catch (err) {
		return ContentService.createTextOutput(
			JSON.stringify({ error: err.message, stack: err.stack }),
		).setMimeType(ContentService.MimeType.JSON);
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getSheet(name) {
	const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
	let sheet = ss.getSheetByName(name);
	if (!sheet) {
		sheet = ss.insertSheet(name);
	}
	return sheet;
}

/** Ensure a sheet has the expected header row; write it if row 1 is empty. */
function ensureHeaders(sheet, headers) {
	const firstCell = sheet.getRange(1, 1).getValue();
	if (!firstCell || firstCell !== headers[0]) {
		sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
		sheet
			.getRange(1, 1, 1, headers.length)
			.setFontWeight('bold')
			.setBackground('#0F2D20')
			.setFontColor('#FFFFFF');
		sheet.setFrozenRows(1);
	}
}

function ensureStockLedgerCostHeader(sheet) {
	if (!sheet) return;
	if (sheet.getRange(1, 8).getValue() !== LEDGER_HEADERS[7]) {
		sheet.getRange(1, 8).setValue(LEDGER_HEADERS[7]);
		sheet
			.getRange(1, 8)
			.setFontWeight('bold')
			.setBackground('#0F2D20')
			.setFontColor('#FFFFFF');
	}
}

/** Return all data rows (skipping header) as array of objects keyed by header. */
function sheetToObjects(sheet, headers) {
	const lastRow = sheet.getLastRow();
	if (lastRow < 2) return [];
	const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
	return data
		.filter((row) => row[0] !== '' && row[0] !== null && row[0] !== undefined)
		.map((row) => {
			const obj = {};
			headers.forEach((h, i) => (obj[h] = row[i]));
			return obj;
		});
}

function nowISO() {
	return new Date().toISOString();
}

function formatDateForSheet(dateStr) {
	// const date = !dateStr ? new Date() : new Date(dateStr);
	// const d = Utilities.formatDate(date, "Asia/Kolkata", "yyyy-MM-dd");
	// return d;
	// Use noon to avoid Sheets/browser timezone shifts moving the selected date
	// to the previous calendar day.
	if (!dateStr) return new Date();
	const [y, m, d] = dateStr.split('-').map(Number);
	return new Date(y, m - 1, d, 12, 0, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHALLAN OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function createChallan(data) {
	// 1. Write to Challan Database
	const dbSheet = getSheet(SHEETS.CHALLAN_DB);
	ensureHeaders(dbSheet, DB_HEADERS);

	// Safely extract date string — handle undefined, null, or full datetime
	const rawDate = data.date || '';
	const dateStr = String(rawDate).substring(0, 10); // safely get YYYY-MM-DD part

	const row = [
		data.no,
		formatDateForSheet(data.date),
		data.party,
		data.company || '',
		JSON.stringify(data.items),
		data.subtotal,
		data.adj,
		data.total,
		data.notes || '',
		nowISO(),
	];
	dbSheet.appendRow(row);

	// Format the date column
	const lastRow = dbSheet.getLastRow();
	dbSheet.getRange(lastRow, 2).setNumberFormat('DD/MM/YYYY');
	dbSheet.getRange(lastRow, 6, 1, 3).setNumberFormat('₹#,##0.00');

	// Alternate row shading
	if (lastRow % 2 === 0) {
		dbSheet.getRange(lastRow, 1, 1, DB_HEADERS.length).setBackground('#F5F3EE');
	}

	// Write challan to its own named tab (like MANJEET CHALLAN pattern)
	// writeChallanTab(data);

	// Deduct stock — pass validated dateStr, never raw data.date
	deductStockForChallan(data.no, dateStr, data.items || []);

	return { success: true, no: data.no };
}

/** Create / overwrite a dedicated challan tab for the party */
function writeChallanTab(data) {
	const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
	const tabName = data.party.toUpperCase().split(' ')[0] + ' CHALLAN';

	let sheet = ss.getSheetByName(tabName);
	if (!sheet) sheet = ss.insertSheet(tabName);
	else sheet.clearContents();

	// ── Header block ──
	sheet
		.getRange('A1:J1')
		.merge()
		.setValue('CEETY')
		.setFontSize(20)
		.setFontWeight('bold')
		.setHorizontalAlignment('center')
		.setBackground('#0F2D20')
		.setFontColor('#FFFFFF');
	sheet
		.getRange('A2:J2')
		.merge()
		.setValue('Delivery Challan')
		.setFontSize(11)
		.setHorizontalAlignment('center')
		.setBackground('#0F2D20')
		.setFontColor('#9FE1CB');

	sheet.getRange('B4').setValue('Challan');
	sheet.getRange('B5').setValue(data.no).setFontWeight('bold').setFontSize(13);

	sheet.getRange('D4').setValue('Date');
	sheet
		.getRange('D5')
		.setValue(formatDateForSheet(data.date))
		.setNumberFormat('DD/MM/YYYY');

	sheet.getRange('B7').setValue('Challan for');
	sheet.getRange('B8').setValue(data.party).setFontWeight('bold');
	sheet.getRange('B9').setValue(data.company || '');

	if (data.notes) {
		sheet.getRange('B10').setValue('Notes:').setFontWeight('bold');
		sheet.getRange('C10:I10').merge().setValue(data.notes);
	}

	// ── Items table header ──
	const tableRow = 12;
	const tableHeaders = [
		'Description',
		'',
		'',
		'Qty',
		'Unit',
		'Pcs/Unit',
		'Unit Price',
		'Total Price',
		'',
	];
	sheet
		.getRange(tableRow, 2, 1, tableHeaders.length)
		.setValues([tableHeaders])
		.setFontWeight('bold')
		.setBackground('#0F2D20')
		.setFontColor('#FFFFFF');

	// ── Items ──
	data.items.forEach((item, idx) => {
		const r = tableRow + 1 + idx;
		sheet.getRange(r, 2).setValue(item.desc);
		sheet.getRange(r, 5).setValue(item.qty);
		sheet.getRange(r, 6).setValue(item.unit);
		sheet.getRange(r, 7).setValue(item.pcsUnit || '');
		sheet.getRange(r, 8).setValue(item.price).setNumberFormat('₹#,##0.00');
		sheet
			.getRange(r, 9)
			.setValue(item.qty * item.price)
			.setNumberFormat('₹#,##0.00');
	});

	// ── Totals ──
	const afterItems = tableRow + 1 + data.items.length + 1;
	sheet.getRange(afterItems, 8).setValue('Subtotal').setFontWeight('bold');
	sheet
		.getRange(afterItems, 9)
		.setValue(data.subtotal)
		.setNumberFormat('₹#,##0.00');
	sheet
		.getRange(afterItems + 1, 8)
		.setValue('Adjustments')
		.setFontWeight('bold');
	sheet
		.getRange(afterItems + 1, 9)
		.setValue(data.adj)
		.setNumberFormat('₹#,##0.00');
	sheet
		.getRange(afterItems + 2, 8)
		.setValue('Total')
		.setFontWeight('bold')
		.setFontSize(12);
	sheet
		.getRange(afterItems + 2, 9)
		.setValue(data.total)
		.setNumberFormat('₹#,##0.00')
		.setFontWeight('bold')
		.setFontSize(12)
		.setFontColor('#1D6A45');

	sheet.autoResizeColumns(1, 10);
}

function getChallans() {
	const sheet = getSheet(SHEETS.CHALLAN_DB);
	ensureHeaders(sheet, DB_HEADERS);
	const rows = sheetToObjects(sheet, DB_HEADERS);
	return rows.map((r) => ({
		no: r['Challan #'],
		date: r['Date']
			? Utilities.formatDate(
					new Date(r['Date']),
					Session.getScriptTimeZone(),
					'yyyy-MM-dd',
				)
			: '',
		party: r['Party'],
		company: r['Company'],
		items: safeParseJSON(r['Items (JSON)'], []),
		subtotal: Number(r['Subtotal']),
		adj: Number(r['Adjustment']),
		total: Number(r['Total']),
		notes: r['Notes'],
		createdAt: r['Created At'],
	}));
}

function deleteChallan(no) {
	const sheet = getSheet(SHEETS.CHALLAN_DB);
	const data = sheet.getDataRange().getValues();
	for (let i = data.length - 1; i >= 1; i--) {
		if (String(data[i][0]) === String(no)) {
			sheet.deleteRow(i + 1);
			return { success: true };
		}
	}
	return { error: 'Challan not found: ' + no };
}

function safeParseJSON(str, fallback) {
	try {
		return JSON.parse(str);
	} catch (_) {
		return fallback;
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ACCOUNT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function addAccountEntry(data) {
	const sheet = getSheet(SHEETS.ACCOUNT);
	ensureHeaders(sheet, ACC_HEADERS);

	const row = [
		formatDateForSheet(data.date),
		data.desc,
		data.category,
		data.type,
		Number(data.amount),
		data.ref || '',
		nowISO(),
	];
	sheet.appendRow(row);

	const lastRow = sheet.getLastRow();
	sheet.getRange(lastRow, 1).setNumberFormat('DD/MM/YYYY');
	sheet.getRange(lastRow, 5).setNumberFormat('₹#,##0.00');
	sheet
		.getRange(lastRow, 5)
		.setFontColor(data.type === 'credit' ? '#1D6A45' : '#C53030');
	if (lastRow % 2 === 0)
		sheet.getRange(lastRow, 1, 1, ACC_HEADERS.length).setBackground('#F5F3EE');

	return { success: true, id: lastRow };
}

function getAccounts() {
	const sheet = getSheet(SHEETS.ACCOUNT);
	ensureHeaders(sheet, ACC_HEADERS);
	const rows = sheetToObjects(sheet, ACC_HEADERS);
	return rows.map((r, idx) => ({
		id: idx + 2, // row index in sheet
		date: r['Date']
			? Utilities.formatDate(
					new Date(r['Date']),
					Session.getScriptTimeZone(),
					'yyyy-MM-dd',
				)
			: '',
		desc: r['Description'],
		category: r['Category'],
		type: String(r['Type'] || '').toLowerCase(),
		amount: Number(r['Amount']),
		ref: r['Reference'],
	}));
}

function deleteAccount(rowIndex) {
	const sheet = getSheet(SHEETS.ACCOUNT);
	if (rowIndex < 2) return { error: 'Invalid row' };
	sheet.deleteRow(rowIndex);
	return { success: true };
}

function updateAccount(rowIndex, data) {
	const sheet = getSheet(SHEETS.ACCOUNT);
	ensureHeaders(sheet, ACC_HEADERS);

	if (rowIndex < 2 || rowIndex > sheet.getLastRow()) {
		return { error: 'Invalid row' };
	}

	const row = [
		formatDateForSheet(data.date),
		data.desc,
		data.category,
		data.type,
		Number(data.amount),
		data.ref || '',
		nowISO(),
	];

	sheet.getRange(rowIndex, 1, 1, ACC_HEADERS.length).setValues([row]);
	sheet.getRange(rowIndex, 1).setNumberFormat('DD/MM/YYYY');
	sheet.getRange(rowIndex, 5).setNumberFormat('₹#,##0.00');
	sheet
		.getRange(rowIndex, 5)
		.setFontColor(data.type === 'credit' ? '#1D6A45' : '#C53030');
	const d = sheet.getRange(rowIndex, 1, 1).getValues()[0];
	return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════════
//  ORDERS (PURCHASE)
// ══════════════════════════════════════════════════════════════════════════════

function addOrder(data) {
	const sheet = getSheet(SHEETS.ORDER_BOOK);
	ensureHeaders(sheet, ORD_HEADERS);

	// Prefix JSON with a single quote to force Sheets to treat as plain text
	// This prevents the [ character from being interpreted as a formula
	const itemsJSON = "'" + JSON.stringify(data.items || []);
	const overheadJSON = "'" + JSON.stringify(data.overheads || []);

	const row = [
		data.no, // A Order #
		formatDateForSheet(data.date), // B Order Date
		data.delivery ? formatDateForSheet(data.delivery) : '', // C Expected Delivery
		data.supplier || '', // D Supplier
		itemsJSON, // E Items (JSON)
		overheadJSON, // F Overhead (JSON)
		Number(data.subtotal || 0), // G Subtotal
		Number(data.overheadTotal || 0), // H Overhead Total
		Number(data.total || 0), // I Total Amount
		Number(data.paid || 0), // J Amount Paid
		Number(data.due || 0), // K Amount Due
		data.paymentDate ? formatDateForSheet(data.paymentDate) : '', // L Payment Date
		data.status || '', // M Status
		data.notes || '', // N Notes
	];

	sheet.appendRow(row);

	const lastRow = sheet.getLastRow();

	// Format date columns as plain text
	sheet.getRange(lastRow, 2).setNumberFormat('@STRING@'); // B Order Date
	sheet.getRange(lastRow, 3).setNumberFormat('@STRING@'); // C Expected Delivery
	sheet.getRange(lastRow, 12).setNumberFormat('@STRING@'); // L Payment Date

	// Format currency columns G to K
	sheet.getRange(lastRow, 7, 1, 5).setNumberFormat('₹#,##0.00');

	// Alternate row shading
	if (lastRow % 2 === 0) {
		sheet.getRange(lastRow, 1, 1, ORD_HEADERS.length).setBackground('#F5F3EE');
	}

	return { success: true, no: data.no };
}

function updateOrderPayment(no, paid, due, status) {
	const sheet = getSheet(SHEETS.ORDER_BOOK);
	const values = sheet.getDataRange().getValues();
	for (let i = 1; i < values.length; i++) {
		if (String(values[i][0]) === String(no)) {
			sheet.getRange(i + 1, 10).setValue(paid); // Amount Paid   (col J)
			sheet.getRange(i + 1, 11).setValue(due); // Amount Due    (col K)
			sheet.getRange(i + 1, 13).setValue(status); // Status        (col M)
			return { success: true };
		}
	}
	return { error: 'Order not found: ' + no };
}

function getOrders() {
	const sheet = getSheet(SHEETS.ORDER_BOOK);
	ensureHeaders(sheet, ORD_HEADERS);

	const lastRow = sheet.getLastRow();
	if (lastRow < 2) return [];

	// Read headers from row 1 to map columns dynamically
	// This avoids breaking if column order ever shifts
	const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
	const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

	return data
		.filter((row) => row[0] !== '' && row[0] !== null)
		.map((row) => {
			// Build object dynamically from actual headers in the sheet
			const r = {};
			headers.forEach((h, i) => (r[h] = row[i]));

			const itemsRaw = String(r['Items (JSON)'] || '[]').replace(/^'/, '');
			const overheadRaw = String(r['Overhead (JSON)'] || '[]').replace(
				/^'/,
				'',
			);

			const rToReturn = {
				no: r['Order #'] || '',
				date: r['Order Date'] ? String(r['Order Date']) : '',
				delivery: r['Expected Delivery'] ? String(r['Expected Delivery']) : '',
				supplier: r['Supplier'] || '',
				items: safeParseJSON(itemsRaw, []),
				overheads: safeParseJSON(overheadRaw, []),
				subtotal: Number(r['Subtotal'] || 0),
				overheadTotal: Number(r['Overhead Total'] || 0),
				total: Number(r['Total Amount'] || 0),
				paid: Number(r['Amount Paid'] || 0),
				due: Number(r['Amount Due'] || 0),
				paymentDate: r['Payment Date'] ? String(r['Payment Date']) : '',
				status: r['Status'] || '',
				notes: r['Notes'] || '',
			};

			return rToReturn;
		});
}

function updateOrderStatus(no, status) {
	const sheet = getSheet(SHEETS.ORDER_BOOK);
	const values = sheet.getDataRange().getValues();

	for (let i = 1; i < values.length; i++) {
		if (String(values[i][0]) === String(no)) {
			// Find the Status column index dynamically from headers
			const headers = values[0];
			const statusColIdx = headers.indexOf('Status');
			if (statusColIdx === -1)
				return { error: 'Status column not found in sheet' };

			sheet.getRange(i + 1, statusColIdx + 1).setValue(status);
			return { success: true, no, status };
		}
	}
	return { error: 'Order not found: ' + no };
}

function deleteOrder(no) {
	const sheet = getSheet(SHEETS.ORDER_BOOK);
	const values = sheet.getDataRange().getValues();

	for (let i = values.length - 1; i >= 1; i--) {
		if (String(values[i][0]) === String(no)) {
			sheet.deleteRow(i + 1);
			return { success: true, no };
		}
	}
	return { error: 'Order not found: ' + no };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BOOTSTRAP — Load all data in one call
// ═══════════════════════════════════════════════════════════════════════════════

function bootstrap() {
	return {
		challans: getChallans(),
		accounts: getAccounts(),
		orders: getOrders(),
		stockLedger: getStock(),
		stockSummary: getStockSummary(),
	};
}

function testBootstrap() {
	const result = bootstrap();
	console.log('ORDERS IN BOOTSTRAP: ' + JSON.stringify(result.orders));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SETUP — Run once manually to initialise all sheets
// ═══════════════════════════════════════════════════════════════════════════════

function setupSheets() {
	const dbSheet = getSheet(SHEETS.CHALLAN_DB);
	const accSheet = getSheet(SHEETS.ACCOUNT);
	const ordSheet = getSheet(SHEETS.ORDER_BOOK);

	ensureHeaders(dbSheet, DB_HEADERS);
	ensureHeaders(accSheet, ACC_HEADERS);
	ensureHeaders(ordSheet, ORD_HEADERS);

	[dbSheet, accSheet, ordSheet].forEach((s) => {
		s.autoResizeColumns(1, 10);
		s.setFrozenRows(1);
	});

	// ← removed getUi().alert()
	Logger.log('✅ Ceety sheets initialised successfully!');
	return { success: true, message: 'All sheets initialised' };
}

// ── Setup — run once manually ─────────────────────────────────────────────────
function setupStockSheets() {
	const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

	// ── Stock Ledger ──
	let ledger = ss.getSheetByName(SHEETS.STOCK_LEDGER);
	if (!ledger) ledger = ss.insertSheet(SHEETS.STOCK_LEDGER);
	ledger.clearContents();

	ledger
		.getRange(1, 1, 1, LEDGER_HEADERS.length)
		.setValues([LEDGER_HEADERS])
		.setFontWeight('bold')
		.setBackground('#0F2D20')
		.setFontColor('#FFFFFF');
	ledger.setFrozenRows(1);

	migrateOldStockData(ledger);

	// ── Stock Summary ──
	let summary = ss.getSheetByName(SHEETS.STOCK_SUMMARY);
	if (!summary) summary = ss.insertSheet(SHEETS.STOCK_SUMMARY);
	summary.clearContents();

	summary
		.getRange(1, 1, 1, SUMMARY_HEADERS.length)
		.setValues([SUMMARY_HEADERS])
		.setFontWeight('bold')
		.setBackground('#0F2D20')
		.setFontColor('#FFFFFF');
	summary.setFrozenRows(1);

	PRODUCTS.forEach((product, idx) => {
		const row = idx + 2;
		const pcsPerPkt = CONVERSION[product].pcsPerPkt;
		const pktPerBag = CONVERSION[product].pktPerBag;

		summary.getRange(row, 1).setValue(product).setFontWeight('bold');
		summary
			.getRange(row, 2)
			.setFormula(
				`=SUMIFS('Stock Ledger'!E:E,'Stock Ledger'!C:C,"IN",'Stock Ledger'!D:D,A${row})`,
			);
		summary
			.getRange(row, 3)
			.setFormula(
				`=SUMIFS('Stock Ledger'!E:E,'Stock Ledger'!C:C,"OUT",'Stock Ledger'!D:D,A${row})`,
			);
		summary.getRange(row, 4).setFormula(`=B${row}-C${row}`);
		summary.getRange(row, 5).setFormula(`=INT(D${row}/${pcsPerPkt})`);
		summary.getRange(row, 6).setFormula(`=INT(E${row}/${pktPerBag})`);
		summary.getRange(row, 2, 1, 5).setNumberFormat('#,##0');
	});

	summary.autoResizeColumns(1, SUMMARY_HEADERS.length);
	ledger.autoResizeColumns(1, LEDGER_HEADERS.length);

	// ← replaced getUi().alert() with Logger.log()
	Logger.log('✅ Stock Ledger and Stock Summary sheets created successfully!');
	return { success: true, message: 'Stock sheets initialised successfully' };
}

// ── Migrate old Stock tab data into new Ledger format ────────────────────────
function migrateOldStockData(ledger) {
	const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
	const oldSheet = ss.getSheetByName('Stock');
	if (!oldSheet) return;

	const data = oldSheet.getDataRange().getValues();
	const newRows = [];

	// Skip header row (row 0), start from row 1
	for (let i = 1; i < data.length; i++) {
		const row = data[i];
		const date = row[0]
			? Utilities.formatDate(new Date(row[0]), 'Asia/Kolkata', 'dd/MM/yyyy')
			: '';
		const ref = row[1] || 'Migration';

		const regularOut = Number(row[2]) || 0; // C = Regular OUT
		const smallOut = Number(row[3]) || 0; // D = Small OUT
		const regularIn = Number(row[4]) || 0; // E = Regular IN
		const smallIn = Number(row[5]) || 0; // F = Small IN

		if (regularIn > 0) {
			newRows.push([
				date,
				ref,
				'IN',
				'Regular Ceety',
				regularIn,
				Math.floor(regularIn / CONVERSION['Regular Ceety'].pcsPerPkt),
				Math.floor(
					regularIn /
						CONVERSION['Regular Ceety'].pcsPerPkt /
						CONVERSION['Regular Ceety'].pktPerBag,
				),
				0.32,
			]);
		}
		if (smallIn > 0) {
			newRows.push([
				date,
				ref,
				'IN',
				'Small Ceety',
				smallIn,
				Math.floor(smallIn / CONVERSION['Small Ceety'].pcsPerPkt),
				Math.floor(
					smallIn /
						CONVERSION['Small Ceety'].pcsPerPkt /
						CONVERSION['Small Ceety'].pktPerBag,
				),
				0.32,
			]);
		}
		if (regularOut > 0) {
			newRows.push([
				date,
				ref,
				'OUT',
				'Regular Ceety',
				regularOut,
				Math.floor(regularOut / CONVERSION['Regular Ceety'].pcsPerPkt),
				Math.floor(
					regularOut /
						CONVERSION['Regular Ceety'].pcsPerPkt /
						CONVERSION['Regular Ceety'].pktPerBag,
				),
				'',
			]);
		}
		if (smallOut > 0) {
			newRows.push([
				date,
				ref,
				'OUT',
				'Small Ceety',
				smallOut,
				Math.floor(smallOut / CONVERSION['Small Ceety'].pcsPerPkt),
				Math.floor(
					smallOut /
						CONVERSION['Small Ceety'].pcsPerPkt /
						CONVERSION['Small Ceety'].pktPerBag,
				),
				'',
			]);
		}
	}

	if (newRows.length > 0) {
		ledger
			.getRange(2, 1, newRows.length, LEDGER_HEADERS.length)
			.setValues(newRows);
	}
}

// ── Add stock IN (purchase/restock) ──────────────────────────────────────────
function addStock(data) {
	// data = { date, reference, product, pcs }
	// product must be exactly 'Regular Ceety' or 'Small Ceety'
	const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
		SHEETS.STOCK_LEDGER,
	);
	if (!sheet)
		return {
			error: 'Stock Ledger sheet not found. Run setupStockSheets() first.',
		};
	ensureStockLedgerCostHeader(sheet);

	const conv = CONVERSION[data.product];
	if (!conv) return { error: 'Unknown product: ' + data.product };

	const pcs = Number(data.pcs);
	const pkt = Math.floor(pcs / conv.pcsPerPkt);
	const bag = Math.floor(pkt / conv.pktPerBag);

	const [year, month, day] = data.date.substring(0, 10).split('-').map(Number);
	const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

	sheet.appendRow([
		dateStr,
		data.reference || 'Stock IN',
		'IN',
		data.product,
		pcs,
		pkt,
		bag,
		Number(data.costRate || 0.32),
	]);
	sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('@STRING@');

	return { success: true, product: data.product, pcs, pkt, bag };
}

// ── Deduct stock OUT when challan is created ──────────────────────────────────
function deductStockForChallan(challanNo, date, items) {
	// Guard against undefined/null inputs
	if (!date) {
		Logger.log('deductStockForChallan: date is missing');
		return { error: 'Date is missing' };
	}
	if (!items || !items.length) {
		Logger.log('deductStockForChallan: no items');
		return { error: 'No items' };
	}

	const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
		SHEETS.STOCK_LEDGER,
	);
	if (!sheet) return { error: 'Stock Ledger sheet not found.' };
	ensureStockLedgerCostHeader(sheet);

	const safeDateStr = String(date).substring(0, 10); // YYYY-MM-DD
	const [year, month, day] = safeDateStr.split('-').map(Number);
	const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

	// Accumulate pcs per product from all challan items
	const deductions = { 'Regular Ceety': 0, 'Small Ceety': 0 };

	items.forEach((item) => {
		const desc = item.desc.toLowerCase();
		const qty = Number(item.qty);
		const unit = (item.unit || 'pcs').toLowerCase();
		const isSmall = desc.includes('small');
		const product = isSmall ? 'Small Ceety' : 'Regular Ceety';
		const conv = CONVERSION[product];

		let pcs = 0;
		if (unit === 'pcs') pcs = qty;
		if (unit === 'pkt') pcs = qty * conv.pcsPerPkt;
		if (unit === 'bag') pcs = qty * conv.pktPerBag * conv.pcsPerPkt;

		deductions[product] += pcs;
	});

	// Append one OUT row per product that has a deduction
	const newRows = [];
	PRODUCTS.forEach((product) => {
		const pcs = deductions[product];
		if (pcs <= 0) return;
		const conv = CONVERSION[product];
		const pkt = Math.floor(pcs / conv.pcsPerPkt);
		const bag = Math.floor(pkt / conv.pktPerBag);
		newRows.push([dateStr, challanNo, 'OUT', product, pcs, pkt, bag, '']);
	});

	if (newRows.length > 0) {
		const startRow = sheet.getLastRow() + 1;
		sheet
			.getRange(startRow, 1, newRows.length, LEDGER_HEADERS.length)
			.setValues(newRows);
		// Force date column as text
		sheet.getRange(startRow, 1, newRows.length, 1).setNumberFormat('@STRING@');
	}

	return { success: true, deductions };
}

// ── Get full ledger history ───────────────────────────────────────────────────
function getStock() {
	const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
		SHEETS.STOCK_LEDGER,
	);
	if (!sheet) return [];
	ensureStockLedgerCostHeader(sheet);
	const lastRow = sheet.getLastRow();
	if (lastRow < 2) return [];

	return sheet
		.getRange(2, 1, lastRow - 1, LEDGER_HEADERS.length)
		.getValues()
		.filter((r) => r[0])
		.map((r) => ({
			date: String(r[0]),
			reference: r[1],
			type: r[2],
			product: r[3],
			pcs: Number(r[4]),
			pkt: Number(r[5]),
			bag: Number(r[6]),
			costRate: Number(r[7] || 0.32),
		}));
}

// ── Get live balances from Summary sheet ──────────────────────────────────────
function getStockSummary() {
	const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
		SHEETS.STOCK_SUMMARY,
	);
	if (!sheet) return [];
	const lastRow = sheet.getLastRow();
	if (lastRow < 2) return [];

	return sheet
		.getRange(2, 1, lastRow - 1, SUMMARY_HEADERS.length)
		.getValues()
		.filter((r) => r[0])
		.map((r) => ({
			product: r[0],
			totalIn: Number(r[1]),
			totalOut: Number(r[2]),
			balancePcs: Number(r[3]),
			balancePkt: Number(r[4]),
			balanceBag: Number(r[5]),
		}));
}
