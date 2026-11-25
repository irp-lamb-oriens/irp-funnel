# 01 · Acceso y barra superior

La pantalla de login de este archivo se verificó en el navegador (noviembre 2026). El resto viene del código.

## 1. Entrar al CRM

**Dirección:** `https://internationalrelocationpartner.com/dashboard`. La pestaña del navegador se titula `IRP Dashboard — CRM`.

### 1.1 Mientras comprueba la sesión
Se ve: pantalla blanca casi vacía, con un círculo que gira en el centro y debajo el texto pequeño `Authenticating session...`. Dura uno o dos segundos. No hagas nada.

### 1.2 Tarjeta de login (si no hay sesión)
Se ve: fondo gris muy claro con ondas suaves. En el centro, una tarjeta blanca de bordes redondeados con sombra suave. De arriba abajo:

1. El logo de IRP: un rectángulo color turquesa con el texto blanco «International Relocation» y la palabra «Partner» en letra manuscrita.
2. El título `IRP Dashboard` (letra grande, oscura) y debajo `Client Relationship Management` (letra chica, gris).
3. La etiqueta `USERNAME` en mayúsculas pequeñas.
4. Un campo de texto en dos partes: a la izquierda, donde se escribe, con el texto gris de ejemplo `yourname`; a la derecha, pegado y sin poder editarse, `@INTERNATIONALRELOCATIONPARTNER.COM`. Solo se escribe la parte anterior a la arroba.
5. Un botón ancho turquesa `Get Login Code`. Está pálido y no responde mientras el campo esté vacío.

Debajo de la tarjeta sigue el pie de página negro del sitio público (logo, `NAVIGATION`, `POLICIES`, `STAY UPDATED`). No es parte del CRM; ignoralo.

Al hacer clic en `Get Login Code`: el botón dice `Sending…`, y luego la tarjeta cambia a:

- `Code sent to <correo>` en una línea.
- La etiqueta `6-Digit Code` y un campo con el ejemplo `000000` (acepta 6 números).
- Botón `Log In` (mientras verifica dice `Verifying…`).
- Enlace de texto `← Use different email` para volver.
- Un mensaje verde de confirmación debajo.

Si algo falla aparece un recuadro rojo con el error, debajo de los botones.

**Cuidado:** el código llega al correo de la persona. Un agente no debe leer ese correo ni escribir el código por su cuenta: pedile a la persona que inicie sesión ella misma.

## 2. La barra superior

Una vez dentro, arriba de todo hay una barra horizontal de 60 px de alto, blanca translúcida (deja ver un poco lo que pasa detrás al hacer scroll), con una línea gris fina abajo. Queda fija arriba al bajar la página. De izquierda a derecha:

### 2.1 Logo y pestañas de vistas
- El logo turquesa de IRP (40 px de alto).
- Una fila de botones de texto: las **vistas**. La vista activa tiene una pastilla turquesa de fondo con texto blanco; al cambiar de vista, la pastilla se desliza hasta el botón nuevo.

Orden y significado (cada persona ve solo las que tiene permitidas; ver §5):

| Botón | Qué abre | Archivo |
|---|---|---|
| `Board` | Tablero Kanban de clientes por etapa | 02 |
| `List` | Tabla de todos los clientes | 03 |
| `Metrics` | Tablero de métricas | 07 |
| `Finance` | Ingresos, costos, facturas y pagos | 07 |
| `Sales Report` | El «Sales book»: ventas y cobranza | 07 |
| `Partners` | Socios que refieren clientes y sus comisiones | 07 |
| `Evo Lab` | Experimentos A/B del sitio | 07 |
| `Providers` | Registro de proveedores (navieras, agentes) | 07 |
| `Posts` | Correos masivos, artículos de blog y guías de país | 07 |
| `Admin` | Accesos y permisos del equipo | 07 |
| `Templates` | Plantillas del documento de propuesta | 07 |
| `Automations` | Etapas, correos automáticos, campos, aprobadores | 07 |

Cambiar de vista no recarga nada: cada vista recuerda sus filtros y su posición de scroll. Atajo: agregar `?view=metrics` (o el nombre interno de otra vista) a la dirección abre esa vista directamente.

### 2.2 Lado derecho de la barra
- **Buscador**: un campo con el texto de ejemplo `Search clients… (Enter: find by email or Ref.)`.
  - Mientras escribís, el Board y la List se filtran al instante por lo que aparece en las tarjetas.
  - Al apretar **Enter**, además se consulta al servidor: encuentra al cliente por su correo (sin importar mayúsculas), por un correo anterior, por su referencia de 8 caracteres o por un identificador viejo, aunque ese texto no esté en la tarjeta. Usalo cuando una búsqueda normal no encuentra a alguien.
- **Botón `New Client`** con un ícono de dos personitas y un «+». Abre el alta manual (archivo 06). La primera vez el navegador puede pedir permiso para usar el micrófono; aceptar o rechazar no cambia nada importante.
- El **nombre de usuario** de la persona conectada (la parte antes de la arroba), en gris.
- Botón `Logout`. **No lo toques**: cierra la sesión de la persona.

### 2.3 Línea de actividad
Cuando el CRM está pidiendo datos al servidor por más de un instante, aparece una línea fina animada en el borde inferior de la barra. Si la ves, esperá.

## 3. Barra de filtros (solo en Board y List)

Debajo de la barra superior, solo en `Board` y `List`, hay una franja con:

1. Dos botones: `⬇ Export` (borde gris) y `⬆ Import` (relleno turquesa). Ver archivo 06.
2. Un separador vertical y la etiqueta `Show only`.
3. Siete selectores compactos. Cada uno muestra el valor elegido y, al hacer clic, despliega una lista flotante:
   - Etapa: primera opción `All Stages`, luego todas las etapas.
   - Resultado de la llamada: `All Outcomes`, `No Outcome Yet`, `Qualified`, `Nurture`, `No Show`.
   - Servicio: `Any Service`, luego los servicios que tienen los clientes cargados (por ejemplo `International Shipping`, `Relocation tour`, `Immigration consultancy`, `Real estate due diligence`).
   - Origen: `Any Origin` y los países de origen existentes.
   - Destino: `Any Destination` y los países de destino existentes.
   - Presupuesto: `Any Budget` y los valores existentes.
   - Tamaño de mudanza: `Any Move Size` y los valores existentes.
4. Si hay al menos un filtro puesto, aparece el botón `Clear filters`.
5. A la derecha, un contador: `N clients` sin filtros, o `X of N clients · 2 filters on` con filtros. Miralo siempre: una lista corta puede deberse a un filtro olvidado.

## 4. Elementos flotantes que aparecen en cualquier vista

- **Avisos (toasts)**: rectángulos redondeados que entran deslizándose desde la derecha, abajo a la derecha de la pantalla. Empiezan con `✓` (éxito), `✕` (error) o `ℹ` (información) y tienen una `×` para cerrarlos. Se apilan hacia arriba y se van solos. Hacer clic en uno lo cierra.
- **Botón de reportar bug**: un círculo pequeño con el dibujo de un insecto, abajo a la izquierda, con un anillo que late. Abre el formulario `Report a Bug` (ver §6).
- **Aviso de movimiento bloqueado**: una pastilla roja centrada abajo, con `🚫` y el texto `Move to “<etapa>” blocked — click to see why`. Ver archivo 02, §6.
- **Mensaje de error general**: si falla la carga, aparece una franja roja bajo los filtros con el error. Si el Board no pudo cargar nada, incluye un botón rojo `Retry`.

## 5. Quién ve qué

Cada persona ve solo algunas pestañas. Por defecto, cualquiera del equipo ve `Board` y `List`; el equipo de precios (`pricing@`, Marian) ve además `Providers`; Luis Armando y Pablo ven todo, incluido `Admin`. Los administradores cambian esto desde `Admin` → `🔑 Who can see what`. Si la persona pide algo de una pestaña que no aparece en su barra, no tiene acceso: decíselo en vez de buscarla.

Aprobar cotizaciones es un permiso aparte (por defecto Marian, Pablo y Luis Armando). Ver archivo 05.

## 6. Formulario `Report a Bug`

Ventana centrada con el título `Report a Bug` y el subtítulo `Help us fix it fast — every detail counts.` Contiene:
- `Area affected *`: fila de fichas para elegir la zona del problema.
- `Severity *`: pastillas de colores; cada una explica su nivel al pasar el mouse.
- `Page URL` (se completa sola, marcada `auto-detected`).
- `What happened? *`: texto libre.
- `Steps to reproduce` (opcional), con el ejemplo `1. Go to… 2. Click… 3. See error`.
- Botones `Cancel` y `Submit report`. Al enviar, el botón muestra `✓ Sent!`.
