# Contrato de ejecución Frontend — desbloqueo de declaraciones Draft y refacturación

Fecha: 2026-10-31. Identificador: NEG-FE-REBILL-02.

## Estado y responsables

Este documento define el trabajo pendiente solicitado por el usuario. Es una especificación de entrega; no acredita implementación ni aceptación en PostgreSQL.

El flujo de regreso a Clinical y refacturación ya existe en código. Las operaciones de retirar ítems y cancelar declaraciones descritas aquí **todavía no están implementadas**. Backend debe publicarlas con sus pruebas y actualizar OpenAPI/API Freeze antes de que Frontend las habilite. Frontend no debe simular éxito, utilizar rutas inexistentes como si estuvieran disponibles ni acceder directamente a Supabase. Puede preparar pruebas con dobles explícitos y ejecutar la regresión del flujo existente en un entorno de pruebas disponible.

- Negocio: reglas, precondiciones y aceptación de este contrato.
- Backend: nuevas operaciones, permisos, aislamiento, transacciones, auditoría y detalle del bloqueo.
- Frontend: interfaz, consumo HTTP, caché, errores y aceptación en navegador.
- Base de datos/Backend: proporcionar y verificar PostgreSQL de pruebas dedicado.

Referencias vigentes: [flujo existente](../../backend/docs/CLINICAL_REBILLING.md), [API](../../backend/docs/API_FREEZE_BACKEND.md), [handoff](../../backend/docs/FRONTEND_HANDOFF.md), [checklist](../../backend/docs/BACKEND_RELEASE_CHECKLIST.md), [guía Frontend](../frontend/README.md) e [instrucciones Frontend](../../frontend/AGENTS.md).

## Resultado esperado

Admin debe poder resolver una asignación equivocada de una factura a una declaración Draft, regresar a Clinical, corregir servicios, completar la atención y reconstruir la factura con una nueva firma. Se conserva una sola factura lógica, su número y todas sus versiones/documentos anteriores.

Los profesionales conservan la posibilidad de quitar y volver a agregar un servicio antes de completar una atención OPEN. Admin recibe todos los permisos configurados; las comprobaciones siguen utilizando permisos y organización, sin condiciones por nombre de rol.

## Reglas de declaraciones

| Estado del lote | Retirar ítem | Cancelar lote con este contrato | Regreso de factura a Clinical |
| --- | --- | --- | --- |
| DRAFT | Permitido con permiso y confirmación | Permitido con permiso y confirmación | Bloqueado mientras quede cualquier asignación activa de la factura |
| CANCELLED | No editable | Sin acción adicional | Este lote no bloquea; otros lotes activos sí pueden bloquear |
| READY, EXPORTED, SUBMITTED, ACCEPTED, PARTIALLY_REJECTED, REJECTED | No permitido | No permitido | Se mantiene el bloqueo mientras exista asignación activa |

Retirar un ítem elimina únicamente su asignación del Draft; no elimina ni cambia factura, procedimiento, firma, PDF ni consumo de autorización clínica. Backend conserva en auditoría el ítem retirado y su snapshot previo. No renumerar los ítems restantes desde Frontend. Se permite un Draft vacío, que no puede pasar a READY.

Cancelar un Draft cambia su estado a CANCELLED, conserva número, ítems y snapshots y registra motivo/actor/historial. Sus asignaciones dejan de bloquear disponibilidad porque el lote está cancelado. No hay eliminación física del lote ni transmisión externa SVB.

Todas las asignaciones de los ítems de una factura a lotes no cancelados deben resolverse antes del regreso a Clinical. Retirar una sola línea no basta si quedan otras líneas de esa factura en el mismo lote o en otro. Frontend no decide esta elegibilidad a partir de las páginas cargadas: Backend es la autoridad.

## API nueva requerida a Backend — pendiente de implementación

Prefijo `/api/v1`, Bearer actual y envelopes existentes. Sin acceso directo a base. Cuerpos estrictos; `reason` es string recortado, obligatorio, de 1 a 500 caracteres. IDs y Decimal son strings. Backend obtiene organización y actor de la sesión.

| Método y ruta propuesta | Permiso | Éxito |
| --- | --- | --- |
| `DELETE /declarations/:declarationId/items/:declarationItemId` | `declaration.update` | HTTP 200, `{ success: true, data: Declaration }`, DTO completo actualizado |
| `POST /declarations/:declarationId/cancel` | `declaration.update` | HTTP 200, mismo envelope/DTO, `data.status = "CANCELLED"` |

Ambas operaciones reciben JSON:

```json
{ "reason": "Invoice selected by mistake" }
```

`declarationItemId` es `DeclarationItem.id`, distinto de `invoiceItemId`. La operación DELETE requiere transportar ese cuerpo JSON; Backend debe documentarlo y probarlo. La respuesta usa el DTO de declaración existente, sin que Frontend invente nuevos campos como `cancelledAt`.

Precondiciones verificadas dentro de la transacción: permiso, propiedad de la organización, existencia del lote, pertenencia del ítem al lote cuando corresponda, estado DRAFT y ausencia de evidencia de exportación/envío. Backend debe serializar estas operaciones con agregar ítems, READY y exportación; revalidar el estado después de adquirir el bloqueo. Mutación, auditoría y cambios de historial deben confirmar o revertirse juntos. Si cambia el estado concurrentemente, se devuelve conflicto, nunca un éxito sobre un lote ya congelado.

Errores comunes existentes: 400 `INVALID_ID`/`VALIDATION_ERROR`, 401 de autenticación, 403 `PERMISSION_DENIED`, 404 `DECLARATION_NOT_FOUND`, 409 `DECLARATION_NOT_EDITABLE`. Un lote de otra organización responde como no encontrado. Retiro de ítem inexistente o de otro lote: nuevo 404 `DECLARATION_ITEM_NOT_FOUND`. Un Draft inconsistente con exports/submissions: nuevo 409 `DECLARATION_HAS_EXPORTS_OR_SUBMISSIONS`. Cancelar de nuevo un lote CANCELLED responde 409 `DECLARATION_NOT_EDITABLE`; no genera una segunda cancelación.

Acciones de auditoría propuestas: `DECLARATION_ITEM_REMOVE` y `DECLARATION_CANCEL`. Backend debe registrar actor, organización, motivo, entidad, snapshot previo y estado resultante, sin exponer secretos. La cancelación registra también la transición DRAFT → CANCELLED.

## Ampliación requerida del error de bloqueo — pendiente de implementación

Conservar HTTP 409 y código `INVOICE_DECLARATION_ASSIGNED` en `POST /invoices/:id/reopen-encounter`. Para actores con `declaration.read`, Backend añadirá en `error.details.assignments` los lotes bloqueantes de su organización y las líneas asignadas. Ejemplo ilustrativo; los IDs/valores reales provienen de Backend:

```json
{
  "success": false,
  "error": {
    "code": "INVOICE_DECLARATION_ASSIGNED",
    "message": "Invoice belongs to active declarations",
    "details": {
      "assignments": [
        {
          "declarationId": "321",
          "declarationNumber": "DECL-EXAMPLE",
          "status": "DRAFT",
          "items": [
            { "declarationItemId": "654", "invoiceItemId": "987" }
          ]
        }
      ]
    }
  }
}
```

`declarationNumber` puede ser null. Sin `declaration.read`, no se exponen esos detalles. Frontend valida los datos de `details` antes de construir enlaces internos. Debe soportar la respuesta antigua sin `details`: mostrar el mensaje general y no inventar identificadores/enlaces. El detalle del bloqueo no concede permisos de lectura ni de edición.

## Trabajo que debe ejecutar Frontend

1. Leer las referencias anteriores y comprobar que Backend publicó las dos rutas y la ampliación del error. No habilitar las mutaciones nuevas hasta esa entrega. Registrar el bloqueo si falta una dependencia.
2. En Declaration detail, mostrar **Remove item** en cada fila únicamente con estado DRAFT y `declaration.update`. Mostrar **Cancel draft declaration** con la misma condición, incluso si no quedan ítems. La página sigue requiriendo `declaration.read`.
3. Cada acción abre confirmación accesible con motivo obligatorio. Para retiro: identificar declaración, factura e ítem y aclarar que se libera la asignación. Para cancelación: explicar que afecta a todo el Draft y conserva el historial. Usar textos de producción en inglés. La validación de texto vacío/longitud ocurre en cliente y servidor.
4. Deshabilitar envío y acciones incompatibles durante la mutación. Mostrar errores dentro del diálogo activo con `role="alert"`, conservar el motivo ante un fallo y limpiar error/motivo al cancelar o abrir otra operación. No retirar filas ni marcar lotes cancelados antes del éxito del servidor.
5. Añadir funciones tipadas en `declaration-api.ts` y errores centrales. Tras éxito, aplicar el DTO recibido e invalidar `declarationKeys.detail/items/lists`, listas de invoices, detalle de la invoice conocida y `dashboardKeys.all`. Reconsultar los datos que determine Backend; Frontend no calcula totales monetarios ni disponibilidad de declaración.
6. Ante `INVOICE_DECLARATION_ASSIGNED`, mostrar los lotes informados. Con `declaration.read`, ofrecer **Open declaration**; para Draft explicar cómo retirar todas las líneas de la factura o cancelar el Draft completo si corresponde. Para los demás estados, indicar que no pueden modificarse con este flujo y que el regreso sigue bloqueado. No retirar/cancelar automáticamente ni ampliar la cancelación a otros estados.
7. Permitir volver al detalle de la invoice desde la resolución del Draft. Recargar la invoice y usar su `currentVersionId` vigente; el usuario debe confirmar explícitamente un nuevo intento de regreso a Clinical. Resolver la declaración no reabre la atención ni crea una factura automáticamente.
8. Conservar el flujo existente de regreso, corrección clínica, refacturación, firma y cierre. No duplicar los componentes de firma ni el catálogo compartido Clinical/Services.

Archivos previstos: `frontend/src/features/declarations/declaration-detail-page.tsx`, `declaration-api.ts`, componentes de diálogo del módulo, `frontend/src/api/error-messages.ts`, `frontend/src/features/billing/return-to-care.tsx` y pruebas de Declarations/Billing/Clinical. Ajustar tipos únicamente a la entrega real del Backend. No sobrescribir los cambios locales existentes de declaraciones, Dashboard, PDF ni PostgreSQL.

## API existente que se conserva

| Paso | Operación existente | Permiso principal |
| --- | --- | --- |
| Regresar invoice | `POST /invoices/:id/reopen-encounter` con `{ reason, expectedVersionId }` | `invoice.apply_correction` + `encounter.update` + `procedure.update` |
| Ver atención | `GET /appointments/:appointmentId/clinical-encounter` | `encounter.read` |
| Quitar servicio | `DELETE /clinical-encounters/:encounterId/procedures/:procedureId` | `procedure.update` |
| Agregar servicio | `POST /clinical-encounters/:encounterId/procedures` | `procedure.update` |
| Completar atención | `POST /clinical-encounters/:encounterId/complete` | `encounter.complete` |
| Refacturar | `POST /appointments/:appointmentId/invoice` | `invoice.create` |
| Preparar/firma/cierre | Subrutas existentes de `/invoices/:id/versions/:versionId` | Permisos independientes actuales |

El regreso solo admite DRAFT/PENDING_SIGNATURE/SIGNED/CLOSED y una atención/cita completadas, sin corrección activa ni asignación a declaraciones activas. La cita sigue COMPLETED; la atención vuelve a OPEN. Se crea una nueva versión vacía y sin firma. Una versión vacía no puede prepararse para firma.

Al retirar un servicio facturado durante el regreso autorizado, Backend lo marca VOID conservando los snapshots anteriores y libera una sola vez su autorización. Un servicio nuevo vuelve a validar catálogo, tarifa, cobertura y autorización externa si aplica. Declarant ID organizacional no es autorización externa.

Después de completar Clinical, **Rebuild invoice from corrected services** conserva ID/número/seguro/moneda y usa los servicios PERFORMED vigentes. Se requiere al menos un servicio. Preparar, capturar otra firma, confirmar firmado y cerrar aplica la corrección y sustituye la versión anterior. El cierre de la corrección requiere `invoice.close` e `invoice.apply_correction`; no basta con mostrar el botón por el primer permiso. Conservar el acceso a versiones, firmas y PDF históricos.

## Aceptación obligatoria

| Caso | Resultado verificable |
| --- | --- |
| Admin y profesional | Admin dispone de las acciones por sus permisos; profesional quita/reagrega en OPEN sin necesitar permisos de corrección de factura |
| Retiro en Draft | Solo desaparece la asignación seleccionada; factura y sus documentos no cambian; motivo auditado |
| Cancelación de Draft | CANCELLED, número e ítems conservados; asignaciones de ese lote dejan de bloquear |
| Factura con varias líneas/lotes | Sigue bloqueada mientras quede cualquier asignación a otro lote activo |
| Draft vacío | Se muestra vacío y permite cancelar; READY continúa bloqueado por Backend |
| Estado posterior a Draft | No aparecen las acciones; petición directa o cambio concurrente devuelve 409 |
| Permisos y otra organización | Controles ocultos sin permiso; peticiones directas reciben 403/404 sin filtrar datos |
| Conflicto y fallo de red | Error visible en modal, sin éxito ficticio ni reintento destructivo automático; refrescar permite conocer el resultado real |
| Regreso a Clinical | Motivo y versión esperada como string; atención OPEN y nueva versión sin firma |
| Quitar/agregar y refacturar | VOID histórico conservado, cantidad autorizada liberada una vez, nueva tarifa validada y Decimal exacto; mismo invoice ID/número |
| Nueva firma y cierre | No reutiliza firma; cierre aplica corrección; hash, ítems, firma y PDF anteriores permanecen conservados |
| Concurrencia/rollback | Backend prueba retiro/cancelación contra READY y regreso simultáneo; fallo de auditoría revierte la operación |

La prueba de factura completa incluye una asignación Draft inicial, su retiro o cancelación, regreso, cambio real de un servicio, completar, reconstruir, firma nueva, cierre y descarga del PDF nuevo y anterior cuando existan. Comprobar que volver al detalle o recargar no muestra datos viejos y que las acciones son utilizables con teclado y en móvil/escritorio.

## Entorno, comprobaciones y entrega

Frontend ejecuta lint, build y tests actuales; Backend ejecuta typecheck, build, unitarias e integración adecuada. Las suites de integración necesitan `TEST_DATABASE_URL` hacia PostgreSQL local dedicado con sufijo `_test`, baseline/fixtures preparados por Backend/Base de datos y las protecciones existentes de `tests/setup-env.ts`. No ejecutar integración, migraciones, seeds ni limpieza contra datos clínicos o Supabase operativo.

La aceptación en navegador usa frontend/backend conectados a ese entorno de QA y registros sintéticos identificables. Si falta el entorno, entregar como pendiente de aceptación real, sin simular que la prueba pasó. Los conteos de pruebas de entregas anteriores no sirven como comprobación fresca.

La entrega de Frontend debe indicar archivos cambiados, rutas realmente consumidas, permisos/estados cubiertos, resultados de checks ejecutados, evidencia del recorrido de navegador, limitaciones y dependencias pendientes. No incluir tokens, credenciales ni datos clínicos. Actualizar su guía de área; no hacer commit, push o despliegue salvo solicitud posterior.
