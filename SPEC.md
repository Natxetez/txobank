# TxoBank: especificación v1

**TxoBank** es una app web personal para controlar el gasto mensual: gastos, ingresos, cuentas, gastos fijos y presupuestos, con estadísticas y recomendaciones. Un solo usuario (yo), pensada para usarse a diario desde el iPhone como app instalada en la pantalla de inicio.

## 1. Principios

- **Control del mes**: la app responde siempre, de un vistazo, a dos preguntas: *¿cuánto me queda para gastar este mes?* y *¿voy bien?*
- **Sencilla**: apuntar un gasto normal en menos de 5 segundos. Una acción principal por pantalla.
- **Atractiva y pensada para el móvil**: se diseña primero para iPhone; en pantallas grandes es una columna centrada.
- **Portable**: hoy usa Supabase, pero la base de datos debe poder cambiarse sin tocar las pantallas (sección 4).
- **Alojada en GitHub Pages**: solo archivos estáticos, sin servidor propio.

## 2. Alcance

### Incluido en la v1

- Inicio de sesión con usuario y contraseña. La conexión a la base de datos queda fija en la configuración de la app.
- **Economías** ("Personal", "Casa"): con un solo usuario, varias economías separadas, cada una con sus cuentas, categorías, movimientos, fijos, presupuestos, grupos, otros saldos y ajustes. Traspasos entre economías y patrimonio total de todas (sección 5).
- Varias cuentas (corriente, ahorro, efectivo, tarjeta) con saldo inicial y saldo actual.
- Otros saldos fuera de las cuentas (banco virtual, inversiones…) que solo se actualizan a mano, para ver el patrimonio completo.
- Grupos de gastos ("Cafés y pintxos") para no llenar la lista de gastos sueltos repetidos.
- Movimientos: gasto, ingreso, traspaso entre cuentas y devolución (dinero que me devuelven, como un Bizum de amigos o la devolución de una compra).
- Categorías de gasto e ingreso editables, que también se pueden crear al vuelo mientras apunto un movimiento.
- Control del mes (sección 6): meses naturales, límite del mes, disponible total y por día, objetivo de ahorro, presupuestos que pueden ser distintos cada mes (total y por categoría), avisos al guardar y revisión mensual. Los ingresos pueden contar para el mes anterior o el siguiente al de su fecha.
- Gastos fijos separados de los variables (sección 7): cada mes, lista de fijos que marco como pagados el día que me los cobran, con periodicidad mensual, trimestral, anual, etc., y su coste anual a la vista.
- Entrada rápida: gastos frecuentes con un toque, autocompletado de conceptos y duplicar movimientos.
- Estadísticas con gráficos, calendario de gasto y separación entre gasto fijo y variable (sección 10).
- Recomendaciones automáticas basadas en mis datos (sección 11).
- Modo discreto para ocultar importes.
- Tema automático (el del sistema), claro u oscuro, a elegir en Ajustes.
- Exportación a CSV y copia de seguridad completa (descargar y restaurar).
- Instalable como PWA desde GitHub Pages.

### Para más adelante

- Etiquetas y eventos con presupuesto propio (un viaje, las Navidades).
- Metas de ahorro (huchas) con aportación mensual sugerida.
- Gastos compartidos con seguimiento de quién me debe qué.
- Importar movimientos desde el Excel o CSV del banco.
- Foto del ticket adjunta al movimiento.
- Bloqueo con código al abrir la app.
- Uso sin conexión.
- Notificaciones y recomendaciones con IA (ambas necesitan un servidor).
- Varias monedas.
- Compartir una economía con otro usuario (la base de datos ya está preparada: `economias_miembros`; falta la invitación en la app).

## 3. Stack

| Pieza | Elección | Motivo |
|---|---|---|
| Frontend | Vite + React + TypeScript | Muchas pantallas y lógica de dinero; TypeScript evita errores |
| Rutas | React Router con `HashRouter` | GitHub Pages no reescribe rutas; con hash no hay 404 al recargar |
| Datos en la UI | TanStack Query | Caché, estados de carga y refresco tras guardar |
| Gráficos | Recharts | Gráficos React responsivos y fáciles de adaptar al móvil |
| Estilos | CSS propio con variables (sin librería de UI) | Poco peso y control total del aspecto |
| Backend inicial | Supabase (plan gratuito): Postgres + Auth | Base de datos real con seguridad por filas (RLS) |
| PWA | `vite-plugin-pwa` | Manifest, iconos y service worker |
| Tests | Vitest | Lógica de dinero, fijos, control del mes, estadísticas y recomendaciones |
| Despliegue | GitHub Actions → GitHub Pages | Cada push a `main` publica la app |

Configuración:

- Nombre de la app: **TxoBank**, en el título de la página, en el manifest (`name` y `short_name`) y en la pantalla de inicio de sesión.
- Repositorio: `txobank`, así que `vite.config.ts` lleva `base: '/txobank/'` (necesario en GitHub Pages) y la app queda en `https://<usuario>.github.io/txobank/`.
- **La conexión es fija y se define al compilar**, con variables de entorno: `VITE_DATA_BACKEND` (de momento `supabase`), `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. En local van en `.env.local` (fuera de git); en GitHub, como *Repository variables* que usa el workflow. No hay pantalla de conexión en la app.
- Estos valores no son secretos: la clave publicable está pensada para ir en el navegador y la seguridad la dan las políticas RLS.
- Si la clave configurada empieza por `sb_secret_`, el build falla con un error claro: la clave secreta nunca debe ir en el navegador.
- Repositorio público (GitHub Pages gratis lo requiere).

## 4. Inicio de sesión y capa de datos

### Inicio de sesión

- Es lo único que se ve antes de entrar: usuario y contraseña. Supabase identifica a los usuarios por email, así que el usuario es mi email.
- La sesión se mantiene abierta; se cierra desde Ajustes.
- **Verificación en dos pasos** (opcional, desde Ajustes → Seguridad): además de la contraseña, un código de 6 dígitos de una app autenticadora (TOTP de Supabase Auth). Al activarla se puede añadir directamente a la app Contraseñas del iPhone (enlace `otpauth://`), escanear un QR o copiar la clave. Con ella activada, el inicio de sesión pide el código en un segundo paso, y el servidor lo exige: una política RLS restrictiva en todas las tablas solo deja acceder a sesiones de nivel `aal2` a quien tiene un factor verificado (migración 004).
- Errores claros en español (usuario o contraseña incorrectos, sin conexión, demasiados intentos).

### Capa de datos intercambiable

- Las pantallas **nunca** importan `@supabase/supabase-js`. Todo pasa por una interfaz `DataSource` definida en `src/data/types.ts`.
- Los tipos del dominio (`Economia`, `Cuenta`, `Categoria`, `Presupuesto`, `Movimiento`, `TraspasoEconomias`, `Fijo`, `Ajustes`, `Saldo`, `Grupo`, `OtroSaldo`, `ActualizacionSaldo`) son TypeScript puro, sin depender de Supabase. Cada adaptador traduce entre sus filas y estos tipos.
- Implementación inicial en `src/data/supabase/`. El adaptador se elige al compilar con `VITE_DATA_BACKEND`: usar otra base de datos en el futuro = escribir otro adaptador que cumpla la misma interfaz y cambiar la variable.
- La interfaz cubre: sesión (iniciar y cerrar, sesión actual, cambios de sesión), economías (listar, crear, editar, borrar, elegir la activa y datos de todas para los traspasos y el patrimonio total), ajustes, cuentas, categorías, presupuestos, movimientos (listar por rango de fechas con filtros, crear, editar, borrar, y crear, editar y borrar traspasos entre economías), fijos (incluidos sus pagos, omisiones y fechas cambiadas para un mes), saldos, grupos de gastos, otros saldos con su historial y la copia de seguridad (exportar todo y restaurar).
- **Economía activa**: el resto de la interfaz trabaja siempre sobre la economía elegida con `economias.activar(id)`; el adaptador filtra cada consulta por ella y crea en ella lo nuevo. Al cambiar de economía la app descarta la caché y vuelve a montar las pantallas.
- Control del mes, fijos, estadísticas y recomendaciones se calculan en `src/lib/` como funciones puras sobre los datos, sin depender de la base de datos.
- Supabase devuelve por defecto como máximo 1000 filas por consulta: el adaptador debe paginar al listar movimientos y pagos de fijos.
- Además del adaptador de Supabase hay uno en memoria con datos de ejemplo (`VITE_DATA_BACKEND=memoria`, `npm run dev:memoria`; con `?vacio` en la dirección arranca sin datos). Sirve para probar la interfaz sin base de datos; los datos se pierden al recargar.

## 5. Modelo de datos (Supabase / Postgres)

Todos los importes se guardan en **céntimos** como enteros (`bigint`). Nunca decimales en coma flotante. Los campos de tipo "mes" son un `date` que siempre cae en día 1.

Todas las tablas de datos llevan `economia_id uuid not null references economias on delete cascade` (la economía a la que pertenecen) y `user_id uuid not null default auth.uid() references auth.users on delete cascade` (quién creó la fila).

### economias

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| propietario_id | uuid | FK auth.users; default `auth.uid()` |
| nombre | text | obligatorio; único por propietario |
| color | text | hex de la paleta |
| orden | int | |
| creado | timestamptz | |

- Todo lo demás (cuentas, categorías, movimientos, fijos, presupuestos, grupos, otros saldos y ajustes) pertenece a una economía. Las categorías y los nombres de grupo son únicos dentro de cada economía.
- La app recuerda en el dispositivo la última economía usada y entra en ella; se cambia desde Inicio (selector arriba) o desde Ajustes → Economías.
- Al borrar una economía se borran todos sus datos. Los traspasos con otras economías se quedan en la otra parte como gastos o ingresos normales, y los fijos de otras economías que le traspasaban dinero pasan a ser gastos normales.

### economias_miembros

| Columna | Tipo | Notas |
|---|---|---|
| economia_id | uuid | FK economias (`on delete cascade`) |
| user_id | uuid | FK auth.users |

PK `(economia_id, user_id)`. Usuarios con acceso a una economía además de su propietario. Hoy no se usa desde la app: queda preparada para compartir una economía (por ejemplo, la de casa con mi pareja).

### Traspasos entre economías

- Un traspaso a una cuenta de otra economía se guarda como **dos movimientos enlazados** por `traspaso_id`: un **gasto** en la economía de origen y un **ingreso** en la de destino, cada uno con su categoría (por ejemplo, gasto "Casa" en Personal e ingreso "Aportaciones" en Casa). Así cuenta en el "Te quedan" de las dos y el patrimonio total no cambia.
- Las dos mitades se crean en un solo insert (las dos o ninguna), se editan juntas y se borran juntas, desde cualquiera de las dos economías.
- Un fijo puede ser un traspaso a otra economía (la aportación mensual): se guarda como **gasto** con `cuenta_destino_id` (de la otra economía) y `categoria_destino_id` (de ingreso, en la otra). Para el control del mes es un gasto fijo normal; al marcarlo como pagado se crean las dos mitades. En la economía de destino no aparece como fijo: el ingreso se ve cuando se paga.

### ajustes (una fila por economía)

| Columna | Tipo | Notas |
|---|---|---|
| economia_id | uuid | PK |
| ahorro_tipo | text null | `importe` o `porcentaje` |
| ahorro_valor | bigint null | céntimos si es importe; puntos porcentuales si es porcentaje |
| actualizado | timestamptz | |

### cuentas

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK, `gen_random_uuid()` |
| nombre | text | obligatorio |
| tipo | text | `corriente`, `ahorro`, `efectivo`, `tarjeta` |
| saldo_inicial | bigint | default 0, puede ser negativo |
| color | text | hex de la paleta de la app |
| orden | int | |
| archivada | boolean | default false |
| creado | timestamptz | default now() |

### categorias

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | text | único por economía y tipo |
| tipo | text | `gasto` o `ingreso` |
| color | text | hex |
| icono | text | un emoji, opcional |
| orden | int | |
| archivada | boolean | default false |
| creado | timestamptz | |

### presupuestos

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| mes | date | mes desde el que se aplica |
| categoria_id | uuid null | FK categorias (de gasto); null = presupuesto total del mes |
| importe | bigint null | céntimos, mayor que 0; null = sin presupuesto desde ese mes |
| creado | timestamptz | |

- `unique nulls not distinct (economia_id, mes, categoria_id)`, para que el presupuesto total (categoría nula) tampoco se duplique y se pueda hacer `upsert` por esas columnas.
- Cómo se usa: sección 6.

### movimientos

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| tipo | text | `gasto`, `ingreso`, `traspaso` o `devolucion` |
| importe | bigint | céntimos, siempre mayor que 0 |
| fecha | date | |
| cuenta_id | uuid | FK cuentas (`on delete restrict`); en traspasos es la de origen |
| cuenta_destino_id | uuid null | solo en traspasos, distinta de `cuenta_id` |
| categoria_id | uuid null | gasto: categoría de gasto; ingreso: de ingreso; devolución: **de gasto**; traspaso: nula |
| nota | text | concepto corto ("Mercadona"); default ''. Se autocompleta y sirve para los frecuentes |
| descripcion | text | texto libre opcional, aparte del concepto; default '' |
| fijo_id | uuid null | FK fijos (`on delete set null`) si es el pago de un fijo |
| fijo_mes | date null | mes al que corresponde ese pago del fijo |
| mes_imputado | date null | solo en ingresos: mes al que cuenta, si no es el de su fecha (sección 6) |
| grupo_id | uuid null | FK grupos (`on delete set null`); solo en gastos |
| hora | time null | hora del movimiento; la app la rellena con la hora actual al crearlo |
| traspaso_id | uuid null | enlaza las dos mitades de un traspaso entre economías (solo gasto o ingreso) |
| creado | timestamptz | |

Restricciones:

- CHECK de coherencia: un traspaso tiene destino y no tiene categoría; gasto, ingreso y devolución tienen categoría y no tienen destino.
- CHECK: `mes_imputado` solo en ingresos.
- CHECK: `grupo_id` solo en gastos. Que la categoría del gasto sea la del grupo se asegura en la app.
- CHECK: si hay `fijo_id`, hay `fijo_mes`. No se exige la inversa: al borrar un fijo, `on delete set null` deja `fijo_id` a nulo y `fijo_mes` se queda, y un "los dos o ninguno" estricto haría fallar ese borrado.
- `unique (fijo_id, fijo_mes)`: un fijo se paga como mucho una vez por mes. Los NULL no chocan, así que no afecta a los movimientos normales.
- Que el tipo de la categoría encaje con el del movimiento se valida en la app.
- CHECK: `traspaso_id` solo en gastos e ingresos.
- Índices en `(economia_id, fecha)` y en `traspaso_id`.

### fijos

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | text | "Alquiler", "Luz", "Nómina"... |
| descripcion | text | texto libre opcional (compañía, contrato…); pasa al movimiento al pagarlo; default '' |
| tipo | text | `gasto`, `ingreso` o `traspaso` |
| importe | bigint | importe previsto, en céntimos |
| cuenta_id, cuenta_destino_id, categoria_id | | igual que en movimientos, salvo en los traspasos a otra economía |
| categoria_destino_id | uuid null | solo en traspasos a otra economía: categoría de ingreso en la de destino |
| dia_mes | int | 1 a 31: día habitual del cargo |
| cada_meses | int | 1 mensual, 2 bimestral, 3 trimestral, 6 semestral, 12 anual; default 1 |
| desde | date | primer mes en que toca; en los no mensuales marca también en qué meses tocan |
| hasta | date null | último mes, opcional. Si `hasta = desde`, es un cargo puntual ("Una vez") |
| activo | boolean | default true (false = pausado) |
| creado | timestamptz | |

### fijos_omitidos

| Columna | Tipo | Notas |
|---|---|---|
| fijo_id | uuid | FK fijos (`on delete cascade`) |
| mes | date | mes en que ese fijo no toca |

PK `(fijo_id, mes)`.

### fijos_fechas

| Columna | Tipo | Notas |
|---|---|---|
| fijo_id | uuid | FK fijos (`on delete cascade`) |
| mes | date | mes en que el cargo no cae en el día habitual |
| fecha | date | fecha del cargo ese mes; CHECK: dentro de `mes` |

PK `(fijo_id, mes)`.

### grupos

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | text | nombre libre ("Cafés y pintxos"); único por economía |
| categoria_id | uuid | FK categorias (de gasto, `on delete restrict`): categoría de todas sus entradas |
| orden | int | |
| archivado | boolean | default false |
| creado | timestamptz | |

### otros_saldos

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| nombre | text | "Revolut", "Fondo indexado"… |
| color | text | hex de la paleta |
| icono | text null | un emoji, opcional |
| orden | int | |
| archivado | boolean | default false |
| creado | timestamptz | |

### otros_saldos_historial

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| otro_saldo_id | uuid | FK otros_saldos (`on delete cascade`) |
| saldo | bigint | céntimos; puede ser negativo |
| fecha_hora | timestamptz | cuándo se actualizó; default now() |

El saldo actual de cada uno es el de su actualización más reciente.

### saldos_cuentas (vista)

Vista con `security_invoker = on` (para que respete RLS) que devuelve `cuenta_id`, `saldo` y `economia_id`: saldo inicial + ingresos + devoluciones − gastos − traspasos salientes + traspasos entrantes, contando solo movimientos con `fecha <= current_date`.

### Seguridad (obligatorio en todas las tablas)

```sql
alter table public.cuentas enable row level security;

create policy "acceso_a_la_economia" on public.cuentas
  for all to authenticated
  using (economia_id in (select privado.mis_economias()))
  with check (economia_id in (select privado.mis_economias()));

grant select, insert, update, delete on public.cuentas to authenticated;
```

- `privado.mis_economias()` (security definer, en un esquema que la API no expone) devuelve las economías de las que el usuario es propietario o miembro.
- `economias`: cada uno ve las suyas y aquellas de las que es miembro; solo el propietario las crea, cambia y borra. `economias_miembros`: las ven los miembros; solo el propietario añade o quita.
- Mismo patrón para `ajustes`, `categorias`, `presupuestos`, `movimientos`, `fijos`, `fijos_omitidos`, `fijos_fechas`, `grupos`, `otros_saldos` y `otros_saldos_historial`; en la vista, `grant select ... to authenticated`.
- **El GRANT explícito es imprescindible**: desde el 30 de mayo de 2026, los proyectos nuevos de Supabase no exponen las tablas de `public` a la API de datos por defecto. Sin GRANT, supabase-js devuelve error de permisos aunque RLS esté bien.
- Nada para el rol `anon`. Registro de usuarios desactivado; el único usuario se crea a mano.

El SQL vive en el repo en `supabase/migrations/NNN_descripcion.sql` y se ejecuta a mano en el SQL Editor de Supabase.

## 6. Control del mes

Es el corazón de la app. Toda la lógica va en `src/lib/` como funciones puras con tests.

**Meses naturales.** Todo el control va por meses naturales, del día 1 al último, aunque la nómina llegue antes o después. Gastos, devoluciones y traspasos cuentan siempre en el mes de su fecha. Los límites de mes y la asignación de ingresos a meses van en `src/lib/meses/`; el resto de la app no calcula fechas de mes por su cuenta.

**Ingresos que llegan antes o después.** Un ingreso puede contar para el mes anterior o el siguiente al de su fecha (`mes_imputado`). Ejemplo: la nómina de octubre llega el 29 de septiembre; se apunta con esa fecha (el saldo de la cuenta sube ese día), pero cuenta como ingreso de octubre en el control del mes y en las estadísticas. Sin esto, un mes parecería tener dos nóminas y el siguiente ninguna.
- Al marcar como cobrado un ingreso fijo, cuenta automáticamente para el mes de ese fijo (sección 7).
- En un ingreso normal, el formulario muestra "Cuenta para: septiembre" (el mes de la fecha) y se puede cambiar al mes anterior o al siguiente.

**Gasto neto, fijo y variable.** Gasto neto = gastos − devoluciones del mes, total y por categoría. Se divide en **fijo** (pagos de fijos) y **variable** (el resto), que se muestran por separado en Inicio y en estadísticas. Las devoluciones no cuentan como ingresos.

**Presupuestos por mes.**
- Cada mes puede tener su propio presupuesto total y su propio presupuesto por categoría.
- El presupuesto vigente de un mes es el último definido en ese mes o antes. Así, un mes nuevo hereda los del anterior sin copiar nada.
- Al cambiar un presupuesto se elige:
  - **Solo este mes**: se guarda el nuevo importe en ese mes y, si el mes siguiente no tenía uno propio, se guarda en él el importe anterior, para que no herede el cambio (útil para diciembre).
  - **Este mes y los siguientes**: se guarda en ese mes y se borran los definidos para meses posteriores.
- Si la suma de las categorías supera el total del mes, se avisa en la pantalla de presupuestos ("Tus categorías suman 1.350 € y tu presupuesto total es 1.200 €").

**Límite del mes.**
- Si hay presupuesto total vigente → límite = presupuesto total (incluye los gastos fijos).
- Si no, **no hay límite**: no se deduce de los ingresos. Inicio muestra en su lugar **ingresos frente a gastos** (abajo), la media de gasto de los 3 meses anteriores y un enlace para poner presupuesto.
- Ingresos previstos = ingresos que cuentan para el mes + fijos de ingreso del mes aún pendientes. Se usan para el objetivo de ahorro en porcentaje y en ingresos frente a gastos.

**Ingresos frente a gastos.** Dos barras horizontales en la misma escala: **Ingresos** (cobrados en sólido y fijos de ingreso por cobrar rayados) y **Gastos** (fijos, variables netos de devoluciones y fijos de gasto por pagar rayados), con su importe. Arriba, lo que se ahorra en lo que va de mes ("Ahorras 450 €" o "Gastas 120 € más"); debajo, el ahorro previsto contando lo que falta de los fijos y el objetivo de ahorro, si lo hay. Sin presupuesto ocupa el sitio de la cifra protagonista; con presupuesto va justo debajo de ella. Colores propios validados para daltonismo en claro y en oscuro (ingresos menta, gasto fijo azul, variable ámbar).

**Disponible.** Los fijos pendientes no cuentan en lo gastado hasta que se cobran, pero no se pierden de vista:
- Disponible = límite − gasto neto del mes. Es la cifra grande de Inicio ("Te quedan 800 €").
- Disponible tras los pendientes = disponible − fijos de gasto del mes aún pendientes (con su importe previsto). Se muestra debajo ("Tras los cargos pendientes: 480 €") cuando hay pendientes.
- Disponible por día = disponible tras los pendientes / días que quedan del mes, incluido hoy.
- Ritmo previsto = (límite − fijos de gasto del mes) / días del mes.
- Estado (se calcula con la cifra prudente, la de tras los pendientes): **bien** si el disponible por día es igual o mayor que el ritmo previsto; **ajustado** si es menor pero positivo; **pasado** si el disponible tras los pendientes es negativo ("Con los cargos pendientes te pasarás 45 €"; si ya es negativo sin ellos, "Te has pasado 45 €").

**Objetivo de ahorro.** Importe fijo al mes o porcentaje de los ingresos. Se compara con el ahorro en ingresos frente a gastos, en estadísticas y en la revisión mensual. No cambia el límite.

**Aviso al guardar.** El aviso que aparece tras guardar un gasto incluye el estado de su categoría si tiene presupuesto ("Comida: 172 € de 200 €") y lo destaca si con ese gasto se supera el 80 % o el 100 % de la categoría o del límite del mes. Mantiene el botón Deshacer.

**Revisión mensual.** Al abrir la app en un mes nuevo, aparece en Inicio la tarjeta "Tu resumen de septiembre". Abre una pantalla con: gasto neto frente al límite (fijo y variable), ahorro frente al objetivo, categorías que se pasaron del presupuesto, fijos que quedaron sin marcar, los 3 mayores gastos, comparación con la media de 3 meses y días sin gasto. Acciones: ajustar los presupuestos del mes nuevo (con valores sugeridos a partir de la media de 3 meses, redondeados a 10 €) y revisar fijos. Se marca como vista en el dispositivo y las revisiones pasadas quedan accesibles desde Estadísticas.

## 7. Gastos fijos

- Los fijos (alquiler, luz, seguros, suscripciones, nómina...) son una lista aparte de los gastos variables.
- **Nada se genera solo**: un fijo solo produce un movimiento cuando lo marco como pagado.
- Cada mes, la app muestra los fijos que tocan ese mes (según `cada_meses`, `desde`, `hasta` y si están activos), cada uno con su estado:
  - **Pendiente**, con el día del cargo. Si ese día ya pasó: "Pendiente, se esperaba el día 5".
  - **Pagado** (**Cobrado** en ingresos, **Hecho** en traspasos), con la fecha y el importe reales.
  - **Omitido**: ese mes no toca (se guarda en `fijos_omitidos`).
- **Marcar como pagado**: botón en cada fijo pendiente. Abre una hoja pequeña con el importe previsto (editable, porque la luz o el agua cambian), la fecha de hoy (editable) y la cuenta. Al guardar se crea el movimiento con `fijo_id` y `fijo_mes`. Aviso con Deshacer.
- El movimiento creado es un gasto (o ingreso, o traspaso) normal a todos los efectos: saldo, listas y estadísticas. Se distingue con una etiqueta "Fijo".
- Mientras un fijo de gasto está pendiente, no cuenta como gastado, pero aparece en "Tras los cargos pendientes" y en el estado del mes con su importe previsto (sección 6).
- **Fecha del cargo**: cada fijo tiene su día habitual. Si un mes se cobra otro día (la luz llega el 8 en vez del 5), se cambia desde la lista de fijos de ese mes (**Cambiar fecha**) y se guarda en `fijos_fechas`; los demás meses siguen con el día habitual.
- **Cargos puntuales**: periodicidad **Una vez**, con una fecha concreta (IBI, ITV). Se guardan con `desde = hasta` y se comportan como cualquier fijo ese mes. No suman en el coste mensual ni anual de los fijos; en Ajustes → Fijos van en su propia lista.
- **Próximos cargos**: Inicio recuerda los fijos pendientes cuya fecha cae en los próximos 10 días (también los del mes siguiente) y los que ya deberían haberse cobrado, cada uno con su botón **Pagado** (o **Adelantar**, si son del mes siguiente). Es solo un recordatorio dentro de la app (sin notificaciones).
- **Pagos adelantados o tardíos**: el pago se asigna al mes del pendiente desde el que lo marco (por ejemplo, la luz de noviembre cobrada el 27 de octubre queda como pagada en noviembre). En gastos, eso solo afecta a la lista de fijos; el gasto cuenta en el mes de su fecha. En ingresos, además, rellena `mes_imputado`.
- **Adelantar**: en los fijos de un mes que aún no ha llegado (en su lista o en Próximos cargos), el botón de los gastos y traspasos dice **Adelantar**. La hoja explica en qué mes cuenta el gasto y el botón dice "Adelantar a octubre". En la lista de fijos del mes en que se pagó, esos pagos salen aparte con la etiqueta **Adelantado** ("De noviembre, pagado el 27/10"), y los pagados tarde con **Tarde**; no suman en el resumen "4 de 7 pagados" de ese mes.
- **Crear y editar un fijo**: desde Ajustes → Fijos, desde la lista de fijos del mes en Inicio o en Fijos del mes (**Añadir fijo**; tocar un fijo sin pagar lo abre para editarlo), desde el asistente de primera vez, o desde el formulario de nuevo movimiento con el interruptor **Es fijo**, que crea el fijo con esos datos (mensual por defecto, día del cargo = día de la fecha) y deja este mes como pagado.
- Editar un fijo no cambia los pagos pasados. Eliminarlo no borra los movimientos ya pagados (se quedan sin fijo). Pausarlo lo saca de los meses siguientes.
- **Traspasos a otra economía** (la aportación mensual a la cuenta común): en el formulario es un traspaso cuya cuenta de destino es de otra economía, con la categoría del gasto aquí y la del ingreso allí. Cuenta como fijo de gasto; al marcarlo como pagado se apuntan las dos mitades (sección 5).
- Coste mensual equivalente = importe / `cada_meses`; coste anual = importe × 12 / `cada_meses`.

## 8. Pantallas

Barra inferior: **Inicio**, **Movimientos**, botón central **+**, **Estadísticas**, **Ajustes**.

**Inicio de sesión.** Ver sección 4. Abajo, discreta, la versión de la app ("v1.2.0 (a1b2c3d)").

**Primera economía.** Antes del asistente, si no hay ninguna economía, se pide el nombre de la primera ("Personal" por defecto), explicando qué es una economía.

**Primera vez.** Asistente corto, en cada economía nueva; todos los pasos, salvo el primero, se pueden saltar. En una economía que no es la primera, el asistente lleva su nombre y un botón para volver a otra economía sin terminarlo:
1. Crear la primera cuenta (nombre, tipo, saldo inicial).
2. Mi mes: presupuesto total del mes u objetivo de ahorro.
3. Mis fijos: añadir los principales (alquiler, luz, nómina...).
4. Se crean las categorías por defecto (en la implementación, nada más crear la cuenta, porque los fijos del paso 3 ya las necesitan):
   - Gasto: Comida 🛒, Casa 🏠, Transporte 🚌, Ocio 🎉, Salud 💊, Compras 🛍️, Suscripciones 🔁, Otros 📦.
   - Ingreso: Nómina 💼, Otros ingresos ➕.

**Inicio.**
- Arriba, la **economía activa** (punto de color y nombre). Al tocarla, una hoja para cambiar a otra, crear una nueva o ir a Ajustes → Economías.
- Selector de mes (‹ septiembre ›).
- Cifra protagonista (solo con presupuesto total): **disponible** ("Te quedan 412 €") con el disponible por día debajo ("27 € al día durante 15 días") y el color del estado. Debajo, una barra de gasto neto frente al límite, con la parte fija y la variable diferenciadas.
- **Ingresos frente a gastos** (sección 6): debajo de la cifra protagonista o, sin presupuesto, en su lugar.
- Icono de ojo para el **modo discreto**: sustituye todos los importes de la app por "•••" hasta que se vuelve a tocar (recordado en el dispositivo).
- Cifra protagonista sobre una tarjeta con el color del estado (menta, ámbar o rojo), con "Tras los cargos pendientes" debajo cuando los hay (sección 6).
- **Próximos cargos** (en el mes actual): tarjetas deslizables con los fijos de los próximos 10 días y los que se esperaban ya (sección 7).
- Tarjeta de revisión mensual, cuando toque.
- **Fijos del mes**: resumen ("4 de 7 pagados: 620 € de 740 €") y lista con los pendientes primero; los que ya deberían haberse cobrado, destacados. Cada pendiente tiene sus botones **Pagado**, **Cambiar fecha** y **Omitir**; al final, **Añadir fijo**.
- Presupuestos del mes por categoría: una barra por categoría. Normal hasta el 80 %, aviso del 80 al 100 %, superado a partir del 100 %. Tocar abre la pantalla de Presupuestos.
- La recomendación más importante del momento (enlace a todas).
- **Patrimonio** = saldo de las cuentas + otros saldos activos. Al tocarlo se despliegan el subtotal y la lista de cuentas (tocar una abre sus movimientos) y el subtotal y la lista de otros saldos, con cuándo se actualizó cada uno. Con varias economías, al final, **Todas tus economías**: el patrimonio de cada una y la suma.
- Últimos 5 movimientos.

**Nuevo movimiento** (hoja que sube desde abajo; es la pantalla más importante de la app):
1. Tipo: Gasto / Ingreso / Traspaso (control segmentado; Gasto por defecto). En Ingreso, un interruptor **Es una devolución** cambia las categorías por las de gasto y lo guarda como devolución.
2 bis. **Grupos** (solo en Gasto): fila de chips con los grupos activos y "+ Grupo" para crear uno al vuelo. Al elegir uno, la categoría y el concepto son los del grupo ("🛒 Comida · del grupo"), aparece **Hora** junto a la fecha (por defecto la actual), se mantiene la descripción, se ocultan "Es fijo" y los frecuentes, y el botón dice "Guardar en Cafés y pintxos". Tocar otra vez el chip lo deja como gasto suelto. Al editar se puede cambiar de grupo o sacarlo; Duplicar conserva el grupo.
2. **Frecuentes**: fila de hasta 6 chips con mis gastos repetidos (mismo concepto y categoría al menos 3 veces en 90 días), con su importe habitual ("☕ Café 1,50 €"). Un toque rellena todo; solo queda guardar.
3. Importe grande con el teclado numérico abierto nada más entrar; acepta coma y punto.
4. Categorías como chips con emoji, las más usadas en los últimos 90 días primero. El último chip es **+ Nueva**: abre un mini formulario en la misma hoja (nombre, emoji opcional; el color se asigna solo) y, al guardarla, queda creada y seleccionada sin salir del formulario.
5. Una línea compacta con fecha (Hoy), cuenta (la última usada) y concepto, más el mes para el que cuenta en los ingresos; cada elemento se toca para cambiarlo. El concepto se autocompleta con los anteriores y, al elegir uno, propone su categoría. En traspasos, cuenta de origen y de destino en lugar de categoría. Con varias economías, las cuentas salen agrupadas por economía: si el destino (o el origen) es de otra, es un **traspaso entre economías** y se piden la categoría de gasto en la de origen y la de ingreso en la de destino. Una de las dos cuentas tiene que ser de la economía activa.
6. **Descripción** (opcional): texto libre aparte del concepto ("cumple de Javi con los del curro"). Se ve en las listas debajo del concepto y se busca junto a él.
7. Interruptor **Es fijo** (sección 7).
8. Botón **Guardar gasto** / **Guardar ingreso** / **Guardar devolución** / **Guardar traspaso**. Al guardar, la hoja se cierra y aparece el aviso descrito en la sección 6.
- Editar abre la misma hoja con los datos y los botones **Duplicar** (copia con fecha de hoy) y **Eliminar** (con confirmación). Un traspaso entre economías se edita y se elimina entero (las dos mitades) desde cualquiera de las dos, y no se duplica.

**Movimientos.** Lista del mes agrupada por día, con total diario. Los pagos de fijos llevan la etiqueta "Fijo"; las mitades de un traspaso entre economías, "Traspaso entre economías". Arriba, la sección **Grupos**: una fila plegada por grupo con entradas ese mes (nombre, nº de entradas, total) que al tocarla despliega sus entradas ("mar 14 · 09:35", descripción, importe). Las entradas de grupos no salen en la lista diaria ni en su total. Los filtros se aplican también a ellas. Filtros por cuenta, categoría, tipo y fijo/variable, y búsqueda en conceptos y descripciones. Deslizar a la izquierda para eliminar; tocar para editar.

**Presupuestos.** Selector de mes. Presupuesto total y una fila por categoría de gasto. Si el importe viene heredado se indica ("igual que en septiembre"). Al cambiar un importe, se pregunta **Solo este mes** o **Este mes y los siguientes** (sección 6). Botón **Sugerir a partir de mi media**, que propone importes con la media de 3 meses redondeada a 10 €. Se llega desde Inicio y desde Ajustes.

**Estadísticas.** Ver sección 10. Incluye el acceso a todas las recomendaciones y a las revisiones mensuales pasadas.

**Ajustes.**
- Arriba, **Economías**: en cuál estoy y cuántas tengo. Lista con **Entrar** en otra, crear (y entrar en ella con su asistente), cambiar nombre y color, y borrar (escribiendo su nombre; no se puede borrar la única). El resto de Ajustes son de la economía activa ("Ajustes de Casa").
- Presupuestos (pantalla anterior).
- Objetivo de ahorro.
- Fijos: lista ordenada por coste, con descripción, periodicidad, día del cargo y próximo mes en que tocan; arriba, el total de fijos al mes y al año ("Fijos: 740 € al mes, 8.880 € al año"). Debajo, los cargos puntuales. Crear, editar, pausar y eliminar.
- Cuentas: crear, editar, archivar, saldo inicial. Al archivar una cuenta con saldo, un aviso pide dejarla a 0: con un traspaso a (o desde) otra cuenta, o sin movimiento (ajustando su saldo inicial, por si el dinero se sacó en efectivo o fue a otro sitio; el patrimonio de meses anteriores también se ajusta).
- **Grupos de gastos**: lista con su categoría y el total y nº de entradas del mes actual. Crear, editar, archivar (deja de salir al apuntar; sus entradas siguen contando) y eliminar (las entradas quedan como gastos sueltos). Cambiar el nombre o la categoría de un grupo actualiza también sus entradas.
- **Otros saldos**: total arriba y lista con su saldo y la fecha y hora de la última actualización. Crear (con saldo inicial, que queda como primera actualización), editar, archivar (con aviso: su saldo pasa a 0 € y queda apuntado en el historial) y eliminar (borra también su historial). Al tocar uno: actualizar su saldo (con fecha y hora editables, por defecto ahora; admite negativos) y ver el historial con la diferencia frente a la actualización anterior, pudiendo borrar una.
- Categorías: pestañas Gasto / Ingreso. Crear, renombrar, emoji, color, reordenar y archivar. Una categoría con movimientos no se borra, se archiva.
- Exportar CSV.
- **Copia de seguridad** (sección 14), junto a Economías porque abarca todas: descargar y restaurar, con la fecha de la última copia descargada en el dispositivo.
- **Apariencia**: Automático (el del sistema), Claro u Oscuro. Se recuerda en el dispositivo.
- Seguridad: activar o desactivar la verificación en dos pasos (sección 4).
- Acerca de: versión, commit, fecha de compilación, base de datos en uso y usuario.
- Cerrar sesión.

## 9. Reglas de negocio

- Los traspasos no cuentan como ingreso ni gasto; solo mueven saldo entre cuentas. Excepción: un traspaso entre economías es un gasto en la de origen y un ingreso en la de destino.
- Las devoluciones suman saldo a su cuenta y restan del gasto de su categoría; no cuentan como ingreso.
- Los otros saldos no cuentan en el control del mes ni en las estadísticas de gasto; solo en el patrimonio.
- Los frecuentes y el autocompletado de conceptos ignoran las entradas de grupos.
- Los ingresos cuentan en el control del mes y en las estadísticas por su `mes_imputado`, si lo tienen; los saldos y la lista de movimientos usan siempre la fecha.
- **Tarjeta de crédito**: es una cuenta más. Los gastos con tarjeta restan de ella (saldo negativo = deuda) y pagar la tarjeta es un traspaso desde la cuenta corriente.
- Archivar una cuenta o categoría la oculta de los formularios, pero sus movimientos siguen contando.
- Moneda EUR, locale `es-ES`, fechas en español.

## 10. Estadísticas

Controles arriba: periodo (**Este mes**, **3 meses**, **Este año**, **12 meses**) y cuenta (todas por defecto). Siempre por meses naturales (sección 6).

**Resumen del periodo**: ingresos, gasto neto (con su parte fija y variable), ahorro, tasa de ahorro (frente al objetivo, si lo hay) y gasto variable medio diario, cada uno con su variación frente al periodo anterior equivalente ("↓ 8 % frente a agosto").

**Gráficos**, en este orden:

1. **Ritmo del mes**: gasto neto acumulado día a día (los pagos de fijos se ven como escalones) frente a la media de los 3 meses anteriores y frente al límite (línea horizontal), con una proyección punteada hasta fin de mes que suma el ritmo variable y los fijos pendientes. Es el gráfico protagonista.
2. **Gasto por categoría**: barras horizontales ordenadas de mayor a menor, con importe, % del total y variación frente al periodo anterior. Tocar una categoría abre su detalle.
3. **Fijo frente a variable**: barras apiladas por mes con la parte fija y la variable del gasto.
4. **Calendario de gasto**: cuadrícula del mes, con semanas de lunes a domingo, con cada día coloreado según el gasto variable. Encima, los días sin gasto y la racha actual. Tocar un día muestra sus movimientos.
5. **Ingresos y gastos por mes**: barras agrupadas de los meses del periodo, con una línea de ahorro.
6. **Evolución del patrimonio**: saldo de las cuentas al final de cada mes más, con todas las cuentas seleccionadas, el de los otros saldos activos (su última actualización hasta ese día), apilados. Con una cuenta concreta, solo esa cuenta. Con varias economías, un selector **Esta economía / Todas** muestra la evolución de todas juntas (sin el filtro de cuenta); los traspasos entre economías se compensan.
7. **Ingresos por categoría**: barras horizontales sencillas.

**Detalle de categoría**: evolución de 12 meses, media mensual, presupuesto de cada mes, número de movimientos, ticket medio y los 5 mayores gastos.

Requisitos: legibles en una pantalla de 375 px de ancho, sin leyendas grandes (etiquetas directas), información al tocar en lugar de al pasar el ratón, colores de cada categoría, y estado vacío útil cuando aún hay pocos datos.

## 11. Recomendaciones

Se generan en la app a partir de mis datos, con reglas en funciones puras. Todos los umbrales van en un único archivo (`src/lib/recomendaciones/config.ts`) para poder ajustarlos.

| Regla | Cuándo aparece | Ejemplo |
|---|---|---|
| Proyección de fin de mes | A partir del día 7 del mes, si el gasto proyectado supera el límite (o, sin límite, en más de un 10 % la media de 3 meses) | "A este ritmo terminarás el mes 160 € por encima de tu límite." |
| Ritmo diario bajo | El disponible por día cae por debajo de la mitad del ritmo previsto | "Para llegar a fin de mes te quedan 12 € al día; normalmente gastas 30 €." |
| Presupuesto en riesgo | La proyección de una categoría supera su presupuesto del mes | "Ocio: llevas 180 € de 200 € y quedan 12 días." |
| Ahorro en riesgo | El ahorro proyectado queda por debajo del objetivo | "Si sigues así, ahorrarás 150 € de los 300 € previstos." |
| Categoría disparada | Gasto de una categoría por encima del 130 % de su media de 3 meses y al menos 30 € de diferencia | "Este mes gastas un 45 % más en Comida que de costumbre." |
| Sugerir presupuesto | Categoría con gasto medio superior a 100 € al mes y sin presupuesto | "Sueles gastar 240 € al mes en Compras. ¿Le pones un presupuesto de 250 €?" |
| Gastos hormiga | 10 o más gastos de menos de 5 € en el mes en una misma categoría | "23 gastos pequeños en Comida suman 71 €." |
| Fijo más caro | Al pagar un fijo por más de un 10 % sobre la media de sus 3 últimos pagos | "La luz de este mes (78 €) es un 25 % más cara que tu media." |
| Suscripciones | Al empezar cada trimestre, si hay fijos en la categoría Suscripciones | "Tus suscripciones suman 504 € al año. ¿Las usas todas?" |
| Peso de los fijos | Los gastos fijos superan el 50 % de los ingresos medios | "Tus gastos fijos son el 58 % de tus ingresos." |
| Gasto inusual | Un gasto de los últimos 7 días mayor que 3 veces la mediana de su categoría (con al menos 5 gastos previos) | "El gasto de 320 € en Salud del día 12 es mucho mayor de lo habitual." |
| Logros | Racha de 3 o más días sin gasto, tasa de ahorro por encima del objetivo, o varios meses seguidos ahorrando | "Llevas 4 meses seguidos ahorrando: este mes, un 22 % de tus ingresos." |

- Cada recomendación es una tarjeta con título, explicación con cifras reales y, si tiene sentido, una acción (ver movimientos, crear el presupuesto sugerido con un toque, revisar fijos).
- Orden: avisos, luego sugerencias, luego logros. Máximo 5 visibles.
- Se pueden descartar hasta el mes siguiente (guardado en el dispositivo).
- Las reglas que comparan con la media necesitan al menos 2 meses completos de datos. Mientras tanto: "Cuando tengas 2 meses de movimientos, aquí aparecerán más recomendaciones sobre tus gastos."

## 12. Diseño

Objetivo: que dé gusto abrirla cada día, con aspecto de app nativa de iPhone y una identidad propia: **menta y tinta**.

- **Tipografía**: la del sistema. Cifras con `ui-rounded` (SF Pro Rounded en iPhone) y cifras tabulares; texto con `system-ui`. Los importes grandes, empezando por el disponible de Inicio, son el elemento visual principal.
- **Paleta clara**: fondo `#F3F7F5`, superficie `#FFFFFF`, superficie secundaria (campos, segmentados) `#E9F0EC`, texto `#12201A`, texto secundario `#5E6E66`, principal menta `#12B886` (menta legible para texto `#087F5B`), acento ámbar `#FFB547` (destacados y gasto variable), aviso `#F08C00`, peligro `#E03131`. Botón principal en tinta (`#12201A`, texto blanco).
- **Paleta oscura** (según el sistema, o elegida en Ajustes → Apariencia, que pone `data-tema` en `<html>`): fondo `#0C1411`, superficie `#15201B`, superficie secundaria `#1D2A24`, texto `#E6EEE9`, secundario `#93A39A`, principal `#38D9A9`, ámbar `#FFC266`. Botón principal en menta con texto oscuro.
- **Cifra protagonista**: tarjeta con degradado según el estado (menta si va bien, ámbar si va ajustado, rojo si se pasa) y texto blanco. Sin límite no hay cifra protagonista: la sustituye ingresos frente a gastos.
- **Barra inferior** flotante y translúcida, con iconos de trazo (SVG en línea, sin librerías) y el botón **+** central con el degradado menta.
- Tarjetas y listas con esquinas de 18 px y sombra suave; categorías con su emoji sobre un cuadrado redondeado de su color suavizado; interruptores estilo iOS.
- **Estados del mes**: bien en verde principal, ajustado en aviso, pasado en peligro. Siempre acompañados de texto, no solo de color.
- **Fijos**: etiqueta discreta "Fijo" en los movimientos y un icono claro para cada estado (pendiente, se esperaba ya, pagado, omitido).
- **Icono**: una "T" blanca con un punto ámbar ("T.") sobre degradado menta, sencilla y legible en tamaño pequeño. Versiones de 180 px (iPhone) y de 192 y 512 px (PWA), generadas con `scripts/make-icons.mjs`.
- **Categorías**: paleta de 10 colores armónicos con la anterior, asignados en orden al crear.
- Ingresos y devoluciones en verde; gastos en el color de texto normal (no todo en rojo).
- Formularios como hojas inferiores; zonas táctiles de al menos 44 px; campos de al menos 16 px para que iOS no haga zoom.
- Respetar las zonas seguras del iPhone (notch y barra inferior) y la barra de estado en modo app instalada.
- Animaciones solo como respuesta a acciones (abrir hoja, guardar, marcar pagado, deshacer), respetando "reducir movimiento".
- Estados vacíos que inviten a actuar ("Aún no hay gastos este mes. Añade el primero con +").

## 13. Lógica y tests

Funciones puras en `src/lib/` con tests de Vitest:

- Parseo y formato de importes (`"12,5"` → 1250 céntimos → "12,50 €").
- Meses: límites de mes natural, cambios de año e ingresos con `mes_imputado` (nómina adelantada y retrasada).
- Presupuesto vigente de cada mes: herencia, "solo este mes" y "este mes y los siguientes", total y por categoría.
- Fijos: qué fijos tocan cada mes según periodicidad, `desde`, `hasta` y pausa; cargos puntuales; fechas cambiadas para un mes; estados (pendiente, se esperaba ya, pagado, omitido); pagos adelantados y tardíos; coste mensual y anual; próximos cargos.
- Control del mes: gasto neto con devoluciones, parte fija y variable, límite (con y sin presupuesto), ingresos frente a gastos, disponible con y sin los fijos pendientes, disponible por día, ritmo previsto y estado.
- Resúmenes de periodo (excluyendo traspasos) y variaciones frente al periodo anterior.
- Detección de frecuentes y sugerencia de categoría por concepto.
- Series de los gráficos, incluido el calendario y las rachas sin gasto.
- Cada regla de recomendación, con casos que la activan y que no.
- Grupos: separación de sueltos y agrupados, resumen mensual por grupo y validación.
- Otros saldos: saldo actual, saldo a una fecha o fin de mes y totales.

## 14. Exportación CSV y copia de seguridad

Todos los movimientos, ordenados por fecha. Columnas: fecha, hora, tipo, importe, cuenta, cuenta_destino, categoria, concepto, descripcion, grupo (nombre del grupo, si lo es), fijo (nombre del fijo, si lo es) y cuenta_para_mes. Ordenados por fecha y hora (en ingresos imputados a otro mes). Separador `;` y decimales con coma, para que Excel y Numbers en español lo abran bien. UTF-8 con BOM. En iPhone, compartir con la Web Share API (para guardarlo en Archivos); si no está disponible, descarga normal.

**Copia de seguridad.** El CSV es de la economía activa y solo lleva movimientos; la copia de seguridad lo lleva todo:

- **Descargar**: un archivo JSON (`txobank-copia-AAAA-MM-DD.json`) con todas las economías a las que tengo acceso y, de cada una, ajustes, cuentas, categorías, presupuestos, fijos (con omisiones y fechas cambiadas), movimientos, grupos, otros saldos y su historial, tal cual (tipos del dominio, con sus ids). Lleva `formato: "txobank-copia"`, `version: 1`, la fecha y la versión de la app. Se entrega igual que el CSV. La app recuerda en el dispositivo cuándo se descargó la última y avisa a partir de 30 días.
- **Restaurar**: se elige el archivo, se ve un resumen (fecha y, por economía, cuentas, movimientos y fijos) y se confirma. Las economías de la copia **se añaden como nuevas**, nunca sobrescriben ni borran: todo recibe ids nuevos con las referencias actualizadas, y si una economía se llama como otra existente se le añade "(restaurada)". Los traspasos entre economías se mantienen si sus dos mitades están en la copia; si no, quedan como gastos o ingresos normales. Si falla a medias, se borra lo que llegó a crear.
- La lógica (leer y validar el archivo, resumen y preparación con ids nuevos) está en `src/lib/copia.ts`, con tests; el adaptador solo lee e inserta filas.

## 15. Plan por fases

Cada fase termina con la app desplegada y probada en el iPhone.

1. **Base**: proyecto Vite + React + TS, workflow de GitHub Pages con las variables del repositorio, PWA instalable, interfaz `DataSource` con el adaptador de Supabase e inicio de sesión. *Hecho cuando*: la instalo en el iPhone y entro con mi usuario.
2. **Estructura**: migraciones SQL de todas las tablas y la vista con RLS y GRANT; Ajustes de cuentas y categorías; asistente de primera vez.
3. **Movimientos**: hoja de nuevo movimiento completa (frecuentes, categoría al vuelo, autocompletado, devoluciones, mes de los ingresos, duplicar), lista con filtros y saldos.
4. **Fijos**: gestión de fijos con periodicidades, estados de cada mes, marcar como pagado, omitir y crear un fijo desde un movimiento.
5. **Control del mes e Inicio**: presupuestos por mes, límite, disponible, fijos del mes en Inicio, avisos al guardar y modo discreto.
6. **Estadísticas**: resumen, todos los gráficos y el detalle de categoría.
7. **Recomendaciones y revisión mensual**.
8. **Cierre**: exportación CSV, repaso de modo oscuro, estados vacíos, mensajes de error y pulido general.

## 16. Configuración manual (lo hago yo)

Supabase:
1. Crear proyecto en la región europea más cercana, dejando desmarcada la opción de exponer nuevas tablas automáticamente.
2. Authentication → desactivar el registro de nuevos usuarios.
3. Authentication → Users → Add user, con mi email y contraseña y la confirmación automática marcada.
4. Ejecutar las migraciones de `supabase/migrations/` en el SQL Editor, en orden.
5. Settings → API Keys → copiar la URL del proyecto y la clave publicable.

GitHub:
1. Crear el repositorio público `txobank`.
2. Settings → Secrets and variables → Actions → pestaña Variables: crear `VITE_DATA_BACKEND` (`supabase`), `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Settings → Pages → Source: GitHub Actions.

En local, las mismas tres variables en `.env.local`.

Nota: el plan gratuito de Supabase pausa los proyectos con poca actividad durante 7 días. Usándola a diario no debería pasar; si pasa, se reactiva desde el panel sin perder datos.

## 17. Decisiones tomadas

- La conexión a la base de datos (URL y clave publicable) es fija y se define al compilar; en la app solo se introducen usuario (email) y contraseña.
- Todo va por meses naturales. Los gastos cuentan por su fecha; los ingresos pueden contar para el mes anterior o el siguiente.
- Los fijos van aparte y no se generan solos: se marcan como pagados el día que se cobran, con el importe real.
- Los fijos pendientes no cuentan como gastados hasta que se cobran: "Te quedan" no los resta, pero debajo se muestra lo que queda tras ellos y el estado del mes sí los tiene en cuenta. Inicio recuerda los que llegan en los próximos 10 días, y los del mes siguiente se pueden adelantar: el gasto cuenta en el mes en que se paga.
- Cada fijo tiene un día habitual de cargo que se puede cambiar para un mes concreto; los cargos puntuales son fijos de "Una vez" (`desde = hasta`).
- Cada movimiento y cada fijo tienen, además del concepto o el nombre, una descripción libre opcional.
- El presupuesto, total y por categoría, puede ser distinto cada mes; un mes sin cambios hereda el del anterior.
- El presupuesto total incluye los gastos fijos.
- Sin presupuesto total no hay límite ni "Te quedan": no se deduce de los ingresos. Inicio enseña ingresos frente a gastos (también, debajo, cuando sí hay presupuesto).
- El saldo de las cuentas solo cuenta movimientos hasta hoy.
- La tarjeta de crédito funciona como cuenta con saldo negativo.
- Una sola moneda: euro.
- Los otros saldos no admiten movimientos: solo se actualiza su saldo, y cada actualización queda en el historial con su fecha y hora. Suman al patrimonio, pero no al control del mes.
- Un grupo de gastos es permanente, con nombre libre y una categoría fija; su total se cuenta por meses, así que cada mes empieza de cero. Sus entradas son gastos normales con fecha, hora y descripción.
- La versión de la app (`package.json`) se muestra en el inicio de sesión y en Ajustes → Acerca de, con el commit del que se compiló.
- Archivar una cuenta o un otro saldo lo deja a 0, para que el patrimonio cuadre siempre con el dinero que de verdad se tiene.
- La verificación en dos pasos es opcional; si está activada, la exige el servidor, no solo la app. Si se pierde la app autenticadora, el factor se borra desde el panel de Supabase.
- Ya no hay "Borrar todo": se quitó al validar la versión. Se pueden borrar economías (salvo la única que quede) desde Ajustes → Economías.
- La copia de seguridad la descarga y guarda el usuario (no hay copias automáticas, porque no hay servidor). Restaurar siempre añade economías nuevas, nunca sobrescribe.
- Todo pertenece a una **economía**; un usuario puede tener varias y cambiar de una a otra. Cada una tiene sus propias categorías, presupuestos y ajustes. De momento solo entra su propietario, pero la base de datos está preparada para compartirlas.
- Un traspaso entre economías es un gasto en la de origen y un ingreso en la de destino (dos movimientos enlazados), y puede ser un fijo.
- El patrimonio total de todas las economías se ve en Inicio (valor actual) y en Estadísticas (evolución, con el selector Esta economía / Todas).
