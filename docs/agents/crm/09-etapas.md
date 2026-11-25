# 09 · Etapas por defecto

Cada etapa es una columna del Board. Nombres, íconos, colores, descripciones y plazos se cambian en `Automations` → `🗂️ Stages & rules`; si la pantalla muestra algo distinto, manda la pantalla.

**Plazo (SLA):** días que un cliente puede quedarse en la columna antes de marcarse atrasado (borde ámbar que late, `⚠ N` en el encabezado, `⏰` en rojo). «—» = sin plazo, nunca se marca atrasado.

**Se mueve sola:** cuándo el sistema pone a un cliente en esa columna sin que nadie lo arrastre.

## Ventas (violetas e índigos)

| Ícono | Nombre en pantalla | Para qué es | Plazo | Se mueve sola |
|---|---|---|---|---|
| 📧 | `Opt-In Email` | Lead captado; se le mandó el correo de bienvenida; todavía no reservó llamada | — | Al entrar un lead nuevo (formulario, asistente, alta manual sin llamada) |
| 📅 | `Pre-Consultation` | Llamada de consulta reservada, esperando que ocurra | — | Cuando el cliente reserva la llamada estando en `Opt-In Email`, o al crearlo con llamada |
| 👻 | `No Show` | No se presentó a la llamada | — | 24 h después de la hora de la llamada, si sigue en `Pre-Consultation` y no hay transcripción ni resultado de llamada |
| 🚷 | `Non Qualified` | No es un cliente para nosotros. Estacionado | — | No |
| 📝 | `Post Transcript` | Llamada hecha; revisando la transcripción antes de cotizar | 2 | Cuando llega la transcripción de Google Meet estando en `Pre-Consultation` |
| 💰 | `Pricing Quote` | Armando la cotización | 2 | Cuando la IA, al leer la transcripción, concluye que hace falta cotizar (solo desde columnas anteriores). Al entrar se avisa al equipo de precios |
| 📋 | `Quoted` | Cotización enviada; esperando respuesta del cliente | 3 | Al enviar una cotización al cliente estando en `Pricing Quote`, o cuando se arma a partir de una oferta confirmada de un proveedor |
| ✅ | `Quote Acceptance` | El cliente aceptó; preparando el primer pago | 2 | Cuando el cliente acepta en su portal (solo si estaba en `Pricing Quote` o `Quoted`) |
| 💳 | `Initial Payment` | Primer pago recibido: venta ganada, pasa a operaciones | 3 | Cuando entra un pago (Stripe o confirmado a mano) estando en `Quote Acceptance`. Arrastrarla aquí desde `Quote Acceptance` también registra el pago |
| 💔 | `Sale Dropped` | La venta no se cerró. Estado final interno | — | No |

## Operaciones en origen (azules)

| Ícono | Nombre | Para qué es | Plazo |
|---|---|---|---|
| 📦 | `Self Packing` | El cliente empaca solo | 7 |
| 📋 | `Full Packing` | Nuestro equipo empaca todo | 5 |
| 🏗️ | `Loading` | Cargando lo empacado | 3 |
| 🚛 | `Container` | Consolidado en el contenedor | 4 |
| 🚢 | `Exporting` | Exportación y aduana en origen | 7 |

## Operaciones en destino: redestinación (naranjas y ámbar)

| Ícono | Nombre | Para qué es | Plazo |
|---|---|---|---|
| 🛬 | `Destination Arrival` | Llegó al puerto o país de destino | 14 |
| 🏭 | `Redestination` | Coordinando el traslado al destino final | 7 |
| 🚚 | `Container → Fiscal Warehouse` | Llevando el contenedor al almacén fiscal | 5 |
| 📤 | `Container Unloading` | Descargando en el almacén | 4 |
| 🧮 | `Tax Calculation` | Calculando impuestos de importación | 5 |
| 🧾 | `Destination Costs Invoice` | Facturando al cliente los costos de destino | 4 |

## Operaciones en destino: importación y entrega (verdes azulados y verdes)

| Ícono | Nombre | Para qué es | Plazo |
|---|---|---|---|
| 🛃 | `Import` | Trámite de importación en curso | 7 |
| 📑 | `DUA Customs` | Declaración aduanera DUA | 7 |
| 🔖 | `Import Procedure` | Completando el trámite formal | 7 |
| 🔍 | `Customs Inspection` | Inspección de aduana | 5 |
| 📞 | `Delivery Coordination` | Coordinando la entrega con el cliente | 4 |
| 🚛 | `Delivery` | Entregando en el domicilio | 3 |
| 📋 | `Proof of Delivery (POD)` | Recolectando la constancia de entrega | 3 |
| 🛡️ | `Insurance Claim` | Reclamo de seguro por daños o pérdidas | 14 |

## Cierre

| Ícono | Nombre | Para qué es | Plazo |
|---|---|---|---|
| 🎉 | `Operations Done` | Operaciones terminadas | 5 |
| 💸 | `Refunds` | Procesando un reembolso | 7 |
| 🏁 | `Completed` | Mudanza cerrada | — |

Las columnas de operaciones y cierre no se mueven solas: el equipo de operaciones las avanza a mano.

## Etapas ocultas

`Feedback A`, `Feedback B` y `Feedback C` existen pero están ocultas: sus correos de opinión ahora salen solos desde la etapa anterior. Si alguna vez ves una de esas columnas al final del Board, es porque quedó un cliente viejo ahí; avisale a la persona.
