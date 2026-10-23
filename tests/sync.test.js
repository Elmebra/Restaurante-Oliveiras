import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createStore } from '../js/store.js';
import { createSync } from '../js/sync.js';

// Servidor falso: roda o MESMO código do Apps Script (mergeChanges_) sobre uma tabela em memória.
function fakeServer(token = 'segredo') {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8') + '\nthis.merge = mergeChanges_;', ctx);
  const table = new Map();
  let rev = 0;
  const fetchFn = async (_url, { body }) => {
    const b = JSON.parse(body);
    const respond = (o) => ({ json: async () => o });
    if (b.token !== token) return respond({ ok: false, error: 'senha' });
    const r = ctx.merge(table, b.changes, b.since, rev);
    rev = r.rev;
    return respond(JSON.parse(JSON.stringify({ ok: true, rev, changes: r.out })));
  };
  return { fetchFn, table };
}

function device(server, t0) {
  let t = t0;
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const store = createStore({ storage, now: () => (t += 1000) });
  const sync = createSync({ store, fetchFn: server.fetchFn, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  sync.setConfig('https://script.google.com/macros/s/ABC/exec', 'segredo');
  return { store, sync, tick: (ms) => { t += ms; } };
}

const PEDIDO = { cliente: 'Ana', tipo: 'retirada', pagamento: 'dinheiro', itens: [{ kind: 'marmitex', size: 'M', dish: 'Virado', acomp: [] }] };

test('balança, cozinha e caixa em aparelhos diferentes enxergam os mesmos dados', async () => {
  const srv = fakeServer();
  const balanca = device(srv, 1e12);
  const caixa = device(srv, 1e12 + 5);
  const cozinha = device(srv, 1e12 + 9);

  balanca.store.launchWeighing(7, '0,850');
  await balanca.sync.syncNow();
  await caixa.sync.syncNow();
  assert.equal(caixa.store.state.cards[7].lines.length, 1);

  // caixa fecha o cartão -> some da balança, entra no faturamento do dono
  caixa.store.closeCard(7, 'pix');
  await caixa.sync.syncNow();
  await balanca.sync.syncNow();
  assert.equal(balanca.store.state.cards[7], undefined);
  assert.equal(balanca.store.summary('tudo').byCat.pesagem, 3825);

  // cozinha cria pedido; expedição (outro aparelho) despacha
  const p = cozinha.store.createPedido({ ...PEDIDO, tipo: 'entrega', endereco: 'Centro' }).pedido;
  await cozinha.sync.syncNow();
  await balanca.sync.syncNow();
  assert.equal(balanca.store.state.pedidos.length, 1);
  cozinha.store.setItemReady(p.id, p.itens[0].id, true);
  cozinha.store.addMotoboy('Zeca');
  await cozinha.sync.syncNow();
  await caixa.sync.syncNow();
  const zeca = caixa.store.state.motoboys[0];
  assert.equal(caixa.store.dispatch(p.id, zeca.id).ok, true);
  await caixa.sync.syncNow();
  await cozinha.sync.syncNow();
  assert.equal(cozinha.store.state.pedidos[0].status, 'saiu');
  assert.equal(cozinha.store.state.pedidos[0].motoboyNome, 'Zeca');
});

test('ids gerados em aparelhos diferentes nunca colidem', async () => {
  const srv = fakeServer();
  const a = device(srv, 1e12);
  const b = device(srv, 1e12);
  a.store.addMotoboy('A'); b.store.addMotoboy('B');
  await a.sync.syncNow(); await b.sync.syncNow(); await a.sync.syncNow();
  assert.equal(a.store.state.motoboys.length, 2);
  assert.equal(b.store.state.motoboys.length, 2);
});

test('preço alterado pelo dono chega nos outros; aparelho novo não sobrescreve com os valores padrão', async () => {
  const srv = fakeServer();
  const dono = device(srv, 1e12);
  dono.store.setPrice('kg', 4800);
  await dono.sync.syncNow();
  const novo = device(srv, 1e12 + 99999);
  await novo.sync.syncNow();
  assert.equal(novo.store.state.prices.kg, 4800);
  await dono.sync.syncNow();
  assert.equal(dono.store.state.prices.kg, 4800);
});

test('cardápio editado e pedido cancelado (some das vendas) sincronizam', async () => {
  const srv = fakeServer();
  const a = device(srv, 1e12);
  const b = device(srv, 1e12);
  a.store.menuAdd('seg', 'dishes', 'Strogonoff');
  const p = a.store.createPedido(PEDIDO).pedido;
  await a.sync.syncNow(); await b.sync.syncNow();
  assert.ok(b.store.state.menu.seg.dishes.some((d) => d.name === 'Strogonoff'));
  assert.equal(b.store.summary('tudo').byCat.marmitex, 2000);
  a.store.cancelPedido(p.id);
  await a.sync.syncNow(); await b.sync.syncNow();
  assert.equal(b.store.summary('tudo').total, 0);
  assert.equal(b.store.state.pedidos[0].status, 'cancelado');
});

test('em conflito no mesmo registro vale a alteração mais recente', async () => {
  const srv = fakeServer();
  const a = device(srv, 1e12);
  const b = device(srv, 1e12);
  a.store.addMotoboy('Zeca');
  await a.sync.syncNow(); await b.sync.syncNow();
  const id = a.store.state.motoboys[0].id;
  a.tick(10000); a.store.removeMotoboy(id);          // A remove (mais antigo)
  b.tick(60000); b.store.state.motoboys[0].name = 'Zé'; b.store.addMotoboy('Outro'); // B altera depois
  await a.sync.syncNow(); await b.sync.syncNow(); await a.sync.syncNow();
  assert.equal(a.store.state.motoboys.find((m) => m.id === id).name, 'Zé');
  assert.deepEqual(a.store.state.motoboys.map((m) => m.name).sort(), ['Outro', 'Zé']);
});

test('offline: acumula alterações e envia quando a internet volta; senha errada é recusada', async () => {
  const srv = fakeServer();
  const a = device(srv, 1e12);
  const real = srv.fetchFn;
  let down = true;
  a.sync = createSync({ store: a.store, storage: { getItem: () => null, setItem() {}, removeItem() {} }, fetchFn: (...x) => (down ? Promise.reject(new Error('offline')) : real(...x)) });
  a.sync.setConfig('https://script.google.com/macros/s/ABC/exec', 'segredo');
  a.store.launchWeighing(3, 1);
  assert.equal((await a.sync.syncNow()).ok, false);
  assert.ok(a.sync.status.pending > 0);
  down = false;
  assert.equal((await a.sync.syncNow()).ok, true);
  assert.equal(a.sync.status.pending, 0);

  const bad = createSync({ store: a.store, storage: { getItem: () => null, setItem() {}, removeItem() {} }, fetchFn: real });
  bad.setConfig('https://script.google.com/macros/s/ABC/exec', 'errada');
  const r = await bad.syncNow();
  assert.equal(r.ok, false); assert.match(r.error, /Senha/);
});

test('configuração valida o endereço', () => {
  const srv = fakeServer();
  const a = device(srv, 1e12);
  assert.equal(a.sync.setConfig('http://exemplo.com', 'x').ok, false);
});
