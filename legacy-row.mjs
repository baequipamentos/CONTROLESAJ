// Registros históricos não são transações bancárias conciliadas.
// O método informado na planilha não comprova recebimento ou repasse.
export function historicRow(o) {
  return {
    id: 'legacy:' + o.legacy_number,
    legacy: true,
    legacy_number: o.legacy_number,
    customer: o.customer,
    phone: '',
    plate: o.plate || '',
    seller: o.seller,
    mechanic: '',
    notes: o.notes || '',
    items: o.items || [],
    payments: [],
    payment_method: o.payment_method || '',
    payment_raw: o.payment_raw || '',
    payment_declared_cents: o.payment_declared_cents === null || o.payment_declared_cents === undefined
      ? null : Number(o.payment_declared_cents),
    total_cents: Number(o.total_cents),
    status: 'completed',
    version: 1,
    created_at: o.sold_at,
    completed_at: o.sold_at
  };
}
