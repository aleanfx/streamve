-- StreamVe — permisos de las tablas (correr una vez, después de esquema.sql)
--
-- Los proyectos nuevos de Supabase no dan acceso a las tablas por defecto.
-- Esto lo abre, y quien ve qué fila lo siguen decidiendo las reglas de
-- esquema.sql (RLS): un usuario sin rol no ve nada.

grant usage on schema public to anon, authenticated;
grant select on public.planes to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Hacerte admin (cambiá el correo por el tuyo, después de crear tu usuario):
-- insert into admins (usuario) select id from auth.users where email = 'TU_CORREO';
