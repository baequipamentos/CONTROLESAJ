import { neon } from '@neondatabase/serverless';

let cachedUrl = '';
let cachedSql;
function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const e = new Error('Defina DATABASE_URL na Netlify e crie as tabelas no Neon.');
    e.status = 503;
    throw e;
  }
  if (!cachedSql || cachedUrl !== url) {
    cachedSql = neon(url);
    cachedUrl = url;
  }
  return cachedSql;
}

// As consultas são estáticas e os valores são enviados como parâmetros separados.
export const storage = {
 listLegacyOrders() { return sql().query('SELECT legacy_number,customer,plate,sold_at,items,total_cents,notes,seller,payment_method,payment_raw,payment_declared_cents FROM public.saj_legacy_orders ORDER BY sold_at DESC, legacy_number DESC LIMIT 3000', []); },
  listOrders() {
    return sql().query('SELECT * FROM public.saj_orders ORDER BY id DESC LIMIT 3000', []);
  },
  findOrder(id) {
    return sql().query('SELECT id, status, version FROM public.saj_orders WHERE id = $1 LIMIT 1', [id]);
  },
  createOrder(o) {
    return sql().query(
      'INSERT INTO public.saj_orders (customer,phone,plate,seller,mechanic,notes,items,payments,total_cents,sale_date) ' +
      'VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::date) RETURNING *',
      [o.customer,o.phone,o.plate,o.seller,o.mechanic,o.notes,JSON.stringify(o.items),JSON.stringify(o.payments),o.total_cents,o.sale_date]
    );
  },
  updateOrder(id, expectedVersion, o) {
    return sql().query(
      'UPDATE public.saj_orders SET customer=$1,phone=$2,plate=$3,seller=$4,mechanic=$5,notes=$6,' +
      'items=$7::jsonb,payments=$8::jsonb,total_cents=$9,status=$10,sale_date=$13::date,version=version+1,' +
      'updated_at=now(),completed_at=CASE WHEN $10 = \'completed\' THEN now() ELSE NULL END ' +
      'WHERE id=$11 AND version=$12 AND status=\'open\' RETURNING *',
      [o.customer,o.phone,o.plate,o.seller,o.mechanic,o.notes,JSON.stringify(o.items),JSON.stringify(o.payments),o.total_cents,o.status,id,expectedVersion,o.sale_date]
    );
  },
  listDestinations() {
    return sql().query('SELECT * FROM public.saj_destinations ORDER BY name ASC', []);
  },
  createDestination(d) {
    return sql().query('INSERT INTO public.saj_destinations (name,type,cnpj) VALUES ($1,$2,$3) RETURNING *', [d.name,d.type,d.cnpj]);
  },
  deleteDestination(id) {
    return sql().query('DELETE FROM public.saj_destinations WHERE id=$1 RETURNING id', [id]);
  }
};
