# NEG-FUNC-04 — Candidatos de declaración y asignación exclusiva

Contrato de origen: 2026-10-31. Estado actualizado el 2026-11-02: **implementado en Backend/Frontend local**, con los límites de aceptación de la [verificación actual](VERIFICACION_CONTRATOS_03_05_20261102.md). La entrega concreta y los códigos de diagnóstico están en el [informe Backend](../../backend/docs/NEG_FUNC_03_04_05.md).

## Objetivo y evidencia

Sustituir la introducción manual de InvoiceItem IDs por selección de ítems reales y evitar asignar un ítem simultáneamente a dos declaraciones activas. La carencia inicial motivó el contrato; la entrega comprobada ya incluye candidatos, propiedad activa exclusiva, contador persistente y resolución Draft. No volver a implementar esas funciones por la descripción de origen.

Leer [NEG-FE-REBILL-02](CONTRATO_FRONTEND_REFACTURACION_DRAFT.md) para retiro/cancelación Draft y [NEG-FUNC-03](CONTRATO_ORGANIZACION_SVB.md) para el Declarant ID. La confirmación del usuario sobre el contrato anterior se registra en el índice; comprobar su entrega efectiva al integrar, sin volver a implementar rutas que ya estén disponibles.

## API de origen — publicada en la entrega local

`GET /api/v1/declarations/:declarationId/candidates`, con `declaration.read` e `invoice.read`. Solo para un Draft de la organización del actor. Respuesta paginada en el envelope existente: `data: DeclarationCandidate[]`, `meta: { page, pageSize, total, totalPages }`.

Query propuesta: `q` recortado hasta 120 caracteres; `from/to` opcionales YYYY-MM-DD sobre serviceDateSnapshot con extremos inclusivos; `page` inicial 1 y `pageSize` inicial 20/máximo 100. Validar fechas reales y orden del período. Los filtros de búsqueda no agregan reglas fiscales implícitas al POST de ítems. La UI puede inicializarlos con el período del lote, dejando visible el filtro aplicado.

Cada candidato expone:

```ts
type DeclarationCandidate = {
  invoiceId: string
  invoiceVersionId: string
  invoiceItemId: string
  invoiceNumber: string | null
  versionNumber: number
  detailInvoiceNumber: string | null
  serviceDate: string
  procedureCode: string
  procedureDescription: string
  providerIdSnapshot: string
  insuredIdSnapshot: string
  amount: string
  currencyCode: string
  svbReadiness: 'COMPLETE' | 'INCOMPLETE'
  issues: Array<{ field: string; code: string }>
}
```

IDs/Decimal son strings; amount tiene escala de dos decimales. El `invoiceItemId` es de la versión cerrada vigente; no confundirlo con EncounterProcedure.id ni DeclarationItem.id. Backend publica el enum de códigos y los campos posibles de issues antes de integrar; Frontend no evalúa ni reproduce la validación SVB.

## Elegibilidad y consistencia

Backend limita la selección a la organización y payer del lote, invoice CLOSED con versión actual CLOSED, y ausencia de asignación del ítem a cualquier lote no CANCELLED, incluido el lote consultado. También aplica la compatibilidad de Declarant ID de NEG-FUNC-03 una vez publicada. Excluir versiones SUPERSEDED, borradores, canceladas o en corrección. No derivar disponibilidad únicamente de un número de factura ni de las páginas visibles.

La disponibilidad de asignación y la preparación SVB son distintas. Un ítem disponible con campos SVB incompletos puede incorporarse al Draft, con diagnóstico visible, pero no se promete que READY/exportación vaya a aprobarlo. `svbReadiness` reutiliza la validación real de Backend y no equivale a autorización de envío ni aceptación de SVB. NumberOfTreatments y Assistance siguen sin defaults ni derivación de quantity.

`POST /declarations/:id/items` ya existe y mantiene cuerpo `{ invoiceItemId: string }` y su respuesta de ítem. Su servicio debe volver a comprobar todas las reglas dentro de la transacción, aunque el ítem se haya mostrado como candidato un instante antes. La consulta GET no reserva disponibilidad.

Extensión propuesta del POST:

- Duplicado dentro del mismo lote: conservar `DECLARATION_ITEM_ALREADY_EXISTS`.
- Asignado a otro lote activo: nuevo 409 `DECLARATION_ITEM_ASSIGNED`.
- Versión/payer/estado dejó de ser elegible: conservar los errores específicos actuales, incluido `DECLARATION_ITEM_NOT_ELIGIBLE`.
- Declarant ID incompatible: 409 `DECLARATION_DECLARANT_MISMATCH`, al publicar NEG-FUNC-03.
- GET sobre lote no Draft: 409 `DECLARATION_NOT_EDITABLE`; lote ajeno/inexistente: 404 `DECLARATION_NOT_FOUND`; validación/permisos/autenticación habituales.

Backend/Base de datos deben serializar la asignación por ítem y los cambios de estado del lote, contemplando add/remove/cancel, cierre de corrección y regreso a Clinical. No basta comprobar ausencia y luego insertar sin protección concurrente. Diseñar la integridad de asignaciones activas sin imponer una unicidad global que impida conservar ítems históricos de lotes cancelados. No inventar SQL o aplicar una migración desde Frontend.

Se conservan auditoría transaccional y asignación de números por Backend; no introducir ni perpetuar `MAX + 1` al modificar el caso de uso. El análisis de Base de datos debe definir la asignación segura de los ordinales que actualmente usa el servicio, sin renumerar snapshots históricos. Fallo de auditoría revierte asignación/consumo de numeración.

## Trabajo Frontend

Cambiar Add item por un buscador paginado con factura, versión, servicio, fecha, insured/provider, importe y moneda. Mostrar los issues devueltos y distinguir **Incomplete SVB data** de **Already assigned**. Mantener texto productivo en inglés. No reconstruir candidatos descargando todas las facturas ni pedir que se copien IDs de otras pantallas.

El MVP agrega un ítem por acción con `declaration.update`; no supone un endpoint bulk ni atomicidad de varias peticiones. Durante la mutación, deshabilitar el envío duplicado. Al recibir conflicto, mantener el diálogo, mostrar el error, actualizar candidatos e ítems y requerir otra selección; no reintentar una asignación destructiva automáticamente.

Tras éxito/integración con retiro y cancelación, invalidar candidatos del lote y otros candidatos almacenados que puedan compartir ítems, detail/items/lists de declaraciones, invoices afectadas y `dashboardKeys.all`. Frontend no suma monedas ni decide disponibilidad a partir del Dashboard. No exponer controles de mutación a quien solo tenga lectura.

## Aceptación y entrega

1. Paginación/búsqueda usan IDs string reales; no aparecen otro payer/organización ni versiones históricas sustituidas.
2. Ítem incompleto tiene diagnóstico de servidor; puede quedar Draft, pero READY falla con sus errores reales.
3. Dos peticiones concurrentes del mismo ítem para lotes distintos: solo una asignación activa confirma; la otra devuelve conflicto y la UI se actualiza.
4. Retiro/cancelación Draft libera disponibilidad según NEG-FE-REBILL-02; los snapshots de la factura y de lotes cancelados permanecen conservados.
5. Si queda una asignación activa en otro lote, el regreso a Clinical permanece bloqueado. No inferir exclusividad a partir de una única declaración visible.
6. Fallos de auditoría/transacción no dejan asignaciones parciales; sin permisos se rechaza la petición aunque se construya manualmente.
7. Confirmar comportamiento con corrección de factura y cambio concurrente a READY. No acreditar concurrencia/rollback solo con dobles de repositorio.

Backend entrega API/errores y diseño de integridad; Frontend consume después y actualiza pruebas Declarations/Billing/Dashboard. Ejecutar integración en PostgreSQL local dedicado y aceptación de navegador contra QA, sin operar sobre clínica. El estado de implementación y las pruebas comprobadas están en el informe del encabezado; esa evidencia no valida por sí sola formatos oficiales SVB.

## Asistentes que deben atender y resolver

Responsables iniciales: **Odontho · Base de datos** para DB04 y **Odontho · Backend** para B04; deben entregar exclusividad y ordinales concretos, además de la consulta. **Frontend** ejecuta FE04 después de su publicación; Diseño, Negocio y Arquitectura revisan UX, reglas y aceptación respectivamente.

Consultar [encargos ejecutables](ENCARGOS_ASISTENTES_FUNC03_05.md) para pasos, archivos, pruebas concurrentes y condiciones de cierre. No editar el servicio de declaraciones simultáneamente con B03 ni reemplazar una prueba de integridad real por dobles de repositorio.
