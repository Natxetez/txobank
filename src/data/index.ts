import { config } from '../config'
import { crearMemoriaDataSource } from './memoria'
import { crearSupabaseDataSource } from './supabase'
import type { DataSource } from './types'

function crear(): DataSource {
  switch (config.backend ?? 'supabase') {
    case 'supabase':
      return crearSupabaseDataSource()
    case 'memoria':
      return crearMemoriaDataSource()
    default:
      throw new Error(`VITE_DATA_BACKEND desconocido: ${config.backend}`)
  }
}

export const dataSource: DataSource = crear()
