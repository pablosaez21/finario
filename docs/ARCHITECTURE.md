# Arquitectura propuesta

Este documento es un plan técnico, no una descripción de código ya construido.

## Stack

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Escritorio | Tauri 2 | Ventana, integración local y empaquetado |
| Interfaz | React + TypeScript | Portada, formulario y movimientos |
| Compilación de interfaz | Vite, propuesta | Desarrollo y build de recursos |
| Lógica local | Rust, propuesta | Validación, operaciones SQLite y copias |
| Datos | SQLite | Movimientos, categorías, ajustes y migraciones |

Priorizar macOS, el entorno actual del usuario. No asumir que se requieren instaladores para otros sistemas. Resolver versiones concretas y librería SQLite durante el arranque técnico, según las versiones compatibles entonces. No requiere backend remoto, servidor contratado ni autenticación.

## Separación de responsabilidades

React recoge la entrada y muestra resultados. Comandos acotados de Tauri validan y ejecutan operaciones en Rust. Rust mantiene las reglas de importes, fechas, relaciones y persistencia. La interfaz solo confirma un guardado cuando la operación local finaliza correctamente.

No exponer SQL arbitrario a componentes visuales. Agrupar acceso a datos en un módulo. Mantener configuración y recursos empaquetados independientes de los archivos modificables del usuario.

## Modelo mínimo propuesto

### Categoría

- Identificador estable.
- Nombre.
- Tipo: gasto o ingreso.
- Clave de icono de una familia outline consistente.
- Orden y estado archivado.

El catálogo final está pendiente. Renombrar mantiene las relaciones; archivar conserva el historial. No eliminar en cascada los movimientos al modificar categorías.

### Movimiento

- Identificador estable.
- Tipo: gasto o ingreso.
- Importe positivo en céntimos enteros.
- Moneda: EUR como supuesto inicial.
- Identificador de categoría compatible con el tipo.
- Fecha del movimiento, como fecha de calendario YYYY-MM-DD.
- Concepto opcional.
- Fechas técnicas de creación y modificación.
- Marca de borrado recuperable si se adopta ese mecanismo.

Usar la fecha de calendario para determinar el periodo contable; no convertirla a medianoche UTC y desplazarla accidentalmente de día. Usar marcas técnicas de tiempo separadas para auditoría local. Validar importe, categoría y fecha en la frontera de persistencia. Parsear decimales de forma exacta, sin cálculos monetarios con coma flotante.

### Ajustes y esquema

Preferencias y versión del esquema, con migraciones ordenadas. No crear campos ni tablas de IA o análisis especulativos.

## Persistencia y copias

- Base de datos en el directorio de datos de la aplicación, no junto al binario ni dentro del repositorio.
- Activar y comprobar integridad referencial; operaciones relacionadas dentro de transacciones.
- Preservar los datos al cerrar, reiniciar y actualizar la aplicación.
- Diseñar exportación de copia completa y restauración antes de usar datos reales. Usar un mecanismo coherente de copia SQLite, no copiar a ciegas un archivo mientras hay escrituras pendientes.
- Antes de restaurar, validar formato/esquema, ofrecer una copia del estado actual y pedir confirmación de la sustitución.
- Definir retención y disparador de copias automáticas durante implementación; la ruta de copia debe ser accesible al usuario.
- Empezar con base vacía; fixtures de prueba separados y claramente ficticios.

## Recursos visuales

Empaquetar fondo, iconos y fuentes necesarias localmente. El fondo de Madrid definitivo debe excluir títulos y botones, mientras conserva la señal Estrecho y Mahou. La portada aprobada contiene UI incrustada y sirve solo de referencia.

## Decisiones abiertas

1. Catálogo inicial de categorías, antes de darlo por definitivo.
2. Confirmar EUR si el usuario necesita otra moneda; no construir conversión multimoneda por suposición.
3. Mecanismo y frecuencia concreta de las copias automáticas.
4. Distribución solo para el Mac actual o para otros equipos, cuando se prepare el instalador.

Estas decisiones no bloquean documentar o preparar las capas independientes. Cuentas múltiples, importación bancaria y sincronización quedan fuera del alcance actual.
