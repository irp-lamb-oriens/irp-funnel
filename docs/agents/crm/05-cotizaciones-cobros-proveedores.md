# 05 · Cotizaciones, cobros y pedidos a proveedores

Tres pestañas del panel del cliente (archivo 04): `💰 Quotes`, `🧾 Charges` y `📨 Providers`.

## 0. El recorrido de una cotización en una frase

Ventas pide precio (**Pricing Request**) → precios arma la cotización (**Draft**) → la envía a aprobar (**In review**) → un aprobador la aprueba (**Ready to send**) o pide cambios (**Changes requested**) → alguien la envía al cliente (**Sent to client**) → el cliente la acepta y firma en su portal (**Accepted ✓**) → se registran los pagos y se facturan.

Cada estado se ve como una **pastilla de color** junto al título de la cotización:

| Pastilla | Color | Significa |
|---|---|---|
| `Draft` | gris | Borrador, nadie más la vio |
| `In review` | ámbar | Esperando que un aprobador la revise |
| `Changes requested` | rojo | El aprobador pidió cambios; hay comentarios |
| `Ready to send` | ámbar | Aprobada; se puede enviar al cliente |
| `Sent to client` | azul | El cliente la puede ver en su portal |
| `Accepted ✓` | verde | El cliente la aceptó y firmó el contrato |

## 1. Pestaña `💰 Quotes`

De arriba abajo:

### 1.1 Aviso de movimiento bloqueado (a veces)
Si hace poco se intentó mover a este cliente a una etapa con requisitos no cumplidos, aparece arriba una franja roja `Can't move to “<etapa>” yet` con la lista de lo que falta y una `✕`.

### 1.2 `Pricing Requests` — pedido de precio al equipo de precios
- Título `Pricing Requests` y el botón `+ New Pricing Request`. Texto: `Author a shipment request and send it to the pricing desk. Each request is numbered and keeps its options for reference.`
- Al crear uno se abre un borrador con la marca `Request #N · Draft`:
  - `Origin`: campo `City, ST ZIP, Country` y notas opcionales.
  - `Destination`: campo `City, ZIP, Country` y notas opcionales.
  - Una o más **opciones** (`Option 1`, `Option 2`…), cada una con `Service (AI-suggested placeholder — editable)` (ejemplo: `20 ft Container (up to 28 m³) – Door-to-Door – Full Professional Packing`) y `Include (one line per item)` (ejemplo: `Loading`, `Export customs clearance`, `Ocean freight`…). Cada opción tiene `✕` para quitarla. `+ Create Option` agrega otra.
  - El borrador se guarda solo mientras escribís.
  - Botones `Discard` y `Request Quote →` (envía el pedido al equipo de precios; mientras tanto `Sending…`).
- Los pedidos ya enviados quedan listados como `Request N` con la marca `Sent`; clic para desplegar su contenido.

### 1.3 `Proposal template`
Un selector `Choose the template this client sees…` con la plantilla del documento de propuesta. Se elige sola según el país de destino; se puede cambiar. Un botón al lado vuelve a detectarla (`Re-detect from the destination → template mapping`).

### 1.4 Lista de cotizaciones
- Título `Quotes` y el botón `New Quote +` (abre el editor, §2).
- Vacía: `No quotes yet` / `Create the first quote for this client.`
- Cada cotización es una fila clicable con:
  - Título (o `Untitled`) y la pastilla de estado.
  - Total, `✓ <opción elegida>` si el cliente ya eligió (`The option the client accepted. Invoices bill this one.`), cantidad de líneas (`5 line items`) y fecha.
  - Si está enviada o aceptada: una fila con un globito, el enlace `internationalrelocationpartner.com/status/<id>` (abre el portal del cliente), un botón para copiar solo el enlace y `Copy context` (copia enlace + resumen completo; cambia a `Copied`).
  - Si está aceptada, además: `Create invoice` y `Contract PDF` (descarga el contrato firmado).
  - A la derecha: `✏️` editar, `⧉` duplicar, `🗑️` borrar.
- Si alguna está aceptada, aparece el bloque **`Payments`** (§1.5).

### 1.5 Bloque `Payments` (cotización aceptada)
Una tarjeta por cotización aceptada con `Accepted <fecha>` y una pastilla de estado de pago. Puede decir `Online payments off` o `Test mode`.
- Una **barra segmentada** de colores: cada segmento es un tramo del plan de pagos (por ejemplo reserva 30 %, resto 70 %), coloreado según esté pagado, en camino o pendiente.
- Cifras: `Agreed`, `Received` (verde), `On its way` (si hay), `Left to pay`, y si hubo comisiones `Fees we paid` y `What we kept`.
- Lista de pagos en línea, cada uno con su estado y un enlace `Stripe ↗`.
- Botón **`Confirm money that arrived`**: para transferencias, Zelle, cheques o efectivo. Abre un formulario: `Amount that landed (USD)`, `Date received`, método (`Bank wire`, `ACH transfer`, `Zelle`, `Check`, `Cash`, `Other`), `Reference` (`Bank confirmation #`), `Bank fees deducted`, quién cubre la comisión (`IRP absorbs it…` / `Client still owes it…`), la casilla `Email the client a payment confirmation`, y `Cancel` / confirmar. Si el monto supera lo que falta, avisa `That is more than the … left to pay` y pide marcar una casilla para confirmar.

**Cuidado:** confirmar un pago lo registra en finanzas y, con la casilla marcada, le manda un correo al cliente. Solo con datos que la persona te dio.

## 2. Editor de cotización

Se abre dentro de la misma pestaña con el título `New Quote` o `Edit Quote`.

- **Aviso de cotización aceptada** (si aplica): dice cuándo se aceptó, `Option chosen: …` y `Agreed total: …`, y explica que precios y opciones están bloqueados; título, descripción, notas y plan de pagos todavía se pueden cambiar. Para cambiar el precio hay que crear otra cotización.
- `✎ Unsaved draft restored` con `Discard draft`, si quedó un borrador sin guardar.
- **`Title *`**: se propone solo a partir de la mudanza (`✦ Auto-composed from the client's move details — edit freely.`).
- **`Service type`**: desplegable `— Select service type —`; obligatorio (`⚠ Service type is required before saving this quote.`). Un botón al lado administra tipos propios.
- **`Default margin %`**: margen que se aplica a cada línea nueva.
- **`Quote line items`**: un botón para agregar plantillas de líneas guardadas y otro para administrarlas. Las líneas se organizan en **grupos**. Cada grupo es un recuadro con:
  - Selector de etiqueta (`— No label —`, con `⚙` para administrar etiquetas) y un nombre (`Group 1 name (e.g. Standard package)`).
  - Tres botones de rol: **`Required`** (el cliente elige uno de estos paquetes), **`Optional`** (un adicional que el cliente puede marcar) y **`🔒 Fixed`** (siempre se cobra; no se muestra como opción).
  - Números del grupo: `Cost`, `Client`, `Margin`. `✕` para quitar el grupo.
  - `Service description` con la marca `client-visible`: lo que el cliente lee bajo esa opción.
  - Una tabla con columnas `Description`, `Cost`, `Margin %` (con un botón para alternar entre % y monto fijo), `Client price`, `Currency` (`USD`, `EUR`, `MXN`, `CRC`), `Provider` (`＋ Provider` para buscar y asociar un proveedor) y `Notes`. Cada fila tiene `⋮⋮` para arrastrarla a otro grupo y `✕` para quitarla.
  - `+ Add line` agrega una fila. Grupo vacío: `Drag a line here, or add a new one`.
  - `✚ Add optional add-on group` agrega un grupo opcional.
- **Resumen de precios**: si hay opciones, una tabla `Option` / `Cost` / `Client price` / `Earnings` y el texto `The client picks; the total is set when they accept.` Si no, tres cifras: `Cost subtotal` (`IRP pays`), `Client total` (`Client pays`), `Earnings` (`IRP margin`).
- **`Payment schedule`** (`contract · finance`): tramos en porcentaje, con `+ Add segment` y `Total: 100%`. El primero es la reserva. No puede pasar de 100 %.
- **`Client description`** (`client-visible`) con `✨ Generate with AI` (solo después de guardar una vez). Lo que el cliente ve; nunca se le muestran proveedores, costos ni márgenes.
- **`Internal note`**: solo para el equipo.
- **Bloque de estado y aprobación** (cotización ya guardada): `Status:` con la pastilla, y según el estado:
  - `Draft` o `Changes requested`: `Note for approvers (optional)` y **`📨 Submit for approval`**.
  - `In review`, y quien mira es aprobador: `You're an approver — you can approve or request changes:` con **`✅ Approve quote`**, **`✍️ Approve with edits`** (guarda tus cambios y aprueba) y **`✏️ Request changes`** (abre un área `Describe what changes are needed...` y `Submit change request`).
  - `Ready to send`: **`📤 Send quote to client`**.
  - `Sent to client`: la marca `📨 Sent to client`, la fecha y `Client link:` con el enlace al portal.
  - Si el cliente aceptó: `Service agreement` / `Signed by <nombre> on <fecha>`.
- **`Comments`**: comentarios internos de la cotización con `Mark as resolved`, y un campo `Add a comment...`.
- **`Change history (N)`**: desplegable con todos los cambios.
- **Pie**: `💾 Save draft` (o `💾 Save text & schedule` si está aceptada), `💾📨 Save & submit for approval` (en borrador) y `Cancel`.

**Cuidado:** `📤 Send quote to client` le manda al cliente un correo con el enlace a su portal. Pedí confirmación.

## 3. Pestaña `🧾 Charges`

Título `Charges` y `Everything this client has been billed, and what is still owed.`
- Vacía: `No charges yet. Create an invoice from the Quotes tab, or from Finance for work that was never quoted.`
- Cuatro cifras: `Charged`, `Received`, `Balance due`, `Quoted, not billed`.
- `Quote reconciliation`: por cotización, una barra con el porcentaje facturado, `Quote total`, `Invoiced`, `Remaining` y `Never invoiced (N)` con las líneas que faltan, o `Every quoted line has been invoiced.`
- Tabla de facturas: `Invoice`, `Source` (`Quote · #1 30%` o `Custom`), `Issued`, `Total`, `Received`, `Balance`, `Status`, `Paid` (casilla `Mark this charge paid in full`) y un enlace `PDF`. Clic en una fila muestra `Payments received` con fecha, método, monto y nota.

## 4. Pestaña `📨 Providers` — pedir tarifas a proveedores (RFQ)

Título `📨 Request rates from providers`. Explica que se arma un pedido traducido con los datos del cliente y que `support2@` y `pricing2@` van en copia.
- Fichas de código postal: `📍 Origin <código>` y `🎯 Destination <código>`, o `⚠ Origin postal code missing` en ámbar.
- `Providers to email`: fichas de los proveedores elegidos (con `no email` si no tienen correo, y `✕`). Si no hay: `No providers selected yet — search below to add some.`
- Buscador: `From (origin)` (`e.g. Spain`), `To (destination)` (`e.g. Costa Rica`), `Search providers by name or email…`. Cada resultado muestra regiones `From:`/`To:` y estrellas. Clic para agregarlo.
- `Language`: botón `🌐 <idioma>` con la marca `recommended`. Si cambiás de idioma después de editar, pregunta qué hacer con tus cambios (`Keep text as-is` / `Reset to template` / `Cancel`).
- `Template fields`: datos que se completan en la plantilla, con `complete ✓` o la cantidad que falta.
- El cuerpo del correo con modos de vista previa, edición y HTML.
- Pie: `Select at least one provider with an email.`, `N template field(s) missing.` o `Ready to send to N provider(s).`, y el botón **`Send RFQ (N)`**.

**Cuidado:** `Send RFQ` manda correos a proveedores externos.

### 4.1 `📥 Provider responses` (debajo, en la misma pestaña)
Las tarifas que respondieron los proveedores. Arriba: `N new` si hay respuestas sin revisar, y `Expected margin` (el margen esperado; las tarifas que lo rompen quedan marcadas). Una tabla `Provider` / `Rate` / `Effective` (precio ponderado por puntaje del proveedor; el más bajo gana) / `Min. client price` (precio mínimo al cliente para llegar al margen) / `Flags`. Un punto marca las no revisadas. Cada tarifa se puede corregir (`Save` / `Cancel`) sin perder la original, que queda como `vendor said …`. Sin pedidos: `No RFQs have been sent for this client yet.`
