# 04 · Ficha del cliente (panel lateral)

Se abre al hacer clic en una tarjeta del Board, en una fila de la List o desde enlaces de otras vistas (Metrics, Sales Report).

## 1. Forma general

Se ve: el resto de la pantalla se oscurece un poco y se desenfoca. Desde el borde derecho entra deslizándose un **panel blanco alto** que ocupa toda la altura de la ventana y hasta 1200 px de ancho (en una pantalla de escritorio normal cubre casi todo). Tiene una sombra a su izquierda. Su contenido se desplaza con scroll vertical propio.

**Para cerrarlo:** la `✕` arriba a la izquierda del panel, o un clic en la zona oscurecida fuera del panel. En celulares el panel sube desde abajo y ocupa el 92 % de la altura.

De arriba abajo, el panel tiene: cabecera (§2), ficha de etapa (§2.4), fila de pestañas (§3) y el contenido de la pestaña elegida.

## 2. Cabecera

Fondo con un degradé muy suave de gris claro a blanco, separada del resto por una línea fina.

1. `✕` para cerrar.
2. **Nombre del cliente** en letra grande (22 px) y muy negrita. Si no se conoce el nombre de pila, aparece un `?` en un circulito y se muestra el apellido o el correo.
3. Una línea gris con: el **correo**, `· teléfono` si lo hay, y `· ID: xxxxxxxx` en letra de máquina de escribir (identificador corto de la sesión).
4. **Datos críticos**: una fila de pares etiqueta/valor pequeños, solo los que existan: `Route` (por ejemplo `Austin, USA → Escazú, Costa Rica`), `Budget`, `Move size`, `Immigration`, `Timeline`.

### 2.4 Ficha de etapa (cambiar de etapa)
Debajo de la cabecera, un **botón con forma de pastilla** pintado con el color de la etapa actual (fondo del color muy suave, borde y texto del color). Contiene el ícono, el nombre de la etapa y un `▾`. Ejemplo: `📅 Pre-Consultation ▾`. Tooltip: `Click to change pipeline stage`.

Al hacer clic se abre debajo una caja flotante con:
- Un campo `Search stage…` (ya tiene el cursor).
- Una lista con scroll de todas las etapas, cada una con su ícono y nombre y una franja de su color. La etapa actual tiene `✓` a la derecha. Al pasar el mouse muestra la descripción de cada etapa.
- Si nada coincide con la búsqueda: `No stages match "<texto>"`.

Hacer clic en una etapa mueve al cliente ahí (mismos efectos y bloqueos que arrastrar en el Board; ver archivo 02, §6). Mientras se guarda, la pastilla queda deshabilitada.

## 3. Pestañas

Una fila de pestañas de texto. La activa queda resaltada. Algunas muestran un **circulito turquesa con número** cuando hay tareas pendientes en esa pestaña. En orden:

`Overview` · `🛣 Journey` · `📝 Insights` · `🌿 Lily` · `⚡ Actions` · `Conversations` · `Notes (N)` · `Activity` · `Emails` · `💰 Quotes` · `🧾 Charges` · `📨 Providers`

Al abrir un cliente siempre empieza en `Overview`. `💰 Quotes`, `🧾 Charges` y `📨 Providers` están en el archivo 05.

### 3.1 `Overview` — los datos del cliente

Una grilla de pares **etiqueta (gris, chica) / valor**. Casi todos los valores se editan con un clic.

**Cómo editar un campo:** pasá el mouse sobre el valor: aparece un lápiz `✎` (o `📅` si es fecha) y el tooltip `Click to edit`. Al hacer clic, el valor se vuelve un campo de texto. **Enter** o hacer clic afuera guarda; **Escape** cancela. Los campos vacíos muestran `—`. Los de solo lectura dicen `Read-only` al pasar el mouse. Los campos de lista (por ejemplo `Service Type`) se editan con un desplegable; los de sí/no, con un interruptor. Todo cambio queda en `Activity` y se puede deshacer.

Contenido, de arriba abajo:

1. **`Service Type`**: una insignia de color con el tipo de servicio: `International Shipping`, `Relocation Tour`, `Immigration Consultancy`, `Legal Advice`, `Real Estate Assessment`, `Intercultural Coaching`, `Relocation + Tour` o `Multiple services`.
2. **Franja de precios** (solo si ya hay transcripción de la llamada):
   - Si todavía no se envió el resumen a precios: un recuadro con `📤`, el título `Transcript ready — send to pricing`, la explicación `Preview & send a full summary (client data + AI insights) to pricing@internationalrelocationpartner.com` y el botón `Preview & Send to Pricing`. Abre la vista previa del correo (§4).
   - Si ya se envió: una línea verde `✓ Pricing summary sent` y hace cuánto.
3. **`Priority`**: una insignia `🔥 Ranked #3` (con el texto `Floats above un-ranked clients in <etapa>.`) o `Normal` (`Sorted by recency — rank it to float it to the top.`). A la derecha: `⤒ Send to top`, un campo `#` con `Set`, y `Clear` si tiene prioridad.
4. **Campos principales** (configurables desde `Automations` → `🧩 Overview fields`; estos son los de fábrica):
   - `First Name`, `Surname`, `Email` (tiene su propio editor: cambiar el correo conserva el historial de correos anteriores), `Phone`.
   - `Route`: cuatro cajitas en una línea, cada una con su subtítulo: `City` `,` `Country` `→` `City` `,` `Country`.
   - `Budget`, `Move Size`, `Immigration Status`.
   - `Property`: `From` `→` `To` (tipo de vivienda en origen y destino).
   - `Vehicles`: lista editable de vehículos (agregar, editar, borrar).
   - `Scheduled Call`: la fecha y hora de la llamada con el botón `📅 Reschedule`, o `No call scheduled` con el botón `📅 Schedule`. Ambos abren la ventana de agendar (§5).
   - `Call Outcome`, `Drip Active` (interruptor: si el cliente recibe los correos automáticos de seguimiento).
   - `Origin Zip / Postal`, `Destination Zip / Postal`, `Move Timeline`, `Insurance Value`, `Referred By`.
   - Más abajo, con un subtítulo por grupo, los campos propios de cada servicio: `Relocation Tours` (`Party Size`, `Occupancy`, `Room Preference`, `Tour Duration`, `Tour Route`), `Immigration Advice` (`Nationality`, `Residency Pathway`, `Applicant Count`, `Residency Timeline`), `Legal Advice`, `Real Estate Assessment`, `Intercultural Coaching`.
5. **Tarjeta `📦 Shipping Details`** (datos de operaciones): celdas `Method`, `Service scope`, `Volume` (con `✓ confirmed` si ya se confirmó, o `(est.)` si es estimado), una línea de tiempo de fechas (empaque, carga, salida, llegada…), los correos de `Origin agent` y `Destination agent`, `Transit time`, `ETD confirmed`, `ETA confirmed`, y abajo `Logistics details` con campos editables. Si no hay nada: `No shipment milestones recorded yet — fill the logistics fields below, or use the Actions tab (confirm pickup details · start ETA loop).`
6. **`▸ Advanced fields (N total)`**: botón que despliega todos los datos crudos del cliente en acordeones, y `+ Add a new custom field` con dos campos `Field name (e.g. petPolicy)` y `Value` y el botón `Add`. Solo para casos especiales.
7. **`Call Transcript`**: la transcripción de la llamada (editable) o `No transcript`. Debajo, la caja `Paste Transcript` con un área `Paste transcript here...` y el botón `Save Transcript`: sirve para cargar a mano una transcripción. Con una transcripción cargada, el sistema ya no marca al cliente como No Show.

### 3.2 `🛣 Journey` — recorrido del cliente
- Arriba, `⏱ Time spent per column`: una barra/lista con cada etapa por la que pasó, cuánto tiempo estuvo y `Entered hace X`. La etapa actual tiene la marca `current`.
- Debajo, una **línea de tiempo** de eventos, el más reciente arriba. Cada evento tiene un ícono, un título y un subtítulo. Ejemplos: `Call rescheduled → Nov 28, 3:00 PM`, `Fields updated: budget, phone` `by marian`, `🧠 AI insights extracted`, `🛰 Gemini notes received`, `Note edited`, `Action — confirm pickup details`.
- Vacío: `No journey events yet`.

### 3.3 `📝 Insights` — lo que la IA sacó de la llamada
- Si hay análisis: una etiqueta `AI`, una ficha con el **modo de envío** (por ejemplo `📦 20 ft FCL`, `🏠🚗 40 ft — household + car`, `🧊 LCL (2–7 m³)`, `🚙 Car only — RoRo`), otra con el **nivel de empaque** (`👤 Self pack & load`, `👥 Self pack, crew loads`, `🛡️ Full pack & load`, `🚚 LCL — full service`, `🚗 Vehicle only`), un indicador `Confidence` en porcentaje, `Reasoning:` con la explicación, `Extracted facts` (datos sueltos que encontró) y al pie `Generated hace X · source: … · model: …`.
- Si hay transcripción pero no análisis: `Transcript ready — insights pending`.
- Si ya pasó la llamada pero no llegó la transcripción: `Waiting for Gemini meeting notes`.
- Si todavía no hubo llamada: `No call yet — no insights expected`.
- Siempre abajo: `Manual transcript paste (optional)` con un área de texto y el botón `🔄 Re-extract from transcript`.
- Al final, una tarjeta de **proveedores compatibles** (`Matching for: …`) con puntajes, y la nota `Provider contact is manual — review the matched vendors above, then send the quote request.`

### 3.4 `🌿 Lily` — asistente del CRM
Un chat. Arriba, `Lily — CRM Copilot` y la explicación `Ask Lily to summarize this project, draft a follow-up email, identify next steps, or answer any question about this client.` Hay botones de sugerencias rápidas y un área de texto al pie (`Ask Lily about this client… e.g. 'What dates were discussed?'…`) con botón de enviar.
Si le decís datos («Origin is Panama City, phone +1 502…»), Lily **no los guarda sola**: propone los cambios y aparece un botón `Review` en su mensaje; se abre un panel para aceptar o rechazar cada cambio.

### 3.5 `⚡ Actions` — acciones por etapa
- Arriba, siempre visible: una pastilla con la etapa actual del cliente, la cantidad de acciones (`2 actions`) y `Stage:` con un desplegable de etapas (por defecto la etapa actual). Si elegís otra, aparece `↔ cross-stage`.
- Debajo, una **tarjeta por acción**: el nombre en letra destacada y una descripción gris. Clic en la tarjeta la despliega (`▾`) y muestra sus campos (los obligatorios con `*`) y el botón `⚡ Execute Action` (mientras corre: `Executing…`).
- Etapa sin acciones: `No actions for this stage` / `Nothing to run in <etapa>. Pick another stage above, or move the client from the stage chip.`

Solo hay seis acciones, y todas cambian algo:

| Etapa | Acción | Qué hace |
|---|---|---|
| `Post Transcript` | `Review Transcript` | La IA lee la transcripción y llena `📝 Insights` |
| `Post Transcript` | `Assess Sales` | La IA evalúa cómo fue la conversación de venta |
| `Pricing Quote` | `Request Quote From Providers` | Lista los proveedores compatibles con el envío |
| `Loading` | `Confirm Pickup Details` | Guarda método, volumen y fechas de empaque y carga confirmados |
| `Exporting` | `Start Eta Loop` | Empieza a preguntarle al proveedor las fechas de salida y llegada |
| `Destination Arrival` | `Confirm Eta` | Guarda la llegada confirmada y avisa al cliente por correo |

### 3.6 `Conversations` — chats del cliente
Dos pastillas para elegir la fuente: `Consultation` (la conversación que tuvo con el asistente del sitio al pedir la consulta) y `Status Chat` (lo que habló con Lily en su portal; dice `none` si no hay). Un botón para recargar. Los mensajes se muestran como burbujas de chat, bajo el título `Session` o `Status Portal Chat`. Vacíos: `No HeroForm sessions found` / `No status-page chat yet`.

### 3.7 `Notes (N)` — notas del equipo
- Si hay avisos sin leer: un recuadro `🔔 Needs attention` con cada aviso y un botón para marcarlo como leído (`Mark as read`).
- Un área de texto `Write a note… (type @ to mention a teammate)`. Escribir `@` abre una lista de compañeros; la persona mencionada recibe un aviso. Debajo se pueden agregar destinatarios como fichas (cada una con `✕`). Botón para guardar (deshabilitado si está vacío: `Write the note first`).
- Debajo, las notas, la más nueva arriba: autor, hora, texto, `Sent to` con las personas avisadas, y `· edited` si se editó. Las propias tienen `✎` (editar → `Save` / `Cancel`) y `✕` (borrar → `Delete this note?` `Delete` / `Cancel`).
- Si el asistente del sitio dejó notas, aparecen con el autor `🤖 AI Assistant`.
- Vacío: `No notes yet.`

### 3.8 `Activity` — historial de cambios
Lista de quién cambió qué y cuándo, el más reciente arriba. Si lo último se puede deshacer, aparece el botón `Undo last` arriba y un `↩` en esa fila. Se pueden deshacer cambios de campos y de etapa; notas, correos y análisis de IA no. `Show N more` / `Show less` al final. Vacío: `No history yet.`

### 3.9 `Emails` — correos del cliente
Tres bloques, de arriba abajo:

1. **`💡 Suggested emails (N)`** (solo si hay): correos que el sistema propuso al mover de etapa. Cada uno dice `Suggested when moving to <etapa> · hace X · by <persona>` y tiene `👁 Preview & Send` y un botón para descartarlo (`Dismiss this suggestion without sending`).
2. **`📨 Sent emails (N)`**: los correos ya enviados. Clic en uno abre su vista previa. Algunos dicen `inferred` (`backfilled from stage history`): se sabe que salieron pero no hay copia. Vacío: `No emails sent yet.`
3. **`⏰ Scheduled drip emails (N)`** (solo si hay): correos automáticos programados, con el texto `These emails will send automatically unless you cancel or force-send them.` Cada uno tiene su hora (en rojo `overdue` si ya pasó) y dos botones: enviar ahora (`Send this email right now`) y cancelar (`Cancel — this email will not be sent`).
4. Al final, `Send a new email from a template:` con un desplegable `Choose email type…` (por ejemplo `Pre-Call Confirmation`, `No Show Follow-up`, `Quote Recap`, `Quote Check-in`, `📦 Provider Date Request (Ops)`, `🚢 Arrival Confirmation (Ops)`, `✅ ETA Confirmed → Client`, `👋 Follow-up — No Reply`) y el botón `👁 Preview & Send`.

## 4. Vista previa de un correo antes de enviarlo

Todo `Preview & Send` abre un **panel** con el título `Review before sending` y la marca `PREVIEW`. Muestra `To: <correo>` y tres modos: `👁 Preview` (solo lectura), `✏️ Edit` (editar directo sobre el correo, con barra de formato: negrita, cursiva, subrayado, listas, enlace, deshacer, `➕ Insert`) y `⚙ HTML`. Si se editó: `✍️ Edited by <persona>`. Al pie: `Cancel` y `📤 Send Email` (mientras envía: `Sending…`).

**Cuidado:** `📤 Send Email` le llega al cliente. Un agente se detiene en esta pantalla y pide confirmación.

Hacer clic en un correo ya enviado abre el mismo panel en modo lectura, con la fecha y fichas con la versión de plantilla.

## 5. Agendar o reagendar la llamada

`📅 Schedule` / `📅 Reschedule` abren una ventana. Al reagendar muestra `Current call` con la hora actual. Hay una sección `Attendees` para sumar a otra persona a la llamada y un selector de horarios disponibles. Al terminar: `Call Rescheduled!` con `🎥 Open Google Meet`, `📅 View Calendar Event` y `Done`. **Cuidado:** el cliente recibe una invitación de calendario.
