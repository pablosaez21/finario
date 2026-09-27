# Finario · Propuesta de analíticas

Diseño aprobado por el usuario · 27 septiembre 2026. **Implementado el 27 septiembre 2026** (ver «Implementación» al final). Incluye animaciones y búsqueda inspiradas en ObsidianUI, solicitadas expresamente por el usuario. Las capturas contienen exclusivamente datos ficticios. No se ha consultado la base de datos personal.

## Objetivo

Responder en este orden: cuánto he gastado e ingresado, en qué categorías, qué ha cambiado, y qué movimientos explican el cambio. Mantener el registro diario rápido y separado del análisis. La portada Madrid se conserva; su botón Análisis dará acceso al resumen cuando se implemente esta fase.

## Referencias investigadas

- [Monarch · Cash Flow](https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow): análisis de entradas/salidas por periodo y categorías sin exigir presupuestación. Adoptar totales y desglose, dejar Sankey fuera de la primera versión.
- [Copilot · Dashboard](https://help.copilot.money/en/articles/6045480-dashboard-tab-overview): curva acumulada y comparación con el mes anterior hasta la misma fecha. Adoptar comparación temporal explícita; no trasladar exclusiones de gastos recurrentes ni dinero disponible sin disponer de esos datos.
- [YNAB · Income v Expense](https://support.ynab.com/en_us/income-v-expense-Byu1BYWRq?mobile-help=true): perspectiva histórica de ingresos y gastos. Adoptar histórico sencillo, sin confundir balance del periodo con patrimonio.
- [YNAB · Reflection reports](https://support.ynab.com/en_us/how-to-export-reflection-data-Bykou09): desglose, tendencias, ingresos frente a gastos y patrimonio son preguntas diferentes. Finario tiene datos para las tres primeras; no para patrimonio.
- [Copilot Web](https://help.copilot.money/en/articles/11780342-copilot-money-for-web): contexto histórico por categoría. Incorporar medias cuando exista historial suficiente.
- [ObsidianUI](https://www.temp.obsidianui.dev/components), [Magnet Tabs](https://www.temp.obsidianui.dev/docs/magnet-tabs), [Apple Spotlight](https://www.temp.obsidianui.dev/docs/apple-spotlight): biblioteca de componentes encontrada al investigar la referencia del usuario. El dominio literal obsidian.ui no abrió; esta es la biblioteca encontrada y mencionada en la propuesta aceptada por el usuario. Se inspeccionó visualmente la demo de pestañas y la documentación de búsqueda; no se verificó una interacción funcional de Spotlight. Inspiración: selección de pestaña clara, microtransiciones y búsqueda por teclado. No incorporar cursores decorativos, vidrio o animaciones constantes sobre cifras.

## Primera versión propuesta

1. Resumen mensual: gastos, ingresos y diferencia, con variaciones frente al periodo comparable.
2. Desglose por categoría, alternando Gastos / Ingresos. Tabla ordenable por importe, cambio en euros o porcentaje. Barras horizontales con escala común dentro del conjunto mostrado; importe exacto siempre visible.
3. Curva de gasto acumulado frente al periodo anterior. Leyenda persistente, líneas distinguibles por trazo, valores accesibles también en texto.
4. Una a tres observaciones calculadas que expliquen cambios relevantes. Priorizar impacto en euros, no porcentajes grandes sobre bases minúsculas. Sin IA, juicios sobre hábitos ni inferencias causales.
5. Detalle de categoría: importe, peso en total, número de movimientos, importe medio, evolución y listado de movimientos. Editar reutilizando el flujo existente y recalcular tras guardar.
6. Selección de meses anteriores. Conservar periodo, filtros, orden y foco al volver del detalle.
7. Animaciones discretas y buscador local por teclado inspirados en ObsidianUI, según la especificación siguiente. Forman parte de esta entrega.

## Métricas y significado

| Métrica | Cálculo | Interpretación |
|---|---|---|
| Gastos | Suma de importes de tipo gasto en el rango | Gasto registrado, no gasto bancario completo |
| Ingresos | Suma de importes de tipo ingreso en el rango | Ingreso registrado |
| Balance | Ingresos − gastos | Diferencia del periodo, no saldo disponible |
| Proporción retenida | Balance / ingresos × 100 | Mostrar solo con ingresos > 0; puede ser negativa |
| Peso de categoría | Importe categoría / total del mismo tipo × 100 | Omitir porcentaje si total = 0 |
| Cambio € | Actual − anterior | Principal indicador del impacto |
| Cambio % | (Actual − anterior) / anterior × 100 | Solo si anterior > 0 y comparación disponible |
| Importe medio | Importe categoría / número de registros | No equivale a precio de compra ni ticket de una visita |
| Acumulado | Suma desde inicio del periodo hasta cada día | Incluir días sin movimientos manteniendo nivel |

La ausencia de registros no demuestra ausencia de gastos. Si no hay historial, mostrar «Sin registros para comparar»; no presentar una caída del 100 % como hecho económico. Si hay datos en el periodo anterior pero una categoría tenía cero gasto, mostrar «Sin gasto previo registrado» en lugar de un porcentaje infinito. Aun con registros, la integridad del historial manual no puede darse por garantizada.

Comparación por defecto del mes en curso: del día 1 hasta hoy frente al mismo tramo del mes anterior. Mostrar siempre ambos rangos. Si el anterior tiene menos días, comparar hasta el último día común y advertir ese corte en los indicadores comparativos; los totales del mes actual pueden mantenerse completos con etiquetas diferenciadas. Para meses cerrados comparar meses completos, explicitando rangos y distinta duración si procede. Para rangos personalizados futuros, usar igual número de días inmediatamente anteriores. Excluir fechas futuras del resumen hasta hoy.

## Recorrido y diseño

- Cabecera y tipografías del Finario existente: fondo claro #FAF9F5, texto #232B2A, separadores #DCDED4, acento #1649D8, logo Fraunces e interfaz Instrument Sans. Mantener cifras tabulares.
- Navegación Apuntar / Análisis; categoría y copias como utilidades. La portada conserva su personalidad visual; el área de trabajo prioriza lectura.
- Primer nivel: tres cifras sobre una línea, después tabla a la izquierda y curva/observación a la derecha. Reducir paneles y adornos.
- Segundo nivel: página de detalle con volver al resumen. Evitar paneles superpuestos estrechos para tablas y evolución.
- La fila azul de Restaurantes en la captura ilustra foco/hover; no es una selección permanente arbitraria.
- Tabulador recorre controles reales; Enter abre categoría; volver restaura foco. Rangos y selectores deben tener nombres accesibles. Ninguna información depende exclusivamente de hover o color.
- Microtransiciones breves (120–180 ms) solo para cambios de estado; respetar movimiento reducido. Sin animación inicial de números.
- Ventanas estrechas: apilar columnas; mantener importes legibles y evitar scroll horizontal de toda la ventana. La captura de escritorio no define un tamaño mínimo de fuente obligatorio.
- Estados: sin movimientos, sin periodo anterior, cero ingresos, carga, fallo con reintento, categorías archivadas, muchos registros y notas largas.
- Búsqueda por teclado inspirada en Spotlight: incluida en esta fase por petición expresa del usuario. Ver especificación siguiente.

## ObsidianUI: animación y búsqueda incluidas en esta fase

El usuario solicita expresamente animaciones y búsquedas cuidadas inspiradas en ObsidianUI. Las capturas fijan composición y estilo; esta sección describe comportamiento que una imagen estática no muestra. Adaptar las referencias al tema claro de Finario. No interpretar las demos oscuras como una petición de cambiar el tema.

### Animaciones concretas

- **Pestañas Apuntar / Análisis:** indicador que se desliza entre posiciones, inspirado en [Magnet Tabs](https://www.temp.obsidianui.dev/docs/magnet-tabs), 160–180 ms. Etiquetas y zonas de clic permanecen fijas; no desplazar el objetivo con efecto magnético.
- **Selector Gastos / Ingresos:** fondo de selección con transición de 140–160 ms, estado semántico accesible y foco visible. El contenido se actualiza como un único conjunto coherente.
- **Resumen → categoría:** entrada con opacidad y desplazamiento vertical máximo de 6 px durante 160–180 ms. Volver conserva periodo, orden, scroll y foco en la fila de origen.
- **Cambio de periodo:** transición de opacidad de 120–160 ms cuando llega el nuevo resultado. No animar contadores ni interpolar importes financieros; evitar mostrar cifras antiguas bajo una fecha nueva. Si carga, indicar el estado y cancelar/ignorar respuestas de peticiones obsoletas.
- **Filas y botones:** hover y foco suaves (100–120 ms). Iconos pueden desplazarse 2 px en acciones de navegación; importes y columnas no se mueven.
- **Buscador:** apertura con opacidad y escala de 0,98 a 1 en 160 ms, fondo atenuado y sombra contenida. Sin desenfoque obligatorio ni efectos permanentes.
- **Movimiento reducido:** eliminar desplazamientos, escala y deslizamiento; cambiar estados de forma inmediata o con un fundido mínimo. No retrasar la interacción hasta terminar la animación.

### Buscador local tipo Spotlight

Referencia visual: [Apple Spotlight de ObsidianUI](https://www.temp.obsidianui.dev/docs/apple-spotlight). Es una búsqueda de datos y navegación local, sin IA ni consultas externas.

- Acceso mediante botón visible **Buscar… ⌘K** en la cabecera del interior y atajo Cmd+K en macOS (Ctrl+K donde corresponda). Conservar Inicio y las utilidades existentes. No abrir sobre otro diálogo activo ni perder un formulario sin guardar.
- Diálogo centrado, ancho aproximado 560–640 px y alto limitado a la ventana. Campo enfocado al abrir; placeholder «Buscar categorías o movimientos…». Mantener el lenguaje visual claro de Finario.
- Sin consulta: accesos a Análisis y Apuntar. Elegir un acceso navega, no crea ni modifica registros.
- Con consulta: resultados agrupados en **Categorías** y **Movimientos**. Buscar por nombre de categoría y concepto, sin distinguir mayúsculas ni tildes. No prometer búsqueda por comercio, lenguaje natural o campos inexistentes.
- Categoría: icono outline, nombre y tipo gasto/ingreso; al elegir, abrir su detalle con el periodo actual. Movimientos: concepto o categoría como sustituto, fecha, categoría e importe con signo. Al elegir, abrir el detalle/editor existente sin guardar automáticamente.
- Alcance visible **Este periodo / Todo el historial**, por defecto el periodo activo en Análisis. Fuera de Análisis, Todo el historial. Mostrar las fechas del alcance y ofrecer cambiarlo si no hay coincidencias.
- Consultar SQLite mediante Rust sobre todo el historial elegible, no filtrar solo movimientos cargados en pantalla. Excluir borrados lógicos; incluir categorías archivadas con etiqueta cuando tengan historial. Consultas parametrizadas, búsqueda literal de caracteres especiales y límite/paginación de resultados.
- Debounce orientativo de 150 ms. Mostrar hasta 5 categorías y 10 movimientos inicialmente, indicar si hay más y permitir cargar más sin hacer pasar un subconjunto por todos los resultados. Orden estable: categorías con coincidencia exacta/de prefijo antes de las demás; movimientos por fecha descendente y desempate estable.
- Flechas recorren resultados, Enter abre, Escape cierra. Tab mantiene el foco dentro del diálogo, con botón de cierre accesible. Al cerrar sin navegar, devolver foco al activador. Usar semántica de diálogo y combobox/listbox adecuada; anunciar carga, error y ausencia de resultados sin leer toda la lista en cada pulsación.
- Estado vacío: «No hay coincidencias en este periodo», con opción Todo el historial. Error: mensaje y Reintentar, conservando consulta. No conservar búsquedas con notas personales en telemetría ni servicios externos.

### Integración y comprobación

Inspeccionar las implementaciones de ObsidianUI y su licencia antes de reutilizar código. Adoptar componentes concretos compatibles con React/Tauri; no instalar toda una biblioteca ni añadir Tailwind solo para imitar dos efectos si se resuelven con el CSS existente. Si se usa Motion, empaquetarlo localmente y limitarlo a las transiciones necesarias. Registrar en la documentación técnica qué referencia se adaptó y cualquier atribución requerida. La inspiración visual no depende de acceder a ObsidianUI en tiempo de ejecución.

Verificar en WebKit/Tauri: apertura y cierre con teclado, foco restaurado, búsqueda con tildes, categorías archivadas, muchos resultados, historial completo, respuestas fuera de orden, cambios de periodo y movimiento reducido. No alterar la persistencia o la lógica de importes para añadir animaciones.

## Ejemplo de las capturas

Septiembre 1–27: 1.664,40 € de gastos; 2.400,00 € ingresos; +735,60 € de balance. Agosto 1–27: gastos 1.484,40 €, ingresos 2.300,00 €. Cambio de gasto +180 € (+12,1 %).

Categorías septiembre/agosto: Vivienda 850/850; Alimentación 286,40/268,40; Restaurantes 192/120; Ocio 146/110; Transporte 74/80; Compras 62/20; Suscripciones 54/36. Las sumas están verificadas.

Restaurantes añade 72 €, el 40 % del incremento neto de 180 €. El detalle muestra 12 movimientos frente a 8, con importe medio 16 € frente a 15 €. Esto describe registros: no demuestra cuatro visitas adicionales ni una subida de precios. Las cinco filas visibles suman 78 € y se etiquetan como subconjunto de doce.

La proporción de contribución al cambio neto puede superar 100 % si otras categorías compensan. En esos casos preferir «X añade 72 €; Y compensa 30 €», evitando titulares de porcentaje difíciles de interpretar. No usar esa proporción si el cambio total es cero o casi cero.

## Evolución posterior

- Histórico global de 6/12 meses, ingresos y gastos juntos, y contexto de media por categoría indicando cuántos meses completos incluye.
- Etiqueta manual «Mudanza»/«Extraordinario» y filtro visible aplicado a todos los cálculos y periodos comparados. Útil al instalarse en Madrid, sin borrar esos gastos del total real ni deducirlos automáticamente de las notas.
- Objetivos por categoría, si el usuario desea presupuestar: entonces sí cabría «restan X € del presupuesto».
- Exportar desglose y datos filtrados.
- No priorizar patrimonio, predicción de saldo, ranking de comercios, gastos recurrentes detectados ni puntuación de salud financiera: faltan datos estructurados o aportan complejidad prematura.

## Encaje técnico para el agente implementador

Aplicación existente: React + TypeScript, Tauri 2, Rust y SQLite local. Movimiento con tipo, importe en céntimos, moneda EUR, categoría, fecha y nota. Sin modelo de cuentas, comercios ni presupuestos.

Calcular agregados sobre TODOS los movimientos elegibles en SQLite/Rust; no sobre los 30 registros de la página reciente. Excluir eliminados lógicos; conservar categorías archivadas en históricos. Agrupar por ID, no por nombre. Importes enteros en céntimos, formato español al presentar, fechas locales sin desplazamientos por UTC. No introducir dependencia de servicios remotos para analíticas.

Verificar sumas contra registros, cambios de mes/año, febrero, denominadores cero, historial ausente, eliminación/edición y categorías archivadas. Probar navegación por teclado y ventana estrecha. Este encargo actualiza documentación; no modifica todavía el código de la aplicación. Cuando el siguiente agente reciba el encargo de implementar analíticas, debe ejecutar el alcance de este documento, incluida la búsqueda y las animaciones.

## Entregables

- [03-analiticas-resumen.jpg](references/03-analiticas-resumen.jpg): composición del resumen.
- [04-analiticas-categoria.jpg](references/04-analiticas-categoria.jpg): composición del detalle.
- Ambas son maquetas con datos ficticios. Los selectores visibles ilustran comportamiento futuro; no representan funcionalidades ya implementadas.

## Encargo listo para el siguiente agente

> Implementa la fase de analíticas de Finario según docs/ANALYTICS.md. Revisa las capturas 03 y 04 de docs/references. Incluye resumen, comparaciones entre periodos equivalentes, categorías, detalle con movimientos, animaciones y buscador local tipo Spotlight inspirados en ObsidianUI. Conserva la estética actual y la persistencia SQLite; usa datos reales y agregados sobre todo el historial. Activa Análisis al terminar. Este alcance sustituye las restricciones históricas que dejaban Análisis como Próximamente. Verifica cálculos, teclado, movimiento reducido y funcionamiento offline.

## Implementación

- **Backend:** `src-tauri/src/analytics.rs`, con los comandos `analytics_summary`, `category_detail` y `search`. Calcula periodos con corte en el último día común y meses cerrados completos con aviso de distinta duración. El acumulado diario mantiene el nivel en los días sin movimientos. Los porcentajes solo aparecen con denominador distinto de cero.
- **Observaciones:** hay cuatro tipos:
  - `explains`: «X explica el N % de la subida», solo si la categoría explica como mucho el 100 % del cambio.
  - `adds_offsets`: «X añade 72 €; Y compensa 30 €», cuando el porcentaje superaría el 100 % o el cambio total es menor de 1 €.
  - `offsets`: una categoría que va en sentido contrario al total.
  - `new`: una categoría sin importe previo registrado.
- **Búsqueda:** usa la función SQLite `fold()` (minúsculas y sin tildes) con `instr`: es literal, así que `%` y `_` no actúan como comodines, y las consultas van parametrizadas. Muestra 5 categorías y 10 movimientos por página. Las categorías archivadas solo aparecen si tienen historial.
- **Tests:** `src-tauri/src/analytics_tests.rs` reproduce el ejemplo de este documento: 1.664,40 € / 1.484,40 €, +180 € (+12,1 %), Restaurantes con el 40 % y 12 frente a 8 movimientos (16 € frente a 15 €). También cubre febrero y años bisiestos, el cambio de año, la ausencia de historial, los cero ingresos, las archivadas, la edición y el borrado.
- **Frontend:** `src/screens/Analisis.tsx` y `src/components/analytics/`. Descarta respuestas de peticiones obsoletas y nunca muestra cifras de otro periodo bajo la fecha pedida. Las gráficas son SVG propias, sin dependencias.

### Atribución ObsidianUI

Se revisaron [Magnet Tabs](https://www.obsidianui.dev/docs/magnet-tabs) y [Apple Spotlight](https://www.obsidianui.dev/docs/apple-spotlight). El repositorio de ObsidianUI tiene licencia MIT (© sus autores; [licencia](https://gitlab.com/Atharvsinh-codez/ObsidianUI/-/blob/main/LICENSE)). **No se ha copiado su código:** ambos componentes dependen de Tailwind y Motion. Sus efectos se han reimplementado con el CSS existente:

- **Indicador deslizante** (`useSlidingIndicator`, 150–170 ms), en las pestañas Apuntar/Análisis y en los selectores segmentados, sin efecto magnético sobre las etiquetas.
- **Apertura del buscador** con opacidad y escala de 0,98 a 1 en 160 ms, con fondo atenuado y sin desenfoque.

No se ha añadido Tailwind ni Motion, y la app no accede a ObsidianUI en tiempo de ejecución. Con movimiento reducido, todas las transiciones son inmediatas.
