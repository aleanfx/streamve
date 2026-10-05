/* StreamVe — configuración del negocio y utilidades compartidas.
   Se carga antes que todo lo demás: datos.js y las vistas dependen de acá. */

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
  binanceRed:      'USDT · BEP20',
  pmBanco:         '0102 Venezuela',
  pmTelefono:      '0414 000 0000'
};

const $  = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd = n => '$' + n.toFixed(2).replace('.', ',');
/* Pago Móvil cobra con céntimos: el monto en Bs va exacto, con dos decimales */
const dec2 = n => n.toLocaleString('es-VE', { minimumFractionDigits:2, maximumFractionDigits:2 });
const bs  = n => 'Bs ' + dec2(n * CFG.tasaBs);
const tasaTxt = () => dec2(CFG.tasaBs);
const svc = () => CAT.find(s => s.id === S.sid) || CAT[0];
const plan = () => { const s = svc(); return s.planes.find(p => p.k === S.planK) || s.planes[0]; };
/* El stock sale de las cuentas madre (datos.js): la tienda y el panel
   leen el mismo número. */
const stockDe = x => stockDisponible(x.id);
const totalActual = () => {
  const bruto = plan().precio * (S.meses === 12 ? 12 : 1);
  return S.meses === 12 ? bruto * (1 - CFG.descuentoAnual) : bruto;
};
const nuevoCodigo = () => 'SV-' + (4100 + Math.floor(Math.random() * 900));

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
