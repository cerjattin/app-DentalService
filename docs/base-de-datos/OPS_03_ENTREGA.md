# Entrega OPS-03 — Base de datos

Entrega local del 8 de noviembre de 2026 sobre HEAD base 1828797be y cambios compartidos preservados. Corresponde al [contrato OPS-03](../negocio/CONTRATO_OPS_03_BASE_DATOS.md) y al [flujo de atención y facturación](../negocio/CONTRATO_ATENCION_FACTURACION_DENTALINK_20261106.md).

## Resultado y alcance

La migración de captura sin precio existente fue revisada y probada. Se incorporó la persistencia Dentalink acordada con Backend, con cuenta deshabilitada por defecto, vista previa privada, mapeos e identidades externas por organización y cuenta. La recuperación sintética compara datos, secuencias, estructura y archivos y dispone de límites y registro de fases.

Esta ronda realizó escrituras exclusivamente en el PostgreSQL propio de QA. Las importaciones Excel y la numeración histórica del 5 de noviembre se preservan en su operación independiente. No se reinspeccionó el destino clínico ni se aplicaron migraciones remotas. El usuario comunicó un despliegue existente; los resultados locales de esta entrega no acreditan su versión, su esquema ni una conexión real a Dentalink.

## Archivos e impacto entre áreas

| Archivo o grupo | Cambio |
| --- | --- |
| [schema.prisma](../../backend/prisma/schema.prisma) y [cliente generado](../../backend/src/generated/prisma/client.ts) | Se conservan los seis campos nullable de valoración existentes. Se agregan cinco modelos Dentalink, cuatro enums, relaciones e índices de pertenencia por organización |
| [Migración de atención existente](../../backend/prisma/postgresql/migrations/20261106000000_service_attention/migration.sql) | Revisada sin modificar su SQL. Admite valoración vacía o completa y retira cuatro permisos de facturación del rol PROVIDER incorporado |
| [Migración Dentalink](../../backend/prisma/postgresql/migrations/20261107000000_dentalink_import/migration.sql) | Cinco tablas privadas, RLS, FKs restrictivas compuestas, unicidad externa exacta, checks de tipos/estados y grants acotados |
| [seed.ts](../../backend/prisma/seed.ts) | Agrega dentalink.read/manage/import a la política local. ADMIN recibe los tres, RECEPTION read/import y PROVIDER ninguno |
| [Acuerdo con Backend](OPS_03_MODELO_DENTALINK.md) | Nombres, campos, límites y responsabilidades de confirmación transaccional aceptados por Backend |
| [qa-recovery.ts](../../backend/src/infrastructure/database/qa-recovery.ts) | Límites de espera, protección contra prompts, diagnóstico por fase, rollback de lectura destino y huella de esquema |
| [pilot-recovery.test.ts](../../backend/tests/integration/pilot-recovery.test.ts) | Comprueba la huella estructural y etapa final además de las verificaciones existentes |
| [Integridad](../../backend/tests/integration/ops03-database.test.ts), [carrera](../../backend/tests/integration/ops03-identity-concurrency.test.ts), [actualización](../../backend/tests/integration/ops03-upgrade.test.ts), [bloqueo](../../backend/tests/integration/ops03-recovery-lock.test.ts), [casts](../../backend/tests/unit/ops03-recovery-definition.test.ts) | Pruebas propias nuevas para las regresiones indicadas |
| [ops03-preflight.sql](../../database/postgresql/ops03-preflight.sql) | Diagnóstico de solo lectura para una operación futura autorizada |

Backend mantiene los servicios, repositorios, API y contrato HTTP. DB reservó con Backend el helper de recuperación y su prueba antes de editarlos. Las correcciones de locks appointment → encounter y su comprobación HTTP son de Backend. Frontend consume los DTO publicados por esa área.

El módulo Dentalink parcial de Backend apareció durante esta ronda. Su aplicación y las pruebas HTTP finales pertenecen a OPS-01; esta entrega valida la base y los contratos de persistencia. No presenta la preparación de un adaptador como sincronización real.

## Integridad de atención y compatibilidad

Los seis campos de valoración son patient_insurance_id, svb_tariff_id, insured_id_snapshot, unit_tariff_snapshot, currency_code_snapshot y amount. El check ck_encounter_procedure_billing_context acepta cero o seis valores. Con cero valores también exige authorization_item_id NULL. Los checks previos de cantidad positiva, fecha de prestación e importes no negativos permanecen vigentes. Las FKs opcionales siguen siendo restrictivas.

La prueba recorre las 64 combinaciones de presencia de esos campos y rechaza las 62 parciales. Comprueba una FK inválida y conserva exactamente la versión cerrada y la línea histórica. La prueba de actualización aplica primero las seis migraciones anteriores, crea historia sintética valorada y numeración PAT-008888 y aplica después las dos migraciones nuevas. Verifica que el contenido, los números y el contador se conservan y que los grants de un rol CUSTOM permanecen iguales.

## Persistencia Dentalink

Los modelos son DentalinkAccount, DentalinkMapping, DentalinkImportRun, DentalinkImportItem y DentalinkExternalIdentity. Las identidades distinguen mayúsculas, acentos y ceros iniciales, con collation C. Se prohíben los vínculos a pacientes, citas, profesionales, sedes o usuarios de otra organización mediante FKs compuestas.

La preparación guarda exclusivamente el DTO normalizado de la vista previa en payload_json privado, con hash, estado e incidencias. Los tokens pertenecen a configuración del backend. Las auditorías de importación usan códigos, hashes y conteos. La confirmación que implemente Backend debe crear entidad local, identidad, auditoría y numeración en una sola transacción. El contrato requiere detectar coincidencias dudosas y conservar los números históricos existentes.

La prueba concurrente intenta crear el mismo ID externo desde dos transacciones. Una gana; la otra revierte su paciente. Se comprueban también el fallo entre entidad e identidad, el rollback del consecutivo, las claves por cuenta, las combinaciones de FK por tipo, el estado completo de confirmación y la invisibilidad de las tablas bajo un rol sin bypass RLS.

La política final del seed sintético contiene 73 permisos, con 73 grants para ADMIN, 38 para RECEPTION y 27 para PROVIDER. Estos conteos describen la política local y su QA, no el destino clínico.

## Recuperación y diagnóstico del timeout

La reproducción aislada inicial de las fuentes recibidas pasó las tres pruebas en el cluster propio; la recuperación completa duró aproximadamente 4,9 segundos. El timeout de 120 segundos reportado por Negocio no se reprodujo. El registro disponible de aquel intento permite situar el fallo después del dump y la copia de documentos, pero carecía de un marcador preciso de la etapa siguiente. Su causa exacta permanece indeterminada.

El helper tenía consultas y esperas de locks sin límite propio, y el timeout de un subproceso era igual al límite completo de la prueba. Se añadieron conexión de cinco segundos, lock_timeout de cinco segundos, statement_timeout de treinta segundos y timeout de treinta segundos por comando. pg_dump/pg_restore usan --no-password y pg_dump además --lock-wait-timeout=5s. Se conserva el límite original de 120 segundos de la prueba completa.

Cada ejecución nueva escribe progress.json con etapa y tiempos, sin filas personales, SQL sensible ni credenciales. Un bloqueo deliberado de documents falla en snapshot-fingerprint en unos 5,3 segundos y libera la conexión de snapshot. El informe identifica la etapa para un siguiente diagnóstico.

La comparación estructural inicial detectó dos diferencias equivalentes en un check y un índice parcial de la migración manual anterior. pg_restore distribuye el cast de un arreglo varchar a text entre sus constantes. La comparación ahora normaliza únicamente esos arreglos literales equivalentes. Las pruebas unitarias mantienen diferentes los cambios de valores, orden, predicados y casts varchar con longitud.

La recuperación final compara 95 huellas de tablas, secuencias y esquema, incluidos 1.389 objetos estructurales. Verifica cuatro archivos sintéticos de firma/PDF/export/comprobante y su descarga por el servicio documental en un proceso nuevo sobre el destino restaurado. El ensayo completo pasó en unos 5,6 segundos. Esto acredita recuperación local sintética; el backend del host, el bucket y la recuperación operativa real continúan en su aceptación correspondiente.

## Evidencia ejecutada

Cluster propio PostgreSQL 17.11 en 127.0.0.1:55479, directorio backend/storage/ops03-db-qa/data. Los nombres terminan en _test y los documentos usan backend/storage/ops03-db-qa/. No se usó el cluster de Negocio ni el de Backend.

| Comprobación del 8 de noviembre | Resultado y reporte local |
| --- | --- |
| Prisma validate y generación | Modelo válido; cliente Dentalink generado por DB |
| Creación desde cero | Ocho migraciones aplicadas en ops03_model_test |
| Integridad y actualización | 8/8 pruebas, tres archivos. backend/storage/ops03-db-qa/integrity-final-results.json |
| Recuperación con estructura y bloqueo | 4/4 pruebas, dos archivos. backend/storage/ops03-db-qa/recovery-verified-results.json |
| Unitarias Backend | 174/174. backend/storage/ops03-db-qa/unit-final-results.json |
| Typecheck y build Backend | Aprobados después del arreglo concurrente de OPS-01 |
| SQL previo, rutas de entrega y whitespace | Verificados en QA local y en el repositorio |

Las 174 unitarias incluyen las dos de comparación de casts. No se suman a los conteos históricos de Negocio ni se presenta una suite completa de integración como ejecutada por DB. La primera corrida unitaria encontró EACCES de loopback en el entorno restringido y se repitió con acceso local habilitado; el resultado final es 174/174. Un build intermedio detectó un cambio aún en escritura de Backend; se avisó a su responsable y se repitieron typecheck/build con éxito tras la corrección.

Los reportes y dumps son privados e ignorados por Git. Las pruebas de actualización y recuperación exigen destinos nuevos vacíos; no se deben repetir sobre los restaurados anteriores.

El cluster propio fue detenido al cerrar, después de verificar su directorio y puerto. Las bases y los reportes se conservan. La huella de las fuentes DB está en backend/storage/ops03-db-qa/final-source-manifest.json.

## Migraciones y hashes

| Carpeta | SHA-256 exacto del SQL |
| --- | --- |
| 20261106000000_service_attention | be062be02e172125a17f1f7ed6ee7bcacc702829708ae099c004342366268e4d |
| 20261107000000_dentalink_import | 4d2242a6e33b920847cffd6a5451155f9d197a15e07ad44740201f541c8c8a2a |

Los seis SQL anteriores se conservan. Las dos migraciones nuevas ya se aplicaron a QA con estos hashes; las correcciones posteriores deben usar otra migración, no reescribirlas.

## Plan posterior de aplicación al destino

1. Arquitectura vincula las entregas OPS y una versión exacta de API/UI, schema, cliente y migraciones. Backend cierra el contrato HTTP, sus pruebas de flujo y la importación sintética. La clínica y el acceso Dentalink se mantienen fuera de estos ensayos.
2. Una operación posterior identifica destino, ventana, responsable y versión actual, realiza inventario y compara checksums. El preflight SQL mide combinaciones de valoración incompatibles, migraciones, permisos y RLS sin exponer pacientes.
3. Se verifica el respaldo de base y objetos con restauración en un destino separado. El diagnóstico local no sustituye la recuperación del almacenamiento desplegado.
4. Detener escritores y aplicar únicamente las migraciones pendientes revisadas en orden, con límites de locks y sentencias apropiados en la sesión. No ejecutar seed general, fixtures ni limpieza en clínica. La migración de atención modifica nullability y valida un check; la de Dentalink crea índices únicos en tablas existentes y nuevas tablas, por lo que requiere planificar locks.
5. Revisar permisos efectivos sin sobrescribir roles personalizados. Desplegar API y UI compatibles con servicios pendientes de valoración. Evitar ejecutar un servidor antiguo que asuma valores monetarios siempre presentes.
6. Comprobar agenda, captura, cierre, valoración al facturar, firma exacta, refacturación e indicadores. Repetir diagnóstico. Mantener la cuenta Dentalink deshabilitada hasta el acuerdo de configuración y la habilitación real de su API.
7. Ante un fallo, preservar historia y evidencias y elegir una corrección compatible. Revertir el código antiguo requiere analizar las filas sin valorar. No convertir NULL a cero ni borrar historia para forzar compatibilidad.

La operación remota, la primera conexión Dentalink y la aceptación del cliente permanecen pendientes de sus autorizaciones y fuentes concretas.

