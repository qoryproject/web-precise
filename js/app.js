const S = { user: null, prods: [], ledger: [], audit: [], nilai: 0, page: 'dash' };
const NULLEL = document.createElement('div'); // elemen tiada -> tidak crash "setting innerHTML of null"
const $ = id => document.getElementById(id) || (console.warn('Elemen tiada: ' + id), NULLEL);
window.addEventListener('error', e => { try { toast('Ralat skrip: ' + e.message, 'danger'); $('loading').classList.add('hide'); } catch (x) {} });
window.addEventListener('unhandledrejection', e => { try { toast(String((e.reason && e.reason.message) || e.reason), 'danger'); } catch (x) {} });
const RM = n => 'RM ' + Number(n || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NAV = [['dash', 'speedometer2', 'Papan Pemuka'], ['stok', 'box-seam', 'Stok Semasa'], ['masuk', 'box-arrow-in-down', 'Barang Masuk'],
  ['keluar', 'box-arrow-up', 'Barang Keluar'], ['audit', 'clipboard-check', 'Log Audit']];

function toast(msg, type) {
  const t = $('toast'); t.className = 'toast align-items-center border-0 text-bg-' + (type || 'success');
  $('toastBody').textContent = msg; if (window.bootstrap) bootstrap.Toast.getOrCreateInstance(t, { delay: 4000 }).show(); else alert(msg);
}
function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; try { localStorage.setItem('theme', t); } catch (e) {}
}

// ── Navigasi SPA (URL tidak pernah berubah) ──
function renderNav() {
  const items = NAV.filter(n => n[0] !== 'audit' || S.user.peranan === 'admin');
  $('sideNav').innerHTML = items.map(n => `<li><a data-p="${n[0]}" onclick="go('${n[0]}')"><i class="bi bi-${n[1]}"></i>${n[2]}</a></li>`).join('');
  $('bottomNav').innerHTML = items.map(n => `<a data-p="${n[0]}" onclick="go('${n[0]}')"><i class="bi bi-${n[1]}"></i>${n[2].split(' ')[0]}</a>`).join('');
}
function go(p) {
  S.page = p;
  document.querySelectorAll('.page').forEach(s => s.classList.toggle('active', s.id === 's-' + p));
  document.querySelectorAll('[data-p]').forEach(a => a.classList.toggle('active', a.dataset.p === p));
  $('pageTitle').textContent = NAV.find(n => n[0] === p)[2];
  ({ dash: rDash, stok: rStok, masuk: rMasuk, keluar: rKeluar, audit: rAudit })[p]();
  if (p === 'masuk' || p === 'keluar') { restoreDraft(); if (p === 'keluar') pFefo(); }
}
let busy = false;
function retryLoad() { busy = false; $('loading').classList.remove('hide'); $('loading').innerHTML = '<div class="spinner-border text-primary"></div><p>Memuat PRECISE…</p>'; load(true, true); }
async function load(first, fresh, silent) {
  if (busy) return; busy = true;
  const wd = setTimeout(() => { $('loading').innerHTML = '<div class="text-center p-4"><h2 class="h5">Pelayan lambat bertindak balas</h2><p>Semak izin akses Spreadsheet/Drive, kemudian cuba lagi.</p><button class="btn-pri" onclick="retryLoad()">Cuba lagi</button></div>'; }, 25000);
  try {
    if (!GAS_URL || GAS_URL.indexOf('GANTI') >= 0) throw new Error('GAS_URL belum diisi dalam js/config.js');
    const d = await call('getBootstrap', !!fresh); Object.assign(S, d); saveBoot();
    $('who').textContent = S.user.nama + ' · ' + S.user.peranan;
    if (first || !$('sideNav').children.length) renderNav();
    if (!(silent && (S.page === 'masuk' || S.page === 'keluar'))) go(S.page); // jangan padam borang yang sedang ditaip
  } catch (e) {
    if (/^Sesi/.test(e.message)) { showLogin(e.message); return; }
    if (silent) { toast(e.message, 'warning'); return; }
    document.querySelectorAll('.page').forEach(s => s.classList.toggle('active', s.id === 's-dash'));
    $('s-dash').innerHTML = `<div class="card-x text-center"><h2 class="h5">${esc(e.message)}</h2><p>Jika baru deploy: pastikan e-mel anda ada dalam helaian Users dan anda ada akses ke Spreadsheet.</p><button class="btn-pri" onclick="retryLoad()">Cuba lagi</button></div>`;
  } finally { clearTimeout(wd); busy = false; $('loading').classList.add('hide'); }
}

// ── Status stok ──
const exp = p => p.bl[0] ? Math.ceil((new Date(p.bl[0].luput) - new Date()) / 864e5) : null;
function badge(p) {
  if (p.stok <= 0) return '<span class="pill err">Habis</span>';
  if (p.stok <= p.min) return '<span class="pill warn">Stok Rendah</span>';
  const d = exp(p); if (d !== null && d <= 30) return '<span class="pill warn">Hampir Luput</span>';
  return '<span class="pill ok">Normal</span>';
}
const kpi = (l, v, c) => `<div class="col-6 col-lg-3"><div class="card-x kpi"><small>${l}</small><span class="v" ${c ? `style="color:var(--${c})"` : ''}>${v}</span></div></div>`;

// ── Papan Pemuka ──
function rDash() {
  const adm = S.user.peranan === 'admin', al = S.prods.filter(p => p.stok <= p.min || (exp(p) !== null && exp(p) <= 30));
  $('s-dash').innerHTML = `<div class="row g-3 mb-3">
    ${kpi('Jumlah SKU', S.prods.length)}${kpi('Unit Fizikal', S.prods.reduce((s, p) => s + p.stok, 0).toLocaleString())}
    ${adm ? kpi('Nilai Inventori', RM(S.nilai)) : ''}${kpi('Amaran Stok', al.length + ' Item', al.length ? 'warn' : 'ok')}</div>
    <div class="row g-3"><div class="col-lg-6"><div class="card-x"><h2 class="h5">Amaran Segera</h2>
      ${al.map(p => `<div class="d-flex justify-content-between py-2 border-bottom"><span>${esc(p.nama)}<br><small class="mono">${esc(p.barcode)}</small></span><span>${badge(p)} <b class="mono">${p.stok}</b></span></div>`).join('') || '<p class="text-secondary">Tiada amaran.</p>'}
    </div></div>
    <div class="col-lg-6"><div class="card-x"><h2 class="h5">Urus Niaga Terkini</h2>
      ${S.ledger.map(l => `<div class="d-flex justify-content-between py-2 border-bottom"><span class="mono">${esc(l.rujukan)}</span><b class="mono" style="color:var(--${l.kuantiti < 0 ? 'err' : 'ok'})">${l.kuantiti > 0 ? '+' : ''}${l.kuantiti}</b></div>`).join('') || '<p class="text-secondary">Belum ada urus niaga.</p>'}
    </div></div></div>`;
}

// ── Stok Semasa ──
function rStok() {
  const adm = S.user.peranan === 'admin';
  $('s-stok').innerHTML = `<div class="card-x"><input id="q" class="form-control mb-3" placeholder="Cari nama / barkod…" oninput="dStok()" aria-label="Cari">
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Produk</th><th>Kategori</th><th class="num">Baki</th><th class="num">Min</th><th class="num">Jual</th>${adm ? '<th class="num">Kos</th>' : ''}<th>Status</th></tr></thead><tbody id="stokB"></tbody></table></div></div>`;
  fStok();
}
function fStok() {
  const q = ($('q') ? $('q').value : '').toLowerCase(), adm = S.user.peranan === 'admin';
  $('stokB').innerHTML = S.prods.filter(p => (p.nama + p.barcode).toLowerCase().includes(q)).map(p => `<tr>
    <td data-l="Produk"><b>${esc(p.nama)}</b><br><small class="mono">${esc(p.id)} · ${esc(p.barcode)}</small></td><td data-l="Kategori">${esc(p.kat)}</td>
    <td data-l="Baki" class="num"><b>${p.stok}</b> ${esc(p.unit)}</td><td data-l="Min" class="num">${p.min}</td><td data-l="Jual" class="num">${p.jual.toFixed(2)}</td>
    ${adm ? `<td data-l="Kos" class="num">${p.kos.toFixed(2)}</td>` : ''}<td data-l="Status">${badge(p)}</td></tr>`).join('');
}

// ── Borang bersama (Masuk / Keluar) ──
const opts = () => S.prods.map(p => `<option value="${p.id}">${esc(p.nama)} (baki ${p.stok})</option>`).join('');
const fileInp = '<label class="form-label mt-3">Lampiran (2–3 fail, .pdf / .jpeg)</label><input id="f-files" type="file" class="form-control" accept=".pdf,.jpg,.jpeg,image/jpeg,application/pdf" multiple onchange="showFiles()"><div id="fileList" class="small mt-2"></div>';
function showFiles() {
  const fs = [...($('f-files').files || [])];
  $('fileList').innerHTML = fs.map(f => `<div class="d-flex justify-content-between"><span>${esc(f.name)}</span><span class="mono">${(f.size / 1048576).toFixed(2)} MB</span></div>`).join('') + (fs.length > 3 ? '<span class="pill err">Maksimum 3 fail</span>' : '');
}
function scanInp() {
  return `<label class="form-label">Imbas barkod</label><div class="input-group"><input id="f-scan" class="form-control mono" inputmode="numeric" autocomplete="off" placeholder="Imbas atau taip, kemudian Enter"><button type="button" class="btn-ghost" onclick="openScan()" aria-label="Imbas dengan kamera"><i class="bi bi-camera"></i></button></div>`;
}
let afterScan = () => {};
function pickCode(code) {
  const p = S.prods.find(x => x.barcode === String(code).trim());
  if (!p) { toast('Barkod tidak dikenali: ' + code + '. Daftar barang baru.', 'warning'); return false; }
  $('f-prod').value = p.id; afterScan(); return true;
}
function bindScan(after) {
  afterScan = after; const el = $('f-scan'); el.focus();
  el.onkeydown = e => { if (e.key !== 'Enter') return; e.preventDefault(); if (pickCode(el.value)) el.value = ''; el.focus(); };
}
// ── Lampiran: sahkan melalui magic bytes; JPEG besar dimampatkan; PDF dihantar asal ──
const hdr = async f => new Uint8Array(await f.slice(0, 4).arrayBuffer());
const b64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result.split(',')[1]); r.onerror = () => no(new Error('Gagal baca fail: ' + f.name)); r.readAsDataURL(f); });
function toJpeg(f) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const r = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('Imej tidak dapat dibaca: ' + f.name)); };
    img.src = url;
  });
}
async function readFiles() {
  const fs = [...($('f-files').files || [])];
  if (fs.length > 3) throw new Error('Maksimum 3 lampiran.');
  const out = [], base = f => f.name.replace(/\.[^.]+$/, '');
  for (const f of fs) {
    const h = await hdr(f);
    if (h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) {
      if (f.size > 8 * 1048576) throw new Error('PDF terlalu besar (maks 8 MB): ' + f.name);
      out.push({ name: base(f) + '.pdf', mime: 'application/pdf', b64: await b64(f) });
    } else if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) {
      out.push({ name: base(f) + '.jpeg', mime: 'image/jpeg', b64: f.size <= 3 * 1048576 ? await b64(f) : await toJpeg(f) });
    } else throw new Error('Hanya PDF/JPEG diterima: ' + f.name);
  }
  return out;
}
async function submit(btn, fn, payload, okMsg) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan…';
  try { payload.files = await readFiles(); const r = await call(fn, payload); toast(okMsg(r)); applyResult(r); try { localStorage.removeItem('draft_' + S.page); } catch (e) {} go(S.page); }
  catch (e) { toast(e.message, 'danger'); }
  finally { btn.disabled = false; btn.innerHTML = old; }
}

// ── Barang Masuk ──
function rMasuk() {
  const adm = S.user.peranan === 'admin';
  $('s-masuk').innerHTML = `<div class="card-x" style="max-width:640px"><form onsubmit="event.preventDefault();doIn(this.querySelector('.btn-pri'))">
    ${scanInp()}<label class="form-label mt-3">Produk *</label><select id="f-prod" class="form-select" required>${opts()}</select>
    <div class="row g-2 mt-1"><div class="col-6"><label class="form-label">Kuantiti *</label><input id="f-qty" type="number" min="1" step="any" class="form-control mono" required></div>
    <div class="col-6"><label class="form-label">No. Batch *</label><input id="f-batch" class="form-control mono" required></div>
    <div class="col-6"><label class="form-label">Tarikh Luput *</label><input id="f-luput" type="date" class="form-control" required></div>
    <div class="col-6"><label class="form-label">Lokasi Rak *</label><input id="f-lok" class="form-control mono" required></div>
    ${adm ? '<div class="col-6"><label class="form-label">Kos Seunit (RM)</label><input id="f-kos" type="number" min="0" step="0.01" class="form-control mono"></div>' : ''}
    <div class="col-6"><label class="form-label">No. Invois</label><input id="f-inv" class="form-control"></div></div>
    ${fileInp}<button class="btn-pri w-100 mt-4"><i class="bi bi-box-arrow-in-down"></i> Simpan Barang Masuk</button></form></div>`;
  bindScan(() => $('f-qty').focus());
}
function doIn(btn) {
  submit(btn, 'stockIn', { product_id: $('f-prod').value, kuantiti: $('f-qty').value, no_batch: $('f-batch').value, luput: $('f-luput').value,
    lokasi: $('f-lok').value, kos: $('f-kos') ? $('f-kos').value : 0, invois: $('f-inv').value },
    r => `Berjaya. Baki baharu: ${r.baki_baru}`);
}

// ── Barang Keluar (cadangan FEFO) ──
function fefo(p, q) {
  let left = q; return p.bl.map(b => { const t = Math.min(left, b.baki); left -= t; return t > 0 ? { b, t } : null; }).filter(Boolean);
}
function rKeluar() {
  $('s-keluar').innerHTML = `<div class="card-x" style="max-width:640px"><form onsubmit="event.preventDefault();doOut(this.querySelector('.btn-pri'))">
    ${scanInp()}<label class="form-label mt-3">Produk *</label><select id="f-prod" class="form-select" onchange="pFefo()" required>${opts()}</select>
    <div class="row g-2 mt-1"><div class="col-6"><label class="form-label">Kuantiti *</label><input id="f-qty" type="number" min="1" step="any" class="form-control mono" oninput="pFefo()" required></div>
    <div class="col-6"><label class="form-label">Harga Jual (RM)</label><input id="f-jual" type="number" min="0" step="0.01" class="form-control mono"></div>
    <div class="col-12"><label class="form-label">Pelanggan / Outlet</label><input id="f-cust" class="form-control"></div></div>
    <div id="fefoBox" class="mt-3"></div>${fileInp}
    <button class="btn-pri w-100 mt-4"><i class="bi bi-lock"></i> Simpan &amp; Tolak Stok</button></form></div>`;
  bindScan(() => { const p = S.prods.find(x => x.id === $('f-prod').value); $('f-jual').value = p.jual; $('f-qty').focus(); pFefo(); });
  pFefo();
}
function pFefo() {
  const p = S.prods.find(x => x.id === $('f-prod').value); if (!p) return; const q = Number($('f-qty').value) || 0;
  if (!$('f-jual').value) $('f-jual').value = p.jual;
  const al = fefo(p, q);
  $('fefoBox').innerHTML = `<div class="mono mb-2">Baki sah: <b>${p.stok}</b> ${esc(p.unit)}</div>` + (q > p.stok
    ? `<div class="pill err">Stok tidak mencukupi. Baki: ${p.stok}</div>`
    : al.map(x => `<div class="fefo ${exp({ bl: [x.b] }) <= 30 ? 'near' : ''}"><b class="mono">${esc(x.b.no)}</b> · luput ${esc(x.b.luput)} · <b>${x.t}</b> / ${x.b.baki} unit</div>`).join(''));
}
function doOut(btn) {
  const p = S.prods.find(x => x.id === $('f-prod').value);
  if (Number($('f-qty').value) > p.stok) return toast('Stok tidak mencukupi. Baki: ' + p.stok, 'danger');
  submit(btn, 'stockOut', { product_id: p.id, kuantiti: $('f-qty').value, harga_jual: $('f-jual').value, pelanggan: $('f-cust').value },
    r => `Berjaya (${r.trx_id}). Baki baharu: ${r.baki_baru}` + (r.untung !== undefined ? ` · Untung ${RM(r.untung)}` : ''));
}

// ── Log Audit (Admin) ──
function rAudit() {
  $('s-audit').innerHTML = `<div class="card-x"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Masa</th><th>Pengguna</th><th>Tindakan</th><th>Rekod</th><th>Asal</th><th>Baharu</th></tr></thead><tbody>
    ${(S.audit || []).map(a => `<tr><td data-l="Masa" class="mono">${esc(a.masa)}</td><td data-l="Pengguna">${esc(a.user)}</td><td data-l="Tindakan"><span class="pill ok">${esc(a.tindakan)}</span></td>
    <td data-l="Rekod" class="mono">${esc(a.rekod_id)}</td><td data-l="Asal" class="mono">${esc(a.nilai_lama)}</td><td data-l="Baharu" class="mono">${esc(a.nilai_baru)}</td></tr>`).join('') || '<tr><td colspan="6">Tiada rekod.</td></tr>'}
    </tbody></table></div></div>`;
}

// ── gas-instant-ux: SWR setempat, kemas kini setempat selepas simpan, draf borang, carian debounce ──
// NOTA: tulis stok TIDAK fire-and-forget; ia disahkan pelayan (LockService/FEFO), baru UI dikemas kini daripada jawapan pelayan.
const CK = 'precise_boot_v1';
function saveBoot() { try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), user: S.user, prods: S.prods, ledger: S.ledger, nilai: S.nilai, audit: S.audit })); } catch (e) {} }
function loadBoot() { try { const d = JSON.parse(localStorage.getItem(CK) || 'null'); if (d && d.user && Date.now() - d.t < 43200000) return d; } catch (e) {} return null; }
function applyResult(r) {
  if (r.prod) { const i = S.prods.findIndex(x => x.id === r.prod.id); if (i >= 0) S.prods[i] = r.prod; }
  if (r.ledger) S.ledger = r.ledger.slice().reverse().concat(S.ledger).slice(0, 8);
  if (S.user.peranan === 'admin' && r.nilai_delta) S.nilai += r.nilai_delta;
  saveBoot();
}
const DRAFT = ['f-prod', 'f-qty', 'f-batch', 'f-luput', 'f-lok', 'f-kos', 'f-inv', 'f-jual', 'f-cust'];
function saveDraft() {
  if (S.page !== 'masuk' && S.page !== 'keluar') return;
  const d = {}; DRAFT.forEach(i => { const e = document.getElementById(i); if (e) d[i] = e.value; });
  try { localStorage.setItem('draft_' + S.page, JSON.stringify(d)); } catch (e) {}
}
function restoreDraft() {
  try { const d = JSON.parse(localStorage.getItem('draft_' + S.page) || 'null'); if (!d) return;
    Object.keys(d).forEach(i => { const e = document.getElementById(i); if (e && d[i] !== '') e.value = d[i]; }); } catch (e) {}
}
document.addEventListener('input', saveDraft); document.addEventListener('change', saveDraft);
let st; const dStok = () => { clearTimeout(st); st = setTimeout(fStok, 200); };

// ── Log masuk / keluar ──
function showLogin(msg) { $('loading').classList.add('hide'); $('login').classList.remove('d-none'); $('loginMsg').textContent = msg || ''; }
async function doLogin(ev) {
  ev.preventDefault(); const b = ev.submitter; b.disabled = true; $('loginMsg').textContent = '';
  try {
    const r = await apiRaw('login', { email: $('l-email').value.trim(), pin: $('l-pin').value });
    if (!r.success) throw new Error(r.message);
    setToken(r.data.token); $('l-pin').value = ''; $('login').classList.add('d-none'); $('loading').classList.remove('hide'); load(true);
  } catch (e) { $('loginMsg').textContent = e.message; } finally { b.disabled = false; }
}
function logout() {
  setToken(null);
  try { [CK, 'draft_masuk', 'draft_keluar'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
  Object.assign(S, { user: null, prods: [], ledger: [], audit: [], nilai: 0, page: 'dash' });
  $('sideNav').innerHTML = ''; $('bottomNav').innerHTML = ''; showLogin();
}

// ── Kamera barkod: cuba video langsung; jika disekat (iframe GAS) -> ambil foto & nyahkod ──
let scn = null;
function openScan() {
  $('scanModal').classList.add('show'); $('scanMsg').textContent = 'Halakan kamera ke barkod…'; $('scanFileBox').classList.add('d-none');
  if (!window.Html5Qrcode) return scanFallback('pustaka tidak dimuat');
  try {
    scn = new Html5Qrcode('reader', { useBarCodeDetectorIfSupported: true });
    scn.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 160 } }, t => { closeScan(); pickCode(t); }, () => {})
      .catch(e => scanFallback((e && e.message) || e));
  } catch (e) { scanFallback(e.message); }
}
function scanFallback(why) {
  stopScan(); $('scanMsg').textContent = 'Kamera langsung tidak dibenarkan di sini (' + why + '). Ambil gambar barkod dengan kamera telefon:';
  $('scanFileBox').classList.remove('d-none');
}
function stopScan() { const s = scn; scn = null; if (s) { try { s.stop().then(() => s.clear()).catch(() => {}); } catch (e) {} } }
function closeScan() { stopScan(); $('scanModal').classList.remove('show'); }
async function scanPhoto(inp) {
  const f = inp.files[0]; if (!f) return;
  try { const s = new Html5Qrcode('reader-tmp', { useBarCodeDetectorIfSupported: true }); const t = await s.scanFile(f, false); closeScan(); pickCode(t); }
  catch (e) { toast('Barkod tidak dapat dibaca. Dekatkan dan pastikan cahaya cukup.', 'warning'); }
  inp.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  try { document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light'; } catch (e) {}
  if (!getToken()) { showLogin(); return; }
  const b = loadBoot(); // paparan instan dari cache setempat, sahkan di latar belakang
  if (b) { Object.assign(S, b); $('who').textContent = S.user.nama + ' · ' + S.user.peranan; renderNav(); go('dash'); $('loading').classList.add('hide'); }
  load(!b, false, !!b);
});
