const fs=require('fs'), vm=require('vm');
const ctx = vm.createContext({ console, Date, Math, Intl, JSON });
['ui.js','catalogo.js','datos.js'].forEach(f => vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f}));
let fallos=0;
const R=(n,c,d)=>{ if(c) console.log('  OK   '+n); else {fallos++; console.log(' FALLA '+n+(d!==undefined?'  → '+JSON.stringify(d):''));} };

vm.runInContext(`
  globalThis.STOCK = CAT.map(x=>({serv:x.id, libres:stockDisponible(x.id)}));
  /* Elegimos una suscripción de un servicio que SÍ tenga stock para reponer */
  const s = DB.suscripciones.find(x=>{
    if (estadoSuscripcion(x)==='vencida') return false;
    const m = DB.cuentasMadre.find(m=>m.id===DB.perfiles.find(p=>p.id===x.perfilId).cuentaMadreId);
    return stockDisponible(m.servicioId) > 0;
  });
  globalThis.D={ id:s.id, venceAntes:s.vence, perfilViejo:s.perfilId, res:reponer(s.id,'prueba') };
  const d = DB.suscripciones.find(x=>x.id===D.id);
  D.venceDespues=d.vence; D.perfilNuevo=d.perfilId; D.repos=d.reposiciones;
  D.estadoViejo=DB.perfiles.find(p=>p.id===D.perfilViejo).estado;
  D.incidencia = DB.incidencias.some(i=>i.suscripcionId===D.id && i.accion==='repuesta');
`, ctx);
const D=ctx.D;
console.log('── stock libre por servicio ──');
console.log(' ' + ctx.STOCK.map(s=>s.serv+':'+s.libres).join('  '));
console.log('\n── reposición ──');
R('la fecha de vencimiento no se mueve', D.venceAntes===D.venceDespues, {antes:D.venceAntes,despues:D.venceDespues});
R('el perfil cambia', D.perfilViejo!==D.perfilNuevo, {viejo:D.perfilViejo,nuevo:D.perfilNuevo});
R('el perfil que falló queda caído', D.estadoViejo==='caido', D.estadoViejo);
R('queda registrada la incidencia', D.incidencia===true);
R('se cuenta la reposición', D.repos===1, D.repos);

vm.runInContext(`
  globalThis.E = { sinStock: reponer(DB.suscripciones.find(x=>{
    const m=DB.cuentasMadre.find(m=>m.id===DB.perfiles.find(p=>p.id===x.perfilId).cuentaMadreId);
    return stockDisponible(m.servicioId)===0;
  }).id,'prueba') };
`, ctx);
R('sin stock, la reposición se rechaza con motivo', ctx.E.sinStock.ok===false && !!ctx.E.sinStock.motivo, ctx.E.sinStock);
console.log(fallos? '\n'+fallos+' fallo(s)' : '\nTodo OK');
