# Bahia Pneus — Controle de OS (SAJ)

Reimplementação independente do sistema de ordens de serviço da **loja Santo Antônio de Jesus**.

## Regras de negócio

- **Uma loja:** SAJ. Não existe seletor de loja.
- **Somente dois vendedores:** Antonio e Jean.
- **Mecânicos separados:** Sérgio, Marcelo e Zé, sem participação na classificação "vendas por vendedor".
- OS com numeração automática sequencial `SAJ-000001` (derivada do ID no PostgreSQL).
- Vários itens por OS: Pneus, Peças e Serviços, com quantidade, valor unitário e subtotal.
- Pagamentos combinados: Pix, Crédito, Débito, Dinheiro, Transferência, Boleto, com parcelas, situação e máquina/conta.
- OS aberta pode ser editada; OS concluída é bloqueada contra edição.
- Resumo por categoria, forma de pagamento, vendedor e mecânico, sem misturar funções.
- Valor e saldo calculados em **centavos inteiros** para evitar erro de arredondamento.
- Salvamento compartilhado no **PostgreSQL/Supabase** via backend. Não usa localStorage como banco de dados.

## Instalação (Node 22+)

1. Crie ou selecione um **projeto Supabase isolado** para este sistema (não executar as migrações no ERP sem revisão).
2. Cole o arquivo `sql/schema.sql` no SQL Editor do projeto e execute-o.
3. Configure, **somente no servidor**, as variáveis de `.env.example`: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (chave JWT service_role tradicional).
4. Na sua máquina, crie um arquivo `.env` com as variáveis necessárias e execute `npm test`, depois `node --env-file=.env server.mjs`. Acesse `http://localhost:3000`.
5. **Netlify**: conecte este repositório no painel da Netlify, sem configurar comando de build; `netlify.toml` publica a pasta `public/` e instala a API em `netlify/functions/api.mjs`. No painel da Netlify, configure `SUPABASE_URL` e `SUPABASE_SECRET_KEY` como variáveis de ambiente de runtime para Functions. Não use variáveis no navegador nem escreva segredos no GitHub. O arquivo `render.yaml` continua apenas como opção alternativa.

**Importante:** o site original publicado no ChatGPT Sites permanece independente. Este repositório não contém cópia dos arquivos internos nem do banco do site original. Esta é uma reimplementação.

## Segurança (leitura obrigatória)

O usuário pediu uso **sem login**. Isso implica que qualquer pessoa com acesso ao endereço público pode consultar, criar e alterar ordens de serviço, contendo informações comerciais e de clientes. **Não publique com dados reais em um domínio aberto sem implementar um controle de acesso** (por exemplo, gateway privado, VPN ou autenticação). O limitador simples de requisições e a checagem de Origin no servidor não substituem autenticação.

A chave `SUPABASE_SECRET_KEY` (ou a legada `service_role`) acessa o banco apenas pelo servidor. **Ela não fica restrita às duas tabelas** se o projeto Supabase for compartilhado com o ERP; por isso recomendamos um **projeto Supabase isolado** para SAJ. Nunca escreva essa chave em HTML, JS do navegador ou no GitHub. As tabelas possuem RLS habilitada e não permitem acesso direto a `anon` / `authenticated`.

O endpoint `/health` informa apenas se as variáveis de ambiente estão configuradas, não valida credenciais.

## URLs

- `/` — operação, OS, resumo financeiro e cadastros
- `GET, POST /api/orders` — consulta e criação de OS
- `PATCH /api/orders/:id` — edição/conclusão com controle de versão
- `GET, POST, DELETE /api/destinations` — máquinas e contas

## Testes

```sh
npm test
```

## Prioridade

Não publicar no endereço do sistema anterior até validar fluxo completo e persistência.
