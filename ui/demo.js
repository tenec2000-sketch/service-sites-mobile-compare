(() => {
  const originalFetch = window.fetch.bind(window);
  const data = originalFetch('./demo-data.json').then(response => response.json());
  const reply = (value, status = 200) => Response.json(value, { status });
  const error = (message, status) => reply({ error: { code: 'DEMO', message } }, status);
  function calendar(timezone) {
    const now = new Date();
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(now);
    const hours = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, timeZoneName: 'shortOffset' }).formatToParts(now);
    const offset = Number(hours.find(item => item.type === 'timeZoneName').value.replace('GMT','') || 0);
    const shift = (n) => new Date(Date.parse(day+'T12:00:00Z') + n*86400000).toISOString().slice(0,10);
    function times(date, minutes = 60) {
      const opening = Date.parse(date+'T00:00:00Z') - offset*3600000;
      return [9,10,11,13,14,15,16,17,18].filter(h => h*60+minutes <= 20*60).map(h => new Date(opening+h*3600000).toISOString()).filter(s => s > now.toISOString());
    }
    return { day, shift, times };
  }
  window.fetch = async (input, opts = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input, opts);
    const db = await data;
    const info = db['/tenant'];
    const path = url.pathname.slice(4);
    const q = url.searchParams;
    const clock = calendar(info.timezone);
    const services = db['/booking/services']?.services || [];
    const ids = (q.get('serviceIds') || '').split(',').filter(Boolean);
    const chosen = services.filter(s => ids.includes(s.id));
    const minutes = chosen.reduce((sum,s) => sum+s.durationMin,0) || 60;
    const available = (db['/booking/masters'] || []).filter(m => ids.every(id => m.serviceIds.includes(id)) && (!q.get('masterId') || m.id === q.get('masterId')));
    if (path === '/auth/refresh') return error('Гостевой просмотр',401);
    if (path === '/status/lookup' && opts.method === 'POST') {
      const { number, phone } = JSON.parse(opts.body || '{}');
      if (number === 'DEMO-01' && phone === '0000') return reply({token:'example'});
      return error('Для примера используйте квитанцию DEMO-01 и цифры 0000.',404);
    }
    if (opts.method && opts.method !== 'GET') return error('Доступно в рабочей версии после подключения.',403);
    if (path === '/status/example') {
      const now = new Date().toISOString();
      const status = {name:'На диагностике',kind:'DIAGNOSTICS',color:null};
      const steps = [['Принято','NEW','done'],['Диагностика','DIAGNOSTICS','now'],['Готово к выдаче','READY','next']].map(([name,kind,state])=>({name,kind,state,color:null,at:state==='next'?null:now,notes:[]}));
      return reply({number:'DEMO-01',createdAt:now,device:{name:'Тестовое устройство',type:'Техника',serial:null},status,steps,defects:[],money:{estimate:null,prepayment:'0',committed:'0',due:'0'},approval:null,warranty:null});
    }
    if (path === '/booking/masters') return reply(available);
    if (Object.hasOwn(db, path)) return reply(db[path]);
    if (path === '/booking/slots') {
      const date = q.get('date') || clock.day;
      const price = String(chosen.reduce((sum,s)=>sum+Number(s.price),0));
      return reply({date, timezone:info.timezone, masters:available.map(m=>({masterId:m.id,masterName:m.name,durationMin:minutes,price,slots:clock.times(date,minutes)}))});
    }
    if (path === '/booking/nearest') {
      const times = [...clock.times(clock.day,minutes),...clock.times(clock.shift(1),minutes)];
      return reply(available.flatMap(m=>times.slice(0,Number(q.get('limit')) || 1).map(startsAt=>({masterId:m.id,masterName:m.name,startsAt}))).slice(0,Number(q.get('limit')) || 1));
    }
    if (path === '/slots' || path === '/slots/nearest') {
      const jobs=(q.get('jobs')||'').split(',');
      const duration=(db['/catalog']||[]).filter(j=>jobs.includes(j.id)).reduce((n,j)=>n+j.durationMin,0)||60;
      const days=Array.from({length:14},(_,i)=>{ const date=clock.shift(i); return {date,closed:false,free:clock.times(date,duration).length}; });
      const first=days.find(d=>d.free)?.date || clock.shift(1);
      const date=q.get('date') || first;
      const nearest=clock.times(first,duration).map(at=>({at,bay:null}));
      return reply(path==='/slots/nearest'? nearest.slice(0,3) : {durationMin:duration,days,date,times:clock.times(date,duration).map((at,i)=>({at,free:i!==2})),nearest:nearest[0]||null});
    }
    if (path.startsWith('/booking/')) return reply([]);
    return error('Этот раздел доступен в рабочей версии.',404);
  };
})();
