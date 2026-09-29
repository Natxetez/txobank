# TxoBank: instrucciones para Claude Code

- La especificación completa está en `SPEC.md`. Léela antes de empezar cualquier tarea y respeta sus decisiones (sección 17). Si algo no está claro o conviene cambiar una decisión, pregúntame antes de implementarlo, y si cambia algo, actualiza también `SPEC.md`.
- Trabaja por fases, en el orden de la sección 15 de `SPEC.md`. Al terminar cada fase, resume qué has hecho y cómo probarlo en el iPhone.
- La interfaz está en español (es-ES). Tablas y columnas se llaman como en `SPEC.md`; el código puede estar en inglés.
- La conexión a la base de datos se configura con variables de entorno al compilar (sección 3). En la app solo hay inicio de sesión con usuario y contraseña.
- Las pantallas nunca importan `@supabase/supabase-js`: todo el acceso a datos pasa por la interfaz `DataSource` (`src/data/types.ts`) y su adaptador en `src/data/supabase/`.
- Control del mes, fijos, presupuestos, estadísticas y recomendaciones son funciones puras en `src/lib/`, con tests de Vitest.
- El dinero siempre en céntimos (enteros). Nunca números decimales para importes.
- Cada cambio de base de datos va en un archivo nuevo `supabase/migrations/NNN_descripcion.sql`, siempre con RLS activado, política de propietario y GRANT explícito a `authenticated`. No tienes acceso a Supabase: dime qué archivo ejecutar en el SQL Editor.
- En la app solo se usa la clave publicable de Supabase, nunca la secreta.
- Diseño: móvil primero (iPhone). Sigue la sección 12 de `SPEC.md`.
- Comandos: `npm run dev`, `npm run build`, `npm test`.
