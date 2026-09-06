# StreamVe

Tienda de accesos a plataformas de streaming para Venezuela. Dos públicos en la misma tienda: **personal** (una o dos pantallas) y **mayorista** (desde 10 unidades).

La promesa del negocio es la confiabilidad, no el precio: la cuenta no se cae, se renueva sin reconfigurar nada, y alguien contesta rápido. Todo el diseño está construido alrededor de eso.

## Estado

Prototipo funcional de front-end. **Sin backend todavía** — el catálogo, el stock y los pedidos viven en memoria y se reinician al recargar. El login mayorista entra con cualquier credencial.

## Correr

No hay build ni dependencias. Abrí `index.html` en el navegador, o serví la carpeta:

```bash
npx serve .
```

## Configuración

Todo lo que se cambia sin tocar el resto del código está en el objeto `CFG`, arriba del `<script>` en `index.html`:

| Clave | Qué controla |
|---|---|
| `garantiaDias` | Días de garantía que se muestran en toda la tienda |
| `ventanaEntrega` | Ventana de entrega (ej. `8–20 min`) |
| `mostrarBolivares` | Muestra u oculta el equivalente en Bs |
| `tasaBs` | Tasa de cambio Bs/$ |
| `descuentoAnual` | Descuento del plan de 12 meses |
| `minMayorista` | Unidades mínimas del pedido mayorista |
| `whatsapp` | Número al que llega el botón de WhatsApp |
| `binanceCorreo`, `pmBanco`, `pmTelefono` | Datos de cobro que ve el cliente |

El catálogo es el array `CAT`: cada servicio lleva sus planes con precio y stock, más `mayor` (precio unitario mayorista) y `renovable`.

## Pantallas

`home` · `catalogo` · `detalle` · `checkout` · `pedido` · `mayorista` (login y panel)

## Diseño

Sistema **Modernist**: tipografía Archivo, cero radios, reglas de 2px, todo alineado a la izquierda, escarlata `#ec3013` reservado para la acción principal. El brief original está en [`docs/brief-diseno.md`](docs/brief-diseno.md).

Los servicios se muestran con arte propio generado en CSS. **No se usan logos de terceros** a propósito: publicar marcas ajenas en una tienda de reventa es lo que hace que una pasarela de pago cierre la cuenta.

## Pendiente

- Backend: catálogo, inventario y pedidos persistentes
- Autenticación real del panel mayorista
- Confirmación manual de pago y descuento de inventario
- Bot de códigos de verificación (la pieza que más soporte ahorra)
