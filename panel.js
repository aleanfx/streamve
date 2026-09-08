/* StreamVe — panel de operación.
 *
 * Nada de lo que se ve acá se calcula acá: todo sale de las funciones de
 * datos.js. Este archivo sólo decide cómo se muestra y qué acción tiene
 * cada fila.
 *
 * Depende de: ui.js, catalogo.js, datos.js
 */

document.body.classList.add('panel');

const P = { vista: 'hoy', filtro: 'todas', busca: '' };

const VISTAS = [
  ['hoy',      'HOY'],
  ['madres',   'CUENTAS MADRE'],
  ['susc',     'SUSCRIPCIONES'],
  ['clientes', 'CLIENTES'],
  ['dinero',   'DINERO']
];

/* ── utilidades de presentación ───────────────────────────────── */

const servPorId = id => CAT.find(x => x.id === id) || { nombre: '—', color: '#666' };

const punto = servicioId =>
  `<span class="punto" style="background:${servPorId(servicioId).color}"></span>`;

const ETIQ = { activa:'ACTIVA', porVencer:'POR VENCER', vencida:'VENCIDA', cancelada:'CANCELADA' };
const chipEstado = e => `<span class="chip-e e-${e}">${ETIQ[e] || e}</span>`;

/* Barra de días restantes sobre el ciclo de 30 días */
function barraTiempo(s){
  const d = diasRestantes(s);
  const pct = Math.max(0, Math.min(100, (d / OP.diasPorMes) * 100));
  const color = d < 0 ? 'var(--muere)' : d <= OP.avisarDiasAntes ? 'var(--avisa)' : 'var(--vive)';
  return `<div class="tiempo">
    <div class="tiempo-riel"><div class="tiempo-fill" style="width:${pct}%;background:${color}"></div></div>
    <span>${comoFalta(s.vence)}</span>
  </div>`;
}

/* Capacidad de una cuenta madre, cuadrito por perfil */
function barraCapacidad(m){
  const ps = perfilesDe(m);
  const cuadros = ps.map(p =>
    `<i class="cap-u ${p.estado === 'asignado' ? 'ocupado' : p.estado === 'caido' ? 'caido' : ''}"></i>`).join('');
  return `<div class="cap">
    <div class="cap-riel">${cuadros}</div>
    <span>${capacidadUsada(m)}/${m.capacidad}</span>
  </div>`;
}

const nombreCliente = id => (DB.clientes.find(c => c.id === id) || {}).nombre || '—';

const waCliente = (clienteId, texto) => {
  const c = DB.clientes.find(x => x.id === clienteId);
  return 'https://wa.me/' + (c ? c.whatsapp : CFG.whatsapp) + '?text=' + encodeURIComponent(texto);
};

const vacio = (titulo, sub) =>
  `<div class="vacio"><b>${esc(titulo)}</b>${sub ? esc(sub) : ''}</div>`;

/* ── HOY ──────────────────────────────────────────────────────── */

function vistaHoy(){
  const pend   = pedidosPendientes();
  const hoyMan = vencenEntre(0, 1);
  const semana = vencenEntre(0, 7);
  const inc    = incidenciasAbiertas();
  const riesgo = madresEnRiesgo();
  const sinRepuesto = CAT.filter(x => stockDisponible(x.id) === 0);

  return `
  <div class="alertas">
    <button class="alerta ${pend.length ? 'urgente' : 'bien'}" data-ver="pedidos">
      <u>POR ENTREGAR</u><b>${pend.length}</b><span>pedidos esperando</span>
    </button>
    <button class="alerta ${hoyMan.length ? 'ojo' : 'bien'}" data-ver="vencen">
      <u>VENCE HOY Y MAÑANA</u><b>${hoyMan.length}</b><span>hay que avisar</span>
    </button>
    <button class="alerta ${inc.length ? 'urgente' : 'bien'}" data-ver="incidencias">
      <u>INCIDENCIAS</u><b>${inc.length}</b><span>sin resolver</span>
    </button>
    <button class="alerta ${(riesgo.length || sinRepuesto.length) ? 'ojo' : 'bien'}" data-ir="madres">
      <u>INVENTARIO</u><b>${sinRepuesto.length}</b><span>servicios sin stock</span>
    </button>
  </div>

  ${sinRepuesto.length ? `
  <div class="bloque">
    <div class="bloque-tit">
      <h2>Sin stock para reponer</h2>
      <span>si una de estas se cae, no hay con qué reemplazarla</span>
    </div>
    <div class="tabla-cont"><table class="t"><tbody>
      ${sinRepuesto.map(x => {
        const activas = DB.suscripciones.filter(s =>
          servicioDeSuscripcion(s) && servicioDeSuscripcion(s).id === x.id &&
          estadoSuscripcion(s) !== 'vencida').length;
        return `<tr>
          <td><span class="prin">${punto(x.id)}${esc(x.nombre)}</span></td>
          <td class="num sub">${activas} suscripciones vivas en riesgo</td>
          <td><a class="acc pri" href="index.html" target="_blank" rel="noopener">COMPRAR CUENTA</a></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>
  </div>` : ''}

  <div class="bloque" id="pedidos">
    <div class="bloque-tit">
      <h2>Pedidos por entregar</h2>
      <span>${pend.length} esperando</span>
    </div>
    ${pend.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Servicio</th><th>Pago</th><th>Estado</th><th></th></tr></thead>
      <tbody>${pend.map(p => {
        const it = p.items[0], sv = servPorId(it.servicioId);
        return `<tr>
          <td><span class="prin">${esc(p.id)}</span><div class="sub">${fechaCorta(p.creado)}</div></td>
          <td>${esc(nombreCliente(p.clienteId))}</td>
          <td>${punto(it.servicioId)}${esc(sv.nombre)}</td>
          <td class="num">${usd(p.total)}<div class="sub">${p.metodoPago === 'binance' ? 'Binance' : 'Pago Móvil'} · ${esc(p.referencia)}</div></td>
          <td><span class="chip-e e-neutro">${p.estado.toUpperCase()}</span></td>
          <td><button class="acc pri" data-entregar="${p.id}">ENTREGAR</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>`
      : vacio('Nada pendiente', 'Todos los pedidos están entregados.')}
  </div>

  <div class="bloque" id="vencen">
    <div class="bloque-tit">
      <h2>Vence esta semana</h2>
      <span>${semana.length} suscripciones</span>
      <span class="der">avisar antes evita perder al cliente</span>
    </div>
    ${semana.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Cliente</th><th>Servicio</th><th>Tiempo</th><th>Estado</th><th></th></tr></thead>
      <tbody>${semana.map(s => {
        const sv = servicioDeSuscripcion(s) || { id:'', nombre:'—' };
        const e = estadoSuscripcion(s);
        return `<tr>
          <td><span class="prin">${esc(nombreCliente(s.clienteId))}</span></td>
          <td>${punto(sv.id)}${esc(sv.nombre)}</td>
          <td>${barraTiempo(s)}</td>
          <td>${chipEstado(e)}</td>
          <td><a class="acc" target="_blank" rel="noopener" href="${waCliente(s.clienteId,
            'Hola ' + nombreCliente(s.clienteId).split(' ')[0] + ', tu ' + sv.nombre +
            ' ' + comoFalta(s.vence) + '. ¿Lo renovamos?')}">AVISAR</a></td>
        </tr>`;
      }).join('')}</tbody></table></div>`
      : vacio('Ninguna vence esta semana', 'Podés dormir tranquilo.')}
  </div>

  <div class="bloque" id="incidencias">
    <div class="bloque-tit">
      <h2>Incidencias abiertas</h2>
      <span>${inc.length} sin resolver</span>
    </div>
    ${inc.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Cliente</th><th>Servicio</th><th>Qué pasó</th><th>Desde</th><th></th></tr></thead>
      <tbody>${inc.map(i => {
        const s = DB.suscripciones.find(x => x.id === i.suscripcionId);
        if (!s) return '';
        const sv = servicioDeSuscripcion(s) || { id:'', nombre:'—' };
        return `<tr>
          <td><span class="prin">${esc(nombreCliente(s.clienteId))}</span></td>
          <td>${punto(sv.id)}${esc(sv.nombre)}</td>
          <td>${esc(i.causa)}</td>
          <td class="num sub">${comoFalta(i.abierta).replace('venció','abierta')}</td>
          <td><button class="acc pri" data-reponer="${s.id}">REPONER</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>`
      : vacio('Sin incidencias', 'Nada se cayó.')}
  </div>`;
}

/* ── CUENTAS MADRE ────────────────────────────────────────────── */

function vistaMadres(){
  const madres = DB.cuentasMadre.slice()
    .sort((a, b) => new Date(a.vence) - new Date(b.vence));
  const riesgo = madresEnRiesgo().map(m => m.id);

  return `
  <div class="bloque">
    <div class="bloque-tit">
      <h2>Cuentas madre</h2>
      <span>${madres.length} activas · costo total ${usd(madres.reduce((t,m)=>t+m.costo,0))}</span>
    </div>
    <div class="tabla-cont"><table class="t">
      <thead><tr><th>Servicio</th><th>Proveedor</th><th>Capacidad</th><th>Costo</th><th>Costo/perfil</th><th>Vence</th><th></th></tr></thead>
      <tbody>${madres.map(m => {
        const sv = servPorId(m.servicioId);
        const d = diasEntre(HOY, m.vence);
        const alerta = riesgo.includes(m.id);
        return `<tr>
          <td>
            <span class="prin">${punto(m.servicioId)}${esc(sv.nombre)}</span>
            <div class="sub">${esc(m.correo)}</div>
          </td>
          <td class="sub">${esc(m.proveedor)}</td>
          <td>${barraCapacidad(m)}</td>
          <td class="num">${usd(m.costo)}</td>
          <td class="num">${usd(m.costo / m.capacidad)}</td>
          <td>
            <span class="chip-e ${d < 0 ? 'e-vencida' : d <= 5 ? 'e-porVencer' : 'e-neutro'}">${comoFalta(m.vence)}</span>
            ${alerta ? '<div class="sub" style="color:var(--muere)">clientes la sobreviven</div>' : ''}
          </td>
          <td><button class="acc" data-renovar-madre="${m.id}">RENOVAR</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>
  </div>`;
}

/* ── SUSCRIPCIONES ────────────────────────────────────────────── */

function vistaSusc(){
  const filtros = [['todas','TODAS'],['porVencer','POR VENCER'],['vencida','VENCIDAS'],['activa','ACTIVAS']];
  let lista = DB.suscripciones.slice()
    .sort((a, b) => new Date(a.vence) - new Date(b.vence));
  if (P.filtro !== 'todas') lista = lista.filter(s => estadoSuscripcion(s) === P.filtro);
  if (P.busca){
    const q = P.busca.toLowerCase();
    lista = lista.filter(s => nombreCliente(s.clienteId).toLowerCase().includes(q));
  }

  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Suscripciones</h2><span>${lista.length} de ${DB.suscripciones.length}</span></div>
    <div style="padding-top:14px">
      <input class="buscador" id="pBusca" placeholder="Buscar cliente…" value="${esc(P.busca)}">
      <div class="filtros">
        ${filtros.map(([k, t]) => `<button data-filtro="${k}" aria-pressed="${P.filtro === k}">${t}</button>`).join('')}
      </div>
    </div>
    ${lista.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Cliente</th><th>Servicio</th><th>Plan</th><th>Tiempo</th><th>Precio</th><th>Margen</th><th></th></tr></thead>
      <tbody>${lista.map(s => {
        const sv = servicioDeSuscripcion(s) || { id:'', nombre:'—' };
        const p = DB.perfiles.find(x => x.id === s.perfilId) || {};
        const mg = margenDe(s);
        return `<tr>
          <td>
            <span class="prin">${esc(nombreCliente(s.clienteId))}</span>
            ${s.reposiciones ? `<div class="sub">${s.reposiciones} reposición${s.reposiciones > 1 ? 'es' : ''}</div>` : ''}
          </td>
          <td>${punto(sv.id)}${esc(sv.nombre)}<div class="sub">${esc(p.nombre || '')} · PIN ${esc(p.pin || '')}</div></td>
          <td class="sub">${esc(s.planClave)}</td>
          <td>${barraTiempo(s)}</td>
          <td class="num">${usd(s.precio)}</td>
          <td class="num" style="color:${mg > 0 ? 'var(--vive)' : 'var(--muere)'}">${usd(mg)}</td>
          <td><button class="acc" data-reponer="${s.id}">REPONER</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>`
      : vacio('Nada con ese filtro')}
  </div>`;
}

/* ── CLIENTES ─────────────────────────────────────────────────── */

function vistaClientes(){
  let lista = DB.clientes.slice();
  if (P.busca){
    const q = P.busca.toLowerCase();
    lista = lista.filter(c => c.nombre.toLowerCase().includes(q));
  }
  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Clientes</h2><span>${lista.length} de ${DB.clientes.length}</span></div>
    <div style="padding-top:14px">
      <input class="buscador" id="pBusca" placeholder="Buscar por nombre…" value="${esc(P.busca)}">
    </div>
    <div class="tabla-cont"><table class="t">
      <thead><tr><th>Cliente</th><th>Tipo</th><th>Activas</th><th>Gasta al mes</th><th>Código</th><th></th></tr></thead>
      <tbody>${lista.map(c => {
        const ss = suscripcionesDe(c.id);
        const vivas = ss.filter(s => estadoSuscripcion(s) !== 'vencida');
        const gasta = vivas.reduce((t, s) => t + s.precio, 0);
        return `<tr>
          <td>
            <span class="prin">${esc(c.nombre)}</span>
            <div class="sub">+${esc(c.whatsapp)}</div>
          </td>
          <td><span class="chip-e ${c.tipo === 'mayorista' ? 'e-porVencer' : 'e-neutro'}">${c.tipo.toUpperCase()}</span></td>
          <td class="num">${vivas.length}${ss.length > vivas.length ? `<div class="sub">${ss.length - vivas.length} vencida(s)</div>` : ''}</td>
          <td class="num">${usd(gasta)}${c.tipo === 'mayorista' ? `<div class="sub">saldo ${usd(saldoDe(c.id))}</div>` : ''}</td>
          <td class="num sub">${esc(c.codigoAcceso)}</td>
          <td>
            <a class="acc" target="_blank" rel="noopener" href="cuenta.html?c=${encodeURIComponent(c.codigoAcceso)}">VER SU PORTAL</a>
            <a class="acc" target="_blank" rel="noopener" href="${waCliente(c.id, 'Hola ' + c.nombre.split(' ')[0] + ', te escribo de StreamVe.')}">WHATSAPP</a>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>
  </div>`;
}

/* ── DINERO ───────────────────────────────────────────────────── */

function vistaDinero(){
  const r = resumenDinero();
  const vivas = DB.suscripciones.filter(s => estadoSuscripcion(s) !== 'vencida');
  const recurrente = vivas.reduce((t, s) => t + s.precio, 0);
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
      <thead><tr><th>Servicio</th><th>Vivas</th><th>Factura</th><th>Margen</th><th>Margen/unidad</th><th>Stock libre</th></tr></thead>
      <tbody>${CAT.map(x => {
        const ss = vivas.filter(s => { const sv = servicioDeSuscripcion(s); return sv && sv.id === x.id; });
        const fac = ss.reduce((t, s) => t + s.precio, 0);
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

/* ── render y eventos ─────────────────────────────────────────── */

function pintar(){
  document.getElementById('pNav').innerHTML = VISTAS.map(([k, t]) => {
    let insignia = '';
    if (k === 'hoy'){
      const n = pedidosPendientes().length + incidenciasAbiertas().length + vencenEntre(0, 1).length;
      if (n) insignia = `<i>${n}</i>`;
    }
    return `<button data-ir="${k}" aria-pressed="${P.vista === k}">${t}${insignia}</button>`;
  }).join('');

  document.getElementById('pMain').innerHTML =
      P.vista === 'madres'   ? vistaMadres()
    : P.vista === 'susc'     ? vistaSusc()
    : P.vista === 'clientes' ? vistaClientes()
    : P.vista === 'dinero'   ? vistaDinero()
    : vistaHoy();

  document.getElementById('pFecha').textContent =
    HOY.toLocaleDateString('es-VE', { weekday:'long', day:'numeric', month:'long' });
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-ir],[data-ver],[data-filtro],[data-reponer],[data-entregar],[data-renovar-madre]');
  if (!t) return;
  const d = t.dataset;

  if (d.ir){ P.vista = d.ir; P.busca = ''; P.filtro = 'todas'; window.scrollTo(0, 0); return pintar(); }
  if (d.ver){ document.getElementById(d.ver)?.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
  if (d.filtro){ P.filtro = d.filtro; return pintar(); }

  if (d.reponer){
    const r = reponer(d.reponer, 'Reportado desde el panel');
    alert(r.ok ? 'Repuesta con el perfil ' + r.perfil.nombre + '. La fecha de vencimiento no se movió.'
               : 'No se pudo reponer: ' + r.motivo);
    return pintar();
  }

  if (d.entregar){
    const p = DB.pedidos.find(x => x.id === d.entregar);
    if (!p) return;
    const it = p.items[0];
    const perfil = buscarPerfilLibre(it.servicioId);
    if (!perfil){ alert('No hay perfiles libres de ' + servPorId(it.servicioId).nombre + '. Hay que comprar una cuenta madre.'); return; }
    perfil.estado = 'asignado';
    DB.suscripciones.push({
      id: 'ss-' + (DB.suscripciones.length + 1),
      clienteId: p.clienteId, perfilId: perfil.id, planClave: it.planClave,
      inicio: dia(HOY), vence: dia(masDias(HOY, OP.diasPorMes)),
      precio: it.precio, meses: 1, estado: 'activa', reposiciones: 0
    });
    p.estado = 'entregado';
    p.entregado = dia(HOY);
    return pintar();
  }

  if (d.renovarMadre){
    const m = DB.cuentasMadre.find(x => x.id === d.renovarMadre);
    if (!m) return;
    m.vence = dia(masDias(new Date(m.vence) > HOY ? m.vence : HOY, OP.diasPorMes));
    return pintar();
  }
});

document.addEventListener('input', e => {
  if (e.target.id !== 'pBusca') return;
  P.busca = e.target.value;
  const pos = e.target.selectionStart;
  pintar();
  const nuevo = document.getElementById('pBusca');
  if (nuevo){ nuevo.focus(); nuevo.setSelectionRange(pos, pos); }
});

pintar();
