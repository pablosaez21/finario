# Plan para el agente implementador

## Actualización de alcance: analíticas

La fase inicial de portada y registro ya está implementada. La siguiente fase aprobada se especifica en [ANALYTICS.md](ANALYTICS.md), incluidas las animaciones y la búsqueda local inspiradas en ObsidianUI. Cuando el encargo sea implementar analíticas, ese documento prevalece sobre las restricciones históricas de esta documentación que mantienen Análisis desactivado o excluyen gráficas. **Fase implementada (27 sep 2026):** Análisis está activo en la portada y en el interior; las menciones históricas a «Próximamente» se refieren a la primera fase.

Estado inicial: documentación y referencias únicamente. Las siguientes tareas están pendientes.

## 1. Arranque

- Revisar las dos imágenes y las diferencias obligatorias documentadas en DESIGN.md.
- Preparar Tauri 2, React, TypeScript y la capa SQLite local.
- Confirmar las categorías mientras se avanza con estructura y navegación.
- Añadir al README los comandos reales una vez existan.

## 2. Portada

- Preparar un fondo derivado de la imagen aprobada sin títulos ni botones incrustados.
- Conservar Estrecho pequeño, el cartel Mahou, el skyline y la textura.
- Mostrar **Finario** con mayor tamaño que el título antiguo.
- Debajo, exactamente: **Pecunia, si uti scis, ancilla est; si nescis, domina**
- Botón principal Gastos e ingresos, con icono outline de cartera.
- Debajo, Análisis con etiqueta Próximamente y estado desactivado.
- Revisar el encuadre y contraste en tamaños habituales y pequeños de ventana.

## 3. Registro

- Navegación de entrada desde la portada y vuelta a Inicio.
- Gasto/Ingreso, importe, categoría, fecha y concepto opcional.
- Guardado persistente; errores útiles sin perder la entrada.
- Últimos movimientos a la derecha o debajo según el espacio.
- Edición y eliminación recuperable, con Deshacer coherente con la base de datos.
- Categorías configurables con identificadores estables y archivado.
- Sin datos ficticios precargados en el producto real.

## 4. Persistencia y recuperación

- Migraciones y ubicación estable de los datos.
- Copias y restauración definidas y verificadas.
- Asegurar que las actualizaciones no pisan datos del usuario.

## 5. Verificación de entrega

- Probar registro de gasto e ingreso, corrección de importes y edición de categoría.
- Rechazar importes vacíos, cero, negativos y entradas decimales ambiguas.
- Comprobar que un doble clic en guardar no duplica el movimiento.
- Cerrar y abrir la app, verificando que persisten los movimientos.
- Comprobar borrado y recuperación; renombrar o archivar categoría sin perder historial.
- Verificar copia y restauración con datos de prueba, incluyendo rechazo de una copia inválida.
- Recorrer por teclado, comprobar foco y estados vacíos y de error.
- Capturar portada y registro; comparar con las referencias y las correcciones textuales.
- Confirmar que Análisis sigue desactivado y no se ha implementado Mi mes.

## Fuera de esta entrega

Análisis, Mi mes, gráficas, comparaciones, presupuestos, conexión bancaria, importación, sincronización, IA, múltiples cuentas y movimientos recurrentes. Se definirán en fases posteriores.

## Encargo breve listo para el siguiente agente

> Implementa Finario siguiendo AGENTS.md, DESIGN.md y los documentos de docs/. Revisa las dos imágenes de docs/references. La portada debe conservar el Madrid granulado aprobado, con Estrecho discreto y Mahou, pero sustituir los títulos antiguos por Finario, más grande, y debajo «Pecunia, si uti scis, ancilla est; si nescis, domina». Implementa portada y registro de gastos e ingresos con persistencia SQLite. Mantén Análisis · Próximamente desactivado y deja Mi mes y todas las gráficas para más adelante. Usa Tauri 2, React y TypeScript. No confundas la maqueta de referencia con código de producción. El catálogo final de categorías sigue pendiente de definición.
