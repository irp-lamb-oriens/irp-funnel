# 06 · Crear, exportar e importar clientes

## 1. Cómo llegan los clientes normalmente

La mayoría de los clientes **entran solos**, sin que nadie del equipo haga nada:
- Llenan el formulario del sitio o conversan con el asistente → aparecen en `Opt-In Email`.
- Reservan la llamada de consulta → pasan solos a `Pre-Consultation`.
- Descargan una guía de país → aparecen con la etiqueta `🌍 Guide Lead`.
- Llegan por el enlace de un socio → quedan acreditados a ese socio (vista `Partners`).

El alta manual de este archivo es para clientes que llegan por otro lado (teléfono, WhatsApp, referencia directa).

## 2. Alta manual: botón `New Client`

Botón `New Client` en la barra superior (ícono de dos personitas con un «+»). Se abre una ventana centrada `Add New Client` con una `✕` arriba a la derecha. Tiene varios pasos:

### 2.1 Dictado (primer paso)
- Título `New Client` y el texto `Speak — AI transcribes directly into the pad`.
- Un **círculo grande** (botón de grabar) con ondas animadas. Al grabar aparece `● Recording` y el círculo dice `Stop`.
- Debajo, un área de texto donde aparece lo dictado (`Speak naturally…`). Se puede corregir a mano.
- Enlaces `✏️ Type manually instead` / `✏️ Skip — type manually` para no usar el micrófono.
- Cuando hay texto: `✅ Ready — edit, add more, or structure with AI` y el botón **`Structure with AI`**.
- Mientras procesa: `Transcribing…` / `Structuring your client…` (`Reading between the lines`).

**Para un agente:** usá `✏️ Skip — type manually` y completá el formulario directamente.

### 2.2 Revisión (`Check the details, then create`)
Arriba dice cuántos campos completó la IA (`✨ AI filled 6 fields`), o `Fill in what you know…`. Los campos completados por la IA están resaltados: revisalos. Hay cuatro bloques numerados:

1. **`Client details`**: `First Name` (`John`), `Surname` (`Smith`), **`Email *`** (único obligatorio), `Phone`, `Origin Country`, `Origin City`, `Destination Country`, `Destination City`, `Budget` (lista: `Under $5k`, `$5-10k`, `$10-15k`, `$15-20k`, `$20-30k`, `Over $30k`), `Move Size` (`LCL / Partial`, `20ft container`, `40ft container`), `Immigration Status`, `Notes`. `Add a field` muestra campos extra ocultos.
2. **`Anything else worth recording (optional)`**: pares `Field name` / `Value` (ejemplo «Pets» → «2 dogs»), `+ Add a custom field`.
3. **`Other people on the call (optional)`**: correos de otras personas para invitar a la llamada; `+ Add another person`.
4. **`Book the consultation call (optional)`**: un selector de horarios libres. Al elegir uno aparece `✓ Thu, Nov 28, 3:00 PM (CR time)`. Las horas están en hora de Costa Rica.

Botón final: **`Create Client`**, o **`Create Client + Book Call`** si se eligió horario. Deshabilitado sin correo (`Add the client’s email first`). Si ya existe un cliente con ese correo, da error.

### 2.3 Resultado
- Con llamada: `Client Created + Call Booked!`, con `🎥 Open Google Meet`, `📅 View Calendar Event` y `Done — Open Client Card`. El cliente queda en `Pre-Consultation`.
- Sin llamada: el cliente queda en `Opt-In Email` y se abre su panel.
- Si el horario ya estaba tomado: `⚠️ Client created — but the selected time slot was already taken. Schedule a call from the client card.`

**Cuidado:** agendar la llamada le manda una invitación de calendario al cliente.

## 3. Exportar (`⬇ Export`)

En la barra de filtros de Board o List. Ventana `Export clients to JSON`:
- Alcance: `Current view` (`Respects your active filters & search`) o `All clients` (`Full CRM snapshot`).
- Contenido: `Full records` (todo, re-importable) o `Contact list` (`Ref., name, email and phone only. For labeling WhatsApp groups.`).
- `Cancel` y `⬇ Download N records`. Al terminar: `Export downloaded` y `Done`.

## 4. Importar (`⬆ Import`)

Ventana `Import clients from JSON`. Dice que los campos se validan contra la configuración y que nunca se rechaza nada ni se borra nada.
1. Soltar un archivo `.json` en el recuadro, `Choose file`, o pegar el JSON en el área de texto. Botón `Check records →`.
2. Revisión: una tabla `Record` / `Status` / `Notes` / `On duplicate`. Cada registro tiene una pastilla `New`, `Duplicate` o `Unusable`, y avisos como `⚠ Missing: email` o `✓ Looks good`. Para duplicados se elige qué hacer en `On duplicate`.
3. `← Back` o `Import N records`. Mientras escribe: `Writing to the database…`. Al final: `Import complete` con `Created`, `Updated`, `Skipped` y `Errors`.

**Cuidado:** importar modifica clientes reales. Solo con un archivo que la persona te dio y después de mostrarle la revisión.
