# Acuerdo de persistencia Dentalink — OPS-03

Acuerdo técnico propuesto el 7 de noviembre de 2026 a partir de los requisitos de Backend. Alcance local y sintético. Los datos de Excel y la clínica se mantienen en su encargo independiente.

## Modelo para implementación

| Prisma / tabla | Contenido y restricciones |
| --- | --- |
| DentalinkAccount / dentalink_accounts | id, organizationId, externalAccountId textual exacto, label, enabled=false, createdAt, updatedAt. Cuenta única por organización. Sin token ni URL |
| DentalinkMapping / dentalink_mappings | id, organizationId, accountId, kind PROVIDER/LOCATION, externalId, providerId? o clinicLocationId?, createdAt, updatedAt. Único por cuenta/tipo/ID. Check exige exactamente la FK del tipo declarado |
| DentalinkImportRun / dentalink_import_runs | id, organizationId, accountId, requestKey, fromAt?, toAt?, cursor?, state READING/PREVIEW_READY/CONFIRMED, previewHash?, confirmKey?, confirmHash?, counts JSON objeto, createdByUserId, createdAt, updatedAt, confirmedAt?. Claves de request y confirm únicas por cuenta |
| DentalinkImportItem / dentalink_import_items | id, organizationId, accountId, runId, entityType PATIENT/APPOINTMENT, externalId, payloadJson normalizado, payloadHash SHA256, disposition READY/ISSUE/IMPORTED/SKIPPED, issueCodes JSON array, patientId? o appointmentId?, createdAt, updatedAt. Único por ejecución/tipo/ID |
| DentalinkExternalIdentity / dentalink_external_identities | id, organizationId, accountId, entityType PATIENT/APPOINTMENT, externalId, patientId? o appointmentId?, createdAt. Único por cuenta/tipo/ID externo y por cuenta/ID local de cada tipo |

## Reglas acordadas

- Los IDs externos/cuentas y claves idempotentes usan collation C. El payload es exclusivamente el DTO normalizado validado por Backend y se preserva en la tabla privada para confirmar la vista previa congelada. Logs y auditorías de operaciones incluyen solo hashes, conteos y códigos. Nunca tokens ni respuestas HTTP crudas.
- La cita nueva entra SCHEDULED. La preparación no agrega un mapa STATUS porque el contrato exige confirmación local y todavía no hay estados externos oficiales.
- Se habilita RLS en las cinco tablas sin políticas públicas. Express aplica organización y permisos. FKs compuestas preservan pertenencia de cuenta, ejecución, usuario creador, paciente, cita, profesional y sede. Todas las FKs son restrictivas.
- Backend bloquea cuenta/ejecución antes de confirmar, valida hash/clave de confirmación, crea paciente/cita y su identidad externa en una transacción con auditoría y contadores. Una página incompleta conserva cursor. El reintento consulta identidades confirmadas.
- Ninguna coincidencia de nombre/documento fusiona automáticamente. Las incidencias se conservan como códigos en los ítems.
- La secuencia transaccional asigna números de nuevos pacientes/citas. Los números históricos de Excel se preservan.
- Permisos dentalink.read/manage/import. ADMIN recibe los tres. RECEPTION recibe read/import y requiere además patient.create/appointment.create al confirmar. PROVIDER no recibe estos permisos.

## Límites

Campos externos máximos 255 caracteres y claves idempotentes 120 son límites internos de preparación, sujetos a contrastar con la referencia oficial. El cursor es estado interno del adaptador, sin credenciales ni payload personal. No hay adaptador HTTP real, API habilitada ni sincronización de clínica.

DB reserva schema, migraciones y generación del cliente. Backend confirmó reserva de qa-recovery.ts y pilot-recovery.test.ts para DB. Los nombres se publican antes de que Backend consuma el cliente.

