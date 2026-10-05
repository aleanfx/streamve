/* StreamVe — piezas compartidas por los dos paneles (Ale y revendedor).
   Solo presentación: los datos salen de datos.js.
   Depende de: ui.js, catalogo.js, datos.js */

document.body.classList.add('panel');

const servPorId = id => CAT.find(x => x.id === id) || { id:'', nombre:'—', color:'#666' };

const punto = servicioId =>
  `<span class="punto" style="background:${servPorId(servicioId).color}"></span>`;

const ETIQ = { activa:'ACTIVA', porVencer:'POR VENCER', vencida:'VENCIDA', cancelada:'CANCELADA' };
const chipEstado = e => `<span class="chip-e e-${e}">${ETIQ[e] || e}</span>`;

/* Barra de días restantes sobre el ciclo contratado */
function barraTiempo(s){
  const d = diasRestantes(s);
  const pct = Math.max(0, Math.min(100, (d / (OP.diasPorMes * (s.meses || 1))) * 100));
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

const vacio = (titulo, sub) =>
  `<div class="vacio"><b>${esc(titulo)}</b>${sub ? esc(sub) : ''}</div>`;

/* En el teléfono cada fila de tabla se dibuja como tarjeta, y cada celda
   necesita su etiqueta: se copia del encabezado de la columna. */
function etiquetarTablas(raiz){
  (raiz || document).querySelectorAll('table.t').forEach(t => {
    const hs = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach(tr =>
      [...tr.children].forEach((td, i) => { td.dataset.l = hs[i] || ''; }));
  });
}

/* Mensaje de acceso listo para mandar. Sin marca: el revendedor lo manda
   con la suya, y Ale con la de StreamVe (va en el saludo, no acá). */
function textoAcceso(s){
  const sv = servicioDeSuscripcion(s) || { nombre:'' };
  const a = accesoDe(s);
  if (!a) return '';
  return [
    '*' + sv.nombre + '*',
    'Correo: ' + a.correo,
    'Clave: ' + a.clave,
    'Perfil: ' + a.perfil + (a.pin ? ' · PIN ' + a.pin : ''),
    'Vence: ' + fechaCorta(s.vence),
    '',
    'No cambies la contraseña ni uses los otros perfiles: así no se cae.'
  ].join('\n');
}
