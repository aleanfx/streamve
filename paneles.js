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

/* Cajón lateral (en el teléfono, hoja desde abajo) para los formularios */
const cajonHTML = (titulo, cuerpo, pie) => `
  <div class="cajon-velo" data-cerrar-cajon="1"></div>
  <aside class="cajon" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <header class="cajon-cab"><b>${esc(titulo)}</b>
      <button class="cajon-x" data-cerrar-cajon="1" aria-label="Cerrar">✕</button></header>
    <div class="cajon-cuerpo">${cuerpo}</div>
    ${pie ? `<footer class="cajon-pie">${pie}</footer>` : ''}
  </aside>`;

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

/* ── login de los paneles (solo con la base real) ──
   Cada uno escribe su correo y su contraseña: nada de eso pasa por el
   código ni queda guardado acá, la sesión la maneja Supabase. */
function pantallaLogin(raiz, { rol, error, nuevo, ok }, alEntrar){
  raiz.innerHTML = `
  <section class="login-p">
    <form class="login-p-caja" data-login-p="1" autocomplete="on">
      <div class="kicker">${esc(rol)}</div>
      <h1>${nuevo ? 'Crear usuario' : 'Entrar'}</h1>
      <label>Correo<input id="lpCorreo" type="email" autocomplete="username" required></label>
      <label>Contraseña<input id="lpClave" type="password" minlength="8"
             autocomplete="${nuevo ? 'new-password' : 'current-password'}" required></label>
      ${error ? `<p class="login-p-error">${esc(error)}</p>` : ''}
      ${ok ? `<p class="login-p-ok">${esc(ok)}</p>` : ''}
      <button class="acc pri grande" type="submit">${nuevo ? 'CREAR USUARIO' : 'ENTRAR'}</button>
      <button class="login-p-demo" type="button" data-cambiar="1">${nuevo ? '¿Ya tenés usuario? Entrar' : '¿Primera vez? Crear usuario'}</button>
      <a class="login-p-demo" href="?demo">Ver con datos de prueba →</a>
    </form>
  </section>`;
  document.body.classList.add('sin-sesion');
  const f = raiz.querySelector('[data-login-p]');
  f.querySelector('[data-cambiar]').onclick = () => pantallaLogin(raiz, { rol, nuevo: !nuevo }, alEntrar);
  f.onsubmit = async e => {
    e.preventDefault();
    const b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = nuevo ? 'CREANDO…' : 'ENTRANDO…';
    const correo = f.querySelector('#lpCorreo').value, clave = f.querySelector('#lpClave').value;
    if (nuevo){
      const r = await crearUsuario(correo, clave);
      if (!r.ok) return pantallaLogin(raiz, { rol, nuevo, error: r.motivo }, alEntrar);
      if (!r.sesion) return pantallaLogin(raiz, { rol, ok:
        'Listo. Te llegó un correo de Supabase: confirmalo y después entrá acá. Avisale a Claude para que te dé el acceso.' }, alEntrar);
      document.body.classList.remove('sin-sesion');
      return alEntrar();
    }
    const r = await entrar(correo, clave);
    if (!r.ok) return pantallaLogin(raiz, { rol, error: r.motivo }, alEntrar);
    document.body.classList.remove('sin-sesion');
    alEntrar();
  };
}

/* Mientras carga la base, un aviso en vez de una pantalla vacía */
const cargandoHTML = t => `<div class="cargando"><i></i>${esc(t || 'Cargando…')}</div>`;

/* Un botón ocupado mientras la base responde */
async function ocupado(boton, tarea){
  if (boton){ boton.disabled = true; boton.classList.add('ocupado'); }
  try { return await tarea(); }
  finally { if (boton && boton.isConnected){ boton.disabled = false; boton.classList.remove('ocupado'); } }
}
