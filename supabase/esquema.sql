-- StreamVe — esquema de la base (Supabase / Postgres)
--
-- Cómo se usa: Supabase → SQL Editor → pegar este archivo entero → Run.
-- Es el espejo de datos.js: mismas tablas y mismas reglas de negocio,
-- pero acá las reglas viven en la base, así nadie las puede saltar desde
-- el navegador. El repo es público: este archivo no tiene ningún secreto.
--
-- Quién puede qué:
--   anónimo     → solo el catálogo, el stock, su portal (con su código) y
--                 crear un pedido desde la web
--   revendedor  → lo suyo (unidades, saldo, clientes), por funciones
--   admin (Ale) → todo
--
-- ESTADO: ejecutado en el proyecto csptgybisyleixcdgvpe (los permisos de tabla
-- se agregaron después: ver permisos.sql).

create extension if not exists pgcrypto;

-- ═══ código de portal ═══
-- 10 caracteres sin los que se confunden (0/O, 1/I/L): 31^10 combinaciones.
-- En Supabase pgcrypto vive en el esquema `extensions`: se fija la ruta
-- para que funcione también llamada desde las funciones de más abajo.
create or replace function nuevo_codigo() returns text
language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from (select gen_random_bytes(10) as b) x, generate_series(0, 9) as i
$$;

-- ═══ tablas ═══

create table planes (
  servicio_id      text not null,
  clave            text not null,
  etiqueta         text not null,
  precio           numeric(10,2) not null check (precio > 0),
  precio_mayorista numeric(10,2) check (precio_mayorista > 0),
  primary key (servicio_id, clave)
);

create table cuentas_madre (
  id          uuid primary key default gen_random_uuid(),
  servicio_id text not null,
  correo      text not null,
  clave       text not null,
  capacidad   int  not null check (capacidad between 1 and 8),
  costo       numeric(10,2) not null check (costo > 0),
  proveedor   text not null default '',
  comprada    date not null default current_date,
  vence       date not null,
  notas       text not null default '',
  creado      timestamptz not null default now()
);

create table clientes (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  whatsapp      text not null unique,
  tipo          text not null default 'personal' check (tipo in ('personal','mayorista')),
  codigo_acceso text not null unique default nuevo_codigo() check (codigo_acceso ~ '^[A-HJKMNP-Z2-9]{10}$'),
  usuario       uuid unique references auth.users(id) on delete set null,   -- solo revendedores
  creado        timestamptz not null default now()
);

create table clientes_finales (
  id           uuid primary key default gen_random_uuid(),
  mayorista_id uuid not null references clientes(id) on delete cascade,
  nombre       text not null,
  whatsapp     text not null default '',
  creado       timestamptz not null default now()
);

create table suscripciones (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references clientes(id),
  servicio_id  text not null,
  plan_clave   text not null,
  inicio       date not null default current_date,
  vence        date not null,
  precio       numeric(10,2) not null check (precio >= 0),
  meses        int  not null default 1 check (meses in (1, 12)),
  estado       text not null default 'activa' check (estado in ('activa','cancelada')),
  reposiciones int  not null default 0,
  asignado_a   uuid references clientes_finales(id) on delete set null,
  creado       timestamptz not null default now()
);
create index on suscripciones (cliente_id);
create index on suscripciones (vence);

-- Un perfil asignado tiene dueño y uno libre no: con eso una cuenta madre
-- nunca puede vender más perfiles de los que tiene (regla 5).
create table perfiles (
  id              uuid primary key default gen_random_uuid(),
  cuenta_madre_id uuid not null references cuentas_madre(id) on delete cascade,
  nombre          text not null,
  pin             text,
  estado          text not null default 'libre' check (estado in ('libre','asignado','caido')),
  suscripcion_id  uuid references suscripciones(id) on delete set null,
  check ((estado = 'asignado') = (suscripcion_id is not null))
);
create index on perfiles (cuenta_madre_id, estado);
create index on perfiles (suscripcion_id);

create table renovaciones (
  id             uuid primary key default gen_random_uuid(),
  suscripcion_id uuid not null references suscripciones(id) on delete cascade,
  fecha          date not null default current_date,
  meses          int  not null,
  precio         numeric(10,2) not null
);

create sequence pedido_num start 4300;
create table pedidos (
  id          text primary key default 'SV-' || nextval('pedido_num'),
  cliente_id  uuid references clientes(id),     -- null: llegó por la web y todavía no se sabe quién es
  items       jsonb not null,                   -- [{servicio_id, plan_clave, cantidad, meses, precio}]
  total       numeric(10,2) not null check (total >= 0),
  metodo_pago text not null,
  referencia  text not null default '',
  -- esperando: se abrió WhatsApp desde la web, falta la captura
  estado      text not null default 'esperando'
              check (estado in ('esperando','pagado','verificado','preparando','entregado','rechazado')),
  creado      timestamptz not null default now(),
  entregado   timestamptz
);

create table movimientos (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  tipo       text not null check (tipo in ('recarga','consumo','ajuste')),
  monto      numeric(10,2) not null check (monto > 0),
  estado     text not null default 'ok' check (estado in ('pendiente','ok')),
  referencia text not null default '',
  fecha      timestamptz not null default now()
);
create index on movimientos (cliente_id);

create table incidencias (
  id             uuid primary key default gen_random_uuid(),
  suscripcion_id uuid not null references suscripciones(id) on delete cascade,
  causa          text not null,
  abierta        timestamptz not null default now(),
  cerrada        timestamptz,
  accion         text check (accion in ('repuesta','reembolso'))
);
-- Una sola incidencia abierta por suscripción: reportar dos veces no duplica
create unique index una_abierta on incidencias (suscripcion_id) where cerrada is null;

create table admins (
  usuario uuid primary key references auth.users(id) on delete cascade
);

-- Al cargar una cuenta madre nacen sus perfiles, todos libres
create or replace function crear_perfiles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (cuenta_madre_id, nombre, pin)
  select new.id, 'Perfil ' || n, (1000 + floor(random() * 9000))::int::text
  from generate_series(1, new.capacidad) as n;
  return new;
end $$;
create trigger cuentas_madre_perfiles after insert on cuentas_madre
  for each row execute function crear_perfiles();

-- ═══ quién es quién ═══

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where usuario = auth.uid())
$$;

create or replace function mi_cliente() returns uuid
language sql stable security definer set search_path = public as $$
  select id from clientes where usuario = auth.uid()
$$;

-- Regla 6: una recarga cuenta recién cuando está acreditada
create or replace function saldo_de(p_cliente uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when tipo = 'recarga' then monto else -monto end), 0)
  from movimientos where cliente_id = p_cliente and estado = 'ok'
$$;

-- Precio de una venta: 12 meses llevan 15% de descuento
create or replace function precio_venta(p_servicio text, p_plan text, p_meses int, p_mayorista boolean)
returns numeric language sql stable security definer set search_path = public as $$
  select round(
    (case when p_mayorista and precio_mayorista is not null then precio_mayorista else precio end)
    * p_meses * (case when p_meses = 12 then 0.85 else 1 end), 2)
  from planes where servicio_id = p_servicio and clave = p_plan
$$;

-- ═══ inventario (internas: no se exponen) ═══

-- Regla 2: se toma un perfil libre de la cuenta madre viva que vence más
-- tarde. La cuenta completa necesita una madre entera libre.
create or replace function tomar_perfiles(p_servicio text, p_completa boolean, p_suscripcion uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_madre uuid; v_perfil uuid; n int;
begin
  if p_completa then
    select m.id into v_madre from cuentas_madre m
    where m.servicio_id = p_servicio and m.vence >= current_date
      and not exists (select 1 from perfiles p where p.cuenta_madre_id = m.id and p.estado <> 'libre')
    order by m.vence desc limit 1
    for update skip locked;
    if v_madre is null then return 0; end if;
    update perfiles set estado = 'asignado', suscripcion_id = p_suscripcion where cuenta_madre_id = v_madre;
    get diagnostics n = row_count;
    return n;
  end if;
  select p.id into v_perfil from perfiles p join cuentas_madre m on m.id = p.cuenta_madre_id
  where m.servicio_id = p_servicio and m.vence >= current_date and p.estado = 'libre'
  order by m.vence desc, p.nombre limit 1
  for update of p skip locked;
  if v_perfil is null then return 0; end if;
  update perfiles set estado = 'asignado', suscripcion_id = p_suscripcion where id = v_perfil;
  return 1;
end $$;

create or replace function crear_suscripcion(p_cliente uuid, p_servicio text, p_plan text,
  p_meses int, p_precio numeric, p_asignado uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into suscripciones (cliente_id, servicio_id, plan_clave, vence, precio, meses, asignado_a)
  values (p_cliente, p_servicio, p_plan, current_date + 30 * p_meses, p_precio, p_meses, p_asignado)
  returning id into v_id;
  if tomar_perfiles(p_servicio, p_plan = 'completa', v_id) = 0 then
    raise exception 'No hay stock de % (%)', p_servicio, p_plan;
  end if;
  return v_id;
end $$;

-- Renovar suma desde el vencimiento, o desde hoy si ya venció
create or replace function renovar_interno(p_suscripcion uuid, p_meses int)
returns json language plpgsql security definer set search_path = public as $$
declare s suscripciones; v_tipo text; v_precio numeric; v_vence date;
begin
  if p_meses not in (1, 12) then raise exception 'Meses inválidos'; end if;
  select * into s from suscripciones where id = p_suscripcion for update;
  if not found then raise exception 'La suscripción no existe'; end if;
  select tipo into v_tipo from clientes where id = s.cliente_id;
  v_precio := precio_venta(s.servicio_id, s.plan_clave, p_meses, v_tipo = 'mayorista');
  v_vence := greatest(s.vence, current_date) + 30 * p_meses;
  update suscripciones set vence = v_vence, estado = 'activa' where id = p_suscripcion;
  insert into renovaciones (suscripcion_id, meses, precio) values (p_suscripcion, p_meses, v_precio);
  return json_build_object('vence', v_vence, 'precio', v_precio, 'cliente', s.cliente_id);
end $$;

-- ═══ público (sin sesión) ═══

-- Stock real por plan, lo que muestra la tienda
create or replace function stock_publico()
returns table (servicio_id text, plan_clave text, libres bigint)
language sql stable security definer set search_path = public as $$
  with por_madre as (
    select m.id, m.servicio_id, m.capacidad,
           count(*) filter (where p.estado = 'libre') as libres
    from cuentas_madre m join perfiles p on p.cuenta_madre_id = m.id
    where m.vence >= current_date
    group by m.id, m.servicio_id, m.capacidad
  )
  select pl.servicio_id, pl.clave,
         case when pl.clave = 'completa'
              then (select count(*) from por_madre x where x.servicio_id = pl.servicio_id and x.libres = x.capacidad)
              else (select coalesce(sum(x.libres), 0) from por_madre x where x.servicio_id = pl.servicio_id)::bigint
         end
  from planes pl
$$;

-- El pedido que arma la web. El precio se calcula acá, nunca se cree el
-- que manda el navegador. Freno simple contra el abuso.
create or replace function crear_pedido_web(p_servicio text, p_plan text, p_meses int, p_metodo text)
returns json language plpgsql security definer set search_path = public as $$
declare v_total numeric; v_id text;
begin
  if p_meses not in (1, 12) then raise exception 'Meses inválidos'; end if;
  if (select count(*) from pedidos where cliente_id is null and creado > now() - interval '10 minutes') >= 30 then
    raise exception 'Demasiados pedidos seguidos: probá en unos minutos';
  end if;
  v_total := precio_venta(p_servicio, p_plan, p_meses, false);
  if v_total is null then raise exception 'Ese plan no existe'; end if;
  insert into pedidos (items, total, metodo_pago)
  values (jsonb_build_array(jsonb_build_object('servicio_id', p_servicio, 'plan_clave', p_plan,
                                               'cantidad', 1, 'meses', p_meses, 'precio', v_total)),
          v_total, case when p_metodo = 'pm' then 'pagoMovil' else 'binance' end)
  returning id into v_id;
  return json_build_object('id', v_id, 'total', v_total);
end $$;

-- El portal del cliente: todo lo suyo, solo con su código. A una
-- suscripción vencida no se le devuelve la clave.
create or replace function portal(p_codigo text)
returns json language plpgsql stable security definer set search_path = public as $$
declare c clientes;
begin
  select * into c from clientes where codigo_acceso = upper(trim(p_codigo));
  if not found then return null; end if;
  return json_build_object(
    'cliente', json_build_object('nombre', c.nombre, 'tipo', c.tipo, 'codigo', c.codigo_acceso),
    'suscripciones', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'servicio_id', s.servicio_id, 'plan_clave', s.plan_clave,
        'inicio', s.inicio, 'vence', s.vence, 'meses', s.meses, 'precio', s.precio,
        'reposiciones', s.reposiciones,
        'correo', case when s.vence >= current_date then m.correo end,
        'clave',  case when s.vence >= current_date then m.clave end,
        'perfil', case when s.plan_clave = 'completa' then 'Todos (' || m.capacidad || ')' else p.nombre end,
        'pin',    case when s.plan_clave = 'completa' or s.vence < current_date then null else p.pin end
      ) order by s.vence)
      from suscripciones s
      left join lateral (select * from perfiles where suscripcion_id = s.id order by nombre limit 1) p on true
      left join cuentas_madre m on m.id = p.cuenta_madre_id
      where s.cliente_id = c.id and s.estado <> 'cancelada'), '[]'::json),
    'renovaciones', coalesce((
      select json_agg(json_build_object('suscripcion_id', r.suscripcion_id, 'fecha', r.fecha,
                                        'meses', r.meses, 'precio', r.precio))
      from renovaciones r join suscripciones s on s.id = r.suscripcion_id
      where s.cliente_id = c.id), '[]'::json),
    'incidencias', coalesce((
      select json_agg(json_build_object('suscripcion_id', i.suscripcion_id, 'causa', i.causa,
                                        'abierta', i.abierta, 'cerrada', i.cerrada))
      from incidencias i join suscripciones s on s.id = i.suscripcion_id
      where s.cliente_id = c.id), '[]'::json)
  );
end $$;

create or replace function reportar_falla(p_codigo text, p_suscripcion uuid, p_causa text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from suscripciones s join clientes c on c.id = s.cliente_id
                 where s.id = p_suscripcion and c.codigo_acceso = upper(trim(p_codigo))) then
    return false;
  end if;
  insert into incidencias (suscripcion_id, causa)
  values (p_suscripcion, left(coalesce(nullif(trim(p_causa), ''), 'Otro problema'), 120))
  on conflict (suscripcion_id) where cerrada is null do nothing;
  return true;
end $$;

-- ═══ revendedor (con sesión) ═══

create or replace function mi_saldo() returns numeric
language sql stable security definer set search_path = public as $$
  select saldo_de(mi_cliente())
$$;

create or replace function mis_unidades() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', s.id, 'servicio_id', s.servicio_id, 'plan_clave', s.plan_clave,
    'inicio', s.inicio, 'vence', s.vence, 'meses', s.meses, 'precio', s.precio,
    'asignado_a', s.asignado_a,
    'cliente_final', case when f.id is null then null
                          else json_build_object('nombre', f.nombre, 'whatsapp', f.whatsapp) end,
    'correo', m.correo, 'clave', m.clave, 'perfil', p.nombre, 'pin', p.pin
  ) order by s.vence), '[]'::json)
  from suscripciones s
  left join lateral (select * from perfiles where suscripcion_id = s.id order by nombre limit 1) p on true
  left join cuentas_madre m on m.id = p.cuenta_madre_id
  left join clientes_finales f on f.id = s.asignado_a
  where s.cliente_id = mi_cliente() and s.estado <> 'cancelada'
$$;

-- Compra con saldo: mínimo 10 u., el saldo nunca queda negativo y las
-- unidades se asignan en el acto. Todo o nada.
create or replace function comprar_mayorista(p_items jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := mi_cliente(); v_tipo text; it jsonb; v_pl planes;
  v_unid int := 0; v_monto numeric := 0; v_ids uuid[] := '{}'; v_ped text; v_cant int;
begin
  select tipo into v_tipo from clientes where id = v_yo for update;   -- una compra a la vez
  if v_tipo is distinct from 'mayorista' then raise exception 'Solo para revendedores'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := coalesce((it->>'cantidad')::int, 0);
    if v_cant < 0 then raise exception 'Cantidad inválida'; end if;
    select * into v_pl from planes
    where servicio_id = it->>'servicio_id' and precio_mayorista is not null order by clave limit 1;
    if not found then raise exception 'Servicio inválido'; end if;
    v_unid := v_unid + v_cant;
    v_monto := v_monto + v_cant * v_pl.precio_mayorista;
  end loop;
  if v_unid < 10 then raise exception 'El mínimo es 10 unidades'; end if;
  if saldo_de(v_yo) < v_monto then raise exception 'Saldo insuficiente'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_pl from planes
    where servicio_id = it->>'servicio_id' and precio_mayorista is not null order by clave limit 1;
    for n in 1 .. coalesce((it->>'cantidad')::int, 0) loop
      v_ids := v_ids || crear_suscripcion(v_yo, v_pl.servicio_id, v_pl.clave, 1, v_pl.precio_mayorista);
    end loop;
  end loop;
  insert into pedidos (cliente_id, items, total, metodo_pago, referencia, estado, entregado)
  values (v_yo, p_items, v_monto, 'saldo', v_unid || ' u.', 'entregado', now())
  returning id into v_ped;
  insert into movimientos (cliente_id, tipo, monto, referencia)
  values (v_yo, 'consumo', v_monto, 'Pedido ' || v_ped || ' · ' || v_unid || ' u.');
  return json_build_object('pedido', v_ped, 'monto', v_monto, 'suscripciones', v_ids);
end $$;

create or replace function solicitar_recarga(p_monto numeric, p_metodo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if mi_cliente() is null then raise exception 'Sin sesión de revendedor'; end if;
  if not (p_monto > 0 and p_monto <= 2000) then raise exception 'Monto inválido'; end if;
  insert into movimientos (cliente_id, tipo, monto, estado, referencia)
  values (mi_cliente(), 'recarga', p_monto, 'pendiente', case when p_metodo = 'pm' then 'Pago Móvil' else 'Binance' end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function asignar_a_cliente(p_suscripcion uuid, p_nombre text, p_whatsapp text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_yo uuid := mi_cliente(); v_tel text; v_cf uuid;
begin
  if not exists (select 1 from suscripciones where id = p_suscripcion and cliente_id = v_yo) then
    raise exception 'Esa unidad no es tuya';
  end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre'; end if;
  v_tel := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if v_tel like '0%' then v_tel := '58' || substr(v_tel, 2); end if;
  select id into v_cf from clientes_finales where mayorista_id = v_yo and whatsapp = v_tel and v_tel <> '';
  if v_cf is null then
    insert into clientes_finales (mayorista_id, nombre, whatsapp) values (v_yo, trim(p_nombre), v_tel)
    returning id into v_cf;
  end if;
  update suscripciones set asignado_a = v_cf where id = p_suscripcion;
  return v_cf;
end $$;

create or replace function renovar_con_saldo(p_suscripcion uuid, p_meses int)
returns json language plpgsql security definer set search_path = public as $$
declare v_yo uuid := mi_cliente(); v json;
begin
  perform 1 from clientes where id = v_yo for update;
  if not exists (select 1 from suscripciones where id = p_suscripcion and cliente_id = v_yo) then
    raise exception 'Esa unidad no es tuya';
  end if;
  v := renovar_interno(p_suscripcion, p_meses);
  if saldo_de(v_yo) < (v->>'precio')::numeric then raise exception 'Saldo insuficiente'; end if;
  insert into movimientos (cliente_id, tipo, monto, referencia)
  values (v_yo, 'consumo', (v->>'precio')::numeric, 'Renovación');
  return v;
end $$;

-- ═══ admin ═══

create or replace function solo_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo el administrador'; end if;
end $$;

-- Regla 1: el stock se descuenta al entregar. Un pedido de la web llega sin
-- cliente: al entregarlo se indica de quién es.
create or replace function entregar_pedido(p_id text, p_cliente uuid default null)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare v pedidos; it jsonb; v_cli uuid;
begin
  perform solo_admin();
  select * into v from pedidos where id = p_id for update;
  if not found then raise exception 'El pedido no existe'; end if;
  if v.estado = 'entregado' then raise exception 'Ya estaba entregado'; end if;
  v_cli := coalesce(v.cliente_id, p_cliente);
  if v_cli is null then raise exception 'Indicá de qué cliente es el pedido'; end if;
  for it in select * from jsonb_array_elements(v.items) loop
    for n in 1 .. coalesce((it->>'cantidad')::int, 1) loop
      return next crear_suscripcion(v_cli, it->>'servicio_id', it->>'plan_clave',
                                    coalesce((it->>'meses')::int, 1), (it->>'precio')::numeric);
    end loop;
  end loop;
  update pedidos set estado = 'entregado', entregado = now(), cliente_id = v_cli where id = p_id;
end $$;

-- Venta que entró directo por WhatsApp: si el cliente no existe, se crea
create or replace function registrar_venta(p_cliente uuid, p_nombre text, p_whatsapp text,
  p_servicio text, p_plan text, p_meses int, p_metodo text)
returns json language plpgsql security definer set search_path = public as $$
declare v_cli uuid := p_cliente; v_tel text; v_precio numeric; v_s uuid; v_ped text;
begin
  perform solo_admin();
  if v_cli is null then
    if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre del cliente'; end if;
    v_tel := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
    if v_tel like '0%' then v_tel := '58' || substr(v_tel, 2); end if;
    if length(v_tel) < 11 then raise exception 'El WhatsApp no parece válido'; end if;
    insert into clientes (nombre, whatsapp) values (trim(p_nombre), v_tel)
    on conflict (whatsapp) do update set nombre = clientes.nombre
    returning id into v_cli;
  end if;
  v_precio := precio_venta(p_servicio, p_plan, p_meses, false);
  if v_precio is null then raise exception 'Ese plan no existe'; end if;
  v_s := crear_suscripcion(v_cli, p_servicio, p_plan, p_meses, v_precio);
  insert into pedidos (cliente_id, items, total, metodo_pago, referencia, estado, entregado)
  values (v_cli, jsonb_build_array(jsonb_build_object('servicio_id', p_servicio, 'plan_clave', p_plan,
                                                      'cantidad', 1, 'meses', p_meses, 'precio', v_precio)),
          v_precio, coalesce(p_metodo, 'whatsapp'), 'venta directa', 'entregado', now())
  returning id into v_ped;
  return json_build_object('cliente', v_cli, 'suscripcion', v_s, 'pedido', v_ped);
end $$;

-- Regla 4: reponer no mueve la fecha de vencimiento
create or replace function reponer(p_suscripcion uuid, p_causa text default 'No entraba')
returns void language plpgsql security definer set search_path = public as $$
declare s suscripciones;
begin
  perform solo_admin();
  select * into s from suscripciones where id = p_suscripcion for update;
  if not found then raise exception 'La suscripción no existe'; end if;
  update perfiles set estado = 'caido', suscripcion_id = null where suscripcion_id = p_suscripcion;
  if tomar_perfiles(s.servicio_id, s.plan_clave = 'completa', p_suscripcion) = 0 then
    raise exception 'No hay perfiles libres de %', s.servicio_id;
  end if;
  update suscripciones set reposiciones = reposiciones + 1 where id = p_suscripcion;
  update incidencias set cerrada = now(), accion = 'repuesta'
  where suscripcion_id = p_suscripcion and cerrada is null;
  if not found then
    insert into incidencias (suscripcion_id, causa, cerrada, accion)
    values (p_suscripcion, p_causa, now(), 'repuesta');
  end if;
end $$;

create or replace function renovar(p_suscripcion uuid, p_meses int)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform solo_admin();
  return renovar_interno(p_suscripcion, p_meses);
end $$;

create or replace function acreditar_recarga(p_movimiento uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform solo_admin();
  update movimientos set estado = 'ok'
  where id = p_movimiento and tipo = 'recarga' and estado = 'pendiente';
  if not found then raise exception 'No hay nada que acreditar'; end if;
end $$;

-- El cliente no renovó: pasados los días de gracia el perfil vuelve al
-- stock. Antes de revenderlo hay que cambiarle el PIN.
create or replace function liberar(p_suscripcion uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform solo_admin();
  if not exists (select 1 from suscripciones where id = p_suscripcion and vence < current_date) then
    raise exception 'Todavía no venció';
  end if;
  update perfiles set estado = 'libre', suscripcion_id = null
  where suscripcion_id = p_suscripcion and estado = 'asignado';
  get diagnostics n = row_count;
  update suscripciones set estado = 'cancelada' where id = p_suscripcion;
  return n;
end $$;

-- ═══ seguridad por fila ═══

do $$
declare t text;
begin
  foreach t in array array['planes','cuentas_madre','perfiles','clientes','clientes_finales','suscripciones',
                           'renovaciones','pedidos','movimientos','incidencias','admins'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_todo on %I for all to authenticated using (es_admin()) with check (es_admin())', t);
  end loop;
end $$;

-- El catálogo lo ve cualquiera
create policy planes_publico on planes for select to anon, authenticated using (true);

-- El revendedor lee lo suyo; escribe solo por funciones. Las cuentas madre
-- (costo, proveedor) no las ve nunca: su acceso le llega por mis_unidades().
create policy yo_cliente  on clientes         for select to authenticated using (usuario = auth.uid());
create policy yo_susc     on suscripciones    for select to authenticated using (cliente_id = mi_cliente());
create policy yo_movs     on movimientos      for select to authenticated using (cliente_id = mi_cliente());
create policy yo_finales  on clientes_finales for select to authenticated using (mayorista_id = mi_cliente());
create policy yo_pedidos  on pedidos          for select to authenticated using (cliente_id = mi_cliente());

-- ═══ permisos de las funciones ═══
-- Por defecto Postgres deja ejecutar cualquier función: se cierra todo y se
-- abre solo lo que cada uno necesita. Las internas quedan cerradas.

revoke execute on all functions in schema public from public, anon, authenticated;

-- El código por defecto de un cliente se calcula con los permisos de quien
-- inserta: el admin lo necesita para cargar clientes a mano.
grant execute on function nuevo_codigo() to authenticated;

grant execute on function stock_publico(), portal(text), reportar_falla(text, uuid, text),
  crear_pedido_web(text, text, int, text)
  to anon, authenticated;

grant execute on function es_admin(), mi_cliente(), mi_saldo(), mis_unidades(),
  comprar_mayorista(jsonb), solicitar_recarga(numeric, text), asignar_a_cliente(uuid, text, text),
  renovar_con_saldo(uuid, int),
  entregar_pedido(text, uuid), registrar_venta(uuid, text, text, text, text, int, text),
  reponer(uuid, text), renovar(uuid, int), acreditar_recarga(uuid), liberar(uuid)
  to authenticated;

-- Los proyectos nuevos de Supabase no dan acceso a las tablas: se abre
-- acá y las filas las siguen cuidando las reglas de arriba.
grant usage on schema public to anon, authenticated;
grant select on planes to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ═══ catálogo inicial (el mismo de catalogo.js) ═══

insert into planes (servicio_id, clave, etiqueta, precio, precio_mayorista) values
  ('nx', 'pantalla',   'Pantalla',          6.00, 4.50),
  ('nx', 'completa',   'Cuenta completa',  20.00, null),
  ('dp', 'pantalla',   'Pantalla',          5.00, 3.75),
  ('dp', 'completa',   'Cuenta completa',  16.00, null),
  ('mx', 'pantalla',   'Pantalla',          5.00, 3.75),
  ('mx', 'completa',   'Cuenta completa',  12.00, null),
  ('pv', 'pantalla',   'Pantalla',          4.00, 3.00),
  ('sp', 'individual', 'Cuenta individual', 3.50, 2.60),
  ('cr', 'pantalla',   'Pantalla',          3.50, 2.60),
  ('pp', 'pantalla',   'Pantalla',          3.50, 2.60);

-- ═══ último paso, a mano ═══
-- Después de crear tu usuario en Authentication → Users, hacete admin:
--   insert into admins (usuario) select id from auth.users where email = 'TU_CORREO';
