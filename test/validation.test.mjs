import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
const { normalize } = await import('../server.mjs');

const base = () => ({
  customer: 'Cliente',
  seller: 'Antonio',
  mechanic: 'Sérgio',
  items: [{ category: 'Pneus', description: 'Pneu 205/55R16', quantity: 4, unit_cents: 30000 }],
  payments: [{ method: 'Crédito', status: 'recebido', amount_cents: 120000, installments: 6, destination_id: null }]
});

test('somar quatro pneus e aceitar seis parcelas', () => {
  const result = normalize(base());
  assert.equal(result.total_cents, 120000);
  assert.equal(result.payments[0].installments, 6);
});
test('vendedor não pode ser mecânico', () => {
  assert.throws(() => normalize({ ...base(), seller: 'Marcelo' }));
});
test('mecânico não entra na lista de vendedores', () => {
  assert.equal(normalize({ ...base(), mechanic: 'Zé' }).seller, 'Antonio');
});
test('proibir pagamento maior que venda', () => {
  const data = base();
  data.payments[0].amount_cents = 120001;
  assert.throws(() => normalize(data));
});
test('aceitar pagamentos combinados', () => {
  const data = base();
  data.payments = [
    { method: 'Pix', status: 'recebido', amount_cents: 30000 },
    { method: 'Crédito', status: 'pendente', amount_cents: 90000, installments: 3 }
  ];
  assert.equal(normalize(data).payments.length, 2);
});
