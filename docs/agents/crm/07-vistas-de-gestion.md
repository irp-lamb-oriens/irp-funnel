# 07 · Vistas de gestión

Las pestañas de la barra superior aparte de `Board` y `List`. La mayoría solo las ven administradores (archivo 01, §5). Todas comparten un estilo: un título grande arriba a la izquierda, a veces una barra de controles que queda fija al bajar, y secciones con un título y una frase gris de explicación. Muchos números tienen un `ⓘ` pequeño: al pasar el mouse explica qué mide.

---

## `Metrics`

**Para qué:** ver cómo vienen los leads, las llamadas y las ventas.

- Título `Metrics` y el subtítulo `What works, what doesn't, and why · Costa Rica time · updated …`.
- **Barra de controles fija**: `Period` (desplegable; con `custom` aparecen `From` y `To` por mes), `Compare to` (`Previous period`, `Same months last year`, `No comparison`), `Currency`, `Filters` (fichas con `×`; un botón agrega filtros), `↶ Undo`, `Clear all`, y un interruptor para mostrar u ocultar registros de prueba.
- **Índice de secciones**: enlaces horizontales que bajan a cada sección; la actual queda marcada.
- Secciones, en orden:
  - **Pulse**: tarjetas grandes con las cifras principales y una mini-gráfica cada una. Un selector arriba elige qué cifras ver.
  - `What's working · what isn't`: segmentos que convierten mucho mejor o peor que el resto. Los clientes nombrados se abren con un clic.
  - `Growth` (volumen y valor por mes; clic en un mes lo filtra), `Segments`, `Funnel by segment`, `Marketing` (fuentes de tráfico), `Sales velocity` (cuánto tarda cada paso), `Explorer` (cualquier medida por una o dos dimensiones).
  - `Data notes:` al pie, con enlace a la salud de datos del Sales Report.
- Más abajo, un desplegable `Operations, AI cost & raw data`: `Pipeline Overview`, llamadas, cotizaciones, `Stage Satisfaction`, `Call Outcomes` (`Qualified`, `Nurture`, `No Show`), `Email Queue` (`Pending`, `Sent`, `Failed`), gasto en IA por período, proveedor y modelo, `✅ Internal Quote Approval Decisions` y un `Raw data explorer`.
- Sin datos: `No leads in <período>` con botones `Last 12 months` y `Clear filters`.

## `Finance`

**Para qué:** cuánto prometen las cotizaciones, cuánto entró y cuánto se debe.

- Título `Finance`, un indicador de estado de carga y `Currency` (código de tres letras; no convierte monedas).
- Sub-pestañas: `Quotes`, `Money in and out`, `Invoices`, `Online payments`, `Payment log`, `Configuration`.
- `Quotes` (la primera): `Where the quotes stand` (tres grupos con ingreso, `Provider cost`, `Margin`, `Quotes`, `Average quote`), `Win rate` (`Of the quotes a client actually saw`, con `Accepted` y `Sent to a client`), `Typical days to close`, `Accepted quotes by month` (tabla `Month`/`Revenue`/`Provider cost`/`Margin`/`Margin %`/`Quotes`), `Where accepted revenue comes from` (barras) y `Left out of the totals` (por qué un número puede verse bajo).
- `Invoices`: facturas a clientes. `Online payments`: pagos con tarjeta o banco vía Stripe, con un panel de lo que necesita atención. `Payment log`: cada evento de pago en orden.
- Primera carga: `Reading the quotes…`. Vacío: `No finance figures yet` con `Refresh`.

## `Sales Report`

**Para qué:** el libro de ventas: lo vendido, lo cobrado y lo que falta cobrar.

- Título `Sales book` y `Every sale in the database · the period is a lens, not a filter · Costa Rica time`.
- Barra de controles como Metrics (`Period`, `Year`, `Compare to`, `Currency`, `Filters`, `↶ Undo`, `Clear all`, registros de prueba).
- `Needs action`: botones con problemas a resolver (por ejemplo `3 data issues`) o `Nothing needs action.`
- Índice de secciones y, en pantallas chicas, un desplegable para saltar.
- Secciones: **Scoreboard** (cifras principales), `Money` (reservado → cobrado → adeudado), `Deal book` (cada venta; clic en un nombre abre el cliente), `Pipeline` (cotizaciones abiertas, qué se estanca, ganadas y perdidas), `History`, `By segment`, `Pivot`, `Data quality and definitions` (qué corregir y qué significa cada número).

## `Partners`

**Para qué:** socios que refieren clientes con un enlace propio y cobran comisión.

- Título `Partners` y `+ New partner`.
- Cinco cifras: `Active partners`, `Clients referred <año>`, `Became customers <año>`, `Commission earned <año>`, `Owed now` (resaltada).
- Sugerencias de atribución: un cliente que quizás vino de un socio, con `Credit to <socio>` y `Not them`.
- Buscador `Search partners…`, casilla `Show archived`, y una tabla de socios con su estado (`no bank` si faltan datos bancarios) y `Copy link`. Clic en un socio abre su detalle.
- `New partner`: `Name`, `Email`, `Code` (opcional; se vuelve `?refer=`), modelo de comisión, `Landing page`, `Notes`, `Cancel` / `Create partner`.

## `Evo Lab`

**Para qué:** experimentos A/B del sitio (qué versión de un texto o formulario trae más ventas).

- Título `Evo Lab`, controles de período, una ventana en días (`A lead counts for a visitor's variant if it arrives within this many days of their first visit`) y filtros.
- Una franja de salud, un resumen (`LabPulse`), `Decisions waiting` (experimentos listos para decidir), `Experiments` (portafolio; clic abre el detalle con pestañas), combinaciones, audiencias, un buscador de preguntas (`AskEvo`) y el registro de decisiones.
- Registrar una decisión abre una ventana aparte. Solo administradores.

## `Providers`

**Para qué:** el registro de navieras, agentes y proveedores a quienes se piden tarifas.

- Título `Providers`. Avisos verdes o rojos arriba con `✕`.
- Formulario `➕ New Provider` / `✏️ Edit Provider`: nombre (`Shipping Co. Name`), sitio web, estrellas de puntaje (clic en una estrella), contactos (`Name`, `email@company.com`, `Phone (optional)`, `+ Add contact`; mínimo uno), regiones de origen (`USA, Canada, Mexico`) y destino (`Costa Rica, Panama, Spain`), notas internas y campos propios (`New field name (e.g. Port of Origin)`).
- Buscador `Search providers — name, email, contact, region…` y la lista. Cada proveedor tiene `✏️` editar, un interruptor `Activate`/`Deactivate` y `🗑️` borrar.
- Un proveedor sin correo no se puede elegir en los pedidos de tarifas (archivo 05, §4).

## `Posts`

**Para qué:** escribir correos masivos a clientes, artículos de blog y guías de país.

- Columna izquierda: título `📢 Posts & Blog`, `+ New`, filtros en pastillas con contadores, buscador `Search title, slug, or author…`, la lista de publicaciones (con `/blog/…` o `/guides/…`, autor y estado) y paginado `‹ ›`.
- Derecha: el editor, titulado `✍️ New Post`, `✏️ Edit Post` o `✏️ Edit Sent Post`.
  - Tipo, con tres botones: `📢 Email Broadcast` (se envía por correo), `📄 Web Article (Blog)` (página pública `/blog/<slug>`, no se envía), `🌍 Country Guide` (página pública `/guides/<slug>`).
  - Título, `🔗 URL Slug` (artículos y guías) y un editor visual con la opción `</> HTML`. En correos, `{{ }} Field` inserta datos del cliente.
  - Solo correos: `📅 Schedule Send` (el envío corre cada 15 minutos), `🎯 Audience Targeting` (país de destino, país de origen, etapas; vacío = todos los clientes con seguimiento activo) y `👥 Audience` con el número de destinatarios, o `⚠ No clients match the current filters…`.
  - Botones: `👁 Preview`, `💾 Save Draft` / `💾 Save`, `🌐 Publish` (web), `📅 Schedule` / `📅 Reschedule` y `🚀 Send Now` / `🚀 Resend Now` (correo).
  - Si ya se envió: `✓ Sent on <fecha> — delivered to N clients`, con listas `✅ Delivered` y `⚠️ Failed`.

**Cuidado:** `🚀 Send Now` manda un correo a muchos clientes a la vez. `🌐 Publish` publica en el sitio.

## `Admin`

Título `Admin` y `Decide who on the team can see and do what, and review who signed in and when. Only admins see this view.` Cinco pestañas:
- `🔑 Who can see what`: una grilla con un correo por fila y una casilla por vista. Arriba, `🟢 Saved · these settings are in use right now` o `🟡 Using the built-in defaults…`. `Add Staff Member` (solo la parte antes de la arroba; empieza con Board + List). Los cambios rigen al instante, sin publicar código.
- `👥 Sign-ins`: sesiones activas y vencidas (`Staff Email`, `Logged In`, `Expires In`, `Status`). Las sesiones duran 24 horas.
- `👣 Staff activity`: qué hizo cada persona.
- `🛡️ Who can do what`: permisos de acciones, por ahora `Aprobar cotizaciones`.
- `🤝 Collaborators`: personas a quienes la IA reenvía respuestas de clientes según su función descrita.

## `Templates`

**Para qué:** las plantillas del documento de propuesta que ve el cliente.
- Dos modos arriba: `📄 Templates` (lista y editor; `+ New template`, `🗑 Delete`, `↺ Revert`) y `⚙️ Config` (`⚙️ Template Mapping`: `Default template` y `Destination rules`, reglas «si el destino es X, usar plantilla Y», con `↑` `↓` `✕` y `＋ Add rule`).

## `Automations`

Título `Email Automations`. Ocho pestañas:
- `🗂️ Stages & rules`: **la configuración de las columnas del Board**. Cada etapa con su nombre, ícono, descripción, plazo (SLA) y si el cliente la ve, botones para subirla o bajarla, `Migrate…` (mover todos sus clientes a otra columna) y `✕` borrar (pide antes a dónde mover a sus clientes). Debajo de cada etapa, sus correos automáticos (`＋ Email` con demora en horas). `Add a stage` con `Name`, `Insert after`, `SLA`, `Client-visible`. Al final, `🚦 Move-in gates`: los requisitos de entrada a etapas (`+ New gate`, etapa destino, condiciones `ALL`/`ANY`, mensaje que ve el operador, interruptor y `✕`).
- `✉️ Email templates`: cada plantilla con `Edit` y `Revert`, marcadas `default`, `edited` o `custom`. El editor tiene `Label`, `Subject`, cuerpo y `Live preview`.
- `🧩 Overview fields`: qué campos muestra la pestaña Overview, con qué nombre y en qué orden.
- `📬 Who gets which email`: qué correos automáticos recibe cada persona del equipo, con `Preview`.
- `🎁 Client offer`: una ventana emergente que ven los clientes al abrir su portal (`Title`, mensaje, botón opcional, `👁 Preview`).
- `✅ Quote approvers`: quiénes reciben el aviso de «cotización pendiente de aprobación» y pueden aprobar.
- `🗓️ Tour schedule`: cada cuántas semanas hay tours de reubicación, `Upcoming tour weeks`, `Change log`.
- `🌍 Destination services`: qué pestañas de servicios ve el cliente en su portal según su país de destino.

**Cuidado:** todo en `Automations` y `Admin` cambia el sistema para todo el equipo al instante. Un agente no toca estas pantallas sin una instrucción explícita.
