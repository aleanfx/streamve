# Prompts para las imágenes y el video de StreamVe

Los prompts van **en inglés** porque los modelos responden bastante mejor así. Al lado te explico qué pide cada uno.

---

# 1 · Las tarjetas (lo principal)

Una imagen por servicio, y esa imagen **es el tile completo**: tarjeta, fondo y todo. El código ya está preparado — si el archivo existe, reemplaza toda la composición que hace el CSS hoy.

## Antes de generar: lo del logo

**Los modelos de imagen no dibujan bien los logos reales.** Le pedís Netflix y te devuelve "NETFLLX", una N torcida, o algo que se le parece. Un logo mal hecho se ve peor que no tener logo, y encima te deja expuesto igual.

Por eso hay dos caminos:

**A · Tarjeta en blanco + logo real encima** ← el que te recomiendo
Flow genera el fondo de color con las luces y la tarjeta blanca vacía. Yo le monto encima el SVG oficial, que queda nítido y en la proporción correcta. Escala mejor: si mañana cambiás un logo, cambiás un archivo, no regenerás la imagen.

**B · Todo generado, logo incluido**
Más rápido de armar, pero vas a tener que descartar muchas generaciones hasta que un logo salga decente, y a alta resolución se nota.

Los prompts de abajo son para el camino **A**. Si querés el B, agregá al final `with the [Netflix] logo centred on the card face` — pero revisá el resultado al 100% de zoom antes de darlo por bueno.

## Bloque de estilo — va en TODAS

```
vertical 4:5 product shot of a premium gift card floating upright in the
centre of the frame, slightly angled toward the viewer, rounded corners,
clean blank white card face, a small punched hanging slot near the top
edge, soft realistic drop shadow beneath the card, set against a deep
COLOR background with soft out-of-focus light orbs and fine glittering
sparkles, dark vignette at the edges, glossy studio lighting, rich
contrast, centred composition with generous empty space around the card,
no text, no letters, no numbers, no logos, no writing anywhere
```

Qué pide: una tarjeta de regalo premium flotando en el centro, ligeramente inclinada, esquinas redondeadas, **cara blanca vacía**, la muesca de colgar arriba, sombra realista debajo, sobre un fondo de color profundo con luces desenfocadas y destellos, viñeta oscura en los bordes.

La última línea es la importante: **sin texto, sin letras, sin números, sin logos.** Si no la ponés, el modelo te va a inventar escritura falsa en la tarjeta.

## Los siete — cambiá solo `COLOR`

| Servicio | Archivo | Reemplazá `COLOR` por |
|---|---|---|
| Netflix | `assets/cards/nx.webp` | `deep crimson red` |
| Disney+ | `assets/cards/dp.webp` | `deep royal blue` |
| Max | `assets/cards/mx.webp` | `electric indigo` |
| Prime Video | `assets/cards/pv.webp` | `bright cyan blue` |
| Spotify | `assets/cards/sp.webp` | `deep emerald green` |
| Crunchyroll | `assets/cards/cr.webp` | `warm amber orange` |
| Paramount+ | `assets/cards/pp.webp` | `vivid azure blue` |

**No cambies nada más entre una y otra.** El bloque idéntico es lo que hace que las siete se vean como un set y no como siete imágenes sueltas.

## Composición

**4:5 vertical**, la tarjeta centrada y con aire alrededor. El tile recorta un poco por los lados en pantallas angostas, así que si la tarjeta queda pegada a un borde, se corta. Pedí siempre `generous empty space around the card`.

---

# 2 · El hero

El hero es **16:9 horizontal** y lleva dos piezas.

## Video — `assets/hero.mp4` + `assets/hero.webm`

```
slow steady dolly push-in toward a large television glowing in a dark
empty room, dust particles drifting through the light beam, black and
white, high contrast, deep blacks, 35mm film grain, no camera shake,
no text, no logos, screen shows only soft abstract light
```

Un travelling lento y firme acercándose a un televisor encendido en un cuarto oscuro, polvo flotando en el haz, blanco y negro, sin temblor de cámara.

**Para que el loop no se note:** movimiento muy lento y constante, sin cortes, y que empiece y termine en encuadres parecidos. Si no cierra, generá 10 segundos y hacé un crossfade de medio segundo entre el final y el principio.

## Imagen de respaldo — `assets/hero.webp`

Sacala del **primer fotograma del video**. Así no hay salto cuando el video arranca.

---

# 3 · Exportación

Tu tráfico es móvil venezolano con conexiones lentas. Una tienda linda que tarda seis segundos vende menos que una fea que carga rápido.

| Archivo | Formato | Medida | Peso máximo |
|---|---|---|---|
| Las 7 tarjetas | WebP | 1000×1250 (4:5) | **120 KB** c/u |
| `hero.webp` | WebP | 1920×1080 | **200 KB** |
| `hero.mp4` | MP4 H.264 | 1280×720 | **2 MB** |
| `hero.webm` | WebM VP9 | 1280×720 | **1,5 MB** |

El video va **mudo** y de 6 a 10 segundos. Si no llegás a esos pesos, bajá resolución antes que calidad.

Para comprimir: [Squoosh](https://squoosh.app) para imágenes, [HandBrake](https://handbrake.fr) para video. Gratis los dos.

---

# 4 · Dónde va cada cosa

```
assets/
├── cards/          las 7 tarjetas (nx, dp, mx, pv, sp, cr, pp .webp)
├── logos/          los SVG oficiales, si vas por el camino A
├── hero.webp
├── hero.mp4
├── hero.webm
├── logo-mark.png   tu S roja, fondo transparente
├── favicon.png     tu S, 512×512
└── logo-full.png   el lockup completo
```

Nada se rompe si falta algo: sin tarjeta queda la composición que hace el CSS hoy, sin logo queda el nombre escrito, sin la S queda el nombre en la barra. Subí lo que tengas y andá viendo.
