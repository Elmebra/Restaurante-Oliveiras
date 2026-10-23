import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { itemPrice, itemLabel, pesagemCents } from '../js/pricing.js';
import { DEFAULT_PRICES } from '../js/seed.js';
import {
  parseDecimal, parseMoney, money, fmtKg, centsToInput,
} from '../js/util.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
// 22/10/2026 12:00 (quinta-feira)
const T0 = new Date(2026, 9, 22, 12, 0, 0).getTime();
const mk = (t = T0) => {
  let cur = t;
  const store = createStore({ storage: memStorage(), now: () => cur });
  store.advance = (ms) => { cur += ms; };
  store.jump = (ts) => { cur = ts; };
  return store;
};

// ------------------------------------------------------------------ preços combinados com o dono
test('preços padrão batem com o combinado', () => {
  const p = DEFAULT_PRICES;
  assert.equal(p.kg, 4500);
  assert.deepEqual(p.marmitex, { P: 1700, M: 2000, G: 2200 });
  assert.deepEqual(p.feijoada.individual, { M: 2200, G: 2500 });
  assert.deepEqual(p.feijoada.separada, { M: 6000, G: 7000 });
  assert.equal(p.pratos.feito, 2000);
  assert.equal(p.pratos.feijoada, 2300);
});

test('itemPrice cobre todos os tipos de item', () => {
  const p = DEFAULT_PRICES;
  assert.equal(itemPrice(p, { kind: 'marmitex', size: 'P' }), 1700);
  assert.equal(itemPrice(p, { kind: 'marmitex', size: 'M' }), 2000);
  assert.equal(itemPrice(p, { kind: 'marmitex', size: 'G' }), 2200);
  assert.equal(itemPrice(p, { kind: 'feijoada', modo: 'individual', size: 'M' }), 2200);
  assert.equal(itemPrice(p, { kind: 'feijoada', modo: 'individual', size: 'G' }), 2500);
  assert.equal(itemPrice(p, { kind: 'feijoada', modo: 'separada', size: 'M' }), 6000);
  assert.equal(itemPrice(p, { kind: 'feijoada', modo: 'separada', size: 'G' }), 7000);
  assert.equal(itemPrice(p, { kind: 'prato', tipo: 'feito' }), 2000);
  assert.equal(itemPrice(p, { kind: 'prato', tipo: 'feijoada' }), 2300);
  assert.throws(() => itemPrice(p, { kind: 'feijoada', modo: 'individual', size: 'P' }));
});

test('rótulos dos itens', () => {
  assert.equal(itemLabel({ kind: 'marmitex', size: 'G', dish: 'Bife acebolado' }), 'Marmitex Grande — Bife acebolado');
  assert.equal(itemLabel({ kind: 'feijoada', modo: 'separada', size: 'M' }), 'Feijoada Separada Média');
  assert.equal(itemLabel({ kind: 'prato', tipo: 'feijoada' }), 'Prato Feijoada');
});

// ------------------------------------------------------------------ digitação do peso
test('parseDecimal aceita qualquer formato razoável', () => {
  assert.equal(parseDecimal('0,850'), 0.85);
  assert.equal(parseDecimal('0.850'), 0.85);
  assert.equal(parseDecimal(' 1,2 kg '), 1.2);
  assert.equal(parseDecimal('1.234,5'), 1234.5);
  assert.equal(parseDecimal('1,234.5'), 1234.5);
  assert.equal(parseDecimal('1.234.567'), 1234567);
  assert.equal(parseDecimal('.5'), 0.5);
  assert.equal(parseDecimal('5,'), 5);
  assert.equal(parseDecimal('850'), 850);
  assert.ok(Number.isNaN(parseDecimal('')));
  assert.ok(Number.isNaN(parseDecimal('abc')));
  assert.ok(Number.isNaN(parseDecimal('-')));
  assert.equal(parseDecimal(0.3), 0.3);
});

test('pesagem: qualquer valor, centavos corretos a R$ 45/kg', () => {
  assert.equal(pesagemCents(0.85, 4500), 3825); // 38,25
  assert.equal(pesagemCents(1, 4500), 4500);
  assert.equal(pesagemCents(0.5, 4500), 2250);
  assert.equal(pesagemCents(0.8375, 4500), 3769); // 37,6875 -> 37,69
  assert.equal(pesagemCents(0.001, 4500), 5); // 4,5 centavos arredonda para cima
  assert.equal(pesagemCents(12.345, 4500), 55553); // peso absurdo também é aceito
});

test('formatação', () => {
  assert.equal(money(3825), 'R$ 38,25');
  assert.equal(money(123456), 'R$ 1.234,56');
  assert.equal(money(0), 'R$ 0,00');
  assert.equal(money(-500), '-R$ 5,00');
  assert.equal(fmtKg(0.85), '0,850');
  assert.equal(fmtKg(0.8375), '0,8375');
  assert.equal(fmtKg(1), '1,000');
  assert.equal(centsToInput(4500), '45,00');
  assert.equal(parseMoney('45'), 4500);
  assert.equal(parseMoney('22,5'), 2250);
  assert.equal(parseMoney('R$ 1.234,56'), 123456);
  assert.ok(Number.isNaN(parseMoney('-3')));
});

// ------------------------------------------------------------------ cartões / balança / caixa
test('balança: lança pesagem digitada em qualquer formato e fecha no caixa', () => {
  const s = mk();
  let r = s.launchWeighing(7, '0,850');
  assert.ok(r.ok);
  assert.equal(r.line.amount, 3825);
  r = s.launchWeighing(7, '0.5'); // segunda pesagem no mesmo cartão
  assert.equal(r.total, 3825 + 2250);
  assert.equal(Object.keys(s.state.cards).length, 1);

  assert.equal(s.launchWeighing(0, '1').ok, false);
  assert.equal(s.launchWeighing(31, '1').ok, false);
  assert.equal(s.launchWeighing(5, '0').ok, false);
  assert.equal(s.launchWeighing(5, 'abc').ok, false);
  assert.equal(s.launchWeighing(5, '-2').ok, false);

  const fechou = s.closeCard(7, 'pix');
  assert.ok(fechou.ok);
  assert.equal(fechou.total, 6075);
  assert.equal(s.state.cards[7], undefined);
  const sm = s.summary('hoje');
  assert.equal(sm.byCat.pesagem, 6075);
  assert.equal(sm.total, 6075);
  assert.equal(sm.byPagamento.pix, 6075);
});

test('preço do kg alterado vale para as próximas pesagens e não muda as antigas', () => {
  const s = mk();
  s.launchWeighing(1, '1');
  s.setPrice('kg', 5000);
  const r = s.launchWeighing(2, '1');
  assert.equal(r.line.amount, 5000);
  assert.equal(s.state.cards[1].lines[0].amount, 4500);
});

test('desfazer pesagem libera o cartão se ficar vazio', () => {
  const s = mk();
  const { line } = s.launchWeighing(3, '1');
  assert.ok(s.undoLine(3, line.id).ok);
  assert.equal(s.state.cards[3], undefined);
});

test('venda rápida vinculada ao cartão soma na comanda; avulsa vai direto ao faturamento', () => {
  const s = mk();
  s.launchWeighing(9, '1'); // 45,00
  assert.equal(s.addCardItems(10, [{ productId: 'refri_lata', qty: 1 }]).ok, false); // cartão 10 não está em uso
  const r = s.addCardItems(9, [{ productId: 'refri_lata', qty: 2 }, { productId: 'choc', qty: 1 }]);
  assert.equal(r.total, 4500 + 1200 + 600);
  s.closeCard(9, 'dinheiro');
  let sm = s.summary('hoje');
  assert.equal(sm.byCat.pesagem, 4500);
  assert.equal(sm.byCat.bebidas, 1800);

  const v = s.sellQuick([{ productId: 'cerveja_lata', qty: 2 }], 'debito');
  assert.equal(v.total, 1400);
  sm = s.summary('hoje');
  assert.equal(sm.byCat.bebidas, 3200);
  assert.equal(sm.byPagamento.debito, 1400);
  assert.equal(s.sellQuick([], 'pix').ok, false);
  assert.equal(s.sellQuick([{ productId: 'choc', qty: 1 }], 'cheque').ok, false);
});

// ------------------------------------------------------------------ pedidos
const baseDraft = (over = {}) => ({
  cliente: 'Dona Maria',
  telefone: '11 99999-0000',
  tipo: 'entrega',
  endereco: 'Vila Nova, Rua A 10',
  taxa: 400,
  pagamento: 'dinheiro',
  itens: [{ kind: 'marmitex', size: 'G', dish: 'Bife acebolado', acomp: ['Batata frita', 'Farofa'] }],
  bebidas: [],
  ...over,
});

test('pedido com vários marmitex: um M-xxx para cada, preços e total corretos', () => {
  const s = mk();
  const r = s.createPedido(baseDraft({
    itens: [
      { kind: 'marmitex', size: 'G', dish: 'Bife acebolado', acomp: ['Batata frita'] },
      { kind: 'marmitex', size: 'P', dish: 'Picadinho', acomp: ['Couve', 'Farofa'] },
      { kind: 'feijoada', modo: 'individual', size: 'M', dish: 'Feijoada', acomp: [] },
      { kind: 'prato', tipo: 'feito', dish: 'Virado', acomp: [] },
      { kind: 'prato', tipo: 'feijoada', acomp: [] },
    ],
    bebidas: [{ productId: 'refri_lata', qty: 2 }],
  }));
  assert.ok(r.ok, r.error);
  const p = r.pedido;
  assert.deepEqual(p.itens.map((i) => i.mid), ['M-001', 'M-002', 'M-003', 'M-004', 'M-005']);
  assert.deepEqual(p.itens.map((i) => i.price), [2200, 1700, 2200, 2000, 2300]);
  assert.equal(p.subtotal, 2200 + 1700 + 2200 + 2000 + 2300 + 1200);
  assert.equal(s.pedidoTotal(p), p.subtotal + 400);
  assert.equal(p.num, 1);

  const sm = s.summary('hoje');
  assert.equal(sm.byCat.marmitex, 2200 + 1700 + 2200);
  assert.equal(sm.byCat.pratos, 4300);
  assert.equal(sm.byCat.bebidas, 1200);
  assert.equal(sm.taxas, 400);
  assert.equal(sm.total, 2200 + 1700 + 2200 + 4300 + 1200); // taxa não entra no faturamento por categoria
});

test('feijoada separada custa 60 (média) e 70 (grande)', () => {
  const s = mk();
  const r = s.createPedido(baseDraft({
    tipo: 'retirada',
    itens: [
      { kind: 'feijoada', modo: 'separada', size: 'M', dish: 'Feijoada' },
      { kind: 'feijoada', modo: 'separada', size: 'G', dish: 'Feijoada' },
    ],
  }));
  assert.deepEqual(r.pedido.itens.map((i) => i.price), [6000, 7000]);
  assert.equal(r.pedido.taxa, 0);
});

test('validações do pedido', () => {
  const s = mk();
  assert.equal(s.createPedido(baseDraft({ itens: [] })).ok, false);
  assert.equal(s.createPedido(baseDraft({ cliente: '  ' })).ok, false);
  assert.equal(s.createPedido(baseDraft({ pagamento: 'fiado' })).ok, false);
  assert.equal(s.createPedido(baseDraft({ endereco: '' })).ok, false);
  assert.equal(s.createPedido(baseDraft({ taxa: -1 })).ok, false);
  assert.equal(s.createPedido(baseDraft({ itens: [{ kind: 'feijoada', modo: 'individual', size: 'P' }] })).ok, false);
  assert.equal(s.createPedido(baseDraft({ tipo: 'retirada', endereco: '' })).ok, true); // retirada não exige endereço
  assert.equal(s.state.pedidos.length, 1); // inválidos não criam nada
  assert.equal(s.state.ledger.length > 0, true);
});

test('numeração M-xxx e Pedido # recomeçam a cada dia', () => {
  const s = mk();
  s.createPedido(baseDraft({ itens: [{ kind: 'marmitex', size: 'M', dish: 'A' }, { kind: 'marmitex', size: 'M', dish: 'B' }] }));
  const p2 = s.createPedido(baseDraft()).pedido;
  assert.equal(p2.itens[0].mid, 'M-003');
  assert.equal(p2.num, 2);
  s.jump(T0 + 86400000); // dia seguinte
  const p3 = s.createPedido(baseDraft()).pedido;
  assert.equal(p3.itens[0].mid, 'M-001');
  assert.equal(p3.num, 1);
});

test('preço alterado depois não muda pedido já feito', () => {
  const s = mk();
  const p = s.createPedido(baseDraft()).pedido;
  s.setPrice('marmitex.G', 3000);
  assert.equal(p.itens[0].price, 2200);
  const q = s.createPedido(baseDraft()).pedido;
  assert.equal(q.itens[0].price, 3000);
});

test('cancelar pedido tira o valor do faturamento', () => {
  const s = mk();
  const p = s.createPedido(baseDraft()).pedido;
  assert.equal(s.summary('hoje').total, 2200);
  assert.ok(s.cancelPedido(p.id).ok);
  assert.equal(s.summary('hoje').total, 0);
  assert.equal(s.summary('hoje').taxas, 0);
  assert.equal(s.summary('hoje').nPedidos, 0);
  assert.equal(s.filaCozinha().length, 0);
});

// ------------------------------------------------------------------ cozinha → expedição → motoboy
test('fluxo completo: preparo, PIX com comprovante, despacho, entrega, custo por motoboy', () => {
  const s = mk();
  const joao = s.addMotoboy('João').motoboy;
  const pedro = s.addMotoboy('Pedro').motoboy;
  assert.equal(s.addMotoboy('joão').ok, false); // duplicado

  const p = s.createPedido(baseDraft({
    pagamento: 'pix',
    itens: [{ kind: 'marmitex', size: 'M', dish: 'A' }, { kind: 'marmitex', size: 'M', dish: 'B' }],
  })).pedido;

  assert.equal(s.dispatch(p.id, joao.id).ok, false); // marmitex em preparo
  s.setItemReady(p.id, p.itens[0].id, true);
  assert.equal(s.dispatch(p.id, joao.id).ok, false); // falta o segundo
  s.setItemReady(p.id, p.itens[1].id, true);
  assert.equal(s.pedidoReady(p), true);
  assert.equal(s.filaCozinha().length, 0);
  assert.match(s.dispatch(p.id, joao.id).error, /PIX/); // PIX sem comprovante
  s.setPixOk(p.id, true);
  assert.equal(s.dispatch(p.id, 'inexistente').ok, false);
  assert.ok(s.dispatch(p.id, joao.id).ok);
  assert.equal(p.status, 'saiu');
  assert.equal(p.pagoMotoboy, 400);

  s.setPrice('entrega.pagamentoMotoboy', 500); // mudar depois não altera a viagem já feita
  assert.ok(s.markDelivered(p.id).ok);

  const p2 = s.createPedido(baseDraft()).pedido;
  s.setItemReady(p2.id, p2.itens[0].id, true);
  s.dispatch(p2.id, pedro.id);
  s.markDelivered(p2.id);
  const p3 = s.createPedido(baseDraft()).pedido;
  s.setItemReady(p3.id, p3.itens[0].id, true);
  s.dispatch(p3.id, joao.id);
  s.markDelivered(p3.id);

  const sm = s.summary('hoje');
  const byName = Object.fromEntries(sm.motoboys.map((m) => [m.nome, m]));
  assert.equal(byName['João'].viagens, 2);
  assert.equal(byName['João'].valor, 400 + 500);
  assert.equal(byName['Pedro'].viagens, 1);
  assert.equal(byName['Pedro'].valor, 500);
  assert.equal(sm.custoMotoboys, 1400);
  assert.equal(sm.viagens, 3);

  // removido do cadastro, continua aparecendo no histórico
  s.removeMotoboy(joao.id);
  assert.equal(s.summary('hoje').motoboys.some((m) => m.nome === 'João'), true);
  const p4 = s.createPedido(baseDraft()).pedido;
  s.setItemReady(p4.id, p4.itens[0].id, true);
  assert.equal(s.dispatch(p4.id, joao.id).ok, false); // inativo não pode ser escolhido
  assert.ok(s.addMotoboy('João').ok); // pode voltar
});

test('retirada: só sai com tudo pronto e PIX confirmado', () => {
  const s = mk();
  const p = s.createPedido(baseDraft({ tipo: 'retirada', pagamento: 'pix' })).pedido;
  assert.equal(s.markPickedUp(p.id).ok, false);
  s.setItemReady(p.id, p.itens[0].id, true);
  assert.equal(s.markPickedUp(p.id).ok, false); // PIX
  s.setPixOk(p.id, true);
  assert.ok(s.markPickedUp(p.id).ok);
  assert.equal(s.finalizadosHoje().length, 1);
  assert.ok(s.undoPickedUp(p.id).ok);
  assert.equal(s.finalizadosHoje().length, 0);
  const e = s.createPedido(baseDraft()).pedido; // entrega não pode ser "retirada"
  assert.equal(s.markPickedUp(e.id).ok, false);
});

test('voltar um marmitex para o preparo desfaz o despacho', () => {
  const s = mk();
  const m = s.addMotoboy('Lucas').motoboy;
  const p = s.createPedido(baseDraft()).pedido;
  s.setItemReady(p.id, p.itens[0].id, true);
  s.dispatch(p.id, m.id);
  s.setItemReady(p.id, p.itens[0].id, false);
  assert.equal(p.status, 'aguardando');
  assert.equal(p.motoboyId, null);
  assert.equal(s.filaCozinha().length, 1);
});

// ------------------------------------------------------------------ cardápio editável
test('cardápio de quarta tem feijoada marcada com preço especial', () => {
  const s = mk();
  const qua = s.state.menu.qua.dishes;
  assert.equal(qua.find((d) => d.name === 'Feijoada').tipo, 'feijoada');
  assert.equal(s.state.menu.qui.dishes.length, 6);
  assert.equal(s.state.menu.seg.acomp.length, 7);
  assert.deepEqual(s.state.menu.sab.dishes, []);
});

test('editar cardápio: adicionar, renomear, trocar tipo, ordenar, remover e copiar', () => {
  const s = mk();
  assert.equal(s.menuAdd('qui', 'dishes', '').ok, false);
  assert.equal(s.menuAdd('qui', 'dishes', 'bife acebolado').ok, false); // duplicado
  const novo = s.menuAdd('qui', 'dishes', 'Feijoada completa').entry;
  assert.equal(novo.tipo, 'feijoada'); // detecta pelo nome
  assert.ok(s.menuUpdate('qui', 'dishes', novo.id, { name: 'Feijoada da casa', tipo: 'normal' }).ok);
  assert.equal(novo.name, 'Feijoada da casa');
  assert.equal(novo.tipo, 'normal');
  assert.equal(s.menuUpdate('qui', 'dishes', novo.id, { name: ' ' }).ok, false);

  const last = s.state.menu.qui.dishes.length - 1;
  s.menuMove('qui', 'dishes', novo.id, -1);
  assert.equal(s.state.menu.qui.dishes[last - 1].id, novo.id);
  assert.equal(s.menuMove('qui', 'dishes', s.state.menu.qui.dishes[0].id, -1).ok, false);

  const ac = s.menuAdd('qui', 'acomp', 'Purê').entry;
  assert.ok(s.state.menu.qui.acomp.some((a) => a.id === ac.id));
  assert.ok(s.menuRemove('qui', 'acomp', ac.id).ok);
  assert.ok(s.menuRemove('qui', 'dishes', novo.id).ok);
  assert.equal(s.menuRemove('qui', 'dishes', novo.id).ok, false);

  assert.ok(s.menuCopy('qui', 'sab').ok);
  assert.equal(s.state.menu.sab.dishes.length, s.state.menu.qui.dishes.length);
  assert.notEqual(s.state.menu.sab.dishes[0].id, s.state.menu.qui.dishes[0].id);
  assert.equal(s.menuCopy('qui', 'qui').ok, false);
});

test('preços editáveis por caminho', () => {
  const s = mk();
  assert.ok(s.setPrice('feijoada.separada.G', 7500).ok);
  assert.equal(s.state.prices.feijoada.separada.G, 7500);
  assert.equal(s.setPrice('feijoada.separada.X', 100).ok, false);
  assert.equal(s.setPrice('nada.nada', 100).ok, false);
  assert.equal(s.setPrice('kg', -1).ok, false);
  assert.equal(s.setPrice('kg', 45.5).ok, false);
});

test('produtos da venda rápida: adicionar, editar e remover', () => {
  const s = mk();
  const n = s.state.products.length;
  const r = s.addProduct({ name: 'Água', price: 300, cat: 'bottle', grupo: 'bebida' });
  assert.ok(r.ok);
  assert.equal(s.state.products.length, n + 1);
  assert.ok(s.updateProduct(r.product.id, { price: 350, name: 'Água mineral' }).ok);
  assert.equal(s.state.products.at(-1).price, 350);
  assert.equal(s.addProduct({ name: '', price: 1 }).ok, false);
  assert.ok(s.removeProduct(r.product.id).ok);
  assert.equal(s.state.products.length, n);
});

// ------------------------------------------------------------------ períodos, persistência, dados
test('resumo por período: hoje, 7 dias, mês e tudo', () => {
  const s = mk();
  s.launchWeighing(1, '1'); s.closeCard(1, 'dinheiro'); // hoje: 45,00
  s.jump(T0 - 3 * 86400000);
  s.launchWeighing(2, '1'); s.closeCard(2, 'dinheiro'); // 3 dias atrás
  s.jump(T0 - 20 * 86400000);
  s.launchWeighing(3, '1'); s.closeCard(3, 'dinheiro'); // 20 dias atrás (ainda em outubro: dia 2)
  s.jump(T0);
  assert.equal(s.summary('hoje').total, 4500);
  assert.equal(s.summary('7d').total, 9000);
  assert.equal(s.summary('mes').total, 13500);
  s.jump(T0 - 60 * 86400000);
  s.launchWeighing(4, '1'); s.closeCard(4, 'pix');
  s.jump(T0);
  assert.equal(s.summary('tudo').total, 18000);
});

test('persistência: dados sobrevivem a recarregar e preços novos aparecem em dados antigos', () => {
  const storage = memStorage();
  const a = createStore({ storage, now: () => T0 });
  a.setPrice('kg', 4700);
  a.launchWeighing(5, '0,4');
  const b = createStore({ storage, now: () => T0 });
  assert.equal(b.state.prices.kg, 4700);
  assert.equal(b.state.cards[5].lines[0].kg, 0.4);

  // backup antigo sem a chave "entrega" continua funcionando
  const antigo = JSON.parse(storage.getItem('oliveiras.v1'));
  delete antigo.prices.entrega;
  storage.setItem('oliveiras.v1', JSON.stringify(antigo));
  const c = createStore({ storage, now: () => T0 });
  assert.equal(c.state.prices.entrega.taxaPadrao, 400);

  storage.setItem('oliveiras.v1', '{quebrado');
  const d = createStore({ storage, now: () => T0 });
  assert.equal(d.state.prices.kg, 4500); // volta ao padrão sem travar
});

test('backup: exportar, importar e limpar dados de teste', () => {
  const a = mk();
  a.setPrice('kg', 4800);
  a.launchWeighing(2, '1');
  a.closeCard(2, 'pix');
  const json = a.exportJSON();

  const b = mk();
  assert.ok(b.importJSON(json).ok);
  assert.equal(b.state.prices.kg, 4800);
  assert.equal(b.summary('hoje').total, 4800);
  assert.equal(b.importJSON('{"nada":1}').ok, false);
  assert.equal(b.importJSON('não é json').ok, false);

  b.resetOperational();
  assert.equal(b.summary('tudo').total, 0);
  assert.equal(b.state.prices.kg, 4800); // configurações ficam
  b.resetAll();
  assert.equal(b.state.prices.kg, 4500);
});

test('CSV de vendas', () => {
  const s = mk();
  s.launchWeighing(1, '1');
  s.closeCard(1, 'credito');
  const csv = s.ledgerCSV();
  const lines = csv.replace('﻿', '').split('\r\n');
  assert.equal(lines[0], '"Data";"Hora";"Categoria";"Descrição";"Valor (R$)";"Pagamento"');
  assert.match(lines[1], /"22\/10\/2026";"12:00";"Pesagem \(Salão\)";"Cartão 1 · pesagem";"45,00";"Crédito"/);
});

test('assinantes são avisados a cada mudança', () => {
  const s = mk();
  let n = 0;
  const off = s.subscribe(() => { n += 1; });
  s.launchWeighing(1, '1');
  s.setPrice('kg', 5000);
  assert.equal(n, 2);
  off();
  s.setPrice('kg', 5100);
  assert.equal(n, 2);
});
