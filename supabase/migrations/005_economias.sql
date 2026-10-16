-- TxoBank · 005 · Economías: una capa por encima de todo lo demás.
-- Ejecutar una sola vez en el SQL Editor de Supabase, después de 004_verificacion_en_dos_pasos.sql.
--
-- Cada economía (Personal, Casa…) tiene sus propias cuentas, categorías, movimientos, fijos, presupuestos,
-- grupos, otros saldos y ajustes. Hoy solo entra su propietario, pero queda preparada para compartirse:
-- economias_miembros dará acceso a otros usuarios sin tener que tocar el resto de tablas.
-- Los datos que ya existan pasan a una economía "Personal" de su usuario.

-- ---------------------------------------------------------------------------
-- economias y sus miembros (además del propietario)
-- ---------------------------------------------------------------------------
create table public.economias (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  color text not null,
  orden int not null default 0,
  creado timestamptz not null default now(),
  unique (propietario_id, nombre)
);

create table public.economias_miembros (
  economia_id uuid not null references public.economias on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  creado timestamptz not null default now(),
  primary key (economia_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Economías a las que tiene acceso el usuario de la sesión: las suyas y aquellas de las que es miembro.
-- security definer: las políticas la usan sin depender del RLS de estas dos tablas (y sin recursión).
-- ---------------------------------------------------------------------------
create or replace function privado.mis_economias()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.economias e where e.propietario_id = auth.uid()
  union
  select m.economia_id from public.economias_miembros m where m.user_id = auth.uid();
$$;

revoke all on function privado.mis_economias() from public;
grant execute on function privado.mis_economias() to authenticated;

-- ---------------------------------------------------------------------------
-- Datos existentes: una economía "Personal" para cada usuario que ya tenga algo.
-- ---------------------------------------------------------------------------
insert into public.economias (propietario_id, nombre, color)
select u.user_id, 'Personal', '#12B886'
from (
  select user_id from public.ajustes
  union select user_id from public.cuentas
  union select user_id from public.categorias
  union select user_id from public.presupuestos
  union select user_id from public.fijos
  union select user_id from public.movimientos
  union select user_id from public.grupos
  union select user_id from public.otros_saldos
) u;

-- ---------------------------------------------------------------------------
-- Cada tabla pasa a pertenecer a una economía. user_id se queda como autor de la fila.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'ajustes', 'cuentas', 'categorias', 'presupuestos', 'fijos', 'fijos_omitidos', 'fijos_fechas',
    'movimientos', 'grupos', 'otros_saldos', 'otros_saldos_historial'
  ] loop
    execute format('alter table public.%I add column economia_id uuid references public.economias on delete cascade', t);
    execute format(
      'update public.%I x set economia_id = e.id from public.economias e where e.propietario_id = x.user_id', t
    );
    execute format('alter table public.%I alter column economia_id set not null', t);
    execute format('create index %I on public.%I (economia_id)', t || '_economia_idx', t);
  end loop;
end $$;

create index movimientos_economia_fecha_idx on public.movimientos (economia_id, fecha);

-- Los ajustes son uno por economía.
alter table public.ajustes drop constraint ajustes_pkey;
alter table public.ajustes add primary key (economia_id);

-- Los nombres únicos pasan a serlo dentro de cada economía ("Comida" puede estar en Casa y en Personal).
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attname = 'user_id'
    where c.contype = 'u'
      and c.conrelid in ('public.categorias'::regclass, 'public.presupuestos'::regclass, 'public.grupos'::regclass)
      and a.attnum = any (c.conkey)
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
  end loop;
end $$;

alter table public.categorias add constraint categorias_economia_tipo_nombre_key unique (economia_id, tipo, nombre);
alter table public.presupuestos
  add constraint presupuestos_economia_mes_categoria_key unique nulls not distinct (economia_id, mes, categoria_id);
alter table public.grupos add constraint grupos_economia_nombre_key unique (economia_id, nombre);

-- ---------------------------------------------------------------------------
-- Traspasos entre economías: un gasto en la de origen y un ingreso en la de destino, enlazados por traspaso_id.
-- ---------------------------------------------------------------------------
alter table public.movimientos
  add column traspaso_id uuid,
  add constraint movimientos_traspaso_gasto_o_ingreso check (traspaso_id is null or tipo in ('gasto', 'ingreso'));

create index movimientos_traspaso_idx on public.movimientos (traspaso_id) where traspaso_id is not null;

-- Un fijo puede ser un traspaso a otra economía: un gasto con cuenta y categoría de ingreso en la de destino.
alter table public.fijos add column categoria_destino_id uuid references public.categorias on delete restrict;
alter table public.fijos drop constraint fijos_coherencia;
alter table public.fijos add constraint fijos_coherencia check (
  (tipo = 'traspaso' and cuenta_destino_id is not null and categoria_id is null and categoria_destino_id is null
    and cuenta_destino_id <> cuenta_id)
  or (tipo = 'gasto' and cuenta_destino_id is not null and categoria_id is not null and categoria_destino_id is not null
    and cuenta_destino_id <> cuenta_id)
  or (tipo <> 'traspaso' and cuenta_destino_id is null and categoria_id is not null and categoria_destino_id is null)
);

-- ---------------------------------------------------------------------------
-- saldos_cuentas: igual que antes, con la economía de cada cuenta (columna nueva al final).
-- ---------------------------------------------------------------------------
create or replace view public.saldos_cuentas
with (security_invoker = on) as
select
  c.id as cuenta_id,
  (
    c.saldo_inicial
    + coalesce((
      select sum(
        case
          when m.cuenta_destino_id = c.id then m.importe
          when m.tipo in ('ingreso', 'devolucion') then m.importe
          else -m.importe
        end
      )
      from public.movimientos m
      where (m.cuenta_id = c.id or m.cuenta_destino_id = c.id)
        and m.fecha <= (now() at time zone 'Europe/Madrid')::date
    ), 0)
  )::bigint as saldo,
  c.economia_id
from public.cuentas c;

-- ---------------------------------------------------------------------------
-- Seguridad de las tablas nuevas: RLS + políticas + GRANT explícito a authenticated.
-- ---------------------------------------------------------------------------
alter table public.economias enable row level security;
-- propietario_id = auth.uid() va también aquí para que el insert pueda devolver la fila recién creada.
create policy "ver_mis_economias" on public.economias
  for select to authenticated
  using (propietario_id = (select auth.uid()) or id in (select privado.mis_economias()));
create policy "crear_economia_propia" on public.economias
  for insert to authenticated
  with check (propietario_id = (select auth.uid()));
create policy "propietario_modifica" on public.economias
  for update to authenticated
  using (propietario_id = (select auth.uid()))
  with check (propietario_id = (select auth.uid()));
create policy "propietario_borra" on public.economias
  for delete to authenticated
  using (propietario_id = (select auth.uid()));
grant select, insert, update, delete on public.economias to authenticated;

alter table public.economias_miembros enable row level security;
create policy "ver_miembros" on public.economias_miembros
  for select to authenticated
  using (economia_id in (select privado.mis_economias()));
create policy "propietario_anade" on public.economias_miembros
  for insert to authenticated
  with check (exists (select 1 from public.economias e where e.id = economia_id and e.propietario_id = (select auth.uid())));
create policy "propietario_quita" on public.economias_miembros
  for delete to authenticated
  using (exists (select 1 from public.economias e where e.id = economia_id and e.propietario_id = (select auth.uid())));
grant select, insert, delete on public.economias_miembros to authenticated;

-- La verificación en dos pasos (004) también se exige en las tablas nuevas.
create policy "exige_verificacion" on public.economias as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.economias_miembros as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));

-- ---------------------------------------------------------------------------
-- Resto de tablas: de "solo el propietario" a "quien tenga acceso a la economía".
-- ---------------------------------------------------------------------------
drop policy "solo_propietario" on public.ajustes;
create policy "acceso_a_la_economia" on public.ajustes for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.cuentas;
create policy "acceso_a_la_economia" on public.cuentas for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.categorias;
create policy "acceso_a_la_economia" on public.categorias for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.presupuestos;
create policy "acceso_a_la_economia" on public.presupuestos for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.fijos;
create policy "acceso_a_la_economia" on public.fijos for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.fijos_omitidos;
create policy "acceso_a_la_economia" on public.fijos_omitidos for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.fijos_fechas;
create policy "acceso_a_la_economia" on public.fijos_fechas for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.movimientos;
create policy "acceso_a_la_economia" on public.movimientos for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.grupos;
create policy "acceso_a_la_economia" on public.grupos for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.otros_saldos;
create policy "acceso_a_la_economia" on public.otros_saldos for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

drop policy "solo_propietario" on public.otros_saldos_historial;
create policy "acceso_a_la_economia" on public.otros_saldos_historial for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));
