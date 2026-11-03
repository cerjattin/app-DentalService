# NEG-FUNC-05 — Registro y selección de casos de tratamiento

Contrato de origen: 2026-10-31. Estado actualizado el 2026-11-02: **implementado en Backend/Frontend local**, con los límites de aceptación de la [verificación actual](VERIFICACION_CONTRATOS_03_05_20261102.md). La API efectiva añade `isEditable` de servidor y protección persistente de primera vinculación; ver [entrega Backend](../../backend/docs/NEG_FUNC_03_04_05.md).

## Objetivo y evidencia

Permitir registrar un caso del paciente y seleccionarlo al crear/editar una cita, sin introducir manualmente claves internas. La carencia inicial ya tiene solución local: módulo montado de casos, permisos, formulario/selector y validación de contexto. Se conserva el vínculo entre TreatmentCase, Appointment y el snapshot externo del procedimiento.

Este contrato no inventa un sistema de numeración SVB ni la semántica de NumberOfTreatments/Assistance. TreatmentCase.id es una clave interna; treatmentId es una referencia externa distinta, aportada por una fuente autorizada. Tampoco crea un gestor general de accidentes/remitentes, ni cambia automáticamente estados de cita, atención o factura.

## API y permisos de origen — publicados en la entrega local

Prefijo `/api/v1`, envelopes y paginación actuales. Rutas limitadas al paciente y organización del actor:

| Operación | Permiso nuevo propuesto | Resultado |
| --- | --- | --- |
| `GET /patients/:patientId/treatment-cases` | `treatment_case.read` | 200, lista paginada |
| `GET /patients/:patientId/treatment-cases/:caseId` | `treatment_case.read` | 200, detalle |
| `POST /patients/:patientId/treatment-cases` | `treatment_case.manage` | 201, caso creado |
| `PATCH /patients/:patientId/treatment-cases/:caseId` | `treatment_case.manage` | 200, caso actualizado |

Backend/Base de datos deben crear los permisos y su asignación controlada antes de habilitar UI. Matriz propuesta para este alcance: Admin ambos permisos; Provider ambos; Reception lectura para seleccionar casos existentes. No permitir escritura porque exista lectura ni introducir checks por nombre de rol. Nuevos permisos no se consideran disponibles hasta su entrega en `/auth/me`.

DTO: `id`, `organizationId`, `patientId` como strings; `treatmentId: string|null`, `treatmentType: string|null`, `description: string|null`, `status`, `startedAt/completedAt` como timestamps ISO|null y `createdAt/updatedAt`. Estados legibles del modelo actual: PLANNED, ACTIVE, COMPLETED, CANCELLED. IDs internos y externos deben etiquetarse de forma distinta.

GET lista acepta `q` hasta 120 caracteres, `status` del enum actual y `page/pageSize` con defaults 1/20, máximo 100. Orden estable por createdAt e id. Backend filtra por el paciente de la ruta; no aceptar organización desde el query.

POST estricto: `treatmentId` externo no vacío y requerido para casos nuevos de este flujo; opcionales anulables `treatmentType` (hasta 100 caracteres) y `description` (hasta 5000). Para interoperar con el validador de exportación actual, el ID nuevo tiene como máximo 7 caracteres; esto refleja una restricción técnica existente, no una semántica SVB confirmada. Conservar texto y ceros iniciales; no generarlo de la cantidad, procedimiento, paciente o secuencia interna.

El servidor asigna patientId/organizationId/actor y estado inicial PLANNED. No acepta campos de sistema, estado ni timestamps clínicos suministrados por este formulario. La referencia externa se valida como única dentro del paciente, conservando la restricción actual.

PATCH admite los mismos tres campos, al menos uno. En esta primera entrega solo se edita un caso PLANNED que aún no esté vinculado a citas. No publicar DELETE ni transiciones de estados del caso; un lifecycle más amplio requiere su propio contrato. Los casos históricos se leen sin normalizarlos ni reescribirlos.

## Vinculación con citas y snapshots

Usar los `POST /appointments` y `PATCH /appointments/:id` existentes con `treatmentCaseId` como string|null. La selección permite casos PLANNED/ACTIVE del mismo paciente y organización; Backend valida la relación y el estado dentro del caso de uso de citas, tanto al crear como al cambiar la referencia. No fiarse de los valores recibidos de un selector.

Una cita con procedimientos/snapshots clínicos ya registrados no cambia su referencia mediante el PATCH ordinario. Propuesta: 409 `APPOINTMENT_CLINICAL_CONTEXT_LOCKED`. Un caso ajeno al paciente/organización responde como no encontrado; caso COMPLETED/CANCELLED no se admite para una nueva asignación. Las restantes reglas de agenda y permisos `appointment.create/update` se conservan.

El registro de un procedimiento copia el treatmentId externo de la referencia validada. Cambiar un maestro o completar otro caso no modifica snapshots previos de atención, factura, declaración, firma o PDF. Para corregir un histórico se utiliza una corrección autorizada y documentada, sin completar retroactivamente todo el histórico desde el caso actual.

No convertir PLANNED/ACTIVE del caso en equivalentes de OPEN/COMPLETED de la atención ni en un estado de agenda. El alcance mínimo registra y selecciona casos; no certifica el tratamiento como realizado por el solo hecho de crearlo o vincularlo.

Errores propuestos: 404 `TREATMENT_CASE_NOT_FOUND`; 409 `TREATMENT_ID_ALREADY_EXISTS`, `TREATMENT_CASE_NOT_EDITABLE`, `TREATMENT_CASE_NOT_ASSIGNABLE`, `APPOINTMENT_CLINICAL_CONTEXT_LOCKED`; validación/autenticación/permisos y paciente no encontrado según los contratos actuales. No devolver datos del paciente real dueño de una referencia ajena.

Mutación y auditoría `TREATMENT_CASE_CREATE/UPDATE` dentro de una transacción; verificar que el paciente está activo y pertenece a la organización. Serializar edición de caso con su primera vinculación para no permitir editarlo después de haber sido utilizado. No ejecutar seeds o migraciones sobre datos clínicos para habilitar el flujo.

## Trabajo Frontend

Añadir sección **Treatment cases** en detalle del paciente, con búsqueda, lectura y registro/edición por permisos. Mostrar **External treatment ID**, estado y descripción; no mostrar un campo editable para la clave interna. El botón de edición solo aparece para el caso editable publicado por el contrato; Backend sigue siendo la autoridad final.

En creación/edición compartida de citas, añadir selector paginado ligado al paciente actual. Cambiar de paciente limpia la selección anterior; no reutilizar una selección de otra persona. Con falta de permiso de lectura, informar que no puede seleccionar un caso; no pedir copiar una clave numérica. Sin permiso de gestión, permitir escoger un caso existente, sin crear uno.

Los campos y snapshots de Treatment context en Clinical distinguen la referencia externa de la interna. Guardado con error mantiene el formulario; cambios pendientes requieren protección al salir. Invalidar lista/detalle de casos del paciente y citas afectadas tras las mutaciones; no alterar catálogos ni regenerar documentos históricos.

## Aceptación y dependencias

- Admin y Provider registran con permisos explícitos; Reception selecciona, sin que lectura conceda gestión.
- No se puede asociar un caso de otro paciente/organización, incluso mediante petición HTTP directa.
- Cambiar de paciente limpia el caso; creación/edición de citas conserva sus controles de agenda actuales.
- Estado inicial PLANNED y claves internas del servidor; ID externo con ceros iniciales permanece exacto. Duplicados reciben conflicto.
- Caso utilizado deja de ser editable por este flujo. Primera vinculación/edición concurrentes respetan esa regla.
- Un procedimiento nuevo congela el ID externo correcto; cambios posteriores no reescriben históricos.
- Históricos sin TreatmentId no reciben valores inventados; NumberOfTreatments y Assistance siguen nulos si no hay fuente autorizada.
- Probar permisos, enlaces cruzados, snapshot y rollback en Backend/PostgreSQL dedicado; probar selector y formulario en Frontend/navegador QA.

Esta función facilita completar TreatmentId, pero no elimina los demás bloqueos de preparación SVB. El alcance de formatos/valores oficiales y los códigos PoliClinic continúan siendo dependencias propias. Backend publica primero rutas/DTO/permisos/OpenAPI y handoff; Frontend habilita después. Informar archivos y checks reales, sin usar conteos históricos como evidencia fresca.

## Asistentes que deben atender y resolver

Responsable principal: **Odontho · Backend**, encargo B05. **Base de datos** resuelve DB05 (integridad/permisos/primera vinculación); **Frontend** implementa FE05 (sección del paciente y selector de citas). Diseño revisa la interacción; Negocio valida la semántica limitada; Arquitectura integra las evidencias.

Consultar [encargos ejecutables](ENCARGOS_ASISTENTES_FUNC03_05.md) para los archivos y pasos. Orden de lista precisado: createdAt DESC, id DESC. El encargo exige implementar y probar las validaciones de paciente/caso/cita, sin extender el lifecycle del caso ni completar campos SVB no definidos.
