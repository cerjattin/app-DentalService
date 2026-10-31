# NEG-FUNC-03 — Organización actual y Declarant ID

Fecha: 2026-10-31. Prioridad propuesta: P1. Estado: **especificación pendiente de implementación Backend y Frontend**.

## Objetivo y evidencia

Permitir configurar la organización de la sesión desde Settings y eliminar la captura arbitraria del Declarant ID en declaraciones. En el checkout revisado existen `Organization.declarantId`, permisos `organization.read/update` y la página `/admin/settings`, pero no hay un módulo de organización montado y Settings es informativo. El [servicio de declaraciones](../../backend/src/modules/declarations/declaration.service.ts) aún admite un snapshot suministrado por el cliente. No dar MASTER-04A por implementado a partir de un reporte histórico.

Este contrato cubre una sola organización: la del actor autenticado. No crea organizaciones, no cambia la organización de una sesión y no publica un editor general de SystemSetting, secretos, Auth o infraestructura.

## API propuesta — todavía no disponible

Prefijo `/api/v1`; Bearer y envelopes actuales. Backend publica primero rutas, OpenAPI, validación, permisos, pruebas y handoff.

| Operación | Permiso | Resultado |
| --- | --- | --- |
| `GET /organization` | `organization.read` | 200 con `{ success: true, data: OrganizationSettings }` |
| `PATCH /organization` | `organization.update` | 200 con el mismo DTO actualizado |

DTO propuesto: `id: string`, `legalName: string`, `tradeName: string|null`, `declarantId: string|null`, `email: string|null`, `phone: string|null`, `timezone: "America/Curacao"`, `updatedAt: string` y `revision: string` opaco generado por Backend para controlar ediciones concurrentes. No devolver credenciales ni relaciones completas.

PATCH estricto: `expectedRevision` y `reason` obligatorios, más al menos uno de `legalName`, `tradeName`, `declarantId`, `email`, `phone`. Motivo recortado de 1–500 caracteres. No aceptar `organizationId`, `id`, `timezone`, activación/archivo, numeración ni campos de sistema. Omisión conserva valor; null solo se admite en campos anulables. Límites del modelo: nombres 200, email 320, teléfono 40. Validar email cuando no sea null y legalName no vacío.

`declarantId` conserva ceros iniciales y viaja como string. Para nuevas configuraciones, la regla técnica actual del exportador es de 1–5 dígitos; no se presenta como certificación oficial SVB. Null significa configuración pendiente y no se sustituye por un valor ficticio. Limpiar un ID existente requiere confirmación en UI y motivo, conservando el histórico. La validación actual de preparación de factura continúa rechazando un snapshot vacío.

Backend bloquea y relee la organización dentro de la transacción, verifica la revisión, aplica el cambio y escribe auditoría `ORGANIZATION_UPDATE` junto con él. La revisión debe detectar cambios sobre los campos de configuración; Frontend no la calcula. Un conflicto no sobrescribe la edición de otro operador. La restricción única de declarantId se conserva y traduce a error sin revelar otra organización.

Errores propuestos: 409 `ORGANIZATION_VERSION_CONFLICT`, 409 `DECLARANT_ID_ALREADY_EXISTS` y, para un Draft legado inconsistente, 409 `DECLARATION_LEGACY_DATA_CONFLICT`; errores existentes de validación/autenticación/permisos. 404 `ORGANIZATION_NOT_FOUND` si la organización de la sesión no existe o no está disponible. Nunca seleccionar una organización por un ID de cliente.

## Autoridad y snapshots — entrega coordinada obligatoria

Cambiar Settings no actualiza EncounterProcedure, InvoiceItem, InvoiceVersion, firmas, PDF ni declaraciones existentes. La factura nueva sigue obteniendo el Declarant ID desde la organización en Backend. Cambiar Settings tampoco desbloquea automáticamente una factura ya creada con snapshot incompleto: debe utilizarse una corrección admitida o una reconciliación explícita; no editar contenido firmado.

Para nuevas declaraciones, el Declarant ID es de administración del servidor. Propuesta coordinada con los contratos de declaraciones:

1. Retirar la captura manual de `declarantIdSnapshot` del formulario de creación. Backend rechaza un valor no nulo recibido del cliente con 400 `DECLARATION_DECLARANT_SERVER_MANAGED`; ausencia/null son aceptables durante la transición.
2. Crear el lote vacío con declarantIdSnapshot null. Al agregar el primer ítem, Backend toma el Declarant ID de su versión CLOSED vigente y lo congela en lote e ítem, dentro de la misma transacción.
3. Los siguientes ítems deben tener el mismo Declarant ID congelado de factura. Si difieren, 409 `DECLARATION_DECLARANT_MISMATCH`. Así se pueden declarar facturas históricas de una configuración anterior sin copiarles el ID actual ni permitir un override libre.
4. Un snapshot de factura ausente/inválido continúa siendo un bloqueo de datos. Los lotes y asignaciones históricos no se reescriben en masa. Backend debe diagnosticar los Draft legados inconsistentes y documentar su resolución antes de activar esta regla sobre ellos.

Actualizar juntos schemas/servicios de declaraciones, formulario, DTO/documentación y Postman. Este es un cambio propuesto de contrato; no se debe retirar el campo en un cliente que todavía dependa del comportamiento antiguo sin coordinar la entrega. No corregir la identidad fiscal mediante NumberOfTreatments o una autorización de paciente: son conceptos distintos.

## Trabajo Frontend

Reemplazar el estado informativo de Settings tras verificar la API publicada. Mostrar lectura con `organization.read`; habilitar edición solo con `organization.update`. No usar nombres de rol. Admin conserva el conjunto completo; los demás roles mantienen sus permisos explícitos.

Mostrar formulario con revisión, motivo, confirmación para cambio/limpieza del Declarant ID, errores junto al formulario y protección de notas sin guardar. En conflicto, conservar la edición y ofrecer recargar/comparar con los datos actuales; no reintentar automáticamente un PATCH con otra revisión. Tras guardar, actualizar/invalidate la consulta de organización; no regenerar documentos históricos ni recalcular importes en el navegador. Mostrar el Declarant ID congelado de las declaraciones como dato de lectura, incluido el estado aún no asignado de un Draft vacío.

## Aceptación y entrega

- Lectura y modificación de la organización del actor; peticiones con campos de otra organización rechazadas; permiso independiente del nombre de rol.
- Revisión obsoleta y duplicado de Declarant ID producen conflictos seguros; fallo de auditoría revierte el cambio.
- Guardar `"00123"` conserva sus ceros. Limpiar la configuración no modifica ningún snapshot anterior.
- Dos facturas de distinta época conservan sus respectivos snapshots; una nueva declaración se vincula al de su primer ítem y rechaza mezclar otro distinto.
- Nuevo formulario no permite override del Declarant ID; datos incompletos producen el bloqueo real de Backend, sin defaults.
- Validación Backend/Frontend e integración en PostgreSQL dedicado, más navegador en QA. Reportar pruebas realmente ejecutadas y archivos; no ejecutar contra datos clínicos.

Impacto: Backend Organization/Invoices/Declarations, Frontend Settings/Declarations y revisión de integridad por Base de datos. La preparación de este contrato no ejecuta cambios. Su implementación puede preparar los cambios de modelo necesarios y verificarlos en un entorno dedicado de pruebas; no ejecutar migraciones/seeds contra datos clínicos ni desplegar dentro de este alcance.

## Asistentes que deben atender y resolver

Responsable principal: **Odontho · Backend**, encargo B03. **Base de datos** resuelve DB03; **Frontend** implementa FE03 una vez entregada la API. Diseño revisa interacción; Negocio comprueba invariantes; Arquitectura coordina el cierre.

Los pasos concretos, archivos, aclaración del lote vacío después de retirar ítems, diagnóstico de Draft legados y texto de encargo están en [encargos ejecutables](ENCARGOS_ASISTENTES_FUNC03_05.md). Este detalle no acredita que la función esté implementada ni habilita por sí solo operaciones sobre datos.
