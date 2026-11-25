# 02 · Board (tablero Kanban)

Se abre con el botón `Board` de la barra superior. Es la vista por defecto.

## 1. Forma general

Se ve: debajo de la barra de filtros, una fila horizontal de **columnas** blancas de 272 px de ancho, con bordes redondeados y separadas por un pequeño espacio. Hay más de 30 columnas, así que la fila es mucho más ancha que la pantalla: hay una barra de scroll horizontal fina abajo del tablero. Para ver columnas a la derecha, desplazate horizontalmente (Shift + rueda, o arrastrando la barra). El scroll «engancha» al inicio de cada columna.

Cada columna es una **etapa** del proceso. El orden de izquierda a derecha sigue el recorrido del cliente: primero ventas (tonos violeta/índigo), luego operaciones en origen (azules), destino (naranjas/ámbar), importación y entrega (verdes azulados y verdes), y cierre. La lista completa está en el archivo 09.

Si un cliente está en una etapa que no figura en la configuración (por ejemplo una etapa vieja), igual aparece una columna extra al final con ese nombre: nadie desaparece del tablero.

## 2. Encabezado de columna

Cada columna tiene arriba un encabezado con una **franja de color de 3 px en el borde superior** (el color de la etapa). En una línea:

- El **ícono** de la etapa (emoji, por ejemplo `📅` para `Pre-Consultation`).
- El **nombre** de la etapa en negrita (por ejemplo `Pre-Consultation`). Al pasar el mouse muestra la descripción de la etapa.
- Un `ⓘ` pequeño, con la misma descripción como tooltip.
- Un **contador** en una pastilla gris: la cantidad de clientes. Si hay una búsqueda dentro de la columna, muestra `encontrados/total`, por ejemplo `2/14`.
- Si hay clientes atrasados, una marca `⚠ N` (por ejemplo `⚠ 3`). Tooltip: `3 clients past the 2-day SLA for this column`. En ese caso la columna entera tiene un brillo ámbar-rojizo que late despacio.

Debajo del encabezado, un campo pequeño `Search column…` que filtra solo esa columna (por nombre, apellido, correo, ciudad de origen o destino).

## 3. Tarjetas de cliente

Debajo, las **tarjetas**: rectángulos gris muy claro con borde fino, una por cliente. Al pasar el mouse el borde se vuelve turquesa. Se muestran 10 por columna; si hay más, al final aparece el botón `Show more (N remaining)`, que agrega 10 más cada vez. Si la columna está vacía dice `No clients` (o `No matches` si hay búsqueda).

Las tarjetas con prioridad manual (ver §5) van primero; el resto se ordena por actividad reciente.

### 3.1 Contenido de una tarjeta, de arriba abajo

1. **Esquina superior derecha**: a veces un círculo turquesa con un número blanco (`1`…`9+`): tareas pendientes de ese cliente (correos sugeridos, comentarios del cliente, menciones). Tooltip: `3 pending actions`.
2. **Control de prioridad**: un botón pequeño. Si la tarjeta tiene prioridad, muestra fueguitos `🔥` (uno por cada punto de prioridad: `🔥🔥🔥` = prioridad 3). Si no tiene, está casi invisible; su tooltip dice `Rank card (float to top)`.
3. **Nombre** del cliente en negrita. Si no se conoce el nombre de pila, aparece un `?` en un circulito antes del texto y el nombre se ve en cursiva gris (se muestra el apellido o el correo).
4. **Ruta**: ciudad (o país) de origen, una flecha turquesa `→`, ciudad (o país) de destino. Ejemplo: `Austin → San José`.
5. **Fila de etiquetas** pequeñas (aparecen solo si aplican):
   - `🌍 Guide Lead` (verde): llegó descargando una guía de país, no pidió consulta.
   - `📥 Migrated Lead` (verde): lead antiguo traído del sistema anterior.
   - El **presupuesto** en una pastilla turquesa clara (por ejemplo `$10k–$20k`).
   - `⏰ 4d`: días que lleva en esta columna. Siempre visible. Se pone roja cuando superó el plazo de la etapa. Tooltip: `In this column 4d — SLA is 2d`.
   - Fecha de la llamada de consulta, si hay una agendada (por ejemplo `Nov 28, 2026`).
   - `📝 3` (amarillo): cantidad de notas.
   - `❌ Transcript` (rojo): el cliente ya pasó la llamada pero no hay transcripción cargada.

### 3.2 Estados visuales de la tarjeta
- **Atrasada** (pasó el plazo de su etapa): borde ámbar y un brillo que late lento.
- **No se presentó a la llamada**: tono rojizo. Pasa si la llamada se marcó como no-show, o si sigue en `Pre-Consultation` más de una hora después de la hora agendada y no tiene transcripción.
- **Nombre desconocido**: nombre en cursiva gris con `?`.

### 3.3 Mientras carga
Cada columna muestra cinco tarjetas grises con líneas que brillan en ola (esqueletos). Desaparecen cuando llegan los datos reales.

## 4. Abrir un cliente

Hacer clic en cualquier parte de la tarjeta (o enfocarla y apretar Enter) abre el **panel del cliente** a la derecha. Ver archivo 04.

## 5. Prioridad (subir una tarjeta arriba de todo)

Al hacer clic en el control de prioridad de la tarjeta (punto 2 de §3.1), se abre un menú pequeño pegado a la tarjeta, sin abrir el panel del cliente:
- `⤒ Send to top`: le da la prioridad más alta de la columna más uno.
- Un campo numérico `#` y el botón `Set`: fija un número exacto. Número más alto = más arriba. Dejarlo vacío y apretar `Set` quita la prioridad.
- `✕ Clear rank` (solo si ya tenía prioridad): la quita.

Hacer clic fuera del menú lo cierra. Lo mismo se puede hacer desde el panel del cliente, sección `Priority`.

## 6. Mover un cliente de etapa

Hay dos formas:

**a) Arrastrar la tarjeta** a otra columna y soltarla en cualquier parte de esa columna. Si la columna destino está fuera de la pantalla, conviene usar la forma (b).

**b) Desde el panel del cliente**: hacer clic en la ficha de etapa de colores bajo el nombre (ver archivo 04, §2) y elegir la etapa nueva de la lista. Es más precisa para un agente.

Al moverlo, la tarjeta aparece en la columna nueva y su contador `⏰` vuelve a `0d`.

### 6.1 Efectos automáticos de algunos movimientos
- Entrar a **`Pricing Quote`** manda un aviso automático al equipo de precios.
- Entrar a **`Initial Payment`** desde `Quote Acceptance` registra el pago y suma la venta a los reportes. **Cuidado.**
- Al entrar a ciertas etapas, el sistema puede **sugerir correos** (no los envía): aparecen como pendientes en la pestaña `Emails` del cliente y suben el círculo turquesa de la tarjeta.
- Mover una tarjeta queda registrado en `Activity` y `🛣 Journey`, y se puede deshacer desde `Activity` con `Undo last`.

### 6.2 Cuando el movimiento está bloqueado
Algunas etapas tienen **requisitos de entrada** (configurados en `Automations` → `🗂️ Stages & rules` → `🚦 Move-in gates`). Si no se cumplen:
- La tarjeta **vuelve a su columna original**.
- Abajo a la derecha aparece un aviso rojo: `Move blocked — “<etapa>” has unmet requirements. Click the alert to see why.`
- Abajo al centro aparece una pastilla roja: `🚫 Move to “<etapa>” blocked — click to see why`, con una `✕` para cerrarla.
- Al hacer clic en la pastilla se abre una ventana con fondo oscurecido: título `🚫 Can't move <cliente> to “<etapa>” yet`, el texto `The following requirements must be met before this move is allowed:` y, en recuadros rojos claros, cada requisito con su lista de lo que falta. Botón `Got it` para cerrar.
- El mismo aviso aparece como franja roja en la pestaña `💰 Quotes` del cliente: `Can't move to “<etapa>” yet`.

Qué hacer: cumplir lo que pide el requisito (por ejemplo, enviar primero un pedido de precio) y volver a mover. No intentes esquivarlo moviendo a otra etapa intermedia.

## 7. Cosas que el Board no muestra
- No hay campo de «responsable» o «asignado a» en las tarjetas: el CRM no asigna clientes a personas. Para avisar a alguien de un cliente, se lo menciona en una nota (`@nombre`, archivo 04 §3.7).
- Los clientes descartados siguen en el tablero, en `Non Qualified` o `Sale Dropped`.
