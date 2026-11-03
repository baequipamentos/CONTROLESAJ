import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/app.js', import.meta.url),'utf8');

function createApp() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { innerHTML:'' });
      return elements.get(id);
    },
    addEventListener() {},
    querySelectorAll() { return []; }
  };
  const context=vm.createContext({document,console,Date,Intl});
  vm.runInContext(source.replace(/\breload\(\);\s*$/, ''),context,{filename:'public/app.js'});
  return {context,document};
}
test('Nova OS inicia sem vendedor e exige seleção',()=>{
  const {context,document}=createApp();
  assert.equal(vm.runInContext('newDraft().seller',context),'');
  vm.runInContext('state.draft=newDraft();renderForm()',context);
  const html=document.getElementById('screen').innerHTML;
  assert.match(html,/<select name="seller" data-simple="seller" required>/);
  assert.match(html,/<option value="" selected>Selecione o vendedor<\/option>/);
  assert.doesNotMatch(html,/<option value="Antonio" selected>/);
});
test('data escolhida permanece entre salvar e concluir',async()=>{
  const {context,document}=createApp();
  const requests=[];
  context.requests=requests;
  vm.runInContext([
    "state.draft = newDraft();",
    "state.draft.customer = 'Cliente teste';",
    "state.draft.seller = 'Jean';",
    "state.draft.sale_date = '2026-10-15';",
    "state.draft.items = [{category:'Serviços',description:'Alinhamento',quantity:1,unit_cents:8000}];",
    "api = async (url, options) => {",
    "  const body=JSON.parse(options.body);",
    "  globalThis.requests.push({url,body});",
    "  return {order:{...body,id:2,status:body.status,created_at:'2026-11-03T14:05:00.000Z',sale_date:'2026-10-15T00:00:00.000Z'}};",
    "};",
    "reload=async()=>{};",
    "render=()=>{};",
    "alertMessage=(msg)=>{document.getElementById('alert').innerHTML=msg;};"
  ].join('\n'),context);
  await vm.runInContext('saveOrder(false)',context);
  assert.equal(vm.runInContext('state.draft.sale_date',context),'2026-10-15');
  vm.runInContext('renderForm()',context);
  const html=document.getElementById('screen').innerHTML;
  assert.match(html,/type="date" value="2026-10-15"/);
  assert.match(html,/<option value="Jean" selected>/);
  await vm.runInContext('saveOrder(true)',context);
  assert.equal(requests.length,2);
  for(const call of requests) {
    assert.equal(call.body.sale_date,'2026-10-15');
    assert.equal(call.body.seller,'Jean');
  }
  assert.equal(requests[1].body.status,'completed');
});
test('sem vendedor, salvar não envia dados ao servidor',async()=>{
  const {context}=createApp();
  context.apiCalls=0;
  vm.runInContext([
    "state.draft=newDraft();",
    "state.draft.customer='Cliente teste';",
    "state.draft.sale_date='2026-10-15';",
    "state.draft.items=[{category:'Serviços',description:'Alinhamento',quantity:1,unit_cents:8000}];",
    "api=async()=>{globalThis.apiCalls++;return {}};",
    "alertMessage=()=>{};"
  ].join('\n'),context);
  await vm.runInContext('saveOrder(false)',context);
  assert.equal(context.apiCalls,0);
});
