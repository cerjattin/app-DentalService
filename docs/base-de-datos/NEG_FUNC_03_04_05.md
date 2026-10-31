# DB03/DB04/DB05 — integridad y entrega a Backend

Fecha: 2026-10-31. Encargo: [responsabilidades por asistente](../negocio/ENCARGOS_ASISTENTES_FUNC03_05.md). Contratos: [03](../negocio/CONTRATO_ORGANIZACION_SVB.md), [04](../negocio/CONTRATO_CANDIDATOS_DECLARACIONES.md), [05](../negocio/CONTRATO_CASOS_TRATAMIENTO.md).

## Alcance y propiedad de archivos

Se coordinó con el chat Backend la edición exclusiva por ese responsable de schema, seed/seed-verify, cliente generado, servicios y migraciones. Este chat aportó revisión de integridad, hallazgos incorporados por Backend, diagnóstico reproducible, pruebas independientes y esta guía. No hubo ediciones simultáneas de esos archivos ni operaciones contra Supabase operativo, migración MySQL, commit o publicación.

**Estado:** soporte implementado y probado en PostgreSQL local dedicado. La aplicación de estas nuevas migraciones/roles en destino y la aceptación Frontend/navegador siguen pendientes. Los estados de propuesta de los contratos de Negocio no se cierran automáticamente por esta entrega.

## DB03 — configuración y primera identidad

- `Organization.declarantId` conserva `String? / varchar(64)` y la unicidad existente. Los nuevos valores se validan como 1–5 dígitos sin conversión numérica; espacios/formatos incompatibles no se normalizan silenciosamente. `"00123"` conserva sus ceros. No se agrega un CHECK que impida leer datos legados ni se reescriben snapshots para ajustar la organización actual.
- Backend calcula la revisión SHA-256 de la configuración publicada y `updatedAt`, bloquea/relee la fila y compara `expectedRevision` en la transacción. No hace falta un campo de revisión adicional. La prueba real de dos escritores con la misma revisión confirma un éxito y un conflicto; un fallo de auditoría revierte la configuración/revisión.
- Un lote nuevo nace con identidad null. La primera incorporación toma la identidad de su factura CLOSED vigente bajo lock de lote; la siguiente debe coincidir. Dos primeras incorporaciones con identidades distintas no confirman ambas. Retirar el último ítem conserva la identidad; para cambiarla se crea otro lote.
- El diagnóstico de Draft compara lote, ítem **y versión de factura origen**. Detecta overrides antiguos aparentemente coherentes dentro del lote pero incompatibles con la factura. No elige una identidad ni cambia facturas/hashes/PDF. Backend devuelve `DECLARATION_LEGACY_DATA_CONFLICT` para ese registro.

## DB04 — exclusividad, ordinales y Clinical

### Modelo y transacciones concretas

`DeclarationActiveAssignment` contiene únicamente propiedad actual: PK por `invoiceItemId`, unicidad de `declarationItemId`, FK a ítem/factura/lote, índice por lote y RLS. Los triggers mantienen la relación desde el historial y validan que la tupla completa coincide con un ítem de lote no CANCELLED. No se agrega una unicidad global a `DeclarationItem.invoiceItemId`: el mismo ítem puede seguir presente en un lote cancelado y asignarse después a otro activo.

| Operación | Protección y resultado |
| --- | --- |
| Agregar | Lock del lote y de la factura, relectura de versión/payer/estado/identidad/asignaciones, incremento del contador y alta histórica; el trigger reclama propiedad única. Auditoría confirma o revierte todo |
| Retirar de Draft | Lock/relectura del lote y control de exports/submissions; elimina esa línea, guarda su snapshot en auditoría y libera su propiedad actual por FK. No modifica factura ni autorización clínica |
| Cancelar Draft | Conserva número, líneas y snapshots; estado/historial/auditoría y liberación de propiedad se ejecutan juntos. Otros lotes activos no se liberan |
| READY/export | Mismo lock de lote y validación posterior al bloqueo. Las mutaciones Draft no pueden confirmar sobre un lote congelado |
| Corrección/regreso a Clinical | El escritor de asignaciones y el regreso usan el lock de factura. El regreso comprueba **todas** las líneas y lotes activos. La prueba de dos líneas en dos lotes confirma que cancelar solo uno mantiene el bloqueo; cancelar el último permite el regreso sin cambiar hash/identidad/importe de la versión histórica |

El servicio usa Serializable y reconoce conflictos de Prisma y SQL raw (`40001`/deadlock) con reintentos acotados. No escribir ni limpiar la tabla de propiedad directamente para desbloquear una factura; resolver el Draft por las operaciones auditadas. GET candidates es una lectura RepeatableRead, no una reserva; POST siempre revalida.

### Contador

`DeclarationBatch.lastItemSequence` es el máximo ordinal consumido por ese lote. `allocateOrdinal` hace un incremento atómico dentro de la transacción, bajo lock; no consulta páginas del cliente ni utiliza `MAX + 1`. Retirar la última línea no reduce el contador. Fallos de auditoría/transacción no consumen un número ni dejan una asignación parcial.

La inicialización es única y considera líneas presentes y evidencia ADD/REMOVE. Un ADD antiguo puede resolverse por su ítem retenido o por `entityKey`/número del lote dentro de su organización. Así se conserva un ordinal retirado aunque no exista la última línea ni su evento REMOVE. Rangos, fuentes contradictorias, eventos no resolubles o duplicados activos se bloquean para reconciliación explícita; no se escoge un ganador ni se renumeran líneas. El `max` del análisis/backfill no es un asignador de números en tiempo de ejecución.

No puede demostrarse una retirada que no dejó ninguna evidencia conservada. Si se sabe que se borraron auditorías o hubo escrituras externas, se necesita un high-water respaldado por una fuente autorizada; un preflight sin hallazgos no certifica por sí solo la integridad de un histórico incompleto. No reiniciar el contador como solución. El rango máximo es el `integer` de PostgreSQL; agotarlo requiere resolución operativa explícita, nunca wrap/reset.

El formato legado recuperable por clave exige un número de lote conservado. Si un ADD no contiene batch ID, su línea fue retirada y el lote carece de número, el preflight lo marca no resoluble: la cadena actual no reconstruye ese caso a partir de un ID textual usado como clave. Requiere una resolución explícita antes de aplicar, sin editar auditoría para aparentar evidencia válida.

## DB05 — referencia externa, permisos y primer uso

Se reutiliza la clave única existente `(patientId, treatmentId)` y las relaciones de `TreatmentCase`; no se genera un TreatmentId. La referencia externa conserva texto/ceros y se distingue de la PK. Los nuevos registros API respetan el límite técnico de 7 caracteres; el almacenamiento legado no se estrecha ni se normaliza.

`firstAssignedAt` conserva la primera utilización aun después de retirar la referencia de una cita. La migración recupera evidencia de citas y auditorías; el trigger marca nuevas vinculaciones. Edición y primera vinculación adquieren el mismo lock de caso. La prueba usa una barrera real de locks en PostgreSQL para solapar ambos escritores: después de vincular, editar se rechaza, también tras desvincular. La lectura `isEditable` no reemplaza la validación transaccional.

Antes del backfill, diagnosticar también vínculos/auditorías con paciente/organización ajenos o IDs inválidos. No usar evidencia cruzada para marcar silenciosamente otro caso. Backend valida el contexto al asignar y al congelar el snapshot de un procedimiento. No se inventan `NumberOfTreatments` ni `Assistance`.

Matriz persistida comprobada:

| Rol del seed | treatment_case.read | treatment_case.manage |
| --- | --- | --- |
| ADMIN | Sí | Sí |
| PROVIDER | Sí | Sí |
| RECEPTION | Sí | No |

Admin conserva todos los permisos configurados. Las rutas autorizan por permiso; el nombre del rol solo identifica la asignación de seed. No se sincronizaron roles operativos remotos en esta entrega.

## Diagnóstico seguro y aplicación

Archivos de este chat:

- `backend/src/infrastructure/database/neg-func-diagnostics.ts`: consultas comunes y reporte, dentro de una transacción RepeatableRead READ ONLY y timeout. Tras migrar comprueba también ledger, contador y primer uso.
- `backend/src/scripts/diagnose-neg-func-db.ts`: CLI sin fallback a `.env`/`DATABASE_URL`, solo acepta `TEST_DATABASE_URL` local cuyo nombre termine en `_test`. Por defecto devuelve conteos; `--include-qa-ids` permite hasta 100 IDs técnicos por regla exclusivamente en ese QA.
- `database/postgresql/neg-func03_05_preflight.sql`: SQL generado desde el mismo módulo, compatible con el baseline y solo de lectura/conteos. Está preparado para una inspección protegida **autorizada por separado**; no se ejecutó en destino operativo.

`migrationBlocked: true` o cualquier fila SQL con `blocks_migration=true` y `affected_count>0` obliga a detener la aplicación. Los conflictos de identidad/configuración o evidencia congelada de un Draft son bloqueos funcionales de ese registro aunque no impidan físicamente crear la estructura. Conservarlos para Negocio/Backend; no ocultarlos mediante un default ni imprimir valores clínicos. La herramienta no repara datos.

Ejemplo local:

```powershell
Set-Location C:\workspace\app-DentalService\backend
$env:TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:55439/odontho_db_accept_20261031_test"
node --import tsx src/scripts/diagnose-neg-func-db.ts
# Regenerar el SQL sin abrir conexión:
node --import tsx src/scripts/diagnose-neg-func-db.ts --sql
```

Orden de aplicación posterior al diagnóstico protegido, con escritores detenidos y un único responsable:

1. `20261031000000_declaration_assignment`: rechaza duplicados activos/evidencia de retirada incompleta; prepara contador, ledger y RLS.
2. `20261031010000_treatment_case_usage`: primera utilización persistida.
3. `20261031020000_declaration_integrity`: recuperación de altas/retiradas y validación de tupla actual.
4. `20261031030000_declaration_evidence_checks`: comprueba fuentes contradictorias y tuplas existentes.
5. Seed/seed-verify revisados para permisos; luego habilitar Backend/Frontend coordinados y verificar el diagnóstico posterior.

**Ejecutar preflight antes de toda la cadena**, no solo antes del último archivo: las migraciones de Prisma son transacciones individuales, no una única transacción global. Las revisiones incrementales conservan SQL que ya se había aplicado en QA; una interrupción deja únicamente las migraciones previas confirmadas. No habilitar parcialmente el código ni editar checksums o marcar migraciones como aplicadas para saltar un conflicto. Guardar un respaldo/restauración verificado cuando haya datos que conservar.

Si falla una migración, comprobar cuál falló y si su transacción revirtió el DDL antes de decidir una resolución Prisma. Reconciliar por un responsable autorizado, conservar evidencia y volver a diagnosticar. No hacer reset/cleanup contra clínica ni ejecutar las suites de producto sobre datos clínicos para aprobar el despliegue.

## Verificación reproducible y límites

Se usó PostgreSQL **17.11**, loopback `127.0.0.1:55439`, con bases exclusivas de este chat, distintas de `odontho_neg_func_test` de Backend. No se inició/detuvo el cluster compartido ni se utilizaron conexiones de Supabase.

La base principal se creó vacía y recibió baseline + cuatro migraciones nuevas y seed. La prueba de legados necesita **otra** base vacía local terminada en `_test`; aplica SQL y escenarios sintéticos de forma controlada. No se hace reset automático. Si `NEG_FUNC_LEGACY_TEST_URL` no está definido, ese test se informa como omitido, no aprobado.

```powershell
$env:DATABASE_URL=$env:TEST_DATABASE_URL
$env:ODONTHO_MIGRATION_URL=$env:TEST_DATABASE_URL
$env:ODONTHO_ENV_FILE=""
npm.cmd run prisma:validate
# Solo sobre la base principal dedicada ya identificada:
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js db seed
$env:NEG_FUNC_LEGACY_TEST_URL="postgresql://postgres@127.0.0.1:55439/OTRA_BASE_VACIA_test"
npm.cmd run typecheck
npm.cmd run build
npm.cmd test -- --reporter=dot --reporter=json --outputFile=storage/neg-func-db-final-results.json
```

Las fixtures nuevas se retiran solo por sus IDs; no utilizan limpieza por prefijos ni dejan Declarant IDs que interfieran con otros archivos. Se verifican los CHECK/collations/RLS previos, identidad y hashes, no solo mocks. La prueba de migración demuestra rechazo/rollback de duplicados y auditoría inválida; recuperación del ordinal 20 de un ADD sin línea retenida; rechazo de evidencia contradictoria; primera vinculación histórica y ausencia de consumo del contador en rollback. Solo en ese fixture se modifican/cancelan registros sintéticos entre escenarios; el diagnóstico no hace esas operaciones.

Comprobaciones frescas: typecheck y build correctos; **384 pruebas aprobadas en 41 archivos** en la regresión completa (incluidos 9 escenarios DB, la regresión de migración legada y 3 pruebas de seguridad de la CLI). Reporte local: `backend/storage/neg-func-db-final-results.json`. El diagnóstico posterior tiene 15 reglas sin hallazgos; el SQL previo generado tiene 11 reglas sin hallazgos en ese QA. La ejecución de las 9 pruebas DB se repitió en la misma base después de la primera regresión para comprobar que el cleanup no causa colisiones de identidad. No se detuvo el cluster que mantiene Backend.

La aceptación API publicada por Backend se documenta en [su handoff](../../backend/docs/NEG_FUNC_03_04_05.md); no equivale a aceptación Frontend, navegador, datos legados operativos ni reglas oficiales SVB.

## Retorno

Las estructuras son aditivas, pero no debe regresarse a un backend que reasigne con MAX+1, permita override fiscal o ignore el primer uso. Para detener la entrega, parar escritores y deshabilitar su exposición mientras se revisa un código compatible, conservando tablas, contadores, marcadores y auditoría. No borrar el ledger o `first_assigned_at` para aparentar rollback. Si hace falta volver a un estado anterior, restaurar el respaldo validado en un destino separado con el código correspondiente y reconciliar escrituras posteriores explícitamente. Un down destructivo automático no conserva estos invariantes y no se entrega.

Referencias técnicas: [locks PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html), [constraints](https://www.postgresql.org/docs/17/ddl-constraints.html) y skill local [supabase-postgres-best-practices](../../.agents/skills/supabase-postgres-best-practices/SKILL.md).
