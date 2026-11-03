
'use strict';
const state = {
  tab: 'orders', orders: [], destinations: [], draft: null, busy: false,
  filter: { q: '', status: '', from: '', to: '' }
};
const SELLERS = ['Antonio', 'Jean'];
const MECHANICS = ['', 'Sérgio', 'Marcelo', 'Zé'];
const CATEGORIES = ['Pneus', 'Peças', 'Serviços'];
const METHODS = ['Pix', 'Crédito', 'Débito', 'Dinheiro', 'Transferência', 'Boleto'];
const PAY_STATES = [{ value: 'recebido', label: 'Recebido' }, { value: 'pendente', label: 'Pendente' }, { value: 'estornado', label: 'Estornado' }, { value: 'cancelado', label: 'Cancelado' }];
const $ = id => document.getElementById(id);
function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
}
function money(cents) {
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format((Number(cents)||0)/100);
}
function moneyInput(cents) {
  return ((Number(cents)||0)/100).toFixed(2).replace('.', ',');
}
function cents(raw) {
  let value = String(raw || '').trim().replace(/[^\d,.-]/g, '');
  if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, '');
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
function osNumber(id) { return 'SAJ-' + String(id).padStart(6, '0'); }
function dateBR(s) { return s ? new Date(s).toLocaleDateString('pt-BR', { timeZone:'America/Bahia' }) : '—'; }
function dateISO(s) {
  if (!s) return '';
  const d = new Date(s);
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
function payReceived(order) {
  return (order.payments || []).filter(x => x.status === 'recebido').reduce((s,p) => s + Number(p.amount_cents || 0), 0);
}
function totalDraft(d) {
  return (d.items || []).reduce((sum,i) => sum + (Number(i.quantity)||0) * (Number(i.unit_cents)||0), 0);
}
function select(name, options, value, attrs = '') {
  return '<select name="' + h(name) + '" ' + attrs + '>' + options.map(o => {
    const opt = typeof o === 'string' ? { value:o, label:o } : o;
    return '<option value="' + h(opt.value) + '"' + (String(value ?? '') === String(opt.value) ? ' selected' : '') + '>' + h(opt.label) + '</option>';
  }).join('') + '</select>';
}
function label(text, body, className = '') {
  return '<div class="small-field ' + className + '"><label>' + h(text) + '</label>' + body + '</div>';
}
function input(value, attrs = '', type = 'text') {
  return '<input type="' + type + '" value="' + h(value) + '" ' + attrs + '>';
}
function panelTitle(kicker, title, subtitle, newButton = true) {
  return '<div class="eyebrow">' + h(kicker) + '</div><div class="title-row"><div><h1>' + h(title) + '</h1><p class="subtitle">' + h(subtitle) + '</p></div>' +
    (newButton ? '<button type="button" class="btn primary" data-action="new">＋ Nova OS</button>' : '') + '</div>';
}
function alertMessage(message, type = 'error') {
  $('alert').innerHTML = message ? '<div class="alert ' + type + '">' + h(message) + '</div>' : '';
}
async function api(url, opts = {}) {
  const result = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  let data;
  try { data = await result.json(); } catch { throw new Error('Resposta inválida do servidor.'); }
  if (!result.ok) throw new Error(data.error || 'Falha na operação.');
  return data;
}
async function reload() {
  try {
    const [o,d] = await Promise.all([api('/api/orders'), api('/api/destinations')]);
    state.orders = Array.isArray(o.orders) ? o.orders : [];
    state.destinations = Array.isArray(d.destinations) ? d.destinations : [];
    alertMessage('');
  } catch (err) {
    alertMessage(err.message, 'error');
  }
  render();
}
function visibleOrders() {
  const f = state.filter;
  const q = f.q.trim().toLocaleLowerCase('pt-BR');
  return state.orders.filter(o => {
    if (f.status && o.status !== f.status) return false;
    if (f.from && dateISO(o.created_at) < f.from) return false;
    if (f.to && dateISO(o.created_at) > f.to) return false;
    if (!q) return true;
    return [osNumber(o.id), o.customer, o.seller, o.mechanic, o.phone, o.plate].join(' ').toLocaleLowerCase('pt-BR').includes(q);
  });
}
function stats(orders) {
  const completed = orders.filter(o => o.status === 'completed');
  const sold = completed.reduce((s,o) => s + Number(o.total_cents || 0), 0);
  const paid = orders.reduce((s,o) => s + payReceived(o), 0);
  return { completed, sold, paid, open: orders.length - completed.length };
}
function statCards(orders) {
  const s = stats(orders);
  return '<div class="stats">' +
    '<div class="card stat"><div class="stat-label">Vendido · OS concluídas</div><div class="stat-value">' + money(s.sold) + '</div><span class="stat-note">' + s.completed.length + ' ordens concluídas</span></div>' +
    '<div class="card stat"><div class="stat-label">Pago pelos clientes</div><div class="stat-value">' + money(s.paid) + '</div><span class="stat-note">Não representa repasse bancário</span></div>' +
    '<div class="card stat"><div class="stat-label">OS em aberto</div><div class="stat-value">' + String(s.open).padStart(2,'0') + '</div><span class="stat-note">Aguardando conclusão</span></div>' +
    '</div>';
}
function filters() {
  const f = state.filter;
  return '<div class="card filter-card">' +
    label('Buscar OS, cliente ou vendedor', input(f.q, 'data-filter="q" placeholder="OS, cliente ou vendedor" id="qfilter"'), 'search-box') +
    label('Situação', select('status', [{ value:'', label:'Todas' }, { value:'open', label:'Em aberto' }, { value:'completed', label:'Concluídas' }], f.status, 'data-filter="status"')) +
    label('De', input(f.from, 'data-filter="from"', 'date')) +
    label('Até', input(f.to, 'data-filter="to"', 'date')) +
    '<button class="btn" type="button" data-action="apply" aria-label="Aplicar filtros">↻ Filtrar</button></div>';
}
function statusTag(o) {
  return '<span class="status ' + (o.status === 'completed' ? 'completed' : '') + '">' + (o.status === 'completed' ? 'Concluída' : 'Em aberto') + '</span>';
}
function renderOrders() {
  const orders = visibleOrders();
  let table;
  if (orders.length === 0) {
    table = '<div class="empty"><div class="empty-symbol">▤</div><h3>' +
      (state.orders.length ? 'Nenhuma OS encontrada' : 'Pronto para a primeira venda') +
      '</h3><p>' + (state.orders.length ? 'Altere os filtros para consultar outras ordens.' : 'Crie uma OS, adicione os itens e registre os pagamentos.') +
      '</p><button class="btn primary" type="button" data-action="new">＋ Criar nova OS</button></div>';
  } else {
    table = '<div class="table-wrap"><table><thead><tr><th>OS</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Mecânico</th><th>Total</th><th>Recebido</th><th>Situação</th><th></th></tr></thead><tbody>' +
      orders.map(o => '<tr><td><b>' + h(osNumber(o.id)) + '</b></td><td>' + h(dateBR(o.created_at)) + '</td><td><b>' + h(o.customer) + '</b><div class="muted">' + h(o.plate) + '</div></td><td>' + h(o.seller) + '</td><td>' + h(o.mechanic || '—') + '</td><td class="amount">' + money(o.total_cents) + '</td><td>' + money(payReceived(o)) + '</td><td>' + statusTag(o) + '</td><td><button type="button" class="link-action" data-action="open" data-id="' + h(o.id) + '">' + (o.status === 'open' ? 'Editar' : 'Visualizar') + '</button></td></tr>').join('') +
      '</tbody></table></div>';
  }
  $('screen').innerHTML = panelTitle('CONTROLE DIÁRIO', 'Ordens de serviço', 'Loja Santo Antônio de Jesus · todas as vendas em um só lugar.') +
    statCards(orders) + filters() +
    '<div class="card orders-card"><div class="row-between"><h3>Suas ordens</h3><span class="hint">' + orders.length + ' registros · mais recentes primeiro</span></div>' + table + '</div>';
}
function summaryGroup(title, names, compute) {
  return '<div class="card summary-box"><h3>' + h(title) + '</h3>' + names.map(name => '<div class="summary-row"><span>' + h(name) + '</span><strong>' + money(compute(name)) + '</strong></div>').join('') + '</div>';
}
function renderSummary() {
  const orders = visibleOrders();
  const completed = orders.filter(o => o.status === 'completed');
  const category = name => completed.reduce((sum,o) => sum + (o.items || []).filter(i => i.category === name).reduce((s,i) => s + Number(i.unit_cents)*Number(i.quantity),0),0);
  const method = name => orders.reduce((sum,o) => sum + (o.payments || []).filter(p => p.method === name && p.status === 'recebido').reduce((s,p) => s + Number(p.amount_cents),0),0);
  const seller = name => completed.filter(o => o.seller === name).reduce((sum,o) => sum + Number(o.total_cents),0);
  const mechanic = name => completed.filter(o => o.mechanic === name).reduce((sum,o) => sum + (o.items || []).filter(i => i.category === 'Serviços').reduce((s,i) => s + Number(i.unit_cents)*Number(i.quantity),0),0);
  $('screen').innerHTML = panelTitle('ACOMPANHAMENTO', 'Resumo financeiro', 'Somente SAJ · valores de OS concluídas, exceto pagamentos recebidos.') +
    statCards(orders) + filters() +
    '<div class="summary-grid">' +
    summaryGroup('Vendas por categoria', CATEGORIES, category) +
    summaryGroup('Formas de pagamento (recebidas)', METHODS, method) +
    summaryGroup('Vendas por vendedor', SELLERS, seller) +
    summaryGroup('Serviços por mecânico (separado das vendas)', MECHANICS.filter(Boolean), mechanic) +
    '</div><p class="subtle spacing-top">Valores de venda e categorias consideram somente OS concluídas. Formas de pagamento mostram somente recebimentos; estornos, cancelamentos e pendências não entram em recebidos.</p>';
}
function newDraft() {
  return { customer:'', phone:'', plate:'', seller:'Antonio', mechanic:'', notes:'', status:'open', version:1, items:[{category:'Pneus',description:'',quantity:1,unit_cents:0}], payments:[] };
}
function orderOptions(values, value, emptyLabel) {
  const opts = emptyLabel == null ? values : [{ value:'',label:emptyLabel }, ...values.map(n => ({value:n,label:n}))];
  return opts.map(v => {
    const ob = typeof v === 'string' ? {value:v,label:v} : v;
    return '<option value="' + h(ob.value) + '"' + (String(ob.value) === String(value || '') ? ' selected' : '') + '>' + h(ob.label) + '</option>';
  }).join('');
}
function rowField(labelText, group, index, field, html) {
  return '<div class="small-field"><label>' + h(labelText) + '</label>' +
    html.replace('FIELD_ATTRS', 'data-group="' + group + '" data-index="' + index + '" data-field="' + field + '"') +
    '</div>';
}
function itemRows(d, disabled) {
  const off = disabled ? ' disabled' : '';
  return d.items.map((i,index) => '<div class="line-item">' +
    rowField('Categoria', 'items', index, 'category', '<select FIELD_ATTRS' + off + '>' + orderOptions(CATEGORIES,i.category) + '</select>') +
    rowField('Descrição', 'items', index, 'description', input(i.description,'FIELD_ATTRS placeholder="Ex.: pneu 205/55R16"' + off)) +
    rowField('Qtd.', 'items', index, 'quantity', input(i.quantity,'FIELD_ATTRS min="1" step="1"' + off,'number')) +
    rowField('Valor unit. R$', 'items', index, 'unit_cents', input(moneyInput(i.unit_cents),'FIELD_ATTRS inputmode="decimal"' + off)) +
    '<div class="small-field"><label>Subtotal</label><div class="amount" data-item-total="' + index + '" style="padding:11px 0">' + money(Number(i.quantity)*Number(i.unit_cents)) + '</div></div>' +
    '<button type="button" class="remove" data-action="remove-item" data-index="' + index + '"' + off + ' aria-label="Remover item">×</button></div>').join('');
}
function paymentRows(d, disabled) {
  const off = disabled ? ' disabled' : '';
  const destinations = [{value:'',label:'Não informar'}, ...state.destinations.map(x => ({value:String(x.id),label:x.name+' ('+({pos:'POS',pix:'PIX',bank:'Conta',other:'Outro'}[x.type]||x.type)+')'}))];
  return d.payments.map((p,index) => '<div class="line-payment">' +
    rowField('Forma', 'payments', index, 'method', '<select FIELD_ATTRS' + off + '>' + orderOptions(METHODS,p.method) + '</select>') +
    rowField('Situação', 'payments', index, 'status', '<select FIELD_ATTRS' + off + '>' + orderOptions(PAY_STATES,p.status) + '</select>') +
    rowField('Valor R$', 'payments', index, 'amount_cents', input(moneyInput(p.amount_cents),'FIELD_ATTRS inputmode="decimal"' + off)) +
    rowField('Parcelas', 'payments', index, 'installments', input(p.installments || 1,'FIELD_ATTRS min="1" max="36" step="1"' + off,'number')) +
    rowField('Máquina / conta', 'payments', index, 'destination_id', '<select FIELD_ATTRS' + off + '>' + orderOptions(destinations,p.destination_id) + '</select>') +
    '<button type="button" class="remove" data-action="remove-payment" data-index="' + index + '"' + off + ' aria-label="Remover pagamento">×</button></div>').join('');
}
function totalHtml(d) {
  const total = totalDraft(d);
  const paid = d.payments.filter(p => p.status === 'recebido').reduce((sum,p) => sum + Number(p.amount_cents || 0),0);
  const pending = d.payments.filter(p => p.status === 'pendente').reduce((sum,p) => sum + Number(p.amount_cents || 0),0);
  return '<div><span>Total da OS</span><b data-total="order">' + money(total) + '</b></div>' +
    '<div><span>Recebido</span><b data-total="paid">' + money(paid) + '</b></div>' +
    '<div><span>Pendente + sem alocação</span><b data-total="pending">' + money(Math.max(0,total-paid)) + '</b></div>' +
    '<div><span>Pagamentos programados</span><b data-total="programmed">' + money(pending) + '</b></div>';
}
function renderForm() {
  const d = state.draft;
  const readonly = d.status === 'completed';
  const off = readonly ? ' disabled' : '';
  const title = d.id ? osNumber(d.id) : 'Nova ordem de serviço';
  const fields = '<div class="fields">' +
    label('Cliente *', input(d.customer,'data-simple="customer" required maxlength="160"' + off)) +
    label('Telefone', input(d.phone,'data-simple="phone" placeholder="(75) 99999-9999"' + off)) +
    label('Placa do veículo', input(d.plate,'data-simple="plate" maxlength="15"' + off)) +
    label('Vendedor *', select('seller',SELLERS,d.seller,'data-simple="seller"' + off)) +
    label('Mecânico responsável', select('mechanic', MECHANICS.map(n => ({value:n,label:n || 'Não informado'})), d.mechanic, 'data-simple="mechanic"' + off)) +
    '<div><label>Loja</label>' + input('Santo Antônio de Jesus (SAJ)','disabled') + '</div>' +
    label('Observações', '<textarea data-simple="notes" maxlength="2000"' + off + '>' + h(d.notes) + '</textarea>', 'wide') +
    '</div>';
  $('screen').innerHTML = '<div class="row-between"><div><span class="eyebrow">CONTROLE DIÁRIO · SAJ</span><h1>' + h(title) + '</h1><p>' +
    (readonly ? 'Ordem concluída · somente consulta.' : 'Adicione quantos pneus, peças, serviços e pagamentos forem necessários.') +
    '</p></div><button class="btn" data-action="back" type="button">← Voltar</button></div>' +
    (d.id ? '<div class="subtle spacing-top">Criada em ' + h(dateBR(d.created_at)) + ' · ' + (readonly ? 'Concluída' : 'Em aberto') + ' · Vendedor: ' + h(d.seller) + '</div>' : '<div class="subtle spacing-top">O número da OS será gerado automaticamente ao salvar.</div>') +
    '<form id="os-form"><section class="card form-panel"><h3>Dados da ordem</h3><div class="spacing-top">' + fields + '</div>' +
    '<div class="section-title"><h3>Itens da OS</h3>' + (readonly ? '' : '<button class="btn soft" type="button" data-action="add-item">＋ Adicionar item</button>') + '</div>' +
    '<div id="item-list">' + itemRows(d,readonly) + '</div>' +
    '<div class="row-totals" id="os-totals">' + totalHtml(d) + '</div>' +
    '<div class="section-title"><h3>Pagamentos</h3>' + (readonly ? '' : '<button class="btn soft" type="button" data-action="add-payment">＋ Adicionar pagamento</button>') + '</div>' +
    '<p>É possível dividir a OS entre cartão, Pix, dinheiro e outros meios. Cada lançamento é independente.</p>' +
    '<div id="payment-list" class="spacing-top">' + (d.payments.length ? paymentRows(d,readonly) : '<p>Sem pagamentos registrados.</p>') + '</div>' +
    '<div class="form-actions"><button class="btn" type="button" data-action="back">Voltar</button>' +
    (readonly ? '' : '<button class="btn" type="submit"' + (state.busy?' disabled':'') + '>Salvar OS aberta</button>' +
    (d.id ? '<button class="btn primary" type="button" data-action="finish"' + (state.busy?' disabled':'') + '>Concluir OS</button>' : '')) +
    '</div></section></form>';
}
function renderDestinations() {
  const typeNames = {pos:'Máquina POS',pix:'Chave PIX',bank:'Conta bancária',other:'Outro'};
  $('screen').innerHTML = panelTitle('CADASTROS', 'Máquinas e contas', 'Cadastre uma vez. A equipe seleciona o destino no pagamento.') +
    '<div class="card destination-card"><form id="dest-form" class="destination-grid">' +
    label('Tipo', select('type',Object.entries(typeNames).map(([value,label])=>({value,label})), 'pos')) +
    label('Nome', input('', 'name="name" placeholder="Ex.: POS Itaú 01" maxlength="120" required')) +
    label('CNPJ recebedor', input('', 'name="cnpj" placeholder="14 números" maxlength="18"')) +
    '<button class="btn primary" type="submit">＋ Adicionar</button></form></div>' +
    '<div class="card orders-card spacing-top">' + (state.destinations.length ?
    '<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>CNPJ</th><th></th></tr></thead><tbody>' +
    state.destinations.map(d => '<tr><td><b>' + h(d.name) + '</b></td><td>' + h(typeNames[d.type]||d.type) + '</td><td>' + h(d.cnpj || '—') + '</td><td><button type="button" class="link-action" data-action="remove-dest" data-id="' + h(d.id) + '">Remover</button></td></tr>').join('') +
    '</tbody></table></div>' : '<p>Nenhuma máquina ou conta cadastrada. Adicione os destinos reais da loja SAJ.</p>') + '</div>';
}
function render() {
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active',b.dataset.tab === state.tab));
  if (state.draft) return renderForm();
  if (state.tab === 'summary') return renderSummary();
  if (state.tab === 'destinations') return renderDestinations();
  renderOrders();
}
function editRow(target) {
  if (!state.draft || state.draft.status === 'completed') return;
  const group = target.dataset.group;
  const index = Number(target.dataset.index);
  const field = target.dataset.field;
  if (!['items','payments'].includes(group) || !state.draft[group][index]) return;
  if (field === 'unit_cents' || field === 'amount_cents') state.draft[group][index][field] = cents(target.value);
  else if (field === 'quantity' || field === 'installments') state.draft[group][index][field] = Number(target.value);
  else if (field === 'destination_id') state.draft[group][index][field] = target.value ? Number(target.value) : null;
  else state.draft[group][index][field] = target.value;
  updateTotals();
}
function updateTotals() {
  if (!state.draft) return;
  const rows = document.querySelectorAll('[data-item-total]');
  rows.forEach(el => {
    const i = state.draft.items[Number(el.dataset.itemTotal)];
    if (i) el.textContent = money((Number(i.quantity)||0)*(Number(i.unit_cents)||0));
  });
  if ($('os-totals')) $('os-totals').innerHTML = totalHtml(state.draft);
}
async function saveOrder(finish) {
  const d = state.draft;
  if (!d || state.busy) return;
  if (!d.customer.trim()) return alertMessage('Informe o cliente.');
  if (!SELLERS.includes(d.seller)) return alertMessage('Selecione Antonio ou Jean.');
  if (!d.items.length || d.items.some(i => !i.description.trim() || !i.unit_cents || !i.quantity)) return alertMessage('Preencha a descrição, quantidade e valor de todos os itens.');
  if (d.payments.some(p => !p.amount_cents || !p.method)) return alertMessage('Preencha os valores e formas de pagamento.');
  if (finish && !d.id) return alertMessage('Salve a OS antes de concluir.');
  const payload = { ...d, status: finish ? 'completed' : 'open' };
  state.busy = true;
  render();
  try {
    const url = d.id ? '/api/orders/' + d.id : '/api/orders';
    const r = await api(url, { method: d.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    if (finish) {
      state.draft = null; state.tab = 'orders';
      await reload();
      alertMessage('OS ' + osNumber(r.order.id) + ' concluída com sucesso.', 'success');
    } else {
      state.draft = r.order;
      await reload();
      alertMessage('OS ' + osNumber(r.order.id) + ' salva. Você pode continuar editando ou concluir.', 'success');
    }
  } catch (err) { alertMessage(err.message); }
  finally { state.busy = false; render(); }
}
async function saveDestination(form) {
  const fd = new FormData(form);
  try {
    await api('/api/destinations', {method:'POST',body:JSON.stringify({name:fd.get('name'),type:fd.get('type'),cnpj:fd.get('cnpj')})});
    await reload();
    alertMessage('Máquina ou conta cadastrada.', 'success');
  } catch (err) { alertMessage(err.message); }
}
async function removeDestination(id) {
  if (!confirm('Remover este cadastro? Os pagamentos existentes continuarão registrados nas OS.')) return;
  try {
    await api('/api/destinations?id=' + encodeURIComponent(id), {method:'DELETE'});
    await reload();
    alertMessage('Cadastro removido.', 'success');
  } catch (err) { alertMessage(err.message); }
}
document.addEventListener('click', event => {
  const nav = event.target.closest('[data-tab]');
  if (nav) {
    if (state.draft && !confirm('Sair do formulário? Alterações ainda não salvas serão perdidas.')) return;
    state.draft = null; state.tab = nav.dataset.tab; alertMessage(''); render(); return;
  }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const what = action.dataset.action;
  if (what === 'new') { state.draft = newDraft(); alertMessage(''); render(); }
  if (what === 'back') { state.draft = null; alertMessage(''); render(); }
  if (what === 'apply') render();
  if (what === 'open') {
    const order = state.orders.find(o => Number(o.id) === Number(action.dataset.id));
    if (order) { state.draft = JSON.parse(JSON.stringify(order)); alertMessage(''); render(); }
  }
  if (what === 'add-item' && state.draft) {
    state.draft.items.push({category:'Pneus',description:'',quantity:1,unit_cents:0}); render();
  }
  if (what === 'remove-item' && state.draft) {
    if (state.draft.items.length > 1) state.draft.items.splice(Number(action.dataset.index), 1);
    render();
  }
  if (what === 'add-payment' && state.draft) {
    const assigned = state.draft.payments.filter(p => ['recebido','pendente'].includes(p.status)).reduce((s,p)=>s+Number(p.amount_cents||0),0);
    state.draft.payments.push({method:'Pix',status:'recebido',amount_cents:Math.max(0,totalDraft(state.draft)-assigned),installments:1,destination_id:null,reference:''});
    render();
  }
  if (what === 'remove-payment' && state.draft) {
    state.draft.payments.splice(Number(action.dataset.index),1); render();
  }
  if (what === 'finish') saveOrder(true);
  if (what === 'remove-dest') removeDestination(action.dataset.id);
});
document.addEventListener('input', event => {
  const target = event.target;
  if (target.dataset.simple && state.draft) state.draft[target.dataset.simple] = target.value;
  if (target.dataset.group) editRow(target);
  if (target.dataset.filter) state.filter[target.dataset.filter] = target.value;
});
document.addEventListener('change', event => {
  const target = event.target;
  if (target.dataset.simple && state.draft) state.draft[target.dataset.simple] = target.value;
  if (target.dataset.group) editRow(target);
  if (target.dataset.filter) { state.filter[target.dataset.filter] = target.value; render(); }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.dataset.filter === 'q') { event.preventDefault(); render(); }
});
document.addEventListener('submit', event => {
  if (event.target.id === 'os-form') { event.preventDefault(); saveOrder(false); }
  if (event.target.id === 'dest-form') { event.preventDefault(); saveDestination(event.target); }
});
reload();
