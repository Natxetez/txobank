-- TxoBank · 003 · Otros saldos (con su historial), grupos de gastos y hora de los movimientos.
-- Ejecutar una sola vez en el SQL Editor de Supabase, después de 002_descripcion_y_fechas_fijos.sql.

-- ---------------------------------------------------------------------------
-- otros_saldos: dinero fuera de las cuentas (banco virtual, inversiones, hucha…).
-- No admiten movimientos: solo se actualiza su saldo, y cada actualización queda en el historial.
-- ---------------------------------------------------------------------------
create table public.otros_saldos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  color text not null,
  icono text,
  orden int not null default 0,
  archivado boolean not null default false,
  creado timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- otros_saldos_historial: cada actualización de saldo, con su fecha y hora.
-- El saldo actual es el de la actualización más reciente. Puede ser negativo (una deuda).
-- ---------------------------------------------------------------------------
create table public.otros_saldos_historial (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  otro_saldo_id uuid not null references public.otros_saldos on delete cascade,
  saldo bigint not null,
  fecha_hora timestamptz not null default now()
);

create index otros_saldos_historial_idx on public.otros_saldos_historial (otro_saldo_id, fecha_hora);

-- ---------------------------------------------------------------------------
-- grupos: agrupan gastos repetidos ("Cafés y pintxos") con una categoría de gasto fija.
-- El grupo es permanente; su total se cuenta por meses (cada mes empieza de cero).
-- ---------------------------------------------------------------------------
create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  categoria_id uuid not null references public.categorias on delete restrict,
  orden int not null default 0,
  archivado boolean not null default false,
  creado timestamptz not null default now(),
  unique (user_id, nombre)
);

-- ---------------------------------------------------------------------------
-- movimientos: grupo al que pertenece (solo gastos) y hora del movimiento.
-- ---------------------------------------------------------------------------
alter table public.movimientos
  add column grupo_id uuid references public.grupos on delete set null,
  add column hora time,
  add constraint movimientos_grupo_solo_gastos check (grupo_id is null or tipo = 'gasto');

-- ---------------------------------------------------------------------------
-- Seguridad: RLS + política de propietario + GRANT explícito a authenticated.
-- ---------------------------------------------------------------------------
alter table public.otros_saldos enable row level security;
create policy "solo_propietario" on public.otros_saldos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.otros_saldos to authenticated;

alter table public.otros_saldos_historial enable row level security;
create policy "solo_propietario" on public.otros_saldos_historial
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.otros_saldos_historial to authenticated;

alter table public.grupos enable row level security;
create policy "solo_propietario" on public.grupos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.grupos to authenticated;
