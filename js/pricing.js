// Regras de preço (puras). Valores em centavos.
//
//  - Marmitex comum ........ Pequena / Média / Grande (prices.marmitex)
//  - Feijoada individual ... Média / Grande            (prices.feijoada.individual)
//  - Feijoada separada ..... Média / Grande            (prices.feijoada.separada)
//  - Prato feito ........... Prato Feito / Prato Feijoada (prices.pratos)
//  - Balança ............... preço por kg              (prices.kg)

export const SIZES = { P: 'Pequena', M: 'Média', G: 'Grande' };
export const MODOS = { individual: 'Individual', separada: 'Separada' };
export const PRATOS = { feito: 'Prato Feito', feijoada: 'Prato Feijoada' };

/** Tamanhos disponíveis: a feijoada só existe em Média e Grande. */
export function sizesFor(kind) {
  return kind === 'feijoada' ? ['M', 'G'] : ['P', 'M', 'G'];
}

/**
 * item = { kind: 'marmitex', size }
 *      | { kind: 'feijoada', modo: 'individual'|'separada', size: 'M'|'G' }
 *      | { kind: 'prato',    tipo: 'feito'|'feijoada' }
 */
export function itemPrice(prices, item) {
  let p;
  if (item.kind === 'marmitex') p = prices.marmitex?.[item.size];
  else if (item.kind === 'feijoada') p = prices.feijoada?.[item.modo]?.[item.size];
  else if (item.kind === 'prato') p = prices.pratos?.[item.tipo];
  if (!Number.isInteger(p) || p < 0) throw new Error('Preço indisponível para este item');
  return p;
}

export function itemLabel(item) {
  if (item.kind === 'marmitex') {
    return `Marmitex ${SIZES[item.size]}${item.dish ? ` — ${item.dish}` : ''}`;
  }
  if (item.kind === 'feijoada') {
    return `Feijoada ${MODOS[item.modo]} ${SIZES[item.size]}`;
  }
  return item.tipo === 'feijoada'
    ? 'Prato Feijoada'
    : `Prato Feito${item.dish ? ` — ${item.dish}` : ''}`;
}

/** Categoria de faturamento do item (Painel do Dono). */
export function itemCategory(item) {
  return item.kind === 'prato' ? 'pratos' : 'marmitex';
}

/** Valor da pesagem em centavos para qualquer peso digitado (kg decimal). */
export function pesagemCents(kg, perKgCents) {
  return Math.round(kg * perKgCents + 1e-9);
}
