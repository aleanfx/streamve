# Prompts para las imágenes y el video de StreamVe

Los prompts van **en inglés** porque los modelos de imagen responden bastante mejor así. Al lado de cada uno te explico qué está pidiendo.

## Cómo se usan

Cada imagen se arma con **dos partes**: el bloque de estilo (siempre el mismo) más el sujeto. El bloque de estilo es lo que hace que las siete se vean como un set y no como siete imágenes sueltas — no lo cambies entre una y otra.

### Bloque de estilo — va en TODAS

```
black and white photograph, high contrast, deep crushed blacks, single
practical light source coming from an off-screen glowing screen, soft
falloff into darkness at the bottom of the frame, 35mm film grain,
shallow depth of field, 40mm lens, underexposed, quiet and cinematic,
no text, no logos, no brand marks, screens show only abstract soft
blurred light with no recognizable content
```

Qué pide: blanco y negro contrastado, negros profundos, una sola fuente de luz que sale de una pantalla fuera de cuadro, la parte de abajo cayendo a oscuro, grano de película, poca profundidad de campo, subexpuesto.

**Las dos líneas finales son las importantes y no se negocian.** "Sin texto, sin logos, sin marcas" y "las pantallas muestran solo luz difusa abstracta sin contenido reconocible". Si el modelo te mete una película identificable en el televisor, eso es material con derechos dentro de tu tienda.

### Regla de composición

El nombre del servicio se imprime **abajo a la izquierda** y la etiqueta de stock **arriba a la derecha**. Así que el sujeto tiene que vivir en el centro y el tercio superior, y la parte de abajo tiene que caer sola a negro. Por eso el bloque de estilo pide `soft falloff into darkness at the bottom of the frame`.

**Formato: 4:5 vertical** (ej. 1200×1500). Los tiles son verticales.

---

## Los siete servicios

### 1 · Netflix — `assets/nx.webp`

```
empty living room at night, a large television glowing on a bare wall,
an unoccupied sofa in the foreground, light spilling across the floor
```
Sala vacía de noche, un televisor grande iluminando una pared desnuda, un sofá vacío adelante, la luz derramándose por el piso.

### 2 · Disney+ — `assets/dp.webp`

```
silhouette of a child sitting cross-legged on a rug very close to a
glowing screen, wrapped in a blanket, seen from behind, domestic interior
```
Silueta de un niño sentado en una alfombra muy cerca de una pantalla encendida, envuelto en una manta, visto desde atrás.

### 3 · Max — `assets/mx.webp`

```
empty cinema auditorium, rows of seats in darkness, a projector beam
cutting through haze above the seats, dust floating in the light
```
Sala de cine vacía, filas de butacas a oscuras, el haz del proyector cortando la neblina, polvo flotando en la luz.

### 4 · Prime Video — `assets/pv.webp`

```
open laptop on rumpled bedsheets at night, screen glow washing over the
fabric folds, dark bedroom, nobody in frame
```
Laptop abierta sobre sábanas revueltas de noche, el brillo de la pantalla sobre los pliegues de la tela, cuarto oscuro, nadie en cuadro.

### 5 · Spotify — `assets/sp.webp`

```
over-ear headphones resting on a bare desk, one hard raking light from
the side, long shadow, empty dark room
```
Audífonos de copa sobre un escritorio vacío, una luz dura y rasante desde el costado, sombra larga, cuarto oscuro y vacío.

### 6 · Crunchyroll — `assets/cr.webp`

```
rain-wet city street at night, glowing signage reflected in the puddles,
strong bokeh, a lone figure walking away from camera
```
Calle mojada de noche, letreros reflejados en los charcos, mucho bokeh, una figura sola caminando de espaldas.

Da el ambiente de anime nocturno **sin usar nada de anime**, que es lo que necesitamos: cero material con derechos.

### 7 · Paramount+ — `assets/pp.webp`

```
cluster of old television antennas on a rooftop against a heavy night
sky, low angle, wires crossing the frame
```
Antenas viejas de televisión en una azotea contra un cielo cargado de noche, contrapicado, cables cruzando el cuadro.

> **No uses montañas para Paramount.** El logo de Paramount *es* una montaña con estrellas — evocarla es justo lo que no queremos. Por eso van antenas.

---

## El hero

El hero es **16:9 horizontal** y necesita dos piezas: el video y una imagen de respaldo.

### Video — `assets/hero.mp4` + `assets/hero.webm`

```
slow steady dolly push-in toward a large television glowing in a dark
empty room, dust particles drifting through the light beam, black and
white, high contrast, deep blacks, 35mm film grain, no camera shake,
no text, no logos, screen shows only soft abstract light
```
Un travelling lento y firme acercándose a un televisor encendido en un cuarto oscuro y vacío, partículas de polvo flotando en el haz, blanco y negro, sin temblor de cámara.

**Cómo pedirlo para que el loop no se note:** movimiento muy lento y constante, sin corte ni cambio de plano, y que empiece y termine en encuadres parecidos. Si el modelo te da algo que no cierra, generá 10 segundos y hacé un crossfade de medio segundo entre el final y el principio.

### Imagen de respaldo — `assets/hero.webp`

Misma escena, quieta. Sacala del primer fotograma del video: así el respaldo y el video son la misma imagen y no hay salto cuando el video arranca.

```
large television glowing in a dark empty room, dust in the light beam,
black and white, high contrast, deep blacks, 35mm film grain, wide shot
```

---

## Exportación — esto importa más de lo normal

Tu tráfico es móvil venezolano con conexiones lentas. Una tienda linda que tarda seis segundos en cargar vende menos que una fea que carga rápido.

| Archivo | Formato | Medida | Peso máximo |
|---|---|---|---|
| Los 7 servicios | WebP | 1200×1500 (4:5) | **150 KB** c/u |
| `hero.webp` | WebP | 1920×1080 | **200 KB** |
| `hero.mp4` | MP4 H.264 | 1280×720 | **2 MB** |
| `hero.webm` | WebM VP9 | 1280×720 | **1,5 MB** |

El video va **mudo** y de 6 a 10 segundos. Si no llega a esos pesos, bajá la resolución antes que la calidad — a ese tamaño y en blanco y negro casi no se nota.

Para comprimir: [Squoosh](https://squoosh.app) para las imágenes, [HandBrake](https://handbrake.fr) para el video. Los dos son gratis.

## Dónde ponerlas

Todo en la carpeta `assets/` del repo, con esos nombres exactos. Cuando estén, avisame y las conecto — el código ya está preparado para recibirlas.
