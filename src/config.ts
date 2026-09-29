// Configuración fijada al compilar (ver SPEC.md, sección 3).
export const config = {
  backend: import.meta.env.VITE_DATA_BACKEND as string | undefined,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
}
