# Ceety Dashboard

Static dashboard frontend plus Google Apps Script backend for syncing Ceety operations data with Google Sheets.

## Structure

- `index.html` - Dashboard markup and script/style imports.
- `styles/main.css` - All dashboard styling.
- `scripts/state.js` - Shared app state and startup initialization.
- `scripts/api.js` - Apps Script API connection and sync helpers.
- `scripts/navigation.js` - Page navigation and full render orchestration.
- `scripts/utils.js` - Formatting, date, loading, and toast helpers.
- `scripts/challan.js` - Challan form, preview, generation, and loading.
- `scripts/database.js` - Challan database rendering and deletion.
- `scripts/accounts.js` - Account ledger form, rendering, loading, and deletion.
- `scripts/orders.js` - Order book form, rendering, loading, and status updates.
- `scripts/stock.js` - Stock form, inventory rendering, restocking, and deletion.
- `scripts/overview.js` - Overview dashboard stats and summaries.
- `Code.gs` - Google Apps Script backend.
- `ceety.txt` - Saved Apps Script Web App URL.

## Notes

Open `index.html` directly in a browser for local UI work. Keep the script tags in their current order because later files depend on shared state and helpers declared earlier.
# Ceety-Dashboard
