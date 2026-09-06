# Tarjetas de los servicios

Una imagen por servicio. **Esta imagen es el tile completo** — tarjeta,
fondo y todo. Si existe, reemplaza la composición que hace el CSS.

| Archivo | Servicio | ¿Está? |
|---|---|---|
| `nx.webp` | Netflix | sí |
| `dp.webp` | Disney+ | — |
| `mx.webp` | Max | — |
| `pv.webp` | Prime Video | — |
| `sp.webp` | Spotify | — |
| `cr.webp` | Crunchyroll | — |
| `pp.webp` | Paramount+ | — |

## IMPORTANTE al agregar una

No alcanza con dejar el archivo acá: hay que **declararlo en el catálogo**
de `index.html`, en la línea del servicio:

```js
card:'assets/cards/dp.webp',
```

Si el campo está pero el archivo no existe, el tile sale **negro** — el
CSS no puede detectar que una imagen de fondo falló. Por eso el campo
solo se pone cuando el archivo ya está.

## Formato

4:5 vertical, 1000×1250, máximo 150 KB. Los originales pesados quedan
fuera del repo; se versiona el WebP optimizado.

Los prompts están en `docs/prompts-imagenes.md`.
