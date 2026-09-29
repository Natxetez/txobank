-- TxoBank · 001 · Estructura completa: tablas, restricciones, vista de saldos, RLS y GRANT.
-- Ejecutar una sola vez en el SQL Editor de Supabase. Requiere Postgres 15 o superior
-- (usa "unique nulls not distinct"); los proyectos nuevos de Supabase ya lo cumplen.
-- Todos los importes van en céntimos (bigint). Los campos "mes" son siempre día 1.

-- ---------------------------------------------------------------------------
-- ajustes (una fila por usuario)
-- ---------------------------------------------------------------------------
create table public.ajustes (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  ahorro_tipo text check (ahorro_tipo in ('importe', 'porcentaje')),
  ahorro_valor bigint check (ahorro_valor > 0),
  actualizado timestamptz not null default now(),
  constraint ajustes_ahorro_coherente check ((ahorro_tipo is null) = (ahorro_valor is null))
);

-- ---------------------------------------------------------------------------
-- cuentas
-- ---------------------------------------------------------------------------
create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  tipo text not null check (tipo in ('corriente', 'ahorro', 'efectivo', 'tarjeta')),
  saldo_inicial bigint not null default 0,
  color text not null,
  orden int not null default 0,
  archivada boolean not null default false,
  creado timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categorias
-- ---------------------------------------------------------------------------
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  color text not null,
  icono text,
  orden int not null default 0,
  archivada boolean not null default false,
  creado timestamptz not null default now(),
  unique (user_id, tipo, nombre)
);

-- ---------------------------------------------------------------------------
-- presupuestos (por mes; categoria_id nulo = presupuesto total del mes)
-- ---------------------------------------------------------------------------
create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  categoria_id uuid references public.categorias on delete cascade,
  importe bigint check (importe > 0),
  creado timestamptz not null default now(),
  unique nulls not distinct (user_id, mes, categoria_id)
);

-- ---------------------------------------------------------------------------
-- fijos
-- ---------------------------------------------------------------------------
create table public.fijos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  tipo text not null check (tipo in ('gasto', 'ingreso', 'traspaso')),
  importe bigint not null check (importe > 0),
  cuenta_id uuid not null references public.cuentas on delete restrict,
  cuenta_destino_id uuid references public.cuentas on delete restrict,
  categoria_id uuid references public.categorias on delete restrict,
  dia_mes int not null check (dia_mes between 1 and 31),
  cada_meses int not null default 1 check (cada_meses between 1 and 12),
  desde date not null check (extract(day from desde) = 1),
  hasta date check (hasta is null or (extract(day from hasta) = 1 and hasta >= desde)),
  activo boolean not null default true,
  creado timestamptz not null default now(),
  constraint fijos_coherencia check (
    (tipo = 'traspaso' and cuenta_destino_id is not null and categoria_id is null and cuenta_destino_id <> cuenta_id)
    or (tipo <> 'traspaso' and cuenta_destino_id is null and categoria_id is not null)
  )
);

-- ---------------------------------------------------------------------------
-- fijos_omitidos (meses en que un fijo no toca)
-- ---------------------------------------------------------------------------
create table public.fijos_omitidos (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fijo_id uuid not null references public.fijos on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  primary key (fijo_id, mes)
);

-- ---------------------------------------------------------------------------
-- movimientos
-- ---------------------------------------------------------------------------
create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tipo text not null check (tipo in ('gasto', 'ingreso', 'traspaso', 'devolucion')),
  importe bigint not null check (importe > 0),
  fecha date not null,
  cuenta_id uuid not null references public.cuentas on delete restrict,
  cuenta_destino_id uuid references public.cuentas on delete restrict,
  categoria_id uuid references public.categorias on delete restrict,
  nota text not null default '',
  fijo_id uuid references public.fijos on delete set null,
  fijo_mes date check (fijo_mes is null or extract(day from fijo_mes) = 1),
  mes_imputado date check (mes_imputado is null or extract(day from mes_imputado) = 1),
  creado timestamptz not null default now(),
  -- Traspaso: con destino y sin categoría. Resto: con categoría y sin destino.
  constraint movimientos_coherencia check (
    (tipo = 'traspaso' and cuenta_destino_id is not null and categoria_id is null)
    or (tipo <> 'traspaso' and cuenta_destino_id is null and categoria_id is not null)
  ),
  constraint movimientos_cuentas_distintas check (cuenta_destino_id is null or cuenta_destino_id <> cuenta_id),
  constraint movimientos_mes_imputado_solo_ingresos check (mes_imputado is null or tipo = 'ingreso'),
  -- Si hay fijo, hay mes del fijo. La inversa no se exige: al borrar un fijo, "on delete set null"
  -- deja fijo_id a nulo y fijo_mes se queda, lo que un "los dos o ninguno" estricto rechazaría.
  constraint movimientos_fijo_con_mes check (fijo_id is null or fijo_mes is not null),
  -- Un fijo se paga como mucho una vez por mes (los NULL no chocan).
  unique (fijo_id, fijo_mes)
);

create index movimientos_user_fecha_idx on public.movimientos (user_id, fecha);

-- ---------------------------------------------------------------------------
-- saldos_cuentas: saldo inicial + movimientos con fecha hasta hoy (hora de Madrid).
-- security_invoker = on: la vista respeta el RLS de las tablas.
-- ---------------------------------------------------------------------------
create view public.saldos_cuentas
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
  )::bigint as saldo
from public.cuentas c;

-- ---------------------------------------------------------------------------
-- Seguridad: RLS + política de propietario + GRANT explícito a authenticated.
-- Nada para el rol anon.
-- ---------------------------------------------------------------------------
alter table public.ajustes enable row level security;
create policy "solo_propietario" on public.ajustes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.ajustes to authenticated;

alter table public.cuentas enable row level security;
create policy "solo_propietario" on public.cuentas
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.cuentas to authenticated;

alter table public.categorias enable row level security;
create policy "solo_propietario" on public.categorias
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.categorias to authenticated;

alter table public.presupuestos enable row level security;
create policy "solo_propietario" on public.presupuestos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.presupuestos to authenticated;

alter table public.fijos enable row level security;
create policy "solo_propietario" on public.fijos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.fijos to authenticated;

alter table public.fijos_omitidos enable row level security;
create policy "solo_propietario" on public.fijos_omitidos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.fijos_omitidos to authenticated;

alter table public.movimientos enable row level security;
create policy "solo_propietario" on public.movimientos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.movimientos to authenticated;

grant select on public.saldos_cuentas to authenticated;
