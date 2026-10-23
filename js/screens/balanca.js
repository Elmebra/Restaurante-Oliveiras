// Balança manual: o operador digita QUALQUER peso, escolhe o cartão (1–30) e lança.
import { icons } from '../icons.js';
import { money, parseDecimal, fmtKg, esc, timeHM } from '../util.js';
import { pesagemCents } from '../pricing.js';
import { CARD_COUNT } from '../store.js';

function weightKg(ui) {
  const n = parseDecimal(ui.peso);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return ui.unit === 'g' ? n / 1000 : n;
}

export default {
  render({ s, ui, store }) {
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
      body: `${last}
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
