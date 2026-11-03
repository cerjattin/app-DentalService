# NEG-FINAL-06 — Backend y dependencias externas

Actualización vigente DEP10/12: la habilitación manual descrita en la actualización anterior se aplaza. `manualPortalRecordingEnabled` es **false por defecto**, true solo en QA sintético local explícito. [Contrato actual](NEG_DEP_10_12.md); fuentes SVB y REAL_SVB continúan bloqueados sin impedir QA clínico independiente.

Actualización 2026-11-03: captura campo por campo confirmada por usuario. [Registro manual implementado](NEG_FINAL_07_09.md) no exige archivo; readiness añade `manualPortalRecordingEnabled: true` y `manualEntryRequiresFile: false`. Fuentes/semántica clínica y certificación de archivo REAL_SVB siguen pendientes. El estado BLOCKED descrito abajo corresponde a esa entrega certificada, no a la disponibilidad del nuevo registro de hechos externos con comprobante.

Fecha: 2026-11-02. Estado: **controles independientes implementados; presentación real bloqueada por fuentes pendientes**.

El usuario confirmó en este chat que **no existe** la ficha versionada aprobada por la clínica. Esa ausencia impide definir la captura autorizada de NumberOfTreatments/Assistance, los valores de configuración SVB, la evidencia de remisión/accidente y el formato aceptado por el portal. Esta entrega no sustituye la ficha, no certifica P/K ni habilita servicios reales por tener datos técnicamente completos.

Contrato de origen: [NEG-FINAL-06](../../docs/negocio/CONTRATO_FINAL_06_DATOS_SVB.md). Se conservan los contratos 03/04/05, JWT/RBAC, aislamiento por organización, BigInt/Decimal string y fechas America/Curacao.

## API publicada

| Operación | Permiso | Resultado y alcance |
| --- | --- | --- |
| GET `/api/v1/svb-pilot/readiness` | `svb_procedure.read` | Estado del piloto real, sin parámetros ni mutaciones |
| GET `/api/v1/clinic-locations` | `clinic_location.read` | Conserva filtros/DTO y añade `policlinicCode: string|null` almacenado |
| POST `/api/v1/declarations/:id/ready` | `declaration.update` | Cuerpo opcional estricto `{ presentationPurpose?: "TECHNICAL"|"REAL_SVB" }` |
| POST `/api/v1/declarations/:id/exports` | `declaration.export` | Cuerpo estricto `{ format, presentationPurpose?: "TECHNICAL"|"REAL_SVB" }` |

Piloto publicado:

```json
{
  "contract": "NEG-FINAL-06",
  "status": "BLOCKED",
  "realSubmissionEnabled": false,
  "sourceSheet": null,
  "destinationFormat": null,
  "enabledServiceCodes": [],
  "enabledCaseTypes": [],
  "issues": [
    { "field": "SourceSheet", "code": "SVB_SOURCE_RULES_NOT_CONFIGURED" },
    { "field": "DestinationFormat", "code": "SVB_DESTINATION_FORMAT_NOT_VERIFIED" }
  ],
  "unresolvedFields": ["NumberOfTreatments", "Assistance", "PoliClinic", "ReferralEvidence"]
}
```

Envelopes y autenticación existentes. No hay flag de cliente, variable de entorno, ID ni maestro que pueda declarar un servicio aprobado. Habilitar el piloto requiere implementar posteriormente las reglas verificadas de la ficha y su alcance por servicio/caso.

READY/exportación con `presentationPurpose: "REAL_SVB"` devuelven **409 `SVB_REAL_PRESENTATION_NOT_ENABLED`**, con el diagnóstico de fuentes/formato en `error.details`. El guard se ejecuta tras verificar propiedad/estado, antes de transiciones, archivos, consumo de ordinales o reutilización de caché. No se modifica un lote ni se produce un archivo real durante el rechazo.

Omitir el propósito mantiene el comportamiento **TECHNICAL** de los contratos anteriores. Las validaciones técnicas de campos no se relajan: faltantes/invalidaciones conservan `DECLARATION_SVB_DATA_INCOMPLETE`/`DECLARATION_SVB_DATA_INVALID`. Esa compatibilidad no significa aprobación para usar un archivo en el portal.

Candidatos, DTO de Declaration y DTO de Export añaden `realPresentationReadiness`, con el objeto `status/realSubmissionEnabled/issues` anterior. `svbReadiness: COMPLETE` continúa siendo exclusivamente validación técnica. Las exportaciones nuevas y sus documentos registran en metadata `presentationPurpose: TECHNICAL` y `realSubmissionEnabled: false`; READY técnico conserva el propósito en historial/auditoría. No se alteran bytes ni metadata históricos. El nuevo campo de lectura describe el estado **actual del piloto**, no reinterpreta un resultado externo histórico.

## Captura, vínculos y trazabilidad

Los cuerpos de POST/PATCH de procedimientos son ahora estrictos. POST conserva patientInsuranceId, svbProcedureId, authorizationItemId, diagnosisId, quantity y additionalNote. PATCH conserva solo diagnosisId y additionalNote. Campos como NumberOfTreatments, Assistance, referrerId, snapshots fiscales o quantity en PATCH se rechazan; no se descartan silenciosamente ni se convierten en aprobación de datos. No se añadió edición de contenido firmado.

Un procedimiento **nuevo** cuyo servicio requiera remisión devuelve **409 `SVB_REFERRAL_FLOW_NOT_SUPPORTED`**. El check se realiza antes de consumir autorizaciones e insertar, y se repite bajo la transacción y lock compartido del procedimiento: cambiar requiresReferral después del preflight no elude el bloqueo. Seleccionar un Referrer ID no acredita evidencia autorizada; no existe nueva ruta de captura/gestión de remisiones en esta entrega. Los registros históricos siguen legibles.

Se validan las referencias existentes a AccidentCase antes de crear/cambiar una cita y antes de capturar el snapshot de un procedimiento. Se comprueban paciente/organización y, si el caso está vinculado a un seguro, el paciente/organización de ese seguro y su coincidencia con la cobertura del procedimiento. No se definen reglas de aplicabilidad ni lifecycle de accidente sin fuente.

- Caso inexistente, de otro paciente o de otra organización: **404 `ACCIDENT_CASE_NOT_FOUND`**, sin revelar al propietario.
- Seguro incoherente o distinto del contexto vinculado: **409 `ACCIDENT_INSURANCE_CONTEXT_MISMATCH`**.
- Cambiar/eliminar la referencia de accidente una vez registrado cualquier procedimiento, incluso VOID: **409 `APPOINTMENT_CLINICAL_CONTEXT_LOCKED`**.
- En captura se comprueba también la organización del profesional y la sede antes de copiar sus valores. Referencias legadas ajenas producen los errores existentes `PROVIDER_NOT_FOUND`/`LOCATION_NOT_FOUND`.

La captura usa el mismo lock de cita que los cambios de contexto. Una referencia legada inconsistente no se corrige copiando datos ajenos. NumberOfTreatments/Assistance permanecen null en nuevos procedimientos; no se derivan de quantity. Tras la captura, cambiar AccidentCase, ClinicLocation o un maestro no reescribe snapshots anteriores.

`ENCOUNTER_PROCEDURE_CREATE` añade metadata de procedencia técnica y `svbSourceState: UNAPPROVED`. Esa metadata describe el recorrido de datos, no una certificación de la clínica. No se cambia el hash de las versiones firmadas ni el canonicalizador de firma.

La auditoría congela además requiresReferral/requiresAuthorization evaluados en captura. Bajo el mismo lock del maestro se vuelve a exigir la autorización cuando corresponda; activar requiresAuthorization después del preflight no permite una captura sin autorización. Se conserva `PROCEDURE_AUTHORIZATION_REQUIRED` y la validación/consumo existente.

## Auditoría del origen actual por campo

| Campo | Origen y momento actuales | Estado de fuente/limitación |
| --- | --- | --- |
| DeclarantId | Organization al crear InvoiceVersion; primera versión CLOSED vigente vincula el lote y DeclarationItem | Conserva ceros e identidad histórica; ficha clínica pendiente |
| ProviderId | Profesional del encuentro, organización validada; se congela en EncounterProcedure y se copia a factura/declaración | No se rellena un histórico desde Provider actual |
| InsuredId | PatientInsurance validada por paciente/organización/vigencia en captura | Snapshot copiado a factura/declaración; no equivale a autorización externa |
| TreatmentId | TreatmentCase externo validado de la cita, congelado al registrar el procedimiento | Sin generación por cantidad, paciente o clave interna |
| NumberOfTreatments | Null en nueva captura; históricos/correcciones técnicas conservan su snapshot | **Semántica y captura autorizada pendientes** |
| Assistance | Null en nueva captura; históricos/correcciones técnicas conservan su snapshot | **Semántica y captura autorizada pendientes** |
| PoliClinic | ClinicLocation de la cita, organización validada; congelado al capturar procedimiento | GET muestra valor/null; P/K sigue siendo solo la regla técnica del mapper |
| Autorización externa | SvbAuthorizationItem y autorización validadas por paciente/seguro/procedimiento/vigencia/cantidad | Consumo transaccional y liberación existentes; no depende de Declarant ID |
| AccidentFormNumber | AccidentCase existente, paciente/organización/seguro validados; congelado en procedimiento | No hay nuevo registro/lookup hasta cerrar evidencia y aplicabilidad |
| ReferrerId/remisión | No hay captura de evidencia autorizada | Servicios nuevos requiresReferral quedan bloqueados |
| Date | Inicio programado de cita convertido a fecha de negocio en Curaçao al construir InvoiceItem | La declaración copia serviceDateSnapshot; no usa timezone del equipo |
| Importe/moneda | Tarifa vigente por fecha/moneda y quantity Decimal en captura; snapshots posteriores | Sin float financiero, suma entre monedas ni cambio de tarifa histórica |

La creación de correcciones mantiene la versión nueva, su auditoría y nueva firma; sus campos técnicos históricos no pasan a ser semántica aprobada porque superen un regex. La habilitación real sigue bloqueada globalmente.

## Trabajo que requiere la ficha o entrega de otra área

| Parte del contrato 06 | Estado y dependencia exacta |
| --- | --- |
| Captura de NumberOfTreatments/Assistance | Bloqueada: faltan fuente versionada, responsable clínico, obligatoriedad, valores y regla por clase |
| PATCH `/clinic-locations/:id/svb-settings` | **No publicado**: body/valores deben fijarse con la fuente; no se toma P/K como autorización oficial |
| Registro/lookup de AccidentCase y Referrer | **No publicado**: faltan aplicabilidad/evidencia y alcance autorizado; solo se fortalecen vínculos existentes |
| Importación/escritura de maestros y tarifas productivas | No ejecutada; faltan archivos reales y procedencia/vigencias aprobadas. No se sustituyen por fixtures |
| Aprobación del formato portal | Bloqueada: faltan versión, formato, encoding, delimitadores/anchos, cabeceras, fechas, decimales, longitudes/ceros y adjuntos confirmados |
| Presentación/comprobante/resultado manual | Alcance posterior del contrato 07; no se implementó un adaptador que simule carga |

El área de Base de datos prepara de forma independiente `svb-final06-preflight.ts`, `svb-master-preflight.ts` y `preflight-final06-db.ts`, con diagnóstico/procedencia técnica. Esos archivos no son autoría ni certificación de este chat. El preflight no habilita por sí mismo la carga productiva.

Frontend puede consumir GET de sedes/piloto y `realPresentationReadiness`, mostrar bloqueos y conservar el recorrido técnico identificado como tal. No habilitar campos ni llamar las rutas propuestas de escritura aún no publicadas. No mostrar COMPLETE/READY/exportación como autorización de presentación real. Para una solicitud real futura usar propósito explícito y respetar el rechazo del servidor.

## Archivos de esta entrega Backend

- `src/modules/svb-readiness/{svb-readiness.service,svb-readiness.routes,svb-readiness.openapi}.ts`.
- `src/modules/clinic-locations/{clinic-location.repository,clinic-location.service,clinic-location.routes}.ts`.
- `src/modules/appointments/accident-context.{repository,service}.ts` y `appointment.service.ts`.
- `src/modules/encounter-procedures/encounter-procedure.{schemas,service}.ts`.
- `src/modules/declarations/declaration.{schemas,controller,service,types}.ts` y `declaration-candidates.{service,openapi}.ts`.
- `src/app.ts`, `src/docs/openapi.ts`, `src/modules/reports/dashboard.openapi.ts`.
- Pruebas Backend `tests/{unit,integration}/svb-final06-backend.test.ts`; ajustes en `encounter-procedure.test.ts` y `operational-gaps.test.ts`.
- Este documento, API Freeze, Frontend Handoff, guía Backend y colección/guía Postman de contrato 06.

No se modifican schema, migraciones, seeds, dependencias ni frontend desde este chat. Se conservan los cambios locales de las demás áreas.

## Verificación

Entorno propio: PostgreSQL 17.11 local, base nueva `odontho_final06_backend_20261102_test`. Solo se aplicó el historial existente y configuración mínima sintética en esa base dedicada; no hubo conexión ni escritura a datos clínicos/Supabase operativo.

- Nuevos escenarios: **19 pruebas PASS** en dos archivos.
- Captura + escenarios nuevos tras ajustar el PATCH estricto: **30 pruebas PASS** en tres archivos.
- Typecheck/build: PASS.
- Regresión completa ejecutada tras los cambios principales: **415 pruebas PASS, 1 omitida; 44 archivos PASS, 1 omitido**. Después se agregó el recheck transaccional del requisito de autorización y se verificó junto con captura/remisión en los **30 escenarios PASS** ya indicados; esos conteos son ejecuciones separadas y no se suman.
- La primera regresión detectó una expectativa antigua de ignorar quantity en PATCH. Se corrigió para exigir rechazo del campo desconocido y probar después el guardado válido; la regresión posterior pasó.
- OpenAPI, colección Postman JSON, enlaces de documentación y diff whitespace se revisan en esta entrega; no se ejecutó el cliente Postman ni navegador desde Backend.
- La migración legada opt-in usa otra base vacía mediante NEG_FUNC_LEGACY_TEST_URL; no se activa dentro de la suite ordinaria.
- Pendientes por fuente: no existe evidencia válida para certificar servicio ordinario real, remisión/accidente real ni aceptación del archivo por el portal. QA sintético no cierra esas casillas.
