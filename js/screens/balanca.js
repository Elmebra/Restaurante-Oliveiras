// Balança manual: o operador digita QUALQUER peso, escolhe o cartão (1–30) e lança.
import { icons } from '../icons.js';
import { money, parseDecimal, fmtKg, esc, timeHM } from '../util.js';
import { pesagemCents, itemPrice } from '../pricing.js';
import { CARD_COUNT } from '../store.js';

function weightKg(ui) {
  const n = parseDecimal(ui.peso);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return ui.unit === 'g' ? n / 1000 : n;
}

const DISHES = [
  ['feito', 'Prato Feito', 'Só no restaurante'],
  ['feijoada', 'Prato Feijoada', 'Só no restaurante'],
  ['sepM', 'Feijoada separada · Média', 'Restaurante'],
  ['sepG', 'Feijoada separada · Grande', 'Restaurante'],
];

function pratosView({ s, ui, store }) {
  ui.dishes = ui.dishes || {};
  const price = (k) => itemPrice(s.prices, store.salaoItem(k));
  const total = DISHES.reduce((t, [k]) => t + (ui.dishes[k] || 0) * price(k), 0);
  const count = DISHES.reduce((t, [k]) => t + (ui.dishes[k] || 0), 0);
  const cells = [];
  for (let n = 1; n <= CARD_COUNT; n += 1) {
    cells.push(`<button class="cardnum ${s.cards[n] ? 'used' : ''} ${ui.card === n ? 'sel' : ''}" data-action="pickCard" data-v="${n}" aria-label="Cartão ${n}">${n}</button>`);
  }
  return {
    kicker: 'MODO BALANÇA', title: 'Comanda · pratos', back: true,
    body: `${tabs(ui)}
      <div class="note blue mb12">Tudo que é servido no restaurante vai numa comanda (cartão). A cozinha recebe o aviso na hora.</div>
      <div class="card">${DISHES.map(([k, l, sub]) => `<div class="pricerow"><div class="lbl"><b>${l}</b><span class="hint">${sub} · ${money(price(k))}</span></div>
        <div class="stepper"><button data-action="dDec" data-v="${k}" aria-label="Menos">−</button><span class="q">${ui.dishes[k] || 0}</span><button data-action="dInc" data-v="${k}" aria-label="Mais">+</button></div></div>`).join('')}</div>
      <div class="sec" style="margin-top:4px">Cartão do cliente</div><div class="cards">${cells.join('')}</div>`,
    footer: `<button class="btn block ${count && ui.card ? '' : 'off'}" data-action="launchDishes">${icons.check} Lançar${ui.card ? ` no cartão ${ui.card}` : ''}${count ? ` · ${money(total)}` : ''}</button>`,
  };
}

const tabs = (ui) => `<div class="tabs"><button class="${ui.mode !== 'pratos' ? 'on' : ''}" data-action="mode" data-v="peso">Pesar prato</button><button class="${ui.mode === 'pratos' ? 'on' : ''}" data-action="mode" data-v="pratos">Pratos / feijoada</button></div>`;

export default {
  render(ctx) {
    if (ctx.ui.mode === 'pratos') return pratosView(ctx);
    return this.pesar(ctx);
  },
  pesar({ s, ui, store }) {
    ui.unit = ui.unit || 'kg';
    ui.peso = ui.peso ?? '';
    const kg = weightKg(ui);
    const valid = Number.isFinite(kg);
    const amount = valid ? pesagemCents(kg, s.prices.kg) : 0;
    const heavy = valid && kg >= 5;
    const cells = [];
    for (let n = 1; n <= CARD_COUNT; n += 1) {
      const used = !!s.cards[n];
      cells.push(`<button class="cardnum ${used ? 'used' : ''} ${ui.card === n ? 'sel' : ''}" data-action="pickCard" data-v="${n}" aria-label="Cartão ${n}${used ? ' em uso' : ''}">${n}</button>`);
    }
    const last = ui.last
      ? `<div class="note ok mb12 row"><span class="grow">Lançado: cartão ${ui.last.num} · ${fmtKg(ui.last.kg)} kg · ${money(ui.last.amount)}</span>
         <button class="btn xs ghost" data-action="undoLast">${icons.undo} Desfazer</button></div>` : '';
    const sel = ui.card ? s.cards[ui.card] : null;
    const prevTotal = sel ? store.cardTotal(sel) : 0;
    return {
      kicker: 'MODO BALANÇA', title: 'Pesagem do prato', back: true,
      body: `${tabs(ui)}${last}
        <div class="card scale">
          <div class="lbl-caps">PESO DO PRATO</div>
          <div class="peso-row">
            <input class="peso-input" id="peso" data-input="peso" data-enter="launch" inputmode="decimal" autocomplete="off"
              placeholder="0,000" value="${esc(ui.peso)}" aria-label="Peso do prato">
            <div class="unit"><button data-action="unit" data-v="kg" class="${ui.unit === 'kg' ? 'on' : ''}">kg</button>
              <button data-action="unit" data-v="g" class="${ui.unit === 'g' ? 'on' : ''}">g</button></div>
          </div>
          <div class="muted">Digite o peso que aparece na balança (ex.: 0,850 ou 850 g). Preço: ${money(s.prices.kg)} / kg</div>
          ${heavy ? `<div class="note mt8">Peso alto (${fmtKg(kg)} kg). Se era para ser gramas, <button class="btn xs gold" data-action="useGrams">usar gramas</button></div>` : ''}
        </div>
        <div class="total-card"><div><div class="l">VALOR DO PRATO</div><div class="t" id="valor">${valid ? money(amount) : 'R$ 0,00'}</div></div>
          <div class="right small" style="opacity:.8">${valid ? `${fmtKg(kg)} kg × ${money(s.prices.kg)}` : 'aguardando peso'}</div></div>
        <div class="sec" style="margin-top:4px">Cartão do cliente</div>
        <div class="cards">${cells.join('')}</div>
        <div class="legend"><span><i></i>livre</span><span><i class="u"></i>em uso (outro prato do mesmo cliente)</span><span><i class="s"></i>escolhido</span></div>
        ${sel ? `<div class="note blue mt12">Cartão ${ui.card} já tem ${money(prevTotal)}. O novo prato será somado.</div>` : ''}`,
      footer: `<button class="btn block ${valid && ui.card ? '' : 'off'}" data-action="launch">${icons.check} Lançar${ui.card ? ` no cartão ${ui.card}` : ''}${valid ? ` · ${money(amount)}` : ''}</button>`,
    };
  },
  actions: {
    mode({ ui }, el) { ui.mode = el.dataset.v; },
    dInc({ ui }, el) { ui.dishes = ui.dishes || {}; ui.dishes[el.dataset.v] = (ui.dishes[el.dataset.v] || 0) + 1; },
    dDec({ ui }, el) { ui.dishes = ui.dishes || {}; ui.dishes[el.dataset.v] = Math.max(0, (ui.dishes[el.dataset.v] || 0) - 1); },
    launchDishes({ store, ui, toast }) {
      const items = Object.entries(ui.dishes || {}).map(([key, qty]) => ({ key, qty }));
      if (!items.some((i) => i.qty > 0)) { toast('Escolha o prato', 'err'); return false; }
      if (!ui.card) { toast('Escolha o número do cartão', 'err'); return false; }
      const r = store.addCardDishes(ui.card, items);
      if (!r.ok) { toast(r.error, 'err'); return false; }
      toast(`Cartão ${ui.card}: enviado para a cozinha`, 'ok');
      ui.dishes = {}; ui.card = null;
    },
    pickCard({ ui }, el) { ui.card = Number(el.dataset.v) === ui.card ? null : Number(el.dataset.v); },
    unit({ ui }, el) { ui.unit = el.dataset.v; },
    useGrams({ ui }) { ui.unit = 'g'; },
    launch({ store, ui, toast }) {
      const kg = weightKg(ui);
      if (!Number.isFinite(kg)) { toast('Digite o peso do prato', 'err'); return false; }
      if (!ui.card) { toast('Escolha o número do cartão', 'err'); return false; }
      const r = store.launchWeighing(ui.card, kg);
      if (!r.ok) { toast(r.error, 'err'); return false; }
      ui.last = { num: ui.card, lineId: r.line.id, kg, amount: r.line.amount };
      toast(`Cartão ${ui.card}: ${money(r.line.amount)}`, 'ok');
      ui.peso = ''; ui.card = null;
      setTimeout(() => document.getElementById('peso')?.focus(), 0);
      return true;
    },
    undoLast({ store, ui, toast }) {
      if (!ui.last) return;
      const r = store.undoLine(ui.last.num, ui.last.lineId);
      toast(r.ok ? 'Lançamento desfeito' : r.error, r.ok ? '' : 'err');
      ui.last = null;
    },
  },
  inputs: {
    peso({ ui }, el) { ui.peso = el.value; },
  },
};
