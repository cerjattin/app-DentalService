# Backend — NEG-FUNC-03, 04 y 05

Fecha: 2026-10-31. Alcance: Backend local y soporte de integridad reproducible en PostgreSQL dedicado. Las rutas descritas están montadas en `src/app.ts`; no equivalen a despliegue, integración Frontend ni aceptación de navegador/Supabase operativo.

## B03 — Organización y autoridad del Declarant ID

| Método | Ruta bajo `/api/v1` | Permiso | Respuesta |
| --- | --- | --- | --- |
| GET | `/organization` | `organization.read` | 200, OrganizationSettings |
| PATCH | `/organization` | `organization.update` | 200, OrganizationSettings |

DTO: `id`, `legalName`, `tradeName`, `declarantId`, `email`, `phone`, `timezone`, `updatedAt`, `revision`. ID y revisión son strings; campos anulables conservan null. No se devuelven relaciones ni secretos. La organización se obtiene exclusivamente del actor autenticado y debe estar activa/no archivada.

PATCH estricto: `expectedRevision`, `reason` recortado 1–500 y al menos un campo entre `legalName`, `tradeName`, `declarantId`, `email`, `phone`. No acepta IDs, timezone, estado, numeración ni campos internos. Los límites y la nulabilidad corresponden al contrato 03; Declarant ID conserva ceros y admite solo 1–5 dígitos o null. Esa restricción procede del exportador técnico actual, no certifica reglas oficiales SVB.

Backend calcula SHA-256 de una representación canónica de los campos publicados y updatedAt. PATCH bloquea/relee la fila y compara la revisión dentro de la transacción. Conflicto: 409 `ORGANIZATION_VERSION_CONFLICT`. Unicidad: 409 `DECLARANT_ID_ALREADY_EXISTS`, sin revelar otra organización. Inexistente/no disponible: 404 `ORGANIZATION_NOT_FOUND`. Auditoría `ORGANIZATION_UPDATE` y cambio confirman/revierten juntos.

Settings no actualiza facturas, procedimientos, ítems, firmas, hashes ni PDFs anteriores. La creación existente de factura conserva su origen organizacional. Un histórico incompleto requiere corrección/reconciliación explícita.

### Declaraciones

- `POST /declarations` crea un lote con `declarantIdSnapshot: null`. Ausencia/null del campo cliente se toleran durante transición; string no nulo devuelve 400 `DECLARATION_DECLARANT_SERVER_MANAGED`. El cuerpo ahora es estricto.
- `POST /declarations/:id/items` conserva `{ invoiceItemId: string }`. Bloquea lote e invoice, relee elegibilidad y asignación, toma el Declarant ID válido de la versión CLOSED vigente y lo congela en lote/ítem. No consulta la configuración actual para reemplazar ese histórico.
- Primer ítem vincula la identidad del lote. Los siguientes deben coincidir: 409 `DECLARATION_DECLARANT_MISMATCH`. Se conserva incluso tras retirar el último ítem; para otra identidad se crea otro lote.
- Snapshot fiscal de factura ausente/inválido devuelve `DECLARATION_SVB_DATA_INCOMPLETE/INVALID`. Otros campos SVB incompletos pueden permanecer Draft.
- Un Draft legado con identidad ausente, inválida, distinta entre lote/ítem o distinta de la factura origen devuelve 409 `DECLARATION_LEGACY_DATA_CONFLICT` al consultar candidatos, añadir o pasar a READY. No se repara automáticamente. Retiro/cancelación Draft siguen disponibles con motivo para resolver asignaciones, conservando auditoría.

Resolución legada: inspección protegida autorizada, conservar evidencia y decidir explícitamente entre cancelar/recrear el Draft con ítems compatibles o una reconciliación aprobada de datos. No alterar versiones firmadas ni elegir automáticamente un Declarant ID. La revisión del área Base de datos prepara diagnóstico independiente; no se inspeccionó clínica desde Backend.

Archivos principales: `src/modules/organization/*`, `src/modules/declarations/declaration-identity.ts`, schemas/service/repository de declaraciones, `src/app.ts`, OpenAPI y colección Postman principal.

## B04 — Candidatos, exclusividad y resolución Draft

`GET /declarations/:id/candidates` requiere **ambos** `declaration.read` e `invoice.read`. Lote ajeno/inexistente: 404 `DECLARATION_NOT_FOUND`; no Draft: 409 `DECLARATION_NOT_EDITABLE`.

Query estricto: `q` hasta 120, `from/to` opcionales sobre serviceDateSnapshot (fecha real, inclusiva y período ordenado), `page/pageSize` 1/20, máximo 100. Búsqueda literal sin distinguir acentos/mayúsculas sobre número de factura, código y descripción. Orden: serviceDate DESC, id DESC. Filtros y paginación son del servidor, en una única vista RepeatableRead para total/página.

DTO de candidato: strings `invoiceId`, `invoiceVersionId`, `invoiceItemId`; `invoiceNumber`, `detailInvoiceNumber` anulables; `versionNumber`; `serviceDate`, `procedureCode`, `procedureDescription`, `providerIdSnapshot`, `insuredIdSnapshot`, `amount` con dos decimales, `currencyCode`, `svbReadiness: COMPLETE|INCOMPLETE`, `issues`.

Solo aparecen invoices CLOSED de la organización/payer del lote, versión CLOSED **actual**, identidad fiscal válida/compatible y sin asignación a ningún lote no CANCELLED. GET no reserva. POST revalida; duplicado propio conserva `DECLARATION_ITEM_ALREADY_EXISTS`, otro lote activo produce 409 `DECLARATION_ITEM_ASSIGNED`; payer/estado/versión conservan sus errores específicos actuales.

`issues[].code`: `DECLARATION_SVB_DATA_INCOMPLETE` o `DECLARATION_SVB_DATA_INVALID`. Campos publicados: `DeclarantId`, `InvoiceNumber`, `DetailInvoiceNumber`, `ProviderId`, `Date`, `InsuredId`, `AccidentFormNumber`, `TreatmentId`, `Amount`, `NumberOfTreatments`, `Assistance`, `ReferrerId`, `PoliClinic`, `AdditionalNote`. Candidatos y READY/exportación usan el **mismo** diagnóstico del mapper. READY/exportación conservan el primer error existente. Diagnóstico no equivale a aceptación SVB. No se completa NumberOfTreatments/Assistance desde quantity.

### Integridad

`DeclarationActiveAssignment` mantiene propiedad actual con PK por invoiceItemId y unicidad de DeclarationItem. Triggers sincronizan inserción, retiro y cancelación; las FKs y validación de tupla impiden desacoplarla de ítem/lote/factura. Cancelación conserva DeclarationItem histórico; la propiedad actual se libera. La tabla nueva mantiene RLS habilitado, sin acceso directo del navegador.

`DeclarationBatch.lastItemSequence` es contador persistente interno. Se incrementa dentro de la transacción; no se publica ni acepta por API. Retirar la última línea no lo disminuye. Rollback de auditoría revierte contador, identidad e inserción. La inicialización considera líneas retenidas y auditorías ADD/REMOVE; evidencia inválida/no resoluble bloquea aplicación y requiere revisión protegida. No se elige ganador ante asignaciones activas duplicadas.

Locks: operaciones Draft y READY bloquean/releen el lote; agregar también bloquea la invoice antes de revalidar. Regreso a Clinical bloquea la misma invoice. Las transacciones Serializable reintentan solo conflictos reconocidos, incluidos P2010 con SQLSTATE 40001/40P01 de locks raw; al agotarse devuelven conflicto. La restricción física sigue garantizando una sola propiedad actual.

La corrección ordinaria conserva sus reglas existentes: invoice en corrección deja de ser candidata; el POST rechaza una selección obsoleta por estado/versión. Los históricos declarados no se reescriben al cerrar una sustitución. El regreso a Clinical continúa bloqueado por cualquier asignación activa de cualquier versión de esa invoice.

### Dependencia NEG-FE-REBILL-02 incorporada

En este checkout faltaban las rutas del contrato anterior. Se incorporaron al mismo módulo para resolver B04:

| Método | Ruta | Permiso | Body/éxito |
| --- | --- | --- | --- |
| DELETE | `/declarations/:id/items/:itemId` | `declaration.update` | JSON `{ reason }`; 200, Declaration completo |
| POST | `/declarations/:id/cancel` | `declaration.update` | JSON `{ reason }`; 200, Declaration completo CANCELLED |

Motivo estricto 1–500 recortado. `itemId` es DeclarationItem.id. Solo Draft sin exports/submissions. Errores: `DECLARATION_ITEM_NOT_FOUND`, `DECLARATION_NOT_EDITABLE`, `DECLARATION_HAS_EXPORTS_OR_SUBMISSIONS`, además de autenticación/validación/propiedad habituales. Auditorías `DECLARATION_ITEM_REMOVE` (snapshot completo previo) y `DECLARATION_CANCEL`; cancelación registra historial DRAFT→CANCELLED. Un Draft vacío no puede pasar a READY.

`INVOICE_DECLARATION_ASSIGNED` conserva 409. Con `declaration.read`, error.details.assignments contiene los lotes bloqueantes de la organización y sus `{ declarationItemId, invoiceItemId }` strings; sin ese permiso no publica detalles. Resolver un Draft no reabre Clinical automáticamente.

Archivos principales: `declaration-candidates.service.ts`, `declaration-draft.service.ts`, controller/routes/schemas/repository/service existentes, mapper compartido, `invoice-clinical-reopen.service.ts`, helper de conflictos y migraciones nuevas.

## B05 — Casos de tratamiento

| Método | Ruta | Permiso | Éxito |
| --- | --- | --- | --- |
| GET | `/patients/:patientId/treatment-cases` | `treatment_case.read` | 200, lista paginada |
| GET | `/patients/:patientId/treatment-cases/:caseId` | `treatment_case.read` | 200, detalle |
| POST | `/patients/:patientId/treatment-cases` | `treatment_case.manage` | 201, caso |
| PATCH | `/patients/:patientId/treatment-cases/:caseId` | `treatment_case.manage` | 200, caso |

DTO del contrato 05 más **`isEditable: boolean` calculado por Backend** para que UI no infiera la primera utilización. IDs internos y referencia externa son strings distintos. Fechas ISO|null. La marca interna `firstAssignedAt` no se serializa.

POST estricto: `treatmentId` externo 1–7 caracteres, `treatmentType` anulable hasta 100 y `description` anulable hasta 5000. Conserva ceros y texto; paciente/organización/actor y estado PLANNED provienen del servidor. PATCH admite los mismos campos, al menos uno; solo PLANNED nunca utilizado. No hay DELETE ni cambio de estado. Lista: `q` hasta 120, status del enum, 1/20 máximo 100; createdAt DESC, id DESC, búsqueda literal normalizada por servidor.

Paciente ajeno/inactivo para escritura: `PATIENT_NOT_FOUND`. Caso ajeno: `TREATMENT_CASE_NOT_FOUND`. Duplicado por paciente: `TREATMENT_ID_ALREADY_EXISTS`. Caso utilizado/no PLANNED: `TREATMENT_CASE_NOT_EDITABLE`. La primera vinculación queda registrada transaccionalmente por trigger, incluso si una cita posterior elimina su referencia. No se crea un lifecycle nuevo.

Crear/cambiar referencia en citas valida paciente, organización y PLANNED/ACTIVE bajo bloqueo. COMPLETED/CANCELLED produce `TREATMENT_CASE_NOT_ASSIGNABLE`. Cambiarla después de registrar cualquier procedimiento, incluso VOID, produce `APPOINTMENT_CLINICAL_CONTEXT_LOCKED`. La captura de procedimiento toma el mismo lock de cita y congela el TreatmentId externo; valida además el contexto legado paciente/organización antes de copiarlo. Se conservan las demás reglas de agenda y los snapshots existentes.

Permisos preparados en seed: Admin ambos (conjunto completo), Provider ambos, Reception lectura. Son asignaciones persistidas; no se autorizan rutas por nombres de rol. Seed-verify espera 70 permisos, Admin 70, Reception 36 y Provider 31. No se sincronizó ningún rol operativo remoto.

Archivos principales: `src/modules/treatment-cases/*`, servicios de citas/procedimientos, schema/cliente Prisma, seed/seed-verify y migración de primera vinculación.

## Aplicación y coordinación

Migraciones nuevas, posteriores al baseline conservado:

1. `20261031000000_declaration_assignment`: detecta duplicados activos, contador y propiedad actual.
2. `20261031010000_treatment_case_usage`: primera utilización de caso, con backfill de vínculos/auditoría existentes.
3. `20261031020000_declaration_integrity`: revisión incremental de evidencia ADD/REMOVE y protección de tupla actual.
4. `20261031030000_declaration_evidence_checks`: rechaza fuentes de ordinal contradictorias y verifica tuplas actuales ya pobladas.

Se aplicaron exclusivamente en `odontho_neg_func_test`, PostgreSQL 17 local dedicado. No se aplicó nada a Supabase operativo. Antes de habilitar en otro entorno: revisión DB y diagnóstico protegido, respaldo/restauración verificados cuando corresponda, aplicación serial de migraciones y sincronización controlada de permisos. No cambiar solo el código si faltan las nuevas estructuras.

**Preflight obligatorio antes de aplicar la cadena completa sobre datos existentes:** usar el [diagnóstico de Base de datos](../src/scripts/diagnose-neg-func-db.ts), basado en un [único módulo de consultas](../src/infrastructure/database/neg-func-diagnostics.ts). En QA, el comando exige TEST_DATABASE_URL local con sufijo `_test`; no recurre a DATABASE_URL ni a `.env`. Devuelve `migrationBlocked` y conteos sin snapshots ni secretos. La opción `--include-qa-ids` está reservada al entorno local protegido.

Para preparar una inspección de otro entorno previamente autorizada, `node --import tsx src/scripts/diagnose-neg-func-db.ts --sql` imprime SQL de solo lectura y conteos, sin conectarse. La inspección y revisión deben preceder **toda** la cadena: bloquean identidad fiscal legada contra factura, duplicados activos, evidencia ADD/REMOVE inválida o contradictoria, ownership inconsistente y referencias de paciente/organización ajenas en casos/citas o auditorías de primera utilización. Un bloqueo requiere reconciliación explícita; no aplicar backfills para resolverlo automáticamente. Las migraciones incrementales no sustituyen este diagnóstico previo.

Retorno: detener consumidores nuevos y restaurar el respaldo validado en un destino separado. No borrar tablas/contadores/auditoría para simular rollback y no volver a un código que permita overrides/asignaciones duplicadas contra los datos nuevos. Una reversión in situ necesita una migración revisada por Base de datos que preserve la evidencia.

Frontend integra FE03/04/05 después de esta publicación: retirar captura manual de Declarant ID; devolver expectedRevision; conservar edición en conflictos; usar candidatos reales e issues; registrar/seleccionar casos con permisos; invalidar recursos afectados y Dashboard. Este chat no modifica Frontend ni acredita navegador. Los contratos de Negocio siguen pendientes de cierre transversal.

## Verificación

Resultados reales de Backend en esta entrega:

| Comprobación | Resultado |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS |
| Regresión final propia de Backend: todas las unitarias e integraciones existentes + `neg-func-03-05.test.ts` | **38 archivos, 371 pruebas PASS** |
| Migraciones nuevas + seed | PASS, exclusivamente en PostgreSQL local dedicado |
| JSON de colecciones Postman, enlaces de documentación y diff whitespace | PASS |
| Postman manual, navegador, Frontend y aplicación a Supabase operativo | NO EJECUTADOS en este chat |

La primera ejecución sin acceso loopback falló con EACCES en los tests HTTP; se repitieron con el acceso local permitido y pasaron. La integración nueva detectó fixtures incompletos, collation de búsquedas y conflictos raw P2010; se corrigieron y verificaron. No se usan esas primeras ejecuciones fallidas como aceptación. Se observa una advertencia de deprecación de pg sobre consultas concurrentes en una conexión en partes de la suite existente; no es un fallo de tests ni una actualización de dependencias en este alcance.

La ejecución final seleccionó `tests/unit` y todos los archivos de `tests/integration` anteriores más `neg-func-03-05.test.ts`; excluyó los nuevos `neg-func-database`/migraciones que el chat de Base de datos preparaba y probaba en otra base. Posteriormente esa área reportó 8 pruebas DB independientes y el escenario de migración legada PASS; son evidencia de su entrega, no se suman al conteo Backend. El cluster local de QA permanece disponible para esa revisión, con archivos bajo `backend/storage/neg-func-03-05-qa` (ignorados por Git).

Las pruebas usan exclusivamente TEST_DATABASE_URL local con sufijo `_test`; el setup sigue rechazando destinos remotos. No se ejecutaron pruebas de producto ni seeds contra clínica. La revisión DB independiente y sus nuevos archivos/evidencias pertenecen al chat de Base de datos y se deben consultar en su entrega.
