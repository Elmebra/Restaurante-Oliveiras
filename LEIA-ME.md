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

## Testes
`node --test tests/*.test.js` (regras de negócio + sincronização com vários aparelhos simulados).
Local: `python3 -m http.server 8080` e abra http://localhost:8080.
