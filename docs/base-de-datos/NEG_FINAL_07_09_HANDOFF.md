# NEG-FINAL-07/08/09 — Base de datos, entrega verificada en QA

Fecha: 2026-11-03. Alcance solicitado: [paquete final](../negocio/CONTRATOS_FINALES_MVP_CLIENTE.md). Se conserva el acuerdo de editor único: Backend edita schema/cliente/migraciones/servicios; Base de datos prepara revisión, diagnóstico, recuperación y pruebas independientes. No ejecutar migraciones simultáneamente ni modificar el baseline.

## 07 — contrato mínimo de persistencia para Backend

La presentación sigue siendo una actuación manual del operador. Backend comunicó una aclaración del usuario en su chat: captura campo por campo, sin archivo oficial. Para ese recorrido, conservar un expediente/snapshot inmutable de lo registrado; **no exigir una exportación inexistente**. La falta de formato impide acreditar un archivo aceptado por SVB, pero no impide implementar evidencia, integridad e idempotencia. No vincular la preparación técnica a un adaptador de transporte ficticio.

- Conservar DeclarationSubmission como intento/historial. Cada registro manual debe referenciar lote, snapshot/hash del expediente y comprobante Document de la misma organización; si existe una exportación asociada, conservar además su Document/hash y bytes. Una evidencia no equivale a aceptación/pago.
- Persistir clave idempotente y hash canónico del payload bajo comparación binaria, no la collation general sin mayúsculas/acentos. Unicidad de clave por organización; misma clave/datos devuelve lo anterior, clave reutilizada con otros datos es conflicto. Incluir fecha externa normalizada, exportación, comprobante, referencia/motivo en la huella; actor/fecha de registro son del servidor.
- Unicidad de presentación manual efectiva por lote, incluso con claves distintas. Conservar los intentos técnicos anteriores, sin una unicidad global que invalide el historial legado. Resolver duplicados existentes mediante diagnóstico, sin elegir ganador. Bajo lock de lote se asigna el siguiente attempt; reutilizar contador transaccional si la historia pudiera eliminarse, nunca MAX+1 libre.
- Persistir fecha externa y fecha de registro por separado; referencia externa nullable y motivo obligatorio si falta; no deduplicar por referencia externa global inventada. FK con Restrict para comprobantes/evidencia y acceso a descarga mediado por Backend. Validar también el contexto organización/exportación: las FK simples por ID no lo demuestran.
- Respuesta: evidencia Document propia, snapshot de respuesta, fecha externa/registro, actor y asignación de resultados por líneas del lote. Rechazar duplicados de línea, líneas ajenas, respuestas ambiguas/parciales no representables. No cambiar importes de factura ni borrar la evidencia original para corregir el resultado.
- Registro/historial/auditoría y cambios de estado confirman juntos; fallo de auditoría revierte todo. Restauración conserva claves/huellas/evidencias para impedir registrar de nuevo como si no existiera. Una restauración no deshace la carga hecha fuera de la app: reconciliar portal antes de reanudar.

Campos propuestos para futuro lote/API (formato **interno**, no oficial SVB): schemaVersion, sourceRulesVersion, organization/payer, declarationId/exportId, fileSha256, líneas con identificadores/snapshots externos/fecha/Decimal/moneda, correlationId, idempotencyKey, externalReference, transport, externalSubmittedAt, recordedAt, actor, receiptDocumentId y resultado por línea. Mantener separado un identificador de correlación externo opcional. Una futura cola/outbox necesitará decisión y migración propias; no enviar desde triggers ni guardar credenciales del portal.

## 08/09 — entregables de este chat

Implementados [inventario protegido](../../backend/src/scripts/inspect-pilot-db.ts), [diagnóstico 07](../../backend/src/infrastructure/database/manual-portal-diagnostics.ts) y [simulacro de recuperación](../../backend/src/scripts/qa-recovery-drill.ts). La migración de Backend y el recorrido manual se verificaron en PostgreSQL dedicado. Esta entrega no certifica el despliegue ni la aceptación clínica. Ninguna semilla, prueba o restauración se ejecuta sobre clínica.

### Destino configurado, inspección protegida del 3 de noviembre

Se leyó explícitamente `backend/.env.supabase.local`, usando el certificado CA existente y una conexión con `default_transaction_read_only=on`. No se imprimieron host, usuario, contraseña, pacientes, IDs clínicos ni valores de configuración de organizaciones. Informe protegido local: `backend/storage/pilot-db-protected-inventory.json` (fuera de Git).

- PostgreSQL 17.11. Baseline con checksum coincidente; **las cuatro migraciones NEG-FUNC posteriores están pendientes**. La futura migración 07 todavía no existía al tomar esta evidencia y requerirá una comprobación final.
- 40 tablas de aplicación con RLS; 186 CHECK validados, triggers manuales y collation ICU del baseline presentes; extensión unaccent presente. No había migraciones fallidas/en ejecución ni migraciones desconocidas.
- Roles persistidos: Admin 68, Provider 29, Reception 35. Faltan los nuevos permisos/asignaciones treatment_case.read/manage del seed actual; Admin conserva todos los permisos existentes en ese destino, lo cual no significa que estén creados los nuevos.
- Diagnóstico previo: 2 organizaciones con Declarant ID inválido y 1 Draft con identidad congelada inconsistente. No se encontraron duplicados activos, evidencia ordinal inválida ni contexto cruzado de casos en las once reglas compatibles con baseline. Esos conteos no certifican todo el contenido clínico ni habilitan el piloto.

Revisión final con el inventario completo de esta entrega: **cinco migraciones pendientes**, incluidas las cuatro anteriores y `20261103000000_manual_portal`; faltan los códigos treatment_case.read/manage y sus asignaciones. Mismos conteos fiscales. Reporte protegido `backend/storage/pilot-db-protected-inventory-final.json`, con fecha y huella del destino configurado sin host/credenciales visibles. La comprobación incluye ahora CHECK/triggers de todas las migraciones, no solo baseline; los objetos nuevos no existen en ese destino hasta su aplicación controlada.

**Salida: destino bloqueado para la versión candidata nueva.** No se aplicaron migraciones, seeds, limpieza ni reparaciones. Resolver los registros afectados con Backend/Negocio mediante informe protegido; no copiar los valores actuales sobre snapshots, seleccionar una identidad o borrar un Draft automáticamente. Preparar después una operación de aplicación con escritores detenidos y responsable único; el plan debe incluir la nueva migración 07 cuando esté validada. No usar un seed general como reparación de datos clínicos.

### Recuperación verificable, exclusivamente QA

[Módulo de recuperación](../../backend/src/infrastructure/database/qa-recovery.ts): ambas conexiones deben ser loopback PostgreSQL y terminar en `_test`, sin query params, con nombres distintos; destino vacío y directorio nuevo obligatorios. No hay reset, clean, create-database, overwrite ni conexión operativa implícita. La CLI exige `--writers-paused`; el responsable debe detener efectivamente los escritores del laboratorio. La bandera no impone por sí sola un mantenimiento a otros procesos.

Se exporta un snapshot RepeatableRead READ ONLY que usa también pg_dump custom. Se copian solo archivos referenciados por los documentos de ese snapshot, verificando proveedor LOCAL, ruta/realpath dentro del root explícito, tamaño y SHA-256. pg_restore se ejecuta con exit-on-error/single-transaction y sin ACL/owner; después se comparan hashes por tabla, filas y estado de cada secuencia, y se vuelven a comprobar los bytes documentales. Credenciales solo en el entorno de los subprocesos, nunca en sus argumentos o salida. La herramienta no ejecuta un dump recibido de terceros: genera el archivo desde su propia base local sintética.

Limitaciones deliberadas: no incluye PostgreSQL roles globales, ACL operativas, claves externas, usuarios de Supabase Auth ni buckets externos. El destino operativo requiere preaprovisionar sus roles/privilegios y un adaptador/backup de Storage si se adopta; no se declara restauración Supabase completa por este ensayo local. Las filas/documentos de ejemplo son sintéticos; no se prueba aceptación legal de una firma ni render de PDF con esos bytes. Backend conserva la aceptación HTTP de descarga/documentos reales.

Ejecución reproducible desde backend, con una base restauración **vacía nueva** en cada ensayo:

```powershell
$env:TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:55443/odontho_final0709_20261103_test"
$env:RESTORE_TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:55443/OTRA_BASE_VACIA_test"
$env:PG_BIN="C:/Program Files/PostgreSQL/17/bin"
node --import tsx src/scripts/inspect-pilot-db.ts
# Solo para el ensayo CLI con documentos sintéticos ya preparados:
$env:QA_DOCUMENT_ROOT="RUTA_ABSOLUTA_DOCUMENTOS_SINTETICOS"
$env:QA_RECOVERY_OUTPUT="RUTA_ABSOLUTA_NUEVA_SALIDA"
node --import tsx src/scripts/qa-recovery-drill.ts --writers-paused
```

[Pruebas](../../backend/tests/integration/pilot-recovery.test.ts) opt-in con RESTORE_TEST_DATABASE_URL y [seguridad](../../backend/tests/unit/pilot-db-safety.test.ts): ocho aprobadas en la primera entrega (dos inventario, una recuperación y cinco seguridad/CLI). La restauración comparó base/secuencias y cuatro documentos referenciados por Signature, InvoiceDocument, DeclarationExport y un intento manual legado con comprobante en metadata. **La entidad nueva 07 aún no está acreditada por esa primera ejecución**. Destino propio: puerto 55443, fuente `odontho_final0709_20261103_test`, restauración `odontho_restore0709_20261103_test`. Reporte `backend/storage/final07-09-db-qa/recovery-results.json`; datos/archivos de ensayo conservados bajo ese directorio, sin operaciones en la base de Backend.

### Verificación final integrada

Backend conservó propiedad exclusiva de schema/cliente/migración `20261103000000_manual_portal`. La revisión de este chat detectó CHECK que aceptaban NULL y faltas de protección de hash/DELETE; Backend las corrigió **antes** de aplicar la migración en ambos QA. Después no se reescribió SQL aplicado.

- [Cuatro pruebas DB independientes](../../backend/tests/integration/manual-portal-database.test.ts): claves binarias, unicidad activa, rechazo de motivo NULL/hash inválido/contexto ajeno, snapshot inmutable, contador y rollback, RLS y protección DELETE de evidencia/documentos. Usan transacciones revertidas para conservar historia sin bypass.
- El ensayo final creó expediente → presentación confirmada → respuesta por línea mediante los **servicios implementados de Backend**, con datos sintéticos y comprobante. Respaldó/restauró las tablas 07, contadores, todas las filas y cuatro documentos. Un [proceso nuevo](../../backend/tests/helpers/verify-restored-documents.ts) ejecutó DocumentService.download contra la DB y root restaurados, verificando las cuatro descargas. No depende de la caché/cliente de la fuente.
- El teardown de ese único ensayo persistido desactiva solo protect_manual_entry_delete/protect_manual_result_delete, borra únicamente IDs sintéticos conocidos y los reactiva dentro de una transacción, después de verificar el nombre `_test`. No se incorpora un bypass operativo ni se usa sobre Supabase. La inspección posterior confirma todos los triggers activos.
- **434 pruebas aprobadas en 49 archivos, sin omitidas**, en una única regresión completa fresca de 71.68 s. Incluye las doce pruebas nuevas de este chat, la suite HTTP manual de Backend y la regresión legada en otra base vacía. Typecheck y build correctos. Reporte `backend/storage/final07-09-db-qa/acceptance-results.json`.
- Inspección local posterior: seis migraciones MATCH, **43 tablas**, **200 CHECK** validados, RLS/CHECK/triggers requeridos presentes, permisos completos y veintiuna reglas de integridad anteriores/manuales sin hallazgos. Reporte `backend/storage/final07-09-db-qa/final-inventory.json`.

La primera corrida ampliada tuvo timeouts y expiración de tokens después de una interrupción de reloj de más de una hora, y dos fallos de un fixture nuevo de Backend (referencia a secondItemId en vez de itemIds[1]). Se conservaron sus reportes; se corrigió el fixture, se ajustaron únicamente timeouts exteriores de tests CLI que lanzan varios procesos con límites individuales y se repitió la suite completa. No se modificó expiración/Auth ni se atribuye aprobación a esa corrida fallida.

El destino restaurado de la ejecución aceptada es `odontho_restore07_accept_20261103_test`; la regresión legada usó `odontho_legacy07_accept_20261103_test`. No reutilizar ni resetear esas bases para otro ensayo que requiere un destino vacío.

Al terminar se detuvo únicamente el PostgreSQL propio 55443, conservando datos/reportes. Para reanudarlo: `pg_ctl -D C:/workspace/app-DentalService/backend/storage/final07-09-db-qa/data -l C:/workspace/app-DentalService/backend/storage/final07-09-db-qa/server.log -o "-h 127.0.0.1 -p 55443" -w start`. No se detuvo ni modificó el cluster de Backend.

Archivos propios adicionales: [inventario de estructura/permisos](../../backend/src/infrastructure/database/pilot-db-inventory.ts), [motor de recuperación](../../backend/src/infrastructure/database/qa-recovery.ts), helpers de descarga y fixture (identificadores SQL ahora aceptan dígitos internos como sha256), ajuste de timeout en la prueba CLI06, esta guía y su índice. [Campos propuestos para manual/lote/API](CAMPOS_PROPUESTOS_SVB_MANUAL_API.md). Los cambios de módulos/API/schema y migración pertenecen a la entrega de Backend.

### Orden concreto previo a habilitar clientes

1. Arquitectura fija versión candidata/topología/Storage/responsables; congelar los artefactos de aplicación y estas seis migraciones. Esta validación se realizó sobre HEAD base `0bff419bd` más cambios de trabajo sin commit; no existe todavía una release publicada por este chat.
2. Inspección protegida del destino y resolución autorizada de los tres hallazgos fiscales, con evidencia y sin modificar snapshots firmados. No es aceptable ocultarlos aplicando defaults. Repetir diagnóstico antes de toda la cadena.
3. Respaldo conjunto base/documentos con custodia y ensayo en la topología elegida. El ensayo local aprobado permite revisar el procedimiento, pero no sustituye el backup/Storage operativo.
4. Detener escritores del destino. Un responsable aplica las cinco migraciones pendientes, en orden, por el mecanismo de migración explícito; nunca en arranque/request. Sin reset ni cambios de checksums. Revisar cada transacción fallida antes de continuar.
5. Sincronización **solo de permisos/asignaciones** del modelo entregado bajo una operación revisada por Backend/DB, conservando Admin con todos los permisos y la matriz Provider/Reception. No ejecutar el core seed general ni bootstrap de QA sobre clínica. El core seed de esta entrega solo se ejecutó en el QA nuevo.
6. Inventario posterior: seis MATCH, permisos y checks completos, diagnósticos sin bloqueos; probar cuentas individuales y documentos en el destino. Desplegar solo con el responsable y la autorización de publicación acordados. Mantener presentación técnica/registro factual manual diferenciados de la aprobación SVB; fuente oficial y reglas pendientes requieren aceptación de Negocio/clínica.
7. Completar UAT de Frontend/Negocio/Arquitectura en el entorno exacto y registrar el alcance/limitaciones del piloto. No usar datos reales para reproducir carreras, fallos o rollback.

### Operación y aceptación pendientes, sin valores inventados

Arquitectura/clínica debe asignar un responsable y suplente de recuperación, RPO/RTO, frecuencia/retención, cifrado/custodia y ubicación separada de backups. Propuesta para revisar: respaldo conjunto antes de cada migración y diario durante el piloto, copia protegida separada del host y ensayo periódico. Es una propuesta, no una política acordada ni un job desplegado. Retención y ventana se fijan con la clínica.

Ante recuperación: suspender capturas/presentaciones; restaurar primero en otro destino, verificar base+documentos y revisar todos los hechos SVB posteriores al corte contra comprobantes/portal. Registrar discrepancias y su responsable antes de reanudar. No asumir que una presentación externa desapareció al volver la base atrás ni reenviar automáticamente una línea aceptada. Preservar el original y auditar cualquier reconciliación.

UAT-16/17 de DB dependen de la entrega 07; UAT-20 tiene ensayo de recuperación sintético aprobado y destino operativo **bloqueado** según el inventario. Las descargas después de redespliegue, topología/Storage definitivo, cuentas individuales reales, HTTPS/CORS, responsables, fuentes SVB y aprobación con cliente siguen en los responsables de sus contratos. No desplegar ni marcar el paquete completo como aceptado por la ejecución de esta herramienta.

Referencias de implementación: [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html). El archivo y la consistencia del snapshot se verifican en el ensayo; el respaldo operativo exige además custodia y restauración en el entorno elegido.
