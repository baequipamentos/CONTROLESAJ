import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const home = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const SELLS = ['Antonio', 'Jean'];
const MECHANICS = ['', 'Sérgio', 'Marcelo', 'Zé'];
const CATEGORIES = ['Pneus', 'Peças', 'Serviços'];
const METHODS = ['Pix', 'Crédito', 'Débito', 'Dinheiro', 'Transferência', 'Boleto'];
const PAY_STATES = ['recebido', 'pendente', 'estornado', 'cancelado'];
const TYPES = ['pos', 'pix', 'bank', 'other'];
const LIMIT = 250000;
const hits = new Map();

function reply(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin'
  });
  res.end(JSON.stringify(body));
}
function problem(code, message) {
  const e = new Error(message);
  e.status = code;
  return e;
}
function text(value, size = 160) {
  return String(value ?? '').trim().slice(0, size);
}
function integer(value, max = 1e12) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}
function normalize(input, existing = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw problem(400, 'Dados inválidos.');
  const customer = text(input.customer);
  const seller = text(input.seller, 30);
  const mechanic = text(input.mechanic, 30);
  if (!customer || !SELLS.includes(seller) || !MECHANICS.includes(mechanic)) throw problem(400, 'Informe cliente, vendedor e mecânico válido.');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) throw problem(400, 'Adicione de 1 a 100 itens.');
  const items = input.items.map(item => {
    const category = text(item?.category, 20);
    const description = text(item?.description, 200);
    const quantity = Number(item?.quantity);
    const unit_cents = item?.unit_cents;
    if (!CATEGORIES.includes(category) || !description || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || !integer(unit_cents)) throw problem(400, 'Verifique categoria, descrição, quantidade e valor dos itens.');
    return { category, description, quantity, unit_cents };
  });
  const total_cents = items.reduce((sum, item) => sum + item.quantity * item.unit_cents, 0);
  if (!Number.isSafeInteger(total_cents) || total_cents < 1) throw problem(400, 'O total da OS deve ser maior que zero.');
  if (!Array.isArray(input.payments) || input.payments.length > 30) throw problem(400, 'Limite de 30 lançamentos de pagamento por OS.');
  const payments = input.payments.map(p => {
    const method = text(p?.method, 30);
    const status = text(p?.status, 20);
    const amount_cents = p?.amount_cents;
    const installments = Number(p?.installments ?? 1);
    const destination_id = p?.destination_id === '' || p?.destination_id == null ? null : Number(p?.destination_id);
    if (!METHODS.includes(method) || !PAY_STATES.includes(status) || !integer(amount_cents) || amount_cents < 1 || !Number.isInteger(installments) || installments < 1 || installments > 36 || (destination_id !== null && (!Number.isSafeInteger(destination_id) || destination_id < 1))) throw problem(400, 'Verifique forma, valor, parcelas e situação dos pagamentos.');
    return { method, status, amount_cents, installments, destination_id, reference: text(p?.reference, 120) };
  });
  const committed = payments.filter(p => p.status === 'recebido' || p.status === 'pendente').reduce((sum, p) => sum + p.amount_cents, 0);
  if (committed > total_cents) throw problem(400, 'A soma dos pagamentos recebidos e pendentes não pode exceder o total da OS.');
  const result = {
    customer, seller, mechanic,
    phone: text(input.phone, 32), plate: text(input.plate, 15).toUpperCase(),
    notes: text(input.notes, 2000), items, payments, total_cents
  };
  if (existing && !Number.isSafeInteger(input.version)) throw problem(400, 'Versão da OS inválida.');
  return result;
}
async function jsonBody(req) {
  let body = '';
  for await (const part of req) {
    body += part.toString('utf8');
    if (body.length > LIMIT) throw problem(413, 'Dados muito grandes.');
  }
  try { return JSON.parse(body); }
  catch { throw problem(400, 'JSON inválido.'); }
}
async function db(method, table, query = '', data = undefined, extra = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw problem(503, 'Banco ainda não configurado no servidor.');
  const url = base.replace(/\/$/, '') + '/rest/v1/' + table + query;
  const response = await fetch(url, {
    method,
    headers: {
      apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json',
      Accept: 'application/json', Prefer: 'return=representation', ...extra
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(12000)
  });
  const raw = await response.text();
  if (!response.ok) {
    console.error('DB', method, table, response.status, raw.slice(0, 400));
    throw problem(502, 'Falha no banco de dados. Verifique configuração e migração SQL.');
  }
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch { throw problem(502, 'Resposta inválida do banco.'); }
}
function requireWritable(req) {
  const origin = req.headers.origin;
  if (origin) {
    let valid = false;
    try { valid = new URL(origin).host === req.headers.host; } catch { valid = false; }
    if (!valid) throw problem(403, 'Origem não permitida.');
  }
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].slice(0, 120);
  const now = Date.now();
  const entry = hits.get(ip) || { time: now, count: 0 };
  if (now - entry.time > 60000) { entry.time = now; entry.count = 0; }
  if (++entry.count > 60) throw problem(429, 'Muitas operações. Aguarde um minuto.');
  hits.set(ip, entry);
  if (hits.size > 10000) hits.clear();
}
async function serve(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;
  if (pathname === '/health') return reply(res, 200, { ok: true, database_configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) });
  if (pathname.startsWith('/api/')) {
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) throw problem(405, 'Método não permitido.');
    if (req.method !== 'GET') requireWritable(req);
    if (pathname === '/api/orders' && req.method === 'GET') {
      const list = await db('GET', 'saj_orders', '?select=*&order=id.desc&limit=3000');
      return reply(res, 200, { orders: list });
    }
    if (pathname === '/api/orders' && req.method === 'POST') {
      const order = normalize(await jsonBody(req));
      const created = await db('POST', 'saj_orders', '?select=*', order);
      return reply(res, 201, { order: created[0] });
    }
    const match = pathname.match(/^\/api\/orders\/([1-9]\d*)$/);
    if (match && req.method === 'PATCH') {
      const input = await jsonBody(req);
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id) || !Number.isSafeInteger(input?.version) || input.version < 1) throw problem(400, 'OS ou versão inválida.');
      const saved = await db('GET', 'saj_orders', '?id=eq.' + id + '&select=id,status,version');
      if (!saved.length) throw problem(404, 'OS não encontrada.');
      if (saved[0].status !== 'open') throw problem(409, 'Uma OS concluída não pode ser alterada.');
      if (saved[0].version !== input.version) throw problem(409, 'A OS foi modificada por outra pessoa. Atualize a lista.');
      const order = normalize(input, true);
      const status = input.status === 'completed' ? 'completed' : 'open';
      const patch = {
        ...order, status, version: input.version + 1,
        updated_at: new Date().toISOString(),
        completed_at: status === 'completed' ? new Date().toISOString() : null
      };
      const result = await db('PATCH', 'saj_orders', '?id=eq.' + id + '&version=eq.' + input.version + '&status=eq.open&select=*', patch);
      if (!result.length) throw problem(409, 'Conflito: a OS foi alterada. Atualize.');
      return reply(res, 200, { order: result[0] });
    }
    if (pathname === '/api/destinations' && req.method === 'GET') {
      const list = await db('GET', 'saj_destinations', '?select=*&order=name.asc');
      return reply(res, 200, { destinations: list });
    }
    if (pathname === '/api/destinations' && req.method === 'POST') {
      const input = await jsonBody(req);
      const name = text(input?.name, 120);
      const type = text(input?.type, 10);
      const cnpj = text(input?.cnpj, 25).replace(/\D/g, '');
      if (!name || !TYPES.includes(type) || (cnpj.length !== 0 && cnpj.length !== 14)) throw problem(400, 'Nome, tipo ou CNPJ inválidos.');
      const created = await db('POST', 'saj_destinations', '?select=*', { name, type, cnpj });
      return reply(res, 201, { destination: created[0] });
    }
    if (pathname === '/api/destinations' && req.method === 'DELETE') {
      const id = Number(url.searchParams.get('id'));
      if (!Number.isSafeInteger(id) || id < 1) throw problem(400, 'Cadastro inválido.');
      await db('DELETE', 'saj_destinations', '?id=eq.' + id);
      return reply(res, 200, { ok: true });
    }
    throw problem(404, 'Rota inexistente.');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') throw problem(405, 'Método não permitido.');
  const file = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' }[pathname];
  if (!file) throw problem(404, 'Página inexistente.');
  const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'text/css';
  const content = await readFile(join(home, 'public', file));
  res.writeHead(200, {
    'Content-Type': type + '; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'Cache-Control': 'no-store'
  });
  res.end(req.method === 'HEAD' ? undefined : content);
}
const server = createServer((req, res) => {
  serve(req, res).catch(err => {
    const code = Number.isInteger(err?.status) ? err.status : 500;
    if (code === 500) console.error('API internal error', err);
    if (!res.headersSent) reply(res, code, { error: code === 500 ? 'Erro inesperado no servidor.' : err.message });
  });
});
if (process.env.NODE_ENV !== 'test') server.listen(PORT, '0.0.0.0', () => console.log('Controle SAJ na porta ' + PORT));
export { server, normalize };
