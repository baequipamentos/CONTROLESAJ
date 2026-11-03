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
4. Rode `node --test` e depois `node server.mjs`. Acesse `http://localhost:3000`.
5. Para publicar, conecte este repositório ao Render com `render.yaml` e cadastre as variáveis secretas no painel. A escolha de plano e possíveis custos deve ser validada antes da publicação.

**Importante:** o site original publicado no ChatGPT Sites permanece independente. Este repositório não contém cópia dos arquivos internos nem do banco do site original. Esta é uma reimplementação.

## Segurança (leitura obrigatória)

O usuário pediu uso **sem login**. Isso implica que qualquer pessoa com acesso ao endereço público pode consultar, criar e alterar ordens de serviço, contendo informações comerciais e de clientes. **Não publique com dados reais em um domínio aberto sem implementar um controle de acesso** (por exemplo, gateway privado, VPN ou autenticação). O limitador simples de requisições e a checagem de Origin no servidor não substituem autenticação.

A chave `service_role` acessa o banco apenas pelo servidor. Nunca escreva essa chave em HTML, JS do navegador ou no GitHub. As tabelas possuem RLS habilitada e não permitem acesso direto a `anon` / `authenticated`.

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
