// Impressão: botão manual e impressão automática de pedidos novos neste aparelho.
import { ticketPedido, ticketSalao, ticketTeste } from './ticket.js';

const CFG = 'oliveiras.print';
const DONE = 'oliveiras.printed';

export function printHTML(html) {
  if (globalThis.__printSink) { globalThis.__printSink(html); return; }
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open(); d.write(html); d.close();
  setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch { /* navegador bloqueou */ }
    setTimeout(() => f.remove(), 60000);
  }, 200);
}

export function createPrinter({ store, storage = globalThis.localStorage }) {
  const read = (k, d) => { try { return JSON.parse(storage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };
  let cfg = { auto: false, width: 80, copies: 1, ...read(CFG, {}) };
  let done = new Set(read(DONE, []));
  let queue = Promise.resolve();
  let timer = null;

  const saveDone = () => write(DONE, [...done].slice(-800));
  const enqueue = (html) => { queue = queue.then(() => new Promise((res) => { printHTML(html); setTimeout(res, 1500); })); };

  function baseline() { // ao ligar a impressão automática, não reimprime o que já existe
    for (const p of store.state.pedidos) done.add(`o:${p.id}`);
    for (const c of Object.values(store.state.cards)) for (const l of c.lines) if (l.type === 'prato') done.add(`s:${l.id}`);
    saveDone();
  }

  function autoCheck() {
    if (!cfg.auto) return 0;
    let n = 0;
    const cutoff = store.now() - 12 * 3600e3;
    for (const p of store.state.pedidos) {
      if (p.status === 'cancelado' || p.ts < cutoff || done.has(`o:${p.id}`)) continue;
      done.add(`o:${p.id}`); n += 1;
      enqueue(ticketPedido(p, cfg));
    }
    for (const c of Object.values(store.state.cards)) {
      const fresh = c.lines.filter((l) => l.type === 'prato' && l.status !== 'pronto' && !done.has(`s:${l.id}`));
      if (!fresh.length) continue;
      fresh.forEach((l) => done.add(`s:${l.id}`)); n += 1;
      enqueue(ticketSalao(c.num, fresh, fresh[0].ts, cfg));
    }
    if (n) saveDone();
    return n;
  }

  return {
    get config() { return { ...cfg }; },
    set(patch) {
      const wasAuto = cfg.auto;
      cfg = { ...cfg, ...patch };
      write(CFG, cfg);
      if (cfg.auto && !wasAuto) baseline();
    },
    printPedido(id) {
      const p = store.state.pedidos.find((x) => x.id === id);
      if (!p) return false;
      printHTML(ticketPedido(p, cfg)); done.add(`o:${p.id}`); saveDone();
      return true;
    },
    printTest() { printHTML(ticketTeste(cfg)); },
    autoCheck,
    start() {
      store.subscribe(() => { clearTimeout(timer); timer = setTimeout(autoCheck, 600); });
      autoCheck();
    },
  };
}
