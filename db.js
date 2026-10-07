/* StreamVe — conexión con la base (Supabase).
 *
 * Las vistas no hablan con Supabase: le piden acciones a ACC y leen DB,
 * igual que en modo demo. Acá se traduce:
 *   - leer:   la base → DB, con la misma forma que usan las reglas
 *   - actuar: ACC.algo() → la función de la base → se recarga DB
 * En modo demo, ACC llama a las reglas locales de datos.js.
 *
 * Toda acción devuelve una promesa con { ok, motivo, ... }.
 *
 * Depende de: ui.js, catalogo.js, datos.js y supabase-js (CDN)
 */

const SB = (!DEMO && window.supabase)
  ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey,
      { auth: { persistSession: true, storageKey: 'streamve.sesion' } })
  : null;
const EN_VIVO = !!SB;

/* Fechas: las columnas date llegan "2026-10-05" (se dejan); las timestamp
   llegan con hora y se pasan al día local de Venezuela. */
const aDia = v => !v ? null : String(v).length === 10 ? String(v) : dia(new Date(v));
const motivoDe = e => (e && (e.message || e.error_description)) || 'Algo falló. Probá de nuevo.';
const vaciarDB = () => Object.keys(DB).forEach(k => { DB[k] = []; });

async function rpc(nombre, args){
  const { data, error } = await SB.rpc(nombre, args || {});
  if (error) throw error;
  return data;
}

/* ═══ lectores ═══ */

const mapMadre = m => ({ id: m.id, servicioId: m.servicio_id, capacidad: m.capacidad, costo: +m.costo,
  proveedor: m.proveedor, correo: m.correo, clave: m.clave, comprada: m.comprada, vence: m.vence, notas: m.notas });
const mapCliente = c => ({ id: c.id, nombre: c.nombre, whatsapp: c.whatsapp, tipo: c.tipo,
  codigoAcceso: c.codigo_acceso, creado: aDia(c.creado) });
const mapFinal = f => ({ id: f.id, mayoristaId: f.mayorista_id, nombre: f.nombre, whatsapp: f.whatsapp });
const mapMov = m => ({ id: m.id, clienteId: m.cliente_id, tipo: m.tipo, monto: +m.monto,
  estado: m.estado, referencia: m.referencia, fecha: aDia(m.fecha) });
const mapInc = i => ({ id: i.id, suscripcionId: i.suscripcion_id, causa: i.causa,
  abierta: aDia(i.abierta), cerrada: aDia(i.cerrada), accion: i.accion });
const mapPedido = p => ({ id: p.id, clienteId: p.cliente_id, total: +p.total, metodoPago: p.metodo_pago,
  referencia: p.referencia, estado: p.estado, creado: aDia(p.creado), entregado: aDia(p.entregado),
  items: (p.items || []).map(it => ({ servicioId: it.servicio_id, planClave: it.plan_clave,
    cantidad: +it.cantidad || 1, meses: +it.meses || 1, precio: +it.precio })) });
const mapSusc = (s, perfiles, renov) => {
  const mios = perfiles.filter(p => p._s === s.id)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
  return {
    id: s.id, clienteId: s.cliente_id, servicioId: s.servicio_id, planClave: s.plan_clave,
    perfilIds: mios.map(p => p.id), perfilId: mios[0] ? mios[0].id : null,
    inicio: s.inicio, vence: s.vence, precio: +s.precio, meses: s.meses, estado: s.estado,
    reposiciones: s.reposiciones, asignadoA: s.asignado_a,
    renovaciones: renov.filter(r => r.suscripcion_id === s.id)
      .map(r => ({ fecha: r.fecha, meses: r.meses, precio: +r.precio }))
  };
};

/* El admin ve todo: se trae la base entera (las reglas de RLS lo permiten
   solo si es admin). */
async function cargarTodo(){
  const tablas = ['cuentas_madre','perfiles','clientes','clientes_finales','suscripciones',
                  'renovaciones','pedidos','movimientos','incidencias'];
  const res = await Promise.all(tablas.map(t => SB.from(t).select('*').limit(10000)));
  const malo = res.find(r => r.error);
  if (malo) throw malo.error;
  const [cm, pf, cl, cf, ss, rn, pd, mv, inc] = res.map(r => r.data);
  vaciarDB();
  STOCK_FIJO = null;
  DB.cuentasMadre    = cm.map(mapMadre);
  DB.perfiles        = pf.map(p => ({ id: p.id, cuentaMadreId: p.cuenta_madre_id, nombre: p.nombre,
                                      pin: p.pin, estado: p.estado, _s: p.suscripcion_id }));
  DB.clientes        = cl.map(mapCliente);
  DB.clientesFinales = cf.map(mapFinal);
  DB.suscripciones   = ss.map(s => mapSusc(s, DB.perfiles, rn));
  DB.pedidos         = pd.map(mapPedido);
  DB.movimientos     = mv.map(mapMov);
  DB.incidencias     = inc.map(mapInc);
}

/* La tienda solo necesita cuánto hay de cada plan */
async function cargarStockPublico(){
  const filas = await rpc('stock_publico');
  STOCK_FIJO = {};
  filas.forEach(f => { STOCK_FIJO[f.servicio_id + ':' + f.plan_clave] = +f.libres; });
}

/* El portal y el revendedor reciben sus accesos ya armados (sin costos ni
   proveedores). Se arma una cuenta madre y un perfil "de mentira" por
   acceso, así accesoDe() y el resto de las reglas funcionan igual. */
function sembrarAccesos(unidades, clienteId){
  unidades.forEach(u => {
    const mid = 'm-' + u.id, pid = 'p-' + u.id;
    const cap = +((/\((\d+)\)/.exec(u.perfil || '') || [])[1]) || 1;   // "Todos (4)"
    DB.cuentasMadre.push({ id: mid, servicioId: u.servicio_id, capacidad: cap, costo: 0, proveedor: '',
      correo: u.correo || '', clave: u.clave || '', vence: u.vence });
    DB.perfiles.push({ id: pid, cuentaMadreId: mid, nombre: u.perfil || '', pin: u.pin, estado: 'asignado' });
    DB.suscripciones.push({
      id: u.id, clienteId, servicioId: u.servicio_id, planClave: u.plan_clave,
      perfilId: pid, perfilIds: [pid], inicio: u.inicio, vence: u.vence, precio: +u.precio,
      meses: u.meses, estado: 'activa', reposiciones: u.reposiciones || 0, renovaciones: [],
      asignadoA: u.asignado_a || null
    });
  });
}

async function cargarPortal(codigo){
  const j = await rpc('portal', { p_codigo: codigo });
  vaciarDB();
  if (!j) return null;
  const c = { id: 'yo', nombre: j.cliente.nombre, tipo: j.cliente.tipo, codigoAcceso: j.cliente.codigo, whatsapp: '' };
  DB.clientes.push(c);
  sembrarAccesos(j.suscripciones, c.id);
  (j.renovaciones || []).forEach(r => {
    const s = DB.suscripciones.find(x => x.id === r.suscripcion_id);
    if (s) s.renovaciones.push({ fecha: r.fecha, meses: r.meses, precio: +r.precio });
  });
  DB.incidencias = (j.incidencias || []).map(mapInc);
  return c;
}

async function cargarMayorista(){
  const { data: yo, error } = await SB.from('clientes').select('*').maybeSingle();
  if (error) throw error;
  if (!yo || yo.tipo !== 'mayorista') return null;
  const [unidades, movs, finales] = await Promise.all([
    rpc('mis_unidades'),
    SB.from('movimientos').select('*').then(r => { if (r.error) throw r.error; return r.data; }),
    SB.from('clientes_finales').select('*').then(r => { if (r.error) throw r.error; return r.data; }),
    cargarStockPublico()
  ]);
  vaciarDB();
  const c = mapCliente(yo);
  DB.clientes.push(c);
  DB.clientesFinales = finales.map(mapFinal);
  DB.movimientos = movs.map(mapMov);
  sembrarAccesos(unidades, c.id);
  return c;
}

/* ═══ sesión (paneles) ═══ */

async function sesionActual(){
  if (!SB) return null;
  const { data } = await SB.auth.getSession();
  return data.session;
}
async function entrar(correo, clave){
  const { error } = await SB.auth.signInWithPassword({ email: correo.trim(), password: clave });
  if (error) return { ok: false, motivo: error.message === 'Invalid login credentials'
    ? 'Correo o contraseña incorrectos' : motivoDe(error) };
  return { ok: true };
}
/* Crear el usuario no da acceso a nada: hasta que Ale lo marque como
   admin o lo vincule a un revendedor, las reglas de la base no le
   muestran ni una fila. */
async function crearUsuario(correo, clave){
  if (String(clave).length < 8) return { ok: false, motivo: 'La contraseña necesita al menos 8 caracteres' };
  const { data, error } = await SB.auth.signUp({ email: correo.trim(), password: clave,
    options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) return { ok: false, motivo: /registered/i.test(error.message) ? 'Ese correo ya tiene usuario: entrá' : motivoDe(error) };
  return { ok: true, sesion: !!data.session };
}
async function salir(){ if (SB) await SB.auth.signOut(); }
const soyAdmin = () => rpc('es_admin');

/* ═══ acciones ═══ */

/* Envuelve una regla local (demo) o una llamada a la base (en vivo) */
const accion = (local, remoto) => async (...a) => {
  if (!EN_VIVO) return local(...a);
  try { return await remoto(...a); }
  catch (e) { return { ok: false, motivo: motivoDe(e) }; }
};

const ACC = {
  /* tienda */
  crearPedidoWeb: accion(
    () => ({ ok: true, id: 'SV-' + (4100 + Math.floor(Math.random() * 5800)) }),
    async (servicioId, planClave, meses, metodo) => {
      const j = await rpc('crear_pedido_web', { p_servicio: servicioId, p_plan: planClave, p_meses: meses, p_metodo: metodo });
      return { ok: true, id: j.id, total: +j.total };
    }),

  /* portal */
  reportar: accion(
    (codigo, sid, causa) => { abrirIncidencia(sid, causa); return { ok: true }; },
    async (codigo, sid, causa) => ({ ok: !!(await rpc('reportar_falla', { p_codigo: codigo, p_suscripcion: sid, p_causa: causa })) })),

  /* admin */
  registrarVenta: accion(registrarVenta, async v => {
    const j = await rpc('registrar_venta', { p_cliente: v.clienteId || null, p_nombre: v.nombre || null,
      p_whatsapp: v.whatsapp || null, p_servicio: v.servicioId, p_plan: v.planClave, p_meses: v.meses, p_metodo: v.metodoPago });
    await cargarTodo();
    return { ok: true, suscripcion: DB.suscripciones.find(s => s.id === j.suscripcion), cliente: DB.clientes.find(c => c.id === j.cliente) };
  }),
  entregarPedido: accion(entregarPedido, async (id, clienteId) => {
    const ids = await rpc('entregar_pedido', { p_id: id, p_cliente: clienteId || null });
    await cargarTodo();
    return { ok: true, suscripciones: ids.map(x => DB.suscripciones.find(s => s.id === x)).filter(Boolean) };
  }),
  crearCliente: accion(
    (nombre, whatsapp) => {
      const tel = normalizarTel(whatsapp);
      if (!nombre || !nombre.trim()) return { ok: false, motivo: 'Falta el nombre' };
      if (tel.length < 11) return { ok: false, motivo: 'El WhatsApp no parece válido' };
      return { ok: true, cliente: DB.clientes.find(c => c.whatsapp === tel) || nuevoCliente(nombre.trim(), tel, 'personal') };
    },
    async (nombre, whatsapp) => {
      const tel = normalizarTel(whatsapp);
      if (!nombre || !nombre.trim()) return { ok: false, motivo: 'Falta el nombre' };
      if (tel.length < 11) return { ok: false, motivo: 'El WhatsApp no parece válido' };
      const ya = await SB.from('clientes').select('id').eq('whatsapp', tel).maybeSingle();
      if (ya.data) return { ok: true, cliente: { id: ya.data.id } };
      const { data, error } = await SB.from('clientes').insert({ nombre: nombre.trim(), whatsapp: tel }).select('id').single();
      if (error) throw error;
      return { ok: true, cliente: { id: data.id } };
    }),
  descartarPedido: accion(descartarPedido, async id => {
    const { error } = await SB.from('pedidos').update({ estado: 'rechazado' }).eq('id', id);
    if (error) throw error;
    await cargarTodo();
    return { ok: true };
  }),
  reponer: accion(reponer, async (sid, causa) => {
    await rpc('reponer', { p_suscripcion: sid, p_causa: causa || 'Reportado desde el panel' });
    await cargarTodo();
    return { ok: true };
  }),
  renovar: accion(renovar, async (sid, meses) => {
    const j = await rpc('renovar', { p_suscripcion: sid, p_meses: meses || 1 });
    await cargarTodo();
    return { ok: true, vence: j.vence, precio: +j.precio };
  }),
  renovarMadre: accion(renovarMadre, async id => {
    const m = DB.cuentasMadre.find(x => x.id === id);
    if (!m) return { ok: false, motivo: 'La cuenta madre no existe' };
    const vence = dia(masDias(aFecha(m.vence) > HOY ? m.vence : HOY, OP.diasPorMes));
    const { error } = await SB.from('cuentas_madre').update({ vence }).eq('id', id);
    if (error) throw error;
    await cargarTodo();
    return { ok: true, vence };
  }),
  agregarCuentaMadre: accion(agregarCuentaMadre, async a => {
    const cap = Math.round(+a.capacidad), costo = +a.costo;
    if (!CAT.find(c => c.id === a.servicioId)) return { ok: false, motivo: 'Elegí el servicio' };
    if (!a.correo || !String(a.correo).includes('@')) return { ok: false, motivo: 'El correo no parece válido' };
    if (!a.clave) return { ok: false, motivo: 'Falta la clave' };
    if (!(cap >= 1 && cap <= 8)) return { ok: false, motivo: 'La capacidad va de 1 a 8 perfiles' };
    if (!(costo > 0)) return { ok: false, motivo: 'Falta el costo' };
    const { error } = await SB.from('cuentas_madre').insert({
      servicio_id: a.servicioId, correo: String(a.correo).trim(), clave: String(a.clave).trim(),
      capacidad: cap, costo, proveedor: (a.proveedor || '').trim(),
      vence: a.vence || dia(masDias(HOY, OP.diasPorMes)) });
    if (error) throw error;
    await cargarTodo();
    return { ok: true, madre: { capacidad: cap } };
  }),
  acreditarRecarga: accion(acreditarRecarga, async id => {
    const mv = DB.movimientos.find(m => m.id === id);
    await rpc('acreditar_recarga', { p_movimiento: id });
    await cargarTodo();
    return { ok: true, movimiento: mv };
  }),
  liberar: accion(liberar, async sid => {
    const n = await rpc('liberar', { p_suscripcion: sid });
    await cargarTodo();
    return { ok: true, perfiles: Array.from({ length: n }) };
  }),

  /* revendedor */
  comprar: accion(comprarMayorista, async (clienteId, items) => {
    const j = await rpc('comprar_mayorista', { p_items: items.filter(it => it.cantidad > 0)
      .map(it => ({ servicio_id: it.servicioId, cantidad: it.cantidad })) });
    await cargarMayorista();
    return { ok: true, monto: +j.monto, suscripciones: (j.suscripciones || []).map(id => ({ id })) };
  }),
  solicitarRecarga: accion(solicitarRecarga, async (clienteId, monto, metodo) => {
    await rpc('solicitar_recarga', { p_monto: monto, p_metodo: metodo });
    await cargarMayorista();
    return { ok: true };
  }),
  asignar: accion(asignarACliente, async (sid, nombre, whatsapp) => {
    if (!nombre || !nombre.trim()) return { ok: false, motivo: 'Falta el nombre' };
    await rpc('asignar_a_cliente', { p_suscripcion: sid, p_nombre: nombre, p_whatsapp: whatsapp || '' });
    await cargarMayorista();
    return { ok: true, clienteFinal: { nombre: nombre.trim() } };
  }),
  renovarConSaldo: accion(renovarConSaldo, async (sid, meses) => {
    const j = await rpc('renovar_con_saldo', { p_suscripcion: sid, p_meses: meses || 1 });
    await cargarMayorista();
    return { ok: true, vence: j.vence, precio: +j.precio };
  })
};
