/* StreamVe — portal del cliente: cuenta.html?c=CODIGO
 *
 * Lo que el cliente abre desde el link que le llega por WhatsApp. Sin
 * contraseña: el código de 10 caracteres ES la llave. Ve sus accesos,
 * cuánto le queda, y desde acá renueva o avisa que algo no anda — todo
 * termina en un mensaje de WhatsApp ya escrito.
 *
 * Depende de: ui.js, catalogo.js, datos.js
 */

const C = { ver: {}, falla: null, reportado: {} };

const codigoURL = () => (new URLSearchParams(location.search).get('c') || '').trim().toUpperCase();
const primerNombre = n => String(n).split(' ')[0];
const fechaLarga = f => { const d = aFecha(f);
  return d.toLocaleDateString('es-VE', d.getFullYear() !== HOY.getFullYear()
    ? { day:'numeric', month:'long', year:'numeric' } : { day:'numeric', month:'long' }); };

const ETQ = { activa:'ACTIVA', porVencer:'POR VENCER', vencida:'VENCIDA', cancelada:'CANCELADA' };

/* Los servicios de video piden a veces un código al entrar desde un
   televisor nuevo. La música y el anime, no. */
const pideCodigo = sv => sv && sv.cat === 'VIDEO';

const FALLAS = [
  'No me deja entrar',
  'Me pide código de hogar',
  'Dice que hay demasiadas pantallas',
  'Otro problema'
];

/* ── pantallas ── */

function vistaEntrar(error){
  return `
  <section class="c-entrar">
    <div class="c-entrar-bg"></div>
    <div class="c-entrar-in">
      <div class="kicker">MI CUENTA</div>
      <h1 class="display">Tus pantallas,<br>en un solo link.</h1>
      <p>Entrá con el código que te mandamos por WhatsApp junto con tu acceso.</p>
      <form class="c-form" data-entrar="1">
        <input id="cCodigo" name="c" maxlength="10" autocomplete="off" autocapitalize="characters"
               spellcheck="false" placeholder="TU CÓDIGO" value="${esc(codigoURL())}" aria-label="Tu código">
        <button class="btn btn-primary" type="submit">ENTRAR</button>
      </form>
      ${error ? `<p class="c-error">${esc(error)}</p>` : ''}
      <a class="c-ayuda-link" target="_blank" rel="noopener"
         href="${waLink('Hola, no encuentro el código de mi cuenta StreamVe.')}">${ICONO_WA}¿No tenés tu código? Escribinos</a>
    </div>
  </section>`;
}

/* 30 marcas, una por día del ciclo: el tiempo se ve antes de leerse */
function ticksHTML(s, e){
  const total = OP.diasPorMes * (s.meses || 1);
  const llenos = Math.max(0, Math.min(30, Math.round(30 * diasRestantes(s) / total)));
  return `<div class="c-ticks t-${e}" aria-hidden="true">${
    Array.from({ length: 30 }, (_, i) => `<i${i < llenos ? ' class="on"' : ''}></i>`).join('')}</div>`;
}

function credHTML(s){
  const a = accesoDe(s);
  if (!a) return '';
  const ver = C.ver[s.id];
  return `<div class="c-cred">
    <div class="c-cred-fila">
      <span>Correo</span><b>${esc(a.correo)}</b>
      <button class="copiar" data-copiar="${esc(a.correo)}">COPIAR</button>
    </div>
    <div class="c-cred-fila">
      <span>Clave</span><b class="${ver ? '' : 'oculta'}">${ver ? esc(a.clave) : '••••••••'}</b>
      <div class="c-cred-dos">
        <button class="copiar ver" data-ver="${s.id}">${ver ? 'OCULTAR' : 'VER'}</button>
        <button class="copiar" data-copiar="${esc(a.clave)}">COPIAR</button>
      </div>
    </div>
    <div class="c-cred-fila">
      <span>Perfil</span><b>${esc(a.perfil)}${a.pin ? ` <em>PIN ${esc(a.pin)}</em>` : ''}</b>
      ${a.pin ? `<button class="copiar" data-copiar="${esc(a.pin)}">COPIAR PIN</button>` : '<i></i>'}
    </div>
  </div>`;
}

function tarjetaHTML(s, cli){
  const sv = servicioDeSuscripcion(s) || { id:'', nombre:'—', color:'#666', card:'' };
  const e  = estadoSuscripcion(s);
  const d  = diasRestantes(s);
  const pl = planDe(sv.id, s.planClave) || { etq:s.planClave, precio:s.precio };
  const mayor = cli.tipo === 'mayorista';
  const p1  = precioVenta(pl, 1, mayor), p12 = precioVenta(pl, 12, mayor);
  const ref = sv.nombre + ' · ' + pl.etq;
  const renovarMsg = m => waLink(
    'Hola, quiero renovar mi *' + ref + '* por ' + (m === 12 ? '12 meses' : '1 mes') + '.\n' +
    (d >= 0 ? 'Vence el ' + fechaLarga(s.vence) : 'Venció el ' + fechaLarga(s.vence)) + '.\n' +
    'Total: ' + usd(m === 12 ? p12 : p1) + '\nMi código: ' + cli.codigoAcceso);
  const a = accesoDe(s) || {};

  const reloj = e === 'vencida'
    ? `<b>0</b><div><span>VENCIÓ</span><em>${esc(comoFalta(s.vence).replace('venció ', ''))} · el ${esc(fechaLarga(s.vence))}</em></div>`
    : d === 0
    ? `<b class="hoy">HOY</b><div><span>VENCE HOY</span><em>Renová para no quedarte sin pantalla</em></div>`
    : `<b>${d}</b><div><span>${d === 1 ? 'DÍA RESTANTE' : 'DÍAS RESTANTES'}</span><em>Vence el ${esc(fechaLarga(s.vence))}</em></div>`;

  return `
  <article class="c-sus est-${e}" style="--brand:${sv.color}">
    <div class="c-sus-arte">
      <div class="ficha-blur" style="background-image:url('${sv.card || ''}')"></div>
      <img src="${sv.card || ''}" alt="${esc(sv.nombre)}" onerror="this.style.visibility='hidden'">
    </div>
    <div class="c-sus-cuerpo">
      <header class="c-sus-cab">
        <div><h2>${esc(sv.nombre)}</h2><span>${esc(pl.etq)}${s.reposiciones ? ' · repuesta ' + s.reposiciones + (s.reposiciones > 1 ? ' veces' : ' vez') : ''}</span></div>
        <span class="c-chip e-${e}">${ETQ[e]}</span>
      </header>

      <div class="c-reloj">${reloj}</div>
      ${ticksHTML(s, e)}

      ${e === 'vencida'
        ? `<p class="c-vencida">Tu acceso está en pausa. Renová y te lo reactivamos con la misma clave.</p>`
        : credHTML(s)}

      <div class="c-acc">
        <a class="btn btn-primary" target="_blank" rel="noopener" href="${renovarMsg(1)}">RENOVAR · ${usd(p1)}</a>
        ${e !== 'vencida' && pideCodigo(sv) ? `<a class="btn btn-line" target="_blank" rel="noopener"
            href="${waLink('Hola, ' + sv.nombre + ' me pide un código para entrar.\n' + (a.perfil || '') + '\nMi código: ' + cli.codigoAcceso)}">PEDIR CÓDIGO</a>` : ''}
        ${e !== 'vencida' ? `<button class="btn btn-line" data-falla="${s.id}" aria-expanded="${C.falla === s.id}">NO ME FUNCIONA</button>` : ''}
      </div>
      <a class="c-anual" target="_blank" rel="noopener" href="${renovarMsg(12)}">o 12 meses por ${usd(p12)} <b>−${Math.round(CFG.descuentoAnual * 100)}%</b></a>

      ${C.reportado[s.id] ? `
        <div class="c-reporte ok"><i></i><span><b>Reportado.</b> Te respondemos por WhatsApp en menos de una hora${abiertoAhora() ? '' : ', a partir de las ' + hora12(CFG.abreHora)}.</span></div>`
      : C.falla === s.id ? `
        <div class="c-reporte">
          <b>¿Qué pasa?</b>
          <div class="c-fallas">${FALLAS.map(f => `
            <a target="_blank" rel="noopener" data-reportar="${s.id}" data-causa="${esc(f)}"
               href="${waLink('Hola, mi *' + ref + '* no funciona: ' + f.toLowerCase() + '.\n' + (a.perfil || '') + '\nMi código: ' + cli.codigoAcceso)}">${esc(f)}</a>`).join('')}
          </div>
        </div>` : ''}
    </div>
  </article>`;
}

const ICONO_EV = { compra:'+', renovacion:'↻', reposicion:'✓', incidencia:'!' };

function vistaPortal(cli){
  const ss = suscripcionesDe(cli.id).filter(s => estadoSuscripcion(s) !== 'cancelada')
    .sort((a, b) => {
      /* Las vencidas al final; el resto, lo que vence primero arriba */
      const va = estadoSuscripcion(a) === 'vencida', vb = estadoSuscripcion(b) === 'vencida';
      if (va !== vb) return va ? 1 : -1;
      return aFecha(a.vence) - aFecha(b.vence);
    });
  const vivas = ss.filter(s => estadoSuscripcion(s) !== 'vencida');
  const prox  = vivas[0];
  const resumen = !ss.length ? 'Todavía no tenés accesos activos.'
    : !vivas.length ? 'Tus accesos están vencidos. Renovalos y siguen con la misma clave.'
    : vivas.length === 1 ? 'Tenés un acceso activo. ' + (diasRestantes(prox) <= OP.avisarDiasAntes ? 'Vence pronto: ' + comoFalta(prox.vence) + '.' : 'Todo en orden.')
    : 'Tenés ' + vivas.length + ' accesos activos. El próximo ' + comoFalta(prox.vence).replace('en ', 'vence en ') + '.';
  const hist = historialDe(cli.id).slice(0, 12);

  return `
  <section class="c-hola">
    <div class="kicker">MI CUENTA · <span class="c-cod">${esc(cli.codigoAcceso)}</span></div>
    <h1 class="display">Hola, ${esc(primerNombre(cli.nombre))}.</h1>
    <p class="c-resumen">${esc(resumen)}</p>
    ${cli.tipo === 'mayorista' ? `<a class="c-mayor" href="mayorista.html">Sos revendedor: tu panel con tus clientes está acá →</a>` : ''}
  </section>

  <section class="c-lista">
    ${ss.length ? ss.map(s => tarjetaHTML(s, cli)).join('') : `
      <div class="c-vacio"><b>Sin accesos todavía</b><a class="btn btn-primary" href="index.html#/catalogo">VER CATÁLOGO</a></div>`}
  </section>

  <div class="c-dos">
    <section class="c-bloque">
      <h2 class="c-tit">HISTORIAL</h2>
      ${hist.length ? `<ol class="c-linea">${hist.map(ev => `
        <li class="ev-${ev.tipo}">
          <i>${ICONO_EV[ev.tipo] || '·'}</i>
          <div><b>${esc(ev.texto)}</b><span>${esc(fechaCorta(ev.fecha))}</span></div>
          ${ev.monto != null ? `<em>${usd(ev.monto)}</em>` : ''}
        </li>`).join('')}</ol>` : '<p class="c-nada">Nada por acá todavía.</p>'}
    </section>

    <section class="c-bloque">
      <h2 class="c-tit">PARA QUE NO SE CAIGA</h2>
      <ol class="c-reglas">
        <li><b>No cambies la contraseña</b><span>La cuenta es compartida: si se cambia, se cae para todos y se pierde la garantía.</span></li>
        <li><b>Usá solo tu perfil</b><span>Tu perfil y tu PIN son tuyos. Los de los demás, no se tocan.</span></li>
        <li><b>Una pantalla, un dispositivo</b><span>A la vez. Si necesitás más, pedí otra pantalla.</span></li>
      </ol>
      <div class="c-guardar">
        <div><b>Guardá este link</b><span>Es tu acceso: con él ves tus cuentas desde cualquier teléfono.</span></div>
        <button class="copiar" data-copiar="${esc(linkPortal(cli))}">COPIAR LINK</button>
      </div>
    </section>
  </div>`;
}

/* ── render y eventos ── */

/* Con la base real, el portal se trae una sola vez por código */
let CARGADO = null;
async function cargar(){
  const cod = codigoURL();
  if (!EN_VIVO || !cod) return;
  document.getElementById('cuenta').innerHTML = '<div class="c-cargando"><i></i>Buscando tu cuenta…</div>';
  try { CARGADO = await cargarPortal(cod); }
  catch (e) { CARGADO = null; }
}

function pintar(){
  const cod = codigoURL();
  const cli = cod && (EN_VIVO ? CARGADO : clientePorCodigo(cod));
  const main = document.getElementById('cuenta');
  document.body.classList.toggle('c-sin', !cli);
  if (!cli){
    main.innerHTML = vistaEntrar(cod ? 'No encontramos ese código. Revisalo, o escribinos y te lo reenviamos.' : '');
    return;
  }
  document.title = primerNombre(cli.nombre) + ' · Mi cuenta · StreamVe';
  main.innerHTML = vistaPortal(cli);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-ver],[data-falla],[data-reportar]');
  if (!t) return;
  const d = t.dataset;
  if (d.ver){ C.ver[d.ver] = !C.ver[d.ver]; return pintar(); }
  if (d.falla){ C.falla = C.falla === d.falla ? null : d.falla; return pintar(); }
  /* El link de WhatsApp se abre igual; además queda la incidencia abierta
     para que aparezca en el panel de Ale. */
  if (d.reportar){
    ACC.reportar(codigoURL(), d.reportar, d.causa);
    C.reportado[d.reportar] = true; C.falla = null;
    setTimeout(pintar, 300);
  }
});

document.addEventListener('submit', e => {
  if (!e.target.matches('[data-entrar]')) return;
  e.preventDefault();
  const v = document.getElementById('cCodigo').value.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (v) location.search = '?c=' + encodeURIComponent(v);
});

document.getElementById('cWa').innerHTML = ICONO_WA;
document.getElementById('cWa').href = waLink('Hola, tengo una consulta sobre mi cuenta.');
cargar().then(pintar);
