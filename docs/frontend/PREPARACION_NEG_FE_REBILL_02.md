# Preparación Frontend — NEG-FE-REBILL-02

Fecha: 2026-10-31. Estado: **preparación documental terminada; implementación de las nuevas acciones pendiente de entrega Backend**.

Fuente funcional: [Contrato de ejecución Frontend](../negocio/CONTRATO_FRONTEND_REFACTURACION_DRAFT.md). Este plan traduce ese contrato a entregables frontend; no lo sustituye ni publica endpoints. En esta revisión no se modificó código de producto ni se ejecutaron operaciones sobre datos.

## Estado contrastado con disco

| Capacidad | Evidencia | Estado |
| --- | --- | --- |
| Regresar factura a Clinical | Ruta `/:id/reopen-encounter` en [invoice.routes.ts](../../backend/src/modules/invoices/invoice.routes.ts); componente [return-to-care.tsx](../../frontend/src/features/billing/return-to-care.tsx) | Existe en código; no se volvió a acreditar su aceptación real en esta revisión |
| Reconstruir factura | API y acción en [appointment-billing.tsx](../../frontend/src/features/billing/appointment-billing.tsx) | Existe; se conserva el ID/número de factura y el flujo de firma |
| Retirar asignación de un Draft | [declaration.routes.ts](../../backend/src/modules/declarations/declaration.routes.ts) y [declaration-api.ts](../../frontend/src/features/declarations/declaration-api.ts) | No existe la operación DELETE propuesta |
| Cancelar un Draft | Mismos módulos de declaraciones | No existe la operación POST `/cancel` propuesta |
| Detalle de asignaciones bloqueantes | [invoice-clinical-reopen.service.ts](../../backend/src/modules/invoices/invoice-clinical-reopen.service.ts) devuelve actualmente el 409 general | No publica `error.details.assignments` |
| Errores accesibles en confirmación | [confirm-dialog.tsx](../../frontend/src/components/ui/confirm-dialog.tsx) ya admite un error dentro del modal | Reutilizable; las acciones nuevas necesitan motivo y contexto propios |
| Cierre de una corrección | [invoice-detail-page.tsx](../../frontend/src/features/billing/invoice-detail-page.tsx) muestra Close invoice con `invoice.close` | Ajuste pendiente: exigir además `invoice.apply_correction` al cerrar una versión CORRECTION, también en el control previo al envío |

El código actual no habilita las dos mutaciones nuevas. No se añadió un botón que termine en una ruta inexistente ni un resultado simulado.

## Entrega requerida a Backend antes de habilitar acciones

Estas rutas siguen siendo propuestas del contrato de Negocio, no API publicada:

| Operación propuesta bajo `/api/v1` | Cuerpo | Respuesta requerida |
| --- | --- | --- |
| `DELETE /declarations/:declarationId/items/:declarationItemId` | `{ reason: string }` | 200 con envelope y DTO `Declaration` completo actualizado |
| `POST /declarations/:declarationId/cancel` | `{ reason: string }` | 200 con el mismo DTO y estado CANCELLED |

Permiso de mutación: `declaration.update`. Acceso a la página: `declaration.read`. Motivo recortado obligatorio de 1–500 caracteres. Para DELETE, el identificador es `DeclarationItem.id`, **no** `invoiceItemId`; debe comprobarse el transporte real del cuerpo JSON.

Backend debe entregar conjuntamente:

- Rutas montadas, validación estricta, permisos/aislamiento, OpenAPI, API Freeze y handoff actualizados.
- Transacción y auditoría de retiro/cancelación, serializadas con agregar ítems, READY/exportación y regreso a Clinical. Las pruebas deben cubrir conflicto concurrente y rollback de auditoría.
- Los nuevos códigos `DECLARATION_ITEM_NOT_FOUND` y `DECLARATION_HAS_EXPORTS_OR_SUBMISSIONS`, además de los códigos existentes descritos por Negocio.
- Ampliación de `INVOICE_DECLARATION_ASSIGNED` con `error.details.assignments`, solo para actores con `declaration.read`; compatibilidad con el error antiguo sin detalles.
- PostgreSQL local dedicado con sufijo `_test`, baseline/fixtures y evidencias de sus comprobaciones. No utilizar Supabase operativo para esas suites.

La comprobación de entrega es documental y de rutas/OpenAPI, complementada con HTTP en QA. Un 404 aislado no demuestra disponibilidad ni actúa como detección de capacidades. No habrá habilitación automática por nombres de rol, por un reporte de chat o por capturar un error y fingir éxito.

## Secuencia de implementación

| Paso | Trabajo y archivos | Condición de salida |
| --- | --- | --- |
| FE-01 | Confirmar entrega Backend y contrastar DTO/errores reales con el contrato | Dependencias publicadas y entorno QA identificado |
| FE-02 | Funciones tipadas en `declaration-api.ts`; motivo con Zod/React Hook Form; mensajes centrales en `error-messages.ts` | DELETE con JSON correcto, IDs string y respuestas/errores comprobados con dobles explícitos |
| FE-03 | Diálogos del módulo y acciones en `declaration-detail-page.tsx` | Solo Draft + permiso; motivo/contexto visibles; sin cambios optimistas |
| FE-04 | Bloqueo detallado en `return-to-care.tsx`, validación de `details` y navegación de resolución | Enlaces internos seguros, soporte de error antiguo y regreso explícito a la factura |
| FE-05 | Caché después del éxito y recarga de versión vigente; completar permisos del cierre en `invoice-detail-page.tsx` | No reapertura automática ni envío con una versión esperada obsoleta |
| FE-06 | Regresión Declarations/Billing/Clinical, recorrido QA y evidencia | Criterios de aceptación cumplidos con resultados reales y pendientes declarados |

Se pueden preparar tipos internos, validadores y pruebas con dobles antes de FE-01 si se solicita esa implementación. Las nuevas acciones de producción permanecerán sin habilitar hasta la publicación Backend. Esta entrega solo prepara el trabajo.

## Comportamiento de interfaz

En Declaration detail, Remove item aparece por fila y Cancel draft declaration aparece para el lote, incluso vacío. Ambas acciones requieren DRAFT y `declaration.update`; la página conserva `declaration.read`. READY, EXPORTED, SUBMITTED, ACCEPTED, PARTIALLY_REJECTED, REJECTED y CANCELLED no ofrecen esas mutaciones.

Los diálogos usarán textos en inglés y motivo obligatorio. Para retirar, mostrar número/identificador de declaración, invoice number snapshot, `DeclarationItem.id` y `invoiceItemId` claramente diferenciados. Para cancelar, explicar que se conserva el historial y que afecta a todo el Draft. No renumerar las filas restantes ni alterar sus importes desde la interfaz.

Durante una mutación se bloquean acciones incompatibles de la página y el cierre del diálogo. Ante fallo se conserva el motivo y se muestra `role="alert"` dentro del modal. Al cancelar o abrir otra operación se limpian motivo/error. No retirar filas ni mostrar CANCELLED hasta obtener éxito autoritativo. Tras un fallo de red con resultado incierto, ofrecer recarga; conservar `retry: false` para mutaciones y no repetir silenciosamente una operación.

### Bloqueo de regreso a Clinical

`ApiError.details` es `unknown`: validar antes de usar. Para cada asignación aceptada, exigir IDs como strings decimales positivos, `declarationNumber` string o null, estado conocido y arreglo de pares `declarationItemId`/`invoiceItemId` válidos. Los enlaces se construyen con rutas internas fijas e IDs validados, nunca con URLs recibidas del servidor.

Sin `declaration.read`, sin detalles o con payload inválido, mantener el mensaje general y no construir enlaces inventados. Con datos válidos y permiso, ofrecer Open declaration. Un número null usa el identificador como etiqueta de respaldo. Una lista vacía o parcial no permite declarar localmente que la factura quedó desbloqueada.

Para DRAFT explicar que deben resolverse **todas** las asignaciones activas de esa factura, también en otros lotes. Para estados posteriores indicar que este flujo no los modifica. El detalle informativo no concede permisos para retirar o cancelar.

### Volver a la invoice y reintentar

Conservar el `invoice.id` conocido del diálogo de origen como contexto de navegación frontend, validado al leerlo; no deducirlo de `invoiceNumberSnapshot`, `invoiceItemId` ni `DeclarationItem.id`. Propuesta de implementación: parámetro frontend `returnInvoiceId` al abrir el detalle de declaración, sin reenviarlo como un campo nuevo del API. Permite recuperar el contexto al recargar y construir exclusivamente `/invoices/:id`; no admite una URL de retorno arbitraria. La lectura de esa invoice sigue sujeta a permisos/organización del backend.

Al resolver la declaración, ofrecer Back to invoice cuando exista contexto válido y `invoice.read`. Si se entró directamente a la declaración sin contexto, no inventar una asociación que el DTO no contiene. La vuelta reconsulta la invoice; el siguiente intento de Return to clinical care exige confirmación y motivo del usuario, usando el `currentVersionId` recibido en esa lectura. No se reabre atención ni se crea otra versión/factura por resolver la declaración.

## Estado remoto y caché

Tras éxito, aplicar el `Declaration` devuelto en `declarationKeys.detail(id)` y sus ítems en la caché correspondiente; luego invalidar `declarationKeys.detail/items/lists`, `invoiceKeys.lists()`, el detalle de la invoice de origen conocida y `dashboardKeys.all`. Si no se conocen las invoices afectadas por la cancelación de un lote, se puede invalidar el prefijo `invoiceKeys.all` en vez de inferir IDs. No calcular elegibilidad con las páginas cargadas ni totales monetarios en JS.

No duplicar el catálogo Clinical/Services ni los componentes de firma. Firma, documentos y snapshots se consultan para la versión exacta. Una versión nueva vacía no se prepara para firma; la reconstrucción usa la operación existente. El cierre de una versión CORRECTION requiere `invoice.close` y `invoice.apply_correction`; una versión ORIGINAL conserva sus permisos existentes.

## Matriz de aceptación y evidencias a producir

| ID | Escenario | Evidencia de aceptación |
| --- | --- | --- |
| A01 | Retiro Draft con motivo válido | Solo desaparece la asignación seleccionada; sin renumeración, recálculo o cambio de factura/documentos |
| A02 | Cancelación Draft con ítems y vacío | CANCELLED conserva número/snapshots; el Draft vacío no pasa a READY |
| A03 | Motivo vacío, espacios y longitud >500 | Bloqueo en cliente y validación Backend; mensaje accesible y datos conservados |
| A04 | Estado distinto de Draft o cambio concurrente | Acción ausente o 409, sin éxito ficticio; refetch muestra el estado real |
| A05 | Permisos independientes y otra organización | Acciones ocultas, 403/404; no exposición de detalles/enlaces sin `declaration.read` |
| A06 | IDs de asignación e invoice item diferentes, mayores que Number.MAX_SAFE_INTEGER | Se envía exactamente `DeclarationItem.id` como string; ningún cast numérico |
| A07 | Dos líneas de una invoice y otro lote activo | Resolver una línea/lote no autoriza localmente el regreso; Backend mantiene el bloqueo restante |
| A08 | Error de bloqueo antiguo, malformado o con número null | Fallback seguro; enlaces solo para IDs validados; ningún enlace externo |
| A09 | Red fallida, conflicto y nueva apertura/cancelación del modal | Motivo conservado en fallo; error dentro del modal; limpieza al cancelar; sin reintento automático |
| A10 | Regreso al detalle tras resolver y recarga de página | Contexto de retorno seguro, invoice reconsultada, versión esperada vigente y nueva confirmación explícita |
| A11 | Ciclo completo de refacturación | Misma invoice/número, fuente intacta, VOID histórico, liberación de autorización una vez, reconstrucción Decimal y nueva firma |
| A12 | Permisos de cierre de corrección | No se muestra ni se ejecuta con solo `invoice.close`; requiere además `invoice.apply_correction` |
| A13 | PDFs/versiones y catálogo compartido | Descarga del PDF nuevo y anterior; hashes/contenido histórico conservados; sin regresión de catálogo |
| A14 | Teclado y móvil/escritorio | Foco, alertas, botones pendientes y navegación operables en las resoluciones QA documentadas |
| A15 | Carreras y fallo de auditoría | Evidencia Backend en PostgreSQL dedicado; los dobles frontend no acreditan serialización ni rollback |

Pruebas frontend previstas: `declarations.test.tsx`, `billing.test.tsx`, `clinical.test.tsx` y pruebas focalizadas del validador de asignaciones. El fixture debe distinguir los dos tipos de ID, incluir varias líneas/lotes y preservar copias/hashes de las versiones anteriores. Las firmas QA nuevas y escrituras del recorrido solo se ejecutarán en el entorno sintético identificado y con la autorización aplicable al momento.

## Entrega y límites de esta preparación

- Se leyó el contrato y se contrastaron rutas montadas, servicio de bloqueo, UI, tipos, caché, API Freeze, handoff y checklist.
- Solo se crean este plan y su referencia en la guía Frontend. El contrato de Negocio y los cambios locales existentes permanecen intactos.
- Las comprobaciones actuales son de rutas/enlaces y diff documental. No se ejecutaron suites de producto, backend HTTP, migraciones, seeds, limpieza ni escrituras a la base. No se reutilizan conteos históricos como resultados frescos.
- Para una entrega de implementación: frontend lint/build/tests, Backend checks e integraciones con PostgreSQL dedicado, más evidencia del recorrido completo en navegador. Hasta entonces, NEG-FE-REBILL-02 sigue pendiente de implementación/aceptación.

Referencias adicionales: [reglas actuales de regreso/refacturación](../../backend/docs/CLINICAL_REBILLING.md), [API Freeze](../../backend/docs/API_FREEZE_BACKEND.md), [handoff](../../backend/docs/FRONTEND_HANDOFF.md), [checklist](../../backend/docs/BACKEND_RELEASE_CHECKLIST.md).
