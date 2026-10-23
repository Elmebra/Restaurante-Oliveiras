// Painel do Dono: resumo financeiro, cardápio editável, preços, produtos e configurações.
import { icons } from '../icons.js';
import { money, esc, centsToInput, parseMoney, WEEK_ORDER, DAY_NAMES, DAY_SHORT } from '../util.js';
import { CATS, PAGAMENTOS } from '../store.js';
import { SIZES } from '../pricing.js';
import { loadDemo } from '../demo.js';

const COLORS = { pesagem: '#c79a3d', marmitex: '#1f4a34', pratos: '#8a5a2b', bebidas: '#2e6f9e' };
const PERIODS = [['hoje', 'Hoje'], ['7d', '7 dias'], ['mes', 'Mês'], ['tudo', 'Tudo']];
const TABS = [['resumo', 'Resumo'], ['cardapio', 'Cardápio'], ['precos', 'Preços'], ['produtos', 'Produtos'], ['config', 'Dados']];
const CAT_ICONS = [['bottle', 'Garrafa'], ['can', 'Lata'], ['glass', 'Copo'], ['bar', 'Barra'], ['candy', 'Bala']];

function priceRow(label, path, value, hint = '') {
  return `<div class="pricerow"><div class="lbl">${label}${hint ? `<span class="hint">${hint}</span>` : ''}</div>
    <div class="money"><span>R$</span><input class="inp sm" inputmode="decimal" data-change="price" data-path="${path}" value="${centsToInput(value)}" aria-label="${esc(label)}"></div></div>`;
}

function resumo({ store, ui }) {
  ui.period = ui.period || 'hoje';
  const r = store.summary(ui.period);
  const max = Math.max(1, ...Object.values(r.byCat));
  const bars = Object.entries(CATS).map(([k, l]) => `<div class="bar-row"><div class="top"><span>${l}</span><b>${money(r.byCat[k])}</b></div>
    <div class="bar"><i style="width:${Math.round((r.byCat[k] / max) * 100)}%;background:${COLORS[k]}"></i></div></div>`).join('');
  const pays = Object.entries(PAGAMENTOS).map(([k, l]) => `<div class="line"><span>${l}</span><b>${money(r.byPagamento[k])}</b></div>`).join('');
  const motos = r.motoboys.map((m) => `<div class="moto-row"><span class="pic">${icons.moto}</span><span class="grow"><div class="strong">${esc(m.nome)}</div><div class="muted">${m.viagens} viagem(ns)</div></span><b>${money(m.valor)}</b></div>`).join('');
  return `<div class="tabs">${PERIODS.map(([k, l]) => `<button class="${ui.period === k ? 'on' : ''}" data-action="period" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="big-total"><div class="l">FATURAMENTO</div><div class="v">${money(r.total)}</div><div class="s">${r.nPedidos} pedido(s) de entrega/retirada</div></div>
    <div class="card"><div class="h2">Por categoria</div>${bars}</div>
    <div class="card"><div class="h2">Por forma de pagamento</div>${pays}</div>
    <div class="card"><div class="h2">Entregas e motoboys</div>
      <div class="stat3"><div><div class="l">Taxas cobradas</div><div class="v">${money(r.taxas)}</div></div><div><div class="l">Custo motoboys</div><div class="v">${money(r.custoMotoboys)}</div></div><div><div class="l">Viagens</div><div class="v">${r.viagens}</div></div></div>
      <div class="mt12">${motos || '<div class="muted">Nenhuma entrega concluída no período.</div>'}</div></div>
    <div class="note">Taxas de entrega não entram no faturamento por categoria; o custo dos motoboys é mostrado à parte.</div>`;
}

function cardapio({ s, ui }) {
  ui.day = ui.day || 'seg';
  const m = s.menu[ui.day];
  const row = (list, x) => `<div class="edit-row"><input class="inp sm" data-change="menuName" data-list="${list}" data-id="${x.id}" value="${esc(x.name)}" aria-label="Nome">
    ${list === 'dishes' ? `<button class="tagbtn ${x.tipo === 'feijoada' ? 'on' : ''}" data-action="menuFei" data-id="${x.id}" title="Marque se este prato é feijoada (usa preços de feijoada)">feijoada</button>` : ''}
    <button class="iconbtn" data-action="menuUp" data-list="${list}" data-id="${x.id}" aria-label="Subir">${icons.up}</button>
    <button class="iconbtn" data-action="menuDown" data-list="${list}" data-id="${x.id}" aria-label="Descer">${icons.down}</button>
    <button class="iconbtn danger" data-action="menuDel" data-list="${list}" data-id="${x.id}" aria-label="Remover">${icons.trash}</button></div>`;
  const add = (list, ph) => `<div class="row mt8"><input class="inp sm" data-input="add_${list}" data-enter="menuAdd" data-list="${list}" placeholder="${ph}" value="${esc(ui['add_' + list] || '')}">
    <button class="btn sm gold" data-action="menuAdd" data-list="${list}">${icons.plus}</button></div>`;
  return `<div class="days">${WEEK_ORDER.map((k) => `<button class="${ui.day === k ? 'on' : ''}" data-action="menuDay" data-v="${k}">${DAY_SHORT[k]}</button>`).join('')}</div>
    <div class="card"><div class="h2">Pratos de ${DAY_NAMES[ui.day]}</div>${m.dishes.map((x) => row('dishes', x)).join('') || '<div class="muted">Nenhum prato.</div>'}${add('dishes', 'Novo prato')}</div>
    <div class="card"><div class="h2">Acompanhamentos</div>${m.acomp.map((x) => row('acomp', x)).join('') || '<div class="muted">Nenhum acompanhamento.</div>'}${add('acomp', 'Novo acompanhamento')}</div>
    <div class="card flat"><div class="strong mb8">Copiar cardápio de outro dia para ${DAY_NAMES[ui.day]}</div>
      <select class="sel sm" data-change="menuCopy"><option value="">Escolha o dia…</option>${WEEK_ORDER.filter((k) => k !== ui.day).map((k) => `<option value="${k}">${DAY_NAMES[k]}</option>`).join('')}</select></div>
    <div class="note blue mt12">Pratos marcados como <b>feijoada</b> usam os preços da feijoada (individual ou separada) na hora do pedido.</div>`;
}

function precos({ s }) {
  const p = s.prices;
  return `<div class="card"><div class="h2">Balança</div>${priceRow('Preço por quilo', 'kg', p.kg, 'Usado em todas as pesagens novas')}</div>
    <div class="card"><div class="h2">Marmitex</div>${['P', 'M', 'G'].map((z) => priceRow(SIZES[z], `marmitex.${z}`, p.marmitex[z])).join('')}</div>
    <div class="card"><div class="h2">Feijoada individual</div>${['M', 'G'].map((z) => priceRow(SIZES[z], `feijoada.individual.${z}`, p.feijoada.individual[z])).join('')}
      <div class="h2 mt12">Feijoada separada</div>${['M', 'G'].map((z) => priceRow(SIZES[z], `feijoada.separada.${z}`, p.feijoada.separada[z])).join('')}</div>
    <div class="card"><div class="h2">Pratos prontos</div>${priceRow('Prato feito', 'pratos.feito', p.pratos.feito)}${priceRow('Prato feijoada', 'pratos.feijoada', p.pratos.feijoada)}</div>
    <div class="card"><div class="h2">Entrega</div>${priceRow('Taxa de entrega padrão', 'entrega.taxaPadrao', p.entrega.taxaPadrao, 'Sugerida em cada pedido')}
      ${priceRow('Pagamento ao motoboy por viagem', 'entrega.pagamentoMotoboy', p.entrega.pagamentoMotoboy, 'Base do custo por motoboy')}</div>
    <div class="note">Pedidos e pesagens já lançados mantêm o preço da época; mudanças valem para os próximos.</div>`;
}

function produtos({ s, ui }) {
  const row = (p) => `<div class="card flat"><div class="edit-row"><input class="inp sm" data-change="prodName" data-id="${p.id}" value="${esc(p.name)}" aria-label="Nome">
      <button class="iconbtn danger" data-action="prodDel" data-id="${p.id}" aria-label="Remover">${icons.trash}</button></div>
    <div class="row"><div class="money grow"><span>R$</span><input class="inp sm" inputmode="decimal" data-change="prodPrice" data-id="${p.id}" value="${centsToInput(p.price)}" aria-label="Preço"></div>
      <select class="sel sm" style="width:auto" data-change="prodGrupo" data-id="${p.id}"><option value="bebida" ${p.grupo === 'bebida' ? 'selected' : ''}>Bebida</option><option value="doce" ${p.grupo === 'doce' ? 'selected' : ''}>Doce</option></select></div></div>`;
  ui.np = ui.np || { name: '', price: '', grupo: 'bebida', cat: 'bottle' };
  return `${s.products.map(row).join('')}
    <div class="card gold"><div class="h2">Novo produto</div>
      <input class="inp mb8" data-input="npName" placeholder="Nome (ex.: Água 500ml)" value="${esc(ui.np.name)}">
      <div class="row mb8"><div class="money grow"><span>R$</span><input class="inp" inputmode="decimal" data-input="npPrice" placeholder="0,00" value="${esc(ui.np.price)}"></div>
      <select class="sel" style="width:auto" data-change="npGrupo"><option value="bebida" ${ui.np.grupo === 'bebida' ? 'selected' : ''}>Bebida</option><option value="doce" ${ui.np.grupo === 'doce' ? 'selected' : ''}>Doce</option></select></div>
      <div class="chips mb8">${CAT_ICONS.map(([k, l]) => `<button class="chip ${ui.np.cat === k ? 'on' : ''}" data-action="npCat" data-v="${k}">${icons[k]} ${l}</button>`).join('')}</div>
      <button class="btn block" data-action="prodAdd">${icons.plus} Adicionar produto</button></div>`;
}

function config() {
  return `<div class="card"><div class="h2">Backup</div><div class="muted mb12">Os dados ficam neste aparelho. Faça backup com frequência e leve-o a outro aparelho se precisar.</div>
      <button class="btn block ghost mb8" data-action="exportJson">${icons.download} Baixar backup (.json)</button>
      <div class="btn block ghost file-btn mb8">${icons.upload} Restaurar backup<input type="file" accept=".json,application/json" data-change="importJson"></div>
      <button class="btn block ghost" data-action="exportCsv">${icons.download} Baixar vendas (.csv para Excel)</button></div>
    <div class="card"><div class="h2">Testes</div>
      <button class="btn block gold mb8" data-action="demo">Carregar dados de demonstração</button>
      <button class="btn block danger" data-action="resetOp">Apagar vendas e pedidos (testes)</button></div>`;
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default {
  render(ctx) {
    const { ui } = ctx;
    ui.tab = ui.tab || 'resumo';
    const body = { resumo, cardapio, precos, produtos, config }[ui.tab](ctx);
    return {
      kicker: 'PAINEL DO DONO', title: 'Gestão', back: true,
      body: `<div class="tabs" style="overflow-x:auto">${TABS.map(([k, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-action="ptab" data-v="${k}" style="flex:none;padding:0 12px">${l}</button>`).join('')}</div>${body}`,
    };
  },
  actions: {
    ptab({ ui }, el) { ui.tab = el.dataset.v; },
    period({ ui }, el) { ui.period = el.dataset.v; },
    menuDay({ ui }, el) { ui.day = el.dataset.v; },
    menuAdd({ store, ui, toast }, el) {
      const list = el.dataset.list;
      const r = store.menuAdd(ui.day, list, ui['add_' + list]);
      if (!r.ok) { toast(r.error, 'err'); return false; }
      ui['add_' + list] = '';
    },
    menuFei({ store, ui, s }, el) {
      const d = s.menu[ui.day].dishes.find((x) => x.id === el.dataset.id);
      store.menuUpdate(ui.day, 'dishes', d.id, { tipo: d.tipo === 'feijoada' ? 'normal' : 'feijoada' });
    },
    menuUp({ store, ui }, el) { store.menuMove(ui.day, el.dataset.list, el.dataset.id, -1); },
    menuDown({ store, ui }, el) { store.menuMove(ui.day, el.dataset.list, el.dataset.id, 1); },
    async menuDel({ store, ui, ask }, el) {
      if (await ask({ title: 'Remover do cardápio?', text: 'Isto não afeta pedidos já lançados.', ok: 'Remover', danger: true })) store.menuRemove(ui.day, el.dataset.list, el.dataset.id);
    },
    npCat({ ui }, el) { ui.np.cat = el.dataset.v; },
    prodAdd({ store, ui, toast }) {
      const price = parseMoney(ui.np.price);
      if (Number.isNaN(price)) { toast('Informe o preço', 'err'); return false; }
      const r = store.addProduct({ name: ui.np.name, price, grupo: ui.np.grupo, cat: ui.np.cat });
      if (!r.ok) { toast(r.error, 'err'); return false; }
      ui.np = null; toast('Produto adicionado', 'ok');
    },
    async prodDel({ store, ask }, el) {
      if (await ask({ title: 'Remover produto?', text: 'Vendas já registradas não mudam.', ok: 'Remover', danger: true })) store.removeProduct(el.dataset.id);
    },
    exportJson({ store, toast }) { download(`oliveiras-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON(), 'application/json'); toast('Backup baixado', 'ok'); return false; },
    exportCsv({ store, toast }) { download(`oliveiras-vendas-${new Date().toISOString().slice(0, 10)}.csv`, store.ledgerCSV(), 'text/csv;charset=utf-8'); toast('Planilha baixada', 'ok'); return false; },
    async demo({ store, ask, toast }) {
      if (await ask({ title: 'Carregar demonstração?', text: 'Adiciona vendas, pedidos e motoboys de exemplo. Use "Apagar vendas e pedidos" depois.', ok: 'Carregar' })) {
        loadDemo(store); toast('Dados de demonstração carregados', 'ok');
      }
    },
    async resetOp({ store, ask, toast }) {
      if (await ask({ title: 'Apagar vendas e pedidos?', text: 'Preços, cardápio, produtos e motoboys ficam. Não dá para desfazer.', ok: 'Apagar tudo', danger: true })) {
        store.resetOperational(); toast('Dados de teste apagados');
      }
    },
  },
  inputs: {
    add_dishes({ ui }, el) { ui.add_dishes = el.value; return false; },
    add_acomp({ ui }, el) { ui.add_acomp = el.value; return false; },
    npName({ ui }, el) { ui.np.name = el.value; return false; },
    npPrice({ ui }, el) { ui.np.price = el.value; return false; },
  },
  changes: {
    price({ store, toast }, el) {
      const c = parseMoney(el.value);
      if (Number.isNaN(c)) { toast('Valor inválido', 'err'); return; }
      const r = store.setPrice(el.dataset.path, c);
      toast(r.ok ? 'Preço salvo' : r.error, r.ok ? 'ok' : 'err');
    },
    menuName({ store, ui, toast }, el) { const r = store.menuUpdate(ui.day, el.dataset.list, el.dataset.id, { name: el.value }); if (!r.ok) toast(r.error, 'err'); },
    menuCopy({ store, ui, toast }, el) { if (!el.value) return; const r = store.menuCopy(el.value, ui.day); toast(r.ok ? 'Cardápio copiado' : r.error, r.ok ? 'ok' : 'err'); },
    prodName({ store, toast }, el) { const r = store.updateProduct(el.dataset.id, { name: el.value }); if (!r.ok) toast(r.error, 'err'); },
    prodPrice({ store, toast }, el) {
      const c = parseMoney(el.value);
      if (Number.isNaN(c)) { toast('Preço inválido', 'err'); return; }
      const r = store.updateProduct(el.dataset.id, { price: c }); toast(r.ok ? 'Preço salvo' : r.error, r.ok ? 'ok' : 'err');
    },
    prodGrupo({ store }, el) { store.updateProduct(el.dataset.id, { grupo: el.value }); },
    npGrupo({ ui }, el) { ui.np.grupo = el.value; },
    importJson({ store, toast }, el) {
      const f = el.files?.[0]; if (!f) return false;
      f.text().then((t) => { const r = store.importJSON(t); toast(r.ok ? 'Backup restaurado' : r.error, r.ok ? 'ok' : 'err'); window.dispatchEvent(new Event('hashchange')); });
      return false;
    },
  },
};
