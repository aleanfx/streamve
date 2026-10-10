/* StreamVe — panel de operación (Ale).
 *
 * Pensado como una bandeja: "Hoy" es una sola lista de cosas para hacer,
 * escritas como frases, con un botón cada una. Lo demás (clientes, cuentas
 * del proveedor, plata) se consulta cuando hace falta.
 *
 * Nada de lo que se ve acá se calcula acá: todo sale de las reglas de
 * datos.js, y toda acción pasa por ACC (db.js).
 *
 * Depende de: ui.js, catalogo.js, datos.js, db.js, paneles.js
 */

const P = {
  vista:'hoy', filtro:'todos', busca:'', cajon:null, abiertos:{},
  venta:{ modo:'nuevo', clienteId:null, nombre:'', wa:'', busca:'', sid:'nx', planK:'pantalla', meses:1, metodo:'binance' },
  madre:{ sid:'nx', correo:'', clave:'', capacidad:4, costo:'', proveedor:'', vence:'' }
};

const VISTAS = [
  ['hoy',      'HOY'],
  ['clientes', 'CLIENTES'],
  ['cuentas',  'MIS CUENTAS'],
  ['plata',    'PLATA']
];

const cliente = id => DB.clientes.find(c => c.id === id) || { nombre:'—', whatsapp:CFG.whatsapp, codigoAcceso:'', tipo:'personal' };
const nombreCliente = id => cliente(id).nombre;
const primer = n => String(n).split(' ')[0];
const waCliente = (clienteId, texto) => waLink(texto, cliente(clienteId).whatsapp);
const iniciales = n => String(n).split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/* A Ale le toca avisar a sus clientes directos. Las unidades de los
   revendedores las avisa cada revendedor desde su panel. */
const directos = lista => lista.filter(s => cliente(s.clienteId).tipo !== 'mayorista');
const METODO = { binance:'Binance', pagoMovil:'Pago Móvil', whatsapp:'WhatsApp', saldo:'Saldo', otro:'Otro' };
const hace = f => { const d = diasEntre(f, HOY); return d <= 0 ? 'hoy' : d === 1 ? 'desde ayer' : 'hace ' + d + ' días'; };

/* Lo que recibe el cliente al entregarle: acceso + su link personal */
function mensajeAcceso(s){
  const c = cliente(s.clienteId);
  return 'Hola ' + primer(c.nombre) + ', ya tenés tu acceso:\n\n' + textoAcceso(s) +
    '\n\nTu cuenta, cuándo vence y cómo renovar:\n' + linkPortal(c);
}
const mensajeAviso = s => {
  const sv = servicioDeSuscripcion(s) || { nombre:'' };
  return 'Hola ' + primer(nombreCliente(s.clienteId)) + ', tu ' + sv.nombre + ' ' + comoFalta(s.vence) +
    '. ¿Lo renovamos? Seguís con la misma clave.\n\nTu cuenta: ' + linkPortal(cliente(s.clienteId));
};

/* ── íconos: trazo fino, del color del texto ── */
const ICO = {
  pago:     '<circle cx="12" cy="12" r="9"/><path d="M14.6 9.4c-.4-.9-1.4-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.2 0-2.2-.6-2.6-1.5M12 6.4V8M12 16v1.6"/>',
  alerta:   '<path d="M12 3.5 2.5 20h19L12 3.5z"/><path d="M12 10v4.2M12 17h.01"/>',
  reloj:    '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  saldo:    '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M15.5 14.5h2"/>',
  renovar:  '<path d="M19.5 11A7.5 7.5 0 0 0 5.6 7.6M4.5 13a7.5 7.5 0 0 0 13.9 3.4"/><path d="M5 4v3.8h3.8M19 20v-3.8h-3.8"/>',
  pantalla: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 21h7M12 17v4"/>',
  caja:     '<path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16V8z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/>',
  check:    '<path d="M5 12.5 9.5 17 19 7"/>',
  lupa:     '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'
};
const ico = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;

/* ── avisos ya mandados hoy ──
   Avisar abre WhatsApp: la base no se entera. Se recuerda en este equipo
   para que la tarea pase a "esperando que pague" y no ensucie la lista. */
const CLAVE_AVISADOS = 'streamve.avisados';
const leerAvisados = () => { try { return JSON.parse(localStorage.getItem(CLAVE_AVISADOS)) || {}; } catch (e) { return {}; } };
const avisadoHoy = sid => leerAvisados()[sid] === dia(HOY);
function marcarAvisado(sid){
  const a = leerAvisados();
  Object.keys(a).forEach(k => { if (a[k] !== dia(HOY)) delete a[k]; });
  a[sid] = dia(HOY);
  try { localStorage.setItem(CLAVE_AVISADOS, JSON.stringify(a)); } catch (e) {}
}

/* ═══ HOY ═══════════════════════════════════════════════════════ */

/* Base vacía: en vez de alarmas, los tres pasos para arrancar */
function vistaPrimerosPasos(){
  return `
  <section class="arranque">
    <div class="kicker">PRIMEROS PASOS</div>
    <h1 class="display">Tu panel está listo.<br>Falta tu primera cuenta.</h1>
    <p>Todo lo que se vende sale de las cuentas que le comprás al proveedor. Cuando cargues la primera, la tienda deja de decir "agotado".</p>
    <ol class="arranque-pasos">
      <li>
        <i>1</i>
        <div><b>Comprale una cuenta al proveedor</b>
        <span>Por ejemplo, un Netflix de 4 pantallas en VirtuMall o Gudfy. Te dan un correo y una clave.</span></div>
        <button class="acc pri" data-cajon="madre" data-sid="nx">CARGAR CUENTA</button>
      </li>
      <li>
        <i>2</i>
        <div><b>Vendé una pantalla</b>
        <span>Cuando un cliente te pague por WhatsApp, tocá + VENTA arriba. O el cliente pide desde la tienda y te aparece acá.</span></div>
      </li>
      <li>
        <i>3</i>
        <div><b>Mandale el acceso</b>
        <span>Al vender, el panel te arma el mensaje con la clave y su link personal. Un toque y se envía por WhatsApp.</span></div>
      </li>
    </ol>
    <a class="arranque-demo" href="?demo" target="_blank" rel="noopener">¿Querés ver cómo se ve con clientes? Abrí la versión de prueba →</a>
  </section>`;
}

/* Clientes vivos adentro de una cuenta madre */
const clientesEnMadre = m => {
  const ids = perfilesDe(m).map(p => p.id);
  return DB.suscripciones.filter(s => s.estado !== 'cancelada' && estadoSuscripcion(s) !== 'vencida' &&
    (s.perfilIds || [s.perfilId]).some(id => ids.includes(id)));
};

/* Todo lo que hay que hacer, como frases, de lo más urgente a lo menos.
   prio: 1 plata esperando · 2 algo no anda · 3 recargas · 4 vencimientos ·
   5 renovar con el proveedor · 6 pantallas para recuperar · 7 stock · 9 ya hecho */
function tareas(){
  const t = [];

  pedidosPendientes().forEach(p => {
    const it = p.items[0], sv = servPorId(it.servicioId);
    const sin = stockPlan(it.servicioId, it.planClave) < it.cantidad;
    const espera = p.estado === 'esperando';
    const quien = p.clienteId ? primer(nombreCliente(p.clienteId)) : '';
    t.push({
      prio: espera ? 1.5 : 1, tono: espera ? 'ambar' : 'rojo', icono:'pago', sid: it.servicioId,
      titulo: espera ? 'Pedido de ' + sv.nombre + ' desde la tienda'
                     : (quien ? quien + ' te pagó ' : 'Te pagaron ') + sv.nombre,
      sub: [p.id, etiquetaPlan(it.servicioId, it.planClave) + (it.cantidad > 1 ? ' × ' + it.cantidad : '') + (it.meses === 12 ? ' · 12 meses' : ''),
            usd(p.total), espera ? 'esperá la captura en WhatsApp' : (METODO[p.metodoPago] || '') + (p.referencia ? ' ' + p.referencia : '')]
           .filter(Boolean).join(' · '),
      nota: sin ? 'No tenés pantallas libres de ' + sv.nombre + ': cargá una cuenta primero.' : '',
      boton: sin ? { txt:'Cargar cuenta', attr:`data-cajon="madre" data-sid="${it.servicioId}"` }
                 : { txt:'Entregar', attr:`data-entregar="${p.id}"` },
      extra: espera ? { txt:'Descartar', attr:`data-descartar="${p.id}"` } : null
    });
  });

  incidenciasAbiertas().forEach(i => {
    const s = DB.suscripciones.find(x => x.id === i.suscripcionId);
    if (!s) return;
    const sv = servicioDeSuscripcion(s) || servPorId('');
    const sin = stockPlan(sv.id, s.planClave) === 0;
    t.push({
      prio:2, tono:'rojo', icono:'alerta', sid: sv.id,
      titulo: 'A ' + primer(nombreCliente(s.clienteId)) + ' no le funciona ' + sv.nombre,
      sub: i.causa + ' · ' + hace(i.abierta),
      nota: sin ? 'No tenés pantallas libres de ' + sv.nombre + ' para reponer.' : '',
      boton: sin ? { txt:'Cargar cuenta', attr:`data-cajon="madre" data-sid="${sv.id}"` }
                 : { txt:'Darle otra pantalla', attr:`data-reponer="${s.id}"` },
      extra: { txt:'Escribirle', href: waCliente(s.clienteId, 'Hola ' + primer(nombreCliente(s.clienteId)) + ', ya estoy viendo lo de tu ' + sv.nombre + '.') }
    });
  });

  recargasPendientes().forEach(m => t.push({
    prio:3, tono:'ambar', icono:'saldo',
    titulo: nombreCliente(m.clienteId) + ' recargó ' + usd(m.monto),
    sub: 'Por ' + m.referencia + ' · revisá la captura en WhatsApp y acreditá',
    boton: { txt:'Acreditar', attr:`data-acreditar="${m.id}"` }
  }));

  /* Vencen hoy o mañana, y las que vencieron hace poco: las que más renuevan */
  directos(vencenEntre(-OP.graciaDias, 1))
    .sort((a, b) => { const da = diasRestantes(a), db = diasRestantes(b);
      return (da < 0) - (db < 0) || (da >= 0 ? da - db : db - da); })
    .forEach(s => {
    const sv = servicioDeSuscripcion(s) || servPorId('');
    const d = diasRestantes(s), yo = primer(nombreCliente(s.clienteId));
    const avisado = avisadoHoy(s.id);
    t.push({
      prio: avisado ? 9 : 4, tono:'ambar', icono:'reloj', hecho: avisado, quien: yo, sid: sv.id,
      titulo: d >= 0 ? 'A ' + yo + ' se le vence ' + sv.nombre + (d === 0 ? ' hoy' : ' mañana')
                     : 'A ' + yo + ' se le venció ' + sv.nombre + (d === -1 ? ' ayer' : ' hace ' + Math.abs(d) + ' días'),
      sub: avisado ? 'Ya le avisaste hoy · cuando te pague, tocá Ya pagó' : 'Avisale para que renueve con la misma clave',
      boton: avisado ? { txt:'Ya pagó', attr:`data-renovar="${s.id}"` }
                     : { txt:'Avisar', href: waCliente(s.clienteId, mensajeAviso(s)), attr:`data-avisar="${s.id}"` },
      extra: avisado ? null : { txt:'Ya pagó', attr:`data-renovar="${s.id}"` }
    });
  });

  /* Cuentas del proveedor que vencen en 5 días o menos y tienen gente adentro */
  DB.cuentasMadre.forEach(m => {
    const d = diasEntre(HOY, m.vence);
    const n = clientesEnMadre(m).length;
    if (d > 5 || !n) return;
    const sv = servPorId(m.servicioId);
    t.push({
      prio:5, tono: d < 0 ? 'rojo' : 'gris', icono:'renovar', sid: m.servicioId,
      titulo: d < 0 ? 'Tu ' + sv.nombre + ' del proveedor venció: renovalo ya'
                    : 'Renová tu ' + sv.nombre + ' con el proveedor antes del ' + fechaCorta(m.vence),
      sub: (m.proveedor || 'Sin proveedor') + ' · ' + n + (n === 1 ? ' cliente adentro' : ' clientes adentro'),
      boton: { txt:'Ya la renové', attr:`data-renovar-madre="${m.id}"` }
    });
  });

  paraLiberar().forEach(s => {
    const sv = servicioDeSuscripcion(s) || servPorId('');
    const a = accesoDe(s) || {};
    const c = cliente(s.clienteId);
    t.push({
      prio:6, tono:'gris', icono:'pantalla', quien: primer(c.nombre), sid: sv.id,
      titulo: primer(c.nombre) + ' no renovó ' + sv.nombre + (c.tipo === 'mayorista' ? ' (revendedor)' : ''),
      sub: 'Venció ' + comoFalta(s.vence).replace('venció ', '') + (a.pin ? ' · cambiale el PIN ' + a.pin + ' a ' + a.perfil : '') + ' y la pantalla queda para vender',
      boton: { txt:'Recuperar pantalla', attr:`data-liberar="${s.id}"` },
      extra: { txt:'Último aviso', href: waCliente(s.clienteId, mensajeAviso(s)) }
    });
  });

  CAT.forEach(x => {
    if (stockDisponible(x.id) > 0) return;
    const vivas = DB.suscripciones.filter(s => { const sv = servicioDeSuscripcion(s);
      return sv && sv.id === x.id && s.estado !== 'cancelada' && estadoSuscripcion(s) !== 'vencida'; }).length;
    if (!vivas) return;
    t.push({
      prio:7, tono:'gris', icono:'caja', sid: x.id,
      titulo: 'Te quedaste sin pantallas de ' + x.nombre,
      sub: 'Tenés ' + vivas + (vivas === 1 ? ' cliente' : ' clientes') + ' y nada para reponer si una se cae',
      boton: { txt:'Cargar cuenta', attr:`data-cajon="madre" data-sid="${x.id}"` }
    });
  });

  return t.sort((a, b) => a.prio - b.prio);
}

function tareaHTML(k){
  /* Un solo rojo fuerte por pantalla: solo lo urgente lleva el botón lleno */
  const clase = pri => !pri ? 'leve' : k.grupo ? 'fuerte' : k.prio <= 2 ? 'pri' : 'fuerte';
  const btn = (b, pri) => !b ? '' : b.href
    ? `<a class="acc ${clase(pri)}" href="${b.href}" target="_blank" rel="noopener" ${b.attr || ''}>${esc(b.txt)}</a>`
    : `<button class="acc ${clase(pri)}" ${b.attr}>${esc(b.txt)}</button>`;
  /* Si la tarea es de un servicio, se reconoce por su tarjeta antes de leer */
  const sv = k.sid && CAT.find(x => x.id === k.sid);
  const marca = sv && sv.card && !k.hecho
    ? `<span class="tarea-arte" style="background-image:url('${sv.card}')"><i>${ico(k.icono)}</i></span>`
    : `<span class="tarea-ico">${ico(k.hecho ? 'check' : k.icono)}</span>`;
  return `<li class="tarea t-${k.tono}${k.hecho ? ' hecha' : ''}">
    ${marca}
    <div class="tarea-txt">
      <b>${esc(k.titulo)}</b>
      <span>${esc(k.sub)}</span>
      ${k.nota ? `<em>${esc(k.nota)}</em>` : ''}
    </div>
    <div class="tarea-acc">${btn(k.extra, false)}${btn(k.boton, !k.hecho)}</div>
  </li>`;
}

/* Tres o más del mismo tipo se juntan en una línea que se abre al tocarla:
   siete avisos seguidos no son siete cosas distintas, es una tarea. */
const GRUPOS = {
  reloj:    n => ({ titulo: 'Avisale a ' + n + ' clientes que se les vence', sub: 'Cada aviso abre WhatsApp con el mensaje listo' }),
  pantalla: n => ({ titulo: n + ' clientes no renovaron', sub: 'Recuperá esas pantallas para volver a venderlas' })
};

/* La lista se lee por urgencia, no por tipo: qué no puede esperar, qué es
   de hoy y qué se hace cuando haya un rato. */
const SECCION = k => k.hecho ? ['ya', 'YA AVISADOS', 'esperando que paguen']
  : k.prio <= 2 ? ['urgente', 'AHORA', 'hay plata o un cliente esperando']
  : k.prio <= 4 ? ['hoy', 'HOY', 'antes de que termine el día']
  : ['luego', 'CUANDO PUEDAS', 'para que no se te junte'];

function bandeja(lista){
  const filas = [], hechos = {};
  let pendientes = 0, seccion = '';
  lista.forEach(k => {
    const hermanos = !k.hecho && GRUPOS[k.icono] ? lista.filter(x => x.icono === k.icono && !x.hecho) : [];
    const agrupa = hermanos.length >= 3;
    if (agrupa && hechos[k.icono]) return;
    const [clave, titulo, bajada] = SECCION(k);
    if (clave !== seccion){
      seccion = clave;
      filas.push(`<li class="tarea-sec s-${clave}"><b>${titulo}</b><span>${bajada}</span></li>`);
    }
    if (!agrupa){ filas.push(tareaHTML(k)); if (!k.hecho) pendientes++; return; }
    hechos[k.icono] = true; pendientes++;
    const g = GRUPOS[k.icono](hermanos.length), abierto = !!P.abiertos[k.icono];
    const nombres = hermanos.slice(0, 3).map(x => x.quien).join(', ') + (hermanos.length > 3 ? ' y ' + (hermanos.length - 3) + ' más' : '');
    filas.push(tareaHTML({ grupo: true, prio: k.prio, tono: k.tono, icono: k.icono, titulo: g.titulo, sub: nombres + ' · ' + g.sub,
      boton: { txt: abierto ? 'Cerrar' : 'Ver los ' + hermanos.length, attr: `data-abrir-grupo="${k.icono}"` } }) +
      (abierto ? `<li class="tarea-grupo"><ul class="tareas">${hermanos.map(tareaHTML).join('')}</ul></li>` : ''));
  });
  return { html: filas.join(''), pendientes };
}

/* Buscar es lo primero que se necesita cuando alguien escribe por WhatsApp */
function resultadosBusqueda(){
  const q = P.busca.trim().toLowerCase(), qd = q.replace(/\D/g, '');
  const clis = DB.clientes.filter(c => c.nombre.toLowerCase().includes(q) ||
    (qd.length >= 3 && c.whatsapp.includes(qd))).slice(0, 8);
  const peds = DB.pedidos.filter(p => p.id.toLowerCase().includes(q)).slice(0, 5);
  if (!clis.length && !peds.length)
    return `<div class="vacio"><b>Nada con "${esc(P.busca)}"</b>Probá con otra parte del nombre o del número.</div>`;
  return `<ul class="lista-cli-p">
    ${peds.map(p => {
      const it = p.items[0], sv = servPorId(it.servicioId);
      const pendiente = pedidosPendientes().includes(p);
      return `<li><button class="cli-fila" ${pendiente ? `data-entregar="${p.id}"` : p.clienteId ? `data-cliente-ver="${p.clienteId}"` : ''}>
        <span class="avatar">${ico('pago')}</span>
        <span class="cli-txt"><b>Pedido ${esc(p.id)}</b><span>${esc(sv.nombre)} · ${usd(p.total)} · ${p.clienteId ? esc(nombreCliente(p.clienteId)) : 'llegó por la web'}</span></span>
        <span class="cli-estado">${pendiente ? '<i class="tono-rojo">por entregar</i>' : esc(p.estado)}</span>
      </button></li>`;
    }).join('')}
    ${clis.map(filaCliente).join('')}
  </ul>`;
}

/* ── el costado: lo que se mira de reojo ── */

/* Plata del mes: la ganancia como porción de lo vendido */
function ladoPlata(){
  const r = resumenDinero();
  const pct = r.ingreso > 0 ? Math.max(0, Math.min(100, Math.round(100 * r.margen / r.ingreso))) : 0;
  return `<section class="lado-caja">
    <header><u>ESTE MES</u><button data-ir="plata">ver plata →</button></header>
    <div class="lado-cifra"><b>${usd(r.ingreso)}</b><span>vendido en ${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas'}</span></div>
    <div class="lado-barra"><i style="width:${pct}%"></i></div>
    <p><b>${usd(r.margen)}</b> te quedan de ganancia · ${pct}%</p>
  </section>`;
}

/* Pantallas libres: una barra por servicio, con su color */
function ladoStock(){
  return `<section class="lado-caja">
    <header><u>PANTALLAS PARA VENDER</u><button data-ir="cuentas">mis cuentas →</button></header>
    <ul class="medidores">${CAT.map(x => {
      const total = madresVivas(x.id).reduce((t, m) => t + m.capacidad, 0);
      const libres = stockDisponible(x.id);
      const pct = total ? Math.round(100 * libres / total) : 0;
      return `<li class="${libres ? '' : 'cero'}">
        <span>${esc(x.nombre)}</span>
        <div class="medidor"><i style="width:${pct}%;background:${x.color}"></i></div>
        ${libres ? `<b>${libres}</b>` : `<button data-cajon="madre" data-sid="${x.id}">cargar</button>`}
      </li>`;
    }).join('')}</ul>
  </section>`;
}

/* Los próximos 7 días: cuántos clientes vencen cada día */
function ladoSemana(){
  const dias = Array.from({ length: 7 }, (_, i) => {
    const f = masDias(HOY, i);
    return { f, n: directos(vencenEntre(i, i)).length };
  });
  const tope = Math.max(1, ...dias.map(d => d.n));
  const total = dias.reduce((t, d) => t + d.n, 0);
  return `<section class="lado-caja">
    <header><u>VENCEN ESTA SEMANA</u><button data-ir="clientes" data-filtro-ir="semana">ver ${total} →</button></header>
    <ol class="semana">${dias.map((d, i) => `
      <li class="${i === 0 ? 'hoy' : ''}${d.n ? '' : ' nada'}" title="${d.n} ${d.n === 1 ? 'cliente' : 'clientes'}">
        <b>${d.n || ''}</b>
        <i style="height:${d.n ? 14 + Math.round(46 * d.n / tope) : 4}px"></i>
        <span>${i === 0 ? 'hoy' : 'DLMMJVS'[d.f.getDay()]}</span>
        <em>${d.f.getDate()}</em>
      </li>`).join('')}</ol>
  </section>`;
}

function vistaHoy(){
  if (!DB.cuentasMadre.length && !DB.suscripciones.length) return vistaPrimerosPasos();
  const lista = tareas();
  const b = bandeja(lista), n = b.pendientes;
  const fecha = HOY.toLocaleDateString('es-VE', { weekday:'long', day:'numeric', month:'long' });

  return `<div class="tablero">
  <div class="tablero-main">
    <header class="hero-hoy${n ? '' : ' listo'}">
      <span class="hero-num">${n || ico('check')}</span>
      <div>
        <span class="kicker">${esc(fecha.toUpperCase())}</span>
        <h1>${n ? (n === 1 ? 'cosa para hacer hoy' : 'cosas para hacer hoy') : 'Todo al día'}</h1>
      </div>
    </header>
    <label class="buscar">${ico('lupa')}<input id="pBusca" placeholder="Buscar cliente, teléfono o pedido SV-…" value="${esc(P.busca)}" autocomplete="off"></label>

    ${P.busca.trim() ? resultadosBusqueda()
      : lista.length ? `<ul class="tareas">${b.html}</ul>`
      : `<div class="al-dia"><b>No hay nada pendiente</b><span>Cuando alguien pague, se le venza algo o algo no ande, te aparece acá.</span></div>`}
  </div>

  <aside class="tablero-lado">
    ${ladoPlata()}
    ${ladoStock()}
    ${ladoSemana()}
  </aside>
  </div>`;
}

/* ═══ CLIENTES ══════════════════════════════════════════════════ */

/* El estado de un cliente es el de su acceso que vence primero */
function resumenCliente(c){
  const ss = suscripcionesDe(c.id).filter(s => s.estado !== 'cancelada');
  const vivas = ss.filter(s => estadoSuscripcion(s) !== 'vencida').sort((a, b) => aFecha(a.vence) - aFecha(b.vence));
  const prox = vivas[0];
  return { ss, vivas, prox, dias: prox ? diasRestantes(prox) : null, vencidas: ss.length - vivas.length };
}

function filaCliente(c){
  const r = resumenCliente(c);
  const servicios = [...new Set(r.vivas.map(s => (servicioDeSuscripcion(s) || {}).nombre).filter(Boolean))];
  /* El revendedor avisa a los suyos: acá solo importa cuántas se le vencen */
  const pronto = r.vivas.filter(s => diasRestantes(s) <= OP.avisarDiasAntes).length;
  const estado = c.tipo === 'mayorista'
    ? (pronto ? `<i class="tono-ambar">${pronto} por vencer</i>` : '<i>al día</i>')
    : r.prox
    ? `<i class="${r.dias <= OP.avisarDiasAntes ? 'tono-ambar' : ''}">${esc(comoFalta(r.prox.vence))}</i>`
    : r.vencidas ? '<i class="tono-rojo">vencido</i>' : '<i>sin cuentas</i>';
  const detalle = c.tipo === 'mayorista'
    ? 'Revendedor · ' + r.vivas.length + ' unidades · saldo ' + usd(saldoDe(c.id))
    : (r.vivas.length ? r.vivas.length + (r.vivas.length === 1 ? ' cuenta' : ' cuentas') + ' · ' + servicios.join(', ') : '+' + c.whatsapp);
  return `<li><button class="cli-fila" data-cliente-ver="${c.id}">
    <span class="avatar${c.tipo === 'mayorista' ? ' mayor' : ''}">${esc(iniciales(c.nombre))}</span>
    <span class="cli-txt"><b>${esc(c.nombre)}</b><span>${esc(detalle)}</span></span>
    <span class="cli-estado">${estado}</span>
  </button></li>`;
}

function vistaClientes(){
  const filtros = [['todos','TODOS'],['semana','VENCEN ESTA SEMANA'],['vencidos','VENCIDOS'],['revendedores','REVENDEDORES']];
  let lista = DB.clientes.slice();
  if (P.busca.trim()){
    const q = P.busca.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    lista = lista.filter(c => c.nombre.toLowerCase().includes(q) || (qd.length >= 3 && c.whatsapp.includes(qd)));
  }
  const R = new Map(lista.map(c => [c.id, resumenCliente(c)]));
  if (P.filtro === 'semana') lista = lista.filter(c => { const r = R.get(c.id); return r.prox && r.dias <= 7; });
  if (P.filtro === 'vencidos') lista = lista.filter(c => { const r = R.get(c.id); return !r.vivas.length && r.vencidas; });
  if (P.filtro === 'revendedores') lista = lista.filter(c => c.tipo === 'mayorista');
  /* Lo que vence primero, arriba; los vencidos y los sin cuentas después, y
     los revendedores al final (tienen su propio panel) */
  const peso = c => { const r = R.get(c.id);
    return (c.tipo === 'mayorista' ? 1e5 : 0) + (r.prox ? r.dias : r.vencidas ? 1e4 : 2e4); };
  lista.sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre));

  return `
  <div class="bloque angosto">
    <div class="bloque-tit"><h2>Clientes</h2><span>${lista.length} de ${DB.clientes.length}</span></div>
    <div class="herram">
      <label class="buscar chico">${ico('lupa')}<input id="pBusca" placeholder="Nombre o teléfono…" value="${esc(P.busca)}" autocomplete="off"></label>
      <div class="filtros">${filtros.map(([k, t]) => `<button data-filtro="${k}" aria-pressed="${P.filtro === k}">${t}</button>`).join('')}</div>
    </div>
    ${lista.length ? `<ul class="lista-cli-p">${lista.map(filaCliente).join('')}</ul>` : vacio('Nadie con ese filtro')}
  </div>`;
}

/* La ficha del cliente: todo lo suyo y lo que se le puede hacer */
function cajonCliente(){
  const c = DB.clientes.find(x => x.id === P.cajon.id);
  if (!c) return '';
  const r = resumenCliente(c);
  /* Las activas arriba (la que vence primero, primera); las vencidas al final */
  const ss = r.vivas.concat(r.ss.filter(s => !r.vivas.includes(s))
    .sort((a, b) => aFecha(b.vence) - aFecha(a.vence)));
  const hist = historialDe(c.id).slice(0, 6);
  return cajonHTML(c.nombre, `
    <div class="ficha-cli">
      <span class="avatar grande${c.tipo === 'mayorista' ? ' mayor' : ''}">${esc(iniciales(c.nombre))}</span>
      <div><b>+${esc(c.whatsapp)}</b><span>${c.tipo === 'mayorista' ? 'Revendedor · saldo ' + usd(saldoDe(c.id)) : 'Cliente' + (c.creado ? ' desde el ' + fechaCorta(c.creado) : '')}</span></div>
    </div>
    <div class="ficha-acc">
      <a class="acc" target="_blank" rel="noopener" href="${waLink('Hola ' + primer(c.nombre) + ', ', c.whatsapp)}">WHATSAPP</a>
      <a class="acc" target="_blank" rel="noopener" href="${waLink('Hola ' + primer(c.nombre) + ', este es tu link de StreamVe: ahí ves tus cuentas, cuándo vencen y renovás.\n' + linkPortal(c), c.whatsapp)}">MANDAR SU LINK</a>
      <a class="acc" target="_blank" rel="noopener" href="cuenta.html?c=${encodeURIComponent(c.codigoAcceso)}">VER SU PORTAL</a>
    </div>

    <h4>${c.tipo === 'mayorista' ? 'SUS UNIDADES' : 'SUS CUENTAS'}</h4>
    ${ss.length ? ss.map(s => {
      const sv = servicioDeSuscripcion(s) || servPorId('');
      const a = accesoDe(s) || {};
      const e = estadoSuscripcion(s);
      return `<div class="susc-ficha">
        <div class="susc-cab">${punto(sv.id)}<b>${esc(sv.nombre)}</b><span>${esc(etiquetaPlan(sv.id, s.planClave))}${s.meses === 12 ? ' · 12 meses' : ''}</span>${chipEstado(e)}</div>
        ${barraTiempo(s)}
        <div class="sub">${a.perfil ? esc(a.perfil) + (a.pin ? ' · PIN ' + esc(a.pin) : '') + ' · ' + esc(a.correo) : 'Sin pantalla asignada'}</div>
        <div class="susc-acc">
          ${a.perfil ? `<button class="acc" data-acceso="${s.id}">MANDAR ACCESO</button>` : ''}
          <button class="acc" data-renovar="${s.id}">YA PAGÓ · RENOVAR</button>
          ${e !== 'vencida' ? `<button class="acc" data-reponer="${s.id}">NO LE FUNCIONA</button>` : ''}
          ${e === 'vencida' && diasRestantes(s) < -OP.graciaDias ? `<button class="acc" data-liberar="${s.id}">RECUPERAR PANTALLA</button>` : ''}
        </div>
      </div>`;
    }).join('') : '<p class="cajon-nota">Todavía no tiene cuentas.</p>'}

    ${hist.length ? `<h4>HISTORIAL</h4>
    <ul class="hist-ficha">${hist.map(ev => `<li><span>${esc(fechaCorta(ev.fecha))}</span><b>${esc(ev.texto)}</b>${ev.monto != null ? `<em>${usd(ev.monto)}</em>` : ''}</li>`).join('')}</ul>` : ''}
  `, `<button class="acc pri grande" data-cajon="venta" data-cliente="${c.id}">+ VENDERLE OTRA</button>`);
}

/* ═══ MIS CUENTAS (las del proveedor) ═══════════════════════════ */

function vistaCuentas(){
  const grupos = CAT.map(x => ({ x, madres: DB.cuentasMadre.filter(m => m.servicioId === x.id)
    .sort((a, b) => aFecha(a.vence) - aFecha(b.vence)) }));
  const total = DB.cuentasMadre.reduce((t, m) => t + m.costo, 0);

  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Mis cuentas</h2><span>las que le compraste al proveedor · ${DB.cuentasMadre.length} · ${usd(total)}</span>
      <button class="acc pri der-btn" data-cajon="madre">+ CARGAR CUENTA</button></div>
    ${grupos.map(({ x, madres }) => {
      const cap = madres.reduce((t, m) => t + m.capacidad, 0);
      const libres = stockDisponible(x.id);
      if (!madres.length) return `
      <div class="grupo vacio-g">
        <div class="grupo-tit">${punto(x.id)}<b>${esc(x.nombre)}</b><span>no tenés cuentas</span>
          <button class="acc leve" data-cajon="madre" data-sid="${x.id}">CARGAR</button></div>
      </div>`;
      /* Cerrado por defecto; se abre solo si hay algo que renovar pronto */
      const urgente = madres.some(m => diasEntre(HOY, m.vence) <= 5 && clientesEnMadre(m).length);
      const clave = 'g-' + x.id;
      const abierto = P.abiertos[clave] !== undefined ? P.abiertos[clave] : urgente;
      return `
      <div class="grupo${abierto ? ' abierto' : ''}">
        <div class="grupo-tit">${punto(x.id)}<b>${esc(x.nombre)}</b>
          <span><b class="${libres ? '' : 'tono-rojo'}">${libres} libres</b> de ${cap} pantallas${urgente ? ' · <b class="tono-ambar">renovar pronto</b>' : ''}</span>
          <button class="acc leve" data-abrir-grupo="${clave}" data-actual="${abierto ? 1 : 0}">${abierto ? 'CERRAR' : 'VER ' + madres.length + (madres.length === 1 ? ' CUENTA' : ' CUENTAS')}</button>
          <button class="acc leve" data-cajon="madre" data-sid="${x.id}">+ OTRA</button></div>
        ${abierto ? `<div class="tabla-cont"><table class="t">
          <thead><tr><th>Proveedor</th><th>Pantallas</th><th>Vence</th><th>Costo</th><th></th></tr></thead>
          <tbody>${madres.map(m => {
            const d = diasEntre(HOY, m.vence);
            const adentro = clientesEnMadre(m);
            const despues = adentro.filter(s => aFecha(s.vence) > aFecha(m.vence)).length;
            return `<tr>
              <td><span class="prin">${esc(m.proveedor || 'Sin proveedor')}</span><div class="sub">${esc(m.correo)}</div></td>
              <td>${barraCapacidad(m)}</td>
              <td><span class="chip-e ${d < 0 ? 'e-vencida' : d <= 5 ? 'e-porVencer' : 'e-neutro'}">${comoFalta(m.vence)}</span>
                ${despues ? `<div class="sub tono-ambar">renovala antes del ${fechaCorta(m.vence)}: ${despues} ${despues === 1 ? 'cliente sigue' : 'clientes siguen'} después</div>` : ''}</td>
              <td class="num">${usd(m.costo)}<div class="sub">${usd(m.costo / m.capacidad)} por pantalla</div></td>
              <td class="acciones">
                <button class="acc" data-copiar="${esc(m.correo + '\n' + m.clave)}">COPIAR ACCESO</button>
                <button class="acc ${despues || d <= 5 ? 'pri' : ''}" data-renovar-madre="${m.id}">YA LA RENOVÉ</button>
              </td>
            </tr>`;
          }).join('')}</tbody></table></div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/* ═══ PLATA ═════════════════════════════════════════════════════ */

function vistaPlata(){
  const r = resumenDinero();
  const vivas = DB.suscripciones.filter(s => s.estado !== 'cancelada' && estadoSuscripcion(s) !== 'vencida');
  const recurrente = vivas.reduce((t, s) => t + s.precio / (s.meses || 1), 0);
  const margenMes  = vivas.reduce((t, s) => t + margenDe(s), 0);

  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Plata</h2><span>${HOY.toLocaleDateString('es-VE', { month:'long', year:'numeric' })}</span></div>
    <div class="plata" style="margin-top:16px">
      <div><u>VENDISTE ESTE MES</u><b>${usd(r.ingreso)}</b><span>${r.ventas} ${r.ventas === 1 ? 'venta' : 'ventas y renovaciones'}</span></div>
      <div class="verde"><u>TE QUEDÓ DE GANANCIA</u><b>${usd(r.margen)}</b><span>después de pagar las cuentas</span></div>
      <div><u>COBRÁS CADA MES</u><b>${usd(recurrente)}</b><span>${vivas.length} pantallas activas · ${usd(margenMes)} de ganancia</span></div>
      <div><u>PUESTO EN CUENTAS</u><b>${usd(r.costoMadres)}</b><span>${DB.cuentasMadre.length} cuentas del proveedor</span></div>
    </div>
  </div>

  <div class="bloque">
    <div class="bloque-tit"><h2>Por servicio</h2><span>dónde está la ganancia de verdad</span></div>
    <div class="tabla-cont"><table class="t">
      <thead><tr><th>Servicio</th><th>Activas</th><th>Cobrás al mes</th><th>Ganás al mes</th><th>Por pantalla</th><th>Libres</th></tr></thead>
      <tbody>${CAT.map(x => {
        const ss = vivas.filter(s => { const sv = servicioDeSuscripcion(s); return sv && sv.id === x.id; });
        const fac = ss.reduce((t, s) => t + s.precio / (s.meses || 1), 0);
        const mg  = ss.reduce((t, s) => t + margenDe(s), 0);
        const libre = stockDisponible(x.id);
        return `<tr>
          <td><span class="prin">${punto(x.id)}${esc(x.nombre)}</span></td>
          <td class="num">${ss.length}</td>
          <td class="num">${usd(fac)}</td>
          <td class="num" style="color:${mg > 0 ? 'var(--vive)' : mg < 0 ? 'var(--muere)' : 'inherit'}">${usd(mg)}</td>
          <td class="num">${usd(ss.length ? mg / ss.length : 0)}</td>
          <td class="num"><span class="chip-e ${libre === 0 ? 'e-vencida' : libre <= 3 ? 'e-porVencer' : 'e-activa'}">${libre}</span></td>
        </tr>`;
      }).join('')}</tbody></table></div>
  </div>`;
}

/* ═══ cajones: + VENTA, MANDAR ACCESO, CARGAR CUENTA, FICHA ═════ */

function cajonVenta(){
  const v = P.venta;
  const ped = v.pedido && DB.pedidos.find(p => p.id === v.pedido);
  if (ped){ const it = ped.items[0]; v.sid = it.servicioId; v.planK = it.planClave; v.meses = it.meses || 1; }
  const x = servPorId(v.sid);
  const pl = planDe(v.sid, v.planK);
  const total = precioVenta(pl, v.meses);
  const st = stockPlan(v.sid, pl.k);
  const q = v.busca.toLowerCase();
  const encontrados = v.modo === 'existe'
    ? DB.clientes.filter(c => !q || c.nombre.toLowerCase().includes(q) || c.whatsapp.includes(q)).slice(0, 6) : [];
  const elegido = v.clienteId && DB.clientes.find(c => c.id === v.clienteId);

  return cajonHTML(ped ? 'Entregar ' + ped.id : 'Nueva venta', `
    ${ped ? `<p class="cajon-nota">Llegó por la tienda. Fijate en WhatsApp que haya mandado la captura del pago y decí de quién es.</p>` : ''}
    <div class="seg2">
      <button data-v-modo="nuevo" aria-pressed="${v.modo === 'nuevo'}">CLIENTE NUEVO</button>
      <button data-v-modo="existe" aria-pressed="${v.modo === 'existe'}">YA ES CLIENTE</button>
    </div>
    ${v.modo === 'nuevo' ? `
      <div class="campos">
        <label>Nombre<input id="vNombre" value="${esc(v.nombre)}" placeholder="Como lo tenés en WhatsApp" autocomplete="off"></label>
        <label>WhatsApp<input id="vWa" value="${esc(v.wa)}" placeholder="0414 123 4567" inputmode="tel" autocomplete="off"></label>
      </div>` : `
      <div class="campos">
        <label>Buscar<input id="vBusca" value="${esc(v.busca)}" placeholder="Nombre o teléfono" autocomplete="off"></label>
      </div>
      <div class="lista-cli">${encontrados.map(c => `
        <button data-v-cliente="${c.id}" aria-pressed="${v.clienteId === c.id}">
          <b>${esc(c.nombre)}</b><span>+${esc(c.whatsapp)} · ${suscripcionesDe(c.id).length} cuentas</span>
        </button>`).join('') || '<p class="sub">Nadie con ese nombre.</p>'}</div>`}

    ${ped ? '' : `<h4>QUÉ SE LLEVA</h4>
    <div class="servs">${CAT.map(s => { const n = stockDisponible(s.id); return `
      <button data-v-sid="${s.id}" aria-pressed="${v.sid === s.id}" ${n ? '' : 'disabled'}>
        ${punto(s.id)}<b>${esc(s.nombre)}</b><span>${n ? n + ' libres' : 'agotado'}</span>
      </button>`; }).join('')}</div>

    <div class="opciones">${x.planes.map(p => `
      <button data-v-plan="${p.k}" aria-pressed="${pl.k === p.k}" ${stockPlan(v.sid, p.k) ? '' : 'disabled'}>
        <b>${esc(p.etq)}</b><span>${usd(p.precio)}/mes</span>
      </button>`).join('')}</div>

    <h4>POR CUÁNTO TIEMPO Y CÓMO PAGÓ</h4>
    <div class="opciones">
      <button data-v-meses="1" aria-pressed="${v.meses === 1}"><b>1 mes</b></button>
      <button data-v-meses="12" aria-pressed="${v.meses === 12}"><b>12 meses</b><span>−${Math.round(CFG.descuentoAnual * 100)}%</span></button>
    </div>
    <div class="opciones">
      ${[['binance','Binance'],['pagoMovil','Pago Móvil'],['otro','Otro']].map(([k, t]) =>
        `<button data-v-metodo="${k}" aria-pressed="${v.metodo === k}"><b>${t}</b></button>`).join('')}
    </div>`}
  `, `
    <div class="pie-total"><b>${usd(total)}</b><span>${esc(x.nombre)} · ${esc(pl.etq)} · ${v.meses === 12 ? '12 meses' : '1 mes'}${v.modo === 'existe' && elegido ? ' · ' + esc(primer(elegido.nombre)) : ''}</span></div>
    <button class="acc pri grande" data-registrar="1" ${st ? '' : 'disabled'}>${ped ? 'ENTREGAR' : 'REGISTRAR VENTA'}</button>
  `);
}

function cajonAcceso(){
  const s = DB.suscripciones.find(x => x.id === P.cajon.sid);
  if (!s) return '';
  const c = cliente(s.clienteId);
  const msg = mensajeAcceso(s);
  return cajonHTML(P.cajon.titulo || 'Mandale el acceso', `
    <p class="cajon-nota">${esc(P.cajon.nota || 'Así le llega a ' + primer(c.nombre) + '. Revisalo y mandalo.')}</p>
    <div class="chat"><div class="chat-burbuja">${burbujaHTML(msg)}</div></div>
    <div class="link-portal">
      <span>Su link</span><b>${esc(linkPortal(c).replace('https://', ''))}</b>
      <button class="copiar" data-copiar="${esc(linkPortal(c))}">COPIAR</button>
    </div>
  `, `
    <button class="acc" data-copiar="${esc(msg)}">COPIAR MENSAJE</button>
    <a class="btn-wa compacto" target="_blank" rel="noopener" data-cerrar-cajon="1" href="${waLink(msg, c.whatsapp)}">${ICONO_WA}<span>MANDAR POR WHATSAPP</span></a>
  `);
}

function cajonMadre(){
  const m = P.madre;
  const x = servPorId(m.sid);
  const pl = x.planes[0];
  const porPerfil = m.costo && m.capacidad ? +m.costo / +m.capacidad : 0;
  const proveedores = [...new Set(DB.cuentasMadre.map(c => c.proveedor).filter(Boolean))].sort();
  return cajonHTML('Cargar cuenta del proveedor', `
    <p class="cajon-nota">La cuenta que le compraste al proveedor. Cada pantalla que tenga queda lista para vender.</p>
    <h4>DE QUÉ ES</h4>
    <div class="servs">${CAT.map(s => `
      <button data-m-sid="${s.id}" aria-pressed="${m.sid === s.id}">${punto(s.id)}<b>${esc(s.nombre)}</b><span>${stockDisponible(s.id)} libres</span></button>`).join('')}</div>
    <div class="campos">
      <label>Correo de la cuenta<input id="mCorreo" value="${esc(m.correo)}" placeholder="cuenta@correo.com" autocomplete="off"></label>
      <label>Clave de la cuenta<input id="mClave" value="${esc(m.clave)}" autocomplete="off"></label>
      <div class="campos-2">
        <label>Pantallas<input id="mCap" type="number" min="1" max="8" value="${esc(m.capacidad)}"></label>
        <label>Te costó $<input id="mCosto" type="number" min="0" step="0.01" value="${esc(m.costo)}" placeholder="11.00"></label>
      </div>
      <label>Proveedor<input id="mProv" value="${esc(m.proveedor)}" list="provs" placeholder="VirtuMall · TANCHI TV" autocomplete="off"></label>
      <datalist id="provs">${proveedores.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
      <label>Vence el<input id="mVence" type="date" value="${esc(m.vence || dia(masDias(HOY, OP.diasPorMes)))}"></label>
    </div>
  `, `
    <div class="pie-total">
      <b>${porPerfil ? usd(porPerfil) : '—'}</b>
      <span>te cuesta cada pantalla${porPerfil ? ` · ganás ${usd(pl.precio - porPerfil)} por venta${pl.precioMayorista != null ? ', ' + usd(pl.precioMayorista - porPerfil) + ' al revendedor' : ''}` : ''}</span>
    </div>
    <button class="acc pri grande" data-guardar-madre="1">GUARDAR CUENTA</button>
  `);
}

function pintarCajon(){
  const el = document.getElementById('pCajon');
  const t = P.cajon && P.cajon.tipo;
  el.innerHTML = t === 'venta' ? cajonVenta() : t === 'acceso' ? cajonAcceso()
               : t === 'madre' ? cajonMadre() : t === 'cliente' ? cajonCliente() : '';
  document.body.classList.toggle('con-cajon', !!t);
}
function abrirCajon(c){ P.cajon = c; pintarCajon(); document.querySelector('.cajon-cuerpo')?.scrollTo(0, 0); }
function cerrarCajon(){ P.cajon = null; pintarCajon(); }

/* ═══ render y eventos ══════════════════════════════════════════ */

function pintar(){
  const n = DB.cuentasMadre.length || DB.suscripciones.length ? bandeja(tareas()).pendientes : 0;
  document.getElementById('pNav').innerHTML = VISTAS.map(([k, t]) =>
    `<button data-ir="${k}" aria-pressed="${P.vista === k}">${t}${k === 'hoy' && n ? `<i>${n}</i>` : ''}</button>`).join('');

  const main = document.getElementById('pMain');
  main.innerHTML =
      P.vista === 'clientes' ? vistaClientes()
    : P.vista === 'cuentas'  ? vistaCuentas()
    : P.vista === 'plata'    ? vistaPlata()
    : vistaHoy();
  etiquetarTablas(main);

  document.getElementById('pFecha').textContent =
    HOY.toLocaleDateString('es-VE', { weekday:'long', day:'numeric', month:'long' });
}

/* Todo lo que cambia datos repinta la vista y, si hay cajón, el cajón */
const repintar = () => { pintar(); if (P.cajon) pintarCajon(); };

/* Corre una acción contra la base (o la demo): botón ocupado mientras
   tanto, aviso si falla, y repinta con lo que quedó guardado. */
async function hacer(boton, tarea, alTerminar){
  const r = await ocupado(boton, tarea);
  if (!r || !r.ok){ aviso((r && r.motivo) || 'No se pudo', 'error'); return null; }
  repintar();
  if (alTerminar) alTerminar(r);
  return r;
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-abrir-grupo],[data-avisar],[data-cliente-ver],[data-liberar],[data-descartar],[data-ir],[data-filtro],[data-reponer],[data-entregar],[data-renovar],[data-renovar-madre],[data-acreditar],[data-acceso],[data-cajon],[data-cerrar-cajon],[data-v-modo],[data-v-cliente],[data-v-sid],[data-v-plan],[data-v-meses],[data-v-metodo],[data-registrar],[data-m-sid],[data-guardar-madre]');
  if (!t) return;
  const d = t.dataset;

  if (d.ir){
    P.vista = d.ir; P.busca = ''; P.filtro = d.filtroIr || 'todos';
    window.scrollTo(0, 0); return pintar();
  }
  if (d.filtro){ P.filtro = d.filtro; return pintar(); }
  if (d.abrirGrupo){
    /* data-actual: los grupos que arrancan abiertos solos todavía no están en P.abiertos */
    P.abiertos[d.abrirGrupo] = d.actual !== undefined ? d.actual !== '1' : !P.abiertos[d.abrirGrupo];
    return pintar();
  }
  /* El link de WhatsApp se abre igual; acá solo se anota que ya se avisó */
  if (d.avisar){ marcarAvisado(d.avisar); setTimeout(repintar, 300); return; }
  if (d.clienteVer) return abrirCajon({ tipo:'cliente', id:d.clienteVer });

  if (d.entregar){
    const ped = DB.pedidos.find(x => x.id === d.entregar);
    /* Sin cliente (vino de la tienda): primero hay que decir de quién es */
    if (!ped.clienteId){
      P.venta = Object.assign(P.venta, { pedido:ped.id, modo:'nuevo', clienteId:null, nombre:'', wa:'', busca:'' });
      return abrirCajon({ tipo:'venta' });
    }
    return hacer(t, () => ACC.entregarPedido(ped.id), r =>
      abrirCajon({ tipo:'acceso', sid:r.suscripciones[0].id, titulo:'Pedido ' + ped.id + ' entregado' }));
  }
  if (d.descartar) return hacer(t, () => ACC.descartarPedido(d.descartar), () => aviso('Pedido descartado'));
  if (d.reponer) return hacer(t, () => ACC.reponer(d.reponer, 'Reportado desde el panel'), () =>
    abrirCajon({ tipo:'acceso', sid:d.reponer, titulo:'Le diste otra pantalla',
      nota:'Pantalla nueva, misma fecha de vencimiento. Mandale el acceso nuevo.' }));
  if (d.renovar) return hacer(t, () => ACC.renovar(d.renovar, 1), r =>
    aviso('Renovado hasta el ' + fechaCorta(r.vence) + ' · ' + usd(r.precio)));
  if (d.renovarMadre) return hacer(t, () => ACC.renovarMadre(d.renovarMadre), r =>
    aviso('Cuenta renovada hasta el ' + fechaCorta(r.vence)));
  if (d.acreditar) return hacer(t, () => ACC.acreditarRecarga(d.acreditar), r =>
    aviso(usd(r.movimiento.monto) + ' acreditados a ' + nombreCliente(r.movimiento.clienteId)));
  if (d.liberar) return hacer(t, () => ACC.liberar(d.liberar), () =>
    aviso('La pantalla quedó libre. Cambiale el PIN antes de venderla.'));
  if (d.acceso) return abrirCajon({ tipo:'acceso', sid:d.acceso });

  if (d.cajon === 'venta'){
    P.venta = Object.assign(P.venta, { pedido:null }, d.cliente
      ? { modo:'existe', clienteId:d.cliente, busca:nombreCliente(d.cliente) }
      : { modo:'nuevo', clienteId:null, nombre:'', wa:'', busca:'' });
    return abrirCajon({ tipo:'venta' });
  }
  if (d.cajon === 'madre'){
    const sid = d.sid || P.madre.sid;
    P.madre = { sid, correo:'', clave:'', capacidad:CAPACIDAD_TIPICA[sid] || 4, costo:'', proveedor:'', vence:'' };
    return abrirCajon({ tipo:'madre' });
  }
  if (d.cerrarCajon !== undefined){ if (t.tagName !== 'A') e.preventDefault(); return cerrarCajon(); }

  /* dentro del cajón de venta */
  if (d.vModo){ P.venta.modo = d.vModo; return pintarCajon(); }
  if (d.vCliente){ P.venta.clienteId = d.vCliente; return pintarCajon(); }
  if (d.vSid){ const x = servPorId(d.vSid); P.venta.sid = x.id;
    P.venta.planK = (x.planes.find(p => stockPlan(x.id, p.k) > 0) || x.planes[0]).k; return pintarCajon(); }
  if (d.vPlan){ P.venta.planK = d.vPlan; return pintarCajon(); }
  if (d.vMeses){ P.venta.meses = +d.vMeses; return pintarCajon(); }
  if (d.vMetodo){ P.venta.metodo = d.vMetodo; return pintarCajon(); }
  if (d.registrar){
    const v = P.venta;
    if (v.modo === 'existe' && !v.clienteId) return aviso('Elegí el cliente', 'error');
    if (v.pedido){
      const pid = v.pedido;
      return hacer(t, async () => {
        let cli = v.clienteId;
        if (v.modo === 'nuevo'){
          const c = await ACC.crearCliente(v.nombre, v.wa);
          if (!c.ok) return c;
          cli = c.cliente.id;
        }
        return ACC.entregarPedido(pid, cli);
      }, r => {
        P.venta.pedido = null; P.venta.nombre = ''; P.venta.wa = '';
        abrirCajon({ tipo:'acceso', sid:r.suscripciones[0].id, titulo:'Pedido ' + pid + ' entregado' });
      });
    }
    return hacer(t, () => ACC.registrarVenta(v.modo === 'existe'
      ? { clienteId:v.clienteId, servicioId:v.sid, planClave:v.planK, meses:v.meses, metodoPago:v.metodo }
      : { nombre:v.nombre, whatsapp:v.wa, servicioId:v.sid, planClave:v.planK, meses:v.meses, metodoPago:v.metodo }),
      r => { P.venta.nombre = ''; P.venta.wa = '';
             abrirCajon({ tipo:'acceso', sid:r.suscripcion.id, titulo:'Venta registrada' }); });
  }

  /* dentro del cajón de cuenta del proveedor */
  if (d.mSid){ P.madre.sid = d.mSid; P.madre.capacidad = CAPACIDAD_TIPICA[d.mSid] || 4; return pintarCajon(); }
  if (d.guardarMadre){
    const m = P.madre;
    return hacer(t, () => ACC.agregarCuentaMadre({ servicioId:m.sid, correo:m.correo, clave:m.clave,
        capacidad:m.capacidad, costo:m.costo, proveedor:m.proveedor, vence:m.vence }),
      r => { aviso(servPorId(m.sid).nombre + ': ' + r.madre.capacidad + ' pantallas nuevas para vender'); cerrarCajon(); });
  }
});

/* Lo que se escribe en el cajón se guarda sin repintar, para no perder
   el foco; solo las búsquedas repintan su lista. */
const CAMPOS = { vNombre:['venta','nombre'], vWa:['venta','wa'], mCorreo:['madre','correo'], mClave:['madre','clave'],
                 mCap:['madre','capacidad'], mCosto:['madre','costo'], mProv:['madre','proveedor'], mVence:['madre','vence'] };
document.addEventListener('input', e => {
  const id = e.target.id;
  if (CAMPOS[id]){
    const [obj, k] = CAMPOS[id];
    P[obj][k] = e.target.value;
    if (obj === 'madre' && (k === 'capacidad' || k === 'costo')){
      const pie = document.querySelector('.cajon-pie .pie-total');
      if (pie){ const tmp = document.createElement('div'); tmp.innerHTML = cajonMadre();
        pie.replaceWith(tmp.querySelector('.pie-total')); }
    }
    return;
  }
  if (id === 'vBusca'){
    P.venta.busca = e.target.value;
    const pos = e.target.selectionStart;
    pintarCajon();
    const n = document.getElementById('vBusca'); if (n){ n.focus(); n.setSelectionRange(pos, pos); }
    return;
  }
  if (id !== 'pBusca') return;
  P.busca = e.target.value;
  const pos = e.target.selectionStart;
  pintar();
  const nuevo = document.getElementById('pBusca');
  if (nuevo){ nuevo.focus(); nuevo.setSelectionRange(pos, pos); }
});

document.addEventListener('keydown', e => { if (e.key === 'Escape' && P.cajon) cerrarCajon(); });
document.getElementById('pVenta').onclick = () => {
  P.venta = Object.assign(P.venta, { pedido:null, modo:'nuevo', clienteId:null, nombre:'', wa:'', busca:'' });
  abrirCajon({ tipo:'venta' });
};

/* ── arranque ──
   En demo, directo. Con la base real: sesión → ¿es admin? → cargar todo. */
async function iniciar(){
  const main = document.getElementById('pMain');
  if (!EN_VIVO){
    pintar();
    document.body.insertAdjacentHTML('beforeend', '<a class="modo-demo" href="?demo=0">DATOS DE PRUEBA · SALIR</a>');
    return;
  }
  main.innerHTML = cargandoHTML('Revisando la sesión…');
  const ses = await sesionActual();
  if (!ses) return pantallaLogin(main, { rol:'PANEL DE OPERACIÓN' }, iniciar);
  let admin = false;
  try { admin = await soyAdmin(); } catch (e) {}
  if (!admin){
    await salir();
    return pantallaLogin(main, { rol:'PANEL DE OPERACIÓN', error:'Ese usuario no tiene acceso al panel.' }, iniciar);
  }
  main.innerHTML = cargandoHTML('Cargando la base…');
  try { await cargarTodo(); }
  catch (e){ main.innerHTML = vacio('No se pudo cargar la base', motivoDe(e)); return; }
  document.body.classList.remove('sin-sesion');
  pintar();
}

document.getElementById('pSalir').onclick = async () => { await salir(); location.reload(); };
iniciar();
