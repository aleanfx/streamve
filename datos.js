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
  minMayorista:    10
};

/* ═══════════════════════════════════════════════════════════════
   Fechas — todo el sistema trabaja en días, no en horas
   ═══════════════════════════════════════════════════════════ */
const HOY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

const masDias  = (fecha, n) => { const d = new Date(fecha); d.setDate(d.getDate() + n); return d; };
const dia = f => {
  const d = new Date(f);
  /* Nada de toISOString: convierte a UTC y en UTC-4 la medianoche local
     cae en el día anterior. Se arma con las partes locales. */
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
};
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

const fechaCorta = f => new Date(f).toLocaleDateString('es-VE',
  { day: '2-digit', month: 'short' }).replace('.', '');

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
   Son funciones puras: reciben datos y devuelven un resultado.
   ═══════════════════════════════════════════════════════════ */

const diasRestantes = s => diasEntre(HOY, s.vence);

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

/* Stock real de un servicio: perfiles libres en cuentas madre vivas */
function stockDisponible(servicioId){
  return DB.cuentasMadre
    .filter(m => m.servicioId === servicioId && diasRestantes({ vence: m.vence }) >= 0)
    .reduce((n, m) => n + perfilesLibres(m).length, 0);
}

/* Regla 2 — al entregar se toma un perfil libre de una cuenta madre viva.
   Se elige la que vence más tarde, para que el cliente dure lo máximo. */
function buscarPerfilLibre(servicioId){
  const madres = DB.cuentasMadre
    .filter(m => m.servicioId === servicioId && tieneCupo(m) && diasRestantes({ vence: m.vence }) >= 0)
    .sort((a, b) => new Date(b.vence) - new Date(a.vence));
  for (const m of madres){
    const libre = perfilesLibres(m)[0];
    if (libre) return libre;
  }
  return null;
}

/* Regla 4 — reponer NO regala días: la fecha de vencimiento no se mueve.
   El perfil que falló queda 'caido' y sale del stock para siempre. */
function reponer(suscripcionId, causa){
  const s = DB.suscripciones.find(x => x.id === suscripcionId);
  if (!s) return { ok: false, motivo: 'La suscripción no existe' };

  const viejo = DB.perfiles.find(p => p.id === s.perfilId);
  const madre = DB.cuentasMadre.find(m => m.id === viejo.cuentaMadreId);
  const nuevo = buscarPerfilLibre(madre.servicioId);
  if (!nuevo) return { ok: false, motivo: 'No hay perfiles libres de ese servicio' };

  viejo.estado = 'caido';
  nuevo.estado = 'asignado';
  s.perfilId = nuevo.id;                      // el vence queda igual: regla 4
  s.reposiciones = (s.reposiciones || 0) + 1;

  DB.incidencias.push({
    id: 'inc-' + (DB.incidencias.length + 1),
    suscripcionId, causa: causa || 'No entraba',
    abierta: dia(HOY), cerrada: dia(HOY), accion: 'repuesta'
  });
  return { ok: true, perfil: nuevo };
}

/* Regla 7 — el único número honesto: lo que queda después del costo real
   de la porción de cuenta madre que ocupa esa suscripción. */
function margenDe(s){
  const p = DB.perfiles.find(x => x.id === s.perfilId);
  if (!p) return 0;
  const m = DB.cuentasMadre.find(x => x.id === p.cuentaMadreId);
  if (!m) return 0;
  return s.precio - (m.costo / m.capacidad);
}

/* Regla 6 — el mayorista compra contra saldo y nunca queda en negativo */
const saldoDe = clienteId => DB.movimientos
  .filter(m => m.clienteId === clienteId)
  .reduce((t, m) => t + (m.tipo === 'recarga' ? m.monto : -m.monto), 0);

function puedeComprarMayorista(clienteId, unidades, monto){
  if (unidades < OP.minMayorista)
    return { ok: false, motivo: 'El mínimo es ' + OP.minMayorista + ' unidades' };
  if (saldoDe(clienteId) < monto)
    return { ok: false, motivo: 'Saldo insuficiente' };
  return { ok: true };
}

/* Regla 8 — cuenta madre que muere antes que sus clientes: alerta roja */
function madresEnRiesgo(){
  return DB.cuentasMadre.filter(m => {
    const susc = DB.suscripciones.filter(s =>
      perfilesDe(m).some(p => p.id === s.perfilId) && estadoSuscripcion(s) !== 'cancelada');
    return susc.some(s => new Date(s.vence) > new Date(m.vence));
  });
}

/* ═══════════════════════════════════════════════════════════════
   Consultas que usan los paneles
   ═══════════════════════════════════════════════════════════ */

const suscripcionesDe = clienteId =>
  DB.suscripciones.filter(s => s.clienteId === clienteId);

const clientePorCodigo = codigo =>
  DB.clientes.find(c => c.codigoAcceso.toUpperCase() === String(codigo).toUpperCase());

const servicioDeSuscripcion = s => {
  const p = DB.perfiles.find(x => x.id === s.perfilId);
  const m = p && DB.cuentasMadre.find(x => x.id === p.cuentaMadreId);
  return m && CAT.find(x => x.id === m.servicioId);
};

const vencenEntre = (desde, hasta) => DB.suscripciones
  .filter(s => {
    const d = diasRestantes(s);
    return s.estado !== 'cancelada' && d >= desde && d <= hasta;
  })
  .sort((a, b) => new Date(a.vence) - new Date(b.vence));

const pedidosPendientes = () => DB.pedidos
  .filter(p => p.estado === 'pagado' || p.estado === 'verificado' || p.estado === 'preparando')
  .sort((a, b) => new Date(a.creado) - new Date(b.creado));

const incidenciasAbiertas = () => DB.incidencias.filter(i => !i.cerrada);

/* Dinero del mes en curso */
function resumenDinero(){
  const mes = HOY.getMonth(), anio = HOY.getFullYear();
  const delMes = DB.suscripciones.filter(s => {
    const f = new Date(s.inicio);
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

const NOMBRES = [
  'María Belén Rojas','Jesús Alberto Mora','Yenifer Colmenares','Carlos Eduardo Piña',
  'Rosángela Díaz','Luis Fernando Ortega','Katiuska Bermúdez','Andrés Villalobos',
  'Génesis Marcano','Wilmer Salazar','Daniela Guerrero','José Gregorio Rivas',
  'Anyelis Fuentes','Ramón Antonio Silva','Mariana Pérez','Eduardo Sanabria',
  'Distribuidora Oriente','Digital Anzoátegui','Mundo Streaming Lechería','TecnoBarcelona'
];

const DB = { cuentasMadre: [], perfiles: [], clientes: [], suscripciones: [],
             pedidos: [], movimientos: [], incidencias: [] };

(function sembrar(){
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
    ['cr', 4,  6.40, 'Panel Tienda Stream']
  ];
  receta.forEach(([servicioId, cap, costo, proveedor], i) => {
    const comprada = masDias(HOY, -entre(4, 26));
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
      codigoAcceso: 'SV' + String(1000 + i * 7),
      creado: dia(masDias(HOY, -entre(20, 150)))
    });
  });

  /* ── Suscripciones repartidas en todos los estados ── */
  const personales = DB.clientes.filter(c => c.tipo === 'personal');
  let n = 0;
  while (n < 35){
    const cli = elegir(personales);
    const serv = elegir(CAT);
    const perfil = buscarPerfilLibre(serv.id);
    if (!perfil) { n++; continue; }

    const plan = serv.planes[0];
    /* Repartimos los vencimientos: algunas vencidas, varias por vencer,
       el resto corriendo. Así el panel muestra los tres estados. */
    const restan = elegir([-6, -3, -1, 0, 1, 2, 3, 5, 8, 12, 16, 21, 25, 28]);
    const vence  = masDias(HOY, restan);
    const inicio = masDias(vence, -OP.diasPorMes);

    perfil.estado = 'asignado';
    DB.suscripciones.push({
      id: 'ss-' + (DB.suscripciones.length + 1),
      clienteId: cli.id, perfilId: perfil.id, planClave: plan.k,
      inicio: dia(inicio), vence: dia(vence),
      precio: plan.precio, meses: 1, estado: 'activa', reposiciones: 0
    });
    n++;
  }

  /* ── Saldo y pedidos de los mayoristas ── */
  DB.clientes.filter(c => c.tipo === 'mayorista').forEach((c, i) => {
    DB.movimientos.push({
      id: 'mv-r' + i, clienteId: c.id, tipo: 'recarga',
      monto: elegir([50, 80, 120, 200]), fecha: dia(masDias(HOY, -entre(3, 18))),
      referencia: 'Binance ' + entre(100000, 999999)
    });
    const gasto = entre(18, 46);
    DB.movimientos.push({
      id: 'mv-c' + i, clienteId: c.id, tipo: 'consumo',
      monto: gasto, fecha: dia(masDias(HOY, -entre(1, 10))),
      referencia: 'Pedido de ' + entre(10, 22) + ' u.'
    });
  });

  /* ── Pedidos entrando por la web, en distintos estados ── */
  [['pagado', 0], ['pagado', 0], ['verificado', 0], ['preparando', 1], ['entregado', 2]]
    .forEach(([estado, dias], i) => {
      const cli = elegir(DB.clientes);
      const serv = elegir(CAT);
      DB.pedidos.push({
        id: 'SV-' + (4200 + i * 13), clienteId: cli.id,
        items: [{ servicioId: serv.id, planClave: serv.planes[0].k, cantidad: 1,
                  precio: serv.planes[0].precio }],
        total: serv.planes[0].precio,
        metodoPago: elegir(['binance', 'pagoMovil']),
        referencia: String(entre(100000, 999999)),
        estado, creado: dia(masDias(HOY, -dias)),
        entregado: estado === 'entregado' ? dia(masDias(HOY, -dias)) : null
      });
    });

  /* ── Una incidencia abierta, para que el panel tenga qué mostrar ── */
  const conFalla = DB.suscripciones[3];
  if (conFalla) DB.incidencias.push({
    id: 'inc-1', suscripcionId: conFalla.id, causa: 'Pide código de hogar',
    abierta: dia(masDias(HOY, -1)), cerrada: null, accion: null
  });
})();
