# CRM de IRP — guía visual para agentes de IA

Esta carpeta describe el CRM de IRP (`https://internationalrelocationpartner.com/dashboard`) tal como se ve en el navegador. Está escrita para un agente que solo puede **mirar la pantalla, leer el texto visible y hacer clic o escribir**. No hace falta saber nada del código para usarla.

## Cómo leer estos documentos

- Los textos que aparecen en pantalla se citan **exactamente, en inglés y entre comillas o en `código`**, porque el CRM está en inglés. Ejemplo: el botón `New Client`. Buscá ese texto literal en la página.
- Muchos controles empiezan con un emoji (`💰 Quotes`, `⚡ Actions`). El emoji forma parte del texto visible y sirve para ubicarlos rápido.
- Las posiciones se describen con la ventana de escritorio en mente (unos 1440 × 900 px). En pantallas angostas (menos de 768 px) algunas cosas cambian; se indica cuando importa.
- Donde dice **«Se ve:»** está lo que aparece en pantalla. Donde dice **«Al hacer clic:»** está lo que pasa. Donde dice **«Cuidado:»** hay un efecto que no se puede deshacer o que le llega a un cliente.
- Las etapas (columnas del Board), sus nombres, íconos y descripciones se configuran desde `Automations`. Estos documentos usan los nombres por defecto. Si en pantalla ves un nombre distinto, confiá en la pantalla.

## Índice

| Archivo | Qué cubre |
|---|---|
| [01-acceso-y-barra-superior.md](01-acceso-y-barra-superior.md) | Pantalla de login, barra superior, pestañas, búsqueda, filtros, avisos flotantes, botón de bugs |
| [02-board.md](02-board.md) | El tablero Kanban: columnas, tarjetas, insignias, arrastrar, prioridad, bloqueos de etapa |
| [03-list.md](03-list.md) | La vista de tabla |
| [04-ficha-del-cliente.md](04-ficha-del-cliente.md) | El panel lateral de un cliente y sus pestañas (Overview, Journey, Insights, Lily, Actions, Conversations, Notes, Activity, Emails) |
| [05-cotizaciones-cobros-proveedores.md](05-cotizaciones-cobros-proveedores.md) | Pestañas `💰 Quotes`, `🧾 Charges` y `📨 Providers`: pedidos de precio, editor de cotizaciones, aprobación, envío, pagos |
| [06-alta-e-importacion-de-clientes.md](06-alta-e-importacion-de-clientes.md) | Crear un cliente a mano (`New Client`), exportar e importar |
| [07-vistas-de-gestion.md](07-vistas-de-gestion.md) | Metrics, Finance, Sales Report, Partners, Evo Lab, Providers, Posts, Admin, Templates, Automations |
| [08-procedimientos-diarios.md](08-procedimientos-diarios.md) | Recetas paso a paso del día a día: entra un lead, se mueve de etapa, se cotiza y se envía, arranca operaciones |
| [09-etapas.md](09-etapas.md) | Tabla de referencia de todas las etapas por defecto, con ícono, color, plazo y qué las mueve solas |

## Reglas para el agente

1. **No envíes nada a un cliente sin permiso explícito de la persona.** Los botones que mandan correos o cotizaciones son: `👁 Preview & Send` → `Send` dentro del panel de vista previa, `📤 Send quote to client`, `🚀 Send Now`, `Preview & Send to Pricing`, el envío de pedidos a proveedores y `⚡ Execute Action` en acciones que disparan correos. Prepará todo, mostrá lo que va a salir y esperá un sí.
2. **Mover una tarjeta a `Initial Payment` registra un pago.** Si la tarjeta viene de `Quote Acceptance`, el sistema la marca como pagada y suma contadores de ventas. No lo hagas para «ordenar» el tablero.
3. **Borrar es definitivo** salvo donde se indica `Undo`. Antes de `🗑️` (cotización, nota, proveedor, plantilla, etapa) confirmá con la persona.
4. **No adivines datos de clientes.** Si un campo está vacío (muestra `—`), dejalo así o preguntá.
5. **Leé antes de hacer clic.** Casi todos los botones tienen un texto de ayuda (tooltip) que aparece al pasar el mouse; ahí suele estar explicado qué hacen.
6. **Esperá a que cargue.** Mientras carga, el Board muestra tarjetas grises que brillan (esqueletos) y aparece una línea fina animada debajo de la barra superior. No actúes hasta que desaparezcan.

## Estado de esta guía

Escrita a partir del código del repositorio (`src/routes/dashboard/`) en noviembre de 2026. Cuando una pantalla se verificó contra el navegador, el archivo lo dice al principio. Si encontrás una diferencia entre la guía y la pantalla, la pantalla manda: actualizá el archivo.

`src/routes/dashboard/agentDocs.guard.test.ts` falla si se agrega una vista o una etapa por defecto al CRM y esta guía no la menciona.
