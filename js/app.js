// Casco do app: rota, renderização, eventos e utilitários de interface (toast, confirmação).
import { createStore } from './store.js';
import { createSync } from './sync.js';
import { createPrinter } from './print.js';
import { icons } from './icons.js';
import { esc } from './util.js';
import home from './screens/home.js';
import balanca from './screens/balanca.js';
import cozinha from './screens/cozinha.js';
import expedicao from './screens/expedicao.js';
import caixa from './screens/caixa.js';
import painel from './screens/painel.js';

const store = createStore();
const printer = createPrinter({ store });
const sync = createSync({
  store,
  onChange: ({ applied }) => {
    const a = document.activeElement;
    const busy = (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || document.querySelector('.sheet');
    if (applied && !busy) rerender({ keepFocus: false });
    else updateDot();
  },
});
const SCREENS = { balanca, cozinha, expedicao, caixa, painel };
const NAV = [
  ['balanca', 'Balança', 'scale'],
  ['cozinha', 'Cozinha', 'pot'],
  ['expedicao', 'Expedição', 'moto'],
  ['caixa', 'Caixa', 'cash'],
  ['painel', 'Painel', 'chart'],
];

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
const $ask = document.getElementById('ask');
const uiState = {}; // estado de tela (por módulo), mantido entre renderizações

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] || '', params: parts.slice(1) };
}

let toastTimer;
function toast(msg, type = '') {
  $toast.textContent = msg;
  $toast.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.className = ''; }, 2600);
}

let askResolve = null;
function ask({ title, text = '', ok = 'Confirmar', cancel = 'Voltar', danger = false }) {
  $ask.innerHTML = `<div class="dlg"><h3>${esc(title)}</h3><p>${esc(text)}</p>
    <div class="acts"><button class="btn ghost" data-ask="0">${esc(cancel)}</button>
    <button class="btn ${danger ? 'danger' : ''}" data-ask="1">${esc(ok)}</button></div></div>`;
  $ask.classList.add('show');
  return new Promise((res) => { askResolve = res; });
}
$ask.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ask]');
  if (!b && e.target !== $ask) return;
  $ask.classList.remove('show');
  const r = askResolve; askResolve = null;
  if (r) r(b?.dataset.ask === '1');
});

function go(path) { location.hash = `#/${path}`; }
function back() { history.length > 1 ? history.back() : go(''); }

function ctxFor(name, params) {
  const ui = uiState[name] || (uiState[name] = {});
  return { store, sync, printer, s: store.state, params, ui, uiOf: (n) => uiState[n] || (uiState[n] = {}), go, back, toast, ask, rerender, name };
}

function navHTML(active, badges) {
  return `<nav class="nav" aria-label="Seções">${NAV.map(([k, label, ic]) =>
    `<a href="#/${k}" class="${k === active ? 'on' : ''}" ${k === active ? 'aria-current="page"' : ''}>${icons[ic]}<span>${label}</span>${
      badges[k] ? `<b class="nbadge">${badges[k]}</b>` : ''}</a>`).join('')}</nav>`;
}

const DOT = { ok: ['#4e9a5f', 'Sincronizado'], pending: ['#c79a3d', 'Sincronizando…'], offline: ['#c79a3d', 'Sem internet — salvo neste aparelho'], error: ['#d9776d', 'Erro na sincronização'] };
function dotHTML() {
  if (!sync.configured) return '';
  const st = sync.status;
  const [color, label] = DOT[st.state] || DOT.pending;
  const extra = st.pending ? ` (${st.pending} pendente${st.pending > 1 ? 's' : ''})` : '';
  return `<span class="syncdot" id="syncdot" title="${esc(label + extra)}" aria-label="${esc(label + extra)}" style="background:${color}"></span>`;
}
function updateDot() {
  const el = document.getElementById('syncdot');
  if (el) el.outerHTML = dotHTML();
}

function badges() {
  const s = store;
  const cozinha = s.filaCozinha().length + s.filaSalao().length;
  const exp = s.pedidosAbertos().filter((p) => p.itens.every((i) => i.status === 'pronto')).length;
  const caixa = Object.keys(s.state.cards).length;
  return { cozinha, expedicao: exp, caixa };
}

function render() {
  const { name, params } = parseHash();
  const ctx = ctxFor(name, params);
  const scr = name === '' ? home : SCREENS[name];
  if (!scr) { go(''); return; }
  const view = scr.render(ctx);
  if (name === '') { $app.innerHTML = view.body; return; }
  const left = view.back ? `<button class="hbtn" data-action="__back" aria-label="Voltar">${icons.back}</button>` : '';
  $app.innerHTML = `
    <header class="hdr">${left}<div class="hdr-t"><div class="kicker">${esc(view.kicker || '')}</div><h1>${esc(view.title || '')}</h1></div>${dotHTML()}${view.right || ''}</header>
    <main id="main">${view.body}</main>
    ${view.footer ? `<div class="footer-bar">${view.footer}</div>` : ''}
    ${navHTML(name, badges())}
    ${view.modal ? `<div class="backdrop" data-action="__noop"><div class="sheet" data-stop>${view.modal}</div></div>` : ''}
    ${store.saveFailed ? '<div class="offline">Sem espaço para salvar neste aparelho</div>' : ''}`;
}

/** Re-renderiza preservando rolagem e, se pedido, o foco/cursor do campo digitado. */
function rerender(opts = {}) {
  const main = document.getElementById('main');
  const top = main ? main.scrollTop : 0;
  const sheetTop = document.querySelector('.sheet')?.scrollTop || 0;
  const a = document.activeElement;
  const key = a?.dataset?.input ? { k: a.dataset.input, id: a.dataset.id || '', s: a.selectionStart, e: a.selectionEnd } : null;
  render();
  const m2 = document.getElementById('main');
  if (m2) m2.scrollTop = top;
  const sh = document.querySelector('.sheet');
  if (sh) sh.scrollTop = sheetTop;
  if (key && opts.keepFocus !== false) {
    const sel = `[data-input="${key.k}"]${key.id ? `[data-id="${CSS.escape(key.id)}"]` : ''}`;
    const el = document.querySelector(sel);
    if (el) { el.focus(); try { el.setSelectionRange(key.s, key.e); } catch { /* campos sem seleção */ } }
  }
}

function currentScreen() {
  const { name } = parseHash();
  return name === '' ? home : SCREENS[name];
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === '__noop') { if (e.target === el) closeModal(); return; }
  e.preventDefault();
  const act = el.dataset.action;
  if (act === '__back') { back(); return; }
  const { name, params } = parseHash();
  const scr = currentScreen();
  const fn = scr?.actions?.[act];
  if (!fn) return;
  const ctx = ctxFor(name, params);
  const r = await fn(ctx, el, e);
  if (r !== false) rerender({ keepFocus: false });
});

function closeModal() {
  const { name } = parseHash();
  const ui = uiState[name];
  if (ui) { ui.modal = null; }
  rerender({ keepFocus: false });
}

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const { name, params } = parseHash();
  const fn = currentScreen()?.inputs?.[el.dataset.input];
  if (!fn) return;
  const r = fn(ctxFor(name, params), el, e);
  if (r !== false) rerender();
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const { name, params } = parseHash();
  const fn = currentScreen()?.changes?.[el.dataset.change];
  if (!fn) return;
  const r = fn(ctxFor(name, params), el, e);
  if (r !== false) rerender({ keepFocus: false });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target.closest('[data-enter]');
  if (!el) return;
  e.preventDefault();
  const { name, params } = parseHash();
  const fn = currentScreen()?.actions?.[el.dataset.enter];
  if (fn) Promise.resolve(fn(ctxFor(name, params), el, e)).then((r) => { if (r !== false) rerender({ keepFocus: false }); });
});

window.addEventListener('hashchange', () => { render(); document.getElementById('main')?.scrollTo(0, 0); });
store.subscribe(() => { /* ações já pedem rerender; isto cobre mudanças vindas de outra aba */ });
window.addEventListener('storage', (e) => { if (e.key === 'oliveiras.v1') { store.reload(); rerender({ keepFocus: false }); } });
// Atualiza a tela de tempos em tempos (fila da cozinha) sem atrapalhar quem está digitando.
setInterval(() => {
  const a = document.activeElement;
  if (document.hidden || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
  if (document.querySelector('.sheet')) return;
  const { name } = parseHash();
  if (name === 'cozinha' || name === 'expedicao') rerender({ keepFocus: false });
}, 30000);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
sync.start();
printer.start();
window.__oliveiras = { store, sync, printer }; // facilita testes e suporte
render();
