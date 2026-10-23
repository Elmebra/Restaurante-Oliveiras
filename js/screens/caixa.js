// Caixa: fecha cartões (1–30) e venda rápida de bebidas/doces (avulsa ou vinculada a um cartão).
import { icons, productIcon } from '../icons.js';
import { money, esc, timeHM, parseMoney, centsToInput, fmtKg } from '../util.js';
import { PAGAMENTOS, CARD_COUNT } from '../store.js';

function payBtns(ui) {
  return `<div class="seg c4">${Object.entries(PAGAMENTOS).map(([k, l]) => `<button class="chip ${ui.pag === k ? 'on' : ''}" data-action="pag" data-v="${k}">${l}</button>`).join('')}</div>`;
}

function listView({ store, s, ui }) {
  const open = Object.values(s.cards).sort((a, b) => a.num - b.num);
  const cells = [];
  for (let n = 1; n <= CARD_COUNT; n += 1) {
    const c = s.cards[n];
    cells.push(`<button class="cardnum ${c ? 'used' : ''}" ${c ? '' : 'disabled'} data-action="openCard" data-v="${n}" aria-label="Cartão ${n}">${n}</button>`);
  }
  return {
    kicker: 'MODO CAIXA', title: 'Comandas abertas', back: true,
    body: `<button class="btn block gold mb12" data-action="venda">${icons.plus} Venda rápida (bebidas e doces)</button>
      <div class="sec" style="margin-top:4px">Cartões em uso (${open.length})</div>
      ${open.map((c) => `<button class="profile" style="padding:12px 14px" data-action="openCard" data-v="${c.num}"><span class="mid">${c.num}</span>
        <span class="grow"><div class="pt">Cartão ${c.num}</div><div class="ps">${c.lines.length} lançamento(s) · desde ${timeHM(c.openedAt)}</div></span><b>${money(store.cardTotal(c))}</b></button>`).join('') || '<div class="empty">Nenhum cartão em uso.</div>'}
      <div class="sec">Todos os cartões</div><div class="cards">${cells.join('')}</div>`,
  };
}

function cardView({ store, s, ui, params }) {
  const n = Number(params[1]);
  const c = s.cards[n];
  if (!c) return { kicker: 'CAIXA', title: `Cartão ${n}`, back: true, body: '<div class="empty">Este cartão não está em uso (já foi pago ou nunca foi lançado).</div>' };
  const total = store.cardTotal(c);
  const lines = c.lines.map((l) => `<div class="line"><div class="grow"><b>${l.type === 'peso' ? `Pesagem ${fmtKg(l.kg)} kg` : `${l.qty}x ${esc(l.name)}`}</b><div class="muted">${timeHM(l.ts)}${l.type === 'prato' ? (l.status === 'pronto' ? ' · pronto' : ' · na cozinha') : ''}</div></div>
    <div class="row"><b>${money(l.amount)}</b><button class="iconbtn danger" data-action="rmLine" data-l="${l.id}" aria-label="Remover lançamento">${icons.x}</button></div></div>`).join('');
  const dinheiro = ui.pag === 'dinheiro';
  const recebido = parseMoney(ui.recebido);
  const troco = dinheiro && Number.isFinite(recebido) ? recebido - total : null;
  const modal = ui.modal === 'pay' ? `<div class="grab"></div><h3>Receber · cartão ${n}</h3>
    <div class="total-card mt12"><div><div class="l">TOTAL</div><div class="t">${money(total)}</div></div></div>
    <div class="h3" style="margin-top:0">Forma de pagamento</div>${payBtns(ui)}
    ${dinheiro ? `<label class="field mt12"><span class="lbl">Valor recebido (opcional)</span><div class="money"><span>R$</span><input class="inp" data-input="recebido" inputmode="decimal" value="${esc(ui.recebido || '')}"></div></label>
      ${troco !== null ? `<div class="note ${troco >= 0 ? 'ok' : 'err'}">${troco >= 0 ? `Troco: ${money(troco)}` : `Faltam ${money(-troco)}`}</div>` : ''}` : ''}
    <div class="row mt16"><button class="btn ghost grow" data-action="closePay">Voltar</button>
    <button class="btn grow ${ui.pag ? '' : 'off'}" data-action="confirmPay">${icons.check} Confirmar pagamento</button></div>` : '';
  return {
    kicker: 'CAIXA', title: `Cartão ${n}`, back: true,
    body: `<div class="card">${lines}<div class="between mt12"><span class="strong">Total</span><b style="font:700 24px var(--font-title);color:var(--green)">${money(total)}</b></div></div>
      <button class="btn block ghost mb8" data-action="addItems" data-v="${n}">${icons.plus} Adicionar bebida/doce neste cartão</button>
      <button class="btn block ghost" data-action="addDishes" data-v="${n}">${icons.plus} Adicionar prato neste cartão</button>`,
    footer: `<button class="btn block" data-action="openPay">${icons.cash} Receber e devolver cartão</button>`,
    modal,
  };
}

function vendaView({ s, ui, params }) {
  const link = ui.link || null; // número do cartão, ou null = avulsa
  ui.cart = ui.cart || {};
  const total = Object.entries(ui.cart).reduce((t, [id, q]) => t + (s.products.find((p) => p.id === id)?.price || 0) * q, 0);
  const count = Object.values(ui.cart).reduce((t, q) => t + q, 0);
  const open = Object.keys(s.cards).map(Number).sort((a, b) => a - b);
  const grupos = [['bebida', 'Bebidas'], ['doce', 'Doces']];
  const cards = grupos.map(([g, l]) => `<div class="sec">${l}</div><div class="pcards">${s.products.filter((p) => p.grupo === g).map((p) => `
    <div class="pcard ${ui.cart[p.id] ? 'has' : ''}"><div class="picon" style="background:${g === 'doce' ? '#8a5a2b' : '#2e6f9e'}">${productIcon(p.cat)}</div>
      <div class="pn">${esc(p.name)}</div><div class="pp">${money(p.price)}</div>
      <div class="stepper"><button data-action="dec" data-v="${p.id}" aria-label="Menos">−</button><span class="q">${ui.cart[p.id] || 0}</span><button data-action="inc" data-v="${p.id}" aria-label="Mais">+</button></div></div>`).join('')}</div>`).join('');
  const dinheiro = ui.pag === 'dinheiro';
  const recebido = parseMoney(ui.recebido);
  const troco = dinheiro && Number.isFinite(recebido) ? recebido - total : null;
  const modal = ui.modal === 'payq' ? `<div class="grab"></div><h3>Venda rápida · ${money(total)}</h3>
    <div class="h3">Forma de pagamento</div>${payBtns(ui)}
    ${dinheiro ? `<label class="field mt12"><span class="lbl">Valor recebido (opcional)</span><div class="money"><span>R$</span><input class="inp" data-input="recebido" inputmode="decimal" value="${esc(ui.recebido || '')}"></div></label>
      ${troco !== null ? `<div class="note ${troco >= 0 ? 'ok' : 'err'}">${troco >= 0 ? `Troco: ${money(troco)}` : `Faltam ${money(-troco)}`}</div>` : ''}` : ''}
    <div class="row mt16"><button class="btn ghost grow" data-action="closePay">Voltar</button>
    <button class="btn grow ${ui.pag ? '' : 'off'}" data-action="confirmQuick">${icons.check} Confirmar</button></div>` : '';
  return {
    kicker: 'VENDA RÁPIDA', title: 'Bebidas e doces', back: true,
    body: `<div class="h3" style="margin-top:0">Vincular a</div>
      <div class="chips mb12"><button class="chip ${link === null ? 'on' : ''}" data-action="link" data-v="">Avulsa (paga agora)</button>
      ${open.map((n) => `<button class="chip ${link === n ? 'on' : ''}" data-action="link" data-v="${n}">Cartão ${n}</button>`).join('')}</div>${cards}`,
    footer: `<button class="btn block ${count ? '' : 'off'}" data-action="${link ? 'addToCard' : 'openPayQ'}">${link ? `Lançar no cartão ${link}` : 'Cobrar'} · ${count} item(ns) · ${money(total)}</button>`,
    modal,
  };
}

export default {
  render(ctx) {
    if (ctx.params[0] === 'venda') return vendaView(ctx);
    if (ctx.params[0] === 'cartao') return cardView(ctx);
    return listView(ctx);
  },
  actions: {
    openCard({ go }, el) { go(`caixa/cartao/${el.dataset.v}`); return false; },
    venda({ go, ui }) { ui.cart = {}; ui.link = null; ui.pag = ''; ui.recebido = ''; go('caixa/venda'); return false; },
    addItems({ go, ui }, el) { ui.cart = {}; ui.link = Number(el.dataset.v); go('caixa/venda'); return false; },
    addDishes({ go, uiOf }, el) { const b = uiOf('balanca'); b.mode = 'pratos'; b.card = Number(el.dataset.v); b.dishes = {}; go('balanca'); return false; },
    link({ ui }, el) { ui.link = el.dataset.v ? Number(el.dataset.v) : null; },
    inc({ ui }, el) { ui.cart[el.dataset.v] = (ui.cart[el.dataset.v] || 0) + 1; },
    dec({ ui }, el) { const q = (ui.cart[el.dataset.v] || 0) - 1; if (q > 0) ui.cart[el.dataset.v] = q; else delete ui.cart[el.dataset.v]; },
    addToCard({ store, ui, toast, go }) {
      const r = store.addCardItems(ui.link, Object.entries(ui.cart).map(([productId, qty]) => ({ productId, qty })));
      if (!r.ok) { toast(r.error, 'err'); return false; }
      toast(`Lançado no cartão ${ui.link}`, 'ok');
      const n = ui.link; ui.cart = {};
      go(`caixa/cartao/${n}`); return false;
    },
    openPayQ({ ui }) { ui.modal = 'payq'; ui.pag = ''; ui.recebido = ''; },
    confirmQuick({ store, ui, toast, go }) {
      const r = store.sellQuick(Object.entries(ui.cart).map(([productId, qty]) => ({ productId, qty })), ui.pag);
      if (!r.ok) { toast(r.error, 'err'); return false; }
      toast(`Venda registrada: ${money(r.total)}`, 'ok');
      ui.cart = {}; ui.modal = null; go('caixa'); return false;
    },
    rmLine({ store, ui, toast, params, go }, el) {
      const n = Number(params[1]);
      const r = store.undoLine(n, el.dataset.l);
      if (!r.ok) { toast(r.error, 'err'); return false; }
      if (!store.state.cards[n]) { toast('Cartão ficou vazio e foi liberado'); go('caixa'); return false; }
    },
    openPay({ ui }) { ui.modal = 'pay'; ui.pag = ''; ui.recebido = ''; },
    closePay({ ui }) { ui.modal = null; },
    pag({ ui }, el) { ui.pag = el.dataset.v; },
    confirmPay({ store, ui, toast, params, go }) {
      const n = Number(params[1]);
      const r = store.closeCard(n, ui.pag);
      if (!r.ok) { toast(r.error, 'err'); return false; }
      toast(`Cartão ${n} pago (${money(r.total)}) — cartão devolvido`, 'ok');
      ui.modal = null; go('caixa'); return false;
    },
  },
  inputs: { recebido({ ui }, el) { ui.recebido = el.value; } },
};
