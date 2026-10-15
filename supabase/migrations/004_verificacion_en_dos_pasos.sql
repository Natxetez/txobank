-- TxoBank · 004 · Verificación en dos pasos exigida en el servidor.
-- Ejecutar una sola vez en el SQL Editor de Supabase, después de 003_otros_saldos_y_grupos.sql.
--
-- Si el usuario tiene activada la verificación en dos pasos (un factor TOTP verificado), sus datos
-- solo se pueden leer o modificar desde una sesión que haya introducido el código (nivel aal2).
-- Si no la tiene activada, basta con la contraseña (aal1), así que esta migración se puede ejecutar
-- antes o después de activarla en la app.

-- ---------------------------------------------------------------------------
-- Función de comprobación, en un esquema que la API de datos no expone.
-- security definer: puede leer auth.mfa_factors sin dar permisos sobre esa tabla.
-- ---------------------------------------------------------------------------
create schema if not exists privado;

create or replace function privado.nivel_de_acceso_suficiente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = auth.uid()
        and f.status = 'verified'
    );
$$;

revoke all on function privado.nivel_de_acceso_suficiente() from public;
grant usage on schema privado to authenticated;
grant execute on function privado.nivel_de_acceso_suficiente() to authenticated;

-- ---------------------------------------------------------------------------
-- Política restrictiva en todas las tablas: se suma (AND) a la de propietario.
-- La vista saldos_cuentas (security_invoker) la hereda de movimientos y cuentas.
-- ---------------------------------------------------------------------------
create policy "exige_verificacion" on public.ajustes as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.cuentas as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.categorias as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.presupuestos as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.fijos as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.fijos_omitidos as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.fijos_fechas as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.movimientos as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.grupos as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.otros_saldos as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
create policy "exige_verificacion" on public.otros_saldos_historial as restrictive for all to authenticated
  using ((select privado.nivel_de_acceso_suficiente()));
