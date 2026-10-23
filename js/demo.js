// Dados de demonstração (só para testar o app). Gera pedidos, pesagens e vendas realistas.
export function loadDemo(store) {
  let t = Date.now() - 3 * 3600e3;
  store.setClock(() => (t += 60e3));
  try {
    for (const nome of ['Carlos', 'Diego', 'Marcos']) store.addMotoboy(nome);
    const mot = store.state.motoboys.filter((m) => m.active);
    [0.62, 0.85, 1.1, 0.48, 0.73].forEach((kg, i) => {
      store.launchWeighing(i + 1, kg);
      if (i < 3) store.closeCard(i + 1, ['dinheiro', 'pix', 'credito'][i]);
    });
    store.addCardItems(4, [{ productId: 'refri_lata', qty: 1 }]);
    store.sellQuick([{ productId: 'choc', qty: 2 }, { productId: 'refri2l_coca', qty: 1 }], 'dinheiro');
    const mk = (extra) => store.createPedido({ tipo: 'entrega', endereco: 'Centro', pagamento: 'dinheiro', ...extra });
    const a = mk({ cliente: 'Dona Lúcia', itens: [{ kind: 'marmitex', size: 'G', dish: 'Virado', acomp: ['Couve', 'Farofa'] }, { kind: 'marmitex', size: 'M', dish: 'Picadinho', acomp: [] }] });
    const b = mk({ cliente: 'Sr. Paulo', itens: [{ kind: 'feijoada', modo: 'separada', size: 'G', dish: 'Feijoada', acomp: [] }], pagamento: 'pix' });
    mk({ cliente: 'Ana', tipo: 'retirada', itens: [{ kind: 'prato', tipo: 'feijoada', dish: '', acomp: [] }] });
    for (const p of [a, b]) {
      for (const it of p.pedido.itens) store.setItemReady(p.pedido.id, it.id, true);
    }
    store.dispatch(a.pedido.id, mot[0].id);
    store.markDelivered(a.pedido.id);
  } finally {
    store.setClock(null);
  }
}
