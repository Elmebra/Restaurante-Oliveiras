# Oliveira's — PWA

## Hospedar (GitHub Pages)
Crie um repositório público `oliveiras`, envie TODO o conteúdo da pasta (index.html na raiz) e ative Settings > Pages > Deploy from a branch > main / (root).
Endereço: https://SEU-USUARIO.github.io/oliveiras/ — no celular: Chrome > ⋮ > Instalar app.
Ao enviar versão nova, troque `oliveiras-v2` por `oliveiras-v3` em `sw.js` (senão os aparelhos mostram a versão antiga).

## Sincronizar com o Google Sheets (liga todos os aparelhos)
1. Em sheets.google.com crie uma planilha em branco, chamada "Oliveira's".
2. Menu **Extensões > Apps Script**. Apague o código que aparece e cole todo o conteúdo de `apps-script/Code.gs`.
3. Na linha `var TOKEN = 'TROQUE-ESTA-SENHA';` escreva uma senha sua (sem espaços). Salve (Ctrl+S).
4. **Implantar > Nova implantação** > engrenagem > **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Clique em Implantar, autorize o acesso (Avançado > Acessar... > Permitir) e **copie o URL** (termina em /exec).
5. Em CADA aparelho: abra o app > Painel do Dono > aba **Dados** > Sincronização: cole o URL e a senha > **Conectar e sincronizar**.
6. Pronto: a bolinha no topo fica verde quando sincronizado. As abas `Caixa_Vendas` e `Pedidos_Marmitex` da planilha mostram tudo em tabela.

Se alterar o Code.gs depois: Implantar > Gerenciar implantações > lápis > Versão: Nova versão > Implantar (o URL continua o mesmo).

Regras: cada aparelho guarda tudo localmente e funciona sem internet; quando volta, envia o que mudou e recebe o dos outros (a alteração mais recente vence).

## Impressão (Bematech MP-4200 TH, USB)
1. Ligue a impressora no PC/notebook (cabo USB na porta quadrada) e instale o driver da Bematech (site da Bematech > MP-4200 TH). Deixe-a como **impressora padrão** do Windows, papel 80 mm.
2. Crie um atalho do Chrome com este destino (ajuste o endereço do seu site):
   `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=https://SEU-USUARIO.github.io/oliveiras/#/cozinha`
   O `--kiosk-printing` faz imprimir direto, sem a janela de confirmação.
3. No app: Painel > Dados > Impressão: ligue "Imprimir sozinho pedidos novos", escolha 80 mm e 1 ou 2 vias, e toque em "Imprimir cupom de teste".
4. Só o aparelho com a impressão automática ligada imprime sozinho. Em qualquer aparelho existe o botão "Imprimir" no pedido.

## Testes
`node --test tests/*.test.js` (regras de negócio + sincronização com vários aparelhos simulados).
Local: `python3 -m http.server 8080` e abra http://localhost:8080.
