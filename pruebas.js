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

/* Ningún precio vende a pérdida: se compara contra la cuenta madre más
   cara de ese servicio, que es el peor caso. */
vm.runInContext(`
  globalThis.PERDIDA = [];
  CAT.forEach(x => {
    const madres = DB.cuentasMadre.filter(m => m.servicioId === x.id);
    if (!madres.length) return;
    const porUnidad = Math.max.apply(null, madres.map(m => m.costo / m.capacidad));
    const entera    = Math.max.apply(null, madres.map(m => m.costo));
    x.planes.forEach(p => {
      const costo = p.k === 'completa' ? entera : porUnidad;
      if (p.precio <= costo) PERDIDA.push(x.id + ' ' + p.k + ' público');
      if (p.precioMayorista != null && p.precioMayorista <= costo) PERDIDA.push(x.id + ' ' + p.k + ' mayorista');
    });
  });
  globalThis.STOCK2 = CAT.map(x => ({ id:x.id, tienda:stockDe(x), panel:stockDisponible(x.id) }));
`, ctx);
console.log('\n── precios y stock ──');
R('ningún plan se vende a pérdida', ctx.PERDIDA.length===0, ctx.PERDIDA);
R('la tienda y el panel leen el mismo stock', ctx.STOCK2.every(s=>s.tienda===s.panel), ctx.STOCK2);
R('el monto en Bs usa la tasa BCV', vm.runInContext(`bs(1) === 'Bs ' + dec2(CFG.tasaBs)`, ctx));

/* ── reglas del portal, las ventas y el mayorista ── */
vm.runInContext(`
  globalThis.N = {};
  const viva = DB.suscripciones.find(s => estadoSuscripcion(s) === 'activa' && servicioDeSuscripcion(s).id === 'nx');
  const antes = viva.vence;
  N.renov = renovar(viva.id, 1);
  N.renovSuma = diasEntre(antes, viva.vence) === OP.diasPorMes;

  const otra = DB.suscripciones.find(s => s !== viva && estadoSuscripcion(s) === 'activa' && stockDisponible(servicioDeSuscripcion(s).id) > 0);
  const n0 = incidenciasAbiertas().length;
  abrirIncidencia(otra.id, 'No me deja entrar'); abrirIncidencia(otra.id, 'No me deja entrar');
  N.unaSola = incidenciasAbiertas().length === n0 + 1;
  reponer(otra.id);
  N.cierra = incidenciasAbiertas().length === n0;

  const may = DB.clientes.find(c => c.tipo === 'mayorista');
  N.bajoMinimo = comprarMayorista(may.id, [{ servicioId:'nx', cantidad: 3 }]).ok === false;
  const saldo0 = saldoDe(may.id);
  solicitarRecarga(may.id, 100, 'pm');
  N.pendienteNoCuenta = saldoDe(may.id) === saldo0;
  const pend = recargasPendientes().find(m => m.clienteId === may.id && m.monto === 100);
  acreditarRecarga(pend.id);
  N.acreditada = Math.abs(saldoDe(may.id) - (saldo0 + 100)) < 0.001;
  const s1 = saldoDe(may.id);
  const compra = comprarMayorista(may.id, [{ servicioId:'nx', cantidad: 6 }, { servicioId:'sp', cantidad: 4 }]);
  N.compra = compra.ok && compra.suscripciones.length === 10 && Math.abs(saldoDe(may.id) - (s1 - compra.monto)) < 0.001;
  N.saldoNoNegativo = comprarMayorista(may.id, [{ servicioId:'nx', cantidad: 10 }]).ok === false || saldoDe(may.id) >= 0;

  const v = registrarVenta({ nombre:'Cliente Prueba', whatsapp:'0414-555 1234', servicioId:'dp', planClave:'pantalla', meses:12 });
  N.venta = v.ok && v.cliente.whatsapp === '584145551234' && Math.abs(v.suscripcion.precio - 5 * 12 * 0.85) < 0.001
            && diasRestantes(v.suscripcion) === 360;
  const cods = DB.clientes.map(c => c.codigoAcceso);
  N.codigos = cods.every(c => /^[A-Z2-9]{10}$/.test(c)) && new Set(cods).size === cods.length;
`, ctx);
const N = ctx.N;
console.log('\n── portal, ventas y mayorista ──');
R('renovar suma 30 días al vencimiento', N.renov.ok && N.renovSuma);
R('reportar dos veces abre una sola incidencia', N.unaSola);
R('reponer cierra la incidencia abierta', N.cierra);
R('el mayorista no compra bajo el mínimo', N.bajoMinimo);
R('una recarga pendiente no suma saldo', N.pendienteNoCuenta);
R('acreditar la recarga sí la suma', N.acreditada);
R('la compra con saldo crea las unidades y descuenta', N.compra);
R('el saldo nunca queda negativo', N.saldoNoNegativo);
R('venta directa: cliente nuevo, 12 meses con descuento', N.venta);
R('códigos de portal de 10 caracteres y únicos', N.codigos);
console.log(fallos? '\n'+fallos+' fallo(s)' : '\nTodo OK');
