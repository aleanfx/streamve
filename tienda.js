/* StreamVe — la tienda: estado de navegación, vistas y eventos.
   Depende de ui.js y catalogo.js. */

const HIST = [
  { codigo:'SV-4106', detalle:'12 u · Netflix, Disney+', estado:'ENTREGADO', monto:'$29,60' },
  { codigo:'SV-4088', detalle:'20 u · Netflix, Spotify', estado:'ENTREGADO', monto:'$49,00' },
  { codigo:'SV-4061', detalle:'10 u · Max',              estado:'ENTREGADO', monto:'$20,50' }
];

/* ── estado ── */
const S = {
  pantalla:'home', sid:'nx', planK:'pantalla', meses:1,
  metodo:'binance', ref:'', wa:'', user:'distribuidora.oriente',
  auth:false, filtro:'Todo', cant:{}, volverA:'home', codigo:null
};

/* ── helpers ── */

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
  const desde = usd(Math.min.apply(null, x.planes.map(p => p.precio)));
  const micro = CFG.garantiaDias + 'd · ' + CFG.ventanaEntrega + ' · ' + (x.renovable ? 'renovable' : 'no renovable');
  return `<button class="tile rise" style="animation-delay:${Math.min(i, 7) * 45}ms" data-abrir="${x.id}">
    <div class="art">
      ${artHTML(x, i)}
      <span class="art-badge" style="background:${bajo ? 'var(--accent)' : 'rgba(0,0,0,.45)'};color:${bajo ? 'var(--ink)' : 'var(--mute-2)'}">${bajo ? 'QUEDAN ' + st : st + ' LIBRES'}</span>
    </div>
    <div class="tile-foot">
      <div class="tile-name">${esc(x.nombre)}</div>
      <div class="tile-price"><b>${desde}<small> /mes</small></b><em>VER →</em></div>
      <div class="tile-micro">${esc(micro)}</div>
      <div class="tile-desc"><p>${esc(DESC[x.id] || '')}</p></div>
    </div>
  </button>`;
}

/* ═══ pantallas ═══ */

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
      <div><span class="stock-flag">EN STOCK AHORA · ${total} UNIDADES</span></div>
      <div class="hero-chips">
        <span class="chip">${CFG.garantiaDias} DÍAS DE GARANTÍA</span>
        <span class="chip">ENTREGA ${esc(CFG.ventanaEntrega)}</span>
        <span class="chip">RENOVABLE</span>
      </div>
      <div class="hero-cta">
        <button class="btn btn-primary" data-ir="catalogo">VER CATÁLOGO</button>
        <a class="btn btn-line" href="https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent('Hola, quiero preguntar por una cuenta.')}" target="_blank" rel="noopener">WHATSAPP</a>
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
        ['ATENCIÓN', '8:00 am a 9:00 pm', 'Todos los días, hora de Venezuela'],
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
      <li><em>MINUTO 0</em><i>01</i><b>Pagás</b><p>Binance en dólares o Pago Móvil en bolívares. Mandás la captura y listo.</p></li>
      <li><em>${esc(CFG.ventanaEntrega).toUpperCase()}</em><i>02</i><b>Entregamos</b><p>A mano, revisada antes de mandártela. No es un robot escupiendo claves.</p></li>
      <li><em>AL INSTANTE</em><i>03</i><b>Ves</b><p>En el televisor, en el teléfono y en la computadora. Donde quieras.</p></li>
      <li><em>CADA MES</em><i>04</i><b>Renovamos</b><p>Con la misma clave. No reconfigurás nada, no reinstalás nada.</p></li>
    </ol>
  </section>`;
}

function vistaCatalogo(){
  const cats = ['Todo','VIDEO','MÚSICA','ANIME'];
  const lista = CAT.filter(x => S.filtro === 'Todo' || x.cat === S.filtro);
  return `
  <div class="filters">
    ${cats.map(c => `<button data-filtro="${esc(c)}" aria-pressed="${S.filtro === c}">${c === 'Todo' ? 'TODO' : c}</button>`).join('')}
  </div>
  <div class="grid">${lista.map(x => tileHTML(x, CAT.indexOf(x))).join('')}</div>`;
}

/* Qué te llevás con cada plan, en una línea */
const PLAN_DESC = {
  pantalla:'Una pantalla con tu propio perfil y PIN.',
  perfil:'Un perfil dentro de una cuenta compartida.',
  completa:'La cuenta entera. Vos controlás la clave y los perfiles.'
};

function vistaDetalle(){
  const x = svc(), p = plan();
  const t = totalActual();
  const arte = x.card || '';
  const ahorro = plan().precio * 12 * CFG.descuentoAnual;

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
        <div><small>QUEDAN</small><b class="${p.stock <= 5 ? 'poco' : ''}">${p.stock} u.</b></div>
      </div>

      <h3 class="ficha-tit">ELEGÍ TU ACCESO</h3>
      <div class="planes">
        ${x.planes.map(pl => `
          <button class="plan" data-plan="${pl.k}" aria-pressed="${pl.k === p.k}">
            <span class="plan-marca"></span>
            <span class="plan-txt">
              <b>${esc(pl.etq)}</b>
              <em>${esc(PLAN_DESC[pl.k] || '')}</em>
              <i>${pl.stock <= 5 ? 'Quedan ' + pl.stock : pl.stock + ' disponibles'}</i>
            </span>
            <span class="plan-precio">${usd(pl.precio)}<small>/mes</small></span>
          </button>`).join('')}
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
      ${CFG.mostrarBolivares ? `<small>${bs(t)} · ${S.meses === 12 ? '12 meses' : '1 mes'}</small>` : ''}
    </div>
    <button class="btn btn-primary" data-ir="checkout" style="padding:15px 22px;font-size:15px">COMPRAR</button>
  </div>`;
}

function vistaCheckout(){
  const x = svc(), p = plan(), t = totalActual();
  const bin = S.metodo === 'binance';
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px var(--pad)">
    <div>
      <div class="kicker">PAGO</div>
      <div style="font-weight:800;font-size:24px;line-height:1;margin-top:6px">${esc(x.nombre)} · ${esc(p.etq)}</div>
      <div class="mute" style="font-size:12px;margin-top:4px">${S.meses === 12 ? '12 meses' : '1 mes'} · garantía ${CFG.garantiaDias} días</div>
    </div>
    <button class="close" style="position:static" data-ir="detalle" aria-label="Volver">✕</button>
  </div>
  <div class="methods">
    <button data-metodo="binance" aria-pressed="${bin}"><b>BINANCE</b><span>USDT · BEP20</span></button>
    <button data-metodo="pm" aria-pressed="${!bin}"><b>PAGO MÓVIL</b><span>Bs del día</span></button>
  </div>
  <div class="paydata">
    <div><span class="mute">${bin ? 'Correo' : 'Banco'}</span><b>${esc(bin ? CFG.binanceCorreo : CFG.pmBanco)}</b></div>
    <div><span class="mute">${bin ? 'Red' : 'Teléfono'}</span><b>${esc(bin ? CFG.binanceRed : CFG.pmTelefono)}</b></div>
    <div><span class="mute">Monto exacto</span><b class="amt-red">${bin ? usd(t) + ' USDT' : bs(t)}</b></div>
  </div>
  <div class="fields">
    <input id="fRef" placeholder="Referencia" value="${esc(S.ref)}">
    <input id="fWa"  placeholder="WhatsApp"   value="${esc(S.wa)}">
  </div>
  <div class="paybar">
    <div><div class="amt">${usd(t)}</div>${CFG.mostrarBolivares ? `<small>${bs(t)}</small>` : ''}</div>
    <button class="btn btn-primary" data-confirmar="1" style="padding:15px 20px;font-size:15px">YA PAGUÉ</button>
  </div>`;
}

function vistaPedido(){
  const x = svc(), p = plan();
  const hora = new Date().toLocaleTimeString('es-VE', { hour:'numeric', minute:'2-digit' });
  const msg = encodeURIComponent(`Hola, soy ${S.wa || 'un cliente'}. Pedido ${S.codigo}: ${x.nombre} · ${p.etq} · ${S.meses === 12 ? '12 meses' : '1 mes'}. Referencia: ${S.ref || '(sin referencia)'}`);
  return `
  <div class="ohead">
    <div class="kicker">PEDIDO ${esc(S.codigo)}</div>
    <h2>Entregamos en ${esc(CFG.ventanaEntrega)}.</h2>
    <div style="font-size:13px;color:var(--mute-2);margin-top:8px">Te escribimos por WhatsApp.</div>
  </div>
  <div class="track">
    <div><i style="background:var(--accent)"></i><b>Pago</b><small>${hora}</small></div>
    <div><i style="background:var(--accent)"></i><b>Verificado</b><small>${hora}</small></div>
    <div><i style="border:2px solid var(--accent-400)"></i><b>Preparando</b><small style="color:var(--accent-400)">en curso</small></div>
    <div><i style="border:2px solid var(--line-2)"></i><b style="color:var(--dim)">Entregado</b><small style="color:var(--dim)">—</small></div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:2px;padding:16px var(--pad) 22px;border-top:1px solid var(--line)">
    <a class="btn btn-primary" style="text-decoration:none;display:inline-block" href="https://wa.me/${CFG.whatsapp}?text=${msg}" target="_blank" rel="noopener">ABRIR WHATSAPP</a>
    <button class="btn btn-line" data-ir="catalogo">SEGUIR VIENDO</button>
  </div>`;
}

function vistaLogin(){
  return `
  <div class="login">
    <div class="login-bg"></div>
    <div class="login-veil"></div>
    <div class="login-inner">
    <div class="kicker">MAYORISTA · DESDE ${CFG.minMayorista} U.</div>
    <div class="display" style="font-size:clamp(30px,7vw,52px);margin:10px 0 0">Precio<br>unitario.</div>
    <div class="form">
      <input id="fUser" value="${esc(S.user)}" placeholder="Usuario">
      <input type="password" value="demo1234" placeholder="Contraseña">
      <button class="btn btn-primary" data-entrar="1" style="padding:15px 18px;font-size:15px">ENTRAR</button>
      <div class="mute" style="font-size:11px">Cuentas por aprobación · WhatsApp</div>
    </div>
    </div>
  </div>`;
}

function vistaPanel(){
  const filas = CAT.map(x => {
    const c = S.cant[x.id] || 0, st = x.planes[0].stock, bajo = st <= 5;
    return `<div class="wrow">
      <div class="nm"><b>${esc(x.nombre)}</b><small>${esc(x.planes[0].etq)} · ${st} en stock</small></div>
      <div class="pr" style="color:${bajo ? 'var(--accent-400)' : 'var(--ink)'}">${usd(x.mayor)}</div>
      <div class="step">
        <button class="minus" data-menos="${x.id}" aria-label="Quitar uno">−</button>
        <span style="color:${c > 0 ? 'var(--accent-400)' : 'var(--mute)'}">${c}</span>
        <button class="plus" data-mas="${x.id}" aria-label="Agregar uno">+</button>
      </div>
    </div>`;
  }).join('');

  const unidades = CAT.reduce((a, x) => a + (S.cant[x.id] || 0), 0);
  const monto = CAT.reduce((a, x) => a + (S.cant[x.id] || 0) * x.mayor, 0);
  const nota = unidades === 0 ? 'Suma cantidades'
             : unidades < CFG.minMayorista ? 'Faltan ' + (CFG.minMayorista - unidades) + ' u.'
             : 'Listo para enviar';
  const listo = unidades >= CFG.minMayorista;

  return `
  <div class="whead">
    <div><b>${esc(S.user)}</b><small>Stock hace 4 min · mínimo ${CFG.minMayorista} u.</small></div>
    <button class="btn btn-line" data-repetir="1" style="padding:11px 14px;font-size:12px">REPETIR · 12 u · $29,60</button>
  </div>
  <div style="padding:0 var(--pad)">${filas}</div>
  <div style="padding:16px var(--pad) 6px"><div style="font-weight:800;font-size:11px;letter-spacing:.12em;color:var(--mute)">ÚLTIMOS PEDIDOS</div></div>
  <div style="padding:0 var(--pad) 16px">
    ${HIST.map(h => `<div class="hrow"><b>${h.codigo}</b><span class="mute" style="font-size:11px">${esc(h.detalle)}</span><span class="st">${h.estado}</span><b>${h.monto}</b></div>`).join('')}
  </div>
  <div class="paybar">
    <div><div class="amt-sm">${usd(monto)} · ${unidades} u.</div><small style="color:${listo ? 'var(--accent-400)' : 'var(--mute)'}">${nota}</small></div>
    <button class="btn btn-primary" data-enviar="1" style="padding:15px 20px;font-size:15px" ${listo ? '' : 'disabled'}>ENVIAR</button>
  </div>`;
}

/* ═══ render + eventos ═══ */
function render(){
  const p = S.pantalla;
  const html =
      p === 'home'      ? vistaHome()
    : p === 'catalogo'  ? vistaCatalogo()
    : p === 'detalle'   ? vistaDetalle()
    : p === 'checkout'  ? vistaCheckout()
    : p === 'pedido'    ? vistaPedido()
    : p === 'mayorista' ? (S.auth ? vistaPanel() : vistaLogin())
    : vistaHome();
  $('#view').innerHTML = html;
  $('#tabPersonal').setAttribute('aria-pressed', String(p !== 'mayorista'));
  $('#tabMayor').setAttribute('aria-pressed', String(p === 'mayorista'));
  document.body.classList.toggle('en-home', p === 'home');
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
  const b = document.querySelector('.hero-sound');
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

/* El navegador exige un gesto del usuario antes de permitir audio. En
   cuanto ocurre el primero — un clic, una tecla, un scroll — encendemos
   el sonido si el hero sigue en pantalla. Antes de eso es imposible. */
let gestoHecho = false;
function primerGesto(){
  if (gestoHecho) return;
  gestoHecho = true;
  const v = document.querySelector('.hero-video');
  if (!v || sonidoOn) return;
  const r = v.getBoundingClientRect();
  const visible = r.top < window.innerHeight * 0.65 && r.bottom > window.innerHeight * 0.35;
  if (visible) alternarSonido();
}
['pointerdown','keydown','touchstart'].forEach(ev =>
  window.addEventListener(ev, primerGesto, { once:false, passive:true }));

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
  const t = e.target.closest('[data-ir],[data-abrir],[data-filtro],[data-plan],[data-meses],[data-metodo],[data-cerrar],[data-confirmar],[data-entrar],[data-mas],[data-menos],[data-repetir],[data-enviar],[data-scroll],[data-sonido],[data-portal]');
  if (!t) return;
  const d = t.dataset;

  if (d.portal) return elegirModo(d.portal);
  if (d.sonido) return alternarSonido();
  if (d.scroll !== undefined){
    const el = document.getElementById('rail-' + d.scroll);
    if (el) el.scrollBy({ left: (+d.dir) * el.clientWidth * 0.85, behavior:'smooth' });
    return;
  }
  if (d.ir)      return ir(d.ir);
  if (d.cerrar)  return ir(S.volverA === 'catalogo' ? 'catalogo' : 'home');
  if (d.filtro){ S.filtro = d.filtro; return render(); }
  if (d.plan)  { S.planK  = d.plan;   return render(); }
  if (d.meses) { S.meses  = +d.meses; return render(); }
  if (d.metodo){ S.metodo = d.metodo; return render(); }

  if (d.abrir){
    const x = CAT.find(s => s.id === d.abrir);
    S.sid = x.id;
    S.volverA = S.pantalla;
    S.planK = x.planes.slice().sort((a, b) => a.precio - b.precio)[0].k;
    return ir('detalle');
  }
  if (d.confirmar){ S.codigo = nuevoCodigo(); return ir('pedido'); }
  if (d.entrar)   { S.auth = true; return ir('mayorista'); }
  if (d.mas)      { const x = CAT.find(s => s.id === d.mas);
                    S.cant[d.mas] = Math.min(x.planes[0].stock, (S.cant[d.mas] || 0) + 1); return render(); }
  if (d.menos)    { S.cant[d.menos] = Math.max(0, (S.cant[d.menos] || 0) - 1); return render(); }
  if (d.repetir)  { S.cant = { nx:8, dp:4 }; return render(); }
  if (d.enviar)   { S.codigo = nuevoCodigo(); return ir('pedido'); }
});

/* inputs del checkout / login: guardar sin re-renderizar */
document.addEventListener('input', e => {
  if (e.target.id === 'fRef')  S.ref  = e.target.value;
  if (e.target.id === 'fWa')   S.wa   = e.target.value;
  if (e.target.id === 'fUser') S.user = e.target.value;
});

/* ── portal de entrada ──
   Se pregunta una sola vez y la elección queda guardada. No es un muro:
   comprar como individual nunca pide registro; el mayorista sí, porque
   ahí hay precio distinto y mínimo por paquete. */
const CLAVE_MODO = 'streamve.modo';

function leerModo(){
  try { return localStorage.getItem(CLAVE_MODO); } catch (e) { return null; }
}
function elegirModo(modo){
  try { localStorage.setItem(CLAVE_MODO, modo); } catch (e) {}
  $('#portal').hidden = true;
  ir(modo === 'mayorista' ? 'mayorista' : 'home');
}
function abrirPortalSiHaceFalta(){
  if (!leerModo()) $('#portal').hidden = false;
}

/* ── cabecera y pie ── */
const waLink = t => 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(t);

function montarChrome(){
  pintarAtencion();

  $('#barWa').href = waLink('Hola, quiero preguntar por una cuenta.');
  $('#pieWa').href = waLink('Hola, tengo un problema con mi cuenta.');
  $('#pieYear').textContent = new Date().getFullYear();

  /* Los servicios del pie salen del catálogo: una sola fuente de verdad */
  $('#pieServicios').innerHTML = CAT.map(x =>
    `<li><button data-abrir="${x.id}"><b>${esc(x.nombre)}</b><i>desde ${usd(Math.min.apply(null, x.planes.map(pl => pl.precio)))}</i></button></li>`
  ).join('');
}

/* Abierto o cerrado se calcula contra el horario real, no es un adorno:
   si son las 2 de la mañana, la web lo dice en vez de fingir. */
/* La hora es la de Venezuela, no la del visitante: si alguien abre la
   web desde España a las 3 de la tarde, acá son las 9 de la mañana. */
function horaVE(){
  return +new Intl.DateTimeFormat('en-US',
    { timeZone:'America/Caracas', hour:'numeric', hour12:false }).format(new Date());
}
function pintarAtencion(){
  const el = $('#estAtencion');
  if (!el) return;
  const h = horaVE();
  const abierto = h >= CFG.abreHora && h < CFG.cierraHora;
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
render();
abrirPortalSiHaceFalta();
