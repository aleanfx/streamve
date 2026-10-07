/* StreamVe — panel de operación (Ale).
 *
 * Nada de lo que se ve acá se calcula acá: todo sale de las reglas de
 * datos.js. Este archivo decide cómo se muestra y qué acción tiene cada
 * fila. La venta casi siempre entra por WhatsApp: + VENTA la registra en
 * diez segundos y MANDAR ACCESO le devuelve al cliente su clave y su link.
 *
 * Depende de: ui.js, catalogo.js, datos.js, paneles.js
 */

const P = {
  vista:'hoy', filtro:'todas', busca:'', cajon:null,
  venta:{ modo:'nuevo', clienteId:null, nombre:'', wa:'', busca:'', sid:'nx', planK:'pantalla', meses:1, metodo:'binance' },
  madre:{ sid:'nx', correo:'', clave:'', capacidad:4, costo:'', proveedor:'', vence:'' }
};

const VISTAS = [
  ['hoy',      'HOY'],
  ['madres',   'CUENTAS MADRE'],
  ['susc',     'SUSCRIPCIONES'],
  ['clientes', 'CLIENTES'],
  ['dinero',   'DINERO']
];

const cliente = id => DB.clientes.find(c => c.id === id) || { nombre:'—', whatsapp:CFG.whatsapp, codigoAcceso:'' };
const nombreCliente = id => cliente(id).nombre;
const primer = n => String(n).split(' ')[0];
const waCliente = (clienteId, texto) => waLink(texto, cliente(clienteId).whatsapp);

/* A Ale le toca avisar a sus clientes directos. Las unidades de los
   revendedores las avisa cada revendedor desde su panel. */
const directos = lista => lista.filter(s => cliente(s.clienteId).tipo !== 'mayorista');
const METODO = { binance:'Binance', pagoMovil:'Pago Móvil', whatsapp:'WhatsApp', saldo:'Saldo', otro:'Otro' };

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

/* ── HOY ──────────────────────────────────────────────────────── */

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

function vistaHoy(){
  if (!DB.cuentasMadre.length && !DB.suscripciones.length) return vistaPrimerosPasos();
  const pend   = pedidosPendientes();
  const hoyMan = directos(vencenEntre(0, 1));
  const semana = directos(vencenEntre(0, 7));
  const inc    = incidenciasAbiertas();
  const rec    = recargasPendientes();
  const riesgo = madresEnRiesgo();
  const sinRepuesto = CAT.filter(x => stockDisponible(x.id) === 0);
  const liberar_ = paraLiberar();

  return `
  <div class="alertas">
    <button class="alerta ${pend.length ? 'urgente' : 'bien'}" data-ver="pedidos">
      <u>POR ENTREGAR</u><b>${pend.length}</b><span>pedidos esperando</span>
    </button>
    <button class="alerta ${inc.length ? 'urgente' : 'bien'}" data-ver="incidencias">
      <u>INCIDENCIAS</u><b>${inc.length}</b><span>cuentas que no andan</span>
    </button>
    <button class="alerta ${hoyMan.length ? 'ojo' : 'bien'}" data-ver="vencen">
      <u>VENCE HOY Y MAÑANA</u><b>${hoyMan.length}</b><span>hay que avisar</span>
    </button>
    <button class="alerta ${rec.length ? 'ojo' : 'bien'}" data-ver="recargas">
      <u>RECARGAS</u><b>${rec.length}</b><span>por acreditar</span>
    </button>
    <button class="alerta ${(riesgo.length || sinRepuesto.length) ? 'ojo' : 'bien'}" data-ir="madres">
      <u>INVENTARIO</u><b>${sinRepuesto.length + riesgo.length}</b><span>${sinRepuesto.length} sin stock · ${riesgo.length} por renovar</span>
    </button>
  </div>

  ${sinRepuesto.length ? `
  <div class="bloque">
    <div class="bloque-tit">
      <h2>Sin stock para reponer</h2>
      <span>si una de estas se cae, no hay con qué reemplazarla</span>
    </div>
    <div class="tabla-cont"><table class="t">
      <thead><tr><th>Servicio</th><th>En riesgo</th><th></th></tr></thead>
      <tbody>${sinRepuesto.map(x => {
        const activas = DB.suscripciones.filter(s => {
          const sv = servicioDeSuscripcion(s);
          return sv && sv.id === x.id && estadoSuscripcion(s) !== 'vencida';
        }).length;
        return `<tr>
          <td><span class="prin">${punto(x.id)}${esc(x.nombre)}</span></td>
          <td class="num sub">${activas} suscripciones vivas</td>
          <td><button class="acc pri" data-cajon="madre" data-sid="${x.id}">+ CUENTA MADRE</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>
  </div>` : ''}

  <div class="bloque" id="pedidos">
    <div class="bloque-tit"><h2>Pedidos por entregar</h2><span>${pend.length} esperando</span>
      <span class="der">verificá el pago en el chat antes de entregar</span></div>
    ${pend.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Servicio</th><th>Pago</th><th>Estado</th><th></th></tr></thead>
      <tbody>${pend.map(p => {
        const it = p.items[0], sv = servPorId(it.servicioId);
        const sin = stockPlan(it.servicioId, it.planClave) < it.cantidad;
        return `<tr>
          <td><span class="prin">${esc(p.id)}</span><div class="sub">${fechaCorta(p.creado)}</div></td>
          <td>${p.clienteId ? esc(nombreCliente(p.clienteId)) : '<span class="sub">llegó por la web</span>'}</td>
          <td>${punto(it.servicioId)}${esc(sv.nombre)}<div class="sub">${esc(etiquetaPlan(it.servicioId, it.planClave))}${it.cantidad > 1 ? ' × ' + it.cantidad : ''}${it.meses === 12 ? ' · 12 meses' : ''}</div></td>
          <td class="num">${usd(p.total)}<div class="sub">${METODO[p.metodoPago] || esc(p.metodoPago)}${p.referencia ? ' · ' + esc(p.referencia) : ''}</div></td>
          <td><span class="chip-e ${p.estado === 'esperando' ? 'e-porVencer' : 'e-neutro'}">${p.estado === 'esperando' ? 'SIN CAPTURA' : p.estado.toUpperCase()}</span></td>
          <td class="acciones">${sin ? `<button class="acc" data-cajon="madre" data-sid="${it.servicioId}">SIN STOCK · + CUENTA</button>`
                    : `<button class="acc pri" data-entregar="${p.id}">ENTREGAR</button>`}
              ${p.estado === 'esperando' ? `<button class="acc" data-descartar="${p.id}">DESCARTAR</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`
      : vacio('Nada pendiente', 'Todos los pedidos están entregados.')}
  </div>

  <div class="bloque" id="incidencias">
    <div class="bloque-tit"><h2>Incidencias abiertas</h2><span>${inc.length} sin resolver</span>
      <span class="der">reponer no mueve la fecha de vencimiento</span></div>
    ${inc.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Cliente</th><th>Servicio</th><th>Qué pasó</th><th>Desde</th><th></th></tr></thead>
      <tbody>${inc.map(i => {
        const s = DB.suscripciones.find(x => x.id === i.suscripcionId);
        if (!s) return '';
        const sv = servicioDeSuscripcion(s) || servPorId('');
        return `<tr>
          <td><span class="prin">${esc(nombreCliente(s.clienteId))}</span></td>
          <td>${punto(sv.id)}${esc(sv.nombre)}</td>
          <td>${esc(i.causa)}</td>
          <td class="num sub">${i.abierta === dia(HOY) ? 'hoy' : 'hace ' + Math.abs(diasEntre(HOY, i.abierta)) + ' d'}</td>
          <td><button class="acc pri" data-reponer="${s.id}">REPONER</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>`
      : vacio('Sin incidencias', 'Nada se cayó.')}
  </div>

  <div class="bloque" id="recargas">
    <div class="bloque-tit"><h2>Recargas por acreditar</h2><span>${rec.length} esperando</span>
      <span class="der">el saldo cuenta recién cuando lo acreditás</span></div>
    ${rec.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Revendedor</th><th>Método</th><th>Fecha</th><th>Monto</th><th></th></tr></thead>
      <tbody>${rec.map(m => `<tr>
        <td><span class="prin">${esc(nombreCliente(m.clienteId))}</span><div class="sub">saldo actual ${usd(saldoDe(m.clienteId))}</div></td>
        <td class="sub">${esc(m.referencia)}</td>
        <td class="num sub">${fechaCorta(m.fecha)}</td>
        <td class="num"><b>${usd(m.monto)}</b></td>
        <td><button class="acc pri" data-acreditar="${m.id}">ACREDITAR</button></td>
      </tr>`).join('')}</tbody></table></div>`
      : vacio('Nada por acreditar')}
  </div>

  ${liberar_.length ? `
  <div class="bloque" id="liberar">
    <div class="bloque-tit"><h2>Vencidas sin renovar</h2><span>${liberar_.length} hace más de ${OP.graciaDias} días</span>
      <span class="der">al liberar, cambiale el PIN al perfil antes de revenderlo</span></div>
    <div class="tabla-cont"><table class="t">
      <thead><tr><th>Cliente</th><th>Servicio</th><th>Venció</th><th>PIN a cambiar</th><th></th></tr></thead>
      <tbody>${liberar_.map(s => {
        const sv = servicioDeSuscripcion(s) || servPorId('');
        const a = accesoDe(s) || {};
        return `<tr>
          <td><span class="prin">${esc(nombreCliente(s.clienteId))}</span></td>
          <td>${punto(sv.id)}${esc(sv.nombre)}<div class="sub">${esc(a.correo || '')}</div></td>
          <td class="num sub">${esc(comoFalta(s.vence))}</td>
          <td class="num">${esc(a.perfil || '')}${a.pin ? ' · ' + esc(a.pin) : ''}</td>
          <td class="acciones">
            <a class="acc" target="_blank" rel="noopener" href="${waCliente(s.clienteId, mensajeAviso(s))}">ÚLTIMO AVISO</a>
            <button class="acc pri" data-liberar="${s.id}">LIBERAR</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>
  </div>` : ''}

  <div class="bloque" id="vencen">
    <div class="bloque-tit"><h2>Vence esta semana</h2><span>${semana.length} suscripciones</span>
      <span class="der">avisar antes evita perder al cliente</span></div>
    ${semana.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Cliente</th><th>Servicio</th><th>Tiempo</th><th>Estado</th><th></th></tr></thead>
      <tbody>${semana.map(s => {
        const sv = servicioDeSuscripcion(s) || servPorId('');
        const c = cliente(s.clienteId);
        return `<tr>
          <td><span class="prin">${esc(c.nombre)}</span></td>
          <td>${punto(sv.id)}${esc(sv.nombre)}</td>
          <td>${barraTiempo(s)}</td>
          <td>${chipEstado(estadoSuscripcion(s))}</td>
          <td class="acciones">
            <a class="acc" target="_blank" rel="noopener" href="${waCliente(s.clienteId, mensajeAviso(s))}">AVISAR</a>
            <button class="acc" data-renovar="${s.id}">COBRADA · RENOVAR</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>`
      : vacio('Ninguna vence esta semana', 'Podés dormir tranquilo.')}
  </div>`;
}

/* ── CUENTAS MADRE ────────────────────────────────────────────── */

function vistaMadres(){
  const madres = DB.cuentasMadre.slice().sort((a, b) => aFecha(a.vence) - aFecha(b.vence));
  const riesgo = madresEnRiesgo().map(m => m.id);

  return `
  <div class="bloque">
    <div class="bloque-tit">
      <h2>Cuentas madre</h2>
      <span>${madres.length} · costo total ${usd(madres.reduce((t, m) => t + m.costo, 0))}</span>
      <button class="acc pri der-btn" data-cajon="madre">+ CUENTA MADRE</button>
    </div>
    <div class="tabla-cont"><table class="t">
      <thead><tr><th>Servicio</th><th>Proveedor</th><th>Capacidad</th><th>Costo</th><th>Por perfil</th><th>Vence</th><th></th></tr></thead>
      <tbody>${madres.map(m => {
        const sv = servPorId(m.servicioId);
        const d = diasEntre(HOY, m.vence);
        return `<tr>
          <td><span class="prin">${punto(m.servicioId)}${esc(sv.nombre)}</span><div class="sub">${esc(m.correo)}</div></td>
          <td class="sub">${esc(m.proveedor)}</td>
          <td>${barraCapacidad(m)}</td>
          <td class="num">${usd(m.costo)}</td>
          <td class="num">${usd(m.costo / m.capacidad)}</td>
          <td>
            <span class="chip-e ${d < 0 ? 'e-vencida' : d <= 5 ? 'e-porVencer' : 'e-neutro'}">${comoFalta(m.vence)}</span>
            ${riesgo.includes(m.id) ? '<div class="sub" style="color:var(--muere)">clientes la sobreviven</div>' : ''}
          </td>
          <td class="acciones">
            <button class="acc" data-copiar="${esc(m.correo + '\n' + m.clave)}">COPIAR ACCESO</button>
            <button class="acc ${riesgo.includes(m.id) ? 'pri' : ''}" data-renovar-madre="${m.id}">RENOVAR</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>
  </div>`;
}

/* ── SUSCRIPCIONES ────────────────────────────────────────────── */

function vistaSusc(){
  const filtros = [['todas','TODAS'],['porVencer','POR VENCER'],['vencida','VENCIDAS'],['activa','ACTIVAS']];
  let lista = DB.suscripciones.slice().sort((a, b) => aFecha(a.vence) - aFecha(b.vence));
  if (P.filtro !== 'todas') lista = lista.filter(s => estadoSuscripcion(s) === P.filtro);
  if (P.busca){
    const q = P.busca.toLowerCase();
    lista = lista.filter(s => nombreCliente(s.clienteId).toLowerCase().includes(q));
  }

  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Suscripciones</h2><span>${lista.length} de ${DB.suscripciones.length}</span></div>
    <div class="herram">
      <input class="buscador" id="pBusca" placeholder="Buscar cliente…" value="${esc(P.busca)}">
      <div class="filtros">
        ${filtros.map(([k, t]) => `<button data-filtro="${k}" aria-pressed="${P.filtro === k}">${t}</button>`).join('')}
      </div>
    </div>
    ${lista.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Cliente</th><th>Servicio</th><th>Tiempo</th><th>Precio</th><th>Margen</th><th></th></tr></thead>
      <tbody>${lista.map(s => {
        const sv = servicioDeSuscripcion(s) || servPorId('');
        const a = accesoDe(s) || {};
        const mg = margenDe(s);
        return `<tr>
          <td><span class="prin">${esc(nombreCliente(s.clienteId))}</span>
            ${s.reposiciones ? `<div class="sub">${s.reposiciones} reposición${s.reposiciones > 1 ? 'es' : ''}</div>` : ''}</td>
          <td>${punto(sv.id)}${esc(sv.nombre)}<div class="sub">${esc(etiquetaPlan(sv.id, s.planClave))} · ${esc(a.perfil || '')}${a.pin ? ' · PIN ' + esc(a.pin) : ''}</div></td>
          <td>${barraTiempo(s)}</td>
          <td class="num">${usd(s.precio)}${s.meses > 1 ? `<div class="sub">${s.meses} meses</div>` : ''}</td>
          <td class="num" style="color:${mg > 0 ? 'var(--vive)' : 'var(--muere)'}">${usd(mg)}<div class="sub">por mes</div></td>
          <td class="acciones">
            <button class="acc" data-acceso="${s.id}">ACCESO</button>
            <button class="acc" data-renovar="${s.id}">RENOVAR</button>
            <button class="acc" data-reponer="${s.id}">REPONER</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>`
      : vacio('Nada con ese filtro')}
  </div>`;
}

/* ── CLIENTES ─────────────────────────────────────────────────── */

function vistaClientes(){
  let lista = DB.clientes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (P.busca){
    const q = P.busca.toLowerCase();
    lista = lista.filter(c => c.nombre.toLowerCase().includes(q) || c.whatsapp.includes(q));
  }
  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Clientes</h2><span>${lista.length} de ${DB.clientes.length}</span></div>
    <div class="herram">
      <input class="buscador" id="pBusca" placeholder="Buscar por nombre o teléfono…" value="${esc(P.busca)}">
    </div>
    <div class="tabla-cont"><table class="t">
      <thead><tr><th>Cliente</th><th>Tipo</th><th>Activas</th><th>Gasta al mes</th><th></th></tr></thead>
      <tbody>${lista.map(c => {
        const ss = suscripcionesDe(c.id);
        const vivas = ss.filter(s => estadoSuscripcion(s) !== 'vencida');
        const gasta = vivas.reduce((t, s) => t + s.precio / (s.meses || 1), 0);
        return `<tr>
          <td><span class="prin">${esc(c.nombre)}</span><div class="sub">+${esc(c.whatsapp)}</div></td>
          <td><span class="chip-e ${c.tipo === 'mayorista' ? 'e-porVencer' : 'e-neutro'}">${c.tipo.toUpperCase()}</span></td>
          <td class="num">${vivas.length}${ss.length > vivas.length ? `<div class="sub">${ss.length - vivas.length} vencida(s)</div>` : ''}</td>
          <td class="num">${usd(gasta)}${c.tipo === 'mayorista' ? `<div class="sub">saldo ${usd(saldoDe(c.id))}</div>` : ''}</td>
          <td class="acciones">
            <a class="acc" target="_blank" rel="noopener" href="cuenta.html?c=${encodeURIComponent(c.codigoAcceso)}">VER PORTAL</a>
            <a class="acc" target="_blank" rel="noopener" href="${waLink('Hola ' + primer(c.nombre) + ', este es tu link de StreamVe: ahí ves tus cuentas, cuándo vencen y renovás.\n' + linkPortal(c), c.whatsapp)}">MANDAR LINK</a>
            <button class="acc" data-cajon="venta" data-cliente="${c.id}">+ VENTA</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>
  </div>`;
}

/* ── DINERO ───────────────────────────────────────────────────── */

function vistaDinero(){
  const r = resumenDinero();
  const vivas = DB.suscripciones.filter(s => estadoSuscripcion(s) !== 'vencida');
  const recurrente = vivas.reduce((t, s) => t + s.precio / (s.meses || 1), 0);
  const margenMes  = vivas.reduce((t, s) => t + margenDe(s), 0);

  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Dinero</h2><span>lo que corre este mes</span></div>
    <div class="plata" style="margin-top:16px">
      <div><u>FACTURACIÓN VIVA</u><b>${usd(recurrente)}</b><span>${vivas.length} suscripciones al mes</span></div>
      <div class="verde"><u>MARGEN REAL</u><b>${usd(margenMes)}</b><span>después del costo de cuentas madre</span></div>
      <div><u>INVERTIDO EN STOCK</u><b>${usd(r.costoMadres)}</b><span>${DB.cuentasMadre.length} cuentas madre</span></div>
      <div><u>MARGEN POR CLIENTE</u><b>${usd(vivas.length ? margenMes / vivas.length : 0)}</b><span>promedio mensual</span></div>
    </div>
  </div>

  <div class="bloque">
    <div class="bloque-tit"><h2>Por servicio</h2><span>dónde está el margen de verdad</span></div>
    <div class="tabla-cont"><table class="t">
      <thead><tr><th>Servicio</th><th>Vivas</th><th>Factura</th><th>Margen</th><th>Por unidad</th><th>Stock</th></tr></thead>
      <tbody>${CAT.map(x => {
        const ss = vivas.filter(s => { const sv = servicioDeSuscripcion(s); return sv && sv.id === x.id; });
        const fac = ss.reduce((t, s) => t + s.precio / (s.meses || 1), 0);
        const mg  = ss.reduce((t, s) => t + margenDe(s), 0);
        const libre = stockDisponible(x.id);
        return `<tr>
          <td><span class="prin">${punto(x.id)}${esc(x.nombre)}</span></td>
          <td class="num">${ss.length}</td>
          <td class="num">${usd(fac)}</td>
          <td class="num" style="color:${mg > 0 ? 'var(--vive)' : 'var(--muere)'}">${usd(mg)}</td>
          <td class="num">${usd(ss.length ? mg / ss.length : 0)}</td>
          <td class="num"><span class="chip-e ${libre === 0 ? 'e-vencida' : libre <= 3 ? 'e-porVencer' : 'e-activa'}">${libre} libres</span></td>
        </tr>`;
      }).join('')}</tbody></table></div>
  </div>`;
}

/* ── cajones: + VENTA, MANDAR ACCESO, + CUENTA MADRE ─────────── */

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
    ${ped ? `<p class="cajon-nota">Llegó por la web. Verificá la captura en el chat y decí de quién es.</p>` : ''}
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

    ${ped ? '' : `<h4>SERVICIO</h4>
    <div class="servs">${CAT.map(s => { const n = stockDisponible(s.id); return `
      <button data-v-sid="${s.id}" aria-pressed="${v.sid === s.id}" ${n ? '' : 'disabled'}>
        ${punto(s.id)}<b>${esc(s.nombre)}</b><span>${n ? n + ' libres' : 'agotado'}</span>
      </button>`; }).join('')}</div>

    <h4>ACCESO</h4>
    <div class="opciones">${x.planes.map(p => `
      <button data-v-plan="${p.k}" aria-pressed="${pl.k === p.k}" ${stockPlan(v.sid, p.k) ? '' : 'disabled'}>
        <b>${esc(p.etq)}</b><span>${usd(p.precio)}/mes</span>
      </button>`).join('')}</div>

    <h4>TIEMPO Y COBRO</h4>
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
      <span>Su portal</span><b>${esc(linkPortal(c).replace('https://', ''))}</b>
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
  const proveedores = [...new Set(DB.cuentasMadre.map(c => c.proveedor))].sort();
  return cajonHTML('Nueva cuenta madre', `
    <h4>SERVICIO</h4>
    <div class="servs">${CAT.map(s => `
      <button data-m-sid="${s.id}" aria-pressed="${m.sid === s.id}">${punto(s.id)}<b>${esc(s.nombre)}</b><span>${stockDisponible(s.id)} libres</span></button>`).join('')}</div>
    <div class="campos">
      <label>Correo de la cuenta<input id="mCorreo" value="${esc(m.correo)}" placeholder="cuenta@correo.com" autocomplete="off"></label>
      <label>Clave<input id="mClave" value="${esc(m.clave)}" autocomplete="off"></label>
      <div class="campos-2">
        <label>Perfiles<input id="mCap" type="number" min="1" max="8" value="${esc(m.capacidad)}"></label>
        <label>Costo $<input id="mCosto" type="number" min="0" step="0.01" value="${esc(m.costo)}" placeholder="11.00"></label>
      </div>
      <label>Proveedor<input id="mProv" value="${esc(m.proveedor)}" list="provs" placeholder="VirtuMall · TANCHI TV" autocomplete="off"></label>
      <datalist id="provs">${proveedores.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
      <label>Vence<input id="mVence" type="date" value="${esc(m.vence || dia(masDias(HOY, OP.diasPorMes)))}"></label>
    </div>
  `, `
    <div class="pie-total">
      <b>${porPerfil ? usd(porPerfil) : '—'}</b>
      <span>por perfil${porPerfil ? ` · margen ${usd(pl.precio - porPerfil)} al público, ${pl.precioMayorista != null ? usd(pl.precioMayorista - porPerfil) : '—'} al mayor` : ''}</span>
    </div>
    <button class="acc pri grande" data-guardar-madre="1">GUARDAR</button>
  `);
}

function pintarCajon(){
  const el = document.getElementById('pCajon');
  const t = P.cajon && P.cajon.tipo;
  el.innerHTML = t === 'venta' ? cajonVenta() : t === 'acceso' ? cajonAcceso() : t === 'madre' ? cajonMadre() : '';
  document.body.classList.toggle('con-cajon', !!t);
}
function abrirCajon(c){ P.cajon = c; pintarCajon(); document.querySelector('.cajon-cuerpo')?.scrollTo(0, 0); }
function cerrarCajon(){ P.cajon = null; pintarCajon(); }

/* ── render y eventos ─────────────────────────────────────────── */

function pintar(){
  document.getElementById('pNav').innerHTML = VISTAS.map(([k, t]) => {
    let n = 0;
    if (k === 'hoy') n = pedidosPendientes().length + incidenciasAbiertas().length +
                         directos(vencenEntre(0, 1)).length + recargasPendientes().length;
    return `<button data-ir="${k}" aria-pressed="${P.vista === k}">${t}${n ? `<i>${n}</i>` : ''}</button>`;
  }).join('');

  const main = document.getElementById('pMain');
  main.innerHTML =
      P.vista === 'madres'   ? vistaMadres()
    : P.vista === 'susc'     ? vistaSusc()
    : P.vista === 'clientes' ? vistaClientes()
    : P.vista === 'dinero'   ? vistaDinero()
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
  const t = e.target.closest('[data-liberar],[data-descartar],[data-ir],[data-ver],[data-filtro],[data-reponer],[data-entregar],[data-renovar],[data-renovar-madre],[data-acreditar],[data-acceso],[data-cajon],[data-cerrar-cajon],[data-v-modo],[data-v-cliente],[data-v-sid],[data-v-plan],[data-v-meses],[data-v-metodo],[data-registrar],[data-m-sid],[data-guardar-madre]');
  if (!t) return;
  const d = t.dataset;

  if (d.ir){ P.vista = d.ir; P.busca = ''; P.filtro = 'todas'; window.scrollTo(0, 0); return pintar(); }
  if (d.ver){ document.getElementById(d.ver)?.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
  if (d.filtro){ P.filtro = d.filtro; return pintar(); }

  if (d.entregar){
    const ped = DB.pedidos.find(x => x.id === d.entregar);
    /* Sin cliente (vino de la web): primero hay que decir de quién es */
    if (!ped.clienteId){
      P.venta = Object.assign(P.venta, { pedido:ped.id, modo:'nuevo', clienteId:null, nombre:'', wa:'', busca:'' });
      return abrirCajon({ tipo:'venta' });
    }
    return hacer(t, () => ACC.entregarPedido(ped.id), r =>
      abrirCajon({ tipo:'acceso', sid:r.suscripciones[0].id, titulo:'Pedido ' + ped.id + ' entregado' }));
  }
  if (d.descartar) return hacer(t, () => ACC.descartarPedido(d.descartar), () => aviso('Pedido descartado'));
  if (d.reponer) return hacer(t, () => ACC.reponer(d.reponer, 'Reportado desde el panel'), () =>
    abrirCajon({ tipo:'acceso', sid:d.reponer, titulo:'Repuesta',
      nota:'Perfil nuevo, misma fecha de vencimiento. Mandale el acceso nuevo.' }));
  if (d.renovar) return hacer(t, () => ACC.renovar(d.renovar, 1), r =>
    aviso('Renovada hasta el ' + fechaCorta(r.vence) + ' · ' + usd(r.precio)));
  if (d.renovarMadre) return hacer(t, () => ACC.renovarMadre(d.renovarMadre), r =>
    aviso('Cuenta madre renovada hasta el ' + fechaCorta(r.vence)));
  if (d.acreditar) return hacer(t, () => ACC.acreditarRecarga(d.acreditar), r =>
    aviso(usd(r.movimiento.monto) + ' acreditados a ' + nombreCliente(r.movimiento.clienteId)));
  if (d.liberar) return hacer(t, () => ACC.liberar(d.liberar), r =>
    aviso(r.perfiles.length + (r.perfiles.length === 1 ? ' perfil volvió' : ' perfiles volvieron') + ' al stock. Cambiale el PIN.'));
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

  /* dentro del cajón de cuenta madre */
  if (d.mSid){ P.madre.sid = d.mSid; P.madre.capacidad = CAPACIDAD_TIPICA[d.mSid] || 4; return pintarCajon(); }
  if (d.guardarMadre){
    const m = P.madre;
    return hacer(t, () => ACC.agregarCuentaMadre({ servicioId:m.sid, correo:m.correo, clave:m.clave,
        capacidad:m.capacidad, costo:m.costo, proveedor:m.proveedor, vence:m.vence }),
      r => { aviso(servPorId(m.sid).nombre + ': ' + r.madre.capacidad + ' perfiles nuevos en stock'); cerrarCajon(); });
  }
});

/* Lo que se escribe en el cajón se guarda sin repintar, para no perder
   el foco; solo la búsqueda de cliente repinta la lista. */
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
