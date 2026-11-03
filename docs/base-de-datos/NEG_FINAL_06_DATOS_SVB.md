# NEG-FINAL-06 — entrega de Base de datos

Fecha: 2026-11-02. Contrato: [datos y reglas SVB](../negocio/CONTRATO_FINAL_06_DATOS_SVB.md). El usuario confirmó en este encargo que **todavía no existe la ficha autorizada de la clínica**.

Estado: preparación técnica implementada; carga real, reglas de captura y aceptación de presentación bloqueadas por fuentes. No se completó el contrato funcional ni se cargaron valores productivos. No se aplicaron migraciones/seeds ni se consultaron datos de Supabase operativo en este encargo. Las operaciones con datos sintéticos se hicieron en un PostgreSQL local nuevo, exclusivo de esta entrega.

## Modelo y restricciones revisados

Se conserva el modelo actual y las cinco migraciones PostgreSQL. **No se necesita una migración nueva para preparar esta revisión.** La existencia de columnas no autoriza los valores ni el flujo de captura.

| Recurso | Integridad actual y decisión |
| --- | --- |
| ClinicLocation | `policlinicCode` es varchar(64) nullable; unicidad `(organizationId, policlinicCode)`. Reutilizar para nuevas capturas después de fijar la fuente; sin rellenar snapshots históricos |
| AccidentCase | Número externo varchar(80); unicidad `(patientId, accidentFormNumber)`; FK a paciente, seguro opcional y creador. Las FK simples no demuestran que el seguro y creador pertenezcan al contexto del paciente |
| Referrer | Identificador externo varchar(64); unicidad `(organizationId, referrerIdentifier)`. La existencia de un remitente no prueba una remisión ni su documento autorizado |
| SvbProcedure | Código varchar(50) único con comparación sin distinguir mayúsculas/acentos. Catálogo **global**, sin organizationId: una carga no está aislada por la organización del actor |
| SvbTariff | Decimal(15,2), moneda explícita char(3), fechas `date`, unicidad `(svbProcedureId, currencyCode, validFrom)`. La exclusión de períodos activos superpuestos es responsabilidad del servicio existente bajo lock del procedimiento |
| Campos congelados | Identificadores externos permanecen texto. `numberOfTreatmentsSnapshot` es integer nullable y `assistanceSnapshot` varchar(100) nullable en las tres etapas. Sin defaults en BD; no se cambian tipos/límites ni se deduce significado con una fuente ausente |

**PoliClinic requiere resolver una incompatibilidad potencial antes de publicar PATCH.** El mapper técnico acepta P/K, pero eso no acredita semántica autorizada. La unicidad existente permite una única sede con P y otra con K por organización. Si la ficha los define como categorías compartidas, habría que retirar esa unicidad mediante una migración nueva, coordinada con Backend y precedida de un inventario autorizado. Si identifica códigos únicos de sede, habría que contrastar los valores permitidos por el formato. Esta entrega reproduce la restricción en QA, no la elimina ni agrega un CHECK P/K.

RLS, CHECK, índices, collation y triggers existentes se conservan. No se cambian Auth ni permisos. RLS conserva el diseño actual: Express aplica permisos y organización; no se agregan políticas `auth.uid()` incompatibles ni acceso directo desde Frontend.

## Origen y congelación por campo

| Campo | Recorrido actual y límite |
| --- | --- |
| DeclarantId | Organization → versión de factura → lote/ítem de declaración según contrato 03. El diagnóstico anterior sigue siendo necesario para inconsistencias fiscales legadas |
| ProviderId | Provider.svbProviderId → EncounterProcedure → InvoiceItem → DeclarationItem |
| InsuredId | PatientInsurance.insuredId → procedimiento → ítem de factura → declaración |
| TreatmentId | TreatmentCase.treatmentId del contexto de cita → procedimiento → factura → declaración; sin conversión numérica |
| PoliClinic | ClinicLocation.policlinicCode → procedimiento → factura → declaración; nuevas capturas únicamente |
| Autorización externa | SvbAuthorization/SvbAuthorizationItem → autorización externa congelada; validar cobertura/vigencia/cantidad en Backend, sin confundirla con Declarant ID |
| Accidente | AccidentCase del contexto autorizado de cita → número externo congelado; comprobar paciente/seguro/organización antes de capturar |
| Remitente | Referrer reutilizable; referencia y evidencia de remisión no están resueltas por una FK. No habilitar servicios que requieran ese flujo por elegir cualquier ID |
| NumberOfTreatments / Assistance | Sin fuente autorizada. Se conservan null en nuevas capturas actuales; tampoco se rellenan durante diagnóstico/importación. Aantal del PDF no determina estas reglas |

La fecha de servicio existente se calcula en America/Curacao y luego se conserva como `date`; no se reconstruye con la zona del equipo. Importes y tarifas se mantienen como Decimal/string. Ni diagnóstico ni precarga suman monedas o calculan dinero con floats.

Cambiar maestros no obliga a que un snapshot previo coincida con el maestro actual. Por eso el nuevo diagnóstico **no** utiliza maestros para completar ni para sustituir contenido congelado. Una corrección de contenido firmado exige el flujo existente de nueva versión y firma.

## Herramientas entregadas

- [Diagnóstico](../../backend/src/infrastructure/database/svb-final06-preflight.ts): once reglas estructurales; vínculos de accidente, seguro, sede, remitente, autorización y procedimiento/tarifa; períodos y superposición de tarifas activas. Un solo snapshot RepeatableRead READ ONLY con timeout por sentencia.
- Revisión paginada por ID de ítems de facturas CLOSED vigentes y declaraciones no canceladas: usa **el mapper/diagnóstico compartido de Backend**, sin una segunda lista de validaciones de campos. Devuelve conteos por campo/código, nunca valores clínicos o IDs. No certifica versiones históricas excluidas ni documentos/archivos del portal.
- Estado del piloto: consulta `getSvbPilotReadiness()` del módulo Backend; no mantiene una lista de servicios habilitados o reglas fiscales independiente. Incluso una base vacía/sin hallazgos mantiene `realSubmissionApproved=false` mientras el servidor mantenga el piloto bloqueado.
- [SQL de revisión estructural](../../database/postgresql/final06-preflight.sql): generado desde el mismo módulo; once conteos sin escritura. Es compatible con el baseline; no hace el escaneo de snapshots ni certifica el piloto. Una inspección en destino requerirá alcance autorizado separado; aquí solo se ejecutó en QA local.
- [Precarga de maestros](../../backend/src/infrastructure/database/svb-master-preflight.ts): **simulación de altas**, sin aplicación. Reutiliza schemas del catálogo y validación de fechas existente; compara códigos/monedas con la collation real de PostgreSQL y detecta conflictos en lote/destino. No ofrece upsert, actualización o ganador automático.
- [CLI](../../backend/src/scripts/preflight-final06-db.ts): sin dotenv/DATABASE_URL operativo; solo `TEST_DATABASE_URL` de loopback terminado en `_test`; rechaza parámetros de conexión que puedan redirigir host y flags desconocidos/de aplicación. Lote máximo 2 MiB/1000 procedimientos/1000 tarifas. Los errores no imprimen conexión, contenido o motivo sensible.
- [Plantilla vacía](../../database/postgresql/final06-master-batch.template.json): no contiene un catálogo ni valores clínicos de ejemplo que puedan confundirse con maestros aprobados.

Código de salida CLI: **0** exportación SQL; **1** configuración/archivo/consulta inválida; **2** revisión ejecutada pero aplicación/presentación bloqueada. No convertir ese 2 esperado en aprobación operativa. El simulador devuelve siempre `canApply=false`, incluso si pasa todas sus comprobaciones técnicas.

## Precarga reproducible y procedencia

Formato interno: `odontho-svb-master-preflight-v1`; **no es el formato del portal SVB**. Estructura estricta:

| Sección | Contenido |
| --- | --- |
| source | null mientras no exista fuente; después documentReference, version, sha256 del documento, clinicApprover, approvedOn YYYY-MM-DD |
| procedures[] | evidenceRow (referencia a fila/página de la fuente) y data con el DTO create existente; requiresAuthorization, requiresReferral e isActive obligatorios explícitos, sin defaults en el simulador |
| tariffs[] | evidenceRow, procedureCode externo y data con amount string, currencyCode explícita, validFrom, validTo opcional e isActive explícito |

`batchSha256` vincula el informe al JSON de entrada serializado mediante JSON.stringify; no es hash de los bytes/espacios del archivo ni una prueba de autorización. `sourceAuthenticityVerified=false`: completar campos de procedencia no acredita que la clínica los haya firmado ni verifica los bytes del documento. No poner datos de pacientes en un lote de catálogo.

El simulador reconoce igualdad por mayúsculas/acentos como la BD, unicidad incluso para tarifas inactivas y vigencias inclusivas. Una tarifa hasta el día 30 y otra desde el 30 se superponen; desde el 31 pueden ser adyacentes. Monedas diferentes se analizan separadamente. Puede referenciar un procedimiento existente o uno del lote. No modifica ni reserva ninguno: se necesita revalidar al aplicar.

Desde backend, exclusivamente con una base local dedicada identificada:

```powershell
$env:TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:55441/odontho_final06_20261102_test"
node --import tsx src/scripts/preflight-final06-db.ts
node --import tsx src/scripts/preflight-final06-db.ts --master-batch ../database/postgresql/final06-master-batch.template.json
node --import tsx src/scripts/preflight-final06-db.ts --sql
```

Procedimiento para una carga posterior, **pendiente de fuente y de implementación Backend de su aplicación**:

1. Negocio/clínica entrega fuente versionada, responsable, vigencias, reglas por clase de servicio y especificación del archivo destino. Cerrar NumberOfTreatments, Assistance, PoliClinic y evidencia de remisión. Publicar explícitamente alcance de piloto.
2. Preparar y revisar manifiesto contra esa fuente; ejecutar la precarga y el diagnóstico previo en QA. Resolver duplicados/ambigüedades sin borrar ni renombrar maestros históricos automáticamente. Determinar impacto del catálogo global y de la unicidad PoliClinic.
3. Backend debe proporcionar el aplicador autorizado: comprobación de permisos existentes del catálogo, relectura bajo los mismos locks del servicio, ausencia de upsert silencioso y cambio más auditoría en la misma transacción. Registrar hash del lote, referencia/versión/hash de fuente, aprobador y evidenceRow junto a old/new y correlationId. Los servicios actuales ya auditan sus mutaciones, pero **no registran por sí solos toda esa procedencia de lote**; este punto no se declara implementado.
4. Probar el aplicador primero en QA: fallo parcial/rollback, reenvío/idempotencia, contención contra edición manual y vínculo del informe con los datos realmente aplicados. No basta con un dry run aprobado para autorizar el destino ni se reusa el seed general como importador.
5. Revisión clínica de captura → firma → candidato → READY → archivo del portal con la fuente real. Solo después planificar la carga autorizada del destino, respaldo verificable y comprobación posterior. No editar snapshots ni regenerar documentos previos como efecto de esa carga.

Retorno de esta entrega: las herramientas nuevas no cambian tablas/datos y no requieren down. Para una futura carga con datos reales, corregir maestros mediante operaciones auditadas o restauración validada en destino separado; nunca borrar referencias utilizadas o reescribir contenido firmado como rollback.

## Evidencia y entrega entre áreas

Entorno: PostgreSQL 17.11 local, puerto 55441, base propia `odontho_final06_20261102_test`; baseline + cuatro migraciones existentes y core seed solo en ese QA. Otra base vacía `odontho_final06_legacy_20261102_test` se reservó para la regresión de migración, sin reset ni operaciones sobre la base del chat Backend. Fixtures nuevas se retiran por IDs conocidos.

Al cerrar se detuvo únicamente este cluster propio, conservando bases y reportes. Para repetir comprobaciones locales, iniciarlo antes con `pg_ctl -D C:/workspace/app-DentalService/backend/storage/final06-db-qa/data -l C:/workspace/app-DentalService/backend/storage/final06-db-qa/server.log -o "-h 127.0.0.1 -p 55441" -w start`. Una nueva regresión legada requiere otra base vacía `_test`, sin reutilizar/resetear la ya migrada.

Pruebas nuevas: [integración DB](../../backend/tests/integration/svb-final06-database.test.ts) y [validación/seguridad CLI](../../backend/tests/unit/svb-final06-preflight.test.ts). Cubren ausencia de defaults, tipos exactos/RLS/unicidad, vínculos cruzados, diagnóstico de nulls con el mapper común, ausencia de valores en reportes, duplicados por acento/mayúscula, tarifas por moneda/límites, falta de fuente, ausencia de escrituras, cambios auditados sin reescribir snapshots/hash y rollback por fallo de auditoría.

Resultados frescos:

- Typecheck y build correctos después de los cambios.
- **13 pruebas propias aprobadas** (7 DB y 6 validación/CLI). La repetición final junto a health aprobó **16 pruebas en 4 archivos**, después de ejecutar la suite ampliada sobre la misma base. Reporte: `backend/storage/final06-db-qa/targeted-results.json`.
- Diagnóstico CLI final: once reglas estructurales sin hallazgos; piloto BLOCKED y realSubmissionApproved=false. Plantilla vacía: bloqueos AUTHORIZED_MASTER_SOURCE_MISSING y EMPTY_MASTER_BATCH; canApply=false. Ambas ejecuciones devolvieron 2, como exige su estado. Reportes locales `diagnostic-results.json` y `empty-batch-results.json` en el mismo directorio.
- SQL generado coincide con el generador; once consultas ejecutadas en QA y doce enlaces locales verificados. Diff de la guía sin errores de whitespace.
- La regresión ampliada **no se declara aprobada**: 403 pruebas aprobadas y 3 fallidas, más un error al iniciar un worker. Reporte conservado `backend/storage/final06-db-qa/test-results.json`. Dos fallos son de `tests/integration/encounter-procedure.test.ts`: la petición de actualización aún envía quantity y espera 200, mientras el schema actual estricto la rechaza con 400; después falta el evento UPDATE en la comprobación de auditoría que depende de ese caso. Es un ajuste de contrato/prueba a resolver por Backend, sin debilitar la validación. El tercer fallo fue un timeout de health/ready y el worker fue health/live; ambos archivos aprobaron en la repetición aislada posterior. La regresión legada opt-in de migración sí aprobó en su segunda base vacía.

Los reportes contienen evidencia sintética de QA, no credenciales. Estos resultados no acreditan fuentes clínicas, portal real ni aceptación Frontend. La suite ampliada coexistió con cambios de Backend en archivos de su propiedad; esta entrega no los sobrescribe ni se atribuye su resolución.

Backend está implementando en paralelo el piloto bloqueado, lectura de policlinicCode y validación de accidente/remisión. Se le deja este handoff en disco; no se editó ninguno de sus módulos/schema/seeds/migraciones. El diagnóstico consume su módulo de readiness. PATCH de sede, registro/lookup de accidentes/remitentes, captura de campos y aplicador con procedencia siguen sujetos a su entrega y las fuentes; las rutas propuestas no se declaran montadas aquí. Frontend/Diseño y Negocio/Arquitectura deben cerrar su aceptación por separado.

Referencias técnicas revisadas: [constraints PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-constraints.html), [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog Supabase](https://supabase.com/changelog). Se preserva el diseño de autorización de Express, sin cambios de producto Supabase.
