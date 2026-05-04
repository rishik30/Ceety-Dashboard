// ══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function genChallanNo() { return '#C' + Math.random().toString(16).slice(2, 10).toUpperCase(); }
function genOrderNo()   { return '#ORD' + String(S.orderSeq++).padStart(4, '0'); }
function fmt(n)         { return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d)     { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function today()        { return new Date().toISOString().split('T')[0]; }

function setLoading(btnId, loading, label = '') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) { btn.innerHTML = '<span class="spinner"></span> ' + label; }
  else { btn.textContent = btn.dataset.label || btn.textContent; }
}

function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 3500);
}

function confirmModal({ title = 'Confirm action', message, confirmLabel = 'Confirm' }) {
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
