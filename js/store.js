// Estado do app + todas as regras de negócio. Sem DOM: roda igual no navegador e no Node (testes).
// Persistência: localStorage (neste aparelho). A sincronização entre aparelhos via
// Google Sheets/Apps Script entra depois, em cima destas mesmas ações.

import { makeSeed } from './seed.js';
import {
  DAYS, dateKey, dayKeyOf, rangeBounds, parseDecimal, timeHM, dateBR,
} from './util.js';
import {
  itemPrice, itemLabel, itemCategory, pesagemCents,
} from './pricing.js';

export const CARD_COUNT = 30;
export const PAGAMENTOS = { dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito', pix: 'PIX' };
export const CATS = {
  pesagem: 'Pesagem (Salão)',
  marmitex: 'Marmitex',
  pratos: 'Pratos Prontos',
  bebidas: 'Bebidas / Doces',
};
export const STORAGE_KEY = 'oliveiras.v1';

const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = (error) => ({ ok: false, error });

export function defaultStorage() {
  try {
    const ls = globalThis.localStorage;
    ls.setItem('__oliveiras_test', '1');
    ls.removeItem('__oliveiras_test');
    return ls;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
    };
  }
}

function deepMerge(base, extra) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function createStore({ storage = defaultStorage(), now = () => Date.now() } = {}) {
  let clockFn = now;
  const clock = () => clockFn();
  const subs = new Set();
  let saveFailed = false;
  let state = load();

  function normalize(loaded) {
    const seed = makeSeed();
    const out = { ...seed, ...loaded };
    out.prices = deepMerge(seed.prices, loaded.prices || {});
    out.menu = { ...seed.menu, ...(loaded.menu || {}) };
    for (const d of DAYS) out.menu[d] = { dishes: [], acomp: [], ...(out.menu[d] || {}) };
    for (const k of ['products', 'motoboys', 'pedidos', 'ledger']) out[k] = Array.isArray(out[k]) ? out[k] : [];
    out.cards = out.cards && typeof out.cards === 'object' ? out.cards : {};
    out.seq = { day: '', m: 0, pedido: 0, ...(out.seq || {}) };
    out.uid = Number.isInteger(out.uid) ? out.uid : 0;
    return out;
  }

  function load() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch { /* dados corrompidos: começa do padrão */ }
    return makeSeed();
  }

  function save() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveFailed = false;
    } catch {
      saveFailed = true;
    }
    subs.forEach((fn) => fn(state));
  }

  const uid = (p) => `${p}${(++state.uid).toString(36)}`;

  function rollDay() {
    const k = dateKey(clock());
    if (state.seq.day !== k) state.seq = { day: k, m: 0, pedido: 0 };
  }

  function ledgerAdd(cat, desc, amount, pagamento, ref) {
    if (!(amount > 0)) return;
    state.ledger.push({ id: uid('l'), ts: clock(), cat, desc, amount, pagamento, ref: ref || null });
  }

  const product = (id) => state.products.find((p) => p.id === id);
  const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);

  // ---------------------------------------------------------------- preços
  function setPrice(path, cents) {
    if (!Number.isInteger(cents) || cents < 0) return fail('Valor inválido');
    const keys = path.split('.');
    let obj = state.prices;
    for (const k of keys.slice(0, -1)) {
      obj = obj?.[k];
      if (!obj || typeof obj !== 'object') return fail('Preço não encontrado');
    }
    const last = keys[keys.length - 1];
    if (!(last in obj)) return fail('Preço não encontrado');
    obj[last] = cents;
    save();
    return ok();
  }

  // ---------------------------------------------------------------- cardápio
  const menuDay = (day) => state.menu[day];
  const LISTS = ['dishes', 'acomp'];

  function menuAdd(day, list, name) {
    if (!menuDay(day) || !LISTS.includes(list)) return fail('Dia inválido');
    const nm = String(name || '').trim();
    if (!nm) return fail('Digite o nome');
    if (menuDay(day)[list].some((x) => x.name.toLowerCase() === nm.toLowerCase())) return fail('Esse item já está na lista');
    const entry = list === 'dishes'
      ? { id: uid('d'), name: nm, tipo: /feijoada/i.test(nm) ? 'feijoada' : 'normal' }
      : { id: uid('a'), name: nm };
    menuDay(day)[list].push(entry);
    save();
    return ok({ entry });
  }

  function menuUpdate(day, list, id, patch) {
    const entry = menuDay(day)?.[list]?.find((x) => x.id === id);
    if (!entry) return fail('Item não encontrado');
    if ('name' in patch) {
      const nm = String(patch.name || '').trim();
      if (!nm) return fail('O nome não pode ficar vazio');
      entry.name = nm;
    }
    if ('tipo' in patch && list === 'dishes') entry.tipo = patch.tipo === 'feijoada' ? 'feijoada' : 'normal';
    save();
    return ok();
  }

  function menuRemove(day, list, id) {
    const arr = menuDay(day)?.[list];
    if (!arr) return fail('Dia inválido');
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return fail('Item não encontrado');
    arr.splice(i, 1);
    save();
    return ok();
  }

  function menuMove(day, list, id, dir) {
    const arr = menuDay(day)?.[list];
    if (!arr) return fail('Dia inválido');
    const i = arr.findIndex((x) => x.id === id);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= arr.length) return fail('Não dá para mover');
    [arr[i], arr[j]] = [arr[j], arr[i]];
    save();
    return ok();
  }

  function menuCopy(from, to) {
    if (!menuDay(from) || !menuDay(to) || from === to) return fail('Escolha outro dia');
    state.menu[to] = {
      dishes: menuDay(from).dishes.map((d) => ({ ...d, id: uid('d') })),
      acomp: menuDay(from).acomp.map((a) => ({ ...a, id: uid('a') })),
    };
    save();
    return ok();
  }

  // ---------------------------------------------------------------- produtos (venda rápida)
  function addProduct({ name, price, cat = 'bottle', grupo = 'bebida' }) {
    const nm = String(name || '').trim();
    if (!nm) return fail('Digite o nome do produto');
    if (!Number.isInteger(price) || price < 0) return fail('Preço inválido');
    const p = { id: uid('p'), name: nm, price, cat, grupo: grupo === 'doce' ? 'doce' : 'bebida' };
    state.products.push(p);
    save();
    return ok({ product: p });
  }

  function updateProduct(id, patch) {
    const p = product(id);
    if (!p) return fail('Produto não encontrado');
    if ('name' in patch) {
      const nm = String(patch.name || '').trim();
      if (!nm) return fail('O nome não pode ficar vazio');
      p.name = nm;
    }
    if ('price' in patch) {
      if (!Number.isInteger(patch.price) || patch.price < 0) return fail('Preço inválido');
      p.price = patch.price;
    }
    if ('cat' in patch) p.cat = patch.cat;
    if ('grupo' in patch) p.grupo = patch.grupo === 'doce' ? 'doce' : 'bebida';
    save();
    return ok();
  }

  function removeProduct(id) {
    const i = state.products.findIndex((p) => p.id === id);
    if (i < 0) return fail('Produto não encontrado');
    state.products.splice(i, 1);
    save();
    return ok();
  }

  // ---------------------------------------------------------------- motoboys
  function addMotoboy(name) {
    const nm = String(name || '').trim();
    if (!nm) return fail('Digite o nome do motoboy');
    const same = state.motoboys.find((m) => m.name.toLowerCase() === nm.toLowerCase());
    if (same && same.active) return fail('Esse motoboy já está na lista');
    if (same) {
      same.active = true;
      save();
      return ok({ motoboy: same });
    }
    const m = { id: uid('m'), name: nm, active: true };
    state.motoboys.push(m);
    save();
    return ok({ motoboy: m });
  }

  function removeMotoboy(id) {
    const m = state.motoboys.find((x) => x.id === id);
    if (!m) return fail('Motoboy não encontrado');
    m.active = false; // fica no histórico das entregas já feitas
    save();
    return ok();
  }

  // ---------------------------------------------------------------- cartões do salão (1..30)
  const cardTotal = (card) => sum(card.lines, (l) => l.amount);

  function checkCard(num) {
    const n = Number(num);
    if (!Number.isInteger(n) || n < 1 || n > CARD_COUNT) return null;
    return n;
  }

  /** Lança uma pesagem num cartão. `kg` aceita qualquer valor positivo (número ou texto). */
  function launchWeighing(num, kg) {
    const n = checkCard(num);
    if (n === null) return fail('Cartão inválido');
    const w = parseDecimal(kg);
    if (!Number.isFinite(w) || w <= 0) return fail('Digite um peso maior que zero');
    const perKg = state.prices.kg;
    const amount = pesagemCents(w, perKg);
    const card = state.cards[n] || (state.cards[n] = { num: n, openedAt: clock(), lines: [] });
    const line = { id: uid('w'), ts: clock(), type: 'peso', kg: w, perKg, amount };
    card.lines.push(line);
    save();
    return ok({ card, line, total: cardTotal(card) });
  }

  function undoLine(num, lineId) {
    const card = state.cards[num];
    if (!card) return fail('Cartão não está em uso');
    const i = card.lines.findIndex((l) => l.id === lineId);
    if (i < 0) return fail('Lançamento não encontrado');
    card.lines.splice(i, 1);
    if (!card.lines.length) delete state.cards[num];
    save();
    return ok();
  }

  function resolveItems(items) {
    const out = [];
    for (const it of items || []) {
      const qty = Number(it.qty);
      if (!(qty > 0)) continue;
      const p = product(it.productId);
      if (!p) return fail('Produto não encontrado');
      out.push({ productId: p.id, name: p.name, grupo: p.grupo, qty, unit: p.price, amount: p.price * qty });
    }
    if (!out.length) return fail('Escolha pelo menos um item');
    return ok({ lines: out });
  }

  function addCardItems(num, items) {
    const n = checkCard(num);
    const card = n && state.cards[n];
    if (!card) return fail('Esse cartão não está em uso');
    const r = resolveItems(items);
    if (!r.ok) return r;
    for (const l of r.lines) card.lines.push({ id: uid('i'), ts: clock(), type: 'item', ...l });
    save();
    return ok({ total: cardTotal(card) });
  }

  function closeCard(num, pagamento) {
    const card = state.cards[num];
    if (!card) return fail('Cartão não está em uso');
    if (!PAGAMENTOS[pagamento]) return fail('Escolha a forma de pagamento');
    const pesoTotal = sum(card.lines.filter((l) => l.type === 'peso'), (l) => l.amount);
    const itemTotal = sum(card.lines.filter((l) => l.type === 'item'), (l) => l.amount);
    const total = pesoTotal + itemTotal;
    ledgerAdd('pesagem', `Cartão ${num} · pesagem`, pesoTotal, pagamento, `c${num}`);
    ledgerAdd('bebidas', `Cartão ${num} · bebidas/doces`, itemTotal, pagamento, `c${num}`);
    delete state.cards[num];
    save();
    return ok({ total, pagamento });
  }

  /** Venda rápida sem comanda (paga na hora). */
  function sellQuick(items, pagamento) {
    if (!PAGAMENTOS[pagamento]) return fail('Escolha a forma de pagamento');
    const r = resolveItems(items);
    if (!r.ok) return r;
    const total = sum(r.lines, (l) => l.amount);
    const desc = `Venda rápida: ${r.lines.map((l) => `${l.qty}x ${l.name}`).join(', ')}`;
    ledgerAdd('bebidas', desc, total, pagamento, null);
    save();
    return ok({ total });
  }

  // ---------------------------------------------------------------- pedidos (marmitex / pratos)
  const pedidoTotal = (p) => p.subtotal + p.taxa;

  function createPedido(draft) {
    const itens = draft.itens || [];
    if (!itens.length) return fail('Adicione pelo menos um item ao pedido');
    const cliente = String(draft.cliente || '').trim();
    if (!cliente) return fail('Informe o nome do cliente');
    if (!PAGAMENTOS[draft.pagamento]) return fail('Escolha a forma de pagamento');
    const tipo = draft.tipo === 'entrega' ? 'entrega' : 'retirada';
    const endereco = String(draft.endereco || '').trim();
    if (tipo === 'entrega' && !endereco) return fail('Informe o bairro/endereço da entrega');
    const taxa = tipo === 'entrega' ? Number(draft.taxa ?? state.prices.entrega.taxaPadrao) : 0;
    if (!Number.isInteger(taxa) || taxa < 0) return fail('Taxa de entrega inválida');

    let bebidas = [];
    if ((draft.bebidas || []).some((b) => Number(b.qty) > 0)) {
      const r = resolveItems(draft.bebidas);
      if (!r.ok) return r;
      bebidas = r.lines.map(({ productId, name, qty, unit, amount }) => ({ productId, name, qty, unit, amount }));
    }

    rollDay();
    const built = [];
    try {
      for (const it of itens) {
        const price = itemPrice(state.prices, it);
        built.push({ ...it, price });
      }
    } catch (e) {
      return fail(e.message);
    }

    const pedido = {
      id: uid('o'),
      num: ++state.seq.pedido,
      ts: clock(),
      tipo,
      cliente,
      telefone: String(draft.telefone || '').trim(),
      endereco,
      taxa,
      pagamento: draft.pagamento,
      pixOk: false,
      obs: String(draft.obs || '').trim(),
      itens: built.map((it) => ({
        id: uid('t'),
        mid: `M-${String(++state.seq.m).padStart(3, '0')}`,
        kind: it.kind,
        size: it.size || null,
        modo: it.modo || null,
        tipo: it.tipo || null,
        dish: it.dish || '',
        label: itemLabel(it),
        acomp: [...(it.acomp || [])],
        price: it.price,
        status: 'preparo',
      })),
      bebidas,
      subtotal: 0,
      status: 'aguardando',
      motoboyId: null,
      motoboyNome: '',
      pagoMotoboy: 0,
      saiuAt: null,
      entregueAt: null,
    };
    pedido.subtotal = sum(pedido.itens, (i) => i.price) + sum(bebidas, (b) => b.amount);

    const ref = pedido.id;
    const tag = `Pedido #${pedido.num} · ${cliente}`;
    for (const cat of ['marmitex', 'pratos']) {
      ledgerAdd(cat, tag, sum(pedido.itens.filter((i) => itemCategory(i) === cat), (i) => i.price), pedido.pagamento, ref);
    }
    ledgerAdd('bebidas', `${tag} · bebidas`, sum(bebidas, (b) => b.amount), pedido.pagamento, ref);
    ledgerAdd('taxa', `${tag} · taxa de entrega`, taxa, pedido.pagamento, ref);

    state.pedidos.push(pedido);
    save();
    return ok({ pedido });
  }

  const findPedido = (id) => state.pedidos.find((p) => p.id === id);
  const pedidoReady = (p) => p.itens.length > 0 && p.itens.every((i) => i.status === 'pronto');
  const pixBlocked = (p) => p.pagamento === 'pix' && !p.pixOk;

  function setItemReady(pedidoId, itemId, ready) {
    const p = findPedido(pedidoId);
    const it = p?.itens.find((i) => i.id === itemId);
    if (!it) return fail('Item não encontrado');
    it.status = ready ? 'pronto' : 'preparo';
    // voltar para o preparo desfaz um despacho que ainda não foi entregue
    if (!ready && p.status === 'saiu') {
      p.status = 'aguardando';
      p.motoboyId = null; p.motoboyNome = ''; p.pagoMotoboy = 0; p.saiuAt = null;
    }
    save();
    return ok();
  }

  function setPixOk(pedidoId, value) {
    const p = findPedido(pedidoId);
    if (!p) return fail('Pedido não encontrado');
    p.pixOk = !!value;
    save();
    return ok();
  }

  function dispatch(pedidoId, motoboyId) {
    const p = findPedido(pedidoId);
    if (!p) return fail('Pedido não encontrado');
    if (p.tipo !== 'entrega') return fail('Este pedido é para retirada');
    if (p.status !== 'aguardando') return fail('Este pedido já saiu');
    if (!pedidoReady(p)) return fail('Ainda há marmitex em preparo');
    if (pixBlocked(p)) return fail('Aguardando o comprovante do PIX');
    const m = state.motoboys.find((x) => x.id === motoboyId && x.active);
    if (!m) return fail('Escolha o motoboy');
    p.status = 'saiu';
    p.motoboyId = m.id;
    p.motoboyNome = m.name;
    p.pagoMotoboy = state.prices.entrega.pagamentoMotoboy;
    p.saiuAt = clock();
    save();
    return ok();
  }

  function undoDispatch(pedidoId) {
    const p = findPedido(pedidoId);
    if (!p || p.status !== 'saiu') return fail('Pedido não está na rua');
    p.status = 'aguardando';
    p.motoboyId = null; p.motoboyNome = ''; p.pagoMotoboy = 0; p.saiuAt = null;
    save();
    return ok();
  }

  function markDelivered(pedidoId) {
    const p = findPedido(pedidoId);
    if (!p || p.status !== 'saiu') return fail('Pedido não está na rua');
    p.status = 'entregue';
    p.entregueAt = clock();
    save();
    return ok();
  }

  function undoDelivered(pedidoId) {
    const p = findPedido(pedidoId);
    if (!p || p.status !== 'entregue') return fail('Pedido não foi entregue');
    p.status = 'saiu';
    p.entregueAt = null;
    save();
    return ok();
  }

  function markPickedUp(pedidoId) {
    const p = findPedido(pedidoId);
    if (!p) return fail('Pedido não encontrado');
    if (p.tipo !== 'retirada') return fail('Este pedido é para entrega');
    if (p.status !== 'aguardando') return fail('Pedido já finalizado');
    if (!pedidoReady(p)) return fail('Ainda há marmitex em preparo');
    if (pixBlocked(p)) return fail('Aguardando o comprovante do PIX');
    p.status = 'retirado';
    p.entregueAt = clock();
    save();
    return ok();
  }

  function undoPickedUp(pedidoId) {
    const p = findPedido(pedidoId);
    if (!p || p.status !== 'retirado') return fail('Pedido não foi retirado');
    p.status = 'aguardando';
    p.entregueAt = null;
    save();
    return ok();
  }

  function cancelPedido(pedidoId) {
    const p = findPedido(pedidoId);
    if (!p) return fail('Pedido não encontrado');
    if (p.status === 'cancelado') return fail('Pedido já cancelado');
    p.status = 'cancelado';
    state.ledger = state.ledger.filter((l) => l.ref !== p.id);
    save();
    return ok();
  }

  // ---------------------------------------------------------------- consultas
  const today = () => dateKey(clock());
  const sameDay = (ts) => dateKey(ts) === today();

  /** Pedidos com algo ainda a fazer (cozinha/expedição), mais os finalizados hoje. */
  function pedidosAbertos() {
    return state.pedidos.filter((p) => p.status === 'aguardando' || p.status === 'saiu');
  }

  function filaCozinha() {
    return pedidosAbertos()
      .filter((p) => p.itens.some((i) => i.status === 'preparo'))
      .sort((a, b) => a.ts - b.ts);
  }

  function finalizadosHoje() {
    return state.pedidos
      .filter((p) => (p.status === 'entregue' || p.status === 'retirado') && sameDay(p.entregueAt || p.ts))
      .sort((a, b) => (b.entregueAt || 0) - (a.entregueAt || 0));
  }

  function summary(kind) {
    const [from, to] = rangeBounds(kind, clock());
    const inRange = (ts) => ts >= from && ts < to;
    const entries = state.ledger.filter((l) => inRange(l.ts));
    const byCat = { pesagem: 0, marmitex: 0, pratos: 0, bebidas: 0 };
    const byPagamento = { dinheiro: 0, debito: 0, credito: 0, pix: 0 };
    let taxas = 0;
    for (const l of entries) {
      if (l.cat === 'taxa') taxas += l.amount;
      else byCat[l.cat] = (byCat[l.cat] || 0) + l.amount;
      if (byPagamento[l.pagamento] !== undefined) byPagamento[l.pagamento] += l.amount;
    }
    const total = sum(Object.values(byCat), (v) => v);

    const trips = new Map();
    for (const p of state.pedidos) {
      if (p.status !== 'entregue' || p.tipo !== 'entrega' || !inRange(p.entregueAt || 0)) continue;
      const row = trips.get(p.motoboyId) || { id: p.motoboyId, nome: p.motoboyNome, viagens: 0, valor: 0 };
      row.viagens += 1;
      row.valor += p.pagoMotoboy;
      trips.set(p.motoboyId, row);
    }
    const motoboys = [...trips.values()].sort((a, b) => b.viagens - a.viagens || a.nome.localeCompare(b.nome));
    const custoMotoboys = sum(motoboys, (m) => m.valor);
    const nPedidos = state.pedidos.filter((p) => p.status !== 'cancelado' && inRange(p.ts)).length;
    return {
      from, to, total, byCat, byPagamento, taxas, motoboys, custoMotoboys,
      viagens: sum(motoboys, (m) => m.viagens), nPedidos,
    };
  }

  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  /** CSV (separador ;) com vírgula decimal, pronto para abrir no Excel/Planilhas brasileiro. */
  function ledgerCSV() {
    const head = ['Data', 'Hora', 'Categoria', 'Descrição', 'Valor (R$)', 'Pagamento'];
    const rows = [...state.ledger].sort((a, b) => a.ts - b.ts).map((l) => [
      dateBR(l.ts), timeHM(l.ts),
      l.cat === 'taxa' ? 'Taxa de entrega' : CATS[l.cat] || l.cat,
      l.desc, (l.amount / 100).toFixed(2).replace('.', ','), PAGAMENTOS[l.pagamento] || l.pagamento,
    ]);
    return `﻿${[head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')}`;
  }

  // ---------------------------------------------------------------- dados
  function exportJSON() {
    return JSON.stringify({ app: 'oliveiras', exportedAt: clock(), data: state }, null, 1);
  }

  function importJSON(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { return fail('Arquivo inválido'); }
    const data = parsed?.data || parsed;
    if (!data || typeof data !== 'object' || !data.prices || !data.menu || !Array.isArray(data.ledger)) {
      return fail('Este arquivo não é um backup do Oliveira\'s');
    }
    state = normalize(data);
    save();
    return ok();
  }

  /** Apaga vendas, pedidos e cartões (ex.: depois dos testes). Preços, cardápio e produtos ficam. */
  function resetOperational() {
    state.cards = {};
    state.pedidos = [];
    state.ledger = [];
    state.seq = { day: '', m: 0, pedido: 0 };
    save();
    return ok();
  }

  function resetAll() {
    state = makeSeed();
    save();
    return ok();
  }

  function reload() {
    state = load();
    subs.forEach((fn) => fn(state));
  }

  return {
    get state() { return state; },
    get saveFailed() { return saveFailed; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    now: clock,
    setClock(fn) { clockFn = fn || now; },
    today,
    todayKey: () => dayKeyOf(clock()),
    // preços
    setPrice,
    // cardápio
    menuAdd, menuUpdate, menuRemove, menuMove, menuCopy,
    // produtos
    addProduct, updateProduct, removeProduct,
    // motoboys
    addMotoboy, removeMotoboy,
    // salão
    launchWeighing, undoLine, addCardItems, closeCard, sellQuick, cardTotal,
    // pedidos
    createPedido, setItemReady, setPixOk, dispatch, undoDispatch, markDelivered, undoDelivered,
    markPickedUp, undoPickedUp, cancelPedido, pedidoReady, pedidoTotal, pixBlocked,
    // consultas
    filaCozinha, pedidosAbertos, finalizadosHoje, summary, ledgerCSV,
    // dados
    exportJSON, importJSON, resetOperational, resetAll, reload,
  };
}
