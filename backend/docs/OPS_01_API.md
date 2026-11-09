# OPS-01 — API de atención, factura e importación preparada

Actualizado el 8 de noviembre de 2026. Rutas montadas en Express bajo `/api/v1`. Nueva persistencia Dentalink acordada con DB en [modelo OPS-03](../../docs/base-de-datos/OPS_03_MODELO_DENTALINK.md), migración `20261107000000_dentalink_import`. No se ejecutó contra clínica. La clínica carece de acceso Dentalink; el adaptador HTTP real permanece sin configurar.

## Atención y facturación

Se conserva el [contrato funcional](../../docs/negocio/CONTRATO_ATENCION_FACTURACION_DENTALINK_20261106.md). Start y finish-services reciben body vacío estricto. Start requiere appointment.start + encounter.create; finish-services encounter.complete + appointment.complete. Capturar `{svbProcedureId, quantity?}` requiere procedure.update; `quantity` Decimal string, default 1.00. Seguro/tarifa/moneda/importes pendientes son null. El cuerpo legado con seguro conserva sus validaciones. No se requieren diagnóstico/notas/autorización/remisión para la captura mínima.

Start concurrente reintenta conflictos y devuelve la atención OPEN única. La atención reabierta por corrección en cita COMPLETED se recupera sin volver la cita a IN_PROGRESS. Una entrega legada CHECKED_IN puede avanzar y completar la cita; si la atención ya tenía fecha de finalización, se conserva. Finish sin PERFORMED devuelve ATTENTION_SERVICES_REQUIRED; repetición de entrega completada devuelve el mismo estado. Conflicto concurrente de cierre: ATTENTION_CHANGED. Alta/retiro/cierre/factura bloquean cita→atención. Cancelación/reprogramación después de empezar se rechaza por el servidor.

Factura: POST `/appointments/:appointmentId/invoice`, body vacío o `{patientInsuranceId?,currencyCode?}`. Requiere invoice.create. Cobertura/moneda únicas se resuelven automáticamente; ambigüedad produce INVOICE_INSURANCE_SELECTION_REQUIRED / INVOICE_CURRENCY_SELECTION_REQUIRED. Tarifa ausente/ambigua: SVB_TARIFF_NOT_FOUND / SVB_TARIFF_AMBIGUOUS. Errores conservan servicios pendientes para reintento; Decimal redondea cada línea a dos decimales. Reconstrucción mantiene invoice/number/seguro/moneda, exige nueva firma y conserva versiones/PDF anteriores. Admin actúa por permisos, sin bypass por nombre. Dashboard distingue volumen de atención y dinero valorado/facturado; no lo presenta como pago recibido.

## Dentalink: alcance y estado

Base `/integrations/dentalink`. Es una API **interna** para preparación; no define la API HTTP de Dentalink. Producción no tiene lector configurado. `enabled` habilita únicamente la cuenta lógica; no aporta credenciales ni permite eludir NOT_CONFIGURED. El adaptador sintético existe solo en pruebas e inyección de tests; runtime rechaza SYNTHETIC salvo NODE_ENV=test + PostgreSQL loopback `_test`. No hay fixtures, token, URL ni listas importables suministrados por un navegador.

Las doce operaciones requieren JWT/usuario activo, organización y permisos efectivos. Todas responden Cache-Control private/no-store. IDs locales/externos son strings; conserva ceros. Cambios desconocidos en body se rechazan. Listas paginadas usan `page=1`, `pageSize=20`, máximo100, envelope `{success:true,data:[...],meta:{page,pageSize,total,totalPages}}`.

| Método/ruta relativa | Permisos | Resultado |
| --- | --- | --- |
| GET `/accounts` | dentalink.read | Cuentas paginadas |
| POST `/accounts` | dentalink.manage | Cuenta nueva, 201 |
| PATCH `/accounts/:accountId` | dentalink.manage | Cambia enabled lógico, 200 |
| GET `/accounts/:accountId/status` | dentalink.read | Capacidad y conexión real no verificada |
| GET `/accounts/:accountId/mappings` | dentalink.read | Correspondencias de cuenta, 200 |
| PUT `/accounts/:accountId/mappings` | dentalink.manage | Upsert por kind/externalId, 200 |
| GET `/accounts/:accountId/previews` | dentalink.read | Ejecuciones paginadas, metadatos sin payloads |
| POST `/accounts/:accountId/previews` | dentalink.import + patient.read + appointment.read | Crea ejecución y lee primera página; 201/200 replay |
| GET `/accounts/:accountId/previews/:runId` | dentalink.read | Metadatos/estado/hash/conteos |
| GET `/accounts/:accountId/previews/:runId/items` | dentalink.read + patient.read + appointment.read | Filas normalizadas privadas e incidencias, paginadas |
| POST `/accounts/:accountId/previews/:runId/read-next-page` | dentalink.import + patient.read + appointment.read | Lee siguiente página, body vacío, 200 |
| POST `/accounts/:accountId/previews/:runId/confirm` | dentalink.import + patient.create + appointment.create + patient.read + appointment.read | Confirmación local, 201/200 replay |

ADMIN recibe dentalink.*; RECEPTION read/import y los permisos de pacientes/citas existentes; PROVIDER no obtiene acceso al módulo. No hay atajos por rol en las rutas. Los permisos persistidos requieren la migración y sincronización autorizada del destino. OpenAPI en `/api/openapi.json` publica las doce operaciones/DTO, junto con atención/factura.

## Cuerpos y DTO

- Cuenta POST: `{externalAccountId:string,label:string}`, enabled=false por defecto; identificación externa inmutable. PATCH `{enabled:boolean}`. Account DTO `{id,externalAccountId,label,enabled,createdAt,updatedAt}`; sin URL/token.
- Mapping PUT: `{kind:"PROVIDER"|"LOCATION",externalId:string,localId:string}`. Solo destino activo de la misma organización. No mapear estados remotos sin documentación: el alcance local crea citas SCHEDULED.
- Preview POST: `{idempotencyKey:string,from?:ISOOffset,to?:ISOOffset}`. Ambos extremos o ninguno; to>from. Ventana de inicio de cita `[from,to)`, con zona explícita. Claves16–120 ASCII `[A-Za-z0-9._:-]`. Cuenta/IDs externos1–255 caracteres exactos, sin controles ni espacios extremos. Son límites internos de preparación, no restricciones oficiales Dentalink.
- Confirm POST: `{idempotencyKey,expectedContentHash}`. Hash SHA-256 de la vista revisada; usar clave estable para reintentos. Preview y confirmación tienen claves independientes por cuenta.
- Run DTO: `{id,accountId,state,from,to,contentHash,counts,hasNextPage,sourceMode,realConnectionVerified:false,createdByUserId,createdAt,confirmedAt}`. State READING / PREVIEW_READY / CONFIRMED. Cursor se mantiene solo en servidor y no se expone. Counts `{total?,ready?,issues?,imported?,skipped?,pages?,sourceMode?}`.
- Item DTO: `{id,entityType:"PATIENT"|"APPOINTMENT",externalId,data,disposition,issueCodes,patientId,appointmentId}`. Data es el DTO mínimo normalizado privado. Disposition READY / ISSUE / IMPORTED / SKIPPED; FK nula hasta crear o encontrar identidad previa. Los detalles de pacientes/citas exigen permisos de lectura adicionales.
- Status DTO `{account,state:"DISABLED"|"NOT_CONFIGURED"|"SYNTHETIC_QA"|"PREPARED_ADAPTER",canPreview,realConnectionVerified:false,mode:"READ_ONLY_IMPORT"}`. No mostrar conectado/sincronizado real por una cuenta enabled o por una ejecución sintética.

## Lector normalizado y paginación

Interfaz sustituible interna `DentalinkReadAdapter.readPage({externalAccountId,from,to,cursor})`. Devuelve `{externalAccountId,complete,nextCursor,items:[{entityType,externalId,payload}]}`. No es un layout Dentalink. Un futuro lector oficial debe producir esos DTO tras validar autenticación/campos/zonas/estados/paginación con la documentación autorizada.

Patient payload: campos administrativos de createPatientSchema; nombres/apellidos obligatorios; fecha de nacimiento válida si se aporta, sin datos médicos. Appointment payload: `{patientExternalId,providerExternalId,locationExternalId,start,end,eligibility:"NEW_APPOINTMENT"|"UNSUPPORTED"}`. Fechas con offset, end>start; eligibility es clasificación interna que el futuro lector debe acreditar, no nombre de un estado Dentalink. Datos no reconocidos no se guardan como respuesta cruda; fila inválida queda ISSUE/INVALID_NORMALIZED_DATA con payload vacío. Logs/auditoría usan IDs técnicos, códigos, hashes y conteos, nunca los datos normalizados personales ni tokens.

Límites internos: 200 filas/página, 1000/ejecución, 50 páginas. HTTP/lectura de origen ocurre fuera de transacciones DB. Página incompleta/errónea no avanza cursor ni aplica sus filas. La siguiente petición vuelve al mismo punto. Dos lectores concurrentes no aplican la misma página. Repetición de ID con igual payload se omite; contenido distinto aborta la página con SOURCE_CHANGED. Una página final evalúa todas las filas, persiste previewHash y deja PREVIEW_READY. No puede confirmarse READING.

Si el primer POST creó la ejecución pero la lectura falla, repetir con la **misma** clave recupera su run; luego usar read-next-page. Historial paginado permite recuperar ejecuciones tras recargar UI. Replay de preview no vuelve a leer ni crea otra ejecución. La vista no crea pacientes/citas.

## Confirmación y reintentos

La confirmación bloquea cuenta/ejecución, valida clave/hash, recalcula hashes de payloads y correspondencias, y procesa pacientes antes de citas. Reutiliza los servicios existentes de pacientes/citas y su numeración transaccional. Entidad local, identidad externa y auditoría se confirman juntas. Fallo técnico/auditoría revierte toda la confirmación, también secuencias; no queda una entidad creada sin vínculo.

Las filas válidas se importan; incidencias de negocio quedan ISSUE. Posible coincidencia por nombre/documento no fusiona ni vincula automáticamente. Una cita sin paciente importable, sede/profesional válidos, con estado no soportado o solapamiento queda en incidencias. Se revalida al confirmar porque el estado local puede cambiar desde la vista previa; no se promete que todas las READY se importen. Cita nueva entra SCHEDULED para confirmación local. Cada cuenta mantiene identidades tipadas y únicas; una identidad ya importada queda SKIPPED en ejecuciones posteriores, sin actualizar datos locales.

Replay exacto de confirmación devuelve 200 aun si luego se deshabilita la cuenta; no crea registros/números/auditoría nuevos. Otra clave sobre ejecución confirmada o distinta información con la clave original produce409. Si cambian mappings o payload después de revisar, preparar nueva vista: no actualizar silenciosamente lo confirmado. Números históricos locales permanecen intactos.

## Errores publicados

400 VALIDATION_ERROR; 401/403 autenticación/permisos; 404 DENTALINK_RESOURCE_NOT_FOUND / DENTALINK_MAPPING_TARGET_NOT_FOUND, también para recursos ajenos. 409: DENTALINK_ACCOUNT_EXISTS, DENTALINK_ACCOUNT_DISABLED, DENTALINK_NOT_CONFIGURED, DENTALINK_SYNTHETIC_QA_ONLY, IDEMPOTENCY_KEY_CONFLICT, DENTALINK_CONCURRENT_CHANGE, DENTALINK_PREVIEW_NOT_READY, DENTALINK_PREVIEW_CHANGED, DENTALINK_PAGE_CHANGED, DENTALINK_SOURCE_ACCOUNT_MISMATCH, DENTALINK_PAGE_INCOMPLETE, DENTALINK_CURSOR_NOT_ADVANCING, DENTALINK_PREVIEW_LIMIT, DENTALINK_SOURCE_CHANGED. 502 DENTALINK_INVALID_PAGE; 503 DENTALINK_READ_FAILED; 500 DENTALINK_IMPORT_FAILED con rollback. No contienen payloads remotos en detalles.

Issue codes: INVALID_NORMALIZED_DATA, POSSIBLE_PATIENT_MATCH, PATIENT_REFERENCE_MISSING, PROVIDER_MAPPING_MISSING, LOCATION_MAPPING_MISSING, PROVIDER_INACTIVE, LOCATION_INACTIVE, UNSUPPORTED_SOURCE_STATUS, APPOINTMENT_PROVIDER_OVERLAP, OUTSIDE_IMPORT_WINDOW; también códigos de validación local detectados al confirmar. Son incidencias para revisión, no estados oficiales externos. No hay botón de fusión forzada ni modificación de identidades existentes.

## Pendiente real

Sin acceso de la clínica ni referencia técnica verificable no se instala lector HTTP, se acepta un token del navegador ni se anuncia sincronización real. La [guía oficial](https://ayuda.softwaredentalink.com/es/articles/9493507-integracion-api) remite a configuración de la cuenta y [referencia técnica](https://api.dentalink.healthatom.com/docs/); esta última no fue accesible en la comprobación de la ronda. Auth, recursos, muestras, estados, filtros y límites reales siguen por validar. No hay escritura hacia Dentalink, agenda automática, importación clínica, cambios de datos históricos, migración remota ni despliegue en esta entrega. SVB sigue aplazado.
