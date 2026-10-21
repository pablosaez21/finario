# Finario — dirección de diseño y alcance

## Actualización de alcance: analíticas

La fase inicial de portada y registro ya está implementada. La siguiente fase aprobada se especifica en [docs/ANALYTICS.md](docs/ANALYTICS.md), incluidas las animaciones y la búsqueda local inspiradas en ObsidianUI. Cuando el encargo sea implementar analíticas, ese documento prevalece sobre las restricciones históricas de esta documentación que mantienen Análisis desactivado o excluyen gráficas. **Fase implementada (27 sep 2026):** Análisis está activo en la portada y en el interior; las menciones históricas a «Próximamente» se refieren a la primera fase.

Estado: segunda versión de la portada aprobada visualmente por el usuario. Nombre aprobado: Finario. Textos de portada actualizados según la última instrucción del usuario. Plan para entregar al agente implementador. En esta conversación se ha preparado el plan y una preview; no se ha construido la aplicación.

## Objetivo

Aplicación personal de escritorio para registrar gastos e ingresos por categoría y conservar los datos localmente. Stack acordado: Tauri 2, React, TypeScript y SQLite. Funciona sin conexión. Interfaz en español. EUR como propuesta inicial. No requiere servicios externos ni cuenta de usuario.

## Referencias y precedencia

1. Las decisiones de este documento actualizan el alcance de la maqueta anterior.
2. [01-portada-madrid-aprobada.png](docs/references/01-portada-madrid-aprobada.png): segunda versión aprobada de la portada, generada con la herramienta integrada de imágenes. Referencia de composición, tratamiento gráfico y jerarquía; no es una captura de una aplicación implementada.
3. [02-registro-referencia.jpg](docs/references/02-registro-referencia.jpg): referencia para el lenguaje visual de la pantalla de registro. Su pestaña Mi mes, resumen mensual, presupuestos y gráficas NO forman parte de la fase actual.
4. Referencia original del usuario: paisaje de montaña con fotografía muy granulada, color intenso, altas luces cálidas, sombras profundas, profundidad y un botón central. El objetivo es trasladar ESA ESTÉTICA a Madrid; no reducirla a copiar el azul cobalto.

## Navegación

Inicio / portada Madrid
- Gastos e ingresos → pantalla de registro.
- Análisis · Próximamente → control visible y desactivado durante la primera fase.

Registro
- Inicio → vuelve al paisaje.
- Formulario de gasto o ingreso.
- Últimos movimientos registrados, con edición y eliminación reversible.

La portada es una pantalla permanente de entrada y aparece al abrir la aplicación; no es solo onboarding. No se navega automáticamente tras una espera. No se añade un login.

En la fase futura, el mismo botón Análisis se activará y abrirá Mi mes y el resto de consultas analíticas. No construir ahora una pantalla de análisis ficticia.

## Pantalla 1: portada de Madrid

### Dirección artística

Paisaje urbano panorámico con tratamiento fotográfico de cartel impreso: grano visible, trama de impresión, textura analógica, colores intensos, luz cálida y sombras profundas. Conservar la sensación y profundidad de la referencia original. Evitar convertirlo en ilustración vectorial plana o render 3D pulido.

Composición artística de Madrid, no una vista geográfica literal desde Estrecho:
- Primer plano: entrada del metro, rombo rojo y azul y placa legible Estrecho.
- Fondo: las siluetas reconocibles de las Cuatro Torres.
- Elementos de apoyo: arquitectura madrileña, árboles y cubiertas cálidas. Las torres KIO pueden aparecer si no recargan la composición.
- Reservar una zona tranquila en el centro superior para los controles.
- Mantener Estrecho y el skyline reconocibles al adaptar el encuadre a distintos tamaños de ventana.

La preview es orientativa: el arte definitivo debe revisar las siluetas y el número de edificios protagonistas. Los elementos incidentales o rótulos añadidos por el generador no son requisitos de producto. Reproducir el cartel vintage rojo de Mahou de la esquina inferior derecha de la segunda versión, sustituyendo por completo el antiguo mural con frase. Mantener el conjunto Metro/Estrecho con el menor protagonismo y tamaño que tiene en la segunda versión aprobada. No volver a la escala de la primera preview.

### Contenido y jerarquía

- Nombre definitivo: **Finario**, con esa capitalización, más grande que el antiguo rótulo «Mis finanzas». Mantener el carácter serif elegante de la referencia. Tamaño orientativo en escritorio: 52–64 px, adaptable a la ventana; debe sentirse protagonista sin ocultar el paisaje.
- Debajo de Finario, mostrar literalmente: **Pecunia, si uti scis, ancilla est; si nescis, domina**
- El nombre y la frase forman una única jerarquía centrada: Finario → frase latina → botón principal → botón Análisis.
- Sustituir los dos textos antiguos («Mis finanzas» y «Tu día a día, en Madrid.»). No mantenerlos como títulos adicionales, ni duplicar Finario arriba y en el centro.
- Frase con tamaño subordinado, aproximadamente 18–22 px en escritorio, centrada, legible sobre el cielo y con anchura limitada. Permitir dos líneas equilibradas cuando sea necesario, preferiblemente tras el punto y coma. Conservar palabras y puntuación exactamente; no añadir traducción, atribución o punto final sin petición del usuario.
- Las imágenes conservan los textos anteriores: son referencias visuales históricas. Estas instrucciones tienen prioridad sobre el texto incrustado en ellas.
- Botón central principal: icono outline de cartera, texto Gastos e ingresos y flecha de avance. Rectangular, radio moderado, naranja cálido y contraste alto.
- Debajo: icono outline de gráfica, texto Análisis y etiqueta Próximamente. Menor énfasis, desactivado, pero legible. No depender solo del color para indicar su estado.
- Sin saldos, formularios o gráficas encima del paisaje.

No encerrar los dos botones en una gran tarjeta que tape el paisaje. Mantenerlos centrados y con separación suficiente. No añadir menús propios de una web comercial.

### Construcción posterior

El paisaje será un recurso local empaquetado con la aplicación. Los títulos, botones e iconos se construirán como interfaz real por encima. NO usar la preview entera como fondo con los botones pintados y superponer zonas de clic.

Antes de implementar, producir una versión del paisaje sin textos de interfaz ni botones. La señal del metro y la placa Estrecho sí pertenecen al paisaje. Preservar zonas seguras y contraste al reencuadrar; en ventanas pequeñas es preferible conservar un encuadre cuidado antes que recortar Estrecho.

## Pantalla 2: gastos e ingresos — fase actual

Usar el lenguaje visual de la maqueta anterior: superficie clara cálida, texto oscuro, espacio generoso, separadores finos, cifras alineadas y controles discretos. La portada expresiva y la pantalla operativa limpia son dos partes deliberadas del mismo producto.

Adaptación de alcance respecto a la maqueta:
- Quitar Mi mes de la navegación activa.
- Quitar el resumen mensual, barras, presupuestos y enlaces a análisis.
- Usar la columna derecha para últimos movimientos. En ventanas estrechas, colocarla debajo del formulario.
- Mostrar Inicio en un lugar fácil de encontrar para regresar al paisaje.

### Registro rápido

Recorrido principal: importe → categoría → guardar.

Campos:
- Tipo: Gasto o Ingreso.
- Importe: obligatorio, positivo, con hasta dos decimales. Aceptar coma decimal; almacenar cantidades en céntimos enteros.
- Categoría: obligatoria y correspondiente al tipo de movimiento.
- Fecha: hoy por defecto, editable.
- Concepto: opcional.

Las categorías finales se definirán con el usuario antes de cerrar su catálogo. Las mostradas en la maqueta son ejemplos; no deben darse por aprobadas. Usar un catálogo configurable, con identificadores estables, para que renombrarlas no pierda movimientos históricos. Archivar categorías en uso en lugar de borrar su historial.

Interacciones:
- Importe visualmente protagonista.
- Categorías frecuentes con icono outline y nombre; posiciones estables.
- Botón Guardar gasto o Guardar ingreso según el tipo.
- Navegación por teclado y guardado con Intro cuando corresponda.
- Impedir dobles envíos mientras se guarda.
- Confirmar éxito solo después de guardar en SQLite.
- Conservar los campos si falla el guardado y mostrar un error útil.
- Tras guardar, actualizar la lista, vaciar importe y concepto y devolver el foco al importe.
- Ofrecer Deshacer; debe revertir también el cambio persistido.
- Permitir editar movimientos y eliminar con recuperación o confirmación clara.

Últimos movimientos:
- Filas con concepto o categoría, fecha e importe con signo.
- Importes alineados a la derecha y números tabulares.
- Datos reales del usuario. La aplicación nueva empieza vacía, con una invitación breve a registrar el primer movimiento.
- Ninguna métrica mensual ni gráfica en esta fase.

## Lenguaje visual del interior

**Revisión del 21 oct 2026** (estilo «libro de cuentas», aplicado con la Taste Skill v2 en modo app): el cromo no lleva color. El cobalto del cielo de la portada se reserva para el dato principal (la cifra que se está apuntando, la curva y las barras del periodo actual) y para el foco; la comparación va en gris. Verde con «+» para ingresos, gastos en tinta con «−», rojo solo para errores, acciones destructivas y cambios a peor. Un cambio desde cero no se colorea.

- Suelo piedra (`--paper` #f4f3f1), paneles blancos con borde de 1 px y radio 8, sin sombras en reposo; solo flotan diálogos, avisos y tooltips.
- Una barra superior de 52 px sobre el suelo: logotipo en Fraunces, pestañas Apuntar/Análisis, buscador, Categorías, Copias e Inicio (con un recorte del paisaje). Barra, contenido y pie comparten una columna centrada de 1208 px.
- Acción principal casi negra; secundarias con borde. Sin degradados, sin desenfoques, sin etiquetas en mayúsculas espaciadas, sin iconos dentro de cajas.
- Instrument Sans para todo el interior; títulos de pantalla a 24 px, cifras clave a 30 px, nada por debajo de 11 px. Cifras tabulares siempre.
- Apuntar: el mes en curso (gastos, ingresos, balance) encabeza la lista; los movimientos se agrupan por día, con el total gastado cuando el día tiene dos gastos o más. Atajos «Hoy» y «Ayer» junto a la fecha. En la ventana mínima (900 × 620) el botón Guardar queda a la vista.
- Análisis: el título es el mes, con flechas para cambiar de periodo. Los cambios porcentuales desde una base minúscula (≥ +1.000 %) se expresan como múltiplo («×37,1»).

Base anterior (sigue vigente): tinta oscura para lectura, gris cálido para separadores, naranja cálido solo para la acción de entrada en portada. Iconos outline consistentes con etiqueta visible en acciones importantes.

La aplicación debe conservar controles accesibles mediante teclado, foco visible, contraste legible y movimiento reducido cuando el sistema lo solicite.

## Portada viva (21 oct 2026)

Por decisión del usuario, el paisaje cambia con la hora real en Madrid (altura del sol calculada en `src/lib/sol.ts`); sustituye a la regla anterior de «sin animación ambiental»:

- Cielo: azul de día, hora dorada, crepúsculo rosa y violeta, noche con estrellas. Solo se tiñe el cielo (máscara `portada-cielo.png`); la ciudad se oscurece aparte.
- Farola: apagada de día; al anochecer se enciende con un par de parpadeos, titila y proyecta un cono de luz.
- Cartel de Mahou: las letras se iluminan (más de noche) y fallan de vez en cuando, como un rótulo viejo.
- Ventanas: se encienden al anochecer y de madrugada quedan una de cada cinco.
- Nubes: cinco cúmulos pintados en código (bordes de pincel y grano de lienzo) cruzan despacio de izquierda a derecha, por debajo del lema y por detrás de torres y edificios. Blancas de día, melocotón con el sol bajo, rosas al atardecer; de noche desaparecen.
- Cuatro Torres: un reflejo de sol cruza los cristales de día; de noche, plantas encendidas.
- Grano de película en movimiento sobre todo el cuadro.

Pocas cosas a la vez, lentas, y nada alrededor del título y los botones. Los cambios de luz tardan 50 s; con movimiento reducido se mantiene la luz de la hora y se quitan parpadeos, destellos y grano, y las nubes quedan quietas. Las capas se generan con `scripts/prepare-portada-capas.py` sin modificar el paisaje.

## Fase futura: Análisis / Mi mes

Documentar, pero NO implementar ahora:
- Selector de mes y filtros de periodo.
- Ingresos, gastos y balance mensual.
- Barras de gasto e ingreso por categoría.
- Evolución temporal y comparación entre periodos equivalentes.
- Acceso a los movimientos que forman cada agregado.
- Presupuestos, si se aprueban como funcionalidad posterior.

Definiciones futuras:
- Balance mensual = ingresos menos gastos del periodo; no equivale a saldo bancario.
- Saldo de cuentas requiere cuentas y saldos iniciales.
- Presupuesto restante requiere un presupuesto configurado.
- Si se incorporan cuentas y transferencias, las transferencias internas no cuentan como gasto ni ingreso.

Las cuentas múltiples, importación bancaria, sincronización y movimientos recurrentes no están definidos para esta fase; no agregarlos por suposición.

## Datos y persistencia

SQLite local y persistente, fuera de la carpeta de instalación reemplazable. Datos financieros separados del código y de los recursos de interfaz. Preparar migraciones y conservar los datos al actualizar la aplicación. Incluir copia de seguridad y restauración en el plan técnico; el mecanismo concreto se definirá antes de dar la aplicación por lista para uso real. No usar localStorage como almacenamiento principal de las finanzas.

## Criterios de aceptación para el agente implementador

1. Abrir la app muestra el paisaje de Madrid con Estrecho, el cartel Mahou y el skyline reconocibles; Finario aparece más grande, seguido de la frase latina exacta. Los dos títulos antiguos han desaparecido.
2. La dirección visual reproduce la textura y composición de la referencia, no solo un color.
3. Gastos e ingresos abre la pantalla de registro y Inicio permite volver.
4. Análisis muestra Próximamente y no abre una sección funcional.
5. No se implementan Mi mes, resumen mensual, presupuestos ni gráficas todavía.
6. Registrar, editar y eliminar movimientos conserva datos coherentes tras cerrar y reabrir.
7. Los títulos y botones son componentes reales, no píxeles incrustados en el fondo.
8. La app funciona offline y la interfaz nueva no contiene movimientos ficticios.
9. El formulario y los botones principales se pueden usar con teclado.
10. La portada y el registro mantienen sus elementos esenciales visibles al redimensionar la ventana.
