import test from 'node:test';
import assert from 'node:assert/strict';
import { historicRow } from '../legacy-row.mjs';

test('OS histórica mostra forma declarada sem inventar recebimento', () => {
  const row = historicRow({
    legacy_number: 9, customer: 'Cliente teste', plate: 'ABC1D23', seller: 'Antonio',
    items: [{category:'Serviços',description:'Alinhamento',quantity:1,unit_cents:6000}],
    notes: 'Histórico', sold_at: '2026-08-20T12:00:00-03:00',
    total_cents: '6000', payment_method: 'Pix', payment_raw: 'PIX', payment_declared_cents: '6000'
  });
  assert.equal(row.id,'legacy:9');
  assert.equal(row.seller,'Antonio');
  assert.equal(row.payment_method,'Pix');
  assert.equal(row.payment_declared_cents,6000);
  assert.deepEqual(row.payments,[]);
  assert.equal(row.status,'completed');
});

test('CREDITO não especificado deve permanecer distinto de cartão', () => {
  const row = historicRow({
    legacy_number:541,customer:'Cliente',seller:'Antonio',sold_at:'2026-09-10T12:00:00-03:00',
    total_cents:'3000',payment_method:'Crédito (não especificado)',payment_raw:'CREDITO',payment_declared_cents:'3000'
  });
  assert.equal(row.payment_raw,'CREDITO');
  assert.equal(row.payment_method,'Crédito (não especificado)');
  assert.deepEqual(row.payments,[]);
});
