// Versión de la app, fijada al compilar (vite.config.ts). Se muestra en el inicio de sesión y en Acerca de.
export const VERSION = __APP_VERSION__
export const COMMIT = __APP_COMMIT__
export const FECHA_BUILD = __APP_FECHA_BUILD__

/** "v1.2.0 (a1b2c3d)" */
export const etiquetaVersion = () => `v${VERSION} (${COMMIT})`
