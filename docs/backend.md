# Conectar el backend (Supabase)

Hoy todo funciona con datos simulados: se ve y se usa, pero al recargar se pierde. Para operar de verdad hace falta una base de datos. La base ya está diseñada en [`supabase/esquema.sql`](../supabase/esquema.sql): las mismas tablas y reglas de `datos.js`, con la seguridad adentro.

## Lo que tenés que hacer vos (unos 10 minutos)

La cuenta la tenés que crear vos: Claude no puede crear cuentas ni poner contraseñas.

1. Entrá a **supabase.com** → *Start your project* → registrate (sirve con GitHub).
2. **New project**
   - Nombre: `streamve`
   - Contraseña de la base: generala y **guardala en tu gestor de contraseñas** (no va en el código ni en el chat)
   - Región: *East US* (la más cercana con buen precio)
   - Plan: *Free*
3. Cuando termine de crearse: menú izquierdo → **SQL Editor** → *New query* → pegá **todo** `supabase/esquema.sql` → **Run**. Tiene que decir *Success*.
4. **Authentication → Users → Add user → Create new user**: tu correo y una contraseña fuerte. Marcá *Auto Confirm User*.
5. Volvé al **SQL Editor** y corré esto, con tu correo:
   ```sql
   insert into admins (usuario) select id from auth.users where email = 'TU_CORREO';
   ```
6. **Project Settings → API**: copiá
   - *Project URL* (`https://xxxx.supabase.co`)
   - la clave **anon public**

   Pasame esas dos. Son públicas por diseño: van en el código y la seguridad la ponen las reglas de la base.
   **La `service_role` no me la pases nunca, ni la pegues en ningún lado.**

## Lo que hago yo después

- `db.js`: carga los datos de Supabase con la misma forma que `DB`, así las vistas no cambian
- Login con correo y contraseña en `panel.html` (solo admin) y en `mayorista.html`
- La tienda lee el stock real (`stock_publico`) y registra el pedido al tocar "Enviar por WhatsApp" (`crear_pedido_web`)
- El portal del cliente lee con su código (`portal`) y reporta fallas (`reportar_falla`)
- Cada acción del panel pasa por su función: `registrar_venta`, `entregar_pedido`, `reponer`, `renovar`, `acreditar_recarga`, `liberar`
- Los pedidos que llegan por la web entran como **esperando**: cuando ves la captura en WhatsApp con el código `SV-xxxx`, lo entregás y ahí indicás de quién es

## Para dar de alta un revendedor

1. *Authentication → Add user* con el correo del revendedor y una contraseña (se la mandás por privado).
2. En el panel lo cargás como cliente tipo *mayorista* y lo vinculás a ese usuario.

## Qué protege la base

| Quién | Qué puede |
|---|---|
| Cualquiera | ver precios y stock, abrir su portal con su código, crear un pedido |
| Revendedor | ver sus unidades, su saldo y sus clientes; comprar con saldo; pedir recargas |
| Ale | todo |

- Nadie sin sesión puede leer tablas: todo pasa por funciones que validan.
- El precio de un pedido lo calcula la base, nunca se cree el que manda el navegador.
- El revendedor nunca ve costos ni proveedores.
- Una suscripción vencida no muestra la clave en el portal.

## Estado

El esquema está escrito y revisado, pero **todavía no se ejecutó contra un Supabase real**: si el paso 3 tira un error, pasame el mensaje y lo corrijo.
