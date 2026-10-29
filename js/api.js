// Lapisan fetch ke GAS REST API. POST WAJIB text/plain (elak CORS preflight yang disekat GAS).
const TK = 'precise_token';
const getToken = () => { try { return localStorage.getItem(TK); } catch (e) { return null; } };
const setToken = t => { try { t ? localStorage.setItem(TK, t) : localStorage.removeItem(TK); } catch (e) {} };
async function apiRaw(action, data) {
  if (!GAS_URL || GAS_URL.indexOf('GANTI') >= 0) throw new Error('GAS_URL belum diisi dalam js/config.js');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: getToken(), data: data || {} }), signal: ctl.signal });
    return await res.json();
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'Pelayan tidak menjawab (tamat masa).' : 'Tiada sambungan ke pelayan.'); }
  finally { clearTimeout(t); }
}
const FN = { getBootstrap: 'boot', stockIn: 'stockIn', stockOut: 'stockOut' };
function call(fn, arg) {
  return apiRaw(FN[fn], fn === 'getBootstrap' ? { fresh: !!arg } : arg)
    .then(r => { if (r && r.success) return r.data; throw new Error((r && r.message) || 'Ralat tidak diketahui'); });
}
