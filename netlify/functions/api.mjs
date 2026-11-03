import { normalize, problem, text } from '../../server.mjs';
import { storage } from '../../neon-db.mjs';

const METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);
const TYPES = new Set(['pos', 'pix', 'bank', 'other']);

function historicRow(o) { return {id:'legacy:'+o.legacy_number,legacy:true,legacy_number:o.legacy_number,customer:o.customer,phone:'',plate:o.plate||'',seller:'',mechanic:'',notes:o.notes||'',items:o.items||[],payments:[],total_cents:Number(o.total_cents),status:'completed',version:1,created_at:o.sold_at,completed_at:o.sold_at}; }
function send(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin'
    }
  });
}
async function data(request) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 250000) throw problem(413, 'Dados muito grandes.');
  const raw = await request.text();
  if (raw.length > 250000) throw problem(413, 'Dados muito grandes.');
  try { return JSON.parse(raw); } catch { throw problem(400, 'JSON inválido.'); }
}
function validateOrigin(request, url) {
  if (request.method === 'GET') return;
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) throw problem(403, 'Origem não permitida.');
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const route = url.pathname;
    if (!METHODS.has(request.method)) throw problem(405, 'Método não permitido.');
    validateOrigin(request, url);

    if (route === '/api/orders') {
      if (request.method === 'GET') {
        const [orders,legacy] = await Promise.all([storage.listOrders(),storage.listLegacyOrders()]);
        return send({orders:[...orders,...legacy.map(historicRow)].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))});
      }
      if (request.method === 'POST') {
        const payload = normalize(await data(request));
        const rows = await storage.createOrder(payload);
        return send({ order: rows[0] }, 201);
      }
    }

    const match = route.match(/^\/api\/orders\/([1-9]\d*)$/);
    if (match && request.method === 'PATCH') {
      const id = Number(match[1]);
      const input = await data(request);
      if (!Number.isSafeInteger(id) || !Number.isSafeInteger(input?.version) || input.version < 1) {
        throw problem(400, 'OS ou versão inválida.');
      }
      const saved = await storage.findOrder(id);
      if (!saved.length) throw problem(404, 'OS não encontrada.');
      if (saved[0].status !== 'open') throw problem(409, 'Uma OS concluída não pode ser alterada.');
      if (saved[0].version !== input.version) throw problem(409, 'OS alterada por outra pessoa. Atualize.');
      const normalized = normalize(input, true);
      const status = input.status === 'completed' ? 'completed' : 'open';
      const patch = {
        ...normalized,
        status,
        version: input.version + 1,
        updated_at: new Date().toISOString(),
        completed_at: status === 'completed' ? new Date().toISOString() : null
      };
      const rows = await storage.updateOrder(id, input.version, patch);
      if (!rows.length) throw problem(409, 'OS alterada simultaneamente. Atualize.');
      return send({ order: rows[0] });
    }

    if (route === '/api/destinations') {
      if (request.method === 'GET') {
        const destinations = await storage.listDestinations();
        return send({ destinations });
      }
      if (request.method === 'POST') {
        const input = await data(request);
        const name = text(input?.name, 120);
        const type = text(input?.type, 10);
        const cnpj = text(input?.cnpj, 25).replace(/\D/g, '');
        if (!name || !TYPES.has(type) || (cnpj.length !== 0 && cnpj.length !== 14)) {
          throw problem(400, 'Nome, tipo ou CNPJ inválidos.');
        }
        const rows = await storage.createDestination({ name, type, cnpj });
        return send({ destination: rows[0] }, 201);
      }
      if (request.method === 'DELETE') {
        const id = Number(url.searchParams.get('id'));
        if (!Number.isSafeInteger(id) || id < 1) throw problem(400, 'Cadastro inválido.');
        await storage.deleteDestination(id);
        return send({ ok: true });
      }
    }
    throw problem(404, 'Rota inexistente.');
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    if (status === 500) console.error('Netlify API SAJ', err);
    return send({ error: status === 500 ? 'Erro inesperado no servidor.' : err.message }, status);
  }
}

export const config = { path: '/api/*' };
