import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
const { normalize } = await import('../server.mjs');

const base = () => ({
  customer: 'Cliente',
  sale_date: '2026-11-03',
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
test('vendedor em branco é recusado no backend', () => {
  assert.throws(() => normalize({ ...base(), seller: '' }), /cliente, vendedor/);
  assert.throws(() => normalize({ ...base(), seller: ' ' }, true), /cliente, vendedor/);
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

test('data do lançamento é obrigatória e não preenchida automaticamente', () => {
  const order = base();
  delete order.sale_date;
  assert.throws(() => normalize(order), /data do lançamento/);
  assert.throws(() => normalize({...base(), sale_date: ''}), /data do lançamento/);
});
test('validar ano, mês, dia e datas inexistentes', () => {
  assert.throws(() => normalize({...base(), sale_date: '2026-02-30'}), /Data do lançamento inválida/);
  assert.throws(() => normalize({...base(), sale_date: '03/11/2026'}), /data do lançamento/);
  assert.equal(normalize({...base(), sale_date: '2024-02-29'}).sale_date, '2024-02-29');
});
test('edição de OS aberta preserva a data explicitamente selecionada', () => {
  const order = {...base(),version:1,sale_date:'2026-10-31'};
  assert.equal(normalize(order,true).sale_date,'2026-10-31');
});
