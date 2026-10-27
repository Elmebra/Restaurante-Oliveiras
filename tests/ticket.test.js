import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { ticketPedido, ticketSalao } from '../js/ticket.js';

const mk = () => createStore({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });

test('cupom do pedido traz M-xxx grande, endereço, acompanhamentos, bebida, taxa e total', () => {
  const s = mk();
  const { pedido } = s.createPedido({
    cliente: 'Ana <b>', telefone: '(11) 99999-0000', tipo: 'entrega', endereco: 'Rua A, 10', pagamento: 'pix', obs: 'sem cebola',
    itens: [{ kind: 'marmitex', size: 'G', dish: 'Bife acebolado', acomp: ['Farofa', 'Couve'] }, { kind: 'feijoada', modo: 'separada', size: 'M', dish: 'Feijoada', acomp: [] }],
    bebidas: [{ productId: 'refri_lata', qty: 2 }],
  });
  const h = ticketPedido(pedido);
  for (const t of ['M-001', 'M-002', 'ENTREGA', 'Rua A, 10', 'Farofa, Couve', '2x Refrigerante Lata', 'sem cebola', 'Taxa entrega', 'R$ 4,00', 'R$ 98,00', 'aguardando comprovante', 'size: 80mm']) assert.ok(h.includes(t), t);
  assert.ok(!h.includes('<b>'), 'nome do cliente deve ser escapado');
  assert.equal((ticketPedido(pedido, { copies: 2 }).match(/class="page"/g) || []).length, 2);
  assert.ok(ticketPedido(pedido, { width: 58 }).includes('size: 58mm'));
});

test('cupom de retirada não mostra taxa; cupom da comanda lista os pratos', () => {
  const s = mk();
  const { pedido } = s.createPedido({ cliente: 'Bia', tipo: 'retirada', pagamento: 'dinheiro', itens: [{ kind: 'marmitex', size: 'P', dish: 'Virado', acomp: [] }] });
  const h = ticketPedido(pedido);
  assert.ok(h.includes('RETIRADA') && !h.includes('Taxa entrega'));
  const r = s.addCardDishes(5, [{ key: 'feito', qty: 2 }]);
  const c = ticketSalao(5, r.lines, r.lines[0].ts);
  assert.ok(c.includes('COMANDA 5') && c.includes('2x Prato Feito'));
});
