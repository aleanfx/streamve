/* StreamVe — modelo de datos, reglas de negocio y datos simulados.
 *
 * Este archivo es la fuente de verdad de CÓMO funciona el negocio. Las
 * vistas sólo lo consultan; ninguna calcula nada por su cuenta.
 *
 * La cadena es siempre la misma:
 *   cuenta madre → perfiles → suscripción de un cliente → vencimiento
 *
 * Depende de: ui.js (CFG, usd) y catalogo.js (CAT).
 */

/* ═══════════════════════════════════════════════════════════════
   Parámetros de operación
   ═══════════════════════════════════════════════════════════ */
const OP = {
  avisarDiasAntes: 3,      // cuándo una suscripción pasa a "por vencer"
  diasPorMes:      30,
  minMayorista:    10,
  graciaDias:      3       // vencida hace más que esto sin renovar: el perfil vuelve al stock
};

/* ═══════════════════════════════════════════════════════════════
   Fechas — todo el sistema trabaja en días, no en horas
   ═══════════════════════════════════════════════════════════ */
const HOY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

/* "2026-10-05" se lee como fecha LOCAL: new Date('2026-10-05') sería UTC,
   y en UTC-4 eso cae el día anterior a las 8 de la noche. */
const aFecha = f => {
  if (f instanceof Date) return new Date(f);
  const [a, m, d] = String(f).split('-').map(Number);
  return new Date(a, m - 1, d);
};
const masDias  = (fecha, n) => { const d = aFecha(fecha); d.setDate(d.getDate() + n); return d; };
const dia = f => {
  const d = aFecha(f);
  /* Nada de toISOString: convierte a UTC y en UTC-4 la medianoche local
     cae en el día anterior. Se arma con las partes locales. */
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
};
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);

/* "5 oct": armado a mano para que se lea igual en cualquier navegador */
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
/* El año solo aparece si no es el actual: "30 sep 2027" no se confunde
   con una fecha que ya pasó. */
const fechaCorta = f => {
  const d = aFecha(f);
  return d.getDate() + ' ' + MESES[d.getMonth()] + (d.getFullYear() !== HOY.getFullYear() ? ' ' + d.getFullYear() : '');
};

/* "en 3 días", "hoy", "hace 2 días" — lo que se lee de un vistazo */
function comoFalta(fecha){
  const d = diasEntre(HOY, fecha);
  if (d === 0)  return 'vence hoy';
  if (d === 1)  return 'vence mañana';
  if (d > 1)    return 'en ' + d + ' días';
  if (d === -1) return 'venció ayer';
  return 'venció hace ' + Math.abs(d) + ' días';
}

/* ═══════════════════════════════════════════════════════════════
   Reglas de negocio
   Son funciones puras sobre DB: reciben datos y devuelven un resultado
   { ok, motivo } cuando algo puede salir mal.
   ═══════════════════════════════════════════════════════════ */

const diasRestantes = s => diasEntre(HOY, s.vence);
const planDe = (servicioId, planClave) => {
  const x = CAT.find(c => c.id === servicioId);
  return x && (x.planes.find(p => p.k === planClave) || x.planes[0]);
};
const etiquetaPlan = (servicioId, planClave) => (planDe(servicioId, planClave) || {}).etq || planClave;

/* Regla 3 — una suscripción avisa OP.avisarDiasAntes antes de caerse */
function estadoSuscripcion(s){
  if (s.estado === 'cancelada') return 'cancelada';
  const d = diasRestantes(s);
  if (d < 0) return 'vencida';
  if (d <= OP.avisarDiasAntes) return 'porVencer';
  return 'activa';
}

const perfilesDe      = m  => DB.perfiles.filter(p => p.cuentaMadreId === m.id);
const perfilesLibres  = m  => perfilesDe(m).filter(p => p.estado === 'libre');
const capacidadUsada  = m  => perfilesDe(m).filter(p => p.estado === 'asignado').length;

/* Regla 5 — una cuenta madre nunca vende más perfiles que su capacidad */
const tieneCupo = m => capacidadUsada(m) < m.capacidad;

const madresVivas = servicioId => DB.cuentasMadre
  .filter(m => m.servicioId === servicioId && diasRestantes({ vence: m.vence }) >= 0);

/* Con la base real, la tienda y el revendedor no ven las cuentas madre:
   reciben el stock ya contado (stock_publico) y se guarda acá. */
let STOCK_FIJO = null;
const stockFijo = (servicioId, planClave) => {
  const x = CAT.find(c => c.id === servicioId);
  const k = planClave || (x && (x.planes.find(p => p.k !== 'completa') || x.planes[0]).k);
  return STOCK_FIJO[servicioId + ':' + k] || 0;
};

/* Stock real de un servicio: perfiles libres en cuentas madre vivas */
const stockDisponible = servicioId => STOCK_FIJO ? stockFijo(servicioId)
  : madresVivas(servicioId).reduce((n, m) => n + perfilesLibres(m).length, 0);

/* Stock por plan: una pantalla sale de cualquier perfil libre; una cuenta
   completa necesita una cuenta madre entera, sin nadie adentro. */
function stockPlan(servicioId, planClave){
  if (STOCK_FIJO) return stockFijo(servicioId, planClave);
  if (planClave !== 'completa') return stockDisponible(servicioId);
  return madresVivas(servicioId).filter(m => perfilesLibres(m).length === m.capacidad).length;
}

/* Regla 2 — al entregar se toma un perfil libre de una cuenta madre viva.
   Se elige la que vence más tarde, para que el cliente dure lo máximo. */
const porVenceDesc = (a, b) => aFecha(b.vence) - aFecha(a.vence);
function buscarPerfilLibre(servicioId){
  const madres = madresVivas(servicioId).filter(tieneCupo).sort(porVenceDesc);
  for (const m of madres){
    const libre = perfilesLibres(m)[0];
    if (libre) return libre;
  }
  return null;
}
const buscarMadreEntera = servicioId => madresVivas(servicioId)
  .filter(m => perfilesLibres(m).length === m.capacidad).sort(porVenceDesc)[0] || null;

/* Precio de una venta: 12 meses llevan el descuento anual */
const precioVenta = (plan, meses, mayorista) => {
  const unit = mayorista && plan.precioMayorista != null ? plan.precioMayorista : plan.precio;
  return meses === 12 ? unit * 12 * (1 - CFG.descuentoAnual) : unit * meses;
};

/* Regla 2 aplicada: nace una suscripción. La cuenta completa ocupa la
   cuenta madre entera; el resto, un perfil. */
function crearSuscripcion({ clienteId, servicioId, planClave, meses, precio, asignadoA }){
  meses = meses || 1;
  let perfilIds;
  if (planClave === 'completa'){
    const m = buscarMadreEntera(servicioId);
    if (!m) return { ok: false, motivo: 'No hay una cuenta completa libre' };
    perfilIds = perfilesDe(m).map(p => p.id);
  } else {
    const p = buscarPerfilLibre(servicioId);
    if (!p) return { ok: false, motivo: 'No hay perfiles libres de ' + (CAT.find(c => c.id === servicioId) || {}).nombre };
    perfilIds = [p.id];
  }
  perfilIds.forEach(id => { DB.perfiles.find(p => p.id === id).estado = 'asignado'; });
  const s = {
    id: 'ss-' + (DB.suscripciones.length + 1),
    clienteId, servicioId, perfilId: perfilIds[0], perfilIds, planClave,
    inicio: dia(HOY), vence: dia(masDias(HOY, OP.diasPorMes * meses)),
    precio, meses, estado: 'activa', reposiciones: 0, renovaciones: [],
    asignadoA: asignadoA || null
  };
  DB.suscripciones.push(s);
  return { ok: true, suscripcion: s };
}

/* Regla 1 — el stock se descuenta al entregar un pedido verificado, nunca
   al recibirlo. Si falta stock de algún ítem, no se entrega nada. */
function entregarPedido(pedidoId, clienteId){
  const p = DB.pedidos.find(x => x.id === pedidoId);
  if (!p) return { ok: false, motivo: 'El pedido no existe' };
  if (p.estado === 'entregado') return { ok: false, motivo: 'Ya estaba entregado' };
  if (!p.clienteId && !clienteId) return { ok: false, motivo: 'Indicá de qué cliente es el pedido' };
  if (!p.clienteId) p.clienteId = clienteId;
  for (const it of p.items)
    if (stockPlan(it.servicioId, it.planClave) < it.cantidad)
      return { ok: false, motivo: 'No hay stock de ' + CAT.find(c => c.id === it.servicioId).nombre };
  const hechas = [];
  p.items.forEach(it => {
    for (let n = 0; n < it.cantidad; n++){
      const r = crearSuscripcion({ clienteId: p.clienteId, servicioId: it.servicioId,
        planClave: it.planClave, meses: it.meses || 1, precio: it.precio });
      if (r.ok) hechas.push(r.suscripcion);
    }
  });
  p.estado = 'entregado';
  p.entregado = dia(HOY);
  return { ok: true, suscripciones: hechas };
}

const normalizarTel = t => {
  const d = String(t || '').replace(/\D/g, '');
  return d.startsWith('58') ? d : d.startsWith('0') ? '58' + d.slice(1) : d;
};

/* Una venta que entró directo por WhatsApp: si el cliente no existe se
   crea, y la venta queda registrada como un pedido entregado. */
function registrarVenta({ clienteId, nombre, whatsapp, servicioId, planClave, meses, metodoPago }){
  let cli = clienteId && DB.clientes.find(c => c.id === clienteId);
  if (!cli){
    const tel = normalizarTel(whatsapp);
    if (!nombre || !nombre.trim()) return { ok: false, motivo: 'Falta el nombre del cliente' };
    if (tel.length < 11) return { ok: false, motivo: 'El WhatsApp no parece válido' };
    cli = DB.clientes.find(c => c.whatsapp === tel) || nuevoCliente(nombre.trim(), tel, 'personal');
  }
  const pl = planDe(servicioId, planClave);
  if (!pl) return { ok: false, motivo: 'Ese plan no existe' };
  meses = meses || 1;
  const precio = precioVenta(pl, meses);
  const r = crearSuscripcion({ clienteId: cli.id, servicioId, planClave: pl.k, meses, precio });
  if (!r.ok) return r;
  DB.pedidos.push({
    id: 'SV-' + (5000 + DB.pedidos.length), clienteId: cli.id,
    items: [{ servicioId, planClave: pl.k, cantidad: 1, meses, precio }],
    total: precio, metodoPago: metodoPago || 'whatsapp', referencia: 'venta directa',
    estado: 'entregado', creado: dia(HOY), entregado: dia(HOY)
  });
  return { ok: true, cliente: cli, suscripcion: r.suscripcion };
}

/* Renovar suma tiempo desde el vencimiento (o desde hoy, si ya venció):
   el que renueva antes no pierde los días que le quedaban. */
function renovar(suscripcionId, meses){
  const s = DB.suscripciones.find(x => x.id === suscripcionId);
  if (!s) return { ok: false, motivo: 'La suscripción no existe' };
  meses = meses || 1;
  const sv = servicioDeSuscripcion(s);
  const pl = planDe(sv.id, s.planClave);
  const cli = DB.clientes.find(c => c.id === s.clienteId);
  const precio = precioVenta(pl, meses, cli && cli.tipo === 'mayorista');
  const base = aFecha(s.vence) > HOY ? s.vence : HOY;
  s.vence = dia(masDias(base, OP.diasPorMes * meses));
  s.renovaciones = s.renovaciones || [];
  s.renovaciones.push({ fecha: dia(HOY), meses, precio });
  return { ok: true, vence: s.vence, precio };
}

/* Regla 4 — reponer NO regala días: la fecha de vencimiento no se mueve.
   El perfil que falló queda 'caido' y sale del stock para siempre. Si
   había una incidencia abierta, queda cerrada como repuesta. */
function reponer(suscripcionId, causa){
  const s = DB.suscripciones.find(x => x.id === suscripcionId);
  if (!s) return { ok: false, motivo: 'La suscripción no existe' };

  const viejos = (s.perfilIds || [s.perfilId]).map(id => DB.perfiles.find(p => p.id === id));
  const madre = DB.cuentasMadre.find(m => m.id === viejos[0].cuentaMadreId);
  let nuevos;
  if (s.planClave === 'completa'){
    const m = buscarMadreEntera(madre.servicioId);
    if (!m) return { ok: false, motivo: 'No hay otra cuenta completa libre' };
    nuevos = perfilesDe(m);
  } else {
    const p = buscarPerfilLibre(madre.servicioId);
    if (!p) return { ok: false, motivo: 'No hay perfiles libres de ese servicio' };
    nuevos = [p];
  }

  viejos.forEach(p => { p.estado = 'caido'; });
  nuevos.forEach(p => { p.estado = 'asignado'; });
  s.perfilId = nuevos[0].id;                  // el vence queda igual: regla 4
  s.perfilIds = nuevos.map(p => p.id);
  s.reposiciones = (s.reposiciones || 0) + 1;

  const abierta = DB.incidencias.find(i => i.suscripcionId === suscripcionId && !i.cerrada);
  if (abierta){ abierta.cerrada = dia(HOY); abierta.accion = 'repuesta'; }
  else DB.incidencias.push({
    id: 'inc-' + (DB.incidencias.length + 1),
    suscripcionId, causa: causa || 'No entraba',
    abierta: dia(HOY), cerrada: dia(HOY), accion: 'repuesta'
  });
  return { ok: true, perfil: nuevos[0] };
}

/* El cliente reporta desde su portal. Una sola incidencia abierta por
   suscripción: reportar dos veces no duplica el trabajo. */
function abrirIncidencia(suscripcionId, causa){
  const ya = DB.incidencias.find(i => i.suscripcionId === suscripcionId && !i.cerrada);
  if (ya) return ya;
  const inc = { id: 'inc-' + (DB.incidencias.length + 1), suscripcionId, causa,
                abierta: dia(HOY), cerrada: null, accion: null };
  DB.incidencias.push(inc);
  return inc;
}

/* Regla 7 — el único número honesto: lo que queda después del costo real
   de la porción de cuenta madre que ocupa esa suscripción, por mes. */
function margenDe(s){
  const p = DB.perfiles.find(x => x.id === s.perfilId);
  if (!p) return 0;
  const m = DB.cuentasMadre.find(x => x.id === p.cuentaMadreId);
  if (!m) return 0;
  const porMes = s.precio / (s.meses || 1);
  return porMes - (s.planClave === 'completa' ? m.costo : m.costo / m.capacidad);
}

/* Regla 6 — el mayorista compra contra saldo y nunca queda en negativo.
   Una recarga cuenta recién cuando Ale verifica el pago. */
const saldoDe = clienteId => DB.movimientos
  .filter(m => m.clienteId === clienteId && m.estado !== 'pendiente')
  .reduce((t, m) => t + (m.tipo === 'recarga' ? m.monto : -m.monto), 0);

function puedeComprarMayorista(clienteId, unidades, monto){
  if (unidades < OP.minMayorista)
    return { ok: false, motivo: 'El mínimo es ' + OP.minMayorista + ' unidades' };
  if (saldoDe(clienteId) < monto)
    return { ok: false, motivo: 'Saldo insuficiente' };
  return { ok: true };
}

/* El plan que compra un mayorista: el primero que tenga precio de revendedor */
const planMayorista = x => x.planes.find(p => p.precioMayorista != null);

/* Compra del mayorista: se paga con saldo, así que ya está verificada y
   las unidades se asignan en el acto (regla 1 se cumple sola). */
function comprarMayorista(clienteId, items){
  items = items.filter(it => it.cantidad > 0);
  const unidades = items.reduce((t, it) => t + it.cantidad, 0);
  const monto = items.reduce((t, it) =>
    t + it.cantidad * planMayorista(CAT.find(c => c.id === it.servicioId)).precioMayorista, 0);
  const puede = puedeComprarMayorista(clienteId, unidades, monto);
  if (!puede.ok) return puede;
  for (const it of items)
    if (stockDisponible(it.servicioId) < it.cantidad)
      return { ok: false, motivo: 'No hay ' + it.cantidad + ' de ' + CAT.find(c => c.id === it.servicioId).nombre };

  const hechas = [];
  items.forEach(it => {
    const pl = planMayorista(CAT.find(c => c.id === it.servicioId));
    for (let n = 0; n < it.cantidad; n++){
      const r = crearSuscripcion({ clienteId, servicioId: it.servicioId, planClave: pl.k,
                                   meses: 1, precio: pl.precioMayorista });
      if (r.ok) hechas.push(r.suscripcion);
    }
  });
  const pedido = {
    id: 'SV-' + (5000 + DB.pedidos.length), clienteId,
    items: items.map(it => { const pl = planMayorista(CAT.find(c => c.id === it.servicioId));
      return { servicioId: it.servicioId, planClave: pl.k, cantidad: it.cantidad, meses: 1, precio: pl.precioMayorista }; }),
    total: monto, metodoPago: 'saldo', referencia: unidades + ' u.',
    estado: 'entregado', creado: dia(HOY), entregado: dia(HOY)
  };
  DB.pedidos.push(pedido);
  DB.movimientos.push({ id: 'mv-' + (DB.movimientos.length + 1), clienteId, tipo: 'consumo',
    monto, fecha: dia(HOY), referencia: 'Pedido ' + pedido.id + ' · ' + unidades + ' u.', estado: 'ok' });
  return { ok: true, suscripciones: hechas, pedido, monto };
}

/* El mayorista renueva una unidad suya pagando con saldo */
function renovarConSaldo(suscripcionId, meses){
  const s = DB.suscripciones.find(x => x.id === suscripcionId);
  if (!s) return { ok: false, motivo: 'La unidad no existe' };
  const sv = servicioDeSuscripcion(s);
  const precio = precioVenta(planDe(sv.id, s.planClave), meses || 1, true);
  if (saldoDe(s.clienteId) < precio) return { ok: false, motivo: 'Saldo insuficiente: te faltan ' + usd(precio - saldoDe(s.clienteId)) };
  const r = renovar(suscripcionId, meses);
  if (!r.ok) return r;
  DB.movimientos.push({ id: 'mv-' + (DB.movimientos.length + 1), clienteId: s.clienteId, tipo: 'consumo',
    monto: precio, fecha: dia(HOY), referencia: 'Renovación ' + sv.nombre, estado: 'ok' });
  return r;
}

function solicitarRecarga(clienteId, monto, metodo){
  monto = +monto;
  if (!(monto > 0)) return { ok: false, motivo: 'El monto tiene que ser mayor a cero' };
  const mv = { id: 'mv-' + (DB.movimientos.length + 1), clienteId, tipo: 'recarga', monto,
               fecha: dia(HOY), referencia: metodo === 'pm' ? 'Pago Móvil' : 'Binance', estado: 'pendiente' };
  DB.movimientos.push(mv);
  return { ok: true, movimiento: mv };
}

function acreditarRecarga(movimientoId){
  const mv = DB.movimientos.find(m => m.id === movimientoId);
  if (!mv || mv.estado !== 'pendiente') return { ok: false, motivo: 'No hay nada que acreditar' };
  mv.estado = 'ok';
  return { ok: true, movimiento: mv };
}

/* El mayorista le asigna una unidad a uno de sus clientes. Si ya existe
   ese WhatsApp entre sus clientes, se reutiliza. */
function asignarACliente(suscripcionId, nombre, whatsapp){
  const s = DB.suscripciones.find(x => x.id === suscripcionId);
  if (!s) return { ok: false, motivo: 'La unidad no existe' };
  if (!nombre || !nombre.trim()) return { ok: false, motivo: 'Falta el nombre' };
  const tel = normalizarTel(whatsapp);
  let cf = tel && DB.clientesFinales.find(c => c.mayoristaId === s.clienteId && c.whatsapp === tel);
  if (!cf){
    cf = { id: 'cf-' + (DB.clientesFinales.length + 1), mayoristaId: s.clienteId,
           nombre: nombre.trim(), whatsapp: tel };
    DB.clientesFinales.push(cf);
  }
  s.asignadoA = cf.id;
  return { ok: true, clienteFinal: cf };
}

/* El cliente no renovó: pasados los días de gracia, la pantalla vuelve al
   stock y la suscripción se cierra. Antes de revenderla hay que cambiarle
   el PIN al perfil, porque el cliente anterior lo conoce. */
const paraLiberar = () => DB.suscripciones
  .filter(s => s.estado !== 'cancelada' && diasRestantes(s) < -OP.graciaDias)
  .sort((a, b) => aFecha(a.vence) - aFecha(b.vence));

function liberar(suscripcionId){
  const s = DB.suscripciones.find(x => x.id === suscripcionId);
  if (!s) return { ok: false, motivo: 'La suscripción no existe' };
  if (diasRestantes(s) >= 0) return { ok: false, motivo: 'Todavía no venció' };
  const perfiles = (s.perfilIds || [s.perfilId]).map(id => DB.perfiles.find(p => p.id === id))
    .filter(p => p && p.estado === 'asignado');
  perfiles.forEach(p => { p.estado = 'libre'; });
  s.estado = 'cancelada';
  return { ok: true, perfiles };
}

/* Capacidad típica por servicio, para precargar el formulario */
const CAPACIDAD_TIPICA = { nx:4, dp:4, mx:3, pv:3, sp:6, cr:4, pp:4 };

/* Ale compró una cuenta nueva al proveedor: entra con sus perfiles libres */
function agregarCuentaMadre({ servicioId, correo, clave, capacidad, costo, proveedor, vence }){
  capacidad = Math.round(+capacidad); costo = +costo;
  if (!CAT.find(c => c.id === servicioId)) return { ok: false, motivo: 'Elegí el servicio' };
  if (!correo || !String(correo).includes('@')) return { ok: false, motivo: 'El correo no parece válido' };
  if (!clave) return { ok: false, motivo: 'Falta la clave' };
  if (!(capacidad >= 1 && capacidad <= 8)) return { ok: false, motivo: 'La capacidad va de 1 a 8 perfiles' };
  if (!(costo > 0)) return { ok: false, motivo: 'Falta el costo' };
  const m = {
    id: 'cm-' + (DB.cuentasMadre.length + 1), servicioId, capacidad, costo,
    proveedor: (proveedor || 'Sin proveedor').trim(), correo: String(correo).trim(), clave: String(clave).trim(),
    comprada: dia(HOY), vence: vence ? dia(vence) : dia(masDias(HOY, OP.diasPorMes)), notas: ''
  };
  DB.cuentasMadre.push(m);
  for (let n = 1; n <= capacidad; n++)
    DB.perfiles.push({ id: m.id + '-p' + n, cuentaMadreId: m.id, nombre: 'Perfil ' + n,
                       pin: String(1000 + Math.floor(Math.random() * 9000)), estado: 'libre' });
  return { ok: true, madre: m };
}

/* Renovar la cuenta madre con el proveedor: 30 días más desde su vence */
function renovarMadre(madreId){
  const m = DB.cuentasMadre.find(x => x.id === madreId);
  if (!m) return { ok: false, motivo: 'La cuenta madre no existe' };
  m.vence = dia(masDias(aFecha(m.vence) > HOY ? m.vence : HOY, OP.diasPorMes));
  return { ok: true, vence: m.vence };
}

/* Regla 8 — cuenta madre que muere antes que sus clientes: alerta roja */
function madresEnRiesgo(){
  return DB.cuentasMadre.filter(m => {
    const ids = perfilesDe(m).map(p => p.id);
    return DB.suscripciones.some(s =>
      (s.perfilIds || [s.perfilId]).some(id => ids.includes(id)) &&
      estadoSuscripcion(s) !== 'cancelada' && estadoSuscripcion(s) !== 'vencida' &&
      aFecha(s.vence) > aFecha(m.vence));
  });
}

/* ═══════════════════════════════════════════════════════════════
   Consultas que usan las vistas
   ═══════════════════════════════════════════════════════════ */

const suscripcionesDe = clienteId =>
  DB.suscripciones.filter(s => s.clienteId === clienteId);

const clientePorCodigo = codigo =>
  DB.clientes.find(c => c.codigoAcceso.toUpperCase() === String(codigo || '').trim().toUpperCase());

const servicioDeSuscripcion = s => {
  if (s.servicioId) return CAT.find(x => x.id === s.servicioId);
  const p = DB.perfiles.find(x => x.id === s.perfilId);
  const m = p && DB.cuentasMadre.find(x => x.id === p.cuentaMadreId);
  return m && CAT.find(x => x.id === m.servicioId);
};

/* Lo que el cliente necesita para entrar */
function accesoDe(s){
  const p = DB.perfiles.find(x => x.id === s.perfilId);
  const m = p && DB.cuentasMadre.find(x => x.id === p.cuentaMadreId);
  if (!m) return null;
  return s.planClave === 'completa'
    ? { correo: m.correo, clave: m.clave, perfil: 'Todos (' + m.capacidad + ')', pin: null }
    : { correo: m.correo, clave: m.clave, perfil: p.nombre, pin: p.pin };
}

const linkPortal = cliente => CFG.sitio + '/cuenta.html?c=' + cliente.codigoAcceso;

const vencenEntre = (desde, hasta) => DB.suscripciones
  .filter(s => {
    const d = diasRestantes(s);
    return s.estado !== 'cancelada' && d >= desde && d <= hasta;
  })
  .sort((a, b) => aFecha(a.vence) - aFecha(b.vence));

/* "esperando": se abrió WhatsApp desde la web y todavía no llegó la
   captura. Se muestra tres días; después se da por abandonado. */
const pedidosPendientes = () => DB.pedidos
  .filter(p => ['pagado','verificado','preparando'].includes(p.estado) ||
               (p.estado === 'esperando' && diasEntre(p.creado, HOY) <= 3))
  .sort((a, b) => aFecha(a.creado) - aFecha(b.creado));

const incidenciasAbiertas = () => DB.incidencias.filter(i => !i.cerrada);
const recargasPendientes  = () => DB.movimientos.filter(m => m.tipo === 'recarga' && m.estado === 'pendiente');
const clientesFinalesDe   = mayoristaId => DB.clientesFinales.filter(c => c.mayoristaId === mayoristaId);
const movimientosDe       = clienteId => DB.movimientos.filter(m => m.clienteId === clienteId)
  .sort((a, b) => aFecha(b.fecha) - aFecha(a.fecha));

/* Todo lo que le pasó a un cliente, lo más nuevo primero */
function historialDe(clienteId){
  const ev = [];
  suscripcionesDe(clienteId).forEach(s => {
    const sv = servicioDeSuscripcion(s);
    const nombre = sv ? sv.nombre : 'tu cuenta';
    ev.push({ fecha: s.inicio, tipo: 'compra',
              texto: 'Compraste ' + nombre + ' · ' + etiquetaPlan(sv && sv.id, s.planClave),
              monto: s.precio });
    (s.renovaciones || []).forEach(r => ev.push({ fecha: r.fecha, tipo: 'renovacion',
      texto: 'Renovaste ' + nombre + ' por ' + (r.meses === 12 ? '12 meses' : r.meses + ' mes' + (r.meses > 1 ? 'es' : '')),
      monto: r.precio }));
    DB.incidencias.filter(i => i.suscripcionId === s.id).forEach(i => ev.push(i.cerrada
      ? { fecha: i.cerrada, tipo: 'reposicion', texto: 'Repusimos ' + nombre + ': acceso nuevo, misma fecha' }
      : { fecha: i.abierta, tipo: 'incidencia', texto: 'Reportaste ' + nombre + ': ' + i.causa.toLowerCase() }));
  });
  return ev.sort((a, b) => aFecha(b.fecha) - aFecha(a.fecha));
}

/* Dinero del mes en curso */
function resumenDinero(){
  const mes = HOY.getMonth(), anio = HOY.getFullYear();
  const delMes = DB.suscripciones.filter(s => {
    const f = aFecha(s.inicio);
    return f.getMonth() === mes && f.getFullYear() === anio;
  });
  const ingreso = delMes.reduce((t, s) => t + s.precio, 0);
  const margen  = delMes.reduce((t, s) => t + margenDe(s), 0);
  const costoMadres = DB.cuentasMadre.reduce((t, m) => t + m.costo, 0);
  return { ingreso, margen, costoMadres, ventas: delMes.length };
}

/* ═══════════════════════════════════════════════════════════════
   Datos simulados
   Semilla fija: los números no bailan entre recargas, que si no el
   panel parece roto.
   ═══════════════════════════════════════════════════════════ */
let _semilla = 20260908;
const azar = () => {
  _semilla = (_semilla * 1103515245 + 12345) & 0x7fffffff;
  return _semilla / 0x7fffffff;
};
const entre  = (a, b) => a + Math.floor(azar() * (b - a + 1));
const elegir = arr => arr[Math.floor(azar() * arr.length)];

/* Código del portal: 10 caracteres sin los que se confunden (0/O, 1/I/L).
   31^10 combinaciones: no se adivina probando. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const nuevoCodigoAcceso = (rnd = Math.random) =>
  Array.from({ length: 10 }, () => ALFABETO[Math.floor(rnd() * ALFABETO.length)]).join('');

const DB = { cuentasMadre: [], perfiles: [], clientes: [], clientesFinales: [],
             suscripciones: [], pedidos: [], movimientos: [], incidencias: [] };

function descartarPedido(pedidoId){
  const p = DB.pedidos.find(x => x.id === pedidoId);
  if (!p || p.estado === 'entregado') return { ok: false, motivo: 'No se puede descartar' };
  p.estado = 'rechazado';
  return { ok: true };
}

function nuevoCliente(nombre, whatsapp, tipo){
  const c = { id: 'c-' + (DB.clientes.length + 1), nombre, tipo, whatsapp,
              codigoAcceso: nuevoCodigoAcceso(), creado: dia(HOY) };
  DB.clientes.push(c);
  return c;
}

const NOMBRES = [
  'María Belén Rojas','Jesús Alberto Mora','Yenifer Colmenares','Carlos Eduardo Piña',
  'Rosángela Díaz','Luis Fernando Ortega','Katiuska Bermúdez','Andrés Villalobos',
  'Génesis Marcano','Wilmer Salazar','Daniela Guerrero','José Gregorio Rivas',
  'Anyelis Fuentes','Ramón Antonio Silva','Mariana Pérez','Eduardo Sanabria',
  'Distribuidora Oriente','Digital Anzoátegui','Mundo Streaming Lechería','TecnoBarcelona'
];
const FINALES = ['Yusmary','Kelvin','Oriana','Deivis','Maryelis','Jhonny','Albany','Franyer',
                 'Nailet','Yorman','Dayana','Leonel','Rosmery','Brayan','Yuleidy','Ender'];

(function sembrar(){
  if (!DEMO) return;          // con la base real, los datos llegan de db.js
  /* ── Cuentas madre: lo que Ale le compró al proveedor ── */
  const receta = [
    ['nx', 4, 11.00, 'VirtuMall · TANCHI TV'],
    ['nx', 4, 11.00, 'VirtuMall · joseb.shop'],
    ['dp', 4,  9.00, 'Gudfy · askaboutme'],
    ['mx', 3,  8.50, 'VirtuMall · TANCHI TV'],
    ['pv', 3,  6.00, 'Gudfy · Apolo'],
    ['sp', 6,  9.60, 'Panel ClicTV'],
    ['cr', 4,  6.40, 'Gudfy · Torres1519'],
    ['pp', 4,  6.20, 'Panel Digital Plus'],
    ['nx', 4, 11.00, 'Gudfy · flixec'],
    ['dp', 4,  9.00, 'VirtuMall · Brand Stream VIP'],
    ['mx', 3,  8.50, 'Panel ClicTV'],
    ['sp', 6,  9.60, 'Gudfy · pack x6'],
    ['nx', 4, 11.20, 'VirtuMall · TANCHI TV'],
    ['cr', 4,  6.40, 'Panel Tienda Stream'],
    ['mx', 3,  8.50, 'Gudfy · askaboutme'],
    ['pv', 3,  6.00, 'VirtuMall · TANCHI TV'],
    ['pv', 3,  6.00, 'Panel ClicTV'],
    ['dp', 4,  9.00, 'Panel Digital Plus'],
    ['nx', 4, 11.00, 'VirtuMall · joseb.shop'],
    ['nx', 4, 11.00, 'Gudfy · flixec'],
    ['nx', 4, 11.20, 'VirtuMall · TANCHI TV'],
    ['dp', 4,  9.00, 'Gudfy · askaboutme'],
    ['sp', 6,  9.60, 'Panel ClicTV'],
    ['mx', 3,  8.50, 'Panel ClicTV'],
    ['cr', 4,  6.40, 'Gudfy · Torres1519'],
    ['mx', 3,  8.50, 'VirtuMall · TANCHI TV'],
    ['mx', 3,  8.50, 'Gudfy · askaboutme'],
    ['mx', 3,  8.50, 'Panel ClicTV'],
    ['cr', 4,  6.40, 'Panel Tienda Stream'],
    ['cr', 4,  6.40, 'Gudfy · Torres1519'],
    ['pv', 3,  6.00, 'Gudfy · Apolo'],
    ['pv', 3,  6.00, 'VirtuMall · TANCHI TV'],
    ['pv', 3,  6.00, 'Panel ClicTV'],
    ['dp', 4,  9.00, 'VirtuMall · Brand Stream VIP'],
    ['dp', 4,  9.00, 'Panel Digital Plus'],
    ['sp', 6,  9.60, 'Gudfy · pack x6']
  ];
  receta.forEach(([servicioId, cap, costo, proveedor], i) => {
    const comprada = masDias(HOY, -entre(0, 9));
    const m = {
      id: 'cm-' + (i + 1), servicioId, capacidad: cap, costo, proveedor,
      correo: 'sv.' + servicioId + (i + 1) + '@streamve.com',
      clave: 'Sv' + entre(1000, 9999) + '!',
      comprada: dia(comprada),
      vence: dia(masDias(comprada, 30)),
      notas: ''
    };
    DB.cuentasMadre.push(m);
    for (let n = 1; n <= cap; n++)
      DB.perfiles.push({
        id: m.id + '-p' + n, cuentaMadreId: m.id,
        nombre: 'Perfil ' + n, pin: String(entre(1000, 9999)), estado: 'libre'
      });
  });

  /* ── Clientes ── */
  NOMBRES.forEach((nombre, i) => {
    const mayorista = i >= NOMBRES.length - 4;
    DB.clientes.push({
      id: 'c-' + (i + 1), nombre, tipo: mayorista ? 'mayorista' : 'personal',
      whatsapp: '58' + elegir(['412','414','424','416']) + entre(1000000, 9999999),
      codigoAcceso: nuevoCodigoAcceso(azar),
      creado: dia(masDias(HOY, -entre(20, 150)))
    });
  });

  /* Suscripción sembrada con fecha a medida (las reales nacen hoy) */
  const sembrarSusc = (cli, serv, plan, restan, precio, asignadoA) => {
    const perfil = buscarPerfilLibre(serv.id);
    if (!perfil) return null;
    const vence  = masDias(HOY, restan);
    perfil.estado = 'asignado';
    const s = {
      id: 'ss-' + (DB.suscripciones.length + 1),
      clienteId: cli.id, servicioId: serv.id, perfilId: perfil.id, perfilIds: [perfil.id], planClave: plan.k,
      inicio: dia(masDias(vence, -OP.diasPorMes)), vence: dia(vence),
      precio, meses: 1, estado: 'activa', reposiciones: 0, renovaciones: [],
      asignadoA: asignadoA || null
    };
    DB.suscripciones.push(s);
    return s;
  };

  /* ── Suscripciones repartidas en todos los estados ── */
  const personales = DB.clientes.filter(c => c.tipo === 'personal');
  /* Repartimos los vencimientos: algunas vencidas, varias por vencer,
     el resto corriendo. Así el panel muestra los tres estados. */
  const RESTAN = [-6, -3, -1, 0, 1, 2, 3, 5, 8, 12, 16, 21, 25, 28];
  for (let n = 0; n < 35; n++){
    const serv = elegir(CAT);
    sembrarSusc(elegir(personales), serv, serv.planes[0], elegir(RESTAN), serv.planes[0].precio);
  }
  /* Una renovación hecha, para que el historial del portal tenga de todo */
  const conRenov = DB.suscripciones.find(s => diasRestantes(s) > 10);
  if (conRenov) conRenov.renovaciones.push({ fecha: conRenov.inicio, meses: 1, precio: conRenov.precio });

  /* ── Mayoristas: unidades compradas, la mayoría ya asignadas a sus
     clientes, y el saldo que les quedó ── */
  DB.clientes.filter(c => c.tipo === 'mayorista').forEach((c, i) => {
    let gastado = 0;
    const cuantas = entre(10, 14);
    for (let n = 0; n < cuantas; n++){
      const serv = elegir(CAT.filter(x => x.id !== 'pp'));
      const pl = planMayorista(serv);
      let asignado = null;
      if (azar() < 0.72){
        const cf = { id: 'cf-' + (DB.clientesFinales.length + 1), mayoristaId: c.id,
                     nombre: elegir(FINALES) + ' ' + elegir(['R.','M.','G.','P.','S.','C.']),
                     whatsapp: '58' + elegir(['412','414','424','416']) + entre(1000000, 9999999) };
        DB.clientesFinales.push(cf);
        asignado = cf.id;
      }
      if (sembrarSusc(c, serv, pl, elegir(RESTAN.filter(d => d >= -1)), pl.precioMayorista, asignado))
        gastado += pl.precioMayorista;
    }
    const recarga = Math.ceil((gastado + entre(12, 60)) / 10) * 10;
    DB.movimientos.push({
      id: 'mv-r' + i, clienteId: c.id, tipo: 'recarga', estado: 'ok',
      monto: recarga, fecha: dia(masDias(HOY, -entre(20, 28))),
      referencia: 'Binance ' + entre(100000, 999999)
    });
    DB.movimientos.push({
      id: 'mv-c' + i, clienteId: c.id, tipo: 'consumo', estado: 'ok',
      monto: +gastado.toFixed(2), fecha: dia(masDias(HOY, -entre(12, 19))),
      referencia: 'Pedido de ' + cuantas + ' u.'
    });
  });
  /* Una recarga esperando que Ale la acredite */
  const mayor1 = DB.clientes.find(c => c.tipo === 'mayorista');
  DB.movimientos.push({ id: 'mv-p0', clienteId: mayor1.id, tipo: 'recarga', estado: 'pendiente',
                        monto: 60, fecha: dia(HOY), referencia: 'Pago Móvil' });

  /* ── Pedidos entrando por la web, en distintos estados ── */
  [['pagado', 0], ['pagado', 0], ['verificado', 0], ['preparando', 1], ['entregado', 2]]
    .forEach(([estado, dias], i) => {
      const cli = elegir(personales);
      const serv = elegir(CAT.filter(x => x.id !== 'pp'));
      DB.pedidos.push({
        id: 'SV-' + (4200 + i * 13), clienteId: cli.id,
        items: [{ servicioId: serv.id, planClave: serv.planes[0].k, cantidad: 1, meses: 1,
                  precio: serv.planes[0].precio }],
        total: serv.planes[0].precio,
        metodoPago: elegir(['binance', 'pagoMovil']),
        referencia: String(entre(100000, 999999)),
        estado, creado: dia(masDias(HOY, -dias)),
        entregado: estado === 'entregado' ? dia(masDias(HOY, -dias)) : null
      });
    });

  /* ── Una incidencia abierta, para que el panel tenga qué mostrar ── */
  const conFalla = DB.suscripciones.find(s => estadoSuscripcion(s) === 'activa');
  if (conFalla) DB.incidencias.push({
    id: 'inc-1', suscripcionId: conFalla.id, causa: 'Pide código de hogar',
    abierta: dia(masDias(HOY, -1)), cerrada: null, accion: null
  });
})();
