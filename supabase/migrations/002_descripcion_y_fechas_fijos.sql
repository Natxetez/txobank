-- TxoBank · 002 · Descripción en movimientos y fijos, y fecha de cargo de un fijo en un mes concreto.
-- Ejecutar una sola vez en el SQL Editor de Supabase, después de 001_estructura.sql.

-- ---------------------------------------------------------------------------
-- Descripción: texto libre opcional, aparte del concepto (nota) y del nombre del fijo.
-- ---------------------------------------------------------------------------
alter table public.movimientos add column descripcion text not null default '';
alter table public.fijos add column descripcion text not null default '';

-- ---------------------------------------------------------------------------
-- fijos_fechas: fecha de cargo de un fijo en un mes concreto, cuando no es la del día habitual.
-- La fecha siempre cae dentro de ese mes.
-- ---------------------------------------------------------------------------
create table public.fijos_fechas (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  fijo_id uuid not null references public.fijos on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  fecha date not null,
  primary key (fijo_id, mes),
  constraint fijos_fechas_dentro_del_mes check (date_trunc('month', fecha)::date = mes)
);

alter table public.fijos_fechas enable row level security;
create policy "solo_propietario" on public.fijos_fechas
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.fijos_fechas to authenticated;
