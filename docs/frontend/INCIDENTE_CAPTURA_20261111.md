# Incidente de captura de servicios — 11 de noviembre de 2026

## Diagnóstico confirmado

El servicio Render `odontho-clinical-api`, `srv-dbmeut6tlv9c7386juc0`, publica el commit `04a8cf55c9d6e7991a0a0c754bc248e518910dde` desde el despliegue `dep-dbpn8gec6qcc73e0vr50`, terminado el 10 de noviembre. El usuario autorizó consultar los servicios y logs del espacio `My Workspace`.

Los errores de las 14:00:24, 14:00:51, 14:01:04 y 14:02:50 UTC muestran `PrismaClientKnownRequestError`, código `P2011`, con SQLSTATE `23502`. La causa registrada es `null value in column "patient_insurance_id" of relation "encounter_procedures" violates not-null constraint`. Una correlación representativa es `dd59e014-d7d2-4cb3-842c-cffa79b4876b`.

El método `recordService` captura servicio y cantidad y deja los seis campos de valoración pendientes hasta facturar. Antes de la corrección, la base consultada conservaba esos seis campos con `NOT NULL`. El cambio de pantalla del operador y su selección de catálogo son compatibles con el contrato OPS.

## Inventario de Supabase en lectura

Se consultó el proyecto configurado localmente `tlfdwmaofwpwlcgrhfps`, base `postgres`, por el pooler de sesión `aws-1-ca-central-1.pooler.supabase.com:5432`, usando TLS con validación de certificado y una transacción `READ ONLY`. El usuario confirmó que es el proyecto utilizado por Render y autorizó posteriormente la corrección acotada.

Antes de la corrección, la base tenía aplicado solamente `20261030000000_init`. Su checksum coincidía con el repositorio. Las siete migraciones posteriores estaban pendientes, los seis campos de valoración eran obligatorios y faltaba `ck_encounter_procedure_billing_context`. Los conteos de procedimientos valorados, pendientes e incompatibles fueron cero al consultar.

El preflight existente también encontró dos evidencias de ordinal sin lote resoluble y un contexto histórico de tratamiento incompatible. Esos hallazgos bloquean una aplicación indiscriminada de toda la cadena. Los dos declarantes inválidos adicionales requieren revisión funcional. Los diagnósticos se limitan a metadatos y conteos.

[Inventario y preflight](evidence/incident-20261111/supabase-readonly.json)

## Corrección acotada aplicada

La migración existente [20261106000000_service_attention](../../backend/prisma/postgresql/migrations/20261106000000_service_attention/migration.sql) es independiente de las tablas de las otras seis pendientes. Su SHA-256 es `be062be02e172125a17f1f7ed6ee7bcacc702829708ae099c004342366268e4d`.

Sus efectos son los siguientes.

- Admite NULL en `patient_insurance_id`, `svb_tariff_id`, `insured_id_snapshot`, `unit_tariff_snapshot`, `currency_code_snapshot` y `amount`.
- Añade un check que exige valoración enteramente pendiente o completa. Con valoración pendiente exige también ausencia de autorización asociada.
- Retira `invoice.create`, `invoice.prepare_signature`, `invoice.sign` y `signature.capture` del rol de sistema `PROVIDER`.

Se reprodujo el fallo con código actual sobre una base sintética nueva con solamente el baseline. El guardado produjo `P2011` y dejó cero procedimientos. Tras aplicar exclusivamente el SQL de esta migración se guardó cantidad `1.00` con seis valores NULL y el servicio apareció al listar. Las otras seis migraciones no participaron en esa prueba.

[Reproducción aislada](evidence/incident-20261111/isolated-reproduction.json)

El usuario autorizó expresamente esta operación y confirmó el proyecto. A las 14:14 UTC se creó un respaldo del esquema público y sus datos en `backend/storage/incident-20261111/public-before.dump`, con ACL restringida al usuario actual y SYSTEM y exclusión de Git. El archivo contiene 1 207 033 bytes y su SHA-256 es `7a73521a92baaa2b3f39225817bde9b9d34b9d19c608b6749ba9f47327952128`. `pg_restore` leyó el archivo completo. Esa comprobación valida la lectura del archivo, con restauración a una base todavía sin ensayar. Los bytes de documentos externos requieren su respaldo de objetos correspondiente.

Se verificaron nuevamente destino, checksum y estado. El SQL versionado se aplicó a las 14:14:45 UTC, con `lock_timeout=5s` y `statement_timeout=30s`. Después se ejecutó `prisma migrate resolve --applied 20261106000000_service_attention`. El flujo de hotfix y reconciliación está documentado por [Prisma v7](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/patching-and-hotfixing).

La verificación de las 14:15:50 UTC aprobó los seis campos anulables, el check validado, la ausencia de los cuatro permisos en el PROVIDER de sistema y el checksum registrado en Prisma. El historial contiene baseline y service_attention. Las otras seis migraciones siguen pendientes y conservan sus diagnósticos previos.

[Manifiesto de respaldo](evidence/incident-20261111/backup-manifest.json) · [Aplicación y reconciliación](evidence/incident-20261111/application-result.json) · [Verificación posterior](evidence/incident-20261111/supabase-after.json)

El reintento funcional corresponde a la atención existente y debe comprobar primero su lista de servicios con **Refresh saved services**. El diálogo conserva la selección y cantidad y permite **Save another service** después de consultar la lista. La prueba de guardado y listado de esta entrega se ejecutó con datos sintéticos en local. Los intentos fallidos observados en Render terminaron con una violación de constraint dentro de la transacción.

## Lectura del 404

Los logs de las 13:59:59 UTC confirman que GET `/api/v1/appointments/10/clinical-encounter` devolvió `CLINICAL_ENCOUNTER_NOT_FOUND`, HTTP 404, correlación `d5cc5bf7-8ddb-427d-95bf-9ae7a25eaf33`. Ese código representa ausencia de atención antes del inicio y el cliente lo trata como tal. El problema de guardado confirmado es la violación de NOT NULL descrita arriba.

## Alcance de esta revisión

Se diagnosticó el incidente con logs de Render y metadatos de Supabase, se reprodujo en PostgreSQL local dedicado y se aplicó la migración existente con autorización del usuario. Se agregaron este informe y sus evidencias. El ensayo local y la verificación de esquema remoto acreditan la corrección de la causa P2011. El siguiente guardado clínico queda a cargo del operador en su atención existente.
