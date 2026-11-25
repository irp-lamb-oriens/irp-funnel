# 03 · List (tabla de clientes)

Se abre con el botón `List`. Muestra los mismos clientes que el Board, con los mismos filtros y la misma búsqueda (archivo 01, §3), pero en una tabla.

## Forma

- Un **encabezado fijo** que queda arriba al bajar, con seis columnas: `Client`, `Route`, `Stage`, `Budget`, `Consultation`, `Last Updated`.
- Debajo, una fila por cliente. Al pasar el mouse la fila se resalta.

## Qué muestra cada columna

| Columna | Contenido |
|---|---|
| `Client` | Arriba el nombre en negrita, con `🔥` delante si tiene prioridad y `?` si falta el nombre de pila (en cursiva gris). Debajo, el correo en gris. |
| `Route` | `origen → destino` (ciudad o, si no hay, país). |
| `Stage` | Una pastilla del color de la etapa con su ícono y nombre, por ejemplo `💰 Pricing Quote`. Si falta la transcripción de la llamada, al lado aparece una pastilla roja clara con `❌`. |
| `Budget` | El presupuesto o `—`. |
| `Consultation` | Fecha de la llamada de consulta (por ejemplo `Nov 28, 2026`) o `—`. |
| `Last Updated` | Hace cuánto cambió: `just now`, `12m ago`, `3h ago`, `5d ago`. |

Las filas de clientes que **no se presentaron** a la llamada tienen una franja roja a la izquierda y un fondo rojizo que se desvanece hacia la derecha.

Los clientes con prioridad aparecen primero.

## Uso

- Clic en una fila → abre el panel del cliente (archivo 04).
- No se puede arrastrar ni cambiar la etapa desde la tabla: abrí el cliente y usá la ficha de etapa.
- Sin resultados: `No clients found matching filters.` Revisá el contador de filtros arriba.
- Para exportar lo que se ve, usá `⬇ Export` → `Current view` (archivo 06).
