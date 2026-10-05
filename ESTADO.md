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
| `catalogo.js` | `CAT` (servicios, planes, precios, stock) y `DESC` |
| `tienda.js` | estado y vistas de la tienda |
| `datos.js` | **modelo de datos, las 8 reglas de negocio y datos simulados** |
| `panel.html/.css/.js` | panel de operación (admin) |
| `pruebas.js` | verificación de reglas: `node pruebas.js` |
| `docs/` | brief de diseño, naming, prompts de imágenes |

Carga: `ui.js` → `catalogo.js` → `datos.js` → vista. Las vistas **no calculan**: consultan `datos.js`.

## Modelo de negocio (decidido)

- Comprar **cuenta completa** (~$11, 4 pantallas) y vender por pantalla. Break-even a 2 de 4.
- Venta a **$6** personal / **~$4.50** mayorista. El $6 es precio de relación, no de mercado (online se ve a $2.50).
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

## Pendiente

- **Portal del cliente** (`cuenta.html?c=CODIGO`): mis cuentas, barra de tiempo, sacar código, renovar, reportar
- **Panel del mayorista**: saldo, comprar, mis clientes, vencimientos
- Revisión completa en **móvil** (todavía no se hizo)
- **Backend** (Supabase) recién con los flujos validados
- **HBO Max da margen negativo** (−$0,17): costo $2,83/perfil, venta $2,80. Subir precio o cambiar proveedor.

## Trampas conocidas

- `<video>` insertado con `innerHTML` no carga solo → `load()` + `play()` a mano
- El scroll (`wheel`) **no** cuenta como gesto: el audio solo se habilita con clic, tecla o toque
- Una regla de clase le gana a `[hidden]` → está declarado `[hidden]{display:none!important}`
- `toISOString()` convierte a UTC: en UTC-4 la medianoche cae el día anterior → `dia()` usa partes locales
- El campo `card` solo se declara si el archivo existe; si no, el tile sale negro
- El navegador de pruebas de Claude no decodifica video: verificar el hero con ffmpeg

## Assets

- Video y fotos se procesan con el ffmpeg de `imageio_ffmpeg` (Python) y PIL
- Tarjetas: WebP 1000×1250, ≤150 KB · Hero: MP4 1440×810 crf 21, ~2,6 MB
- Originales pesados quedan locales (`.gitignore`), se versiona solo lo optimizado
