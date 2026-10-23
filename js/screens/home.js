import { icons } from '../icons.js';

const PROFILES = [
  ['balanca', 'Balança', 'Pesar o prato e lançar no cartão', 'scale', '#c79a3d'],
  ['cozinha', 'Cozinha', 'Pedidos de marmitex e fila de montagem', 'pot', '#1f4a34'],
  ['expedicao', 'Expedição', 'Despacho dos motoboys e retiradas', 'moto', '#2e6f9e'],
  ['caixa', 'Caixa & Venda Rápida', 'Fechar cartões, bebidas e doces', 'cash', '#8a5a2b'],
  ['painel', 'Painel do Dono', 'Faturamento, cardápio, preços e motoboys', 'chart', '#7a3b3b'],
];

export default {
  render() {
    const cards = PROFILES.map(([k, t, s, ic, c]) => `
      <a class="profile" href="#/${k}"><span class="pic" style="background:${c}">${icons[ic]}</span>
        <span><div class="pt">${t}</div><div class="ps">${s}</div></span><span class="chev">${icons.chev}</span></a>`).join('');
    return {
      body: `<div style="display:flex;flex-direction:column;height:100%;overflow-y:auto">
        <div class="hero">${icons.cloche}<div class="rest">RESTAURANTE</div><div class="logo">Oliveira's</div></div>
        <div style="padding:22px 16px 28px"><div class="sec" style="margin-top:0">Quem está usando este aparelho?</div>${cards}</div></div>`,
    };
  },
};
