# 08 · Procedimientos del día a día

Recetas paso a paso, con lo que se ve en pantalla en cada paso. Los detalles de cada pantalla están en los archivos 01 a 07. Este archivo describe lo que el sistema permite y hace solo; si el equipo acordó otra costumbre (por ejemplo quién envía las cotizaciones), seguí la costumbre y avisá para corregir este archivo.

---

## A. Entra un lead

### A.1 Cómo llega
No hay que cargarlo: el sitio lo crea solo.
1. Aparece una tarjeta nueva en la columna `📧 Opt-In Email`, con nombre, ruta y presupuesto si los dio. Si vino de una guía de país, tiene `🌍 Guide Lead`.
2. Si reserva la llamada, la tarjeta pasa sola a `📅 Pre-Consultation` y muestra la fecha de la llamada.

Si el lead llegó por teléfono o WhatsApp, cargalo a mano con `New Client` (archivo 06, §2). Antes, buscalo por correo en el buscador de arriba con **Enter** para no duplicarlo.

### A.2 Quién se ocupa
El CRM **no tiene un campo de responsable**. La responsabilidad sale de la etapa: las columnas de ventas son de ventas, `Pricing Quote` es del equipo de precios, y las de operaciones son de operaciones. Para pasarle un cliente a alguien en particular:
1. Abrí el cliente → pestaña `Notes (N)`.
2. Escribí la nota y mencioná a la persona con `@` (aparece una lista de compañeros; elegí uno).
3. Guardá. La persona recibe un aviso y lo ve en `🔔 Needs attention` dentro de esa ficha.

Para que un cliente quede arriba de su columna: control de prioridad de la tarjeta → `⤒ Send to top` (archivo 02, §5).

---

## B. Mover un cliente de etapa

### B.1 Cómo
1. Abrí el cliente (clic en la tarjeta).
2. Clic en la pastilla de color bajo el nombre (por ejemplo `📅 Pre-Consultation ▾`).
3. Escribí parte del nombre de la etapa en `Search stage…` y elegila.
4. Comprobá que la pastilla cambió de color y nombre. Si aparece la pastilla roja `🚫 Move to “…” blocked`, mirá qué falta (archivo 02, §6.2).

### B.2 Cuándo mover (ventas)
| De | A | Cuándo | ¿Lo hace solo? |
|---|---|---|---|
| `Opt-In Email` | `Pre-Consultation` | El cliente reservó la llamada | Sí |
| `Pre-Consultation` | `Post Transcript` | Terminó la llamada | Sí, cuando llega la transcripción de Google Meet. Si la llamada no se grabó, pegá la transcripción (`Overview` → `Paste Transcript`) y movelo a mano |
| `Pre-Consultation` | `No Show` | No se presentó | Sí, 24 h después de la hora de la llamada, solo si no hay transcripción ni resultado de llamada |
| `Post Transcript` | `Pricing Quote` | Hay que cotizar | A veces: la IA lo hace al leer la transcripción. Si no, a mano. Al entrar se avisa a precios |
| cualquiera de ventas | `Non Qualified` | No es un cliente para nosotros | No |
| `Pricing Quote` | `Quoted` | Se le envió la cotización al cliente | Sí, al apretar `📤 Send quote to client`, o cuando la cotización sale de una oferta confirmada de proveedor |
| `Quoted` | `Quote Acceptance` | El cliente aceptó en su portal | Sí |
| `Quote Acceptance` | `Initial Payment` | Entró el primer pago | Sí si pagó en línea o se confirmó con `Confirm money that arrived`. Arrastrar a mano también registra el pago: **solo si el dinero llegó** |
| `Quoted` / `Quote Acceptance` | `Sale Dropped` | El cliente no siguió | No |

Importante: el cliente **solo puede aceptar** la cotización en su portal si está en `Pricing Quote` o `Quoted`. Si lo moviste a otra etapa antes, la aceptación falla.

### B.3 Cuándo mover (operaciones)
Siempre a mano, en el orden de las columnas, a medida que pasa cada hito (empaque → carga → contenedor → exportación → llegada → … → entrega → constancia → `Operations Done` → `Completed`). Saltá las que no aplican (por ejemplo, si el cliente empaca solo, `Self Packing` en vez de `Full Packing`). Ver sección D.

### B.4 Señales de que algo está quieto
- Tarjeta con borde ámbar que late y `⏰` en rojo: pasó el plazo de la etapa (archivo 09).
- `❌ Transcript`: ya pasó la llamada y falta la transcripción. Cargala en `Overview` → `Paste Transcript`, o esperá a que llegue sola de Google Meet.
- Circulito turquesa con número: hay tareas pendientes (correos sugeridos, comentarios del cliente, menciones).

### B.5 Correos que salen solos al mover de etapa
Algunas etapas mandan un correo al cliente sin que nadie apriete enviar. Es a propósito: reemplazan a las antiguas columnas de opinión (Feedback A, B y C). Las reglas de fábrica son:

| Al entrar a | Correo | Cuándo sale |
|---|---|---|
| `Post Transcript` | `Nurture: Feedback` | 24 h después, y solo si la IA detectó que el cliente estuvo en la llamada |
| `Exporting` | `Mid-Ops Check-in` | En el momento |
| `Operations Done` | `Nurture: Final Feedback` | En el momento |

Las reglas se ven y se cambian en `Automations` → `🗂️ Stages & rules`, debajo de cada etapa. Si una etapa que no está en la tabla manda correo (por ejemplo `Destination Arrival`), alguien agregó esa regla ahí.

Las demás etapas solo **sugieren** correos: aparecen en `Emails` → `💡 Suggested emails` y no salen hasta que alguien las envía.

---

## C. Cotizar y enviar la cotización

### C.1 Quién hace qué
| Paso | Quién | Dónde |
|---|---|---|
| Pedir precio | Ventas (quien hizo la llamada) | `💰 Quotes` → `+ New Pricing Request` → `Request Quote →`, o `Overview` → `Preview & Send to Pricing` |
| Pedir tarifas a proveedores | Precios | `📨 Providers` → `Send RFQ (N)` |
| Armar la cotización | Precios (`pricing@`, Marian) | `💰 Quotes` → `New Quote +` |
| Aprobar | Aprobadores: por defecto Marian, Pablo y Luis Armando (se cambia en `Automations` → `✅ Quote approvers`) | Editor de la cotización |
| Enviar al cliente | Cualquiera con acceso al cliente, una vez aprobada | Editor → `📤 Send quote to client` |

### C.2 Paso a paso
1. **Ventas pide precio.** Después de la llamada, con el cliente en `Post Transcript` o `Pricing Quote`: `💰 Quotes` → `+ New Pricing Request`. Completá `Origin`, `Destination` y al menos una opción (servicio + qué incluye). `Request Quote →`. El pedido queda como `Request 1` con la marca `Sent`.
2. **Precios pide tarifas** (si hace falta): `📨 Providers` → buscá y agregá proveedores → revisá idioma y campos → `Send RFQ (N)`. Las respuestas aparecen más abajo, en `📥 Provider responses`, ordenadas por precio efectivo. Esos montos son los `Cost` de las líneas de la cotización.
3. **Precios arma la cotización**: `New Quote +`.
   - `Title` (se propone solo) y `Service type` (obligatorio).
   - Un grupo por paquete. Si el cliente debe elegir entre paquetes, marcalos `Required`; los extras, `Optional`; lo que se cobra siempre, `🔒 Fixed`.
   - En cada línea: `Description`, `Cost` (lo que cobra el proveedor), `Margin %`; el `Client price` se calcula. Asociá el proveedor con `＋ Provider`.
   - `Service description` de cada grupo y `Client description` (o `✨ Generate with AI` después de guardar una vez): es lo que lee el cliente.
   - `Payment schedule`: por ejemplo 50 % / 50 %. El primero es la reserva.
   - `💾📨 Save & submit for approval`. La pastilla pasa a `In review` y los aprobadores reciben un correo.
4. **Un aprobador revisa**: abre la cotización (pastilla ámbar `In review`). Ve `You're an approver…` y elige `✅ Approve quote`, `✍️ Approve with edits` o `✏️ Request changes` (escribe qué cambiar → `Submit change request`). Si pide cambios, la pastilla queda roja `Changes requested`; precios corrige y vuelve al paso 3.
5. **Enviar al cliente**: con la pastilla `Ready to send`, `📤 Send quote to client`. El cliente recibe un correo con el enlace a su portal. La pastilla pasa a azul `Sent to client`, aparece el enlace `…/status/<id>` con `Copy context`, y el cliente pasa solo de `Pricing Quote` a `Quoted`.
6. **El cliente acepta** en su portal: elige opción, firma. El cliente pasa solo a `Quote Acceptance`, la pastilla se vuelve verde `Accepted ✓`, aparecen `Create invoice`, `Contract PDF` y el bloque `Payments`.
7. **Cobro**: si paga en línea, se registra solo. Si transfiere, `Confirm money that arrived` con el monto y la fecha que da la persona. Ese botón está en `💰 Quotes`, en el bloque `Payments`, que solo aparece cuando hay una cotización aceptada. El primer pago lo pasa a `Initial Payment`.

Para cambiar el precio de una cotización ya aceptada no se edita: se crea otra (`⧉` duplicar sirve de base).

---

## D. Operaciones: cuando arranca una mudanza

El disparador es que el cliente llegue a `💳 Initial Payment`. A partir de ahí:

1. **Revisar el acuerdo.** En `💰 Quotes`, abrí la cotización aceptada: opción elegida (`✓ …`), servicios incluidos y plan de pagos. `Contract PDF` descarga el contrato firmado.
2. **Mover a la primera etapa de origen**: `📦 Self Packing` si el cliente empaca, `📋 Full Packing` si empaca nuestro equipo.
3. **Cargar los datos de envío** en `Overview` → tarjeta `📦 Shipping Details` → `Logistics details`.
4. **En `🏗️ Loading`**:
   - `⚡ Actions` → `Confirm Pickup Details`: método de envío confirmado, volumen en m³, fecha de empaque y fecha de carga. Pisa las estimaciones de ventas y alimenta los correos siguientes.
   - Para pedirle fechas al proveedor: `Emails` → `Choose email type…` → `Provider Date Request` → `👁 Preview & Send`.
5. **`🚛 Container`** cuando está consolidado.
6. **En `🚢 Exporting`** → `⚡ Actions` → `Start Eta Loop`: correo del agente de origen, fecha estimada de salida (ETD), método y volumen. Desde ahí el sistema le pregunta al proveedor por fechas cada 7 días (marítimo) o cada día (aéreo/terrestre). En `📦 Shipping Details` aparece el estado del seguimiento.
7. **En `🛬 Destination Arrival`** → `⚡ Actions` → `Confirm Eta`: ETA confirmada, días de tránsito y correo del agente de destino. Detiene las preguntas automáticas y le manda al cliente el correo `ETA Confirmed to Client`.
8. **Destino, importación y entrega**: avanzar columna por columna. Costos de destino o extras no cotizados se facturan desde `Finance` → `Invoices` y quedan en la pestaña `🧾 Charges`.
9. **`📋 Proof of Delivery (POD)`** al recibir la constancia; `🛡️ Insurance Claim` solo si hay reclamo.
10. **`🎉 Operations Done`** y luego **`🏁 Completed`**. Revisá en `🧾 Charges` que `Balance due` esté en cero.

En cada etapa, mirá `Emails` → `💡 Suggested emails`: el sistema propone los correos de esa etapa, pero no los envía solo. Las etapas que no aparecen arriba no tienen acciones en `⚡ Actions`: se avanzan moviendo al cliente de columna.
