# Instrucciones para trabajar en Finario

## Contexto

Este repositorio nace como una entrega de planificación. Sigue el encargo activo del usuario: no conviertas una tarea de documentación en una implementación completa. Cuando se solicite implementar, usa el alcance de DESIGN.md y docs/IMPLEMENTATION.md.

## Lectura inicial

Lee README.md, DESIGN.md, docs/ARCHITECTURE.md y docs/IMPLEMENTATION.md. Abre visualmente ambas imágenes de docs/references; no deduzcas el diseño solo de los nombres de archivo.

## Decisiones que deben mantenerse

- Nombre aprobado: Finario. No reabrir el naming ni escribir financIA.
- En portada, Finario se muestra más grande que el rótulo antiguo, y debajo va exactamente: Pecunia, si uti scis, ancilla est; si nescis, domina
- Los textos Mis finanzas y Tu día a día, en Madrid. de las imágenes están obsoletos. Sustituir ambos, sin duplicar títulos.
- Preservar la segunda portada aprobada: textura granulada, Madrid, metro Estrecho discreto y cartel Mahou. La referencia 01 es la autoridad visual.
- Usar la referencia 02 para el interior, pero excluir Mi mes, resumen mensual, gráficas y presupuestos en esta fase.
- Análisis aparece como Próximamente y permanece desactivado.
- La portada se abre al iniciar la aplicación y es accesible desde el registro; no es una bienvenida de un solo uso.
- Datos en SQLite local; no reemplazar persistencia por datos en memoria o localStorage.
- No añadir IA, sincronización, conexión bancaria ni servicios externos por iniciativa propia.

## Forma de trabajar

- Las instrucciones actuales del usuario prevalecen sobre esta documentación y sobre las referencias históricas.
- La UI y los textos serán componentes reales superpuestos a un paisaje sin UI incrustada. Preparar el fondo limpio antes de utilizarlo en producción.
- Mantener los originales de referencia sin alterarlos. Crear derivados en una ubicación de recursos de la aplicación cuando corresponda.
- Tratar las categorías de las capturas como provisionales. Consultar el catálogo antes de fijarlo, continuando el trabajo independiente mientras tanto.
- Guardar dinero en céntimos enteros y comprobar validaciones también en la capa local de datos.
- No incluir bases de datos del usuario, copias de seguridad ni secretos en Git.
- Verificar persistencia tras reiniciar, edición, recuperación de borrado y errores de validación. Verificar las dos pantallas visualmente y con teclado.
- Al entregar implementación, actualizar README.md con comandos reales y comprobados. No documentar comandos inexistentes como funcionales.

## Verificación (comandos comprobados)

- `pnpm typecheck`, `pnpm build`, `pnpm test:rust` (incluye un test IPC con el runtime simulado de Tauri que fija el contrato con `src/lib/api.ts`), `pnpm app:build`.
- En este Mac, las Command Line Tools traen un SDK 27.0 más nuevo que su `ld`: anteponer `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk` a los comandos que compilan Rust.
- Las crates de Tauri están fijadas en `src-tauri/Cargo.lock` (tauri 2.11.6 con runtime 2.11.x). `tauri-runtime 2.12.0` rompe tauri 2.11; no ejecutar `cargo update` sin revisar.
- WebKit solo recorre con Tab los controles que tienen `tabindex`; `src/lib/keyboard.ts` lo asigna globalmente. Probar el teclado con WebKit, no con Chromium.
- Tipografías (Google Fonts, empaquetadas localmente con Fontsource): Fraunces en la portada y en el logotipo; Instrument Sans en el registro. Cualquier fuente del registro debe tener cifras tabulares (`tnum`).
- Algunas fuentes (p. ej. EB Garamond) sustituyen u→v si el texto tiene `lang="la"`: no marcar así la frase latina.
