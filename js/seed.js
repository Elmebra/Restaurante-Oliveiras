// Dados iniciais: preços combinados com o dono e cardápio da semana (prints do WhatsApp).
// Tudo aqui pode ser editado depois pelo Painel do Dono.

export const DEFAULT_PRICES = {
  kg: 4500, // R$ 45,00 por quilo
  marmitex: { P: 1700, M: 2000, G: 2200 },
  feijoada: {
    individual: { M: 2200, G: 2500 },
    separada: { M: 6000, G: 7000 },
  },
  pratos: { feito: 2000, feijoada: 2300 },
  entrega: {
    taxaPadrao: 400, // "taxa de entrega a partir de R$ 4,00"
    pagamentoMotoboy: 400, // quanto o motoboy recebe por viagem (ajustável)
  },
};

const ACOMP_BASE = ['Batata frita', 'Ovo frito', 'Legumes', 'Berinjela empanada', 'Macarrão alho e óleo'];

const MENU_SOURCE = {
  seg: {
    dishes: ['Virado', 'Picadinho', 'Filé de frango grelhado ou empanado', 'Bife acebolado', 'Bisteca com torresmo'],
    acomp: [...ACOMP_BASE, 'Couve', 'Farofa'],
  },
  ter: {
    dishes: ['Costela com mandioca', 'Panqueca de carne', 'Filé de frango grelhado ou empanado ou parmegiana', 'Bife acebolado', 'Calabresa acebolada'],
    acomp: [...ACOMP_BASE, 'Pastelzinho'],
  },
  qua: {
    dishes: ['Feijoada', 'Filé de frango grelhado ou empanado', 'Bife acebolado', 'Bisteca com torresmo', 'Almôndegas'],
    acomp: [...ACOMP_BASE, 'Couve', 'Ovo', 'Farofa'],
  },
  qui: {
    dishes: ['Estrogonoff de frango', 'Panqueca de carne', 'Filé de frango grelhado ou empanado ou parmegiana', 'Lasanha de berinjela', 'Bife acebolado', 'Calabresa acebolada'],
    acomp: ['Batata frita', 'Ovo frito', 'Berinjela empanada', 'Macarrão alho e óleo', 'Pastelzinho'],
  },
  sex: {
    dishes: ['Filé de merluza', 'Pernil de panela', 'Filé de frango grelhado ou empanado ou parmegiana', 'Bife acebolado', 'Frango ao molho com creme de milho'],
    acomp: [...ACOMP_BASE, 'Pirão de peixe'],
  },
  sab: { dishes: [], acomp: [] },
  dom: { dishes: [], acomp: [] },
};

// Preços de venda rápida: valores de partida (ajuste em Painel > Produtos).
const PRODUCTS = [
  ['choc', 'Chocolate ao Leite', 600, 'bar', 'doce'],
  ['amendoim', 'Doce de Amendoim', 350, 'candy', 'doce'],
  ['balas', 'Balas Sortidas', 200, 'candy', 'doce'],
  ['refri2l_coca', 'Refrigerante 2L (Coca-Cola)', 1200, 'bottle', 'bebida'],
  ['refri2l_guarana', 'Refrigerante 2L (Guaraná)', 1000, 'bottle', 'bebida'],
  ['refri_lata', 'Refrigerante Lata', 600, 'can', 'bebida'],
  ['cerveja_600', 'Cerveja Garrafa 600ml', 1200, 'bottle', 'bebida'],
  ['cerveja_lata', 'Cerveja Lata', 700, 'can', 'bebida'],
  ['tubaina', 'Tubaína', 600, 'bottle', 'bebida'],
  ['suco_laranja', 'Suco Natural (Laranja)', 800, 'bottle', 'bebida'],
  ['suco_maracuja', 'Suco Natural (Maracujá)', 800, 'bottle', 'bebida'],
];

export function makeSeed() {
  let uid = 0;
  const id = (p) => `${p}${(++uid).toString(36)}`;
  const menu = {};
  for (const [day, src] of Object.entries(MENU_SOURCE)) {
    menu[day] = {
      dishes: src.dishes.map((name) => ({
        id: id('d'),
        name,
        tipo: /feijoada/i.test(name) ? 'feijoada' : 'normal',
      })),
      acomp: src.acomp.map((name) => ({ id: id('a'), name })),
    };
  }
  return {
    v: 1,
    uid,
    prices: JSON.parse(JSON.stringify(DEFAULT_PRICES)),
    menu,
    products: PRODUCTS.map(([pid, name, price, cat, grupo]) => ({ id: pid, name, price, cat, grupo })),
    motoboys: [],
    cards: {},
    pedidos: [],
    ledger: [],
    seq: { day: '', m: 0, pedido: 0 },
  };
}
