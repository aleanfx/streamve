# StreamVe — estado del proyecto

Archivo de continuidad. Leelo primero al retomar.

## Qué es

Tienda de accesos a plataformas de streaming para Venezuela, con dos públicos: **personal** (de a una pantalla, sin registro) y **mayorista** (desde 10 u., con cuenta). Diferencial: confiabilidad, no precio.

- Producción: https://streamve.vercel.app · panel: `/panel.html`
- Repo: https://github.com/aleanfx/streamve (público — nada sensible en el código)
- Deploy: cada `git push` a `main` despliega solo en Vercel

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html` | marcado de la tienda (portal de entrada, cabecera, pie) |
| `estilo.css` | sistema visual compartido |
| `ui.js` | `CFG` del negocio y utilidades (`usd`, `bs`, `esc`, `hora12`…) |
| `catalogo.js` | `CAT` (servicios, planes, precio público y mayorista) y `DESC`. **El stock no va acá** |
| `tienda.js` | estado y vistas de la tienda |
| `datos.js` | **modelo de datos, las 8 reglas de negocio y datos simulados** |
| `panel.html/.css/.js` | panel de operación (admin) |
| `cuenta.html/.css/.js` | portal del cliente: `cuenta.html?c=CODIGO` |
| `pruebas.js` | verificación de reglas: `node pruebas.js` |
| `docs/` | brief de diseño, naming, prompts de imágenes |

Carga: `ui.js` → `catalogo.js` → `datos.js` → vista (la tienda también carga `datos.js`). Las vistas **no calculan**: consultan `datos.js`. El stock que ve el público es `stockDisponible()` / `stockPlan()`, el mismo del panel.

Vista previa local: `.claude/launch.json` levanta `python -m http.server 5173`.

## Modelo de negocio (decidido)

- Comprar **cuenta completa** (~$11, 4 pantallas) y vender por pantalla. Break-even a 2 de 4.
- Venta a **$6** personal / **$4,50** mayorista (Netflix pantalla). El $6 es precio de relación, no de mercado (online se ve a $2.50).
- Precios aplicados (público / mayorista): Netflix $6 / $4,50 · Disney+ y HBO Max $5 / $3,75 · Prime $4 / $3 · Spotify, Crunchyroll y Paramount+ $3,50 / $2,60. Cuentas completas: Netflix $20, Disney+ $16, HBO Max $12. Se quitó el plan "Perfil" de Netflix. `node pruebas.js` falla si algún precio queda en pérdida.
- **Estrategia de canal (decidida):** WhatsApp cierra la venta, la plataforma opera. La web es vitrina (cada compra abre WhatsApp con el pedido escrito), el panel es el sistema de Ale, y el portal es el post-venta del cliente.
- Proveedores candidatos: TANCHI TV y joseb.shop (VirtuMall), askaboutme (Gudfy).
- Captación: red cercana + referidos + revendedores chicos. Ads recién con 100+ clientes propios. **Nunca listas de terceros.**

## Reglas de negocio (`datos.js`)

1. El stock se descuenta al verificar el pago, no al pagar
2. Al entregar se asigna un perfil libre; vence a 30 × meses
3. "Por vencer" = 3 días antes
4. **Reponer no mueve la fecha de vencimiento**; el perfil caído sale del stock
5. Una cuenta madre nunca supera su capacidad
6. Mayorista: saldo nunca negativo, mínimo 10 u.
7. Margen real = precio − (costo cuenta madre ÷ capacidad)
8. Cuenta madre que vence antes que sus clientes = alerta roja

## Decisiones de diseño

- Sistema **Modernist** (Archivo, acento `#ec3013`, filetes). Desviaciones pedidas por Ale: radio 4px/6px, logos reales de las plataformas, video del hero en color.
- Tienda = cinematográfica (estilo Netflix). Paneles = herramienta densa, estado visible antes de leerse.
- Fondo de la tienda: gris → negro con el scroll (JS interpola `--fondo` en los primeros 800px).
- Horario de atención: **8:00 am a 9:00 pm, hora de Venezuela** (`horaVE()` usa `America/Caracas`).

## Hecho

- Tienda completa: portal consumidor/mayorista, hero con tráiler y sonido, rieles con flechas, tarjetas con descripción en hover, ficha de producto en dos columnas, checkout, pedido, login mayorista con collage.
- Modelo de datos con reglas verificadas.
- Panel de operación: Hoy, cuentas madre, suscripciones, clientes, dinero.
- **Fase 2** (portal del cliente): una tarjeta por acceso con días restantes en grande y 30 marcas de tiempo, credenciales con VER/COPIAR, RENOVAR (1 o 12 meses), PEDIR CÓDIGO (solo video), NO ME FUNCIONA con 4 causas (abre incidencia + WhatsApp), historial y reglas de uso. Códigos de 10 caracteres sin ambiguos. `datos.js` ya trae las reglas de venta, renovación, mayorista y recargas (`registrarVenta`, `renovar`, `comprarMayorista`, `solicitarRecarga`, `acreditarRecarga`, `asignarACliente`, `entregarPedido`).
- **Fase 1** (tienda): rutas con `#` (`#/netflix`, `#/netflix/pedido`, `#/catalogo`, `#/revendedores`); "Tu pedido" en tres pasos que termina en WhatsApp con el mensaje armado (vista previa tipo chat, datos de pago con COPIAR, estado abierto/cerrado real); página de revendedores; preguntas frecuentes; hero vertical en el teléfono.
- **Fase 0** (base): `<!doctype>` + viewport (el móvil se veía achicado), Open Graph con `assets/og.jpg`, tasa BCV automática, un solo stock, precios nuevos y estado "agotado".

## Pendiente (plan por fases, una por vez)

3. **Fase 3 — Panel del mayorista** (`mayorista.html`): saldo, comprar contra saldo, mis clientes, vencimientos
4. **Fase 4 — Panel de Ale:** + VENTA, MANDAR ACCESO, recargas por acreditar, tablas → tarjetas en móvil
5. **Fase 5 — Backend** (Supabase) con `db.js` que llena `DB` con la misma forma
6. Más adelante: recordatorios con la API de WhatsApp (~$0,011 por aviso)

Antes de lanzar: poner el WhatsApp y los datos de cobro reales en `CFG` (`ui.js`). Hoy son de relleno.

## Trampas conocidas

- `<video>` insertado con `innerHTML` no carga solo → `load()` + `play()` a mano
- El scroll (`wheel`) **no** cuenta como gesto: el audio solo se habilita con clic, tecla o toque
- Una regla de clase le gana a `[hidden]` → está declarado `[hidden]{display:none!important}`
- `toISOString()` convierte a UTC: en UTC-4 la medianoche cae el día anterior → `dia()` usa partes locales
- `new Date('2026-10-05')` también es UTC → toda fecha de texto pasa por `aFecha()`
- El servidor local cachea los .js: tras cambiar `datos.js`, recargar con `fetch(f, {cache:'reload'})` o el navegador sigue con el viejo
- El campo `card` solo se declara si el archivo existe; si no, el tile sale negro
- El navegador de pruebas de Claude no decodifica video: verificar el hero con ffmpeg. Si la captura se cuelga, pausar el video por JS
- **Sin `<!doctype html>` + viewport** el navegador entra en modo quirks y el celular dibuja la versión de escritorio achicada. Toda página nueva los lleva
- La tasa en Bs se lee de `ve.dolarapi.com/v1/dolares/oficial` (BCV). `CFG.tasaBs` es solo el respaldo si la API cae
- La portada no se re-renderiza al llegar la tasa: reiniciaría el video
- Navegación: siempre `ir(pantalla)` o un `<a href="#/...">`. `aplicarRuta()` es lo único que cambia `S.pantalla`
- En `ui.js` no va nada que dependa de `S`: lo usan también el portal y los paneles
- Capturas del navegador de Claude: en tamaño escritorio solo devuelve un recorte; revisar escritorio midiendo con JS y lo visual en tamaño móvil

## Assets

- Video y fotos se procesan con el ffmpeg de `imageio_ffmpeg` (Python) y PIL
- Tarjetas: WebP 1000×1250, ≤150 KB · Hero: MP4 1440×810 crf 21, ~2,6 MB
- `og.jpg` 1200×630: un fotograma del hero con el logo en la pantalla del televisor (PIL + Arial Black)
- Originales pesados quedan locales (`.gitignore`), se versiona solo lo optimizado
