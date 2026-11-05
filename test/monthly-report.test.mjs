import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const summary=readFileSync(new URL('../public/report.js',import.meta.url),'utf8');
function context(){
  const elements=new Map(), listeners=new Map();
  const document={
    getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:''});return elements.get(id)},
    addEventListener(name,cb){const arr=listeners.get(name)||[];arr.push(cb);listeners.set(name,arr)},
    querySelectorAll(){return []}
  };
  const ctx=vm.createContext({document,Intl,Date,console,__CONTROLE_SAJ_REPORT_TEST__:true});
  vm.runInContext(app.replace(/\breload\(\);\s*$/,''),ctx);
  vm.runInContext(summary,ctx);
  return {ctx,ui:ctx.__CONTROLE_SAJ_REPORT_TEST__,elements,listeners};
}
function orders(){
  return [
    {id:'legacy:1',legacy:true,customer:'A',seller:'Antonio',created_at:'2026-09-15T12:00:00-03:00',status:'completed',
      items:[{category:'Serviços',description:'A+B (Alinhamento + Balanceamento)',quantity:1,unit_cents:12000}],
      payments:[],payment_method:'Pix',payment_declared_cents:12000},
    {id:2,seller:'Jean',sale_date:'2026-09-20',status:'completed',
      items:[{category:'Pneus',description:'Pneu',quantity:4,unit_cents:25000},
        {category:'Serviços',description:'Troca de óleo do motor',quantity:1,unit_cents:8000}],
      payments:[{method:'Crédito',status:'recebido',amount_cents:108000}]},
    {id:3,seller:'Jean',sale_date:'2026-10-15',status:'completed',
      items:[{category:'Serviços',description:'Alinhamento dianteiro',quantity:1,unit_cents:5000}],
      payments:[{method:'Pix',status:'recebido',amount_cents:5000}]}
  ];
}

test('a navegação de meses atravessa ano e alterna setembro, outubro e novembro',()=>{
  const {ui}=context();
  assert.equal(ui.offsetMonth('2026-09',1),'2026-10');
  assert.equal(ui.offsetMonth('2026-10',1),'2026-11');
  assert.equal(ui.offsetMonth('2026-12',1),'2027-01');
  assert.equal(ui.offsetMonth('2026-01',-1),'2025-12');
});
test('setembro soma itens e não mistura 2 vendedores, pagamentos históricos e recebidos',()=>{
  const {ui}=context();
  const s=ui.calculate(orders(),{month:'2026-09',seller:'',category:'',service:''});
  assert.equal(s.sold,120000);
  assert.equal(s.completedCount,2);
  assert.equal(s.bySeller.Antonio,12000);
  assert.equal(s.bySeller.Jean,108000);
  assert.equal(s.byCategory.Pneus,100000);
  assert.equal(s.byCategory.Serviços,20000);
  assert.equal(s.byService['Alinhamento + balanceamento'].total,12000);
  assert.equal(s.byService['Óleo e filtros'].total,8000);
  assert.equal(s.received,108000);
  assert.equal(s.byHistorical.Pix,12000);
  assert.equal(s.byPayment.Crédito,108000);
});
test('filtro por Jean e óleo considera apenas serviço, sem atribuir o cartão inteiro',()=>{
  const {ui}=context();
  const s=ui.calculate(orders(),{month:'2026-09',seller:'Jean',category:'Serviços',service:'Óleo e filtros'});
  assert.equal(s.sold,8000);
  assert.equal(s.serviceTotal,8000);
  assert.equal(s.completedCount,1);
  assert.equal(s.bySeller.Jean,8000);
  assert.equal(s.byCategory.Pneus,0);
  assert.equal(s.received,null);
});
test('mês sem vendas mostra zero e o painel contém filtros e navegação',()=>{
  const {ctx,ui,elements}=context();
  const s=ui.calculate(orders(),{month:'2026-11',seller:'',category:'',service:''});
  assert.equal(s.sold,0);
  assert.equal(s.completedCount,0);
  ui.report.month='2026-11';
  vm.runInContext('state.orders = []; state.tab = "summary"; render();',ctx);
  const html=elements.get('screen').innerHTML;
  assert.match(html,/novembro 2026/);
  assert.match(html,/data-monthly-offset="-1"/);
  assert.match(html,/data-monthly-offset="1"/);
  assert.match(html,/data-monthly-filter="seller"/);
  assert.match(html,/data-monthly-filter="service"/);
  assert.match(html,/data-monthly-swipe/);
});
