/* StreamVe — panel del revendedor.
 *
 * El revendedor compra con saldo y las unidades le llegan asignadas al
 * instante. Acá ve a quién le dio cada una, cuándo vence, y le avisa a su
 * cliente con un toque. Los mensajes van sin la marca StreamVe: el
 * revendedor vende con la suya.
 *
 * Depende de: ui.js, catalogo.js, datos.js, paneles.js
 */

const M = {
  vista:'resumen', cant:{}, filtro:'todas', busca:'',
  asignando:null, recarga:false, monto:50, metodo:'binance', nuevas:[]
};

const VISTAS_M = [
  ['resumen',     'RESUMEN'],
  ['comprar',     'COMPRAR'],
  ['clientes',    'MIS CLIENTES'],
  ['movimientos', 'MOVIMIENTOS']
];

/* ── quién es ──
   Hasta que haya backend, el usuario del login se busca entre los
   mayoristas simulados; si no coincide, se muestra el primero. */
const slugUsuario = n => String(n).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
function mayoristaActual(){
  let u = '';
  try { u = sessionStorage.getItem('streamve.mayorista') || ''; } catch (e) {}
  const todos = DB.clientes.filter(c => c.tipo === 'mayorista');
  return todos.find(c => slugUsuario(c.nombre) === slugUsuario(u)) || todos[0];
}
/* Con la base real, YO llega después del login (iniciar) */
let YO = EN_VIVO ? null : mayoristaActual();

const misUnidades = () => suscripcionesDe(YO.id).filter(s => s.estado !== 'cancelada');
const clienteFinal = s => s.asignadoA && DB.clientesFinales.find(c => c.id === s.asignadoA);
const pendientesMias = () => recargasPendientes().filter(m => m.clienteId === YO.id);

/* ── saldo ── arriba de todo, porque sin saldo no hay compra */
function pintarSaldo(){
  const saldo = saldoDe(YO.id);
  const nx = planMayorista(CAT[0]);
  const alcanza = Math.floor(saldo / nx.precioMayorista);
  const pend = pendientesMias().reduce((t, m) => t + m.monto, 0);
  const bin = M.metodo === 'binance';
  const montoBs = M.monto * CFG.tasaBs;

  document.getElementById('mSaldo').innerHTML = `
  <div class="saldo-in">
    <div class="saldo-cifra">
      <u>SALDO DISPONIBLE</u>
      <b>${usd(saldo)}</b>
      <span>${alcanza > 0 ? 'Alcanza para ' + alcanza + ' pantallas de Netflix' : 'Recargá para comprar'}${pend ? ` · <em>${usd(pend)} por acreditar</em>` : ''}</span>
    </div>
    <button class="acc pri saldo-btn" data-recarga="1" aria-expanded="${M.recarga}">${M.recarga ? 'CERRAR' : 'RECARGAR SALDO'}</button>
  </div>
  ${M.recarga ? `
  <div class="recarga">
    <div class="recarga-in">
      <div>
        <h3>¿Cuánto vas a recargar?</h3>
        <div class="recarga-montos">
          ${[20, 50, 100, 200].map(n => `<button data-monto="${n}" aria-pressed="${M.monto === n}">${usd(n).replace(',00', '')}</button>`).join('')}
          <label class="recarga-otro">Otro <input id="mMonto" type="number" min="5" step="1" inputmode="numeric" value="${[20,50,100,200].includes(M.monto) ? '' : M.monto}" placeholder="$"></label>
        </div>
        <div class="recarga-metodos">
          <button data-metodo="binance" aria-pressed="${bin}">Binance · USDT</button>
          <button data-metodo="pm" aria-pressed="${!bin}">Pago Móvil · Bs</button>
        </div>
      </div>
      <div class="recarga-datos">
        ${bin ? `
          <div><span>Correo Binance Pay</span><b>${esc(CFG.binanceCorreo)}</b><button class="copiar" data-copiar="${esc(CFG.binanceCorreo)}">COPIAR</button></div>
          <div><span>Red</span><b>${esc(CFG.binanceRed)}</b><i></i></div>
          <div class="fuerte"><span>Monto</span><b>${M.monto.toFixed(2)} USDT</b><button class="copiar" data-copiar="${M.monto.toFixed(2)}">COPIAR</button></div>
        ` : `
          <div><span>Banco</span><b>${esc(CFG.pmBanco)}</b><i></i></div>
          <div><span>Teléfono</span><b>${esc(CFG.pmTelefono)}</b><button class="copiar" data-copiar="${esc(CFG.pmTelefono.replace(/\s/g, ''))}">COPIAR</button></div>
          <div><span>Cédula</span><b>${esc(CFG.pmCedula)}</b><button class="copiar" data-copiar="${esc(CFG.pmCedula.replace(/[^\dVEJ]/gi, ''))}">COPIAR</button></div>
          <div class="fuerte"><span>Monto · BCV ${tasaTxt()}</span><b>${bs(M.monto)}</b><button class="copiar" data-copiar="${montoPegable(montoBs)}">COPIAR</button></div>
        `}
        <a class="btn-wa" data-avisar-recarga="1" target="_blank" rel="noopener" href="${waLink(
          'Hola, soy ' + YO.nombre + '. Recargué *' + usd(M.monto) + '* de saldo por ' + (bin ? 'Binance' : 'Pago Móvil') + '.\nTe mando la captura.')}">${ICONO_WA}<span>YA PAGUÉ · AVISAR</span></a>
        <p class="recarga-nota">El saldo se acredita apenas verificamos el pago, casi siempre en minutos.</p>
      </div>
    </div>
  </div>` : ''}`;
}

/* ── RESUMEN ── */
function vistaResumen(){
  const us = misUnidades();
  const semana = us.filter(s => { const d = diasRestantes(s); return d >= 0 && d <= 7; })
    .sort((a, b) => aFecha(a.vence) - aFecha(b.vence));
  const sinAsignar = us.filter(s => !s.asignadoA && estadoSuscripcion(s) !== 'vencida');
  const vivas = us.filter(s => estadoSuscripcion(s) !== 'vencida');
  const clientes = clientesFinalesDe(YO.id).filter(c => us.some(s => s.asignadoA === c.id));

  return `
  <div class="alertas">
    <button class="alerta ${semana.length ? 'ojo' : 'bien'}" data-ver="mVencen">
      <u>VENCE ESTA SEMANA</u><b>${semana.length}</b><span>avisale a tu cliente</span>
    </button>
    <button class="alerta ${sinAsignar.length ? 'ojo' : 'bien'}" data-ir="clientes" data-filtro-ir="sin">
      <u>SIN ASIGNAR</u><b>${sinAsignar.length}</b><span>unidades libres para vender</span>
    </button>
    <button class="alerta bien" data-ir="clientes">
      <u>ACTIVAS</u><b>${vivas.length}</b><span>unidades corriendo</span>
    </button>
    <button class="alerta bien" data-ir="clientes">
      <u>CLIENTES</u><b>${clientes.length}</b><span>con al menos una unidad</span>
    </button>
  </div>

  <div class="bloque" id="mVencen">
    <div class="bloque-tit">
      <h2>Vence esta semana</h2><span>${semana.length} unidades</span>
      <span class="der">el que avisa antes, renueva</span>
    </div>
    ${semana.length ? tablaUnidades(semana) : vacio('Nada vence esta semana', 'Tus clientes están cubiertos.')}
  </div>`;
}

/* Fila de una unidad: lo que el revendedor hace todos los días */
function tablaUnidades(lista){
  return `<div class="tabla-cont"><table class="t">
    <thead><tr><th>Servicio</th><th>Cliente</th><th>Tiempo</th><th>Estado</th><th></th></tr></thead>
    <tbody>${lista.map(s => {
      const sv = servicioDeSuscripcion(s) || servPorId('');
      const cf = clienteFinal(s);
      const a = accesoDe(s) || {};
      const e = estadoSuscripcion(s);
      const nuevo = M.nuevas.includes(s.id);
      if (M.asignando === s.id) return `<tr class="fila-form">
        <td><span class="prin">${punto(sv.id)}${esc(sv.nombre)}</span><div class="sub">${esc(a.perfil || '')}</div></td>
        <td colspan="4">
          <form class="asignar" data-asignar="${s.id}">
            <input id="aNombre" placeholder="Nombre del cliente" value="${esc(cf ? cf.nombre : '')}" autocomplete="off">
            <input id="aWa" placeholder="WhatsApp · 0414…" inputmode="tel" value="${esc(cf ? cf.whatsapp : '')}" autocomplete="off">
            <button class="acc pri" type="submit">GUARDAR</button>
            <button class="acc" type="button" data-cancelar="1">CANCELAR</button>
          </form>
        </td>
      </tr>`;
      return `<tr${nuevo ? ' class="nueva"' : ''}>
        <td><span class="prin">${punto(sv.id)}${esc(sv.nombre)}</span>
            <div class="sub">${esc(a.perfil || '')}${a.pin ? ' · PIN ' + esc(a.pin) : ''}${nuevo ? ' · <b class="nuevo">NUEVA</b>' : ''}</div></td>
        <td>${cf ? `<span class="prin">${esc(cf.nombre)}</span><div class="sub">${cf.whatsapp ? '+' + esc(cf.whatsapp) : 'sin WhatsApp'}</div>`
                : `<button class="acc asig" data-asignando="${s.id}">+ ASIGNAR</button>`}</td>
        <td>${barraTiempo(s)}</td>
        <td>${chipEstado(e)}</td>
        <td class="acciones">
          ${cf && cf.whatsapp ? `<a class="acc" target="_blank" rel="noopener" href="${waLink(
              (e === 'vencida' || diasRestantes(s) <= OP.avisarDiasAntes)
                ? 'Hola ' + cf.nombre.split(' ')[0] + ', tu ' + sv.nombre + ' ' + comoFalta(s.vence) + '. ¿Lo renovamos?'
                : 'Hola ' + cf.nombre.split(' ')[0] + ', acá está tu acceso:\n\n' + textoAcceso(s), cf.whatsapp)}">${
              (e === 'vencida' || diasRestantes(s) <= OP.avisarDiasAntes) ? 'AVISAR' : 'ENVIAR ACCESO'}</a>` : ''}
          <button class="acc" data-copiar="${esc(textoAcceso(s))}">COPIAR ACCESO</button>
          <button class="acc ${e === 'vencida' || diasRestantes(s) <= OP.avisarDiasAntes ? 'pri' : ''}" data-renovar="${s.id}">RENOVAR · ${usd(planMayorista(sv).precioMayorista)}</button>
          ${cf ? `<button class="acc" data-asignando="${s.id}">CAMBIAR</button>` : ''}
        </td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

/* ── COMPRAR ── */
function vistaComprar(){
  const items = CAT.filter(x => planMayorista(x));
  const unidades = items.reduce((t, x) => t + (M.cant[x.id] || 0), 0);
  const monto = items.reduce((t, x) => t + (M.cant[x.id] || 0) * planMayorista(x).precioMayorista, 0);
  const saldo = saldoDe(YO.id);
  const falta = Math.max(0, OP.minMayorista - unidades);
  const nota = unidades === 0 ? `Mínimo ${OP.minMayorista} unidades, podés mezclar servicios`
    : falta ? `Faltan ${falta} u. para el mínimo`
    : monto > saldo ? `Te faltan ${usd(monto - saldo)} de saldo`
    : `Te quedan ${usd(saldo - monto)} de saldo`;
  const listo = unidades >= OP.minMayorista && monto <= saldo;

  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Comprar</h2><span>se asignan al instante, con 30 días de garantía</span></div>
    <div class="compra">
      ${items.map(x => {
        const pl = planMayorista(x), st = stockDisponible(x.id), c = M.cant[x.id] || 0;
        return `<div class="compra-item${st ? '' : ' sin'}${c ? ' con' : ''}">
          <img src="${x.card || ''}" alt="" loading="lazy">
          <div class="compra-txt">
            <b>${esc(x.nombre)}</b>
            <span>${esc(pl.etq)} · ${st ? st + ' libres' : 'agotado'}</span>
            <em>${usd(pl.precioMayorista)} <s>${usd(pl.precio)}</s></em>
          </div>
          <div class="step">
            <button data-menos="${x.id}" aria-label="Quitar uno" ${c ? '' : 'disabled'}>−</button>
            <span>${c}</span>
            <button data-mas="${x.id}" aria-label="Agregar uno" ${st > c ? '' : 'disabled'}>+</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>
  <div class="compra-bar">
    <div>
      <b>${usd(monto)}</b><span>${unidades} u.</span>
      <small class="${listo ? 'ok' : unidades && (falta || monto > saldo) ? 'falta' : ''}">${nota}</small>
    </div>
    ${monto > saldo && !falta
      ? `<button class="acc pri grande" data-recarga="1">RECARGAR SALDO</button>`
      : `<button class="acc pri grande" data-comprar="1" ${listo ? '' : 'disabled'}>COMPRAR ${unidades ? unidades + ' U.' : ''}</button>`}
  </div>`;
}

/* ── MIS CLIENTES ── */
function vistaClientes(){
  const filtros = [['todas','TODAS'],['sin','SIN ASIGNAR'],['porVencer','POR VENCER'],['vencida','VENCIDAS']];
  let lista = misUnidades().slice().sort((a, b) => {
    const na = M.nuevas.includes(a.id), nb = M.nuevas.includes(b.id);
    if (na !== nb) return na ? -1 : 1;
    return aFecha(a.vence) - aFecha(b.vence);
  });
  if (M.filtro === 'sin') lista = lista.filter(s => !s.asignadoA && estadoSuscripcion(s) !== 'vencida');
  else if (M.filtro !== 'todas') lista = lista.filter(s => estadoSuscripcion(s) === M.filtro);
  if (M.busca){
    const q = M.busca.toLowerCase();
    lista = lista.filter(s => { const cf = clienteFinal(s); return cf && cf.nombre.toLowerCase().includes(q); });
  }
  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Mis clientes</h2><span>${lista.length} de ${misUnidades().length} unidades</span></div>
    <div class="herram">
      <input class="buscador" id="mBusca" placeholder="Buscar cliente…" value="${esc(M.busca)}">
      <div class="filtros">
        ${filtros.map(([k, t]) => `<button data-filtro="${k}" aria-pressed="${M.filtro === k}">${t}</button>`).join('')}
      </div>
    </div>
    ${lista.length ? tablaUnidades(lista) : vacio('Nada con ese filtro')}
  </div>`;
}

/* ── MOVIMIENTOS ── */
function vistaMovimientos(){
  const mv = movimientosDe(YO.id);
  return `
  <div class="bloque">
    <div class="bloque-tit"><h2>Movimientos</h2><span>recargas y compras</span></div>
    ${mv.length ? `<div class="tabla-cont"><table class="t">
      <thead><tr><th>Detalle</th><th>Fecha</th><th>Estado</th><th>Monto</th></tr></thead>
      <tbody>${mv.map(m => `<tr>
        <td><span class="prin">${m.tipo === 'recarga' ? 'Recarga' : 'Compra'}</span><div class="sub">${esc(m.referencia || '')}</div></td>
        <td class="num sub">${fechaCorta(m.fecha)}</td>
        <td>${m.estado === 'pendiente' ? '<span class="chip-e e-porVencer">POR ACREDITAR</span>' : '<span class="chip-e e-neutro">LISTO</span>'}</td>
        <td class="num ${m.tipo === 'recarga' ? 'mas' : ''}">${m.tipo === 'recarga' ? '+' : '−'}${usd(m.monto)}</td>
      </tr>`).join('')}</tbody></table></div>` : vacio('Sin movimientos todavía')}
  </div>`;
}

/* ── render y eventos ── */

function pintar(){
  document.getElementById('mQuien').textContent = YO.nombre;
  pintarSaldo();
  const semana = misUnidades().filter(s => { const d = diasRestantes(s); return d >= 0 && d <= 7; }).length;
  const sin = misUnidades().filter(s => !s.asignadoA && estadoSuscripcion(s) !== 'vencida').length;
  document.getElementById('mNav').innerHTML = VISTAS_M.map(([k, t]) => {
    const n = k === 'resumen' ? semana : k === 'clientes' ? sin : 0;
    return `<button data-ir="${k}" aria-pressed="${M.vista === k}">${t}${n ? `<i>${n}</i>` : ''}</button>`;
  }).join('');
  const main = document.getElementById('mMain');
  main.innerHTML =
      M.vista === 'comprar'     ? vistaComprar()
    : M.vista === 'clientes'    ? vistaClientes()
    : M.vista === 'movimientos' ? vistaMovimientos()
    : vistaResumen();
  document.body.dataset.vista = M.vista;
  etiquetarTablas(main);
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-ir],[data-ver],[data-filtro],[data-mas],[data-menos],[data-comprar],[data-recarga],[data-monto],[data-metodo],[data-avisar-recarga],[data-asignando],[data-cancelar],[data-renovar]');
  if (!t) return;
  const d = t.dataset;

  if (d.ir){
    M.vista = d.ir; M.busca = ''; M.asignando = null;
    M.filtro = d.filtroIr || 'todas';
    window.scrollTo(0, 0); return pintar();
  }
  if (d.ver){ document.getElementById(d.ver)?.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
  if (d.filtro){ M.filtro = d.filtro; return pintar(); }

  if (d.mas){ M.cant[d.mas] = Math.min(stockDisponible(d.mas), (M.cant[d.mas] || 0) + 1); return pintar(); }
  if (d.menos){ M.cant[d.menos] = Math.max(0, (M.cant[d.menos] || 0) - 1); return pintar(); }
  if (d.comprar){
    const items = Object.entries(M.cant).map(([servicioId, cantidad]) => ({ servicioId, cantidad }));
    const r = await ocupado(t, () => ACC.comprar(YO.id, items));
    if (!r.ok) return aviso(r.motivo, 'error');
    M.cant = {}; M.nuevas = r.suscripciones.map(s => s.id);
    M.vista = 'clientes'; M.filtro = 'todas';
    aviso(r.suscripciones.length + ' unidades listas. Asignalas a tus clientes.');
    window.scrollTo(0, 0); return pintar();
  }

  if (d.recarga){ M.recarga = !M.recarga; pintar(); if (M.recarga) window.scrollTo({ top:0, behavior:'smooth' }); return; }
  if (d.monto){ M.monto = +d.monto; return pintar(); }
  if (d.metodo){ M.metodo = d.metodo; return pintar(); }
  /* El link abre WhatsApp; la recarga queda "por acreditar" hasta que
     Ale verifique la captura. */
  if (d.avisarRecarga){
    if (!(M.monto > 0)){ e.preventDefault(); return aviso('Elegí un monto', 'error'); }
    const r = await ACC.solicitarRecarga(YO.id, M.monto, M.metodo);
    if (!r.ok) return aviso(r.motivo, 'error');
    M.recarga = false;
    pintar(); aviso('Recarga avisada. Se acredita apenas la verifiquemos.');
    return;
  }

  if (d.asignando){ M.asignando = d.asignando; pintar(); document.getElementById('aNombre')?.focus(); return; }
  if (d.cancelar){ M.asignando = null; return pintar(); }
  if (d.renovar){
    const r = await ocupado(t, () => ACC.renovarConSaldo(d.renovar, 1));
    if (!r.ok) return aviso(r.motivo, 'error');
    aviso('Renovada hasta el ' + fechaCorta(r.vence) + '. Se descontó ' + usd(r.precio) + '.');
    return pintar();
  }
});

document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-asignar]');
  if (!f) return;
  e.preventDefault();
  const r = await ocupado(f.querySelector('[type=submit]'), () =>
    ACC.asignar(f.dataset.asignar, document.getElementById('aNombre').value, document.getElementById('aWa').value));
  if (!r.ok) return aviso(r.motivo, 'error');
  M.asignando = null;
  aviso('Asignada a ' + r.clienteFinal.nombre + '.');
  pintar();
});

document.addEventListener('input', e => {
  if (e.target.id === 'mMonto'){
    const v = Math.max(0, Math.round(+e.target.value || 0));
    if (v){ M.monto = v; pintarSaldo(); const n = document.getElementById('mMonto'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    return;
  }
  if (e.target.id !== 'mBusca') return;
  M.busca = e.target.value;
  const pos = e.target.selectionStart;
  pintar();
  const nuevo = document.getElementById('mBusca');
  if (nuevo){ nuevo.focus(); nuevo.setSelectionRange(pos, pos); }
});

document.getElementById('mSalir').onclick = async () => {
  try { sessionStorage.removeItem('streamve.mayorista'); } catch (e) {}
  await salir();
  location.href = 'index.html#/revendedores';
};

/* ── arranque ──
   En demo, directo. Con la base real: sesión → ¿es revendedor? → lo suyo. */
async function iniciar(){
  const main = document.getElementById('mMain');
  if (!EN_VIVO){
    pintar();
    document.body.insertAdjacentHTML('beforeend', '<a class="modo-demo" href="?demo=0">DATOS DE PRUEBA · SALIR</a>');
    return;
  }
  main.innerHTML = cargandoHTML('Revisando la sesión…');
  const ses = await sesionActual();
  if (!ses) return pantallaLogin(main, { rol:'PANEL DE REVENDEDOR' }, iniciar);
  main.innerHTML = cargandoHTML('Cargando tus unidades…');
  try { YO = await cargarMayorista(); }
  catch (e){ main.innerHTML = vacio('No se pudo cargar', motivoDe(e)); return; }
  if (!YO){
    await salir();
    return pantallaLogin(main, { rol:'PANEL DE REVENDEDOR',
      error:'Ese usuario todavía no está aprobado como revendedor. Escribinos por WhatsApp.' }, iniciar);
  }
  document.body.classList.remove('sin-sesion');
  pintar();
}

iniciar();
cargarTasa(() => { if (M.recarga && YO) pintarSaldo(); });
