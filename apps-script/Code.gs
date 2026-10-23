/**
 * Oliveira's — servidor de sincronização (Google Apps Script ligado a uma planilha).
 *
 * Abas criadas automaticamente:
 *   Dados             - base técnica da sincronização (não edite)
 *   Caixa_Vendas      - todas as vendas, legível (pode filtrar, somar, gerar gráficos)
 *   Pedidos_Marmitex  - pedidos de marmitex/pratos com status e motoboy
 *
 * Como funciona: cada aparelho envia só o que mudou e recebe o que mudou nos outros.
 * Em conflito no mesmo registro, vale a alteração mais recente.
 */

// TROQUE por uma senha sua (a mesma será digitada no app). Não use espaços.
var TOKEN = 'TROQUE-ESTA-SENHA';

var HEADER = ['k', 'u', 'rev', 'del', 'v'];

/** Lógica pura (testável): aplica alterações na tabela (Map chave -> linha) e devolve o que o aparelho ainda não tem. */
function mergeChanges_(table, changes, since, rev0) {
  var rev = rev0;
  var accepted = {};
  var touched = {};
  (changes || []).forEach(function (ch) {
    var row = table.get(ch.k);
    if (row && row.u >= ch.u) return; // o servidor já tem versão igual ou mais nova
    rev += 1;
    table.set(ch.k, { k: ch.k, u: ch.u, rev: rev, del: !!ch.del, v: ch.del ? '' : JSON.stringify(ch.v) });
    accepted[ch.k] = true;
    touched[ch.k.split(':')[0]] = true;
  });
  var out = [];
  table.forEach(function (row) {
    if (row.rev > since && !accepted[row.k]) {
      out.push({ k: row.k, u: row.u, del: row.del, v: row.del ? null : JSON.parse(row.v) });
    }
  });
  return { rev: rev, out: out, touched: touched };
}

function doGet() {
  return json_({ ok: true, app: 'oliveiras' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return json_({ ok: false, error: 'senha' });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Dados') || ss.insertSheet('Dados');
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);

    var table = new Map();
    var props = PropertiesService.getScriptProperties();
    var rev0 = Number(props.getProperty('rev') || 0);
    var n = sh.getLastRow() - 1;
    if (n > 0) {
      sh.getRange(2, 1, n, HEADER.length).getValues().forEach(function (r) {
        if (r[0]) table.set(String(r[0]), { k: String(r[0]), u: Number(r[1]), rev: Number(r[2]), del: r[3] === true || r[3] === 'TRUE', v: String(r[4] || '') });
      });
    }

    var res = mergeChanges_(table, body.changes, Number(body.since || 0), rev0);

    if (res.rev !== rev0) {
      var rows = [];
      table.forEach(function (row) { rows.push([row.k, row.u, row.rev, row.del, row.v]); });
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, HEADER.length).clearContent();
      if (rows.length) sh.getRange(2, 1, rows.length, HEADER.length).setValues(rows);
      props.setProperty('rev', String(res.rev));
      if (res.touched.ledger) writeVendas_(ss, table);
      if (res.touched.pedidos) writePedidos_(ss, table);
    }
    return json_({ ok: true, rev: res.rev, changes: res.out });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function live_(table, prefix) {
  var list = [];
  table.forEach(function (row) {
    if (!row.del && row.k.indexOf(prefix + ':') === 0) list.push(JSON.parse(row.v));
  });
  return list;
}

function fill_(ss, name, header, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  var data = [header].concat(rows);
  sh.getRange(1, 1, data.length, header.length).setValues(data);
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
  sh.setFrozenRows(1);
}

var CATS_ = { pesagem: 'Pesagem (Salão)', marmitex: 'Marmitex', pratos: 'Pratos Prontos', bebidas: 'Bebidas / Doces', taxa: 'Taxa de entrega' };
var PAGS_ = { dinheiro: 'Dinheiro', debito: 'Débito', credito: 'Crédito', pix: 'PIX' };

function writeVendas_(ss, table) {
  var tz = ss.getSpreadsheetTimeZone();
  var list = live_(table, 'ledger').sort(function (a, b) { return a.ts - b.ts; });
  fill_(ss, 'Caixa_Vendas', ['Data', 'Hora', 'Categoria', 'Descrição', 'Valor (R$)', 'Pagamento'],
    list.map(function (l) {
      var d = new Date(l.ts);
      return [Utilities.formatDate(d, tz, 'dd/MM/yyyy'), Utilities.formatDate(d, tz, 'HH:mm'), CATS_[l.cat] || l.cat, l.desc, l.amount / 100, PAGS_[l.pagamento] || l.pagamento];
    }));
}

function writePedidos_(ss, table) {
  var tz = ss.getSpreadsheetTimeZone();
  var list = live_(table, 'pedidos').sort(function (a, b) { return a.ts - b.ts; });
  fill_(ss, 'Pedidos_Marmitex', ['Data', 'Hora', 'Nº', 'Cliente', 'Tipo', 'Status', 'Motoboy', 'Itens', 'Total (R$)', 'Pagamento'],
    list.map(function (p) {
      var d = new Date(p.ts);
      return [Utilities.formatDate(d, tz, 'dd/MM/yyyy'), Utilities.formatDate(d, tz, 'HH:mm'), p.num, p.cliente, p.tipo, p.status, p.motoboyNome || '',
        p.itens.map(function (i) { return i.mid + ' ' + i.label; }).join('; '), (p.subtotal + p.taxa) / 100, PAGS_[p.pagamento] || p.pagamento];
    }));
}
