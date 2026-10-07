/* StreamVe — configuración del negocio y utilidades compartidas.
   Se carga antes que todo lo demás: datos.js y las vistas dependen de acá.
   Nada de este archivo conoce el estado de una pantalla en particular. */

/* Los datos de cobro y el WhatsApp son de RELLENO: antes de lanzar se
   reemplazan por los reales. No son secretos (el cliente los tiene que ver
   para pagar), pero tienen que ser los correctos. */
const CFG = {
  garantiaDias:    30,
  ventanaEntrega:  '8–20 min',
  mostrarBolivares: true,
  tasaBs:          871.37,  // respaldo: la real se lee del BCV al cargar (cargarTasa)
  tasaFecha:       null,
  descuentoAnual:  0.15,     // 12 meses = −15%
  minMayorista:    10,
  abreHora:        8,       // horario de atención, hora de Venezuela
  cierraHora:      21,
  whatsapp:        '584140000000',
  binanceCorreo:   'pagos@streamve.com',
  binancePayId:    '000 000 000',
  binanceRed:      'USDT · BEP20',
  pmBanco:         '0102 Venezuela',
  pmTelefono:      '0414 000 0000',
  pmCedula:        'V-00.000.000',
  sitio:           'https://streamve.vercel.app',
  /* Supabase. La clave anon es PÚBLICA por diseño: va en el navegador y la
     seguridad la ponen las reglas de la base (supabase/esquema.sql). La
     clave secreta (service_role / sb_secret) no va NUNCA en este repo. */
  supabaseUrl:     'https://csptgybisyleixcdgvpe.supabase.co',
  supabaseKey:     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzcHRneWJpc3lsZWl4Y2RndnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMjU1MTQsImV4cCI6MjEwNjkwMTUxNH0.yKYkrmNDmqgiCdGXj0P6rHagYVU1PvVmPjUtYnleWRQ'
};

/* Modo demo: datos simulados en vez de la base real. Se entra con ?demo
   en cualquier link (queda guardado en la pestaña) y se sale con ?demo=0.
   En las pruebas de node no hay navegador: siempre es demo. */
const DEMO = (() => {
  if (typeof location === 'undefined') return true;
  const q = new URLSearchParams(location.search);
  try {
    if (q.get('demo') === '0') sessionStorage.removeItem('streamve.demo');
    else if (q.has('demo')) sessionStorage.setItem('streamve.demo', '1');
    return sessionStorage.getItem('streamve.demo') === '1' || !CFG.supabaseUrl;
  } catch (e) { return q.has('demo') && q.get('demo') !== '0'; }
})();

const $  = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd = n => '$' + n.toFixed(2).replace('.', ',');
/* Pago Móvil cobra con céntimos: el monto en Bs va exacto, con dos decimales */
const dec2 = n => n.toLocaleString('es-VE', { minimumFractionDigits:2, maximumFractionDigits:2 });
const bs  = n => 'Bs ' + dec2(n * CFG.tasaBs);
const tasaTxt = () => dec2(CFG.tasaBs);
/* Lo que se pega en la app del banco: sin separador de miles */
const montoPegable = n => n.toFixed(2).replace('.', ',');
/* El stock sale de las cuentas madre (datos.js): la tienda y el panel
   leen el mismo número. */
const stockDe = x => stockDisponible(x.id);

/* Tasa BCV del día. Se pinta primero con la última conocida y se corrige
   apenas responde la API; si la API cae, queda la de respaldo de CFG. */
const CLAVE_TASA = 'streamve.tasa';
function cargarTasa(alCambiar){
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_TASA));
    if (g && g.v > 0){ CFG.tasaBs = g.v; CFG.tasaFecha = g.f; }
  } catch (e) {}
  fetch('https://ve.dolarapi.com/v1/dolares/oficial')
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      const v = j && +j.promedio;
      if (!(v > 0)) return;
      const cambio = v !== CFG.tasaBs;
      CFG.tasaBs = v; CFG.tasaFecha = j.fechaActualizacion;
      try { localStorage.setItem(CLAVE_TASA, JSON.stringify({ v, f: j.fechaActualizacion })); } catch (e) {}
      if (cambio && alCambiar) alCambiar();
    })
    .catch(() => {});
}

/* Arte por servicio.
   Si el servicio trae `img`, se usa esa foto. Si no, se compone una trama
   monocroma propia: identifica cada servicio sin usar marcas ajenas. */
const TRAMAS = [
  'repeating-linear-gradient(58deg,rgba(255,255,255,.22) 0 1px,transparent 1px 8px)',
  'repeating-radial-gradient(circle at 78% 14%,rgba(255,255,255,.20) 0 1.5px,transparent 1.5px 20px)',
  'repeating-linear-gradient(0deg,rgba(255,255,255,.15) 0 1px,transparent 1px 22px)',
  'repeating-linear-gradient(90deg,rgba(255,255,255,.16) 0 1px,transparent 1px 13px)',
  'repeating-linear-gradient(122deg,rgba(255,255,255,.13) 0 16px,transparent 16px 38px)',
  'repeating-linear-gradient(180deg,rgba(255,255,255,.18) 0 2px,transparent 2px 8px)',
  'repeating-linear-gradient(45deg,rgba(255,255,255,.15) 0 1px,transparent 1px 11px)'
];

/* Reloj en 12 h con am/pm, que es como se lee la hora en Venezuela. */
const hora12 = n => {
  const h = n % 24;
  const d = h % 12 === 0 ? 12 : h % 12;
  return d + ':00 ' + (h < 12 ? 'am' : 'pm');
};

/* La hora es la de Venezuela, no la del visitante: si alguien abre la
   web desde España a las 3 de la tarde, acá son las 9 de la mañana. */
function horaVE(){
  return +new Intl.DateTimeFormat('en-US',
    { timeZone:'America/Caracas', hour:'numeric', hour12:false }).format(new Date()) % 24;
}
const abiertoAhora = () => { const h = horaVE(); return h >= CFG.abreHora && h < CFG.cierraHora; };

/* ── WhatsApp ── */
const waLink = (texto, numero) =>
  'https://wa.me/' + (numero || CFG.whatsapp) + '?text=' + encodeURIComponent(texto);

const ICONO_WA = '<svg class="i-wa" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-3-.2-.3A8 8 0 1 1 12 20zm4.4-5.8c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5 0a6.5 6.5 0 0 1-1.9-1.2 7.2 7.2 0 0 1-1.3-1.7c-.2-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.8c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.6 2.2.7 3 .6a2.5 2.5 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2z"/></svg>';

/* El mensaje de WhatsApp se ve igual que como va a llegar: *negrita* y
   saltos de línea, para que el cliente sepa qué está mandando. */
const burbujaHTML = texto => esc(texto)
  .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
  .replace(/\n/g, '<br>');

/* ── avisos y copiar ── compartidos por la tienda, el portal y los paneles */
function aviso(texto, tipo){
  let el = document.getElementById('aviso');
  if (!el){
    el = document.createElement('div');
    el.id = 'aviso'; el.className = 'aviso'; el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.dataset.tipo = tipo || '';
  el.classList.add('ver');
  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => el.classList.remove('ver'), 2600);
}

function copiar(texto, boton){
  const listo = () => {
    if (boton){
      const antes = boton.dataset.etq || boton.textContent;
      boton.dataset.etq = antes;
      boton.textContent = 'COPIADO';
      boton.classList.add('ok');
      setTimeout(() => { boton.textContent = antes; boton.classList.remove('ok'); }, 1600);
    } else aviso('Copiado');
  };
  if (navigator.clipboard && window.isSecureContext)
    navigator.clipboard.writeText(texto).then(listo, () => aviso('No se pudo copiar'));
  else {
    const t = document.createElement('textarea');
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); listo(); } catch (e) { aviso('No se pudo copiar'); }
    t.remove();
  }
}

if (typeof document !== 'undefined')
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copiar]');
    if (b){ e.preventDefault(); copiar(b.dataset.copiar, b); }
  });
