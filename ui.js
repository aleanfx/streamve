/* StreamVe — configuración del negocio y utilidades compartidas.
   Se carga antes que todo lo demás: datos.js y las vistas dependen de acá. */

const CFG = {
  garantiaDias:    30,
  ventanaEntrega:  '8–20 min',
  mostrarBolivares: true,
  tasaBs:          36.5,
  descuentoAnual:  0.15,     // 12 meses = −15%
  minMayorista:    10,
  abreHora:        8,       // horario de atención, hora de Venezuela
  cierraHora:      21,
  whatsapp:        '584140000000',
  binanceCorreo:   'pagos@streamve.com',
  binanceRed:      'USDT · BEP20',
  pmBanco:         '0102 Venezuela',
  pmTelefono:      '0414 000 0000'
};

/* Catálogo.
   `mayor`  precio unitario de mayorista
   `color`  color de marca — tiñe la foto de fondo y la muesca de la tarjeta
   `logo`   SVG en assets/logos/. Si falta, la tarjeta cae al nombre escrito
   `img`    foto de fondo en assets/. Si falta, cae a la trama monocroma      */

const $  = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd = n => '$' + n.toFixed(2).replace('.', ',');
const bs  = n => 'Bs ' + Math.round(n * CFG.tasaBs).toLocaleString('es-VE');
const svc = () => CAT.find(s => s.id === S.sid) || CAT[0];
const plan = () => { const s = svc(); return s.planes.find(p => p.k === S.planK) || s.planes[0]; };
const stockDe = x => x.planes.reduce((a, p) => a + p.stock, 0);
const totalActual = () => {
  const bruto = plan().precio * (S.meses === 12 ? 12 : 1);
  return S.meses === 12 ? bruto * (1 - CFG.descuentoAnual) : bruto;
};
const nuevoCodigo = () => 'SV-' + (4100 + Math.floor(Math.random() * 900));

function ir(p){ S.pantalla = p; window.scrollTo(0, 0); render(); }

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
