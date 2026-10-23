// Cozinha: fila de montagem (por pedido) + tela de novo pedido de marmitex/pratos.
import { icons, productIcon } from '../icons.js';
import { money, esc, timeHM, parseMoney, centsToInput, DAYS, WEEK_ORDER, DAY_NAMES, DAY_SHORT } from '../util.js';
import { SIZES, MODOS, sizesFor, itemPrice, itemLabel } from '../pricing.js';
import { PAGAMENTOS } from '../store.js';

const freshCur = () => ({ kind: 'marmitex', size: 'M', modo: 'individual', dish: '', dishText: '', acomp: [] });
function freshDraft(store) {
  return {
    day: store.todayKey(), itens: [], cur: freshCur(), bebidas: {}, showBebidas: false,
    cliente: '', telefone: '', tipo: 'entrega', endereco: '', taxa: null, pagamento: '', obs: '',
  };
}

/** Item "efetivo" a partir da seleção atual (prato de feijoada vira kind feijoada). */
function buildItem(cur, menu) {
  const dishObj = menu.dishes.find((d) => d.name === cur.dish);
  const dish = (cur.dish || cur.dishText || '').trim();
  const acomp = [...cur.acomp];
  if (cur.kind === 'pratofeijoada') return { kind: 'prato', tipo: 'feijoada', dish: '', acomp };
  if (cur.kind === 'pratofeito') return { kind: 'prato', tipo: 'feito', dish, acomp };
  if (dishObj?.tipo === 'feijoada') {
    const size = cur.size === 'P' ? 'M' : cur.size;
    return { kind: 'feijoada', modo: cur.modo, size, dish, acomp };
  }
  return { kind: 'marmitex', size: cur.size, dish, acomp };
}
const needsDish = (cur) => cur.kind !== 'pratofeijoada';

function queueView({ store, s, ui }) {
  const fila = store.filaCozinha();
  const dia = store.todayKey();
  const m = s.menu[dia];
  const menuCard = `<div class="card flat"><div class="between"><div class="strong">Cardápio de hoje · ${DAY_NAMES[dia]}</div></div>
    ${m.dishes.length ? `<ul class="dishes mt8">${m.dishes.map((d) => `<li>• ${esc(d.name)}${d.tipo === 'feijoada' ? ' <span class="tag">feijoada</span>' : ''}</li>`).join('')}</ul>`
    : '<div class="muted mt8">Sem cardápio cadastrado para hoje (edite no Painel do Dono).</div>'}</div>`;
  const cards = fila.map((p) => {
    const sub = p.tipo === 'entrega' ? `Entrega · ${esc(p.endereco)}` : 'Retirada no balcão';
    return `<div class="card">
      <div class="between"><div><div class="strong">Pedido #${p.num} · ${esc(p.cliente)}</div><div class="muted">${timeHM(p.ts)} · ${sub}</div></div>
        <span class="tag ${p.itens.every((i) => i.status === 'pronto') ? 'green' : ''}">${p.itens.filter((i) => i.status === 'pronto').length}/${p.itens.length} prontos</span></div>
      ${p.obs ? `<div class="note mt8">Obs.: ${esc(p.obs)}</div>` : ''}
      ${p.itens.map((i) => `<div class="item ${i.status === 'pronto' ? 'done' : ''}">
        <span class="mid ${i.status === 'pronto' ? 'ready' : ''}">${i.mid}</span>
        <div class="grow"><div class="lab">${esc(i.label)}</div>${i.acomp.length ? `<div class="sub">+ ${esc(i.acomp.join(', '))}</div>` : ''}</div>
        <button class="btn xs ${i.status === 'pronto' ? 'ghost' : ''}" data-action="ready" data-p="${p.id}" data-i="${i.id}" data-v="${i.status === 'pronto' ? 0 : 1}">${i.status === 'pronto' ? 'Desfazer' : `${''}Pronto`}</button></div>`).join('')}
      ${p.bebidas.length ? `<div class="muted mt8">Bebidas: ${esc(p.bebidas.map((b) => `${b.qty}x ${b.name}`).join(', '))}</div>` : ''}
      <div class="mt8"><button class="btn xs danger" data-action="cancel" data-p="${p.id}">Cancelar pedido</button></div></div>`;
  }).join('');
  return {
    kicker: 'MODO COZINHA', title: 'Fila de montagem', back: true,
    right: `<button class="hbtn gold" data-action="novo" aria-label="Novo pedido">${icons.plus}</button>`,
    body: `${menuCard}<div class="sec">Em preparo (${fila.length})</div>
      ${cards || '<div class="empty">Nenhum pedido em preparo.<br>Toque em + para lançar um pedido.</div>'}`,
    footer: `<button class="btn block" data-action="novo">${icons.plus} Novo pedido de marmitex</button>`,
    modal: ui.modal?.type === 'mids' ? midsModal(ui.modal.pedido) : '',
  };
}

function midsModal(p) {
  return `<div class="grab"></div><h3>Pedido #${p.num} lançado</h3>
    <div class="muted">Escreva a caneta na tampa de cada marmitex:</div>
    <div class="bigmid">${p.itens.map((i) => `<div><span class="mid big">${i.mid}</span><div class="what">${esc(i.label)}</div></div>`).join('')}</div>
    <button class="btn block mt12" data-action="closeMids">${icons.check} Entendi</button>`;
}

function formView({ store, s, ui, toast }) {
  const d = ui.draft || (ui.draft = freshDraft(store));
  const menu = s.menu[d.day];
  const cur = d.cur;
  const item = buildItem(cur, menu);
  let price = null; let priceErr = '';
  try { price = itemPrice(s.prices, item); } catch (e) { priceErr = e.message; }
  const isFei = item.kind === 'feijoada';
  const sizes = isFei ? sizesFor('feijoada') : sizesFor('marmitex');

  const days = `<div class="days">${WEEK_ORDER.map((k) => `<button class="${d.day === k ? 'on' : ''} ${store.todayKey() === k ? 'today' : ''}" data-action="day" data-v="${k}">${DAY_SHORT[k]}</button>`).join('')}</div>`;
  const kinds = `<div class="seg c3">${[['marmitex', 'Marmitex'], ['pratofeito', 'Prato feito'], ['pratofeijoada', 'Prato feijoada']]
    .map(([k, l]) => `<button class="chip ${cur.kind === k ? 'on' : ''}" data-action="kind" data-v="${k}">${l}<span class="sub">${k === 'marmitex' ? 'P · M · G' : money(s.prices.pratos[k === 'pratofeito' ? 'feito' : 'feijoada'])}</span></button>`).join('')}</div>`;
  const dishes = needsDish(cur) ? (menu.dishes.length
    ? menu.dishes.map((x) => `<button class="dish-pick ${cur.dish === x.name ? 'on' : ''}" data-action="dish" data-v="${esc(x.name)}"><span class="dot"></span><span class="grow">${esc(x.name)}</span>${x.tipo === 'feijoada' ? '<span class="tag">feijoada</span>' : ''}</button>`).join('')
    : `<input class="inp" data-input="dishText" placeholder="Digite o prato (cardápio vazio neste dia)" value="${esc(cur.dishText)}">`) : '';
  const sizeChips = cur.kind === 'marmitex' ? `<div class="h3">Tamanho</div><div class="seg c3">${sizes.map((z) => {
    const p = isFei ? s.prices.feijoada[cur.modo][z] : s.prices.marmitex[z];
    return `<button class="chip ${(cur.size === z || (isFei && cur.size === 'P' && z === 'M')) ? 'on' : ''}" data-action="size" data-v="${z}">${SIZES[z]}<span class="sub">${money(p)}</span></button>`;
  }).join('')}</div>` : '';
  const modo = isFei ? `<div class="h3">Feijoada</div><div class="seg c2">${Object.entries(MODOS).map(([k, l]) =>
    `<button class="chip ${cur.modo === k ? 'on' : ''}" data-action="modo" data-v="${k}">${l}<span class="sub">${money(s.prices.feijoada[k][item.size])}</span></button>`).join('')}</div>` : '';
  const acomp = `<div class="h3">Acompanhamentos</div><div class="chips">${menu.acomp.length ? menu.acomp.map((a) => {
    const on = cur.acomp.includes(a.name);
    return `<button class="chip multi ${on ? 'on' : ''}" data-action="acomp" data-v="${esc(a.name)}"><span class="box">${on ? icons.check : ''}</span>${esc(a.name)}</button>`;
  }).join('') : '<span class="muted">Sem acompanhamentos cadastrados.</span>'}</div>`;

  const added = d.itens.map((it, idx) => `<div class="line"><div class="grow"><b>${esc(itemLabel(it))}</b>${it.acomp.length ? `<div class="muted">+ ${esc(it.acomp.join(', '))}</div>` : ''}</div>
    <div class="row"><b>${money(itemPrice(s.prices, it))}</b><button class="iconbtn danger" data-action="rmItem" data-v="${idx}" aria-label="Remover">${icons.x}</button></div></div>`).join('');

  const drinks = d.showBebidas ? `<div class="card flat mt8"><div class="between mb8"><div class="strong">Quadro de bebidas</div><button class="btn xs ghost" data-action="toggleBeb">Fechar</button></div>
    <div class="pcards">${s.products.filter((p) => p.grupo === 'bebida').map((p) => `<div class="pcard ${d.bebidas[p.id] ? 'has' : ''}"><div class="pn">${esc(p.name)}</div><div class="pp">${money(p.price)}</div>
      <div class="stepper"><button data-action="bebDec" data-v="${p.id}" aria-label="Menos">−</button><span class="q">${d.bebidas[p.id] || 0}</span><button data-action="bebInc" data-v="${p.id}" aria-label="Mais">+</button></div></div>`).join('')}</div></div>` : '';
  const bebTotal = Object.entries(d.bebidas).reduce((t, [id, q]) => t + (s.products.find((p) => p.id === id)?.price || 0) * q, 0);
  const bebCount = Object.values(d.bebidas).reduce((t, q) => t + q, 0);

  const itensTotal = d.itens.reduce((t, it) => t + itemPrice(s.prices, it), 0);
  const taxaTxt = d.taxa ?? centsToInput(s.prices.entrega.taxaPadrao);
  const taxaCents = d.tipo === 'entrega' ? (parseMoney(taxaTxt) || 0) : 0;
  const total = itensTotal + bebTotal + (Number.isNaN(taxaCents) ? 0 : taxaCents);

  return {
    kicker: 'NOVO PEDIDO', title: 'Marmitex & pratos', back: true,
    body: `<div class="card"><div class="h2">1 · Monte o item</div><div class="muted mb8">Cardápio do dia:</div>${days}${kinds}
      ${needsDish(cur) ? `<div class="h3">Prato principal</div>${dishes}` : ''}${sizeChips}${modo}${acomp}
      <div class="preview"><span>${priceErr ? esc(priceErr) : esc(itemLabel(item))}</span><b>${price !== null ? money(price) : '—'}</b></div>
      <button class="btn block gold" data-action="addItem">${icons.plus} Adicionar ao pedido</button></div>
      <div class="card"><div class="h2">2 · Itens do pedido (${d.itens.length})</div>${added || '<div class="muted">Nenhum item ainda. Cada item recebe um número M-xxx para a tampa.</div>'}
        <div class="mt12"><button class="btn block dashed" data-action="toggleBeb">${icons.glass} Bebidas${bebCount ? ` (${bebCount} · ${money(bebTotal)})` : ''}</button>${drinks}</div></div>
      <div class="card"><div class="h2">3 · Cliente e entrega</div>
        <label class="field"><span class="lbl">Nome do cliente</span><input class="inp" data-input="cliente" value="${esc(d.cliente)}" autocomplete="off"></label>
        <label class="field"><span class="lbl">Telefone (opcional)</span><input class="inp" data-input="telefone" inputmode="tel" value="${esc(d.telefone)}"></label>
        <div class="seg c2 row1 mb12">${[['entrega', 'Entrega'], ['retirada', 'Retirada']].map(([k, l]) => `<button class="chip ${d.tipo === k ? 'on' : ''}" data-action="tipo" data-v="${k}">${l}</button>`).join('')}</div>
        ${d.tipo === 'entrega' ? `<label class="field"><span class="lbl">Endereço / bairro</span><input class="inp" data-input="endereco" value="${esc(d.endereco)}"></label>
        <label class="field"><span class="lbl">Taxa de entrega</span><div class="money"><span>R$</span><input class="inp" data-input="taxa" inputmode="decimal" value="${esc(taxaTxt)}"></div></label>` : ''}
        <div class="h3">Pagamento</div><div class="seg c4">${Object.entries(PAGAMENTOS).map(([k, l]) => `<button class="chip ${d.pagamento === k ? 'on' : ''}" data-action="pag" data-v="${k}">${l}</button>`).join('')}</div>
        ${d.pagamento === 'pix' && d.tipo === 'entrega' ? '<div class="note mt8">PIX: o pedido só sai para entrega após marcar o comprovante na Expedição.</div>' : ''}
        <label class="field mt12"><span class="lbl">Observações (opcional)</span><textarea class="inp" style="padding:10px 14px;min-height:64px" data-input="obs">${esc(d.obs)}</textarea></label></div>`,
    footer: `<div class="between mb8"><span class="muted">${d.itens.length} item(ns)${bebCount ? ` + ${bebCount} bebida(s)` : ''}${taxaCents ? ` + entrega ${money(taxaCents)}` : ''}</span><b style="font:700 20px var(--font-title);color:var(--green)">${money(total)}</b></div>
      <button class="btn block ${d.itens.length ? '' : 'off'}" data-action="create">${icons.check} Gerar pedido</button>`,
  };
}

export default {
  render(ctx) {
    if (ctx.params[0] === 'novo') {
      const v = formView(ctx);
      v.back = true;
      return v;
    }
    return queueView(ctx);
  },
  actions: {
    novo({ go, ui, store }) { ui.draft = freshDraft(store); go('cozinha/novo'); return false; },
    ready({ store, toast }, el) {
      const r = store.setItemReady(el.dataset.p, el.dataset.i, el.dataset.v === '1');
      if (!r.ok) toast(r.error, 'err');
    },
    async cancel({ store, ask, toast }, el) {
      if (await ask({ title: 'Cancelar pedido?', text: 'O pedido sai das vendas e da fila.', ok: 'Cancelar pedido', cancel: 'Manter', danger: true })) {
        const r = store.cancelPedido(el.dataset.p);
        toast(r.ok ? 'Pedido cancelado' : r.error, r.ok ? '' : 'err');
      }
    },
    closeMids({ ui }) { ui.modal = null; },
    day({ ui }, el) { ui.draft.day = el.dataset.v; ui.draft.cur = { ...freshCur(), kind: ui.draft.cur.kind }; },
    kind({ ui }, el) { ui.draft.cur = { ...freshCur(), kind: el.dataset.v, acomp: ui.draft.cur.acomp }; },
    dish({ ui }, el) { ui.draft.cur.dish = ui.draft.cur.dish === el.dataset.v ? '' : el.dataset.v; },
    size({ ui }, el) { ui.draft.cur.size = el.dataset.v; },
    modo({ ui }, el) { ui.draft.cur.modo = el.dataset.v; },
    acomp({ ui }, el) {
      const a = ui.draft.cur.acomp; const i = a.indexOf(el.dataset.v);
      if (i >= 0) a.splice(i, 1); else a.push(el.dataset.v);
    },
    addItem({ ui, s, toast }) {
      const d = ui.draft;
      const it = buildItem(d.cur, s.menu[d.day]);
      if (needsDish(d.cur) && !it.dish) { toast('Escolha o prato principal', 'err'); return false; }
      try { itemPrice(s.prices, it); } catch (e) { toast(e.message, 'err'); return false; }
      d.itens.push(it);
      d.cur = { ...freshCur(), kind: d.cur.kind };
      toast('Item adicionado', 'ok');
    },
    rmItem({ ui }, el) { ui.draft.itens.splice(Number(el.dataset.v), 1); },
    toggleBeb({ ui }) { ui.draft.showBebidas = !ui.draft.showBebidas; },
    bebInc({ ui }, el) { const b = ui.draft.bebidas; b[el.dataset.v] = (b[el.dataset.v] || 0) + 1; },
    bebDec({ ui }, el) { const b = ui.draft.bebidas; b[el.dataset.v] = Math.max(0, (b[el.dataset.v] || 0) - 1); if (!b[el.dataset.v]) delete b[el.dataset.v]; },
    tipo({ ui }, el) { ui.draft.tipo = el.dataset.v; },
    pag({ ui }, el) { ui.draft.pagamento = el.dataset.v; },
    create({ store, ui, s, go, toast }) {
      const d = ui.draft;
      const taxaTxt = d.taxa ?? centsToInput(s.prices.entrega.taxaPadrao);
      const taxa = d.tipo === 'entrega' ? parseMoney(taxaTxt) : 0;
      if (Number.isNaN(taxa)) { toast('Taxa de entrega inválida', 'err'); return false; }
      const r = store.createPedido({
        cliente: d.cliente, telefone: d.telefone, tipo: d.tipo, endereco: d.endereco, taxa,
        pagamento: d.pagamento, obs: d.obs, itens: d.itens,
        bebidas: Object.entries(d.bebidas).map(([productId, qty]) => ({ productId, qty })),
      });
      if (!r.ok) { toast(r.error, 'err'); return false; }
      ui.draft = null;
      ui.modal = { type: 'mids', pedido: r.pedido };
      go('cozinha');
      return false;
    },
  },
  inputs: {
    dishText({ ui }, el) { ui.draft.cur.dishText = el.value; return false; },
    cliente({ ui }, el) { ui.draft.cliente = el.value; return false; },
    telefone({ ui }, el) { ui.draft.telefone = el.value; return false; },
    endereco({ ui }, el) { ui.draft.endereco = el.value; return false; },
    taxa({ ui }, el) { ui.draft.taxa = el.value; },
    obs({ ui }, el) { ui.draft.obs = el.value; return false; },
  },
};
