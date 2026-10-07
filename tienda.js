/* StreamVe — la tienda: rutas, vistas y eventos.
   Depende de ui.js, catalogo.js y datos.js.

   La venta se cierra por WhatsApp: la web arma el pedido completo y lo
   deja escrito en el chat. Ale atiende ahí; la web solo le ahorra el
   ida y vuelta de "¿cuánto es?", "¿a dónde pago?". */

/* ── estado ── */
const S = {
  pantalla:'home', anterior:null, sid:'nx', planK:'pantalla', meses:1,
  metodo:'binance', filtro:'Todo', codigo:null, codigoDe:'', enviado:false
};

const svc  = () => CAT.find(s => s.id === S.sid) || CAT[0];
const plan = () => { const s = svc(); return s.planes.find(p => p.k === S.planK) || s.planes[0]; };
const totalActual = () => {
  const bruto = plan().precio * (S.meses === 12 ? 12 : 1);
  return S.meses === 12 ? bruto * (1 - CFG.descuentoAnual) : bruto;
};
const mesesTxt = m => m === 12 ? '12 meses' : '1 mes';
const desdeDe = x => Math.min.apply(null, x.planes.map(p => p.precio));

/* El plan que se abre primero: el más barato que tenga stock */
function planInicial(x){
  const orden = x.planes.slice().sort((a, b) => a.precio - b.precio);
  return (orden.find(pl => stockPlan(x.id, pl.k) > 0) || orden[0]).k;
}

/* ═══ rutas ═══
   Cada pantalla tiene su link: Ale puede mandar por WhatsApp
   streamve.vercel.app/#/netflix y el cliente cae directo en la ficha. */
function rutaDe(p){
  const x = svc();
  return p === 'catalogo'  ? '#/catalogo'
       : p === 'mayorista' ? '#/revendedores'
       : p === 'detalle'   ? '#/' + x.slug
       : p === 'pedido'    ? '#/' + x.slug + '/pedido'
       : '#/';
}

function ir(p){
  const h = rutaDe(p);
  if (location.hash === h) aplicarRuta();
  else location.hash = h;            // dispara hashchange → aplicarRuta
}

function aplicarRuta(){
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let p = 'home';
  if (partes[0] === 'catalogo') p = 'catalogo';
  else if (partes[0] === 'revendedores') p = 'mayorista';
  else if (partes[0]){
    const x = CAT.find(s => s.slug === partes[0]);
    if (x){
      if (S.sid !== x.id){ S.sid = x.id; S.planK = planInicial(x); S.meses = 1; }
      p = partes[1] === 'pedido' ? 'pedido' : 'detalle';
    }
  }
  /* Un código por pedido: si cambia el servicio, el plan o los meses, es
     otro pedido y lleva otro código. */
  if (p === 'pedido'){
    const clave = S.sid + S.planK + S.meses;
    if (!S.codigo || S.codigoDe !== clave){
      /* Con la base real el número lo pone la base, al tocar "Enviar" */
      S.codigo = EN_VIVO ? null : 'SV-' + (4100 + Math.floor(Math.random() * 5800));
      S.codigoDe = clave; S.enviado = false;
    }
  }
  if (p !== S.pantalla) S.anterior = S.pantalla;
  S.pantalla = p;
  window.scrollTo(0, 0);
  render();
}
window.addEventListener('hashchange', aplicarRuta);

/* ── piezas ── */

function artHTML(x, i, veil){
  /* Si el servicio trae `card`, esa imagen ES el tile completo: tarjeta,
     fondo y todo. No se compone nada encima. */
  if (x.card) return `
    <div class="art-bg art-card" style="background-image:url('${x.card}')"></div>
    <div class="${veil || 'art-veil'}" style="opacity:.45"></div>`;

  const tono = ['#b3aca8','#c2bbb6','#a29b98','#cac2bc','#98918e','#b8b0ac','#a8a09c'][i % 7];
  const base = `radial-gradient(120% 92% at ${58 + i * 6}% 10%, ${tono} 0%, #6b6461 34%, #302c2b 66%, #141211 92%)`;
  /* La foto va como primera capa. Si el archivo todavía no existe, el
     navegador simplemente no la pinta y quedan la trama y el degradado. */
  const capas = (x.img ? `url('${x.img}'), ` : '') + TRAMAS[i % 7] + ', ' + base;
  return `
    <div class="art-bg grain" style="background-image:${capas}"></div>
    <div class="art-tint" style="background:${x.color}"></div>
    <div class="art-glow"></div>
    <div class="${veil || 'art-veil'}"></div>
    <div class="gcard" style="--brand:${x.color}">
      <span class="gcard-notch"></span>
      <span class="gcard-word">${esc(x.nombre)}</span>
      <img class="gcard-logo" src="${x.logo}" alt="${esc(x.nombre)}" loading="lazy"
           onload="this.previousElementSibling.style.display='none';this.style.display='block'">
    </div>`;
}

function tileHTML(x, i){
  const st = stockDe(x), bajo = st <= 5;
  const badge = st === 0 ? 'AGOTADO' : bajo ? 'QUEDAN ' + st : st + ' LIBRES';
  const micro = CFG.garantiaDias + 'd · ' + CFG.ventanaEntrega + ' · ' + (x.renovable ? 'renovable' : 'no renovable');
  return `<a class="tile rise" href="${'#/' + x.slug}" style="animation-delay:${Math.min(i, 7) * 45}ms">
    <div class="art">
      ${artHTML(x, i)}
      <span class="art-badge${st === 0 ? ' agotado' : bajo ? ' bajo' : ''}">${badge}</span>
    </div>
    <div class="tile-foot">
      <div class="tile-name">${esc(x.nombre)}</div>
      <div class="tile-price"><b>${usd(desdeDe(x))}<small> /mes</small></b><em>VER →</em></div>
      <div class="tile-micro">${esc(micro)}</div>
      <div class="tile-desc"><p>${esc(DESC[x.id] || '')}</p></div>
    </div>
  </a>`;
}

/* ═══ pantallas ═══ */

const PREGUNTAS = [
  ['¿Qué pasa si mi cuenta deja de funcionar?',
   `Nos escribís y la reponemos en menos de una hora, dentro de los ${CFG.garantiaDias} días de garantía. Te damos otro acceso y tu fecha de vencimiento queda igual.`],
  ['¿Cómo renuevo?',
   'Te avisamos por WhatsApp tres días antes de que venza. Pagás y seguís con la misma clave: no reconfigurás el televisor ni reinstalás nada.'],
  ['¿Puedo ponerle PIN a mi perfil?',
   'Sí. La pantalla es tuya: tu perfil y tu PIN. Lo único que no se toca es la contraseña de la cuenta ni los perfiles de los demás: eso hace que la cuenta se caiga para todos.'],
  ['¿Cómo pago?',
   'Por Binance en USDT o por Pago Móvil en bolívares, a la tasa BCV del día. Pagás, mandás la captura por WhatsApp y listo.'],
  ['¿En qué dispositivos funciona?',
   'Televisor, teléfono, tablet y computadora. Una pantalla es un dispositivo a la vez; si querés ver en varios al mismo tiempo, te conviene la cuenta completa.'],
  ['¿Ustedes son Netflix o las otras plataformas?',
   'No. Somos revendedores independientes: compramos las cuentas, las administramos y respondemos por ellas para que vos solo te ocupes de ver.']
];

function vistaHome(){
  const total = CAT.reduce((a, x) => a + stockDe(x), 0);
  const pick = ids => ids.map(id => CAT.find(x => x.id === id));
  const rails = [
    { t:'PELÍCULAS Y SERIES', n:'5 servicios', items:pick(['nx','dp','mx','pv','pp']) },
    { t:'MÚSICA Y ANIME',     n:'renovable',   items:pick(['sp','cr']) }
  ];
  return `
  <section class="hero">
    <div class="hero-art grain"></div>
    <video class="hero-video" src="assets/hero.mp4" poster="assets/hero.webp"
           autoplay muted loop playsinline preload="auto"></video>
    <div class="hero-grid"></div><div class="hero-veil"></div>
    <button class="hero-sound" data-sonido="1" aria-label="Activar sonido"></button>
    <div class="hero-inner">
      <h1 class="display rise">NO SE<br>CAE.</h1>
      ${total ? `<div><span class="stock-flag">EN STOCK AHORA · ${total} UNIDADES</span></div>` : ''}
      <div class="hero-chips">
        <span class="chip">${CFG.garantiaDias} DÍAS DE GARANTÍA</span>
        <span class="chip">ENTREGA ${esc(CFG.ventanaEntrega)}</span>
        <span class="chip">RENOVABLE</span>
      </div>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#/catalogo">VER CATÁLOGO</a>
        <a class="btn btn-line" href="${waLink('Hola, quiero preguntar por una cuenta.')}" target="_blank" rel="noopener">${ICONO_WA}WHATSAPP</a>
      </div>
    </div>
  </section>
  <div class="ticker" aria-label="Nuestras condiciones">
    <div class="ticker-pista">${(() => {
      const its = [
        ['GARANTÍA', CFG.garantiaDias + ' días', 'Si se cae, la reponemos'],
        ['REPOSICIÓN', 'Menos de 1 h', 'No esperás al día siguiente'],
        ['RENOVACIÓN', 'Misma clave', 'No reconfigurás el televisor'],
        ['ENTREGA', CFG.ventanaEntrega, 'A mano, no un robot'],
        ['ATENCIÓN', hora12(CFG.abreHora) + ' a ' + hora12(CFG.cierraHora), 'Todos los días, hora de Venezuela'],
        ['PAGOS', 'Binance y Pago Móvil', 'En dólares o en bolívares']
      ].map(([u, b, e]) => `<span class="tk"><u>${esc(u)}</u><b>${esc(b)}</b><em>${esc(e)}</em></span>`).join('');
      return its + its;   /* duplicado: el bucle no tiene salto */
    })()}</div>
  </div>
  ${rails.map((r, ri) => `
    <div class="rail-head"><b>${r.t}</b><span>${r.n}</span></div>
    <div class="rail-wrap">
      <button class="rail-nav prev" data-scroll="${ri}" data-dir="-1" aria-label="Ver anteriores">‹</button>
      <div class="rail" id="rail-${ri}">${r.items.map(x => tileHTML(x, CAT.indexOf(x))).join('')}</div>
      <button class="rail-nav next" data-scroll="${ri}" data-dir="1" aria-label="Ver siguientes">›</button>
    </div>
  `).join('')}
  <section class="flujo">
    <div class="flujo-head">
      <span class="kicker">CÓMO FUNCIONA</span>
      <h2 class="display">De tu pago a tu pantalla<br>en menos de veinte minutos.</h2>
    </div>
    <ol class="pasos">
      <li><em>MINUTO 0</em><i>01</i><b>Pagás</b><p>Binance en dólares o Pago Móvil en bolívares. Mandás la captura por WhatsApp.</p></li>
      <li><em>${esc(CFG.ventanaEntrega).toUpperCase()}</em><i>02</i><b>Entregamos</b><p>A mano, revisada antes de mandártela. No es un robot escupiendo claves.</p></li>
      <li><em>AL INSTANTE</em><i>03</i><b>Ves</b><p>En el televisor, en el teléfono y en la computadora. Donde quieras.</p></li>
      <li><em>CADA MES</em><i>04</i><b>Renovamos</b><p>Con la misma clave. No reconfigurás nada, no reinstalás nada.</p></li>
    </ol>
  </section>
  <section class="faq">
    <div class="faq-head">
      <span class="kicker">PREGUNTAS</span>
      <h2 class="display">Lo que todos<br>preguntan primero.</h2>
      <p>¿Te quedó otra duda? <a href="${waLink('Hola, tengo una pregunta.')}" target="_blank" rel="noopener">Escribinos</a> y te contesta una persona.</p>
    </div>
    <div class="faq-lista">
      ${PREGUNTAS.map(([q, a], i) => `
        <details${i === 0 ? ' open' : ''}>
          <summary><span>${String(i + 1).padStart(2, '0')}</span>${esc(q)}<i aria-hidden="true"></i></summary>
          <p>${esc(a)}</p>
        </details>`).join('')}
    </div>
  </section>`;
}

function vistaCatalogo(){
  const cats = ['Todo','VIDEO','MÚSICA','ANIME'];
  const lista = CAT.filter(x => S.filtro === 'Todo' || x.cat === S.filtro);
  const libres = lista.reduce((a, x) => a + stockDe(x), 0);
  return `
  <div class="cat-head">
    <div>
      <span class="kicker">CATÁLOGO</span>
      <h1 class="display">Elegí qué<br>vas a ver.</h1>
    </div>
    <p><b>${lista.length}</b> servicios · <b>${libres}</b> unidades libres ahora</p>
  </div>
  <div class="filters">
    ${cats.map(c => `<button data-filtro="${esc(c)}" aria-pressed="${S.filtro === c}">${c === 'Todo' ? 'TODO' : c}</button>`).join('')}
  </div>
  <div class="grid">${lista.map(x => tileHTML(x, CAT.indexOf(x))).join('')}</div>`;
}

/* Qué te llevás con cada plan, en una línea */
const PLAN_DESC = {
  pantalla:'Una pantalla con tu propio perfil y PIN.',
  individual:'Una cuenta Premium solo para vos.',
  completa:'La cuenta entera. Vos controlás la clave y los perfiles.'
};

function vistaDetalle(){
  const x = svc(), p = plan();
  const t = totalActual();
  const arte = x.card || '';
  const ahorro = p.precio * 12 * CFG.descuentoAnual;
  const stP = stockPlan(x.id, p.k);

  return `
  <div class="ficha">
    <div class="ficha-art">
      <div class="ficha-blur" style="background-image:url('${arte}')"></div>
      <img src="${arte}" alt="${esc(x.nombre)}" onerror="this.style.visibility='hidden'">
    </div>

    <div class="ficha-info">
      <button class="ficha-cerrar" data-cerrar="1" aria-label="Volver">✕</button>
      <div class="kicker">${esc(x.cat)}</div>
      <h2 class="display">${esc(x.nombre)}</h2>
      <p class="ficha-desc">${esc(DESC[x.id] || '')}</p>

      <div class="ficha-datos">
        <div><small>GARANTÍA</small><b>${CFG.garantiaDias} días</b></div>
        <div><small>ENTREGA</small><b>${esc(CFG.ventanaEntrega)}</b></div>
        <div><small>RENOVABLE</small><b class="${x.renovable ? '' : 'no'}">${x.renovable ? 'Sí' : 'No'}</b></div>
        <div><small>QUEDAN</small><b class="${stP <= 5 ? 'poco' : ''}">${stP ? stP + ' u.' : 'Agotado'}</b></div>
      </div>

      <h3 class="ficha-tit">ELEGÍ TU ACCESO</h3>
      <div class="planes">
        ${x.planes.map(pl => { const st = stockPlan(x.id, pl.k); return `
          <button class="plan${st ? '' : ' sin'}" data-plan="${pl.k}" aria-pressed="${pl.k === p.k}">
            <span class="plan-marca"></span>
            <span class="plan-txt">
              <b>${esc(pl.etq)}</b>
              <em>${esc(PLAN_DESC[pl.k] || '')}</em>
              <i>${st === 0 ? 'Agotado por ahora' : st <= 5 ? 'Quedan ' + st : st + ' disponibles'}</i>
            </span>
            <span class="plan-precio">${usd(pl.precio)}<small>/mes</small></span>
          </button>`; }).join('')}
      </div>

      <h3 class="ficha-tit">POR CUÁNTO TIEMPO</h3>
      <div class="periodo">
        <button data-meses="1" aria-pressed="${S.meses === 1}">
          <b>1 mes</b><em>Renovás cuando quieras</em>
        </button>
        <button data-meses="12" aria-pressed="${S.meses === 12}">
          <b>12 meses</b><em>Ahorrás ${usd(ahorro)} en el año</em>
          <span class="badge">−${Math.round(CFG.descuentoAnual * 100)}%</span>
        </button>
      </div>
    </div>
  </div>

  <div class="paybar">
    <div>
      <div class="amt">${usd(t)}</div>
      ${CFG.mostrarBolivares ? `<small>${bs(t)} · ${mesesTxt(S.meses)} · tasa BCV ${tasaTxt()}</small>` : ''}
    </div>
    ${stP
      ? `<a class="btn btn-primary paybar-cta" href="${rutaDe('pedido')}">COMPRAR</a>`
      : `<a class="btn btn-line paybar-cta" target="_blank" rel="noopener"
           href="${waLink('Hola, ¿cuándo vuelven a tener ' + x.nombre + ' (' + p.etq + ')?')}">AVISARME CUANDO HAYA</a>`}
  </div>`;
}

/* ── Tu pedido ──
   Antes eran dos pantallas (pago y pedido) con un formulario de referencia
   en el medio. Ahora es una sola, en tres pasos, y termina en WhatsApp:
   el cliente escribe desde su número y la captura va en el mismo chat. */
function mensajePedido(){
  const x = svc(), p = plan(), t = totalActual(), bin = S.metodo === 'binance';
  return [
    'Hola StreamVe, quiero hacer este pedido:',
    '',
    '*Pedido ' + (S.codigo || 'nuevo') + '*',
    x.nombre + ' · ' + p.etq + ' · ' + mesesTxt(S.meses),
    'Total: ' + (bin ? usd(t) + ' en USDT' : bs(t) + ' (tasa BCV ' + tasaTxt() + ')'),
    'Pago: ' + (bin ? 'Binance' : 'Pago Móvil'),
    '',
    'Te mando la captura del pago.'
  ].join('\n');
}

function filaCobro(etq, valor, pegar){
  return `<div class="cobro-fila">
    <span>${esc(etq)}</span>
    <b>${esc(valor)}</b>
    ${pegar ? `<button class="copiar" data-copiar="${esc(pegar)}">COPIAR</button>` : '<i></i>'}
  </div>`;
}

function vistaPedido(){
  const x = svc(), p = plan(), t = totalActual();
  const bin = S.metodo === 'binance';
  const abierto = abiertoAhora();
  const hora = new Date().toLocaleTimeString('es-VE',
    { hour:'numeric', minute:'2-digit', timeZone:'America/Caracas' });
  const msg = mensajePedido();

  return `
  <div class="pedido">
    <aside class="pedido-res">
      <div class="pedido-arte">
        <div class="ficha-blur" style="background-image:url('${x.card || ''}')"></div>
        <img src="${x.card || ''}" alt="${esc(x.nombre)}" onerror="this.style.visibility='hidden'">
      </div>
      <div class="pedido-res-txt">
        <div class="kicker">${S.codigo ? 'PEDIDO ' + esc(S.codigo) : 'TU PEDIDO'}</div>
        <h1 class="display">${esc(x.nombre)}</h1>
        <dl class="pedido-lin">
          <div><dt>Acceso</dt><dd>${esc(p.etq)}</dd></div>
          <div><dt>Tiempo</dt><dd>${mesesTxt(S.meses)}${S.meses === 12 ? ` <s>${usd(p.precio * 12)}</s>` : ''}</dd></div>
          <div><dt>Garantía</dt><dd>${CFG.garantiaDias} días</dd></div>
          <div><dt>Entrega</dt><dd>${esc(CFG.ventanaEntrega)}</dd></div>
        </dl>
        <div class="pedido-total">
          <small>TOTAL</small>
          <b>${usd(t)}</b>
          <span>${bs(t)} · tasa BCV ${tasaTxt()}</span>
        </div>
        <a class="pedido-cambiar" href="${rutaDe('detalle')}">← Cambiar plan o tiempo</a>
      </div>
    </aside>

    <ol class="pedido-pasos">
      <li class="paso">
        <div class="paso-num">1</div>
        <div class="paso-cuerpo">
          <h2>Pagá</h2>
          <p class="paso-sub">Elegí cómo. Los datos se copian con un toque.</p>
          <div class="metodos">
            <button data-metodo="binance" aria-pressed="${bin}">
              <span class="metodo-tag" style="--c:#F0B90B">USDT</span>
              <b>Binance</b><em>Binance Pay o depósito BEP20</em>
            </button>
            <button data-metodo="pm" aria-pressed="${!bin}">
              <span class="metodo-tag" style="--c:#5fbf7a">Bs</span>
              <b>Pago Móvil</b><em>En bolívares, tasa BCV del día</em>
            </button>
          </div>
          <div class="cobro">
            ${bin ? `
              ${filaCobro('Correo Binance Pay', CFG.binanceCorreo, CFG.binanceCorreo)}
              ${filaCobro('Pay ID', CFG.binancePayId, CFG.binancePayId.replace(/\s/g, ''))}
              ${filaCobro('Red', CFG.binanceRed)}
            ` : `
              ${filaCobro('Banco', CFG.pmBanco, CFG.pmBanco.slice(0, 4))}
              ${filaCobro('Teléfono', CFG.pmTelefono, CFG.pmTelefono.replace(/\s/g, ''))}
              ${filaCobro('Cédula', CFG.pmCedula, CFG.pmCedula.replace(/[^\dVEJ]/gi, ''))}
            `}
            <div class="cobro-monto">
              <span>Monto exacto</span>
              <b>${bin ? usd(t).replace('$', '') + ' <small>USDT</small>' : bs(t)}</b>
              <button class="copiar" data-copiar="${bin ? t.toFixed(2) : montoPegable(t * CFG.tasaBs)}">COPIAR</button>
            </div>
          </div>
        </div>
      </li>

      <li class="paso">
        <div class="paso-num">2</div>
        <div class="paso-cuerpo">
          <h2>Mandá el pedido</h2>
          <p class="paso-sub">Se abre WhatsApp con este mensaje listo. Adjuntá la captura y enviá.</p>
          <div class="chat">
            <div class="chat-burbuja">
              ${burbujaHTML(msg)}
              <span class="chat-meta">${esc(hora)} <svg viewBox="0 0 16 11" aria-hidden="true"><path d="M11.1.3 5.4 7.6 2.8 5.2l-.9 1 3.6 3.4L12.1 1.2zM15 .3 9.3 7.6l-.6-.5-.9 1 1.6 1.5L16 1.2z"/></svg></span>
            </div>
          </div>
          <a class="btn-wa" data-enviado="1" href="${waLink(msg)}" target="_blank" rel="noopener">
            ${ICONO_WA}<span>${S.enviado ? 'ABRIR WHATSAPP DE NUEVO' : 'ENVIAR POR WHATSAPP'}</span>
          </a>
        </div>
      </li>

      <li class="paso">
        <div class="paso-num">3</div>
        <div class="paso-cuerpo">
          <h2>Recibís</h2>
          <p class="paso-sub">Por el mismo chat, en ${esc(CFG.ventanaEntrega)}: tu acceso y tu link personal para ver cuándo vence y renovar con un toque.</p>
          <div class="estado-at ${abierto ? 'abierto' : 'cerrado'}">
            <i></i>
            ${abierto
              ? `<span><b>Estamos atendiendo.</b> Hasta las ${hora12(CFG.cierraHora)}, hora de Venezuela.</span>`
              : `<span><b>Ahora estamos cerrados.</b> Abrimos a las ${hora12(CFG.abreHora)} y tu pedido es el primero de la fila.</span>`}
          </div>
        </div>
      </li>
    </ol>
  </div>

  <div class="paybar paybar-movil">
    <div><div class="amt">${usd(t)}</div><small>${bs(t)}</small></div>
    <a class="btn-wa compacto" data-enviado="1" href="${waLink(msg)}" target="_blank" rel="noopener">${ICONO_WA}<span>ENVIAR PEDIDO</span></a>
  </div>`;
}

/* ── Revendedores ──
   No se muestran los precios mayoristas acá: los ve cualquiera, y el que
   compra una pantalla no tiene por qué ver el precio del revendedor. */
function vistaMayorista(){
  /* Redondeado hacia abajo, de a 5: "hasta 25%" se lee mejor que "26%" y
     nunca promete más de lo que hay. */
  const ahorro = 5 * Math.floor(20 * Math.max.apply(null, CAT.flatMap(x =>
    x.planes.filter(p => p.precioMayorista).map(p => 1 - p.precioMayorista / p.precio))));
  return `
  <section class="reve">
    <div class="reve-bg"></div>
    <div class="reve-veil"></div>
    <div class="reve-in">
      <div class="reve-pitch">
        <div class="kicker">REVENDEDORES · DESDE ${CFG.minMayorista} U.</div>
        <h1 class="display">Vendé vos.<br>Nosotros<br>respondemos.</h1>
        <ul class="reve-puntos">
          <li><b>Hasta ${ahorro}% menos</b><span>por unidad que el precio público.</span></li>
          <li><b>Entrega al instante</b><span>Comprás con saldo y la cuenta ya está asignada.</span></li>
          <li><b>Tu propio panel</b><span>A quién le vendiste cada cuenta y cuándo vence.</span></li>
          <li><b>La garantía es nuestra</b><span>Si se cae, la reponemos nosotros, no vos.</span></li>
        </ul>
        <a class="btn btn-line" target="_blank" rel="noopener"
           href="${waLink('Hola, quiero ser revendedor de StreamVe.')}">${ICONO_WA}QUIERO SER REVENDEDOR</a>
      </div>

      <form class="reve-login" data-login="1" autocomplete="on">
        <b>Ya tengo cuenta</b>
        <label>Usuario<input id="fUser" name="usuario" value="distribuidora.oriente" autocomplete="username"></label>
        <label>Contraseña<input id="fPass" name="clave" type="password" value="demo1234" autocomplete="current-password"></label>
        <button class="btn btn-primary" type="submit">ENTRAR AL PANEL</button>
        <small>Las cuentas se aprueban a mano. ¿Olvidaste la clave? <a href="${waLink('Hola, olvidé la clave de mi panel de revendedor.')}" target="_blank" rel="noopener">Escribinos</a>.</small>
      </form>
    </div>
  </section>`;
}

/* ═══ render + eventos ═══ */
function render(){
  const p = S.pantalla;
  const html =
      p === 'catalogo'  ? vistaCatalogo()
    : p === 'detalle'   ? vistaDetalle()
    : p === 'pedido'    ? vistaPedido()
    : p === 'mayorista' ? vistaMayorista()
    : vistaHome();
  $('#view').innerHTML = html;
  $('#tabPersonal').setAttribute('aria-pressed', String(p !== 'mayorista'));
  $('#tabMayor').setAttribute('aria-pressed', String(p === 'mayorista'));
  document.body.classList.toggle('en-home', p === 'home');
  document.body.dataset.pantalla = p;
  document.title = p === 'detalle' || p === 'pedido' ? svc().nombre + ' · StreamVe'
                 : p === 'mayorista' ? 'Revendedores · StreamVe'
                 : 'StreamVe';
  ajustarFlechas();
  arrancarVideo();
}

/* El navegador sólo deja arrancar un video solo si está en silencio.
   Así que empieza mudo y el botón lo enciende: es la única forma. */
let sonidoOn = false;
let obsHero  = null;

const ICONO_MUDO  = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4L15.2 10.6 12.5 7.9l-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7z"/></svg>';
const ICONO_AUDIO = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.5 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z"/></svg>';

function arrancarVideo(){
  const v = document.querySelector('.hero-video');
  if (!v) { if (obsHero) { obsHero.disconnect(); obsHero = null; } return; }

  v.muted = !sonidoOn;
  v.load();
  const p = v.play();
  if (p && p.catch) p.catch(() => {});   // si lo bloquea, queda el póster

  pintarBotonSonido();

  /* Sólo suena mientras se está viendo: al salir de pantalla se pausa,
     y así no queda audio de fondo sonando mientras navegás el catálogo. */
  if (obsHero) obsHero.disconnect();
  obsHero = new IntersectionObserver(entradas => {
    entradas.forEach(en => {
      if (en.isIntersecting){ const q = v.play(); if (q && q.catch) q.catch(() => {}); }
      else v.pause();
    });
  }, { threshold: 0.35 });
  obsHero.observe(v);
}

/* El navegador exige un gesto del usuario antes de permitir audio: un
   clic, una tecla o un toque (el scroll no cuenta). En cuanto ocurre el
   primero, encendemos el sonido si el hero sigue en pantalla. */
let gestoHecho = false;
function primerGesto(e){
  if (gestoHecho) return;
  gestoHecho = true;
  if (e && e.target && e.target.closest && e.target.closest('[data-sonido]')) return;
  const v = document.querySelector('.hero-video');
  if (!v || sonidoOn) return;
  const r = v.getBoundingClientRect();
  const visible = r.top < window.innerHeight * 0.65 && r.bottom > window.innerHeight * 0.35;
  if (visible) alternarSonido();
}
['pointerdown','keydown','touchstart'].forEach(ev =>
  window.addEventListener(ev, primerGesto, { passive:true }));

function pintarBotonSonido(){
  const b = document.querySelector('.hero-sound');
  if (!b) return;
  b.innerHTML = sonidoOn ? ICONO_AUDIO : ICONO_MUDO;
  b.setAttribute('aria-label', sonidoOn ? 'Silenciar' : 'Activar sonido');
}

function alternarSonido(){
  const v = document.querySelector('.hero-video');
  if (!v) return;
  sonidoOn = !sonidoOn;
  v.muted = !sonidoOn;
  const q = v.play();
  /* Si el navegador rechaza el audio, volvemos a mudo y seguimos
     reproduciendo: nunca hay que dejar el video detenido. */
  if (q && q.catch) q.catch(() => {
    sonidoOn = false; v.muted = true;
    const r = v.play(); if (r && r.catch) r.catch(() => {});
    pintarBotonSonido();
  });
  pintarBotonSonido();
}

/* Las flechas solo aparecen si el rail realmente tiene contenido oculto */
function ajustarFlechas(){
  document.querySelectorAll('.rail').forEach(el => {
    el.parentElement.classList.toggle('sin-scroll', el.scrollWidth <= el.clientWidth + 4);
  });
}
window.addEventListener('resize', ajustarFlechas);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-ir],[data-filtro],[data-plan],[data-meses],[data-metodo],[data-cerrar],[data-scroll],[data-sonido],[data-portal],[data-enviado]');
  if (!t) return;
  const d = t.dataset;

  if (d.portal) return elegirModo(d.portal);
  if (d.sonido) return alternarSonido();
  if (d.scroll !== undefined){
    const el = document.getElementById('rail-' + d.scroll);
    if (el) el.scrollBy({ left: (+d.dir) * el.clientWidth * 0.85, behavior:'smooth' });
    return;
  }
  /* El link de WhatsApp sigue su curso; solo marcamos que ya se abrió */
  if (d.enviado){
    /* Con la base real, el primer envío guarda el pedido y recién ahí se
       sabe su número. La pestaña se abre antes de esperar a la base, si no
       el navegador la bloquea por no venir directo del toque. */
    if (EN_VIVO && !S.codigo){
      e.preventDefault();
      const w = window.open('', '_blank');
      ACC.crearPedidoWeb(S.sid, S.planK, S.meses, S.metodo).then(r => {
        if (!r.ok){ if (w) w.close(); return aviso(r.motivo, 'error'); }
        S.codigo = r.id; S.enviado = true;
        const url = waLink(mensajePedido());
        if (w) w.location.href = url; else location.href = url;
        render();
      });
      return;
    }
    S.enviado = true; setTimeout(render, 400); return;
  }
  if (d.ir)      return ir(d.ir);
  /* Cerrar la ficha vuelve a donde estabas, si viniste de adentro */
  if (d.cerrar)  return (S.anterior === 'home' || S.anterior === 'catalogo') ? history.back() : ir('catalogo');
  if (d.filtro){ S.filtro = d.filtro; return render(); }
  if (d.plan)  { S.planK  = d.plan;   return render(); }
  if (d.meses) { S.meses  = +d.meses; return render(); }
  if (d.metodo){ S.metodo = d.metodo; return render(); }
});

/* Login de revendedor: hasta que haya backend, cualquier usuario entra al
   panel de demostración. */
document.addEventListener('submit', e => {
  if (!e.target.matches('[data-login]')) return;
  e.preventDefault();
  try { sessionStorage.setItem('streamve.mayorista', $('#fUser').value.trim()); } catch (err) {}
  location.href = 'mayorista.html';
});

/* ── portal de entrada ──
   Se pregunta una sola vez y la elección queda guardada. No es un muro:
   comprar como individual nunca pide registro; el mayorista sí, porque
   ahí hay precio distinto y mínimo por paquete. Si alguien llega con un
   link directo (#/netflix), no se le pregunta nada. */
const CLAVE_MODO = 'streamve.modo';

function leerModo(){
  try { return localStorage.getItem(CLAVE_MODO); } catch (e) { return null; }
}
function elegirModo(modo){
  try { localStorage.setItem(CLAVE_MODO, modo); } catch (e) {}
  $('#portal').hidden = true;
  document.body.classList.remove('con-portal');
  ir(modo === 'mayorista' ? 'mayorista' : 'home');
}
function abrirPortalSiHaceFalta(){
  const sinRuta = !location.hash || location.hash === '#/' || location.hash === '#';
  if (!leerModo() && sinRuta){
    $('#portal').hidden = false;
    document.body.classList.add('con-portal');
  }
}

/* ── cabecera y pie ── */
function montarChrome(){
  pintarAtencion();

  $('#barWa').href = waLink('Hola, quiero preguntar por una cuenta.');
  $('#pieWa').href = waLink('Hola, tengo un problema con mi cuenta.');
  $('#pieYear').textContent = new Date().getFullYear();

  /* Los servicios del pie salen del catálogo: una sola fuente de verdad */
  $('#pieServicios').innerHTML = CAT.map(x =>
    `<li><a href="#/${x.slug}"><b>${esc(x.nombre)}</b><i>desde ${usd(desdeDe(x))}</i></a></li>`
  ).join('');
}

/* Abierto o cerrado se calcula contra el horario real, no es un adorno:
   si son las 2 de la mañana, la web lo dice en vez de fingir. */
function pintarAtencion(){
  const el = $('#estAtencion');
  if (!el) return;
  const abierto = abiertoAhora();
  el.textContent = abierto ? 'HASTA ' + hora12(CFG.cierraHora) : 'ABRE ' + hora12(CFG.abreHora);
  el.classList.toggle('cerrado', !abierto);
}
setInterval(pintarAtencion, 60000);

/* La barra se vuelve sólida apenas se sale de la portada, y el fondo se
   va apagando de gris a negro en los primeros 800 px. */
const F_ARRIBA = [48, 44, 42], F_ABAJO = [17, 15, 15];
function alDesplazar(){
  const b = $('#bar');
  if (b) b.classList.toggle('solido', window.scrollY > 40);

  const t = Math.min(1, window.scrollY / 800);
  const c = F_ARRIBA.map((v, i) => Math.round(v + (F_ABAJO[i] - v) * t));
  document.documentElement.style.setProperty('--fondo', `rgb(${c[0]},${c[1]},${c[2]})`);
}
window.addEventListener('scroll', alDesplazar, { passive:true });

$('#brand').onclick        = () => ir('home');
$('#tabPersonal').onclick  = () => ir('home');
$('#tabMayor').onclick     = () => ir('mayorista');

montarChrome();
alDesplazar();
/* Con la base real, el stock se pide antes de pintar (con un tope, para
   que una base lenta no deje la tienda en blanco). */
(EN_VIVO
  ? Promise.race([cargarStockPublico().catch(() => {}), new Promise(r => setTimeout(r, 2500))])
  : Promise.resolve()
).then(() => { aplicarRuta(); abrirPortalSiHaceFalta(); });
/* La portada no muestra bolívares: re-renderizarla reiniciaría el video */
cargarTasa(() => { if (S.pantalla !== 'home') render(); });
