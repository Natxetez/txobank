/// <reference types="vite/client" />

/** Versión de package.json, inyectada al compilar (vite.config.ts). */
declare const __APP_VERSION__: string
/** Commit corto del que se compiló, o "local". */
declare const __APP_COMMIT__: string
/** Fecha y hora ISO de la compilación. */
declare const __APP_FECHA_BUILD__: string
