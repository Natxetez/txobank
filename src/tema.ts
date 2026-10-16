// Tema de la app (Ajustes → Apariencia): el del sistema, o claro u oscuro a mano. Se recuerda en el dispositivo.
export type Tema = 'sistema' | 'claro' | 'oscuro'

const CLAVE = 'txobank.tema'
/** Color de la barra del sistema en cada tema (igual que el fondo de la app). */
const COLOR_BARRA = { claro: '#F3F7F5', oscuro: '#0C1411' }

export function leerTema(): Tema {
  try {
    const t = localStorage.getItem(CLAVE)
    return t === 'claro' || t === 'oscuro' ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

/** Pone el tema en la página: `data-tema` en <html> (los estilos lo leen) y el color de la barra del sistema. */
export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement
  if (tema === 'sistema') delete raiz.dataset.tema
  else raiz.dataset.tema = tema
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const delSistema = meta.media.includes('dark') ? COLOR_BARRA.oscuro : COLOR_BARRA.claro
    meta.content = tema === 'sistema' ? delSistema : COLOR_BARRA[tema]
  })
}

export function guardarTema(tema: Tema) {
  try {
    if (tema === 'sistema') localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, tema)
  } catch {
    /* sin almacenamiento: el tema dura hasta cerrar la app */
  }
  aplicarTema(tema)
}
