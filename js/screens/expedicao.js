// Expedição: despacho para motoboys, entregas na rua e retiradas no balcão.
import { icons } from '../icons.js';
import { money, esc, timeHM } from '../util.js';
import { PAGAMENTOS } from '../store.js';

function pedidoCard(p, ctx) {
  const { store, ui, s } = ctx;
  const ready = store.pedidoReady(p);
  const blocked = store.pixBlocked(p);
  const total = store.pedidoTotal(p);
  const head = `<div class="between"><div><div class="strong">#${p.num} · ${esc(p.cliente)}</div>
      <div class="muted">${p.tipo === 'entrega' ? esc(p.endereco) : 'Retirada no balcão'} · ${timeHM(p.ts)}</div></div>
      <div class="right"><b>${money(total)}</b><div class="muted">${PAGAMENTOS[p.pagamento]}</div></div></div>`;
  const mids = `<div class="row wrap gap8 mt8">${p.itens.map((i) => `<span class="mid ${i.status === 'pronto' ? 'ready' : 'wait'}" title="${esc(i.label)}">${i.mid}</span>`).join('')}</div>`;
  const tel = p.telefone ? `<div class="mt8"><a class="phone" href="tel:${esc(p.telefone)}">${icons.phone} ${esc(p.telefone)}</a></div>` : '';
  let actions = '';
  if (p.status === 'aguardando') {
    const pix = p.pagamento === 'pix' ? `<label class="chip multi ${p.pixOk ? 'on' : ''} mt8" style="display:flex"><input type="checkbox" hidden data-change="pix" data-p="${p.id}" ${p.pixOk ? 'checked' : ''}>
        <span class="box">${p.pixOk ? icons.check : ''}</span>Comprovante do PIX recebido</label>` : '';
    const mots = s.motoboys.filter((m) => m.active);
    const picker = ui.pick === p.id ? `<div class="card flat mt8"><div class="strong mb8">Quem vai levar?</div>
      <div class="chips">${mots.map((m) => `<button class="chip" data-action="dispatch" data-p="${p.id}" data-m="${m.id}">${icons.moto} ${esc(m.name)}</button>`).join('') || '<span class="muted">Nenhum motoboy cadastrado.</span>'}</div>
      <div class="row mt12"><input class="inp sm" data-input="newMoto" data-enter="addMoto" placeholder="Novo motoboy" value="${esc(ui.newMoto || '')}">
      <button class="btn sm gold" data-action="addMoto">${icons.plus}</button></div></div>` : '';
    if (!ready) actions = `<div class="note mt8">Aguardando a cozinha (${p.itens.filter((i) => i.status !== 'pronto').length} em preparo)</div>`;
    else if (p.tipo === 'entrega') {
      actions = `${pix}${blocked ? '<div class="note mt8">Marque o comprovante do PIX para liberar a saída.</div>' : ''}
        <button class="btn block mt8 ${blocked ? 'off' : ''}" data-action="openPick" data-p="${p.id}">${icons.moto} Despachar</button>${picker}`;
    } else {
      actions = `${pix}<button class="btn block mt8 ${blocked ? 'off' : ''}" data-action="pickedUp" data-p="${p.id}">${icons.check} Cliente retirou</button>`;
    }
  } else if (p.status === 'saiu') {
    actions = `<div class="note blue mt8">${icons.moto} ${esc(p.motoboyNome)} saiu às ${timeHM(p.saiuAt)}</div>
      <div class="row mt8"><button class="btn grow" data-action="delivered" data-p="${p.id}">${icons.check} Entregue</button>
      <button class="btn ghost" data-action="undoDispatch" data-p="${p.id}">${icons.undo}</button></div>`;
  } else {
    actions = `<div class="note ok mt8">${p.status === 'entregue' ? `Entregue por ${esc(p.motoboyNome)} às ${timeHM(p.entregueAt)}` : `Retirado às ${timeHM(p.entregueAt)}`}</div>
      <div class="mt8"><button class="btn xs ghost" data-action="undoDone" data-p="${p.id}">${icons.undo} Desfazer</button></div>`;
  }
  actions += `<div class="mt8"><button class="btn xs ghost" data-action="printPedido" data-p="${p.id}">Imprimir</button></div>`;
  return `<div class="card ${p.status === 'entregue' || p.status === 'retirado' ? 'dim' : ''}">${head}${mids}${tel}${actions}</div>`;
}

export default {
  render(ctx) {
    const { store, ui } = ctx;
    ui.tab = ui.tab || 'despachar';
    const abertos = store.pedidosAbertos();
    const despachar = abertos.filter((p) => p.status === 'aguardando').sort((a, b) => a.ts - b.ts);
    const rua = abertos.filter((p) => p.status === 'saiu').sort((a, b) => a.saiuAt - b.saiuAt);
    const feitos = store.finalizadosHoje();
    const lists = { despachar, rua, feitos };
    const tabs = [['despachar', 'A despachar', despachar.length], ['rua', 'Na rua', rua.length], ['feitos', 'Concluídos', feitos.length]];
    const list = lists[ui.tab];
    const mots = ctx.s.motoboys.filter((m) => m.active);
    return {
      kicker: 'MODO EXPEDIÇÃO', title: 'Entregas', back: true,
      body: `<div class="tabs">${tabs.map(([k, l, n]) => `<button class="${ui.tab === k ? 'on' : ''}" data-action="tab" data-v="${k}">${l} (${n})</button>`).join('')}</div>
        ${list.map((p) => pedidoCard(p, ctx)).join('') || '<div class="empty">Nada por aqui.</div>'}
        ${ui.tab === 'rua' || ui.tab === 'despachar' ? '' : ''}
        <div class="sec">Motoboys ativos</div>
        <div class="card flat">${mots.map((m) => `<div class="moto-row"><span class="pic">${icons.moto}</span><span class="grow strong">${esc(m.name)}</span>
          <button class="iconbtn danger" data-action="rmMoto" data-m="${m.id}" aria-label="Remover ${esc(m.name)}">${icons.trash}</button></div>`).join('') || '<div class="muted">Nenhum motoboy cadastrado.</div>'}
          <div class="row mt12"><input class="inp sm" data-input="newMoto" data-enter="addMoto" placeholder="Nome do motoboy" value="${esc(ui.newMoto || '')}">
          <button class="btn sm gold" data-action="addMoto">${icons.plus} Adicionar</button></div></div>`,
    };
  },
  actions: {
    printPedido({ printer, toast }, el) { toast(printer.printPedido(el.dataset.p) ? 'Enviado para a impressora' : 'Pedido não encontrado', 'ok'); return false; },
    tab({ ui }, el) { ui.tab = el.dataset.v; ui.pick = null; },
    openPick({ ui, store, toast }, el) {
      const p = store.state.pedidos.find((x) => x.id === el.dataset.p);
      if (store.pixBlocked(p)) { toast('Aguardando o comprovante do PIX', 'err'); return false; }
      ui.pick = ui.pick === el.dataset.p ? null : el.dataset.p;
    },
    dispatch({ store, ui, toast }, el) {
      const r = store.dispatch(el.dataset.p, el.dataset.m);
      if (!r.ok) { toast(r.error, 'err'); return; }
      ui.pick = null; toast('Pedido saiu para entrega', 'ok');
    },
    delivered({ store, toast }, el) { const r = store.markDelivered(el.dataset.p); toast(r.ok ? 'Entrega concluída' : r.error, r.ok ? 'ok' : 'err'); },
    undoDispatch({ store, toast }, el) { const r = store.undoDispatch(el.dataset.p); toast(r.ok ? 'Despacho desfeito' : r.error, r.ok ? '' : 'err'); },
    pickedUp({ store, toast }, el) {
      const r = store.markPickedUp(el.dataset.p);
      toast(r.ok ? 'Retirada registrada' : r.error, r.ok ? 'ok' : 'err');
    },
    undoDone({ store, toast }, el) {
      const p = store.state.pedidos.find((x) => x.id === el.dataset.p);
      const r = p.status === 'entregue' ? store.undoDelivered(p.id) : store.undoPickedUp(p.id);
      toast(r.ok ? 'Desfeito' : r.error, r.ok ? '' : 'err');
    },
    addMoto({ store, ui, toast }) {
      const r = store.addMotoboy(ui.newMoto);
      if (!r.ok) { toast(r.error, 'err'); return false; }
      ui.newMoto = ''; toast('Motoboy adicionado', 'ok');
    },
    async rmMoto({ store, ask, toast }, el) {
      const m = store.state.motoboys.find((x) => x.id === el.dataset.m);
      if (await ask({ title: `Remover ${m.name}?`, text: 'Ele sai da lista; o histórico de entregas é mantido.', ok: 'Remover', danger: true })) {
        store.removeMotoboy(m.id); toast('Motoboy removido');
      }
    },
  },
  inputs: { newMoto({ ui }, el) { ui.newMoto = el.value; return false; } },
  changes: {
    pix({ store }, el) { store.setPixOk(el.dataset.p, el.checked); },
  },
};
