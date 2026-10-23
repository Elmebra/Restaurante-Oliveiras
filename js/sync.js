// Sincronização com a planilha Google (Apps Script). Envia só o que mudou, recebe o que mudou nos outros aparelhos.
const KEY = 'oliveiras.sync';

export function createSync({ store, fetchFn = (...a) => fetch(...a), storage = globalThis.localStorage, onChange = () => {}, now = () => Date.now() }) {
  let cfg = null;
  try { cfg = JSON.parse(storage.getItem(KEY) || 'null'); } catch { cfg = null; }
  const st = { state: cfg ? 'pending' : 'off', last: null, error: '' };
  let running = false;
  let again = false;
  let timer = null;
  let debounce = null;

  const cleanUrl = (u) => String(u || '').trim();

  async function syncNow() {
    if (!cfg) return { ok: false, error: 'Sincronização não configurada' };
    if (running) { again = true; return { ok: true, queued: true }; }
    running = true;
    try {
      const { changes, maxU } = store.syncCollect();
      const res = await fetchFn(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token: cfg.token, since: store.syncState.rev, changes }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error === 'senha' ? 'Senha incorreta' : (data.error || 'Erro no servidor'));
      const applied = store.syncApply(data.changes || [], data.rev, maxU);
      st.state = 'ok'; st.last = now(); st.error = '';
      onChange({ applied, sent: changes.length });
      return { ok: true, applied, sent: changes.length };
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      st.state = offline ? 'offline' : 'error';
      st.error = offline ? 'Sem internet' : String(e.message || e);
      onChange({ applied: 0, sent: 0, error: st.error });
      return { ok: false, error: st.error };
    } finally {
      running = false;
      if (again) { again = false; setTimeout(syncNow, 500); }
    }
  }

  function setConfig(url, token) {
    const u = cleanUrl(url); const t = String(token || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(u)) return { ok: false, error: 'O endereço deve começar com https://script.google.com/macros/s/ e terminar em /exec' };
    if (!t) return { ok: false, error: 'Digite a senha' };
    cfg = { url: u, token: t };
    try { storage.setItem(KEY, JSON.stringify(cfg)); } catch { /* sem storage */ }
    st.state = 'pending';
    return { ok: true };
  }

  function clear() {
    cfg = null;
    try { storage.removeItem(KEY); } catch { /* sem storage */ }
    st.state = 'off'; st.error = '';
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => { if (cfg && !(typeof document !== 'undefined' && document.hidden)) syncNow(); }, 20000);
    store.subscribe((_s, source) => {
      if (source === 'remote' || !cfg) return;
      clearTimeout(debounce);
      debounce = setTimeout(syncNow, 2500);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => cfg && syncNow());
      document.addEventListener('visibilitychange', () => { if (!document.hidden && cfg) syncNow(); });
    }
    if (cfg) syncNow();
  }

  return {
    syncNow, setConfig, clear, start,
    get configured() { return !!cfg; },
    get url() { return cfg?.url || ''; },
    get status() { return { ...st, pending: cfg ? store.syncPending() : 0 }; },
  };
}
