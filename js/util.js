// Utilidades puras (sem DOM). Todo dinheiro no app é guardado em CENTAVOS (inteiros).

export const DAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
export const WEEK_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
export const DAY_NAMES = {
  dom: 'Domingo', seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado',
};
export const DAY_SHORT = {
  dom: 'DOM', seg: 'SEG', ter: 'TER', qua: 'QUA', qui: 'QUI', sex: 'SEX', sab: 'SÁB',
};

const DAY_MS = 86400000;

export function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

export function dayKeyOf(ts) {
  return DAYS[new Date(ts).getDay()];
}

export function dateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts, n) {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function startOfMonth(ts) {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfNextMonth(ts) {
  const d = new Date(ts);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function timeHM(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateBR(ts) {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Centavos -> "R$ 1.234,50" */
export function money(cents) {
  const total = Math.round(Number(cents) || 0);
  const neg = total < 0;
  const abs = Math.abs(total);
  const reais = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}R$ ${reais},${pad(abs % 100)}`;
}

/** Centavos -> "20,00" (para preencher campos de texto) */
export function centsToInput(cents) {
  return (Math.round(Number(cents) || 0) / 100).toFixed(2).replace('.', ',');
}

/**
 * Lê um número digitado pelo operador. Aceita vírgula ou ponto como decimal,
 * ignora espaços e unidades ("0,850 kg", "R$ 45"). Retorna NaN se não houver número.
 * Um único separador é sempre decimal ("1.234" = 1,234); vários iguais são milhar.
 */
export function parseDecimal(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  let s = String(input ?? '').replace(/\s+/g, '').replace(/[^0-9.,\-]/g, '');
  if (!/[0-9]/.test(s)) return NaN;
  const neg = s.startsWith('-');
  s = s.replace(/-/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let dec = -1;
  if (lastComma >= 0 && lastDot >= 0) dec = Math.max(lastComma, lastDot);
  else if (lastComma >= 0 && s.indexOf(',') === lastComma) dec = lastComma;
  else if (lastDot >= 0 && s.indexOf('.') === lastDot) dec = lastDot;
  let intPart;
  let fracPart = '';
  if (dec >= 0) {
    intPart = s.slice(0, dec).replace(/[.,]/g, '');
    fracPart = s.slice(dec + 1).replace(/[.,]/g, '');
  } else {
    intPart = s.replace(/[.,]/g, '');
  }
  const n = Number((intPart || '0') + (fracPart ? `.${fracPart}` : ''));
  if (!Number.isFinite(n)) return NaN;
  return neg ? -n : n;
}

/** Texto digitado em reais -> centavos inteiros (NaN se inválido ou negativo). */
export function parseMoney(input) {
  const v = parseDecimal(input);
  if (!Number.isFinite(v) || v < 0) return NaN;
  return Math.round(v * 100);
}

/** 0.85 -> "0,850"; 0.8375 -> "0,8375" (mínimo 3 casas, máximo 4) */
export function fmtKg(kg) {
  const n = Math.round(Number(kg) * 10000) / 10000;
  let s = n.toFixed(4);
  if (s.endsWith('0')) s = s.slice(0, -1);
  return s.replace('.', ',');
}

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function rangeBounds(kind, now) {
  const today = startOfDay(now);
  switch (kind) {
    case 'hoje': return [today, addDays(today, 1)];
    case '7d': return [addDays(today, -6), addDays(today, 1)];
    case 'mes': return [startOfMonth(now), startOfNextMonth(now)];
    default: return [0, Infinity];
  }
}

export { DAY_MS };
