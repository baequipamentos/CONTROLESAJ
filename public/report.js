// Relatório mensal do Controle SAJ. Não altera as OS nem os lançamentos bancários.
(() => {
  'use strict';

  const types = [
    'Alinhamento + balanceamento','Alinhamento','Balanceamento + montagem',
    'Balanceamento','Montagem / troca de pneus','Rodízio de pneus',
    'Cambagem','Óleo e filtros','Freios','Suspensão / direção',
    'Mecânica geral','Outros serviços'
  ];
  const monthNames=['janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro'];
  const report = {month:'', seller:'', category:'', service:''};
  const otherMethods=['Pix','Crédito','Débito','Dinheiro','Boleto','Outro','Crédito (não especificado)'];

  function currentMonth() {
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bahia',year:'numeric',month:'2-digit'}).formatToParts(new Date());
    return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
  }
  function offsetMonth(month,delta) {
    const [year,number]=month.split('-').map(Number);
    const serial=year*12+number-1+delta;
    const nextYear=Math.floor(serial/12);
    const nextMonth=((serial%12)+12)%12+1;
    return nextYear+'-'+String(nextMonth).padStart(2,'0');
  }
  function monthTitle(month,short=false) {
    const [year,number]=month.split('-').map(Number);
    const name=monthNames[number-1]||'';
    return (short?name.slice(0,3):name)+' '+year;
  }
  function plain(s) {
    return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }
  // O item combinado pertence a um único grupo para não duplicar receita.
  function serviceType(item) {
    if(item.category!=='Serviços')return '';
    const desc=plain(item.description),dept=plain(item.source_department);
    const align=/alinh|geometr|\ba\s*\+\s*b\b/.test(desc);
    const balance=/balanc|\ba\s*\+\s*b\b/.test(desc);
    const mount=/montag|desmontag|troca de pneu/.test(desc);
    if(align&&balance)return 'Alinhamento + balanceamento';
    if(balance&&mount)return 'Balanceamento + montagem';
    if(align)return 'Alinhamento';
    if(balance)return 'Balanceamento';
    if(mount)return 'Montagem / troca de pneus';
    if(/rodizio/.test(desc))return 'Rodízio de pneus';
    if(/cambagem/.test(desc))return 'Cambagem';
    if(/oleo|filtro|fluido/.test(desc+' '+dept))return 'Óleo e filtros';
    if(/freio|pastilha/.test(desc+' '+dept))return 'Freios';
    if(/suspens|amortec|direc|pivo|bieleta/.test(desc+' '+dept))return 'Suspensão / direção';
    if(/mecanica|mao de obra/.test(desc))return 'Mecânica geral';
    return 'Outros serviços';
  }
  function itemAmount(i) {
    return Number(i.quantity||0)*Number(i.unit_cents||0);
  }
  function matchingItems(order,filter) {
    return (order.items||[]).filter(i=>
      (!filter.category||i.category===filter.category)&&
      (!filter.service||serviceType(i)===filter.service)
    );
  }
  // Um recebimento pertence à OS inteira, portanto não é rateado por serviços.
  function calculate(orders,filter) {
    const monthOrders=orders.filter(o=>orderISODate(o).slice(0,7)===filter.month &&
      (!filter.seller||o.seller===filter.seller));
    const completed=monthOrders.filter(o=>o.status==='completed');
    const matches=completed.map(order=>({order,items:matchingItems(order,filter)}))
      .filter(x=>!(filter.category||filter.service)||x.items.length);
    const byCategory=Object.fromEntries(CATEGORIES.map(x=>[x,0]));
    const bySeller=Object.fromEntries(SELLERS.map(x=>[x,0]));
    const byMechanic=Object.fromEntries(MECHANICS.filter(Boolean).map(x=>[x,0]));
    const byService=Object.fromEntries(types.map(x=>[x,{total:0,quantity:0}]));
    let sold=0,serviceTotal=0;
    for(const row of matches) {
      let orderValue=0;
      for(const item of row.items) {
        const value=itemAmount(item);
        orderValue+=value;
        if(Object.hasOwn(byCategory,item.category))byCategory[item.category]+=value;
        if(item.category==='Serviços') {
          serviceTotal+=value;
          const type=serviceType(item);
          byService[type].total+=value;
          byService[type].quantity+=Number(item.quantity||0);
          if(Object.hasOwn(byMechanic,row.order.mechanic))byMechanic[row.order.mechanic]+=value;
        }
      }
      sold+=orderValue;
      if(Object.hasOwn(bySeller,row.order.seller))bySeller[row.order.seller]+=orderValue;
    }
    const full=!filter.category&&!filter.service;
    const received=full?monthOrders.reduce((sum,o)=>sum+payReceived(o),0):null;
    const byPayment=Object.fromEntries(METHODS.map(name=>[name,0]));
    const byHistorical=Object.fromEntries(otherMethods.map(name=>[name,0]));
    if(full)for(const o of monthOrders) {
      for(const p of o.payments||[])
        if(p.status==='recebido'&&Object.hasOwn(byPayment,p.method))
          byPayment[p.method]+=Number(p.amount_cents||0);
      if(o.legacy&&Object.hasOwn(byHistorical,o.payment_method))
        byHistorical[o.payment_method]+=Number(o.payment_declared_cents||0);
    }
    const open=monthOrders.filter(o=>o.status==='open'&&
      (!(filter.category||filter.service)||matchingItems(o,filter).length)).length;
    return {sold,serviceTotal,completedCount:matches.length,open,received,
      byCategory,bySeller,byMechanic,byService,byPayment,byHistorical,full};
  }
  function serviceRows(byService) {
    const rows=types.map(name=>({name,...byService[name]})).filter(x=>x.quantity>0)
      .sort((a,b)=>b.total-a.total);
    if(!rows.length)return '<p class="subtle">Nenhum serviço concluído com estes filtros neste mês.</p>';
    const max=Math.max(1,...rows.map(x=>x.total));
    return rows.map(x=>'<button type="button" class="report-service-row" data-monthly-service="'+h(x.name)+'" title="Filtrar '+h(x.name)+'">'+
      '<span class="report-service-name"><strong>'+h(x.name)+'</strong><small>'+x.quantity+' unidade(s)</small></span>'+
      '<span class="report-track"><span style="width:'+Math.round(100*x.total/max)+'%"></span></span>'+
      '<strong class="report-service-value">'+money(x.total)+'</strong></button>').join('');
  }
  function kpi(label,value,caption) {
    return '<div class="card stat"><div class="stat-label">'+h(label)+'</div><div class="stat-value">'+value+
      '</div><span class="stat-note">'+h(caption)+'</span></div>';
  }
  function renderMonthlySummary() {
    if(!report.month)report.month=currentMonth();
    const s=calculate(state.orders,report);
    const chips=[-2,-1,0,1,2].map(delta=>{
      const month=offsetMonth(report.month,delta);
      return '<button type="button" class="monthly-chip'+(delta===0?' active':'')+
        '" data-monthly-month="'+month+'" aria-pressed="'+(delta===0)+'">'+h(monthTitle(month,true))+'</button>';
    }).join('');
    const sellerOptions=[{value:'',label:'Todos os vendedores'},...SELLERS.map(v=>({value:v,label:v}))];
    const categoryOptions=[{value:'',label:'Todas as categorias'},...CATEGORIES.map(v=>({value:v,label:v}))];
    const serviceOptions=[{value:'',label:'Todos os serviços'},...types.map(v=>({value:v,label:v}))];
    const serviceDisabled=report.category&&report.category!=='Serviços';
    $('screen').innerHTML=
      panelTitle('ACOMPANHAMENTO','Relatório mensal','Deslize para trocar de mês e filtre o resultado por vendedor e tipo de serviço.')+
      '<section class="card monthly-nav" data-monthly-swipe aria-label="Navegação mensal">'+
        '<div class="monthly-main">'+
          '<button type="button" class="monthly-arrow" data-monthly-offset="-1" aria-label="Mês anterior">‹</button>'+
          '<div><div class="eyebrow">RESULTADO MENSAL · SAJ</div><h2>'+h(monthTitle(report.month))+'</h2></div>'+
          '<button type="button" class="monthly-arrow" data-monthly-offset="1" aria-label="Próximo mês">›</button>'+
        '</div>'+
        '<div class="monthly-chips">'+chips+'</div>'+
        '<div class="monthly-picker"><label for="monthly-select">Ir para outro mês</label><input type="month" id="monthly-select" data-monthly-filter="month" value="'+h(report.month)+'"></div>'+
      '</section>'+
      '<section class="card monthly-filters">'+
        label('Vendedor',select('seller',sellerOptions,report.seller,'data-monthly-filter="seller"'))+
        label('Categoria',select('category',categoryOptions,report.category,'data-monthly-filter="category"'))+
        label('Tipo de serviço',select('service',serviceOptions,report.service,'data-monthly-filter="service"'+(serviceDisabled?' disabled':'')))+
        '<button type="button" class="btn" data-monthly-reset>Limpar filtros</button>'+
      '</section>'+
      '<div class="monthly-kpis">'+
        kpi('Vendido no mês',money(s.sold),'Itens de OS concluídas no filtro')+
        kpi('Serviços vendidos',money(s.serviceTotal),'Sem pneus e peças')+
        kpi('OS concluídas',String(s.completedCount),s.open+' OS em aberto')+
        kpi('Recebimento confirmado',s.received===null?'—':money(s.received),
          s.full?'Históricos não conciliados excluídos':'Pagamentos não rateados por serviço')+
      '</div>'+
      '<div class="summary-grid">'+
        summaryGroup('Vendas por categoria',CATEGORIES,name=>s.byCategory[name])+
        summaryGroup('Vendas por vendedor',report.seller?[report.seller]:SELLERS,name=>s.bySeller[name])+
      '</div>'+
      '<section class="card monthly-service-card">'+
        '<div class="row-between"><div><h3>Serviços por tipo</h3><p class="subtle">Clique em um serviço para filtrar. Combinações não são somadas duas vezes.</p></div>'+
        (report.service?'<button type="button" class="btn" data-monthly-clear-service>Todos os serviços</button>':'')+'</div>'+
        '<div class="monthly-service-list">'+serviceRows(s.byService)+'</div>'+
      '</section>'+
      '<div class="summary-grid monthly-bottom">'+
        summaryGroup('Serviços por mecânico',MECHANICS.filter(Boolean),name=>s.byMechanic[name])+
        (s.full?
          summaryGroup('Pagamentos recebidos confirmados',METHODS,name=>s.byPayment[name])+
          summaryGroup('Pagamentos históricos informados (não conciliados)',otherMethods,name=>s.byHistorical[name])
        :'<div class="card summary-box"><h3>Pagamentos não rateados</h3><p class="subtle">Quando você filtra um tipo de serviço ou categoria, o recebimento de uma OS com vários itens não é atribuído artificialmente a esse serviço.</p></div>')+
      '</div>'+
      '<p class="subtle monthly-footnote">Os valores usam a data do lançamento, e não a data em que a OS foi digitada. Vendas concluídas não representam necessariamente recebimentos. As datas originais de OS históricas foram mantidas.</p>';
  }

  // A navegação do aplicativo continua chamando renderSummary().
  renderSummary=renderMonthlySummary;

  function changeMonth(month) {
    report.month=month;
    if(!state.draft&&state.tab==='summary')render();
  }
  document.addEventListener('click',event=>{
    const offset=event.target.closest('[data-monthly-offset]');
    if(offset){changeMonth(offsetMonth(report.month||currentMonth(),Number(offset.dataset.monthlyOffset)));return;}
    const chip=event.target.closest('[data-monthly-month]');
    if(chip){changeMonth(chip.dataset.monthlyMonth);return;}
    const service=event.target.closest('[data-monthly-service]');
    if(service){report.category='Serviços';report.service=service.dataset.monthlyService;render();return;}
    if(event.target.closest('[data-monthly-clear-service]')){report.service='';render();return;}
    if(event.target.closest('[data-monthly-reset]')){report.seller='';report.category='';report.service='';render();}
  });
  document.addEventListener('change',event=>{
    const element=event.target;
    const key=element.dataset.monthlyFilter;
    if(!key)return;
    if(key==='month'&&!/^\d{4}-\d{2}$/.test(element.value))return;
    report[key]=element.value;
    if(key==='category'&&report.category!=='Serviços')report.service='';
    if(key==='service'&&report.service)report.category='Serviços';
    render();
  });
  let touchStart=null;
  document.addEventListener('touchstart',event=>{
    if(event.target.closest('[data-monthly-swipe]')&&event.touches.length===1)
      touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
    else touchStart=null;
  },{passive:true});
  document.addEventListener('touchend',event=>{
    if(!touchStart||state.tab!=='summary'||!event.changedTouches.length)return;
    const dx=event.changedTouches[0].clientX-touchStart.x;
    const dy=event.changedTouches[0].clientY-touchStart.y;
    touchStart=null;
    if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.3)
      changeMonth(offsetMonth(report.month||currentMonth(),dx<0?1:-1));
  },{passive:true});

  // Exposed only for automated tests in non-browser environments.
  if(typeof globalThis!=='undefined'&&globalThis.__CONTROLE_SAJ_REPORT_TEST__)
    globalThis.__CONTROLE_SAJ_REPORT_TEST__={calculate,serviceType,offsetMonth,monthTitle,report,renderMonthlySummary};
})();
