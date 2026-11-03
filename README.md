# Bahia Pneus — Controle de OS (SAJ)

Aplicação independente para a loja **Santo Antônio de Jesus**, com hospedagem preparada para **Netlify** e banco de dados gratuito **Neon PostgreSQL**.

## Regras da operação

- Uma única loja: SAJ, sem opção de escolher outras lojas.
- Apenas dois vendedores: **Antonio** e **Jean**.
- Mecânicos: Sérgio, Marcelo e Zé, em cadastro e apuração separados de vendedores.
- OS com numeração automática SAJ-000001, vários itens e pagamentos combinados.
- **Data do lançamento obrigatória**, informada manualmente pelo usuário, separada da data técnica de criação; pode ser alterada enquanto a OS está aberta.
- Edição de ordens abertas, conclusão com bloqueio para edição e resumo financeiro.

## Tecnologias

- Frontend: HTML, CSS e JavaScript em public/.
- API: netlify/functions/api.mjs, hospedada em Netlify Functions.
- Banco: Neon Free, PostgreSQL independente do ERP.
- Driver: @neondatabase/serverless, versão fixa 1.2.0.
- Variável de ambiente: DATABASE_URL, exclusiva do servidor, nunca do navegador.

## PASSO 2 — Criar o banco de dados Neon

1. Acesse https://console.neon.tech/ e crie uma conta ou entre.
2. Clique em **New project** e escolha o plano **Free**.
3. Informe o nome **CONTROLESAJ**; selecione uma região próxima ao Brasil, se disponível.
4. Conclua a criação; abra o **SQL Editor** do novo projeto.
5. Copie o arquivo [sql/schema.sql](sql/schema.sql) e execute no SQL Editor. Ele cria apenas saj_orders e saj_destinations.
6. Em **Connect** ou **Connection details**, localize a connection string PostgreSQL. Se disponível, use a opção pooled para as funções serverless.
7. NÃO envie a connection string com senha em conversas, prints, issues ou commits públicos.

## PASSO 3 — Publicar na Netlify

1. Acesse https://app.netlify.com e selecione Add new project / Import an existing project.
2. Conecte o GitHub e selecione baequipamentos/CONTROLESAJ, branch main.
3. Use a configuração existente em netlify.toml (publish: public, Functions: netlify/functions).
4. Em Site/Project configuration > Environment variables, crie DATABASE_URL com a connection string do Neon; mantenha-a disponível para Functions.
5. Faça deploy (ou redeploy, caso tenha configurado as variáveis após o primeiro deploy).
6. Valide a criação de OS fictícia, vários itens, pagamento dividido, edição e conclusão. O site original do ChatGPT Sites não é alterado.

## Executar em ambiente local

Com Node.js 22 ou superior:

```sh
npm install
npm test
node --env-file=.env server.mjs
```

Para executar localmente, crie um arquivo .env (ignorado pelo Git) com DATABASE_URL do Neon.

## Segurança

**Atenção: este aplicativo não possui login.** O endereço público, por si só, não protege as OS. Quem tiver acesso ao site poderá consultar dados de clientes e criar/alterar registros. Não publique dados reais sem aplicar controle de acesso (por exemplo, autenticação ou acesso restrito via gateway). A variável DATABASE_URL deve existir somente no servidor da Netlify.

O banco Neon deste projeto será separado do ERP: a credencial do projeto CONTROLESAJ não permite acessar os bancos de outros projetos Neon ou Supabase.

## Principais arquivos

- sql/schema.sql — estrutura de banco Neon.
- neon-db.mjs — consultas parametrizadas ao PostgreSQL.
- netlify/functions/api.mjs — API em Netlify Functions.
- server.mjs — execução local e validação das regras.
- public/ — telas do controle.
- .github/workflows/test.yml — testes e checagens automáticas.

**Estado atual:** código convertido e enviado ao GitHub. O projeto Neon e a implantação Netlify ainda não foram configurados.

## Importação das OS históricas

Importados diretamente no Neon: **841 OS, 1.331 itens, R$ 445.097,50**. A OS 7 sem itens e valor zero foi preservada sem somar vendas. O identificador antigo é `ANTIGA-000001` etc., sem ocupar a numeração das novas OS `SAJ-000001`. OS antigas são somente leitura. Por determinação do responsável, todas as 841 OS históricas foram atribuídas posteriormente ao vendedor **Antonio** e agora compõem seu total de vendas. Essa atribuição é administrativa, não consta do arquivo original. Mecânico histórico permanece não informado. As formas de pagamento foram vinculadas posteriormente conforme planilha complementar, mas não foram conciliadas; não entram nos valores recebidos nem na produtividade de mecânicos. Atenção à OS 841 (bieleta R$ 28.904,00) e às datas incomuns; mantidas sem suposição.

## Métodos de pagamento das OS históricas

Os métodos de pagamento das 841 OS foram vinculados por número de OS a partir de um segundo arquivo com
colunas de número, data, cliente, forma de pagamento e valor. **841 correspondências e nenhuma diferença de
valor** na comparação com `saj_legacy_orders`.

O banco registra `payment_method` (normalizado), `payment_raw` (texto original do arquivo) e
`payment_declared_cents` (valor informado na planilha). `Pix` inclui `PIX` e `pix`.
`CREDITO` (2 OS) é registrado separadamente como `Crédito (não especificado)`; não é presumido
como cartão de crédito. Os 12 lançamentos `Outro` também mantêm a nomenclatura original.

**Não lançamos nenhum pagamento histórico como recebido na tabela de transações.**
Os métodos históricos aparecem na OS e em um resumo **separado**, com a indicação **não conciliado**.
Não representam comprovante de recebimento, crédito bancário ou liquidação de boleto.

O vendedor das OS históricas permanece Antonio por decisão administrativa anterior.

## Data do lançamento

Em **Nova OS**, o vendedor deve informar a data (no navegador em formato brasileiro DD/MM/AAAA).
O campo começa **vazio**, não recebe a data atual automaticamente e é validado pelo frontend
e pelo backend. Sem data válida, a OS não é salva. A data informada é armazenada em
`saj_orders.sale_date` (tipo `date`) e passa a determinar a data na listagem, na
filtragem por período e na ordenação das OS.

A coluna `created_at` permanece com a data/hora técnica do servidor. As **OS já cadastradas antes desta mudança** receberam `sale_date` a partir de `created_at`,
no fuso America/Bahia, porque não havia data informada no cadastro.

As **841 OS históricas** mantêm a data original em `saj_legacy_orders.sold_at`.
Não houve alteração das datas históricas nem dos pagamentos.
